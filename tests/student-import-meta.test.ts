import { describe, expect, it } from "vitest";
import { checkRows, IMPORT_COLUMNS, mapHeaders, parseCsv, parseDay, readRows, toCsv } from "@/lib/student-import-meta";
import { checkProfile, cleanState, splitName } from "@/lib/student-profile-meta";

describe("student profile details", () => {
  it("needs first name, last name and a phone; state is an Australian state or blank", () => {
    expect(checkProfile({ firstName: " Priya ", lastName: "Sharma", phone: "+61 400 123 456", state: "victoria", notes: " hi " })).toEqual({
      ok: true,
      value: { firstName: "Priya", lastName: "Sharma", phone: "+61 400 123 456", state: "VIC", notes: "hi" },
    });
    expect(checkProfile({ firstName: "P", lastName: "", phone: "0400" })).toEqual({ ok: false, error: "Last name is required." });
    expect(checkProfile({ firstName: "P", lastName: "S", phone: "" })).toEqual({ ok: false, error: "Phone number is required." });
    expect(checkProfile({ firstName: "P", lastName: "S", phone: "call me" }).ok).toBe(false);
    expect(checkProfile({ firstName: "P", lastName: "S", phone: "0400 111 222", state: "Goa" }).ok).toBe(false);
    expect(cleanState("")).toBe("");
    expect(splitName("Ann  Marie Lee")).toEqual({ firstName: "Ann", lastName: "Marie Lee" });
  });
});

describe("bulk student upload — reading the sheet", () => {
  it("the template lists the profile columns first", () => {
    expect(IMPORT_COLUMNS.map((c) => c.label + (c.required ? " *" : ""))).toEqual([
      "Student ID", "First name *", "Last name *", "Email *", "Phone number *", "State", "Notes", "Course code *", "Start date *", "End date *", "Password", "Batch",
    ]);
  });

  it("maps template headers (with * and other spellings) and lists extra columns", () => {
    const m = mapHeaders(["Student ID", "First name *", "Last name *", "Email *", "Phone number *", "State", "Notes", "Course code *", "Start date *", "End date *", "Password", "Batch", "Guardian"]);
    expect(m.missing).toEqual([]);
    expect(m.known).toMatchObject({ studentId: 0, firstName: 1, lastName: 2, email: 3, phone: 4, state: 5, notes: 6, courses: 7, startDate: 8, endDate: 9, password: 10, batch: 11 });
    expect(m.extra.map((x) => x.label)).toEqual(["Guardian"]);
    expect(mapHeaders(["Name", "Email", "Mobile"]).missing).toEqual(["Course code", "Start date", "End date"]); // Full name stands in for First / Last
    expect(mapHeaders(["Email"]).missing).toEqual(["First name", "Last name", "Phone number", "Course code", "Start date", "End date"]);
  });

  it("reads Australian, ISO and Excel dates", () => {
    expect(parseDay("03/02/2027")).toBe("2027-02-03");
    expect(parseDay("2027-2-3")).toBe("2027-02-03");
    expect(parseDay(46421)).toBe("2027-02-03"); // Excel day number
    expect(parseDay(new Date(Date.UTC(2027, 1, 3)))).toBe("2027-02-03");
    expect(parseDay("31/02/2027")).toBeNull();
    expect(parseDay("soon")).toBeNull();
  });

  it("parses CSV with quotes, commas and new lines, and writes it back", () => {
    const rows = parseCsv('﻿Full name,Email\r\n"Lee, Ann","a@x.au"\n"Say ""hi""\nthere",b@x.au\n');
    expect(rows).toEqual([["Full name", "Email"], ["Lee, Ann", "a@x.au"], ['Say "hi"\nthere', "b@x.au"]]);
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

describe("bulk student upload — checking rows", () => {
  const headers = ["Student ID", "First name", "Last name", "Email", "Phone number", "State", "Notes", "Course code", "Start date", "End date", "Password", "Batch", "Guardian"];
  const map = mapHeaders(headers);
  const ctx = {
    courses: ["C1", "C2"],
    batches: [{ batchId: "B1", name: "Jan C1", code: "JAN-C1", courseCode: "C1" }],
    takenEmails: new Set(["old@x.au"]),
    takenIds: new Set(["S1001"]),
  };
  const sheet = [
    ["", "Ann", "Lee", "ANN@x.au", "0400 111 222", "nsw", "likes mornings", "c1; c2", "01/02/2027", "2027-12-20", "", "jan-c1", "Mum"],
    ["", "", "", "", "", "", "", "", "", "", "", "", ""], // blank line: skipped
    ["S1001", "Bo", "", "bad-email", "call", "Goa", "", "C9", "x", "01/01/2027", "short", "Nope", ""],
    ["", "Cy", "Fox", "ann@x.au", "0400 000 000", "", "", "C2", "01/02/2027", "01/01/2027", "", "Jan C1", ""],
    ["di-1", "Di", "Ng", "old@x.au", "", "", "", "C1", "01/02/2027", "01/03/2027", "longenough", "", ""],
  ];
  const checked = checkRows(readRows(sheet, map), ctx);

  it("a good row is ready, with its batch, profile, extra fields and tidy values", () => {
    expect(checked[0]).toMatchObject({
      row: 2, name: "Ann Lee", firstName: "Ann", lastName: "Lee", email: "ann@x.au", phone: "0400 111 222", state: "NSW", notes: "likes mornings",
      courses: ["C1", "C2"], startDate: "2027-02-01", endDate: "2027-12-20", batchId: "B1", extra: { Guardian: "Mum" }, errors: [],
    });
    expect(checked.map((r) => r.row)).toEqual([2, 4, 5, 6]); // the blank line is skipped
  });

  it("explains every problem in a row", () => {
    expect(checked[1].errors).toEqual([
      "Last name is empty",
      "phone “call” isn’t a valid number",
      "state “Goa” isn’t an Australian state (ACT, NSW, NT, QLD, SA, TAS, VIC, WA)",
      "“bad-email” isn’t a valid email",
      "course C9 doesn’t exist",
      "start date “x” isn’t a date",
      "Student ID S1001 is already taken",
      "password is shorter than 8 characters",
      "batch “Nope” doesn’t exist",
    ]);
    expect(checked[2].errors).toEqual(["same email as row 2", "end date is before the start date", "batch “Jan C1” is for C1, not this student’s course"]);
    expect(checked[3].errors).toEqual(["Phone number is empty", "old@x.au is already a student"]);
  });
});
