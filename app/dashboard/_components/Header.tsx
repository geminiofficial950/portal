import type { PortalVariant } from "./Sidebar";

type HeaderUser = { initials: string; email: string };

const users: Record<PortalVariant, HeaderUser> = {
  student: { initials: "ST", email: "" },
  trainer: { initials: "TR", email: "" },
  admin: { initials: "SA", email: "" },
};

export default function Header({
  variant = "student",
  user: _user = users[variant],
}: {
  variant?: PortalVariant;
  user?: HeaderUser;
}) {
  return (
    // Spacer under the mobile top bar; on desktop just a little top padding (Dark mode is in the sidebar now)
    <header aria-hidden className="h-16 shrink-0 lg:h-6" />
  );
}
