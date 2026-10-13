import { notFound } from "next/navigation";
import { getRepository } from "@/lib/data";
import { requirePageUser } from "@/lib/auth";
import { toPresentationProject } from "@/lib/presentation/dto";
import { PresentationView } from "@/components/presentation/presentation-view";

export const dynamic = "force-dynamic";

export default async function PresentationPage({
  params,
}: PageProps<"/presentation/[projectId]/[roomId]">) {
  // The presentation is shown by a signed-in designer during a client
  // meeting — the client never has their own account. Still gated behind
  // auth because it's rendered from this app's own session, on the
  // designer's device, not a link handed to the client.
  await requirePageUser();
  const { projectId, roomId } = await params;
  const repo = await getRepository();
  const project = await repo.getProject(projectId);
  if (!project || !project.rooms.some((r) => r.id === roomId)) notFound();

  const presentation = toPresentationProject(project);

  return <PresentationView presentation={presentation} activeRoomId={roomId} />;
}
