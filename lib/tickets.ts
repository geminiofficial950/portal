import "server-only";
import type { ObjectId } from "mongodb";
import { nextSeq } from "./counters";
import { getDb } from "./db";
import { formatDate, formatDateTime } from "./format";
import type { TicketDTO, TicketPriority, TicketStatus } from "./ticket-meta";

type MessageDoc = { from: "student" | "college"; name: string; text: string; at: Date };

type TicketDoc = {
  _id?: ObjectId;
  ticketId: string;
  studentId: string;
  studentName: string;
  topic: string;
  subject: string;
  priority: TicketPriority;
  status: TicketStatus;
  assignee: string;
  assigneeId: string | null;
  messages: MessageDoc[];
  createdAt: Date;
  updatedAt: Date;
};

const toDTO = (t: TicketDoc): TicketDTO => ({
  ticketId: t.ticketId,
  studentId: t.studentId,
  studentName: t.studentName,
  topic: t.topic,
  subject: t.subject,
  priority: t.priority,
  status: t.status,
  assignee: t.assignee,
  assigneeId: t.assigneeId ?? null,
  created: formatDate(t.createdAt),
  messages: t.messages.map((m) => ({ from: m.from, name: m.name, text: m.text, time: formatDateTime(m.at) })),
});

let indexesReady: Promise<unknown> | undefined;

async function collection() {
  const col = (await getDb()).collection<TicketDoc>("tickets");
  indexesReady ??= col.createIndexes([
    { key: { ticketId: 1 }, unique: true },
    { key: { studentId: 1, updatedAt: -1 } },
    { key: { assigneeId: 1, updatedAt: -1 } },
  ]);
  await indexesReady;
  return col;
}

export async function listTickets(filter: { studentId?: string; assigneeId?: string } = {}) {
  const col = await collection();
  return (await col.find(filter).sort({ updatedAt: -1 }).toArray()).map(toDTO);
}

export async function countOpenTickets() {
  const col = await collection();
  const [open, unassigned] = await Promise.all([
    col.countDocuments({ status: { $ne: "Resolved" } }),
    col.countDocuments({ status: { $ne: "Resolved" }, assignee: "Unassigned" }),
  ]);
  return { open, unassigned };
}

export async function listOpenTickets(limit = 4) {
  const col = await collection();
  const docs = await col.find({ status: { $ne: "Resolved" } }).toArray();
  const rank = { High: 0, Medium: 1, Low: 2 };
  return docs
    .sort((a, b) => rank[a.priority] - rank[b.priority] || b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, limit)
    .map(toDTO);
}

export async function createTicket(input: {
  studentId: string;
  studentName: string;
  topic: string;
  subject: string;
  text: string;
}) {
  const col = await collection();
  const now = new Date();
  const doc: TicketDoc = {
    ticketId: `TK-${1000 + (await nextSeq("ticketId"))}`,
    studentId: input.studentId,
    studentName: input.studentName,
    topic: input.topic,
    subject: input.subject,
    priority: "Medium",
    status: "Open",
    assignee: "Unassigned",
    assigneeId: null,
    messages: [{ from: "student", name: input.studentName, text: input.text, at: now }],
    createdAt: now,
    updatedAt: now,
  };
  await col.insertOne(doc);
  return toDTO(doc);
}

// studentId / assigneeId given → only that student's or trainer's own ticket can be replied to
// (students additionally only while it's still open)
export async function addTicketMessage(
  ticketId: string,
  message: Omit<MessageDoc, "at">,
  opts: { studentId?: string; assigneeId?: string } = {},
) {
  const col = await collection();
  const now = new Date();
  const filter = opts.studentId
    ? { ticketId, studentId: opts.studentId, status: { $ne: "Resolved" as const } }
    : opts.assigneeId
      ? { ticketId, assigneeId: opts.assigneeId }
      : { ticketId };
  const doc = await col.findOneAndUpdate(
    filter,
    { $push: { messages: { ...message, at: now } }, $set: { updatedAt: now } },
    { returnDocument: "after" },
  );
  return doc ? toDTO(doc) : null;
}

// Put a removed trainer's unfinished tickets back in the queue
export async function unassignTrainerTickets(trainerId: string) {
  const col = await collection();
  await col.updateMany(
    { assigneeId: trainerId, status: { $ne: "Resolved" } },
    { $set: { assignee: "Unassigned", assigneeId: null, status: "Open", updatedAt: new Date() } },
  );
}

// assigneeId given → a trainer may only change tickets assigned to them
export async function updateTicket(
  ticketId: string,
  patch: Partial<Pick<TicketDoc, "status" | "priority" | "assignee" | "assigneeId">>,
  opts: { assigneeId?: string } = {},
) {
  const col = await collection();
  const doc = await col.findOneAndUpdate(
    opts.assigneeId ? { ticketId, assigneeId: opts.assigneeId } : { ticketId },
    { $set: { ...patch, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  return doc ? toDTO(doc) : null;
}
