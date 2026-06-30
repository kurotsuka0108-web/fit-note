"use client";

import { useState } from "react";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useC } from "@/lib/use-tokens";
import { ON_GOLD } from "@/lib/theme";
import { FramePortal } from "@/components/screens/note/FramePortal";
import type { ActivityLevel, Goal, Profile, Sex } from "@/lib/db";

// 身体情報 → AIが目標PFCを算出 → 保存（仕様 §3.3 / §5、フェーズ2後半）。
const DEFAULT: Profile = {
  height: null, weight: null, age: null, sex: null, activityLevel: null, goal: null,
  target: { kcal: 2200, p: 160, f: 60, c: 250 },
};

const SEX: { v: Sex; label: string }[] = [
  { v: "male", label: "男性" },
  { v: "female", label: "女性" },
];
const ACTIVITY: { v: ActivityLevel; label: string; sub: string }[] = [
  { v: "low", label: "低い", sub: "デスクワーク中心" },
  { v: "mid", label: "ふつう", sub: "週1〜3運動" },
  { v: "high", label: "高い", sub: "週4以上・肉体労働" },
];
const GOAL: { v: Goal; label: string }[] = [
  { v: "減量", label: "減量" },
  { v: "維持", label: "維持" },
  { v: "増量", label: "増量" },
];

