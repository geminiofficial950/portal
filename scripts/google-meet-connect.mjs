// Connects the college's Google account so the portal can make Google Meet links by itself.
// It only asks Google for permission and prints the token — it never creates, changes or deletes a meeting.
//
// One-time setup:
//   1. Google Cloud Console → create a project → enable "Google Calendar API".
//   2. APIs & Services → OAuth consent screen → set it up (add the college account as a test user while it is in testing).
//   3. Credentials → Create credentials → OAuth client ID → type "Desktop app". Copy the client ID and secret into .env:
//        GOOGLE_CLIENT_ID=...
//        GOOGLE_CLIENT_SECRET=...
//   4. Run:  node --env-file=.env scripts/google-meet-connect.mjs
//      Open the link it prints, sign in with the Google account whose calendar should hold the meetings, and allow access.
//   5. Put the GOOGLE_REFRESH_TOKEN it prints into .env (optionally GOOGLE_CALENDAR_ID, default "primary") and restart the portal.
import { createServer } from "node:http";

const PORT = 53682;
const REDIRECT = `http://127.0.0.1:${PORT}/callback`;
const SCOPE = "https://www.googleapis.com/auth/calendar.events";
const { GOOGLE_CLIENT_ID: id, GOOGLE_CLIENT_SECRET: secret } = process.env;

if (!id || !secret) {
  console.log("Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env first (see the steps at the top of this file).");
  process.exit(1);
}

const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
auth.search = new URLSearchParams({ client_id: id, redirect_uri: REDIRECT, response_type: "code", scope: SCOPE, access_type: "offline", prompt: "consent" }).toString();

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", REDIRECT);
  if (url.pathname !== "/callback") return void res.writeHead(404).end();
  const code = url.searchParams.get("code");
  const reply = (text) => res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" }).end(text);
  if (!code) {
    reply(`Google said: ${url.searchParams.get("error") ?? "no permission given"}. You can close this tab.`);
    return server.close();
  }
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri: REDIRECT, grant_type: "authorization_code" }),
  });
  const data = await r.json().catch(() => ({}));
  if (!data.refresh_token) {
    console.log("\nGoogle didn’t give a refresh token:", data.error_description ?? data.error ?? r.status);
    console.log("Remove the portal’s access at myaccount.google.com/permissions and run this again.");
    reply("Something went wrong — see the terminal. You can close this tab.");
  } else {
    console.log("\nConnected. Add this line to .env, then restart the portal:\n");
    console.log(`GOOGLE_REFRESH_TOKEN=${data.refresh_token}\n`);
    reply("Connected — go back to the terminal. You can close this tab.");
  }
  server.close();
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("Open this link, sign in with the college Google account and allow access:\n");
  console.log(auth.toString(), "\n");
});
