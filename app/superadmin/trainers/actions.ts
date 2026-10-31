"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { requireAdmin } from "@/lib/auth";
import { unassignTrainerTickets } from "@/lib/tickets";
import type { TrainerDTO } from "@/lib/trainer-meta";
import {
  createTrainer,
  deleteTrainer,
  DuplicateTrainerEmailError,
  resetTrainerPassword,
  setTrainerActive,
} from "@/lib/trainers";

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
    await logActivity("Super Admin", `added trainer ${trainer.name} (${trainer.trainerId})`, "trainer");
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
  await logActivity("Super Admin", `${active ? "turned on" : "switched off"} access for ${doc.name}`, "trainer");
  revalidatePath("/superadmin", "layout");
  return { ok: true };
}

export async function resetTrainerPasswordAction(trainerId: string, password: string): Promise<Result> {
  await requireAdmin();
  if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
  const found = await resetTrainerPassword(trainerId, password);
  if (!found) return { ok: false, error: "Trainer not found." };
  await logActivity("Super Admin", `reset the password for ${trainerId}`, "trainer");
  return { ok: true };
}

export async function deleteTrainerAction(trainerId: string): Promise<Result> {
  await requireAdmin();
  const doc = await deleteTrainer(trainerId);
  if (!doc) return { ok: false, error: "Trainer not found." };
  await unassignTrainerTickets(trainerId);
  await logActivity("Super Admin", `removed trainer ${doc.name}`, "trainer");
  revalidatePath("/superadmin", "layout");
  return { ok: true };
}
