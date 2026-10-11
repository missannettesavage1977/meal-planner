"use client";

import type { BudgetSummary } from "@/lib/engine/budget";
import { formatPence, formatRange } from "@/lib/utils/money";
import { BudgetBar, EstimateBadge } from "./shared";
import { Card } from "./ui";

function Row({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div>
        <p className={strong ? "font-semibold" : ""}>{label}</p>
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      <p className={strong ? "text-lg font-bold tabular-nums" : "tabular-nums"}>{value}</p>
    </div>
  );
}

export function BudgetPanel({ budget, compact }: { budget: BudgetSummary; compact?: boolean }) {
  const over = budget.remainingPence < 0;
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Budget</h2>
        <EstimateBadge sources={budget.shopping.sources.size ? budget.shopping.sources : budget.consumption.sources} />
      </div>
      <BudgetBar spend={budget.spendPence} budget={budget.budgetPence} />
      <p className="mt-2 text-[15px]">
        <strong>{formatPence(Math.abs(budget.remainingPence))}</strong> {over ? "over" : "left"} of your {formatPence(budget.budgetPence)} weekly budget
        {budget.scope === "planned-meals" ? " (planned meals)" : " (all groceries)"}.
      </p>
      <div className="mt-3 divide-y divide-border">
        <Row
          strong
          label="Still to buy"
          value={`~${formatPence(budget.shopping.pence)}`}
          hint={`Likely ${formatRange(budget.shopping.low, budget.shopping.high)} – whole packs, after food at home`}
        />
        {budget.scope === "all-groceries" && budget.adhocPence > 0 && <Row label="Extra items you added" value={`~${formatPence(budget.adhocPence)}`} />}
        {!compact && (
          <>
            <Row label="Food your meals use" value={`~${formatPence(budget.consumption.pence)}`} hint="Value of the ingredients actually eaten, including food from home" />
            <Row label="Per portion" value={`~${formatPence(budget.costPerPortionPence)}`} hint={`${budget.portions} portions still to cook`} />
            <Row label="Saved by sharing packs" value={formatPence(budget.overlapSavingPence)} hint="vs buying each recipe's ingredients separately" />
            <Row label="Saved by using food at home" value={formatPence(budget.inventorySavingPence)} hint="Reduction in this week's shopping bill" />
            {budget.surplusValuePence > 0 && (
              <Row label="Left over in packs" value={`~${formatPence(budget.surplusValuePence)}`} hint="Bought but not used this week – stays in your kitchen" />
            )}
          </>
        )}
      </div>
      {!compact && budget.topItems.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 font-semibold">Biggest costs</p>
          <ul className="space-y-1.5">
            {budget.topItems.map((t) => (
              <li key={t.key} className="flex items-center gap-2 text-sm">
                <span className="w-32 shrink-0 truncate capitalize sm:w-44">{t.name}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.round(t.share * 100)}%` }} />
                </span>
                <span className="w-14 text-right tabular-nums">{formatPence(t.pence)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {budget.unpriced.length > 0 && (
        <p className="mt-3 text-sm text-muted">No price data for: {budget.unpriced.slice(0, 6).join(", ")}{budget.unpriced.length > 6 ? "…" : ""}. Totals exclude these.</p>
      )}
    </Card>
  );
}
