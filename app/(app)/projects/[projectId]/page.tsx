import { notFound } from "next/navigation";
import { getRepository } from "@/lib/data";
import { requirePageUser } from "@/lib/auth";
import { ProjectHeader } from "@/components/projects/project-header";
import { RoomList } from "@/components/projects/room-list";
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

  return (
    <div className="space-y-8">
      <ProjectHeader project={project} />
      <RoomList project={project} />
      <PresentationLinkPanel project={project} />
    </div>
  );
}
