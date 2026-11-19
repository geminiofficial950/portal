import "server-only";
import { appendFile } from "node:fs/promises";
import { after } from "next/server";
import type { Transporter } from "nodemailer";
import { listAdmins } from "./admins";
import { listBatches } from "./groups";
import { getSettings } from "./settings";
import { getStudent } from "./students";
import { listTrainers } from "./trainers";

// "You have 1 new update" emails — nothing else is in them, just a Login button.
// Sent when a student is enrolled in a course or a unit is opened for them ("course"), and when feedback is published
// ("feedback"). The student gets one; Admin accounts and the trainers of that student's batch (for that unit) get the
// same short email, counted ("You have 2 new updates") when one action touches several students.
// Four switches in Super Admin → Settings: students / staff × course / feedback.
//
// Settings (.env, never in code):
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS — the mail account (SMTP_USER is also the sender)
//   PORTAL_URL      — where the Login button goes (default https://lms.eduskills.com.au)
//   MAIL_ONLY_TO    — optional safety for testing: only this mailbox is ever emailed (its +tag variants too); everyone else is skipped
//   MAIL_CAPTURE_FILE — tests: also write each email to this file (it is still sent when SMTP is set)
// Without SMTP settings nothing is sent. A mail problem never stops the action that triggered it.

export type StudentMailKind = "course" | "feedback";

const STUDENT_SWITCH = { course: "mailCourseUpdates", feedback: "mailFeedback" } as const;
const STAFF_SWITCH = { course: "mailStaffCourseUpdates", feedback: "mailStaffFeedback" } as const;

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** The email itself: one line ("You have N new update(s)") and a Login button */
export function updateEmail(college: string, loginUrl: string, count = 1) {
  const what = `${count} new update${count === 1 ? "" : "s"}`;
  const subject = `You have ${what} on ${college}`;
  const text = `You have ${what} on the platform.\n\nLog in to see it: ${loginUrl}\n\n${college}`;
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f4f2fa;font-family:Arial,Helvetica,sans-serif;color:#1f1b2e">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2fa;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px 28px">
<tr><td style="font-size:14px;font-weight:bold;color:#5b3f99;letter-spacing:.5px">${escape(college)}</td></tr>
<tr><td style="padding-top:18px;font-size:22px;font-weight:bold;line-height:1.35;color:#1f1b2e">You have ${what} on the platform</td></tr>
<tr><td style="padding-top:10px;font-size:16px;line-height:1.5;color:#1f1b2e">Log in to see ${count === 1 ? "it" : "them"}.</td></tr>
<tr><td style="padding-top:24px"><a href="${escape(loginUrl)}" style="display:inline-block;background:#5b3f99;color:#ffffff;text-decoration:none;font-size:16px;font-weight:bold;padding:13px 28px;border-radius:12px">Log in</a></td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}

type Mail = { to: string; subject: string; text: string; html: string };

async function deliver(mail: Mail) {
  const capture = process.env.MAIL_CAPTURE_FILE;
  if (capture) await appendFile(capture, JSON.stringify({ ...mail, at: new Date().toISOString() }) + "\n");
  const t = await smtp();
  if (t) await t.sendMail({ from: process.env.SMTP_USER, ...mail });
}

// one pooled SMTP connection for the whole server, made on first use
let transport: Transporter | null = null;
async function smtp() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null; // email isn't set up here
  if (!transport) {
    const nodemailer = await import("nodemailer");
    const port = Number(SMTP_PORT || 587);
    transport = nodemailer.createTransport({ pool: true, maxConnections: 2, host: SMTP_HOST, port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } });
  }
  return transport;
}

// "name+tag@host" and "name@host" are the same mailbox
const mailbox = (email: string) => email.trim().toLowerCase().replace(/\+[^@]*@/, "@");

/** Sends one address the update email now */
export async function sendUpdateEmail(to: string, count = 1) {
  const { college } = await getSettings();
  const only = process.env.MAIL_ONLY_TO?.trim().toLowerCase();
  if (only && mailbox(to) !== mailbox(only)) return { sent: false as const, reason: "skipped (MAIL_ONLY_TO)" };
  const loginUrl = process.env.PORTAL_URL || "https://lms.eduskills.com.au";
  await deliver({ to, ...updateEmail(college.name || "Stella College", loginUrl, count) });
  return { sent: true as const };
}

async function safeSend(to: string, count: number, who: string) {
  try {
    const res = await sendUpdateEmail(to, count);
    if (!res.sent) console.info(`[student-mail] not emailing ${who}: ${res.reason}`); // e.g. MAIL_ONLY_TO, no SMTP
  } catch (err) {
    console.error(`[student-mail] couldn't email ${who}:`, err instanceof Error ? err.message : err);
  }
}

/**
 * After an enrolment, a unit opening or published feedback: emails the students (one each) and, counted per person,
 * the active Admin accounts and the active trainers of those students' batches in that course (only those assigned to
 * one of `unitCodes`, when given). `exceptTrainerId`: the trainer who did it isn't emailed about their own action.
 * Each side has its own switch. The emails go out AFTER the action has answered (saving never waits on email), and a
 * mail problem is only logged.
 */
export async function mailUpdates(input: MailInput) {
  try {
    after(() => sendUpdates(input));
  } catch {
    // not inside a request (a script or a test): send in the background without waiting — never fail the action
    void sendUpdates(input);
  }
}

// `skipStudents`: email only the staff (e.g. a new student isn't sent a welcome email)
type MailInput = { studentIds: string[]; kind: StudentMailKind; courseCodes: string[]; unitCodes?: string[]; exceptTrainerId?: string; skipStudents?: boolean };

async function sendUpdates(input: MailInput) {
  try {
    const { switches } = await getSettings();
    const ids = [...new Set(input.studentIds)];
    const students = (await Promise.all(ids.map((id) => getStudent(id)))).filter((s) => s && s.status === "Active");
    if (!students.length) return;

    if (switches[STUDENT_SWITCH[input.kind]] && !input.skipStudents) {
      for (const s of students) if (s!.email) await safeSend(s!.email, 1, s!.studentId);
    }

    if (switches[STAFF_SWITCH[input.kind]]) {
      const counts = new Map<string, number>(); // email → how many of these students concern them
      const add = (email: string | undefined, n: number) => {
        const e = email?.trim();
        if (e) counts.set(e.toLowerCase(), (counts.get(e.toLowerCase()) ?? 0) + n);
      };
      const [admins, trainers, batches] = await Promise.all([listAdmins(), listTrainers(), listBatches()]);
      for (const a of admins) if (a.active) add(a.email, students.length);
      const activeTrainer = new Map(trainers.filter((t) => t.active).map((t) => [t.trainerId, t.email]));
      for (const s of students) {
        const mine = new Set<string>();
        for (const b of batches) {
          if (!s!.batchIds.includes(b.batchId) || !b.courseCode || !input.courseCodes.includes(b.courseCode)) continue;
          for (const t of b.trainers) {
            if (input.unitCodes?.length && !t.unitCodes.some((u) => input.unitCodes!.includes(u))) continue;
            if (t.trainerId !== input.exceptTrainerId && activeTrainer.has(t.trainerId)) mine.add(t.trainerId);
          }
        }
        for (const id of mine) add(activeTrainer.get(id), 1);
      }
      for (const [email, n] of counts) await safeSend(email, n, email);
    }
  } catch (err) {
    console.error("[student-mail]", err instanceof Error ? err.message : err);
  }
}

