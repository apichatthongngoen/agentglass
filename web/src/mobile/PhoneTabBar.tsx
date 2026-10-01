import type { ReactNode } from "react";
import { VIEWS, type ViewId } from "../components/workspace/views.ts";
import { ICON } from "../lib/iconSize.ts";

/**
 * The installed phone app's navigation: four fixed views at the bottom, where a
 * thumb reaches, in place of the rail (hidden by phone.css). Fixed rather than
 * read from the user's rail layout — the rail is arranged for a desk.
 *
 * Gates are answered from the TopBar's needs chip and the Dashboard's alerts;
 * the Lantern shows who needs you but cannot answer for you.
 */
export const PHONE_VIEWS: ViewId[] = ["dash", "term", "chat", "lantern"];

export function PhoneTabBar({ view, onView, extra }: { view: ViewId; onView: (v: ViewId) => void; extra?: ReactNode }) {
  const defs = PHONE_VIEWS.map((id) => VIEWS.find((v) => v.id === id)).filter((v) => !!v);
  return (
    <nav aria-label="Phone views" className="shrink-0 flex items-stretch"
      style={{ borderTop: "1px solid var(--surface-line)", background: "var(--surface-nav)",
               paddingBottom: "env(safe-area-inset-bottom)" }}>
      {defs.map((v) => {
        const Icon = v.icon;
        const on = v.id === view;
        return (
          <button key={v.id} type="button" onClick={() => onView(v.id)} aria-current={on ? "page" : undefined}
            className="flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px]"
            style={{ color: on ? "var(--primary-hover)" : "var(--text3)" }}>
            <Icon size={ICON.rail} />
            <span>{v.label}</span>
          </button>
        );
      })}
      {extra}
    </nav>
  );
}
