"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { removeRoomPhotoAction, uploadRoomPhotoAction } from "@/lib/actions/projects";
import {
  ACCEPTED_PHOTO_TYPES,
  MAX_PHOTO_BYTES,
  MIN_PHOTO_DIMENSION,
  MAX_PHOTO_DIMENSION,
} from "@/lib/photo-constraints";
import type { RoomPhoto } from "@/lib/types";
import { ImagePlus, Star, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type UploadSlot = { id: string; fileName: string; previewUrl: string; progress: "uploading" | "done" | "error" };

function loadImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = document.createElement("img");
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null); // e.g. HEIC — browsers can't decode it for a dimension check; server still validates.
    };
    img.src = url;
  });
}

async function precheckFile(file: File): Promise<string | null> {
  if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) {
    return `"${file.name}": unsupported file type. Upload a JPEG, PNG, WEBP or HEIC photo.`;
  }
  if (file.size === 0) {
    return `"${file.name}" is empty.`;
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return `"${file.name}" is larger than 8MB.`;
  }
  const dimensions = await loadImageDimensions(file);
  if (dimensions) {
    if (dimensions.width < MIN_PHOTO_DIMENSION || dimensions.height < MIN_PHOTO_DIMENSION) {
      return `"${file.name}" is too small (${dimensions.width}×${dimensions.height}px, minimum ${MIN_PHOTO_DIMENSION}×${MIN_PHOTO_DIMENSION}px).`;
    }
    if (dimensions.width > MAX_PHOTO_DIMENSION || dimensions.height > MAX_PHOTO_DIMENSION) {
      return `"${file.name}" is unusually large (${dimensions.width}×${dimensions.height}px, maximum ${MAX_PHOTO_DIMENSION}×${MAX_PHOTO_DIMENSION}px).`;
    }
  }
  return null;
}

export function RoomPhotosManager({
  projectId,
  roomId,
  photos,
}: {
  projectId: string;
  roomId: string;
  photos: RoomPhoto[];
}) {
  const [uploads, setUploads] = useState<UploadSlot[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasPhotos = photos.length > 0;

  async function onFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      const slotId = `${file.name}-${Date.now()}-${Math.random()}`;
      const previewUrl = URL.createObjectURL(file);
      setUploads((prev) => [...prev, { id: slotId, fileName: file.name, previewUrl, progress: "uploading" }]);

      const problem = await precheckFile(file);
      if (problem) {
        toast.error(problem);
        setUploads((prev) => prev.filter((u) => u.id !== slotId));
        URL.revokeObjectURL(previewUrl);
        continue;
      }

      const formData = new FormData();
      formData.set("file", file);
      formData.set("isPrimary", !hasPhotos && uploads.length === 0 ? "true" : "false");

      const result = await uploadRoomPhotoAction(projectId, roomId, formData);
      if (!result.ok) {
        toast.error(result.error);
        setUploads((prev) => prev.map((u) => (u.id === slotId ? { ...u, progress: "error" } : u)));
        setTimeout(() => {
          setUploads((prev) => prev.filter((u) => u.id !== slotId));
          URL.revokeObjectURL(previewUrl);
        }, 2500);
        continue;
      }

      setUploads((prev) => prev.filter((u) => u.id !== slotId));
      URL.revokeObjectURL(previewUrl);
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  function onRemove(photoId: string) {
    setRemovingId(photoId);
    removeRoomPhotoAction(projectId, roomId, photoId).then((result) => {
      setRemovingId(null);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((photo) => (
          <div
            key={photo.id}
            className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-border bg-muted"
          >
            <Image
              src={photo.url}
              alt={photo.caption || "Room photo"}
              fill
              unoptimized
              className={cn("object-cover", removingId === photo.id && "opacity-40")}
            />
            {photo.isPrimary && (
              <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                <Star className="size-2.5 fill-current" /> Primary
              </span>
            )}
            <button
              type="button"
              onClick={() => onRemove(photo.id)}
              disabled={removingId === photo.id}
              className="absolute right-2 top-2 rounded-full bg-background/90 p-1.5 text-foreground opacity-0 shadow transition-opacity group-hover:opacity-100"
            >
              {removingId === photo.id ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
            </button>
          </div>
        ))}

        {uploads.map((upload) => (
          <div
            key={upload.id}
            className="relative aspect-[4/3] overflow-hidden rounded-lg border border-border bg-muted"
          >
            <Image
              src={upload.previewUrl}
              alt={upload.fileName}
              fill
              unoptimized
              className={cn("object-cover", upload.progress !== "done" && "opacity-50")}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/40 text-center text-xs">
              {upload.progress === "uploading" && (
                <>
                  <Loader2 className="size-5 animate-spin text-foreground" />
                  <span className="px-2 text-foreground">Uploading&hellip;</span>
                </>
              )}
              {upload.progress === "error" && <span className="px-2 font-medium text-destructive">Failed</span>}
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
        >
          <ImagePlus className="size-5" />
          <span className="text-xs">Upload photo</span>
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        multiple
        className="hidden"
        onChange={(e) => onFilesSelected(e.target.files)}
      />
      <p className="text-xs text-muted-foreground">
        JPEG, PNG, WEBP or HEIC, up to 8MB each, at least {MIN_PHOTO_DIMENSION}&times;{MIN_PHOTO_DIMENSION}px. The
        first photo is used as the primary reference for AI analysis and concept generation.
      </p>
    </div>
  );
}
