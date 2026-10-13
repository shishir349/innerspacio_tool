import { notFound } from "next/navigation";
import { getRepository } from "@/lib/data";
import { requirePageUser } from "@/lib/auth";
import { isAnthropicConfigured } from "@/lib/config";
import { getImageGenerationProvider } from "@/lib/image-gen/provider";
import { RoomDesignStudio } from "@/components/design-studio/room-design-studio";

export const dynamic = "force-dynamic";

export default async function DesignStudioRoomPage({
  params,
}: PageProps<"/design-studio/[projectId]/[roomId]">) {
  await requirePageUser();
  const { projectId, roomId } = await params;
  const repo = await getRepository();
  const project = await repo.getProject(projectId);
  const room = project?.rooms.find((r) => r.id === roomId);

  if (!project || !room) notFound();

  const [catalogue, settings] = await Promise.all([repo.listCatalogueItems(), repo.getSettings()]);
  const provider = getImageGenerationProvider();

  return (
    <RoomDesignStudio
      project={project}
      room={room}
      catalogue={catalogue}
      settings={settings}
      anthropicConfigured={isAnthropicConfigured()}
      providerName={provider.name}
      providerIsDemo={provider.isDemo}
    />
  );
}
