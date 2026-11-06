import "server-only";
import { Readable } from "node:stream";
import { GridFSBucket, ObjectId } from "mongodb";
import { getDb } from "./db";
import { checkUpload } from "./file-types";

// Uploaded student files live in MongoDB GridFS ("uploads.files" / "uploads.chunks").
type FileMeta = { ownerId: string; contentType: string };

async function bucket() {
  return new GridFSBucket(await getDb(), { bucketName: "uploads" });
}

export class UploadError extends Error {}

export async function saveUpload(file: File, ownerId: string) {
  const buf = Buffer.from(await file.arrayBuffer());
  const checked = checkUpload(file.name, buf);
  if (!checked.ok) throw new UploadError(checked.error);
  const name = checked.safeName;
  const upload = (await bucket()).openUploadStream(name, {
    metadata: { ownerId, contentType: checked.mime } satisfies FileMeta,
  });
  await new Promise<void>((resolve, reject) => {
    Readable.from(buf).pipe(upload).on("finish", () => resolve()).on("error", reject);
  });
  return { id: upload.id.toString(), name, size: file.size };
}

export async function getUpload(id: string) {
  if (!ObjectId.isValid(id)) return null;
  const b = await bucket();
  const [doc] = await b.find({ _id: new ObjectId(id) }).limit(1).toArray();
  if (!doc) return null;
  const meta = doc.metadata as FileMeta;
  return { name: doc.filename, size: doc.length, ownerId: meta.ownerId, contentType: meta.contentType, open: () => b.openDownloadStream(doc._id) };
}

// Which of these ids really are files uploaded by this owner
export async function ownedUploads(ids: string[], ownerId: string) {
  const valid = ids.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
  if (!valid.length) return [];
  const docs = await (await bucket()).find({ _id: { $in: valid }, "metadata.ownerId": ownerId }).toArray();
  return docs.map((d) => ({ id: d._id.toString(), name: d.filename, size: d.length }));
}

// Changes the name a file downloads as (already cleaned with lib/file-names.ts)
export async function renameUpload(id: string, name: string) {
  if (!ObjectId.isValid(id)) return;
  await (await bucket()).rename(new ObjectId(id), name).catch(() => undefined);
}

export async function deleteUploads(ids: string[]) {
  const b = await bucket();
  await Promise.all(
    ids.filter((id) => ObjectId.isValid(id)).map((id) => b.delete(new ObjectId(id)).catch(() => undefined)),
  );
}
