"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Minus, Pause, Play, Plus, X } from "lucide-react";
import { useC } from "@/lib/use-tokens";
import { ON_GOLD } from "@/lib/theme";
import { useSettings } from "@/lib/settings";
import { FramePortal } from "./FramePortal";

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

/**
 * 全画面カウントダウンタイマー。
 * - kind="work": 秒数種目の実施タイマー（START から）。完了で実施秒数を記録。
 * - kind="rest": セット間インターバル（休憩）。完了で閉じる。
 * onComplete(elapsedSec) … 自然完了 or スキップ時。elapsed=実施した秒数。
 * onCancel … 中断（記録しない）。
 */
export function TimerOverlay({
  seconds, title, subtitle, kind, onComplete, onCancel,
}: {
  seconds: number;
  title: string;
  subtitle: string;
  kind: "work" | "rest";
  onComplete: (elapsedSec: number) => void;
  onCancel: () => void;
}) {
  const C = useC();
  const { vibration } = useSettings();
  const [total, setTotal] = useState(Math.max(1, seconds));
  const [left, setLeft] = useState(Math.max(1, seconds));
  const [running, setRunning] = useState(true);
  const done = useRef(false);

  const finish = (elapsed: number) => {
    if (done.current) return;
    done.current = true;
    onComplete(Math.max(0, Math.round(elapsed)));
  };

  // 1秒ごとに減算。+/- は left/total を直接動かす。
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setLeft((x) => Math.max(0, x - 1)), 1000);
    return () => clearInterval(id);
  }, [running]);

  // 0 到達で完了（副作用は更新関数の外で1度だけ）。
  useEffect(() => {
    if (left > 0 || done.current) return;
    if (vibration && typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([120, 60, 120]);
    finish(total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  const adjust = (d: number) => {
    setLeft((x) => Math.max(1, x + d));
    setTotal((t) => Math.max(1, t + d));
  };

  const accent = kind === "work" ? C.accent : "#38bdf8"; // 実施=ゴールド / 休憩=ブルー
  const pct = Math.min(1, Math.max(0, 1 - left / total));
  const R = 120;
  const CIRC = 2 * Math.PI * R;

  return (
    <FramePortal>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6"
        style={{ background: C.bg, zIndex: 50 }}>
        <button onClick={onCancel} aria-label="閉じる" className="absolute" style={{ top: 16, right: 16, color: C.mid }}>
          <X size={24} />
        </button>

        <p style={{ color: accent, fontSize: 12, fontWeight: 800, letterSpacing: 3 }}>{subtitle.toUpperCase()}</p>
        <h2 style={{ color: C.hi, fontSize: 20, fontWeight: 800, marginTop: 4, marginBottom: 24, textAlign: "center" }}>{title}</h2>

        <div className="relative flex items-center justify-center" style={{ width: 280, height: 280 }}>
          <svg width="280" height="280" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="140" cy="140" r={R} fill="none" stroke={C.tactical} strokeWidth="14" />
            <circle cx="140" cy="140" r={R} fill="none" stroke={accent} strokeWidth="14" strokeLinecap="round"
              strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - pct)} style={{ transition: "stroke-dashoffset 1s linear" }} />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span style={{ color: C.hi, fontSize: 56, fontWeight: 900, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{mmss(left)}</span>
            <span style={{ color: C.lo, fontSize: 12, fontWeight: 700, marginTop: 6 }}>残り / {mmss(total)}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-8">
          <button onClick={() => adjust(-10)} className="rounded-full flex items-center justify-center"
            style={{ width: 56, height: 56, background: C.tactical, color: C.hi, border: `1px solid ${C.border}`, fontWeight: 800, fontSize: 13 }}>
            <Minus size={16} />10
          </button>
          <button onClick={() => setRunning((r) => !r)} aria-label={running ? "一時停止" : "再開"}
            className="rounded-full flex items-center justify-center"
            style={{ width: 72, height: 72, background: accent, color: kind === "work" ? ON_GOLD : "#06121f" }}>
            {running ? <Pause size={28} /> : <Play size={28} />}
          </button>
          <button onClick={() => adjust(10)} className="rounded-full flex items-center justify-center"
            style={{ width: 56, height: 56, background: C.tactical, color: C.hi, border: `1px solid ${C.border}`, fontWeight: 800, fontSize: 13 }}>
            <Plus size={16} />10
          </button>
        </div>

        <div className="flex gap-2 mt-8 w-full" style={{ maxWidth: 320 }}>
          <button onClick={onCancel} className="rounded-xl px-4"
            style={{ minHeight: 52, background: C.tactical, color: C.mid, fontWeight: 700, fontSize: 14, border: `1px solid ${C.border}`, flexShrink: 0 }}>
            やめる
          </button>
          <button onClick={() => finish(total - left)}
            className="flex-1 rounded-xl flex items-center justify-center gap-2"
            style={{ minHeight: 52, background: accent, color: kind === "work" ? ON_GOLD : "#06121f", fontWeight: 800, fontSize: 15 }}>
            <Check size={18} /> {kind === "work" ? "完了して記録" : "スキップ"}
          </button>
        </div>
      </div>
    </FramePortal>
  );
}
