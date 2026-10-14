import "server-only";
import { AIConfigurationError, AIRequestError, AIValidationError } from "@/lib/ai/errors";

/**
 * Minimal Manus API (v1) client. Manus runs *agent tasks*: create one, poll it, read the
 * final assistant message. There is no tool-calling or schema-constrained output on v1, so
 * callers ask for JSON in the prompt and validate it themselves.
 *
 * v1 is documented as deprecated; this file is the only place that knows the wire format,
 * so moving to v2 (which adds structured_output_schema) is a one-file change.
 */

const BASE = (process.env.MANUS_API_BASE || "https://api.manus.ai").replace(/\/$/, "");
const REQUEST_TIMEOUT_MS = 60_000;

export function isManusConfigured(): boolean {
  return Boolean(process.env.MANUS_API_KEY);
}

export interface ManusAttachment {
  filename: string;
  /** `data:<mime>;base64,<content>` */
  fileData: string;
}

export type ManusState = "running" | "completed" | "failed";

export interface ManusTaskResult {
  state: ManusState;
  /** Final assistant text (only meaningful when completed). */
  text: string;
  error?: string;
}

async function call(method: string, path: string, body?: unknown): Promise<unknown> {
  const key = process.env.MANUS_API_KEY;
  if (!key) throw new AIConfigurationError("MANUS_API_KEY is not configured on the server.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      // v1 authenticates with API_KEY, v2 with x-manus-api-key (same key).
      headers: {
        ...(path.startsWith("/v2/") ? { "x-manus-api-key": key } : { API_KEY: key }),
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new AIRequestError("The AI service did not respond in time. Please try again.", "timeout");
    }
    console.error("[manus] request failed:", error instanceof Error ? error.message : error);
    throw new AIRequestError("Could not reach the AI service. Please try again.", "request_failed");
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401 || res.status === 403) {
    console.error("[manus] key rejected:", res.status);
    throw new AIConfigurationError(
      "The server's Manus API key was rejected (invalid or revoked). Replace MANUS_API_KEY on the server."
    );
  }
  if (res.status === 429) {
    throw new AIRequestError("The AI service is rate-limiting requests. Wait a moment and retry.", "rate_limited");
  }
  const text = await res.text();
  if (!res.ok) {
    console.error("[manus] http", res.status, text.slice(0, 300));
    throw new AIRequestError("The AI service returned an error. Please try again.", "request_failed");
  }
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new AIValidationError("The AI service returned an unreadable response.");
  }
}

/** Starts an agent task and returns its id. */
export async function createManusTask(args: {
  prompt: string;
  attachments: ManusAttachment[];
}): Promise<string> {
  const out = (await call("POST", "/v1/tasks", {
    prompt: args.prompt,
    agentProfile: process.env.MANUS_AGENT_PROFILE || "manus-1.6",
    attachments: args.attachments,
    hideInTaskList: true,
    interactiveMode: false,
  })) as { task_id?: string };
  if (!out.task_id) throw new AIValidationError("The AI service did not return a task id.");
  return out.task_id;
}

interface RawEvent {
  type?: string;
  status_update?: { agent_status?: string; description?: string; error_message?: string };
  assistant_message?: { content?: string; delivery_kind?: string };
}

/**
 * Pure: maps v2 task.listMessages events (oldest first) to our small result shape.
 * The agent's final reply is the last assistant_message (delivery_kind "result" when present);
 * the task is finished when the latest status_update is "stopped".
 */
export function interpretMessages(events: RawEvent[]): ManusTaskResult {
  let status = "";
  let detail = "";
  let result: string | undefined;
  let lastText: string | undefined;
  for (const e of events) {
    if (e.type === "status_update" && e.status_update) {
      status = String(e.status_update.agent_status ?? "").toLowerCase();
      detail = e.status_update.error_message || e.status_update.description || "";
    } else if (e.type === "assistant_message" && e.assistant_message?.content) {
      lastText = e.assistant_message.content;
      if (e.assistant_message.delivery_kind === "result") result = e.assistant_message.content;
    }
  }

  if (status === "error") {
    return { state: "failed", text: "", error: (detail || "The AI task failed.").slice(0, 300) };
  }
  if (status === "waiting") {
    // The agent is asking for input we never provide; don't hang the user.
    return { state: "failed", text: "", error: "The AI agent needed more input. Make the requirements more specific and retry." };
  }
  if (status !== "stopped") return { state: "running", text: "" };

  const text = (result ?? lastText ?? "").trim();
  if (!text) return { state: "failed", text: "", error: "The AI task finished without a reply." };
  return { state: "completed", text };
}

export async function getManusTask(taskId: string): Promise<ManusTaskResult> {
  const out = (await call(
    "GET",
    `/v2/task.listMessages?task_id=${encodeURIComponent(taskId)}&order=asc&limit=200`
  )) as { messages?: RawEvent[] };
  return interpretMessages(out.messages ?? []);
}

/** Best-effort cleanup so client plans/photos don't linger in the provider's task list. */
export async function deleteManusTask(taskId: string): Promise<void> {
  try {
    await call("DELETE", `/v1/tasks/${encodeURIComponent(taskId)}`);
  } catch {
    // never fail a finished analysis because cleanup failed
  }
}

/** Pulls the first JSON object out of an agent reply (handles ``` fences and prose around it). */
export function extractJsonObject(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = fenced ? fenced[1] : text;
  const a = candidate.indexOf("{");
  const b = candidate.lastIndexOf("}");
  if (a === -1 || b <= a) throw new AIValidationError("The AI reply did not contain a BOQ scope.");
  try {
    return JSON.parse(candidate.slice(a, b + 1));
  } catch {
    throw new AIValidationError("The AI reply was not valid JSON. Please try again.");
  }
}
