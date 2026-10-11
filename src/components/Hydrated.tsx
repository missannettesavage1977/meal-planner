"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useHydrated } from "@/lib/store/hooks";
import { useAppStore } from "@/lib/store/appStore";
import { LoadingScreen } from "./ui";

/** Renders children once saved data is loaded; optionally redirects to onboarding. */
export function Hydrated({ children, requireOnboarding = true }: { children: ReactNode; requireOnboarding?: boolean }) {
  const hydrated = useHydrated();
  const onboarded = useAppStore((s) => s.onboarded);
  const router = useRouter();
  useEffect(() => {
    if (hydrated && requireOnboarding && !onboarded) router.replace("/onboarding");
  }, [hydrated, onboarded, requireOnboarding, router]);
  if (!hydrated || (requireOnboarding && !onboarded)) return <LoadingScreen />;
  return <>{children}</>;
}
