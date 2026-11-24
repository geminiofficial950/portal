"use client";

import { PortalError } from "../components/PortalStates";
import { ProblemOnShow } from "./_components/ProblemReporter";

export default function PortalErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <>
      <PortalError reset={reset} />
      {/* offers the student to report it, with a screenshot (nothing is sent unless they do) */}
      <ProblemOnShow kind="crash" message={`${error.name}: ${error.message}`} digest={error.digest} />
    </>
  );
}
