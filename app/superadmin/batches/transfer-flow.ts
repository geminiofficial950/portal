import { moveStudentAction, previewTransferAction } from "./actions";

type Outcome = { ok: true; batchIds: string[] } | { ok: false; error?: string }; // no error = the admin cancelled

// Moves a student into another batch of a course (or out of their batch) with the guide's checks: preview of the
// destination, trainer coverage and schedule conflicts first, then the admin resolves each conflict explicitly.
// Used by the batch page and the Students table, so both behave the same.
export async function transferWithChecks(o: {
  studentId: string;
  studentName: string;
  courseCode: string;
  fromName: string | null;
  to: { batchId: string; name: string } | null;
}): Promise<Outcome> {
  const resolve: { openUnits?: string[]; addUnitsToPlan?: string[] } = {};
  let details = "";
  let p: Extract<Awaited<ReturnType<typeof previewTransferAction>>, { ok: true }> | null = null;
  if (o.to) {
    const res = await previewTransferAction(o.studentId, o.courseCode, o.to.batchId);
    if (!res.ok) return { ok: false, error: res.error };
    p = res;
    details = `\n\nTrainer coverage in ${p.to}:\n${p.coverage.map((c) => `• ${c.unit}: ${c.trainers.join(", ") || "NO TRAINER"}`).join("\n")}`;
    if (p.uncovered.length) details += `\n\nNo trainer yet for: ${p.uncovered.join(", ")}`;
    if (p.notInDestination.length) details += `\n\nConflict: ${o.studentName} has work or a status in units ${p.to} doesn’t take: ${p.notInDestination.join(", ")}.`;
    if (p.openThereNotForStudent.length) details += `\n\nConflict: already open in ${p.to} but not for ${o.studentName}: ${p.openThereNotForStudent.join(", ")}.`;
    if (p.openForStudentNotThere.length) details += `\n\nOpen for ${o.studentName} but not yet in ${p.to}: ${p.openForStudentNotThere.join(", ")} (kept as their own exception).`;
  }
  const msg = o.to
    ? o.fromName
      ? `Transfer ${o.studentName} from ${o.fromName} to ${o.to.name}?`
      : `Add ${o.studentName} to ${o.to.name}?`
    : `Take ${o.studentName} out of ${o.fromName ?? "their batch"}?`;
  const after = o.fromName ? ` Trainers of ${o.fromName} lose access straight away.` : "";
  if (!window.confirm(`${msg}${details}\n\nTheir submissions, results, feedback, deadlines and extensions stay with them.${after}`)) return { ok: false };
  // the admin resolves each conflict explicitly (nothing changes unless they say so)
  if (p?.notInDestination.length && window.confirm(`Add ${p.notInDestination.join(", ")} to ${p.to}’s units, so a trainer there can be assigned to them?\n\nOK = add to the plan · Cancel = keep as an exception`)) {
    resolve.addUnitsToPlan = p.notInDestination;
  }
  if (p?.openThereNotForStudent.length && window.confirm(`Open ${p.openThereNotForStudent.join(", ")} for ${o.studentName} too, like the rest of ${p.to}?\n\nOK = open them · Cancel = leave them closed for now`)) {
    resolve.openUnits = p.openThereNotForStudent;
  }
  const res = await moveStudentAction(o.studentId, o.courseCode, o.to?.batchId ?? null, resolve);
  return res.ok ? { ok: true, batchIds: res.batchIds } : { ok: false, error: res.error };
}
