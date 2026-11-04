"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { requireStaff } from "@/lib/auth";
import { getCourse } from "@/lib/courses";
import { createMeetEvent, deleteMeetEvent, GoogleMeetError, googleMeetReady, updateMeetEvent } from "@/lib/google-meet";
import { addMeeting, getMeeting, meetingEventId, removeMeeting, updateMeeting } from "@/lib/meetings";
import { checkMeeting, type MeetingDTO, type MeetingInput } from "@/lib/meetings-meta";
import { getStudent, hasCourse } from "@/lib/students";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const refresh = () => {
  revalidatePath("/dashboard/classroom");
  revalidatePath("/superadmin/classroom");
  revalidatePath("/trainer/classroom");
};

const NOT_CONNECTED = "Google Meet isn’t connected yet, so the link can’t be made automatically — paste a Meet link for now.";

// Google problems come back as a message for the form; anything else is a real error
async function google<T>(run: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await run() };
  } catch (err) {
    if (err instanceof GoogleMeetError) return { ok: false, error: err.message };
    throw err;
  }
}

// Checks the whole form: course, who it's for, and the meeting itself
async function readInput(input: MeetingInput) {
  const course = await getCourse(String(input?.courseCode ?? ""));
  if (!course) return { ok: false as const, error: "Choose a course." };
  let student: { studentId: string; name: string } | null = null;
  if (input.studentId) {
    const s = await getStudent(String(input.studentId));
    if (!s || s.status !== "Active" || !hasCourse(s, course.code)) return { ok: false as const, error: "That student isn’t in this course." };
    student = { studentId: s.studentId, name: s.name };
  }
  const checked = checkMeeting(input, Date.now());
  if (!checked.ok) return checked;
  return {
    ok: true as const,
    pastedUrl: checked.url,
    fields: {
      courseCode: course.code,
      studentId: student?.studentId ?? null,
      studentName: student?.name ?? null,
      title: checked.title,
      notes: checked.notes,
      startsAt: checked.startsAt,
      minutes: checked.minutes,
    },
  };
}

const forWhom = (m: MeetingDTO) => (m.studentName ? `${m.studentName} (${m.courseCode})` : m.courseCode);

export async function scheduleMeetingAction(input: MeetingInput): Promise<Result<{ meeting: MeetingDTO }>> {
  const staff = await requireStaff();
  const read = await readInput(input);
  if (!read.ok) return read;

  // Google makes the Meet link unless one was pasted
  let link: { url: string; eventId: string | null };
  if (read.pastedUrl) link = { url: read.pastedUrl, eventId: null };
  else if (!googleMeetReady()) return { ok: false, error: NOT_CONNECTED };
  else {
    const made = await google(() => createMeetEvent(read.fields));
    if (!made.ok) return made;
    link = made.value;
  }

  const meeting = await addMeeting({ ...read.fields, ...link, createdBy: staff.name });
  await logActivity(staff.name, `scheduled the meeting “${meeting.title}” for ${forWhom(meeting)}`, "course");
  refresh();
  return { ok: true, meeting };
}

export async function updateMeetingAction(id: string, input: MeetingInput): Promise<Result<{ meeting: MeetingDTO }>> {
  const staff = await requireStaff();
  const before = await getMeeting(id);
  if (!before) return { ok: false, error: "That meeting was cancelled." };
  const read = await readInput(input);
  if (!read.ok) return read;

  const eventId = await meetingEventId(id);
  let link: { url: string; eventId: string | null };
  if (eventId && (!read.pastedUrl || read.pastedUrl === before.url)) {
    // Google's meeting: move it in the calendar too; the link stays the same
    const moved = await google(() => updateMeetEvent(eventId, read.fields));
    if (!moved.ok) return moved;
    link = { url: before.url, eventId };
  } else if (read.pastedUrl) {
    // a different link was pasted: the Google event isn't needed any more
    if (eventId) await google(() => deleteMeetEvent(eventId));
    link = { url: read.pastedUrl, eventId: null };
  } else if (!googleMeetReady()) {
    return { ok: false, error: NOT_CONNECTED };
  } else {
    const made = await google(() => createMeetEvent(read.fields));
    if (!made.ok) return made;
    link = made.value;
  }

  const meeting = await updateMeeting(id, { ...read.fields, ...link, createdBy: staff.name });
  if (!meeting) return { ok: false, error: "That meeting was cancelled." };
  await logActivity(staff.name, `changed the meeting “${meeting.title}” for ${forWhom(meeting)}`, "course");
  refresh();
  return { ok: true, meeting };
}

export async function cancelMeetingAction(id: string): Promise<Result> {
  const staff = await requireStaff();
  const eventId = await meetingEventId(id);
  if (eventId) {
    const gone = await google(() => deleteMeetEvent(eventId));
    if (!gone.ok) return gone;
  }
  const meeting = await removeMeeting(id);
  if (!meeting) return { ok: false, error: "That meeting was already cancelled." };
  await logActivity(staff.name, `cancelled the meeting “${meeting.title}” for ${forWhom(meeting)}`, "course");
  refresh();
  return { ok: true };
}
