"use client";

import { useEffect, useState } from "react";
import { BarChart3, Dumbbell, Loader2, Settings, Signal, Utensils } from "lucide-react";
import { useC } from "@/lib/use-tokens";
import { ON_GOLD } from "@/lib/theme";
import { MealUsageProvider, useMealUsage } from "@/lib/meal-usage";
import { useAuth } from "@/lib/auth";
import { SettingsSheet } from "@/components/SettingsSheet";
import { DataScreen } from "@/components/screens/DataScreen";
import { NoteScreen } from "@/components/screens/note/NoteScreen";
import { MealScreen } from "@/components/screens/meal/MealScreen";
import { AuthScreen } from "@/components/screens/AuthScreen";

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
 * 共通シェル（仕様 §3.1）。認証状態（フェーズ2）でログイン画面とアプリ本体を出し分ける。
 * Supabase 構成時はログイン必須。未構成（local モード）はログイン不要で素通し。
 */
export function AppShell() {
  const { ready, supabase, authed } = useAuth();

  // セッション復元中／未ログインはログイン画面（local モードはこの分岐に入らない）
  if (supabase && (!ready || !authed)) {
    return (
      <Frame>
        <Header />
        <div className="flex-1 overflow-y-auto fn-scroll">
          {ready ? <AuthScreen /> : <Centered><Loader2 size={26} className="fn-spin" /></Centered>}
        </div>
      </Frame>
    );
  }

  return (
    <MealUsageProvider>
      <AppBody />
    </MealUsageProvider>
  );
}

// 端末フレーム（ページ背景・角丸フレーム・ステータスバー）。中身を children で差し込む。
function Frame({ children }: { children: React.ReactNode }) {
  const C = useC();
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
        {/* status bar（時刻は実時間、5G は装飾） */}
        <div className="flex items-center justify-between px-6 pt-3 pb-1" style={{ flexShrink: 0 }}>
          <StatusClock />
          <div className="flex items-center gap-1" style={{ color: C.hi }}>
            <Signal size={14} /><span style={{ fontSize: 11, fontWeight: 700 }}>5G</span>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

// ステータスバーの時刻（実時間 HH:MM）。SSR では空にしハイドレーション不一致を避ける。
function StatusClock() {
  const C = useC();
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setTime(`${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, []);
  return <span style={{ color: C.hi, fontSize: 13, fontWeight: 700, minWidth: 36 }}>{time}</span>;
}

function Centered({ children }: { children: React.ReactNode }) {
  const C = useC();
  return (
    <div className="flex items-center justify-center" style={{ height: "100%", color: C.accent }}>
      {children}
    </div>
  );
}

// ヘッダー（ロゴ・任意の右要素・設定）。右要素は SHOKUJI バッジ等に使う。
// テーマ切替・ログアウトは設定（歯車）に集約した。
function Header({ right }: { right?: React.ReactNode }) {
  const C = useC();
  const [settingsOpen, setSettingsOpen] = useState(false);
  return (
    <div className="flex items-center justify-between px-5 py-3" style={{ flexShrink: 0, borderBottom: `1px solid ${C.border}` }}>
      <h1 style={{ color: C.hi, fontSize: 20, fontWeight: 900, letterSpacing: 0.5 }}>
        FIT<span style={{ color: C.accent }}>·</span>NOTE
      </h1>
      <div className="flex items-center gap-2">
        {right}
        <button
          onClick={() => setSettingsOpen(true)}
          aria-label="設定"
          className="rounded-full flex items-center justify-center"
          style={{ width: 34, height: 34, background: C.surface, color: C.mid, border: `1px solid ${C.border}` }}
        >
          <Settings size={16} />
        </button>
      </div>
      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

// ログイン後のアプリ本体（タブ・バッジ・ナビ）。
function AppBody() {
  const C = useC();
  const [tab, setTab] = useState<Tab>("note");
  const { usage, remaining } = useMealUsage();

  const header = HEADER[tab];
  // SHOKUJI タブのバッジは「FREE PLAN 残/3」を動的表示（仕様 §3.1 / §3.3）
  const badgeText = tab === "meal" && usage.ready ? `FREE PLAN ${remaining}/${usage.limit}` : header.right;

  const right = (
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
  );

  return (
    <Frame>
      <Header right={right} />

      {/* body（タブ切替で key が変わりフェードイン再生） */}
      <div className="flex-1 overflow-y-auto fn-scroll">
        <div key={tab} className="fn-fade-in">
          {tab === "note" && <NoteScreen />}
          {tab === "meal" && <MealScreen />}
          {tab === "data" && <DataScreen />}
        </div>
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
    </Frame>
  );
}
