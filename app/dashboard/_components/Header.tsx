import MelbourneClock from "../../components/MelbourneClock";
import StudentTypography from "./StudentTypography";
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
      <div className={`flex flex-wrap items-center gap-2 px-4 pb-2 pt-3 ${variant === "student" ? "justify-between lg:justify-end" : "justify-end"}`}>
        {variant === "student" && <StudentTypography />}
        <MelbourneClock student={variant === "student"} />
      </div>
    </header>
  );
}
