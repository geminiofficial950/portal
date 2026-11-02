// Placement documents and documents requested from a student. Shared by server code and client components.
import type { FileRef } from "./submission-meta";

// A form Super Admin uploads for a course (e.g. placement agreement); students sign it and upload it back
export type PlacementDocDTO = { docId: string; courseCode: string; title: string; file: FileRef; createdAt: string };

// A student's signed copy of a placement document
export type SignedDocDTO = { docId: string; studentId: string; file: FileRef; uploadedAt: string };

// A document Super Admin asked one student for (e.g. "Police check")
export type DocumentRequestDTO = {
  requestId: string;
  studentId: string;
  name: string;
  note: string;
  file: FileRef | null;
  uploadedAt: string | null;
  createdAt: string;
};

// The placement documents every course uses, in the order students see them.
// Super Admin picks one of these (or "Other" with its own name) when uploading.
export const PLACEMENT_DOC_TYPES = [
  "Workplace Agreement",
  "Log Timesheet",
  "Pre-Placement Checklist",
  "Understanding Workplacement Booklet",
] as const;

// Standard types first (in list order), then any others by when they were added
export const placementOrder = (title: string) => {
  const i = PLACEMENT_DOC_TYPES.indexOf(title as (typeof PLACEMENT_DOC_TYPES)[number]);
  return i < 0 ? PLACEMENT_DOC_TYPES.length : i;
};
export const sortPlacementDocs = <T extends { title: string; createdAt: string }>(docs: T[]) =>
  [...docs].sort((a, b) => placementOrder(a.title) - placementOrder(b.title) || a.createdAt.localeCompare(b.createdAt));

export const DOC_TITLE_MAX = 80;
export const DOC_NOTE_MAX = 300;
export const PLACEMENT_TEXT_MAX = 4000;

export const cleanLine = (raw: unknown, max: number) => String(raw ?? "").trim().replace(/\s+/g, " ").slice(0, max);
