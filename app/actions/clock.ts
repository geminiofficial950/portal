"use server";

/** The server's time (ms), for the student pages' clock: deadlines follow it, never the computer's clock */
export async function serverTimeAction(): Promise<number> {
  return Date.now();
}
