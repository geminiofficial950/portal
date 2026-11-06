"use client";

import { PortalError } from "../components/PortalStates";

export default function PortalErrorPage({ reset }: { error: Error; reset: () => void }) {
  return <PortalError reset={reset} />;
}
