import { Reveal } from "@/components/motion/reveal";
import { getRepository } from "@/lib/data";
import { requirePageUser } from "@/lib/auth";
import { ProjectCard } from "@/components/projects/project-card";
import { NewProjectDialog } from "@/components/projects/new-project-dialog";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  searchParams,
}: PageProps<"/projects">) {
  await requirePageUser();
  const repo = await getRepository();
  const projects = await repo.listProjects();
  const params = await searchParams;
  const shouldOpen = params?.new === "1";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">All client work</p>
          <h1 className="display display-md mt-4 text-foreground">Projects</h1>
        </div>
        <NewProjectDialog defaultOpen={shouldOpen} />
      </div>

      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">No projects yet.</p>
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
