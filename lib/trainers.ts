import "server-only";
import { compare, hash } from "bcryptjs";
import type { ObjectId } from "mongodb";
import { nextSeq } from "./counters";
import { getDb } from "./db";
import { formatDate } from "./format";
import type { TrainerDTO } from "./trainer-meta";

type TrainerDoc = {
  _id?: ObjectId;
  trainerId: string;
  name: string;
  email: string;
  active: boolean;
  passwordHash: string;
  createdAt: Date;
};

const toDTO = ({ trainerId, name, email, active, createdAt }: TrainerDoc): TrainerDTO => ({
  trainerId,
  name,
  email,
  active,
  added: formatDate(createdAt),
});

let indexesReady: Promise<unknown> | undefined;

async function collection() {
  const col = (await getDb()).collection<TrainerDoc>("trainers");
  indexesReady ??= col.createIndexes([
    { key: { trainerId: 1 }, unique: true },
    { key: { email: 1 }, unique: true },
  ]);
  await indexesReady;
  return col;
}

export async function listTrainers() {
  const col = await collection();
  return (await col.find().sort({ createdAt: 1 }).toArray()).map(toDTO);
}

export async function getTrainer(trainerId: string) {
  const doc = await (await collection()).findOne({ trainerId });
  return doc ? toDTO(doc) : null;
}

export async function countTrainers() {
  const col = await collection();
  const [total, active] = await Promise.all([col.countDocuments(), col.countDocuments({ active: true })]);
  return { total, active };
}

export class DuplicateTrainerEmailError extends Error {}

export async function createTrainer(input: { name: string; email: string; password: string }) {
  const col = await collection();
  const doc: TrainerDoc = {
    trainerId: `T${String(await nextSeq("trainerId")).padStart(3, "0")}`,
    name: input.name,
    email: input.email.toLowerCase(),
    active: true,
    passwordHash: await hash(input.password, 10),
    createdAt: new Date(),
  };
  try {
    await col.insertOne(doc);
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw new DuplicateTrainerEmailError();
    throw err;
  }
  return toDTO(doc);
}

export async function setTrainerActive(trainerId: string, active: boolean) {
  const col = await collection();
  return col.findOneAndUpdate({ trainerId }, { $set: { active } }, { returnDocument: "after" });
}

export async function resetTrainerPassword(trainerId: string, password: string) {
  const col = await collection();
  const res = await col.updateOne({ trainerId }, { $set: { passwordHash: await hash(password, 10) } });
  return res.matchedCount === 1;
}

export async function deleteTrainer(trainerId: string) {
  const col = await collection();
  return col.findOneAndDelete({ trainerId });
}

// Login by trainer ID (T001) or email. `null` = no trainer with that identifier.
export async function verifyTrainerLogin(identifier: string, password: string) {
  const col = await collection();
  const id = identifier.trim();
  const doc = await col.findOne(id.includes("@") ? { email: id.toLowerCase() } : { trainerId: id.toUpperCase() });
  if (!doc) return null;
  if (!(await compare(password, doc.passwordHash))) return { ok: false as const, reason: "invalid" as const };
  if (!doc.active) return { ok: false as const, reason: "inactive" as const };
  return { ok: true as const, trainer: toDTO(doc) };
}
