"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { DAILY_AI_LIMIT, getMealRepo } from "@/lib/db";
import { todayYmd } from "@/lib/date";

// SHOKUJI の当日 AI 利用状況を、ヘッダーバッジ（AppShell）と画面本体（MealScreen）で
// 共有するためのコンテキスト。判定の正本はサーバー側（analyze-meal ルート）で、
// ここはあくまで表示・同期用（仕様 §3.3）。

type UsageState = { used: number; limit: number; ready: boolean };
type Ctx = { usage: UsageState; remaining: number; refresh: () => Promise<void> };

const MealUsageCtx = createContext<Ctx | null>(null);

export function MealUsageProvider({ children }: { children: ReactNode }) {
  const [usage, setUsage] = useState<UsageState>({ used: 0, limit: DAILY_AI_LIMIT, ready: false });

  const refresh = useCallback(async () => {
    try {
      const u = await getMealRepo().getUsage(todayYmd());
      setUsage({ used: u.used, limit: u.limit, ready: true });
    } catch {
      setUsage((p) => ({ ...p, ready: true }));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const remaining = Math.max(0, usage.limit - usage.used);
  return <MealUsageCtx.Provider value={{ usage, remaining, refresh }}>{children}</MealUsageCtx.Provider>;
}

export function useMealUsage(): Ctx {
  const ctx = useContext(MealUsageCtx);
  if (!ctx) throw new Error("useMealUsage は MealUsageProvider の内側で使用してください");
  return ctx;
}
