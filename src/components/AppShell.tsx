"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { CalendarDays, BookOpen, Home, ShoppingBasket, Refrigerator, Settings } from "lucide-react";
import { cx } from "./ui";
import { Toaster } from "./toast";

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/plan", label: "Meal Plan", short: "Plan", icon: CalendarDays },
  { href: "/recipes", label: "Recipes", icon: BookOpen },
  { href: "/shopping", label: "Shopping List", short: "Shopping", icon: ShoppingBasket },
  { href: "/food", label: "My Food", icon: Refrigerator },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const bare = pathname.startsWith("/onboarding");

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline support is optional */
    });
  }, []);

  if (bare) {
    return (
      <>
        <main className="mx-auto min-h-dvh w-full max-w-2xl px-4 pb-10 pt-6">{children}</main>
        <Toaster />
      </>
    );
  }

  return (
    <div className="min-h-dvh md:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-on-primary">
        Skip to content
      </a>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-surface px-3 py-5 md:flex">
        <Link href="/" className="mb-6 flex items-center gap-2 px-3 text-lg font-extrabold tracking-tight">
          <span aria-hidden className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-xl text-on-primary">
            🥕
          </span>
          Plate Planner
        </Link>
        <nav aria-label="Main" className="flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(pathname, href) ? "page" : undefined}
              className={cx(
                "flex min-h-12 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold",
                isActive(pathname, href) ? "bg-primary-soft text-primary-strong" : "text-muted hover:bg-surface-2 hover:text-text",
              )}
            >
              <Icon size={20} aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
        <p className="mt-auto px-3 text-xs leading-relaxed text-muted">
          Free, private and stored on this device. Prices are estimates.
        </p>
      </aside>

      <div className="min-w-0 flex-1">
        <main id="main" className="mx-auto w-full max-w-5xl px-4 pb-32 pt-5 sm:px-6 md:pb-12 md:pt-8">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav aria-label="Main" className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur md:hidden">
        <ul className="mx-auto grid max-w-lg grid-cols-6">
          {NAV.map(({ href, label, short, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  aria-label={label}
                  className={cx("flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold", active ? "text-primary" : "text-muted")}
                >
                  <span className={cx("grid h-8 w-12 place-items-center rounded-full", active && "bg-primary-soft")}>
                    <Icon size={21} aria-hidden />
                  </span>
                  {short ?? label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <Toaster />
    </div>
  );
}
