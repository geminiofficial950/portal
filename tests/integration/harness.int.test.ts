import { describe, expect, it } from "vitest";
import { createCourse, getCourse } from "@/lib/courses";

describe("integration harness", () => {
  it("talks to the in-memory database, not the real one", async () => {
    expect(process.env.MONGODB_URI).toMatch(/127\.0\.0\.1|localhost/);
    await createCourse({ code: "TST10001", name: "Test course", category: "Certificate", duration: "1 month", description: "" });
    expect((await getCourse("TST10001"))?.name).toBe("Test course");
  });

  it("a course created with its selected units keeps them, each with its own code", async () => {
    await createCourse({ code: "ICT40120", name: "IT", category: "Certificate", duration: "6 months", description: "" }, [
      { code: "ICT-101", title: "Networks" },
      { code: "MOD.2", title: "Cloud" },
    ]);
    expect((await getCourse("ICT40120"))?.units).toEqual([
      { code: "ICT-101", title: "Networks" },
      { code: "MOD.2", title: "Cloud" },
    ]);
  });
});
