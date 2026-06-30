"use client";

import { createContext, useContext, useEffect, useState } from "react";

/**
 * アプリ設定（フェーズ4-D）。localStorage に永続化する軽量ストア。
 * テーマ（ナイトモード）は next-themes が別管理するためここには含めない。
 */
export type Settings = {
  /** セット記録後にインターバル（休憩）タイマーを自動表示するか */
  autoIntervalTimer: boolean;
  /** タイマー完了時に端末を振動させるか（navigator.vibrate 対応端末のみ） */
  vibration: boolean;
};

const DEFAULTS: Settings = { autoIntervalTimer: true, vibration: true };
const KEY = "fitnote.settings.v1";

type SettingsContextValue = Settings & {
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  // SSR・初回は既定値。マウント後に localStorage から復元（ハイドレーション不一致を避ける）。
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setSettings({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {
      /* 破損時は既定値のまま */
    }
  }, []);

  const set: SettingsContextValue["set"] = (key, value) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* 保存失敗は無視（プライベートモード等） */
      }
      return next;
    });
  };

  return (
    <SettingsContext.Provider value={{ ...settings, set }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings は SettingsProvider 内で使ってください");
  return ctx;
}
