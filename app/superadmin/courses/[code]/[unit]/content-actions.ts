"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { adminActor, requireAdmin } from "@/lib/auth";
import { getCourse } from "@/lib/courses";
import { deleteUploads, ownedUploads } from "@/lib/files";
import { cleanEditorHtml } from "@/lib/sanitize";
import { addResource, removeResource, saveOverview, setSlotResource } from "@/lib/unit-content";
import { isResourceSlot, RESOURCE_LIMITS, RESOURCE_SLOTS, validateResource, type Resource, type ResourceInput, type ResourceSlot } from "@/lib/unit-meta";

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
  if (!isResourceSlot(slot)) return { ok: false, error: "Unknown document." };
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
