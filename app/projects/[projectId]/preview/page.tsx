import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/config";
import { getDesignerPreviewData } from "@/lib/presentation-links/preview";
import { PresentationExperience } from "@/components/present/presentation-experience";
import { LinkUnavailable } from "@/components/present/link-unavailable";

export const dynamic = "force-dynamic";

export default async function ProjectPreviewPage({
  params,
}: PageProps<"/projects/[projectId]/preview">) {
  await requirePageUser();
  const { projectId } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <LinkUnavailable reason="Client presentation links require Supabase to be configured — connect it to preview this project's client view." />
    );
  }

  const data = await getDesignerPreviewData(projectId);
  if (!data) notFound();

  return <PresentationExperience token="" data={data} readOnly />;
}
