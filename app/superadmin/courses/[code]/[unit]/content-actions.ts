"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { adminActor, requireAdmin } from "@/lib/auth";
import { getCourse } from "@/lib/courses";
import { deleteUploads, ownedUploads } from "@/lib/files";
import { cleanEditorHtml } from "@/lib/sanitize";
import { renameInPath } from "@/lib/file-names";
import { renameUpload } from "@/lib/files";
import { addResource, addSupportingFiles, clearSupportingFiles, getUnitContent, removeResource, renameResource, saveOverview, setSlotResource } from "@/lib/unit-content";
import { isResourceSlot, RESOURCE_LIMITS, RESOURCE_SLOTS, SUPPORTING_MAX, validateResource, type Resource, type ResourceInput, type ResourceSlot } from "@/lib/unit-meta";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function unitExists(courseCode: string, unitCode: string) {
  const course = await getCourse(courseCode);
  return !!course?.units.some((u) => u.code === unitCode);
}

const refresh = (courseCode: string, unitCode: string) => {
  revalidatePath(`/superadmin/courses/${courseCode}/${unitCode}`);
  revalidatePath("/dashboard/assessment", "layout");
};

export async function saveOverviewAction(courseCode: string, unitCode: string, html: string): Promise<Result<{ overview: string }>> {
  await requireAdmin();
  if (!(await unitExists(courseCode, unitCode))) return { ok: false, error: "This unit isn’t in the course any more." };
  const overview = cleanEditorHtml(html, RESOURCE_LIMITS.overview);
  await saveOverview(courseCode, unitCode, overview);
  await logActivity(await adminActor(), `updated the overview for ${unitCode} (${courseCode})`, "course");
  refresh(courseCode, unitCode);
  return { ok: true, overview };
}

export async function addResourceAction(courseCode: string, unitCode: string, input: ResourceInput): Promise<Result<{ resource: Resource }>> {
  const admin = await requireAdmin();
  if (!(await unitExists(courseCode, unitCode))) return { ok: false, error: "This unit isn’t in the course any more." };
  const checked = validateResource(input);
  if (!checked.ok) return checked;
  const v = checked.value;
  const base = { id: crypto.randomUUID(), title: v.title, description: v.description };

  let resource: Resource;
  if (v.kind === "file") {
    // Only a file the Super Admin just uploaded can be attached
    const [file] = await ownedUploads([v.fileId], admin.sub);
    if (!file) return { ok: false, error: "That upload wasn’t found — upload it again." };
    resource = { ...base, kind: "file", file };
  } else if (v.kind === "link") {
    resource = { ...base, kind: "link", url: v.url };
  } else {
    resource = { ...base, kind: "note", body: cleanEditorHtml(v.body, RESOURCE_LIMITS.body) };
  }

  await addResource(courseCode, unitCode, resource);
  await logActivity(await adminActor(), `added resource “${resource.title}” to ${unitCode}`, "course");
  refresh(courseCode, unitCode);
  return { ok: true, resource };
}

export async function removeResourceAction(courseCode: string, unitCode: string, resourceId: string): Promise<Result> {
  await requireAdmin();
  const removed = await removeResource(courseCode, unitCode, resourceId);
  if (!removed) return { ok: false, error: "Resource not found." };
  if (removed.kind === "file") await deleteUploads([removed.file.id]);
  await logActivity(await adminActor(), `removed resource “${removed.title}” from ${unitCode}`, "course");
  refresh(courseCode, unitCode);
  return { ok: true };
}

// Puts the Learner Guide, PowerPoint Presentation or Supporting Document in place (replacing the old one)
export async function setSlotDocumentAction(
  courseCode: string,
  unitCode: string,
  slot: ResourceSlot,
  fileId: string,
): Promise<Result<{ resource: Resource }>> {
  const admin = await requireAdmin();
  if (!isResourceSlot(slot) || slot === "supporting") return { ok: false, error: "Unknown document." };
  if (!(await unitExists(courseCode, unitCode))) return { ok: false, error: "This unit isn’t in the course any more." };
  const [file] = await ownedUploads([String(fileId)], admin.sub);
  if (!file) return { ok: false, error: "That upload wasn’t found — upload it again." };
  const label = RESOURCE_SLOTS.find((x) => x.key === slot)!.label;
  const resource = { id: crypto.randomUUID(), kind: "file" as const, title: label, description: "", file, slot };
  const previous = await setSlotResource(courseCode, unitCode, resource);
  if (previous?.kind === "file") await deleteUploads([previous.file.id]);
  await logActivity(await adminActor(), `uploaded the ${label} for ${unitCode}`, "course");
  refresh(courseCode, unitCode);
  return { ok: true, resource };
}

