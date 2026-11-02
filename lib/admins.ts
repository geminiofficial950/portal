import "server-only";
import { compare, hash } from "bcryptjs";
import type { ObjectId } from "mongodb";
import { nextSeq } from "./counters";
import { getDb } from "./db";
import { formatDate } from "./format";
import type { AdminDTO } from "./admin-meta";

// Admin accounts (see lib/admin-meta.ts). Super Admin itself lives in .env, not here.

type AdminDoc = {
  _id?: ObjectId;
  adminId: string;
  name: string;
  email: string;
  active: boolean;
  passwordHash: string;
  createdAt: Date;
};

const toDTO = ({ adminId, name, email, active, createdAt }: AdminDoc): AdminDTO => ({
  adminId,
  name,
  email,
  active,
  added: formatDate(createdAt),
});

let indexesReady: Promise<unknown> | undefined;

async function collection() {
  const col = (await getDb()).collection<AdminDoc>("admins");
  indexesReady ??= col.createIndexes([
    { key: { adminId: 1 }, unique: true },
    { key: { email: 1 }, unique: true },
  ]);
  await indexesReady;
  return col;
}

export async function listAdmins() {
  const col = await collection();
  return (await col.find().sort({ createdAt: 1 }).toArray()).map(toDTO);
}

export async function getAdmin(adminId: string) {
  const doc = await (await collection()).findOne({ adminId });
  return doc ? toDTO(doc) : null;
}

export async function countAdmins() {
  const col = await collection();
  const [total, active] = await Promise.all([col.countDocuments(), col.countDocuments({ active: true })]);
  return { total, active };
}

export class DuplicateAdminEmailError extends Error {}

export async function createAdmin(input: { name: string; email: string; password: string }) {
  const col = await collection();
  const doc: AdminDoc = {
    adminId: `A${String(await nextSeq("adminId")).padStart(3, "0")}`,
    name: input.name,
    email: input.email.toLowerCase(),
    active: true,
    passwordHash: await hash(input.password, 10),
    createdAt: new Date(),
  };
  try {
    await col.insertOne(doc);
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw new DuplicateAdminEmailError();
    throw err;
  }
  return toDTO(doc);
}

export async function setAdminActive(adminId: string, active: boolean) {
  const col = await collection();
  return col.findOneAndUpdate({ adminId }, { $set: { active } }, { returnDocument: "after" });
}

export async function resetAdminPassword(adminId: string, password: string) {
  const col = await collection();
  const res = await col.updateOne({ adminId }, { $set: { passwordHash: await hash(password, 10) } });
  return res.matchedCount === 1;
}

export async function deleteAdmin(adminId: string) {
  const col = await collection();
  return col.findOneAndDelete({ adminId });
}

// Login by admin ID (A001) or email. `null` = no admin with that identifier.
export async function verifyAdminLogin(identifier: string, password: string) {
  const col = await collection();
  const id = identifier.trim();
  const doc = await col.findOne(id.includes("@") ? { email: id.toLowerCase() } : { adminId: id.toUpperCase() });
  if (!doc) return null;
  if (!(await compare(password, doc.passwordHash))) return { ok: false as const, reason: "invalid" as const };
  if (!doc.active) return { ok: false as const, reason: "inactive" as const };
  return { ok: true as const, admin: toDTO(doc) };
}
