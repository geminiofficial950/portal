import ExcelJS from "exceljs";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireAdmin: async () => ({ label: "Admin", name: "Admin", isSuper: true }),
  requireSuperAdmin: async () => ({ label: "Admin", name: "Admin", isSuper: true }),
  adminActor: async () => "Admin",
  DELETE_SUPER_ADMIN_ONLY: "x",
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { getDb } = await import("@/lib/db");
const { buildTemplate, readUpload } = await import("@/lib/student-import");
const { importStudentsAction } = await import("@/app/superadmin/students/actions");
const { getStudent, verifyStudentLogin } = await import("@/lib/students");

describe("bulk student upload", () => {
  it("fills the Excel template, reads it back, and creates the ready students with their batch and extra details", async () => {
    const db = await getDb();
    await db.collection("courses").insertMany([
      { code: "C1", name: "Course one", units: [{ code: "U1", title: "Unit" }], createdAt: new Date() },
      { code: "C2", name: "Course two", units: [{ code: "U2", title: "Unit" }], createdAt: new Date() },
    ]);
    await db.collection("studentGroups").insertOne({ groupId: "B1", name: "Jan C1", nameKey: "jan c1", code: "JAN-C1", courseCode: "C1", units: ["U1"], trainers: [], createdAt: new Date() });
    await db.collection("students").insertOne({ studentId: "S1001", name: "Old", email: "old@x.au", courses: ["C1"], course: "C1", status: "Active", progress: 0, batchIds: [], passwordHash: "x", createdAt: new Date() });

    // the template has the headings (required ones marked *) and a Help sheet with the course codes
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await buildTemplate("xlsx")) as unknown as ArrayBuffer);
    const sheet = wb.getWorksheet("Students")!;
    expect(sheet.getRow(1).values).toEqual([undefined, "Student ID", "First name *", "Last name *", "Email *", "Phone number *", "State", "Notes", "Course code *", "Start date *", "End date *", "Password", "Batch"]);
    expect(JSON.stringify(wb.getWorksheet("Help")!.getSheetValues())).toContain("C2");

    // admin fills it in and adds a "Guardian" column of their own
    sheet.getCell("M1").value = "Guardian";
    sheet.getCell("N1").value = "Blood group";
    sheet.addRow(["", "Ann", "Lee", "ann@x.au", "0400 111 222", "VIC", "evening classes", "C1", "01/02/2027", "20/12/2027", "", "JAN-C1", "Mum", "O+"]);
    sheet.addRow(["BO-1", "Bo", "Ray", "bo@x.au", "0400 333 444", "", "", "C2", new Date(Date.UTC(2027, 2, 1)), "2027-11-30", "MyPass123", "", ""]);
    sheet.addRow(["", "Cy", "Fox", "old@x.au", "0400 555 666", "", "", "C1", "01/02/2027", "01/03/2027", "", "", ""]); // email taken
    const filled = Buffer.from(await wb.xlsx.writeBuffer());

    const preview = await readUpload("students.xlsx", filled);
    if ("error" in preview) throw new Error(preview.error);
    expect(preview.extra).toEqual(["Guardian", "Blood group"]);
    expect(preview.rows.map((r) => [r.row, r.errors])).toEqual([
      [2, []],
      [3, []],
      [4, ["old@x.au is already a student"]],
    ]);

    // the page sends only the ready rows; Guardian imported, Blood group skipped
    const res = await importStudentsAction(preview.rows.filter((r) => !r.errors.length), ["Guardian"]);
    if (!res.ok) throw new Error(res.error);
    expect(res.created.map((c) => [c.row, c.email, c.studentId])).toEqual([
      [2, "ann@x.au", expect.stringMatching(/^S\d+$/)],
      [3, "bo@x.au", "BO-1"],
    ]);
    expect(res.created[0].password).toHaveLength(10); // made up
    expect(res.created[1].password).toBe("MyPass123");

    const ann = (await getStudent(res.created[0].studentId))!;
    expect(ann).toMatchObject({ name: "Ann Lee", firstName: "Ann", lastName: "Lee", phone: "0400 111 222", state: "VIC", notes: "evening classes", startDate: "2027-02-01", endDate: "2027-12-20", batchIds: ["B1"] });
    expect(ann.extra).toEqual({ Guardian: "Mum" });
    expect(await getStudent("BO-1")).toMatchObject({ startDate: "2027-03-01", endDate: "2027-11-30", extra: {} });
    expect(await verifyStudentLogin("bo@x.au", "MyPass123")).toBeTruthy();

    // running it again adds nobody (all taken now)
    const again = await importStudentsAction(preview.rows.filter((r) => !r.errors.length), ["Guardian"]);
    expect(again.ok && again.created.length).toBe(0);
  });

  it("refuses a file without the required headings, or with nobody in it", async () => {
    const csv = (s: string) => Buffer.from(s, "utf8");
    expect(await readUpload("a.csv", csv("Name,Email\nA,a@x.au\n"))).toEqual({ error: "These columns are missing: Phone number, Course code, Start date, End date. Download the template and use its headings." });
    expect(await readUpload("a.csv", csv("First name,Last name,Email,Phone number,Course code,Start date,End date\n"))).toEqual({ error: "The file has no students in it." });
    expect(await readUpload("a.pdf", csv("x"))).toEqual({ error: "Upload an Excel (.xlsx) or CSV (.csv) file." });
  });
});
