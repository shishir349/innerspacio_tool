"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnalysisPanel } from "@/components/design-studio/analysis-panel";
import { DesignBriefForm } from "@/components/design-studio/design-brief-form";
import { ConceptStudio } from "@/components/design-studio/concept-studio";
import { EstimateBuilder } from "@/components/design-studio/estimate-builder";
import { ROOM_TYPES } from "@/lib/types";
import type { AppSettings, CatalogueItem, Project, Room } from "@/lib/types";
import { CheckCircle2, Circle, Presentation } from "lucide-react";
import { cn } from "@/lib/utils";

export function RoomDesignStudio({
  project,
  room,
  catalogue,
  settings,
  anthropicConfigured,
  providerName,
  providerIsDemo,
}: {
  project: Project;
  room: Room;
  catalogue: CatalogueItem[];
  settings: AppSettings;
  anthropicConfigured: boolean;
  providerName: string;
  providerIsDemo: boolean;
}) {
  const [room_, setRoom] = useState(room);
  const [tab, setTab] = useState("analysis");
  const roomTypeLabel = ROOM_TYPES.find((t) => t.value === room_.type)?.label ?? room_.type;
  const primaryPhoto = room_.photos.find((p) => p.isPrimary) ?? room_.photos[0];

  const steps: { key: string; label: string; done: boolean }[] = [
    { key: "analysis", label: "Analysis", done: !!room_.analysis },
    { key: "brief", label: "Brief", done: !!room_.designBrief },
    { key: "concepts", label: "Concepts", done: room_.concepts.length > 0 },
    { key: "estimate", label: "Estimate", done: !!room_.estimate },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={`/projects/${project.id}`} className="text-[0.95rem] text-muted-foreground hover:underline">
            {project.title}
          </Link>
          <h1 className="display display-md text-foreground">{room.name}</h1>
          <p className="text-[0.95rem] text-muted-foreground">{roomTypeLabel}</p>
        </div>
        <Button
          variant="outline"
          render={<Link href={`/presentation/${project.id}/${room.id}`} target="_blank" />}
          className="gap-2"
        >
          <Presentation className="size-4" /> Client Presentation
        </Button>
      </div>

      {primaryPhoto && (
        <div className="relative aspect-[16/7] w-full overflow-hidden rounded-xl border border-border bg-muted">
          <Image src={primaryPhoto.url} alt={room_.name} fill unoptimized className="object-cover" />
          <Badge className="absolute bottom-3 left-3 bg-background/90 text-foreground">
            Reference photo
          </Badge>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-[0.95rem]">
        {steps.map((step, i) => (
          <button
            key={step.key}
            type="button"
            onClick={() => setTab(step.key)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1 transition-colors",
              tab === step.key
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {step.done ? (
              <CheckCircle2 className="size-3.5 text-emerald-600" />
            ) : (
              <Circle className="size-3.5" />
            )}
            {i + 1}. {step.label}
          </button>
        ))}
      </div>

      <Tabs value={tab} onValueChange={(v) => v && setTab(v)}>
        <TabsList>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="brief">Brief</TabsTrigger>
          <TabsTrigger value="concepts">Concepts</TabsTrigger>
          <TabsTrigger value="estimate">Estimate</TabsTrigger>
        </TabsList>
        <TabsContent value="analysis" className="pt-4">
          <AnalysisPanel
            projectId={project.id}
            room={room_}
            anthropicConfigured={anthropicConfigured}
            onContinue={() => setTab("brief")}
          />
        </TabsContent>
        <TabsContent value="brief" className="pt-4">
          <DesignBriefForm
            projectId={project.id}
            room={room_}
            onSaved={setRoom}
            onContinue={() => setTab("concepts")}
          />
        </TabsContent>
        <TabsContent value="concepts" className="pt-4">
          <ConceptStudio
            projectId={project.id}
            room={room_}
            providerName={providerName}
            providerIsDemo={providerIsDemo}
          />
        </TabsContent>
        <TabsContent value="estimate" className="pt-4">
          <EstimateBuilder projectId={project.id} room={room_} catalogue={catalogue} settings={settings} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
