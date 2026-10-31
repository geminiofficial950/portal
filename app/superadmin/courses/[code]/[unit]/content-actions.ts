"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { requireAdmin } from "@/lib/auth";
import { getCourse } from "@/lib/courses";
import { deleteUploads, ownedUploads } from "@/lib/files";
import { cleanEditorHtml } from "@/lib/sanitize";
import { addResource, removeResource, saveOverview } from "@/lib/unit-content";
import { RESOURCE_LIMITS, validateResource, type Resource, type ResourceInput } from "@/lib/unit-meta";

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
  await logActivity("Super Admin", `updated the overview for ${unitCode} (${courseCode})`, "course");
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
  await logActivity("Super Admin", `added resource “${resource.title}” to ${unitCode}`, "course");
  refresh(courseCode, unitCode);
  return { ok: true, resource };
}

export async function removeResourceAction(courseCode: string, unitCode: string, resourceId: string): Promise<Result> {
  await requireAdmin();
  const removed = await removeResource(courseCode, unitCode, resourceId);
  if (!removed) return { ok: false, error: "Resource not found." };
  if (removed.kind === "file") await deleteUploads([removed.file.id]);
  await logActivity("Super Admin", `removed resource “${removed.title}” from ${unitCode}`, "course");
  refresh(courseCode, unitCode);
  return { ok: true };
}
