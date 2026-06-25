"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { BarChart3, Dumbbell, Moon, Signal, Sun, Utensils } from "lucide-react";
import { useC } from "@/lib/use-tokens";
import { ON_GOLD } from "@/lib/theme";
import { MealUsageProvider, useMealUsage } from "@/lib/meal-usage";
import { DataScreen } from "@/components/screens/DataScreen";
import { NoteScreen } from "@/components/screens/note/NoteScreen";
import { MealScreen } from "@/components/screens/meal/MealScreen";

type Tab = "note" | "meal" | "data";

const NAV: { key: Tab; label: string; Icon: typeof Dumbbell }[] = [
  { key: "note", label: "NOTE", Icon: Dumbbell },
  { key: "meal", label: "SHOKUJI", Icon: Utensils },
  { key: "data", label: "DATA", Icon: BarChart3 },
];

const HEADER: Record<Tab, { right: string; solid: boolean }> = {
  note: { right: "GYM MODE", solid: true },
  meal: { right: "FREE PLAN", solid: false }, // 残回数はバッジ側で動的に付与
  data: { right: "PREMIUM", solid: false },
};

/**
 * 共通シェル（仕様 §3.1）。SHOKUJI の AI 残回数バッジを共有するため
 * MealUsageProvider でラップする。
 */
export function AppShell() {
  return (
    <MealUsageProvider>
      <Shell />
    </MealUsageProvider>
  );
}

function Shell() {
  const C = useC();
  const [tab, setTab] = useState<Tab>("note");
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { usage, remaining } = useMealUsage();
  const isDark = !mounted || resolvedTheme !== "light";
  const header = HEADER[tab];
  // SHOKUJI タブのバッジは「FREE PLAN 残/3」を動的表示（仕様 §3.1 / §3.3）
  const badgeText = tab === "meal" && usage.ready ? `FREE PLAN ${remaining}/${usage.limit}` : header.right;

  return (
    <div
      style={{ background: C.page, minHeight: "100vh", transition: "background .3s" }}
      className="flex items-center justify-center p-4"
    >
      <div
        id="fn-frame"
        className="relative flex flex-col overflow-hidden"
        style={{
          width: "100%", maxWidth: 390, height: 800, maxHeight: "92vh",
          background: C.bg, borderRadius: 40, border: `1px solid ${C.frame}`,
          boxShadow: C.shadow, transition: "background .3s, border-color .3s",
        }}
      >
        {/* status bar（装飾） */}
        <div className="flex items-center justify-between px-6 pt-3 pb-1" style={{ flexShrink: 0 }}>
          <span style={{ color: C.hi, fontSize: 13, fontWeight: 700 }}>9:41</span>
          <div className="flex items-center gap-1" style={{ color: C.hi }}>
            <Signal size={14} /><span style={{ fontSize: 11, fontWeight: 700 }}>5G</span>
          </div>
        </div>

        {/* header */}
        <div className="flex items-center justify-between px-5 py-3" style={{ flexShrink: 0, borderBottom: `1px solid ${C.border}` }}>
          <h1 style={{ color: C.hi, fontSize: 20, fontWeight: 900, letterSpacing: 0.5 }}>
            FIT<span style={{ color: C.accent }}>·</span>NOTE
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              aria-label="テーマを切り替える"
              className="rounded-full flex items-center justify-center"
              style={{ width: 34, height: 34, background: C.surface, color: C.accent, border: `1px solid ${C.border}` }}
            >
              {isDark ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <span
              className="rounded-full px-3 py-1"
              style={{
                fontSize: 11, fontWeight: 800, letterSpacing: 1,
                background: header.solid ? C.accent : "transparent",
                color: header.solid ? ON_GOLD : C.mid,
                border: header.solid ? "none" : `1px solid ${C.border}`,
              }}
            >
              {badgeText}
            </span>
          </div>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto fn-scroll">
          {tab === "note" && <NoteScreen />}
          {tab === "meal" && <MealScreen />}
          {tab === "data" && <DataScreen />}
        </div>

        {/* global nav */}
        <div className="flex" style={{ flexShrink: 0, borderTop: `1px solid ${C.border}`, background: C.bg }}>
          {NAV.map(({ key, label, Icon }) => {
            const on = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="flex-1 flex flex-col items-center gap-1 py-3"
                style={{ color: on ? C.accent : C.lo }}
              >
                <Icon size={20} />
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
