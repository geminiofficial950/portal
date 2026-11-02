// The declaration a student agrees to when submitting a Theory Task or Workplacement Task.
// Shared by the submit form, the declaration certificate and the Settings editor (Super Admin and Admins can change it).
import type { AssessmentPart } from "./assessment-meta";

export type DeclarationText = { intro: string; points: string[]; agree: string };

export const DEFAULT_DECLARATION: DeclarationText = {
  intro: "I declare that:",
  points: [
    "I am the student named on this assessment, and I completed and submitted it myself using my own login.",
    "All answers are my own work. I have not copied from another person, past student or source, and I have referenced anything I quoted.",
    "No one else completed, wrote or changed any part of this assessment for me. This includes family, friends, colleagues, tutors and paid services.",
    "I did not use generative AI tools (such as ChatGPT) to write my answers, unless my trainer allowed it in writing for this task.",
    "I followed the stated assessment conditions, such as open or closed book and any time limit.",
    "I have not shared this assessment or my answers with other students, and I will not do so.",
    "I consent to Stella College taking my photo when I submit this assessment so it can confirm my identity. I understand the photo is stored securely under the Privacy Policy and used only for identity verification and audit.",
    "I understand Stella College may check that this work is mine, for example with a short verbal or phone Q&A, plagiarism or AI detection tools, or by comparing my photo with my enrolment ID. I agree to take part if asked.",
    "I understand that if this work is found not to be my own, it may be marked Not Yet Competent and handled under the Academic Misconduct Policy, and a qualification issued on false evidence can be cancelled.",
    "I was told the assessment instructions, and my reasonable adjustment, reassessment and appeal options, before I started.",
    "I consent to Stella College keeping this assessment for the required retention period and sharing it with ASQA or auditors if required.",
  ],
  agree: "I agree and confirm this declaration",
};

// The first wording, before the declaration was saved with each submission — only for those older certificates
const FIRST_DECLARATION: DeclarationText = {
  intro: "By submitting this assessment, I declare that:",
  points: [
    "The work is my own and has not been copied or plagiarised.",
    "I have not received unauthorised assistance.",
    "I understand my assessment may be checked for authenticity and plagiarism.",
    "I consent to my photo being taken at the time of submission to confirm my identity.",
    "I hereby declare that no artificial intelligence tools were used in the completion of this assessment.",
  ],
  agree: "I agree and confirm this declaration",
};

export const DECLARATION_LIMITS = { points: 12, point: 300, intro: 200, agree: 120 } as const;

const tidy = (s: unknown) => String(s ?? "").trim().replace(/\s+/g, " ");

// Checks the text from the Settings editor; empty points are dropped
export function checkDeclaration(input: DeclarationText): DeclarationText | { error: string } {
  const intro = tidy(input?.intro);
  const agree = tidy(input?.agree);
  const points = (Array.isArray(input?.points) ? input.points : []).map(tidy).filter(Boolean);
  if (!intro) return { error: "Enter the opening line." };
  if (intro.length > DECLARATION_LIMITS.intro) return { error: `Keep the opening line under ${DECLARATION_LIMITS.intro} characters.` };
  if (!points.length) return { error: "Add at least one point." };
  if (points.length > DECLARATION_LIMITS.points) return { error: `Use at most ${DECLARATION_LIMITS.points} points.` };
  if (points.some((p) => p.length > DECLARATION_LIMITS.point)) return { error: `Keep each point under ${DECLARATION_LIMITS.point} characters.` };
  if (!agree) return { error: "Enter the tick-box line." };
  if (agree.length > DECLARATION_LIMITS.agree) return { error: `Keep the tick-box line under ${DECLARATION_LIMITS.agree} characters.` };
  return { intro, points, agree };
}

// What a certificate shows: the text the student agreed to (saved at submit), or the first wording for older ones
export function agreedDeclaration(saved: Partial<DeclarationText> | undefined): DeclarationText {
  return saved?.intro && saved.points?.length && saved.agree
    ? { intro: saved.intro, points: saved.points, agree: saved.agree }
    : FIRST_DECLARATION;
}

// Certificate heading per part
export const declarationTitle = (part: AssessmentPart) =>
  part === "workplace" ? "Workplacement Declaration" : part === "theory" ? "Theory Declaration" : "Assessment Declaration";

// Short reference printed on the certificate (first part of the submission id)
export const declarationRef = (submissionId: string) => submissionId.replace(/-/g, "").slice(0, 8).toUpperCase();