// Clean folder path for a supporting file ("Week 1/Notes.pdf"), falling back to the file name
const cleanPath = (raw: unknown, name: string) => {
  const parts = String(raw ?? "")
    .split(/[\\/]+/)
    .map((p) => p.trim().replace(/[^\w.\- ()]/g, "_"))
    .filter((p) => p && p !== "." && p !== "..");
  parts[parts.length - 1] = name; // the stored (safe) name is the real one
  return parts.join("/").slice(0, RESOURCE_LIMITS.title) || name;
};

// Adds uploaded files to the Supporting Document folder (a whole folder or a few files at a time)
export async function addSupportingFilesAction(
  courseCode: string,
  unitCode: string,
  items: { fileId: string; path: string }[],
): Promise<Result<{ resources: Resource[] }>> {
  const admin = await requireAdmin();
  if (!(await unitExists(courseCode, unitCode))) return { ok: false, error: "This unit isn’t in the course any more." };
  if (!Array.isArray(items) || !items.length) return { ok: false, error: "Choose the files to upload." };
  const have = (await getUnitContent(courseCode, unitCode)).resources.filter((r) => r.kind === "file" && r.slot === "supporting").length;
  const ids = items.map((i) => String(i?.fileId ?? ""));
  const owned = await ownedUploads(ids, admin.sub);
  if (have + owned.length > SUPPORTING_MAX) {
    await deleteUploads(owned.map((f) => f.id));
    return { ok: false, error: `The Supporting Document folder holds up to ${SUPPORTING_MAX} files — it has ${have} already.` };
  }
  const resources: Resource[] = owned.map((file) => ({
    id: crypto.randomUUID(),
    kind: "file",
    title: cleanPath(items.find((i) => i.fileId === file.id)?.path, file.name),
    description: "",
    file,
    slot: "supporting",
  }));
  if (!resources.length) return { ok: false, error: "Those uploads weren’t found — upload them again." };
  await addSupportingFiles(courseCode, unitCode, resources);
  await logActivity(await adminActor(), `added ${resources.length} Supporting Document file${resources.length === 1 ? "" : "s"} to ${unitCode}`, "course");
  refresh(courseCode, unitCode);
  return { ok: true, resources };
}

// Renames one Supporting Document file (its folder and file type stay the same); students see and download the new name
export async function renameSupportingFileAction(courseCode: string, unitCode: string, resourceId: string, name: string): Promise<Result<{ title: string }>> {
  await requireAdmin();
  const r = (await getUnitContent(courseCode, unitCode)).resources.find((x) => x.id === resourceId);
  if (!r || r.kind !== "file" || r.slot !== "supporting") return { ok: false, error: "File not found." };
  const title = renameInPath(r.title, name);
  if (title === r.title) return { ok: true, title };
  await renameResource(courseCode, unitCode, resourceId, title);
  await renameUpload(r.file.id, title.slice(title.lastIndexOf("/") + 1));
  await logActivity(await adminActor(), `renamed a Supporting Document file in ${unitCode} to “${title}”`, "course");
  refresh(courseCode, unitCode);
  return { ok: true, title };
}

// Empties the Supporting Document folder
export async function clearSupportingFilesAction(courseCode: string, unitCode: string): Promise<Result> {
  await requireAdmin();
  const removed = await clearSupportingFiles(courseCode, unitCode);
  await deleteUploads(removed.flatMap((r) => (r.kind === "file" ? [r.file.id] : [])));
  await logActivity(await adminActor(), `removed the Supporting Document folder from ${unitCode}`, "course");
  refresh(courseCode, unitCode);
  return { ok: true };
}
