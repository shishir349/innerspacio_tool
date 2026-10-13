import type { Metadata } from "next";
import { isSupabaseConfigured } from "@/lib/config";
import {
  getClientPresentationData,
  logAuditEvent,
  resolvePresentationLink,
  touchLastAccessed,
} from "@/lib/presentation-links/token";
import { LinkUnavailable } from "@/components/present/link-unavailable";
import { PresentationExperience } from "@/components/present/presentation-experience";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your InnerSpacio Presentation",
  description: "Your space, your story.",
};

export default async function ClientPresentationPage({
  params,
}: PageProps<"/present/[token]">) {
  const { token } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <LinkUnavailable reason="Client presentation links require the studio's database to be configured. Please contact your designer." />
    );
  }

  const resolved = await resolvePresentationLink(token);
  if (!resolved.ok) {
    return (
      <LinkUnavailable reason="This presentation link is no longer available. Please contact your designer for an updated link." />
    );
  }

  await Promise.all([
    touchLastAccessed(resolved.link),
    logAuditEvent(resolved.link, "client.link_viewed"),
  ]);

  const data = await getClientPresentationData(resolved.link);

  return <PresentationExperience token={token} data={data} />;
}
