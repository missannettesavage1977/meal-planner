"use client";

import { useState } from "react";
import { MessageSquareText } from "lucide-react";
import { describeWeekRequest, parseWeekRequestLocally, WeekRequestSchema, type WeekRequest } from "@/lib/engine/weekRequest";
import { Button, Card, inputClass } from "../ui";

/** Asks the optional AI route first; falls back to the on-device parser. */
async function interpret(text: string): Promise<{ request: WeekRequest; source: "ai" | "local" }> {
  try {
    const res = await fetch("/api/ai/week-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (res.ok) {
      const json = await res.json();
      const parsed = WeekRequestSchema.safeParse(json.request);
      if (parsed.success) return { request: parsed.data, source: "ai" };
    }
  } catch {
    /* offline or not configured */
  }
  return { request: parseWeekRequestLocally(text), source: "local" };
}

export function WeekRequestBox({ onPlan, busy }: { onPlan: (r: WeekRequest, summary: string[]) => void; busy: boolean }) {
  const [text, setText] = useState("");
  const [working, setWorking] = useState(false);
  return (
    <Card className="mb-5">
      <label htmlFor="week-request" className="flex items-center gap-2 font-semibold">
        <MessageSquareText size={18} aria-hidden /> Anything special this week?
      </label>
      <p className="mb-2 text-sm text-muted">e.g. “cheap veggie meals, no mushrooms, quick weeknights” – applies to this plan only.</p>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim()) return;
          setWorking(true);
          const { request, source } = await interpret(text);
          setWorking(false);
          const summary = describeWeekRequest(request);
          onPlan(request, [summary.length ? `Understood: ${summary.join(" · ")}` : "Couldn't pick out any preferences – planned as usual.", source === "ai" ? "Interpreted with AI" : "Interpreted on your device"]);
        }}
      >
        <input id="week-request" className={inputClass} value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="What do you fancy?" />
        <Button type="submit" disabled={!text.trim() || busy || working} className="shrink-0">
          {working ? "Reading…" : "Plan with this"}
        </Button>
      </form>
    </Card>
  );
}
