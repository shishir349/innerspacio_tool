import { describe, expect, it } from "vitest";
import {
  sniffImageDimensions,
  uploadRoomPhoto,
  PhotoUploadError,
  MIN_PHOTO_DIMENSION,
  MAX_PHOTO_DIMENSION,
  MAX_PHOTO_BYTES,
} from "./storage";

// These tests exercise the demo-mode path (no Supabase env vars set under
// Vitest — see vitest.config.ts), which still runs the same validate() call
// uploadRoomPhoto makes before ever touching storage, so dimension/MIME/size
// checks are covered without mocking Supabase.

function makePngBuffer(width: number, height: number): Buffer {
  const buf = Buffer.alloc(24);
  buf[0] = 0x89;
  buf[1] = 0x50;
  buf[2] = 0x4e;
  buf[3] = 0x47;
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

function makeJpegBuffer(width: number, height: number): Buffer {
  const buf = Buffer.alloc(12);
  buf[0] = 0xff;
  buf[1] = 0xd8; // SOI
  buf[2] = 0xff;
  buf[3] = 0xc0; // SOF0
  buf[4] = 0x00;
  buf[5] = 0x11; // segment length (unused by the sniffer)
  buf[6] = 0x08; // precision (unused by the sniffer)
  buf.writeUInt16BE(height, 7);
  buf.writeUInt16BE(width, 9);
  return buf;
}

function pngFile(width: number, height: number, name = "room.png"): File {
  const bytes = new Uint8Array(makePngBuffer(width, height));
  return new File([bytes], name, { type: "image/png" });
}

describe("sniffImageDimensions", () => {
  it("reads width/height from a PNG header", () => {
    expect(sniffImageDimensions(makePngBuffer(1920, 1080))).toEqual({ width: 1920, height: 1080 });
  });

  it("reads width/height from a JPEG SOF0 header", () => {
    expect(sniffImageDimensions(makeJpegBuffer(800, 600))).toEqual({ width: 800, height: 600 });
  });

  it("returns null for a format it can't parse", () => {
    const webpLike = Buffer.from("RIFF....WEBPVP8 ....");
    expect(sniffImageDimensions(webpLike)).toBeNull();
  });

  it("returns null for a buffer too short to contain a PNG header", () => {
    expect(sniffImageDimensions(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
  });
});

describe("uploadRoomPhoto validation (demo-mode path)", () => {
  it("accepts a photo at exactly the minimum dimension", async () => {
    const file = pngFile(MIN_PHOTO_DIMENSION, MIN_PHOTO_DIMENSION);
    const result = await uploadRoomPhoto("room-1", file);
    expect(result.url).toMatch(/^data:image\/png;base64,/);
  });

  it("rejects a photo smaller than the minimum dimension", async () => {
    const file = pngFile(MIN_PHOTO_DIMENSION - 1, MIN_PHOTO_DIMENSION);
    await expect(uploadRoomPhoto("room-1", file)).rejects.toThrow(PhotoUploadError);
  });

  it("rejects a photo larger than the maximum dimension", async () => {
    const file = pngFile(MAX_PHOTO_DIMENSION + 1, MAX_PHOTO_DIMENSION);
    await expect(uploadRoomPhoto("room-1", file)).rejects.toThrow(PhotoUploadError);
  });

  it("rejects an unsupported MIME type", async () => {
    const file = new File([new Uint8Array(makePngBuffer(1000, 1000))], "room.gif", { type: "image/gif" });
    await expect(uploadRoomPhoto("room-1", file)).rejects.toThrow(PhotoUploadError);
  });

  it("rejects an empty file", async () => {
    const file = new File([], "room.png", { type: "image/png" });
    await expect(uploadRoomPhoto("room-1", file)).rejects.toThrow(PhotoUploadError);
  });

  it("rejects a file larger than the byte limit", async () => {
    const oversized = new Uint8Array(Buffer.concat([makePngBuffer(1000, 1000), Buffer.alloc(MAX_PHOTO_BYTES)]));
    const file = new File([oversized], "room.png", { type: "image/png" });
    await expect(uploadRoomPhoto("room-1", file)).rejects.toThrow(PhotoUploadError);
  });

  it("accepts a WEBP file it cannot dimension-sniff, deferring to MIME+size checks only", async () => {
    const file = new File([Buffer.from("not really webp bytes")], "room.webp", { type: "image/webp" });
    const result = await uploadRoomPhoto("room-1", file);
    expect(result.url).toMatch(/^data:image\/webp;base64,/);
  });
});
