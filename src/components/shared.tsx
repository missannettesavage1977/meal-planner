"use client";

import Link from "next/link";
import { Info } from "lucide-react";
import type { Recipe } from "@/lib/domain/types";
import type { Estimate } from "@/lib/pricing/types";
import { formatPence, formatRange } from "@/lib/utils/money";
import { Badge, cx } from "./ui";

export function RecipeThumb({ recipe, size = "md", className }: { recipe: Pick<Recipe, "emoji" | "hue" | "name">; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const sizes = { sm: "h-12 w-12 text-2xl rounded-xl", md: "h-16 w-16 text-3xl rounded-2xl", lg: "h-24 w-24 text-5xl rounded-3xl", xl: "h-44 w-full text-7xl rounded-3xl" };
  return (
    <div
      aria-hidden
      className={cx("grid shrink-0 place-items-center", sizes[size], className)}
      style={{
        background: `linear-gradient(135deg, hsl(${recipe.hue} 75% 88%), hsl(${(recipe.hue + 35) % 360} 70% 78%))`,
      }}
    >
      <span className="drop-shadow-sm">{recipe.emoji}</span>
    </div>
  );
}

/** A money estimate. Always signals that the value is an estimate and, where relevant, demo data. */
export function Money({ estimate, range = false, className }: { estimate: Estimate; range?: boolean; className?: string }) {
  if (estimate.coverage === 0 && estimate.pence === 0) return <span className={cx("text-muted", className)}>No price data</span>;
  return (
    <span className={className}>
      {range ? formatRange(estimate.low, estimate.high) : `~${formatPence(estimate.pence)}`}
      {estimate.coverage < 0.999 && <span className="text-muted"> +</span>}
    </span>
  );
}

export function EstimateBadge({ sources }: { sources: Set<string> | string[] }) {
  const s = new Set(sources);
  if (s.has("demo")) return <Badge tone="warn">Demo prices</Badge>;
  if (s.has("manual") && s.size === 1) return <Badge tone="green">Your prices</Badge>;
  return <Badge>Estimate</Badge>;
}

export function PriceDisclaimer({ className }: { className?: string }) {
  return (
    <p className={cx("flex items-start gap-1.5 text-xs leading-relaxed text-muted", className)}>
      <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
      <span>
        Prices are estimates, not live supermarket prices. Built-in figures are illustrative demonstration data that
        haven&apos;t been checked against any retailer. Add real prices you see in{" "}
        <Link className="underline" href="/settings#prices">
          Settings → Prices
        </Link>
        .
      </span>
    </p>
  );
}

export function AllergenCaveat({ className }: { className?: string }) {
  return (
    <p className={cx("text-xs leading-relaxed text-muted", className)}>
      Allergen and diet information is worked out from typical ingredients. Recipes, brands and products vary and
      cross-contamination isn&apos;t covered – always check product labels yourself, especially for serious allergies.
    </p>
  );
}

export function BudgetBar({ spend, budget }: { spend: number; budget: number }) {
  const pct = budget > 0 ? Math.min(100, (spend / budget) * 100) : 0;
  const over = spend > budget;
  return (
    <div
      className="h-3 w-full overflow-hidden rounded-full bg-surface-2"
      role="meter"
      aria-label="Budget used"
      aria-valuemin={0}
      aria-valuemax={budget}
      aria-valuenow={Math.round(spend)}
      aria-valuetext={`${formatPence(spend)} of ${formatPence(budget)}`}
    >
      <div className={cx("h-full rounded-full transition-all", over ? "bg-danger" : pct > 85 ? "bg-accent" : "bg-primary")} style={{ width: `${pct}%` }} />
    </div>
  );
}