export function ProfileSheet({
  initial,
  onClose,
  onSave,
}: {
  initial: Profile | null;
  onClose: () => void;
  onSave: (p: Profile) => Promise<void>;
}) {
  const C = useC();
  const [p, setP] = useState<Profile>(initial ?? DEFAULT);
  const [computing, setComputing] = useState(false);
  const [computed, setComputed] = useState(Boolean(initial?.sex)); // 既存プロフィールなら目標を表示
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const setNum = (k: "height" | "weight" | "age", v: string) =>
    setP((x) => ({ ...x, [k]: v === "" ? null : Math.max(0, Math.round(Number(v) || 0)) }));

  const compute = async () => {
    if (!p.height || !p.weight || !p.age || !p.sex || !p.activityLevel || !p.goal) {
      setErr("身長・体重・年齢・性別・活動量・目標をすべて入力してください。");
      return;
    }
    setErr("");
    setComputing(true);
    try {
      const r = await fetch("/api/compute-targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ height: p.height, weight: p.weight, age: p.age, sex: p.sex, activityLevel: p.activityLevel, goal: p.goal }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "算出に失敗しました");
      setP((x) => ({ ...x, target: { kcal: data.kcal, p: data.p, f: data.f, c: data.c } }));
      setComputed(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "算出に失敗しました");
    } finally {
      setComputing(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setErr("");
    try {
      await onSave(p);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "保存に失敗しました");
      setSaving(false);
    }
  };

  const numField = {
    minHeight: 46, background: C.tactical, color: C.hi, fontSize: 16, fontWeight: 700,
    border: `1px solid ${C.border}`, outline: "none", textAlign: "center" as const, fontVariantNumeric: "tabular-nums" as const,
  };
  const seg = (on: boolean) => ({
    flex: 1, minHeight: 42, borderRadius: 10, fontSize: 13, fontWeight: 700,
    background: on ? C.accent : C.tactical, color: on ? ON_GOLD : C.mid,
    border: `1px solid ${on ? C.accent : C.border}`,
  });

  return (
    <FramePortal>
      <div className="absolute inset-0 flex items-end" style={{ background: C.scrim, zIndex: 50 }}>
        <div className="w-full rounded-t-3xl p-5 overflow-y-auto fn-scroll" style={{ background: C.bg, border: `1px solid ${C.border}`, maxHeight: "92%" }}>
          <div className="flex items-center justify-between mb-1">
            <h3 style={{ color: C.hi, fontSize: 16, fontWeight: 800 }}>目標を設定（AI算出）</h3>
            <button onClick={onClose} aria-label="閉じる" style={{ color: C.mid }}>
              <X size={20} />
            </button>
          </div>
          <p style={{ color: C.mid, fontSize: 11 }} className="mb-4">
            身体情報からAIが1日の目標カロリー・PFCを算出します。
          </p>

          {/* 身長・体重・年齢 */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {([
              ["height", "身長", "cm"],
              ["weight", "体重", "kg"],
              ["age", "年齢", "歳"],
            ] as const).map(([k, label, unit]) => (
              <div key={k}>
                <label style={{ color: C.lo, fontSize: 10, letterSpacing: 1, fontWeight: 700 }}>{label}（{unit}）</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={p[k] ?? ""}
                  onChange={(e) => setNum(k, e.target.value)}
                  placeholder="-"
                  className="w-full rounded-xl px-2 mt-1"
                  style={numField}
                />
              </div>
            ))}
          </div>

          {/* 性別 */}
          <label style={{ color: C.lo, fontSize: 10, letterSpacing: 1, fontWeight: 700 }}>性別</label>
          <div className="flex gap-2 mt-1 mb-4">
            {SEX.map((s) => (
              <button key={s.v} onClick={() => setP((x) => ({ ...x, sex: s.v }))} style={seg(p.sex === s.v)}>
                {s.label}
              </button>
            ))}
          </div>

          {/* 活動量 */}
          <label style={{ color: C.lo, fontSize: 10, letterSpacing: 1, fontWeight: 700 }}>活動量</label>
          <div className="flex gap-2 mt-1 mb-4">
            {ACTIVITY.map((a) => {
              const on = p.activityLevel === a.v;
              return (
                <button key={a.v} onClick={() => setP((x) => ({ ...x, activityLevel: a.v }))} className="flex flex-col items-center justify-center py-1" style={seg(on)}>
                  <span>{a.label}</span>
                  <span style={{ fontSize: 9, fontWeight: 500, color: on ? ON_GOLD : C.lo, marginTop: 1 }}>{a.sub}</span>
                </button>
              );
            })}
          </div>

          {/* 目標 */}
          <label style={{ color: C.lo, fontSize: 10, letterSpacing: 1, fontWeight: 700 }}>目標</label>
          <div className="flex gap-2 mt-1 mb-4">
            {GOAL.map((g) => (
              <button key={g.v} onClick={() => setP((x) => ({ ...x, goal: g.v }))} style={seg(p.goal === g.v)}>
                {g.label}
              </button>
            ))}
          </div>

          {err && (
            <p className="mb-3 rounded-md px-3 py-2" style={{ fontSize: 12, color: "#fb7185", background: "rgba(251,113,133,.10)" }}>
              {err}
            </p>
          )}

          {/* AI算出ボタン */}
          <button
            onClick={compute}
            disabled={computing}
            className="w-full rounded-xl flex items-center justify-center gap-2 mb-4"
            style={{ minHeight: 50, background: C.surfaceHi, color: C.accent, fontWeight: 800, fontSize: 15, border: `1px solid ${C.border}`, opacity: computing ? 0.6 : 1 }}
          >
            {computing ? <Loader2 size={17} className="fn-spin" /> : <Sparkles size={17} />}
            {computing ? "AIが算出中…" : "AIで目標を計算"}
          </button>

          {/* 算出結果（目標PFC） */}
          {computed && (
            <div className="rounded-2xl p-4 mb-4" style={{ background: C.surface, border: `1px solid ${C.accent}` }}>
              <p style={{ color: C.lo, fontSize: 10, letterSpacing: 1, fontWeight: 700 }} className="mb-2">算出された1日の目標</p>
              <div className="flex items-baseline gap-1 mb-2">
                <span style={{ color: C.accent, fontSize: 24, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{p.target.kcal.toLocaleString()}</span>
                <span style={{ color: C.mid, fontSize: 13 }}>kcal</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {([["P", p.target.p, "#38bdf8"], ["F", p.target.f, "#fb7185"], ["C", p.target.c, "#a78bfa"]] as const).map(([k, v, col]) => (
                  <div key={k} className="rounded-lg px-2 py-1" style={{ background: C.tactical }}>
                    <span style={{ color: col, fontSize: 11, fontWeight: 800 }}>{k}</span>
                    <span style={{ color: C.hi, fontSize: 14, fontWeight: 700, marginLeft: 4, fontVariantNumeric: "tabular-nums" }}>{v}g</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={save}
            disabled={saving}
            className="w-full rounded-xl flex items-center justify-center gap-2"
            style={{ minHeight: 54, background: C.accent, color: ON_GOLD, fontWeight: 800, fontSize: 16, opacity: saving ? 0.6 : 1 }}
          >
            <Check size={18} /> {computed ? "この目標で保存" : "保存"}
          </button>
        </div>
      </div>
    </FramePortal>
  );
}
