// Shared client+server constants for room-photo validation. No "server-only"
// import here deliberately — the client-side upload UI pre-checks against
// these same values before ever sending bytes to the server, which still
// re-validates independently in lib/storage.ts (the client check is only a
// fast-fail UX convenience, never the security boundary).

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8MB
export const ACCEPTED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
export const MIN_PHOTO_DIMENSION = 300; // px, each side — rejects thumbnails/corrupt files
export const MAX_PHOTO_DIMENSION = 12000; // px, each side — rejects absurd/decompression-bomb-shaped files
