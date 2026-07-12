"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/", label: "Feed" },
  { href: "/analyze", label: "Analyze" },
] as const;

const isActive = (href: string, pathname: string): boolean => {
  if (href === "/") return pathname === "/" || pathname.startsWith("/feed");
  return pathname === href || pathname.startsWith(`${href}/`);
};

export function SiteHeader() {
  const pathname = usePathname() ?? "/";

  return (
    <header className="site-header">
      <Link className="site-brand" href="/">
        <span className="brand-mark" aria-hidden="true" />
        <strong>CapCheck</strong>
      </Link>
      <nav className="site-nav" aria-label="Primary">
        {NAV_LINKS.map((link) => {
          const active = isActive(link.href, pathname);
          return (
            <Link
              key={link.href}
              className="site-nav-link"
              href={link.href}
              aria-current={active ? "page" : undefined}
              data-active={active ? "true" : undefined}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
