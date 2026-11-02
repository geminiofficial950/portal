import ThemeToggle from "../../components/ThemeToggle";
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
    <header className="flex h-16 shrink-0 items-center justify-end px-4 pt-2 sm:px-4 lg:h-14 lg:px-4 lg:pt-2">
      <ThemeToggle />
    </header>
  );
}
