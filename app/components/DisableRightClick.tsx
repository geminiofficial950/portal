"use client";

import { useEffect } from "react";

// Blocks the browser context menu on every page (mounted once in the root layout).
export default function DisableRightClick() {
  useEffect(() => {
    const block = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", block);
    return () => document.removeEventListener("contextmenu", block);
  }, []);

  return null;
}
