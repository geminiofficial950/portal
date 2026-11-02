import { describe, expect, it } from "vitest";
import { checkStudentId } from "@/lib/group-meta";

describe("checkStudentId", () => {
  it("accepts letters, numbers and dashes, upper-cased", () => {
    expect(checkStudentId(" s2026-01 ")).toEqual({ id: "S2026-01" });
    expect(checkStudentId("STU100")).toEqual({ id: "STU100" });
  });

  it("rejects too short, too long and odd characters", () => {
    expect(checkStudentId("A")).toHaveProperty("error");
    expect(checkStudentId("A".repeat(21))).toHaveProperty("error");
    expect(checkStudentId("S 100")).toHaveProperty("error");
    expect(checkStudentId("-S100")).toHaveProperty("error");
    expect(checkStudentId("S100@x")).toHaveProperty("error");
  });

  it("keeps trainer-style IDs for trainers", () => {
    expect(checkStudentId("T001")).toHaveProperty("error");
    expect(checkStudentId("t12")).toHaveProperty("error");
    expect(checkStudentId("TS001")).toEqual({ id: "TS001" });
  });

  it("keeps admin-style IDs for Admins", () => {
    expect(checkStudentId("A001")).toHaveProperty("error");
    expect(checkStudentId("a7")).toHaveProperty("error");
    expect(checkStudentId("AB001")).toEqual({ id: "AB001" });
  });
});
