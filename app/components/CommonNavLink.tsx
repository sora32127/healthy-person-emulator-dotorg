import { NavLink } from "@remix-run/react";

export function CommonNavLink({ to, children, className }: { to: string, children?: React.ReactNode, className?: string }) {
  return (
    <NavLink
      to={to}
      className={`text-info underline underline-offset-4 hover:underline hover:underline-offset-4 hover:bg-base-200 rounded-md px-1 py-1 ${className}`}
      viewTransition
    >
      {children}
    </NavLink>
  );
}
