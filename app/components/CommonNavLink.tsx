import { NavLink } from "@remix-run/react";

export function CommonNavLink({ to, children, className }: { to: string, children?: React.ReactNode, className?: string }) {
  return (
    <NavLink
      to={to}
      className={`text-info underline-offset-4 hover:bg-info ${className}`}
      viewTransition
    >
      {children}
    </NavLink>
  );
}