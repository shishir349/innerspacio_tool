import { getRepository } from "@/lib/data";
import { requirePageUser } from "@/lib/auth";
import { SettingsForm } from "@/components/settings/settings-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  isAnthropicConfigured,
  isImageGenerationConfigured,
  isSupabaseConfigured,
  getAnthropicModel,
  getImageGenerationProviderName,
} from "@/lib/config";

export const dynamic = "force-dynamic";

function StatusRow({
  label,
  configured,
  detail,
}: {
  label: string;
  configured: boolean;
  detail?: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-3 last:border-0">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      </div>
      <Badge
        variant="outline"
        className={
          configured
            ? "border-primary/30 bg-primary/10 text-primary"
            : "border-border text-muted-foreground"
        }
      >
        {configured ? "Configured" : "Demo mode"}
      </Badge>
    </div>
  );
}

export default async function SettingsPage() {
  const user = await requirePageUser();
  const repo = await getRepository();
  const settings = await repo.getSettings();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          Studio configuration · Signed in as {user.email}
        </p>
        <h1 className="editorial-heading text-3xl text-foreground">Settings</h1>
      </div>

      <SettingsForm settings={settings} />

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle className="editorial-heading text-lg">Integration Status</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border/60">
          <StatusRow
            label="Supabase (database, auth & storage)"
            configured={isSupabaseConfigured()}
            detail="Projects, rooms, catalogue and estimates are stored in a local demo file until this is configured."
          />
          <StatusRow
            label="Claude (AI room analysis)"
            configured={isAnthropicConfigured()}
            detail={`Model: ${getAnthropicModel()}`}
          />
          <StatusRow
            label="Image generation"
            configured={isImageGenerationConfigured()}
            detail={`Provider: ${getImageGenerationProviderName()}`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
