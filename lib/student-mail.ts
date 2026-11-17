import "server-only";
import { appendFile } from "node:fs/promises";
import { getSettings } from "./settings";
import { getStudent } from "./students";

// "You have 1 new update" emails to students — nothing else is in them, just a Login button.
// Sent when a student is enrolled in a course or a unit is opened for them ("course"), and when a trainer publishes
// feedback ("feedback"). Each kind has its own switch in Super Admin → Settings.
//
// Settings (.env, never in code):
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS — the mail account (SMTP_USER is also the sender)
//   PORTAL_URL      — where the Login button goes (default https://lms.eduskills.com.au)
//   MAIL_ONLY_TO    — optional safety for testing: only this address is ever emailed; everyone else is skipped
//   MAIL_CAPTURE_FILE — tests: also write each email to this file (it is still sent when SMTP is set)
// Without SMTP settings nothing is sent. A mail problem never stops the action that triggered it.

export type StudentMailKind = "course" | "feedback";

const SWITCH: Record<StudentMailKind, "mailCourseUpdates" | "mailFeedback"> = { course: "mailCourseUpdates", feedback: "mailFeedback" };

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** The email itself: one line and a Login button */
export function updateEmail(college: string, loginUrl: string) {
  const subject = `You have 1 new update on ${college}`;
  const text = `You have 1 new update on the platform.\n\nLog in to see it: ${loginUrl}\n\n${college}`;
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f4f2fa;font-family:Arial,Helvetica,sans-serif;color:#1f1b2e">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2fa;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px 28px">
<tr><td style="font-size:14px;font-weight:bold;color:#5b3f99;letter-spacing:.5px">${escape(college)}</td></tr>
<tr><td style="padding-top:18px;font-size:22px;font-weight:bold;line-height:1.35;color:#1f1b2e">You have 1 new update on the platform</td></tr>
<tr><td style="padding-top:10px;font-size:16px;line-height:1.5;color:#1f1b2e">Log in to see it.</td></tr>
<tr><td style="padding-top:24px"><a href="${escape(loginUrl)}" style="display:inline-block;background:#5b3f99;color:#ffffff;text-decoration:none;font-size:16px;font-weight:bold;padding:13px 28px;border-radius:12px">Log in</a></td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}

type Mail = { to: string; subject: string; text: string; html: string };

async function deliver(mail: Mail) {
  const capture = process.env.MAIL_CAPTURE_FILE;
  if (capture) await appendFile(capture, JSON.stringify({ ...mail, at: new Date().toISOString() }) + "\n");
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return; // email isn't set up here
  const nodemailer = await import("nodemailer");
  const port = Number(SMTP_PORT || 587);
  const transport = nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } });
  await transport.sendMail({ from: SMTP_USER, ...mail });
}

/** Sends one address the update email now (Super Admin's test button, and the students' emails) */
export async function sendUpdateEmail(to: string) {
  const { college } = await getSettings();
  const only = process.env.MAIL_ONLY_TO?.trim().toLowerCase();
  if (only && to.trim().toLowerCase() !== only) return { sent: false as const, reason: "skipped (MAIL_ONLY_TO)" };
  const loginUrl = process.env.PORTAL_URL || "https://lms.eduskills.com.au";
  await deliver({ to, ...updateEmail(college.name || "Stella College", loginUrl) });
  return { sent: true as const };
}

/**
 * Emails these students "You have 1 new update" if that kind's switch is on. Never throws: the enrolment, unit
 * opening or feedback has already been saved, and a mail problem is only logged.
 */
export async function mailStudents(studentIds: string[], kind: StudentMailKind) {
  try {
    const settings = await getSettings();
    if (!settings.switches[SWITCH[kind]]) return;
    for (const id of [...new Set(studentIds)]) {
      const s = await getStudent(id);
      if (!s?.email || s.status !== "Active") continue;
      try {
        await sendUpdateEmail(s.email);
      } catch (err) {
        console.error(`[student-mail] couldn't email ${id}:`, err instanceof Error ? err.message : err);
      }
    }
  } catch (err) {
    console.error("[student-mail]", err instanceof Error ? err.message : err);
  }
}
