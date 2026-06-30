"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Info, LogOut, Moon, Timer, Vibrate, X } from "lucide-react";
import { useC } from "@/lib/use-tokens";
import { useSettings } from "@/lib/settings";
import { useAuth } from "@/lib/auth";
import { FramePortal } from "@/components/screens/note/FramePortal";

const APP_VERSION = "0.1.0";

/* iOS 風トグルスイッチ。on/off をタップで切替。 */
function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  const C = useC();
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="relative rounded-full"
      style={{
        width: 48,
        height: 28,
        background: on ? C.accent : C.tactical,
        border: `1px solid ${on ? C.accent : C.border}`,
        transition: "background .2s, border-color .2s",
        flexShrink: 0,
      }}
    >
      <span
        className="absolute rounded-full"
        style={{
          width: 22,
          height: 22,
          top: 2,
          left: on ? 23 : 2,
          background: on ? "#1a1303" : C.mid,
          transition: "left .18s ease, background .2s",
        }}
      />
    </button>
  );
}

/* 設定の1行（左: アイコン+ラベル+補足 / 右: コントロール）。 */
function Row({
  Icon,
  label,
  desc,
  children,
}: {
  Icon: typeof Moon;
  label: string;
  desc?: string;
  children: React.ReactNode;
}) {
  const C = useC();
  return (
    <div className="flex items-center gap-3 py-3">
      <div
        className="rounded-xl flex items-center justify-center"
        style={{ width: 36, height: 36, background: C.surface, border: `1px solid ${C.border}`, flexShrink: 0 }}
      >
        <Icon size={18} style={{ color: C.accent }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: C.hi, fontSize: 14, fontWeight: 700 }}>{label}</div>
        {desc && <div style={{ color: C.lo, fontSize: 11, marginTop: 2, lineHeight: 1.4 }}>{desc}</div>}
      </div>
      {children}
    </div>
  );
}

/**
 * 設定画面（フェーズ4-D）。ヘッダー右上の歯車から開くボトムシート。
 * ナイトモード / 自動インターバルタイマー / バイブレーション / ログアウト / アプリ情報。
 */
export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const C = useC();
  const { autoIntervalTimer, vibration, set } = useSettings();
  const { supabase, signOut } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = !mounted || resolvedTheme !== "light";

  return (
    <FramePortal>
      <div className="absolute inset-0 flex items-end fn-scrim-in" style={{ background: C.scrim, zIndex: 40 }} onClick={onClose}>
        <div
          className="w-full fn-sheet-in"
          style={{
            background: C.bg,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderTop: `1px solid ${C.border}`,
            maxHeight: "88%",
            display: "flex",
            flexDirection: "column",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ヘッダー */}
          <div className="flex items-center justify-between px-5 pt-4 pb-2" style={{ flexShrink: 0 }}>
            <h2 style={{ color: C.hi, fontSize: 17, fontWeight: 800 }}>設定</h2>
            <button onClick={onClose} aria-label="閉じる" style={{ color: C.mid }}>
              <X size={20} />
            </button>
          </div>

          <div className="px-5 pb-6 overflow-y-auto fn-scroll" style={{ flex: 1 }}>
            {/* 表示 */}
            <SectionLabel>表示</SectionLabel>
            <Row Icon={Moon} label="ナイトモード" desc="暗い配色に切り替えます">
              <Toggle on={isDark} onChange={(v) => setTheme(v ? "dark" : "light")} label="ナイトモード" />
            </Row>

            {/* トレーニング */}
            <SectionLabel>トレーニング</SectionLabel>
            <Row Icon={Timer} label="自動インターバルタイマー" desc="セット記録後に休憩タイマーを表示">
              <Toggle on={autoIntervalTimer} onChange={(v) => set("autoIntervalTimer", v)} label="自動インターバルタイマー" />
            </Row>
            <Row Icon={Vibrate} label="バイブレーション" desc="タイマー完了時に振動で知らせます">
              <Toggle on={vibration} onChange={(v) => set("vibration", v)} label="バイブレーション" />
            </Row>

            {/* アカウント（Supabase 接続時のみ） */}
            {supabase && (
              <>
                <SectionLabel>アカウント</SectionLabel>
                <button
                  onClick={() => {
                    signOut();
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 py-3 rounded-xl px-3 mt-1"
                  style={{ background: "rgba(251,113,133,.08)", border: "1px solid rgba(251,113,133,.25)" }}
                >
                  <div
                    className="rounded-xl flex items-center justify-center"
                    style={{ width: 36, height: 36, background: "rgba(251,113,133,.12)", flexShrink: 0 }}
                  >
                    <LogOut size={18} style={{ color: "#fb7185" }} />
                  </div>
                  <span style={{ color: "#fb7185", fontSize: 14, fontWeight: 700 }}>ログアウト</span>
                </button>
              </>
            )}

            {/* アプリについて */}
            <div className="flex flex-col items-center mt-6" style={{ color: C.lo }}>
              <Info size={16} />
              <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6, color: C.mid }}>
                FIT<span style={{ color: C.accent }}>·</span>NOTE
              </div>
              <div style={{ fontSize: 11, marginTop: 2 }}>バージョン {APP_VERSION}</div>
              <div style={{ fontSize: 10, marginTop: 6, textAlign: "center", lineHeight: 1.5 }}>
                AI食事解析 × 極限シンプル筋トレノート
              </div>
            </div>
          </div>
        </div>
      </div>
    </FramePortal>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  const C = useC();
  return (
    <div style={{ color: C.lo, fontSize: 10, fontWeight: 800, letterSpacing: 1.5, marginTop: 16, marginBottom: 2 }}>
      {children}
    </div>
  );
}
