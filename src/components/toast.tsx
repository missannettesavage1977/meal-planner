"use client";

import { create } from "zustand";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cx } from "./ui";

type Tone = "success" | "info" | "error";
interface Toast {
  id: number;
  message: string;
  tone: Tone;
  details?: string[];
}

interface ToastState {
  toasts: Toast[];
  push(message: string, tone?: Tone, details?: string[]): void;
  dismiss(id: number): void;
}

let nextId = 1;

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push(message, tone = "success", details) {
    const id = nextId++;
    set({ toasts: [...get().toasts.slice(-2), { id, message, tone, details }] });
    setTimeout(() => get().dismiss(id), details?.length ? 7000 : 3500);
  },
  dismiss(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

export function toast(message: string, tone: Tone = "success", details?: string[]) {
  useToasts.getState().push(message, tone, details);
}

/** Shows an action result as a toast. */
export function toastResult(r: { ok: boolean; message?: string; notes?: string[] }) {
  if (!r.message && !r.notes?.length) return;
  toast(r.message ?? (r.ok ? "Done" : "Something went wrong"), r.ok ? "success" : "error", r.notes);
}

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cx(
            "pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl px-4 py-3 text-[15px] shadow-lg",
            t.tone === "error" ? "bg-danger text-white" : "bg-text text-bg",
          )}
        >
          {t.tone === "success" && <CheckCircle2 className="mt-0.5 shrink-0" size={20} aria-hidden />}
          {t.tone === "info" && <Info className="mt-0.5 shrink-0" size={20} aria-hidden />}
          {t.tone === "error" && <TriangleAlert className="mt-0.5 shrink-0" size={20} aria-hidden />}
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{t.message}</p>
            {t.details?.map((d, i) => (
              <p key={i} className="mt-0.5 text-sm opacity-85">
                {d}
              </p>
            ))}
          </div>
          <button type="button" aria-label="Dismiss" className="-mr-1 rounded-full p-1 opacity-70 hover:opacity-100" onClick={() => dismiss(t.id)}>
            <X size={18} />
          </button>
        </div>
      ))}
    </div>
  );
}
