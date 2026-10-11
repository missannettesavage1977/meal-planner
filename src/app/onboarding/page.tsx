"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { DEFAULT_HOUSEHOLD, type Household } from "@/lib/domain/types";
import { useAppStore, currentWeekStart } from "@/lib/store/appStore";
import { addDays, dayIndex, todayISO } from "@/lib/utils/dates";
import { useHydrated } from "@/lib/store/hooks";
import {
  DietSection,
  HouseholdSizeSection,
  MealsSection,
  ShopBudgetSection,
  StyleSection,
  TastesSection,
  TimeSkillSection,
} from "@/components/HouseholdForm";
import { Button, Card, LoadingScreen } from "@/components/ui";
import { toast } from "@/components/toast";

const STEPS = [
  { title: "Who are you cooking for?", subtitle: "So recipes and quantities fit your household.", C: HouseholdSizeSection },
  { title: "Shop & budget", subtitle: "We'll estimate costs for your usual supermarket.", C: ShopBudgetSection },
  { title: "Which meals?", subtitle: "Plan just dinners, or lunches and breakfasts too.", C: MealsSection },
  { title: "Time & kitchen", subtitle: "We'll keep weeknights realistic.", C: TimeSkillSection },
  { title: "Diets & allergies", subtitle: "Allergies are strict exclusions, never just preferences.", C: DietSection },
  { title: "What do you like?", subtitle: "Optional – helps us suggest meals you'll enjoy.", C: TastesSection },
  { title: "Your cooking style", subtitle: "Batch cooking and what matters most to you.", C: StyleSection },
];

export default function OnboardingPage() {
  const hydrated = useHydrated();
  const router = useRouter();
  const existing = useAppStore((s) => s.household);
  const onboarded = useAppStore((s) => s.onboarded);
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const generateWeek = useAppStore((s) => s.generateWeek);
  const [step, setStep] = useState(-1);
  const [draft, setDraft] = useState<Household | null>(null);
  const [busy, setBusy] = useState(false);

  if (!hydrated) return <LoadingScreen />;
  const value = draft ?? (onboarded ? existing : DEFAULT_HOUSEHOLD);
  const patch = (p: Partial<Household>) => setDraft({ ...value, ...p });

  const finish = (h: Household) => {
    setBusy(true);
    completeOnboarding(h);
    // allow state to settle, then plan
    setTimeout(() => {
      const week = currentWeekStart();
      const res = generateWeek(week);
      // Late in the week? Plan next week too and show that.
      const daysLeft = 7 - dayIndex(todayISO());
      if (daysLeft <= 2) {
        const next = generateWeek(addDays(week, 7));
        toast("Your next week is planned!", "success", next.notes);
        router.push("/plan?week=next");
        return;
      }
      toast(res.ok ? "Your first week is planned!" : "Profile saved", "success", res.notes);
      router.push("/plan");
    }, 0);
  };

  if (step < 0) {
    return (
      <div className="flex min-h-[85dvh] flex-col justify-center">
        <div className="mb-6 grid h-16 w-16 place-items-center rounded-3xl bg-primary text-4xl text-on-primary" aria-hidden>
          🥕
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Plan the week. Shop once. Waste less.</h1>
        <p className="mt-3 text-lg text-muted">
          Plate Planner builds a week of meals around your household, budget and what&apos;s already in your fridge – then
          turns it into one tidy shopping list. Free, no subscription, and your data stays on this device.
        </p>
        <ul className="mt-6 space-y-2 text-[15px]">
          <li>🗓️ Realistic weekly plans with leftovers and ingredient reuse</li>
          <li>🛒 One consolidated list with quantities, aisles and cost estimates</li>
          <li>🥫 Use up what you have before it goes off</li>
        </ul>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button size="lg" onClick={() => setStep(0)}>
            Set up my household
          </Button>
          <Button size="lg" variant="secondary" icon={<Sparkles size={18} />} onClick={() => finish(value)} disabled={busy}>
            Skip – use sensible defaults
          </Button>
        </div>
        <p className="mt-4 text-sm text-muted">Takes about 2 minutes. Every question is optional and you can change everything later in Settings.</p>
      </div>
    );
  }

  const { title, subtitle, C } = STEPS[step];
  const last = step === STEPS.length - 1;
  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <Button variant="ghost" size="sm" icon={<ArrowLeft size={18} />} onClick={() => setStep(step - 1)} aria-label="Back">
          Back
        </Button>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1} aria-label="Setup progress">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
        <span className="text-sm tabular-nums text-muted">
          {step + 1}/{STEPS.length}
        </span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mb-5 mt-1 text-muted">{subtitle}</p>
      <Card className="p-5">
        <C value={value} onChange={patch} />
      </Card>
      <div className="sticky bottom-0 -mx-4 mt-6 flex gap-3 bg-bg/95 px-4 py-4 backdrop-blur">
        {!last && (
          <Button variant="secondary" className="flex-1" onClick={() => setStep(step + 1)}>
            Skip
          </Button>
        )}
        <Button className="flex-[2]" disabled={busy} onClick={() => (last ? finish(value) : setStep(step + 1))}>
          {last ? (busy ? "Planning your week…" : "Create my meal plan") : "Next"}
        </Button>
      </div>
    </div>
  );
}
