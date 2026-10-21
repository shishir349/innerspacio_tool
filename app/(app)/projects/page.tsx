import { Reveal } from "@/components/motion/reveal";
import { getRepository } from "@/lib/data";
import { requirePageUser } from "@/lib/auth";
import { ProjectCard } from "@/components/projects/project-card";
import { NewProjectDialog } from "@/components/projects/new-project-dialog";
import { PageHeader } from "@/components/layout/page-header";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  searchParams,
}: PageProps<"/projects">) {
  await requirePageUser();
  const repo = await getRepository();
  const projects = await repo.listProjectSummaries();
  const params = await searchParams;
  const shouldOpen = params?.new === "1";

  return (
    <div className="space-y-6">
      <PageHeader title="Projects" description="All client work." actions={<NewProjectDialog defaultOpen={shouldOpen} />} />

      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-[0.95rem] text-muted-foreground">No projects yet.</p>
        </div>
      ) : (
        <Reveal className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" stagger={0.06} immediate>
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </Reveal>
      )}
    </div>
  );
}
