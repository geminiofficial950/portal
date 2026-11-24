import { PortalNotFound } from "../components/PortalStates";
import { ProblemOnShow } from "./_components/ProblemReporter";

export default function NotFound() {
  return (
    <>
      <PortalNotFound home="/dashboard" />
      {/* a broken link or a page that isn't theirs: offer to report it (nothing is sent unless they do) */}
      <ProblemOnShow kind="not-found" message="Page not found or not available to this student" />
    </>
  );
}
