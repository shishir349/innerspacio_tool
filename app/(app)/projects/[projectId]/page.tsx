import Link from "next/link";
import { notFound } from "next/navigation";
import { getRepository } from "@/lib/data";
import { requirePageUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { ProjectHeader } from "@/components/projects/project-header";
import { RoomList } from "@/components/projects/room-list";
import { ProjectBoqs } from "@/components/projects/project-boqs";
import { PresentationLinkPanel } from "@/components/projects/presentation-link-panel";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: PageProps<"/projects/[projectId]">) {
  await requirePageUser();
  const { projectId } = await params;
  const repo = await getRepository();
  const project = await repo.getProject(projectId);

  if (!project) notFound();
  const boqs = await repo.listBoqs(projectId);

  // The self-serve quote request(s) this project came from (staff session + RLS).
  let leads: { id: string; name: string; phone: string; created_at: string }[] = [];
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("leads")
      .select("id, name, phone, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    leads = (data ?? []) as typeof leads;
  }

  return (
    <div className="space-y-8">
      <ProjectHeader project={project} />
      {leads.length > 0 && (
        <p className="rounded-xl border border-border bg-card p-4 text-[0.95rem]">
          Came from a self-serve quote:{" "}
          {leads.map((l, i) => (
            <span key={l.id}>
              {i > 0 && ", "}
              <Link href={`/boq?project=${project.id}&lead=${l.id}`} className="font-medium text-primary underline">
                {l.name || "lead"} ({l.phone}) · {formatDate(l.created_at)}
              </Link>
            </span>
          ))}
        </p>
      )}
      <RoomList project={project} />
      <ProjectBoqs project={project} boqs={boqs} />
      <PresentationLinkPanel project={project} />
    </div>
  );
}
