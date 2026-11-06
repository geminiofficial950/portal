import MelbourneClock from "../../components/MelbourneClock";
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
    // Spacer under the mobile top bar, then the live Melbourne clock (Dark mode and full screen are in the sidebar)
    <header className="shrink-0">
      <div aria-hidden className="h-16 lg:hidden" />
      <div className="flex justify-end px-4 pb-1 pt-3">
        <MelbourneClock />
      </div>
    </header>
  );
}
