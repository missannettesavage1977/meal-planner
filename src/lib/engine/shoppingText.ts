import { CATEGORIES, SUPERMARKET_LABELS, type AdhocItem, type Category, type StorageLocation, type Supermarket } from "../domain/types";
import { formatPence } from "../utils/money";
import type { ShoppingLine } from "./consolidate";
import { formatBaseQuantity } from "./units";

/** "2 × 400g tin" / "4 loose" / "300g" – what to pick up. */
export function purchaseText(line: ShoppingLine): string {
  const q = line.toBuy;
  if (q <= 0) return "";
  if (line.purchase && line.purchase.packs.length) {
    return line.purchase.packs
      .map((p) => {
        if (p.label === "loose") return `${p.count} loose`;
        return p.count > 1 ? `${p.count} × ${p.label}` : p.label;
      })
      .join(" + ");
  }
  return formatBaseQuantity(q, line.unit, line.ingredient);
}

export function quantityText(line: ShoppingLine, qty: number): string {
  if (line.unit === "item" && line.ingredient) {
    const label = line.ingredient.itemLabel
      ? qty === 1 ? line.ingredient.itemLabel : line.ingredient.itemLabelPlural ?? line.ingredient.itemLabel
      : qty <= 1 ? line.ingredient.name : line.ingredient.plural ?? line.ingredient.name;
    return `${formatBaseQuantity(qty, "item")} ${label}`;
  }
  return formatBaseQuantity(qty, line.unit, line.ingredient);
}

export function needText(line: ShoppingLine): string {
  const parts = [`need ${quantityText(line, line.required)}`];
  if (line.available > 0) parts.push(`have ${quantityText(line, line.available)}`);
  if (line.coveredByUnknownInventory) parts.push("in My Food");
  return parts.join(" · ");
}

export function displayName(line: ShoppingLine): string {
  const n = line.name;
  return n.charAt(0).toUpperCase() + n.slice(1);
}

export function categoryOrder(c: Category): number {
  return CATEGORIES.indexOf(c);
}

export function defaultLocation(category: Category): StorageLocation {
  if (category === "Frozen") return "freezer";
  if (["Meat & poultry", "Fish & seafood", "Dairy & eggs", "Chilled", "Fresh herbs"].includes(category)) return "fridge";
  return "cupboard";
}

export type LineGroup = "buy" | "check" | "home";

export function lineGroup(line: ShoppingLine): LineGroup {
  if (line.owned) return "home";
  if (line.toBuy > 0) return "buy";
  if (line.staple || line.coveredByUnknownInventory) return "check";
  return "home";
}

/** Plain-text list for sharing via messaging apps or copying. */
export function exportShoppingText(
  lines: ShoppingLine[],
  adhoc: AdhocItem[],
  opts: { supermarket: Supermarket; weekLabel: string; includeChecked?: boolean; totalPence?: number },
): string {
  const out: string[] = [`🛒 Shopping list – ${opts.weekLabel} (${SUPERMARKET_LABELS[opts.supermarket]})`];
  const byCat = new Map<Category, string[]>();
  for (const l of lines) {
    if (lineGroup(l) !== "buy") continue;
    if (l.checked && !opts.includeChecked) continue;
    const price = l.purchaseCost.pence > 0 ? ` (~${formatPence(l.purchaseCost.pence)})` : "";
    const row = `${l.checked ? "☑" : "☐"} ${displayName(l)} – ${purchaseText(l)}${price}`;
    byCat.set(l.category, [...(byCat.get(l.category) ?? []), row]);
  }
  for (const a of adhoc) {
    if (a.checked && !opts.includeChecked) continue;
    const row = `${a.checked ? "☑" : "☐"} ${a.name}${a.quantity ? ` – ${a.quantity}` : ""}`;
    byCat.set(a.category, [...(byCat.get(a.category) ?? []), row]);
  }
  const cats = [...byCat.keys()].sort((a, b) => categoryOrder(a) - categoryOrder(b));
  for (const c of cats) {
    out.push("", c.toUpperCase(), ...byCat.get(c)!);
  }
  const check = lines.filter((l) => lineGroup(l) === "check");
  if (check.length) out.push("", "CHECK YOU HAVE", ...check.map((l) => `• ${displayName(l)}`));
  if (opts.totalPence !== undefined) out.push("", `Estimated total ~${formatPence(opts.totalPence)} (estimate, not a live price)`);
  return out.join("\n");
}
