import { meetIdOf } from "@/lib/classroom-meta";

// "Meeting ID abc-defg-hij · Code 4821" for a class or meeting, so a student can join by typing the ID in the Meet app.
// The ID comes from what staff typed, else from the Google Meet link itself.
export default function MeetInfo({ link, meetingId, passcode, className = "" }: { link: string | null; meetingId?: string | null; passcode?: string | null; className?: string }) {
  const id = meetingId || meetIdOf(link);
  if (!id && !passcode) return null;
  return (
    <span className={`block text-sm text-ink ${className}`}>
      {id && (
        <>
          Meeting ID: <span className="font-semibold">{id}</span>
        </>
      )}
      {id && passcode && " · "}
      {passcode && (
        <>
          Code: <span className="font-semibold">{passcode}</span>
        </>
      )}
    </span>
  );
}
