import { describe, expect, it } from "vitest";
import { checkClassSession } from "@/lib/batch-meta";
import { checkMeetDetails, meetCode, meetIdOf } from "@/lib/classroom-meta";

describe("Meeting ID and code", () => {
  it("reads a Meet code in any spacing or case", () => {
    expect(meetCode("bex-jcmb-dzm")).toBe("bex-jcmb-dzm");
    expect(meetCode(" BEX-JCMB-DZM ")).toBe("bex-jcmb-dzm");
    expect(meetCode("bexjcmbdzm")).toBe("bex-jcmb-dzm");
    expect(meetCode("123 456")).toBeNull();
    expect(meetIdOf("https://meet.google.com/bex-jcmb-dzm")).toBe("bex-jcmb-dzm");
    expect(meetIdOf("https://zoom.us/j/1")).toBeNull();
  });

  it("makes the link from a Meeting ID, or the Meeting ID from the link", () => {
    expect(checkMeetDetails({ meetingId: "bex-jcmb-dzm", passcode: "4821" }, { required: true })).toEqual({ ok: true, link: "https://meet.google.com/bex-jcmb-dzm", meetingId: "bex-jcmb-dzm", passcode: "4821" });
    expect(checkMeetDetails({ link: "meet.google.com/abc-defg-hij" }, { required: true })).toEqual({ ok: true, link: "https://meet.google.com/abc-defg-hij", meetingId: "abc-defg-hij", passcode: null });
    // a link plus a different label for the ID: both kept
    expect(checkMeetDetails({ link: "https://meet.google.com/abc-defg-hij", meetingId: "Room 4", passcode: "x1" }, { required: false })).toMatchObject({ ok: true, meetingId: "Room 4", passcode: "x1" });
  });

  it("refuses what can't be joined", () => {
    expect(checkMeetDetails({}, { required: true }).ok).toBe(false);
    expect(checkMeetDetails({}, { required: false })).toEqual({ ok: true, link: null, meetingId: null, passcode: null });
    expect(checkMeetDetails({ meetingId: "Room 4" }, { required: false }).ok).toBe(false); // no link and not a Meet code
    expect(checkMeetDetails({ link: "https://zoom.us/j/1" }, { required: false }).ok).toBe(false);
    expect(checkMeetDetails({ meetingId: "x".repeat(41) }, { required: false }).ok).toBe(false);
  });

  it("weekly class: Meeting ID alone works, other https links still work", () => {
    expect(checkClassSession({ day: "Monday", time: "10:00", meetingId: "bex-jcmb-dzm", passcode: "4821" })).toEqual({
      ok: true,
      value: { day: "Monday", time: "10:00", link: "https://meet.google.com/bex-jcmb-dzm", meetingId: "bex-jcmb-dzm", passcode: "4821" },
    });
    expect(checkClassSession({ day: "Monday", time: "10:00", link: "https://teams.example.com/x" })).toMatchObject({ ok: true, value: { link: "https://teams.example.com/x", meetingId: null } });
    expect(checkClassSession({ day: "Monday", time: "10:00" }).ok).toBe(false);
  });
});
