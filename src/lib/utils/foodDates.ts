import type { InventoryItem } from "../domain/types";
import { daysBetween, formatDate } from "./dates";

/**
 * Describes an inventory date in plain English, distinguishing use-by (safety)
 * from best-before (quality). Never marks food unsafe without a use-by date.
 */
export function dateStatus(item: InventoryItem, today: string): { tone: "danger" | "warn" | "orange" | "neutral" | "green"; text: string; advice?: string } | null {
  if (!item.date) return null;
  const d = daysBetween(today, item.date);
  const type = item.dateType ?? "best-before";
  if (item.location === "freezer") {
    return { tone: "neutral", text: `${type === "use-by" ? "Use-by" : "Best before"} ${formatDate(item.date, { day: "numeric", month: "short" })}`, advice: "Frozen before its date? It stays safe while frozen – use within 24 hours of defrosting." };
  }
  if (type === "use-by") {
    if (d < 0) return { tone: "danger", text: "Use-by date passed", advice: "Don't eat food after its use-by date, even if it looks and smells fine. Bin it (or check if you froze it in time)." };
    if (d === 0) return { tone: "danger", text: "Use by today", advice: "Cook or freeze it today." };
    if (d <= 2) return { tone: "orange", text: `Use by ${d === 1 ? "tomorrow" : formatDate(item.date, { weekday: "short" })}`, advice: "Plan it in soon, or freeze before the date." };
    return { tone: "green", text: `Use by ${formatDate(item.date, { day: "numeric", month: "short" })}` };
  }
  if (d < 0) return { tone: "warn", text: "Past best before", advice: "Best-before dates are about quality, not safety. Check it looks, smells and tastes OK before using." };
  if (d <= 3) return { tone: "neutral", text: `Best before ${formatDate(item.date, { weekday: "short" })}` };
  return { tone: "neutral", text: `Best before ${formatDate(item.date, { day: "numeric", month: "short" })}` };
}

