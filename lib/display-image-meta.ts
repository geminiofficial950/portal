// Shared by server code and client components (no server-only imports here).
import type { FileRef } from "./submission-meta";

/** Where a course thumbnail or trainer photo is shown from (null = no picture) */
export const imageUrl = (file: FileRef | null | undefined) => (file ? `/api/files/${encodeURIComponent(file.id)}?inline=1` : null);

/** Only PNG or JPG pictures for thumbnails and profile photos (the upload check allows these image types) */
export const isImageName = (name: string) => /\.(png|jpe?g)$/i.test(name);
