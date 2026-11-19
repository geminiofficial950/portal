"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { adminActor, DELETE_SUPER_ADMIN_ONLY, requireAdmin, requireSuperAdmin } from "@/lib/auth";
import { checkLoginEmail, checkTrainerId } from "@/lib/group-meta";
import { changeTrainerLogin, IdentityTakenError } from "@/lib/identity";
import { unassignTrainerTickets } from "@/lib/tickets";
import type { TrainerDTO } from "@/lib/trainer-meta";
import {
  createTrainer,
  deleteTrainer,
  getTrainer,
  DuplicateTrainerEmailError,
  resetTrainerPassword,
  setTrainerActive,
  setTrainerPhoto,
} from "@/lib/trainers";
import { deleteUploads, ownedUploads } from "@/lib/files";
import { isImageName } from "@/lib/display-image-meta";
import type { FileRef } from "@/lib/submission-meta";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function addTrainerAction(input: {
  name: string;
  email: string;
  password: string;
}): Promise<Result<{ trainer: TrainerDTO }>> {
  await requireAdmin();
  const name = input.name.trim();
  const email = input.email.trim();
  if (!name) return { ok: false, error: "Enter a name." };
  if (!EMAIL.test(email)) return { ok: false, error: "Enter a valid email." };
  if (input.password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };

  try {
    const trainer = await createTrainer({ name, email, password: input.password });
    await logActivity(await adminActor(), `added trainer ${trainer.name} (${trainer.trainerId})`, "trainer");
    revalidatePath("/superadmin", "layout");
    return { ok: true, trainer };
  } catch (err) {
    if (err instanceof DuplicateTrainerEmailError) return { ok: false, error: "A trainer with this email already exists." };
    console.error("createTrainer failed:", err);
    return { ok: false, error: "Couldn’t save. Try again." };
  }
}

export async function setTrainerActiveAction(trainerId: string, active: boolean): Promise<Result> {
  await requireAdmin();
  const doc = await setTrainerActive(trainerId, active);
  if (!doc) return { ok: false, error: "Trainer not found." };
  await logActivity(await adminActor(), `${active ? "turned on" : "switched off"} access for ${doc.name}`, "trainer");
  revalidatePath("/superadmin", "layout");
  return { ok: true };
}

export async function resetTrainerPasswordAction(trainerId: string, password: string): Promise<Result> {
  await requireAdmin();
  if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
  const found = await resetTrainerPassword(trainerId, password);
  if (!found) return { ok: false, error: "Trainer not found." };
  await logActivity(await adminActor(), `reset the password for ${trainerId}`, "trainer");
  return { ok: true };
}

// Super Admin only — an Admin switches the trainer off instead
export async function deleteTrainerAction(trainerId: string): Promise<Result> {
  const admin = await requireAdmin();
  if (!admin.isSuper) return { ok: false, error: DELETE_SUPER_ADMIN_ONLY };
  const doc = await deleteTrainer(trainerId);
  if (!doc) return { ok: false, error: "Trainer not found." };
  await unassignTrainerTickets(trainerId);
  await logActivity(await adminActor(), `removed trainer ${doc.name}`, "trainer");
  revalidatePath("/superadmin", "layout");
  return { ok: true };
}

// Super Admin only: change a trainer's login email and/or trainer ID. A new ID is carried across their batch
// assignments, class sessions and uploads. Their old session ends; the password stays.
export async function changeTrainerLoginAction(trainerId: string, input: { email: string; trainerId: string }): Promise<Result<{ trainer: TrainerDTO; moved: number }>> {
  const admin = await requireSuperAdmin();
  const email = checkLoginEmail(String(input?.email ?? ""));
  if ("error" in email) return { ok: false, error: email.error };
  const id = checkTrainerId(String(input?.trainerId ?? ""));
  if ("error" in id) return { ok: false, error: id.error };
  let res;
  try {
    res = await changeTrainerLogin(String(trainerId), { id: id.id, email: email.email });
  } catch (err) {
    if (err instanceof IdentityTakenError) return { ok: false, error: err.message };
    throw err;
  }
  if (!res) return { ok: false, error: "Trainer not found." };
  const trainer = (await getTrainer(id.id))!;
  const changes = [res.before.id !== id.id ? `ID ${res.before.id} → ${id.id}` : "", res.before.email !== email.email ? `email ${res.before.email} → ${email.email}` : ""].filter(Boolean).join(", ");
  if (changes) await logActivity(admin.label, `changed ${trainer.name}’s login: ${changes}`, "trainer");
  revalidatePath("/superadmin", "layout");
  revalidatePath("/trainer", "layout");
  return { ok: true, trainer, moved: res.moved };
}

// Trainer profile picture: `fileId` is an image this admin just uploaded (/api/files); null removes it
export async function setTrainerPhotoAction(trainerId: string, fileId: string | null): Promise<Result<{ photo: FileRef | null }>> {
  const admin = await requireAdmin();
  let file: FileRef | null = null;
  if (fileId) {
    const [owned] = await ownedUploads([String(fileId)], admin.sub);
    if (!owned || !isImageName(owned.name)) return { ok: false, error: "Upload a PNG or JPG picture." };
    file = owned;
  }
  const res = await setTrainerPhoto(String(trainerId), file);
  if (!res.ok) return { ok: false, error: "Trainer not found." };
  if (res.previous && res.previous.id !== file?.id) await deleteUploads([res.previous.id]);
  await logActivity(await adminActor(), `${file ? "set" : "removed"} the profile picture of ${trainerId}`, "trainer");
  revalidatePath("/superadmin/trainers");
  revalidatePath("/dashboard", "layout");
  return { ok: true, photo: file };
}
