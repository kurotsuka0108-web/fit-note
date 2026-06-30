"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, Images, Loader2, Pencil, SlidersHorizontal, Trash2, Utensils, X } from "lucide-react";
import { useC } from "@/lib/use-tokens";
import { ON_GOLD } from "@/lib/theme";
import { todayYmd } from "@/lib/date";
import { processImage, type ProcessedImage } from "@/lib/image";
import { useMealUsage } from "@/lib/meal-usage";
import { getMealRepo, type Meal, type MealSource, type NewMeal, type Profile, type TargetPFC } from "@/lib/db";
import { FramePortal } from "@/components/screens/note/FramePortal";
import { ProfileSheet } from "./ProfileSheet";

// 確定前/編集中の下書き。id があれば既存編集、null なら新規。
type Draft = {
  id: string | null;
  dish: string;
  kcal: number;
  p: number;
  f: number;
  c: number;
  image: string | null;
  source: MealSource;
  failed: boolean; // 解析失敗→手入力に切替えたか
  note: string; // AI の根拠メモ（表示用。永続化しない）
};

type AnalyzeResult = { dish: string; kcal: number; p: number; f: number; c: number; source?: string; note?: string };

// 自前のサーバールート（route.ts）を呼ぶ。APIキーはサーバー側に隠れる（仕様 §4）。
async function analyzeMeal(processed: ProcessedImage, date: string, hint: string): Promise<AnalyzeResult> {
  const r = await fetch("/api/analyze-meal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64: processed.base64, mediaType: "image/jpeg", date, hint }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error || `APIエラー (${r.status})`);
  return data;
}

export function MealScreen() {
  const C = useC();
  const repo = useMemo(() => getMealRepo(), []);
  const today = useMemo(() => todayYmd(), []);
  const { remaining, refresh: refreshUsage } = useMealUsage();

  const [meals, setMeals] = useState<Meal[]>([]);
  const [target, setTarget] = useState<TargetPFC>({ kcal: 2200, p: 160, f: 60, c: 250 });
  const [status, setStatus] = useState<"idle" | "analyzing" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");
  const [hint, setHint] = useState(""); // ブランド商品の照合精度を上げるユーザーヒント
  const [draft, setDraft] = useState<Draft | null>(null);
  const [picker, setPicker] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null); // カメラ直起動
  const libraryRef = useRef<HTMLInputElement>(null); // アルバム/ファイル選択

  // 初期ロード: 当日の食事・目標 PFC・利用状況・プロフィール
  useEffect(() => {
    repo.getMeals(today).then(setMeals).catch((e) => console.error("[MealScreen]", e));
    repo.getTarget().then(setTarget).catch((e) => console.error("[MealScreen]", e));
    repo.getProfile().then(setProfile).catch((e) => console.error("[MealScreen]", e));
    refreshUsage();
  }, [repo, today, refreshUsage]);

  // プロフィール保存 → 目標PFCをダッシュボードへ即反映
  const saveProfile = async (p: Profile) => {
    await repo.saveProfile(p);
    setProfile(p);
    setTarget(p.target);
  };

  const totals = useMemo(
    () =>
      meals.reduce(
        (a, m) => ({ kcal: a.kcal + m.kcal, p: a.p + m.p, f: a.f + m.f, c: a.c + m.c }),
        { kcal: 0, p: 0, f: 0, c: 0 },
      ),
    [meals],
  );

  const canAnalyze = remaining > 0 && status !== "analyzing";
  const openPicker = () => {
    if (canAnalyze) setPicker(true);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setStatus("analyzing");
    setErrMsg("");
    let dataUrl: string | null = null; // 成功時のみサムネイルに使う
    try {
      const processed = await processImage(file); // createImageBitmap で正規化
      dataUrl = processed.dataUrl;

      const result = await analyzeMeal(processed, today, hint.trim());

      // 解析成功 → 利用回数を加算（local のみ。supabase はサーバーが加算済み）して同期
      await repo.incrementUsage(today);
      await refreshUsage();

      setDraft({
        id: null,
        dish: result.dish || "解析した食事",
        kcal: Number(result.kcal) || 0,
        p: Number(result.p) || 0,
        f: Number(result.f) || 0,
        c: Number(result.c) || 0,
        image: dataUrl,
        source: "ai",
        failed: false,
        note: result.note ?? "",
      });
      setHint(""); // 使い終わったヒントはクリア
      setStatus("idle");
    } catch (err) {
      // 失敗しても（画像があれば添えて）手入力フォームに切り替えて記録は続けられる
      const msg = err instanceof Error ? err.message : "解析に失敗しました";
      setErrMsg(msg);
      setStatus("error");
      await refreshUsage(); // 上限到達などサーバー側の状態を反映
      setDraft({ id: null, dish: hint.trim(), kcal: 0, p: 0, f: 0, c: 0, image: dataUrl, source: "manual", failed: true, note: "" });
      setTimeout(() => setStatus("idle"), 4000);
    }
  };

  const manual = () =>
    setDraft({ id: null, dish: "", kcal: 0, p: 0, f: 0, c: 0, image: null, source: "manual", failed: false, note: "" });

  // 既存の食事をタップ → 編集（値をプリセット）
  const openEdit = (m: Meal) =>
    setDraft({ id: m.id, dish: m.dish, kcal: m.kcal, p: m.p, f: m.f, c: m.c, image: m.image, source: m.source, failed: false, note: "" });

  const save = async () => {
    if (!draft) return;
    const payload: NewMeal = {
      dish: draft.dish.trim() || "名称未設定",
      kcal: draft.kcal,
      p: draft.p,
      f: draft.f,
      c: draft.c,
      image: draft.image,
      source: draft.source,
    };
    try {
      if (draft.id) {
        const updated = await repo.updateMeal(draft.id, payload);
        setMeals((m) => m.map((x) => (x.id === updated.id ? updated : x)));
      } else {
        const created = await repo.addMeal(today, payload);
        setMeals((m) => [created, ...m]);
      }
      setDraft(null);
    } catch (e) {
      console.error("[MealScreen]", e);
      setErrMsg(e instanceof Error ? e.message : "保存に失敗しました");
    }
  };

  const remove = async (id: string) => {
    try {
      await repo.removeMeal(id);
      setMeals((m) => m.filter((x) => x.id !== id));
    } catch (e) {
      console.error("[MealScreen]", e);
    }
  };

  return (
    <div className="px-5 pt-3 pb-2 relative">
      {/* PFC ダッシュボード */}
      <div className="rounded-2xl p-4 mb-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="flex items-baseline justify-between mb-2">
          <button
            onClick={() => setProfileOpen(true)}
            className="flex items-center gap-1"
            aria-label="目標を設定"
            style={{ color: C.mid }}
          >
            <span style={{ fontSize: 12, letterSpacing: 1.5, fontWeight: 700 }}>CALORIES</span>
            <SlidersHorizontal size={12} color={C.accent} />
          </button>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            <span style={{ color: C.accent, fontSize: 22, fontWeight: 800 }}>{totals.kcal.toLocaleString()}</span>
            <span style={{ color: C.mid, fontSize: 13 }}> / {target.kcal.toLocaleString()} kcal</span>
          </span>
        </div>
        <Bar value={totals.kcal} target={target.kcal} color={C.accent} />
        <div className="grid grid-cols-3 gap-3 mt-4">
          {([
            ["P", totals.p, target.p, "#38bdf8"],
            ["F", totals.f, target.f, "#fb7185"],
            ["C", totals.c, target.c, "#a78bfa"],
          ] as const).map(([k, v, t, col]) => (
            <div key={k}>
              <p className="mb-1" style={{ fontSize: 11, color: C.mid, fontVariantNumeric: "tabular-nums" }}>
                <b style={{ color: C.hi }}>{k}</b> {v} / {t}g
              </p>
              <Bar value={v} target={t} color={col} />
            </div>
          ))}
        </div>
      </div>

      {/* ヒント入力（ブランド商品の照合精度を上げる） */}
      <input
        value={hint}
        onChange={(e) => setHint(e.target.value)}
        placeholder="ヒント（任意）: 例 吉野家 牛丼 大盛り / ファミマ サラダチキン"
        className="w-full rounded-xl px-3 mb-2"
        style={{ minHeight: 44, background: C.surface, color: C.hi, fontSize: 13, border: `1px solid ${C.border}`, outline: "none" }}
      />

      {/* SNAP YOUR MEAL（マルチモーダル導線） */}
      <button
        onClick={openPicker}
        disabled={!canAnalyze}
        className="w-full rounded-2xl flex flex-col items-center justify-center mb-3"
        style={{
          minHeight: 130,
          background: C.surface,
          border: `2px dashed ${remaining > 0 ? C.accent : C.border}`,
          opacity: remaining > 0 ? 1 : 0.55,
          cursor: canAnalyze ? "pointer" : "default",
        }}
      >
        {status === "analyzing" ? (
          <>
            <Loader2 size={34} color={C.accent} className="fn-spin" />
            <span style={{ color: C.mid, fontSize: 13, marginTop: 10 }}>AIが解析中…（商品を照合しています）</span>
          </>
        ) : (
          <>
            <Camera size={34} color={remaining > 0 ? C.accent : C.lo} />
            <span style={{ color: C.hi, fontSize: 16, fontWeight: 800, letterSpacing: 2, marginTop: 8 }}>SNAP YOUR MEAL</span>
            <span style={{ color: C.mid, fontSize: 11, marginTop: 4, textAlign: "center" }}>
              {remaining > 0 ? "撮影/アルバムから。コンビニ・外食商品は公式値を照合" : "本日の無料解析を使い切りました"}
            </span>
          </>
        )}
      </button>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onFile} hidden />
      <input ref={libraryRef} type="file" accept="image/*" onChange={onFile} hidden />

      {status === "error" && (
        <p className="mb-2 text-center" style={{ color: "#fb7185", fontSize: 12 }}>
          解析に失敗しました。手入力で記録できます。
        </p>
      )}

      <div className="flex items-center justify-between mb-2">
        <p style={{ color: C.lo, fontSize: 11, letterSpacing: 2, fontWeight: 700 }}>TODAY&apos;S MEALS</p>
        <button onClick={manual} className="flex items-center gap-1" style={{ color: C.accent, fontSize: 12, fontWeight: 700 }}>
          <Pencil size={12} /> 手入力で追加
        </button>
      </div>

      {/* 当日食事タイムライン（タップで編集） */}
      {meals.length === 0 ? (
        <div className="rounded-xl p-6 text-center" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <Utensils size={22} color={C.lo} style={{ margin: "0 auto 8px" }} />
          <p style={{ color: C.mid, fontSize: 13 }}>まだ記録がありません。</p>
          <p style={{ color: C.lo, fontSize: 11, marginTop: 2 }}>写真を撮るか、手入力で追加しましょう。</p>
        </div>
      ) : (
        <div className="space-y-2">
          {meals.map((m) => (
            <div
              key={m.id}
              onClick={() => openEdit(m)}
              className="rounded-xl p-3 flex items-center gap-3"
              style={{ background: C.surface, border: `1px solid ${C.border}`, cursor: "pointer" }}
            >
              <div
                className="rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0"
                style={{ width: 44, height: 44, background: C.tactical }}
              >
                {m.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <Utensils size={18} color={C.mid} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ color: C.hi, fontSize: 14, fontWeight: 700 }} className="truncate">
                  {m.dish}
                  {m.source === "ai" && <span style={{ color: C.accent, fontSize: 10, marginLeft: 6 }}>AI</span>}
                </p>
                <p style={{ color: C.mid, fontSize: 11, fontVariantNumeric: "tabular-nums" }}>
                  P {m.p}g · F {m.f}g · C {m.c}g
                </p>
              </div>
              <span style={{ color: C.accent, fontSize: 14, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                {m.kcal} <span style={{ color: C.mid, fontSize: 10, fontWeight: 500 }}>kcal</span>
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  remove(m.id);
                }}
                aria-label="削除"
                style={{ color: C.lo, flexShrink: 0 }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 取得元の選択シート */}
      {picker && (
        <FramePortal>
          <div
            className="absolute inset-0 flex items-end"
            style={{ background: C.scrim, zIndex: 40 }}
            onClick={() => setPicker(false)}
          >
            <div
              className="w-full rounded-t-3xl p-4"
              style={{ background: C.bg, border: `1px solid ${C.border}` }}
              onClick={(e) => e.stopPropagation()}
            >
              <p style={{ color: C.lo, fontSize: 11, letterSpacing: 1.5, fontWeight: 700 }} className="mb-3 text-center">
                写真を追加
              </p>
              {([
                { Icon: Camera, label: "写真を撮る", ref: cameraRef },
                { Icon: Images, label: "アルバムから選択", ref: libraryRef },
              ] as const).map(({ Icon, label, ref }) => (
                <button
                  key={label}
                  onClick={() => {
                    setPicker(false);
                    ref.current?.click();
                  }}
                  className="w-full rounded-xl flex items-center gap-3 px-4 mb-2"
                  style={{ minHeight: 56, background: C.surface, color: C.hi, fontSize: 15, fontWeight: 700, border: `1px solid ${C.border}` }}
                >
                  <Icon size={20} color={C.accent} /> {label}
                </button>
              ))}
              <button
                onClick={() => setPicker(false)}
                className="w-full rounded-xl mt-1"
                style={{ minHeight: 52, color: C.mid, fontSize: 15, fontWeight: 700 }}
              >
                キャンセル
              </button>
            </div>
          </div>
        </FramePortal>
      )}

      {draft && (
        <DraftSheet draft={draft} setDraft={setDraft} onSave={save} onCancel={() => setDraft(null)} errMsg={errMsg} />
      )}

      {profileOpen && (
        <ProfileSheet initial={profile} onClose={() => setProfileOpen(false)} onSave={saveProfile} />
      )}
    </div>
  );
}

// PFC 進捗バー（プロトタイプの Bar を踏襲）。
function Bar({ value, target, color }: { value: number; target: number; color: string }) {
  const C = useC();
  const pct = Math.min(100, target ? (value / target) * 100 : 0);
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height: 6, background: C.tactical }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width .4s ease", borderRadius: 999 }} />
    </div>
  );
}

// AI 結果プリセット → 手修正 → 確定（仕様 §3.3）。既存編集・手入力のみの登録も兼ねる。
function DraftSheet({
  draft,
  setDraft,
  onSave,
  onCancel,
  errMsg,
}: {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft | null>>;
  onSave: () => void;
  onCancel: () => void;
  errMsg: string;
}) {
  const C = useC();
  const isEdit = draft.id !== null;
  const fields: [keyof Draft, string, string][] = [
    ["kcal", "カロリー", "kcal"],
    ["p", "タンパク質", "g"],
    ["f", "脂質", "g"],
    ["c", "炭水化物", "g"],
  ];
  const setDish = (v: string) => setDraft((d) => (d ? { ...d, dish: v } : d));
  const setNum = (k: keyof Draft, v: string) =>
    setDraft((d) => (d ? { ...d, [k]: Math.max(0, Math.round(Number(v) || 0)) } : d));

  return (
    <FramePortal>
      <div className="absolute inset-0 flex items-end" style={{ background: C.scrim, zIndex: 50 }}>
        <div className="w-full rounded-t-3xl p-5" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between mb-1">
            <h3 style={{ color: C.hi, fontSize: 16, fontWeight: 800 }}>{isEdit ? "記録を編集" : "記録を確定"}</h3>
            <button onClick={onCancel} aria-label="閉じる" style={{ color: C.mid }}>
              <X size={20} />
            </button>
          </div>
          <p style={{ color: draft.failed ? "#fb7185" : draft.source === "ai" ? C.accent : C.mid, fontSize: 11 }} className="mb-2">
            {draft.failed
              ? "AIが画像を読み取れませんでした。手入力で記録してください。"
              : isEdit
                ? "数値を修正して保存できます。"
                : draft.source === "ai"
                  ? `AIの推定値です。間違っていれば修正して確定できます。${draft.note ? `（${draft.note}）` : ""}`
                  : "数値を入力して記録します。"}
          </p>
          {draft.failed && errMsg && (
            <p
              className="mb-3 rounded-md px-2 py-1"
              style={{ color: "#fb7185", fontSize: 11, background: "rgba(251,113,133,.10)", fontFamily: "monospace", wordBreak: "break-all" }}
            >
              理由: {errMsg}
            </p>
          )}

          <label style={{ color: C.lo, fontSize: 10, letterSpacing: 1, fontWeight: 700 }}>料理名</label>
          <input
            value={draft.dish}
            onChange={(e) => setDish(e.target.value)}
            placeholder="例: 鶏胸肉の照り焼き"
            className="w-full rounded-xl px-3 mt-1 mb-4"
            style={{ minHeight: 48, background: C.tactical, color: C.hi, fontSize: 15, border: `1px solid ${C.border}`, outline: "none" }}
          />

          <div className="grid grid-cols-2 gap-3 mb-5">
            {fields.map(([k, label, unit]) => (
              <div key={k}>
                <label style={{ color: C.lo, fontSize: 10, letterSpacing: 1, fontWeight: 700 }}>{label}</label>
                <div className="flex items-center rounded-xl px-3 mt-1" style={{ background: C.tactical, border: `1px solid ${C.border}` }}>
                  <input
                    type="number"
                    inputMode="numeric"
                    // 0 のときは空表示（placeholder の "0"）にして、先頭ゼロ（例: 08）を防ぐ
                    value={(draft[k] as number) === 0 ? "" : (draft[k] as number)}
                    onChange={(e) => setNum(k, e.target.value)}
                    placeholder="0"
                    className="w-full"
                    style={{ minHeight: 48, background: "transparent", color: C.hi, fontSize: 16, fontWeight: 700, outline: "none", fontVariantNumeric: "tabular-nums" }}
                  />
                  <span style={{ color: C.mid, fontSize: 12 }}>{unit}</span>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={onSave}
            className="w-full rounded-xl flex items-center justify-center gap-2"
            style={{ minHeight: 54, background: C.accent, color: ON_GOLD, fontWeight: 800, fontSize: 16 }}
          >
            <Check size={18} /> {isEdit ? "変更を保存" : "この内容で記録"}
          </button>
        </div>
      </div>
    </FramePortal>
  );
}
