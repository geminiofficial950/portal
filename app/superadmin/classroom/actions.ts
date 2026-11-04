"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { requireStaff } from "@/lib/auth";
import { addClassLink, countClassLinks, getClassLink, removeClassLink, updateClassLink } from "@/lib/classroom";
import { checkClassLink, CLASS_LIMITS, type ClassLinkDTO } from "@/lib/classroom-meta";
import { getCourse } from "@/lib/courses";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

// Super Admin, Admins and trainers all manage class links
const refresh = () => {
  revalidatePath("/dashboard/classroom");
  revalidatePath("/superadmin/classroom");
  revalidatePath("/trainer/classroom");
};

export async function addClassLinkAction(courseCode: string, input: { title: string; url: string }): Promise<Result<{ link: ClassLinkDTO }>> {
  const staff = await requireStaff();
  const course = await getCourse(String(courseCode));
  if (!course) return { ok: false, error: "Choose a course." };
  const checked = checkClassLink(input);
  if (!checked.ok) return checked;
  if ((await countClassLinks(course.code)) >= CLASS_LIMITS.perCourse) {
    return { ok: false, error: `A course can have up to ${CLASS_LIMITS.perCourse} class links — remove an old one first.` };
  }
  const link = await addClassLink({ courseCode: course.code, title: checked.title, url: checked.url, addedBy: staff.name });
  await logActivity(staff.name, `added the class “${link.title}” for ${course.code}`, "course");
  refresh();
  return { ok: true, link };
}

export async function updateClassLinkAction(id: string, input: { title: string; url: string }): Promise<Result<{ link: ClassLinkDTO }>> {
  const staff = await requireStaff();
  const checked = checkClassLink(input);
  if (!checked.ok) return checked;
  const link = await updateClassLink(id, { title: checked.title, url: checked.url, addedBy: staff.name });
  if (!link) return { ok: false, error: "That class was removed." };
  await logActivity(staff.name, `updated the class “${link.title}” for ${link.courseCode}`, "course");
  refresh();
  return { ok: true, link };
}

export async function removeClassLinkAction(id: string): Promise<Result> {
  const staff = await requireStaff();
  if (!(await getClassLink(id))) return { ok: false, error: "That class was already removed." };
  const link = await removeClassLink(id);
  if (link) await logActivity(staff.name, `removed the class “${link.title}” from ${link.courseCode}`, "course");
  refresh();
  return { ok: true };
}
