import React, { useState, useRef, useEffect, useCallback, useMemo, useContext } from "react";
import {
  Dumbbell, Utensils, BarChart3, Trash2, Minus, Plus,
  Camera, Check, X, Loader2, Lock, Pencil, Signal, Images, Sun, Moon,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Design tokens — ブリーフ定義に準拠。dark / light の2テーマを用意。      */
/* ブランドのゴールド(#EAB308)は両テーマ共通でアイデンティティを保つ。    */
/* ------------------------------------------------------------------ */
const THEMES = {
  dark: {
    page: "#05070C", bg: "#090D16", surface: "#0F172A", surfaceHi: "#111c33",
    accent: "#EAB308", tactical: "#1E293B", border: "#1E293B",
    hi: "#F1F5F9", mid: "#94A3B8", lo: "#5B6B82",
    scrim: "rgba(0,0,0,.6)", frame: "#0c1424", shadow: "0 30px 80px rgba(0,0,0,.6)",
  },
  light: {
    page: "#DBE2EA", bg: "#F4F6FB", surface: "#FFFFFF", surfaceHi: "#EEF2F7",
    accent: "#EAB308", tactical: "#EEF2F7", border: "#E2E8F0",
    hi: "#0F172A", mid: "#475569", lo: "#94A3B8",
    scrim: "rgba(15,23,42,.4)", frame: "#D5DCE6", shadow: "0 30px 80px rgba(15,23,42,.18)",
  },
};
const ON_GOLD = "#1a1303"; // ゴールド上の濃色テキスト（両テーマ共通）

const ThemeCtx = React.createContext(THEMES.dark);
const useC = () => useContext(ThemeCtx);

const TARGET = { kcal: 2200, p: 160, f: 60, c: 250 };

/* ------------------------------------------------------------------ */
/* 長押し追従フック — onPointerDown/Up で touch・mouse 両対応、加速増減   */
/* ------------------------------------------------------------------ */
function useHold(onStep) {
  const cb = useRef(onStep);
  useEffect(() => {
    cb.current = onStep;
  }, [onStep]);
  const t = useRef(null);
  const iv = useRef(null);

  const stop = useCallback(() => {
    clearTimeout(t.current);
    clearInterval(iv.current);
    t.current = null;
    iv.current = null;
  }, []);

  const start = useCallback((e) => {
    e.preventDefault();
    cb.current();
    t.current = setTimeout(() => {
      iv.current = setInterval(() => cb.current(), 70);
    }, 350);
  }, []);

  useEffect(() => stop, [stop]);

  return {
    onPointerDown: start,
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onContextMenu: (e) => e.preventDefault(),
    style: { touchAction: "none", userSelect: "none", WebkitUserSelect: "none" },
  };
}

/* ------------------------------------------------------------------ */
/* Tactical Counter — 縦64pxの巨大タップターゲット                       */
/* ------------------------------------------------------------------ */
function Counter({ value, unit, onStep, onSet }) {
  const C = useC();
  const dec = useHold(() => onStep(-1));
  const inc = useHold(() => onStep(1));
  const [editing, setEditing] = useState(false);
  const [tmp, setTmp] = useState("");
  const btn = {
    width: 64, minHeight: 64,
    color: C.accent, display: "flex", alignItems: "center", justifyContent: "center",
    background: "transparent", cursor: "pointer", flexShrink: 0,
  };
  const startEdit = () => { setTmp(String(value)); setEditing(true); };
  const commit = () => {
    const n = parseFloat(tmp);
    if (onSet && Number.isFinite(n)) onSet(Math.max(0, n));
    setEditing(false);
  };
  return (
    <div className="flex items-stretch rounded-2xl overflow-hidden"
      style={{ background: C.tactical, border: `1px solid ${C.border}` }}>
      <button aria-label="減らす" {...dec} style={btn}><Minus size={26} /></button>
      <div className="flex-1 flex flex-col items-center justify-center py-2 leading-none">
        {editing ? (
          <input
            autoFocus type="number" inputMode="decimal" value={tmp}
            onChange={(e) => setTmp(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            className="w-full text-center"
            style={{ background: "transparent", color: C.accent, fontSize: 30, fontWeight: 800, outline: "none", fontVariantNumeric: "tabular-nums" }}
          />
        ) : (
          <button onClick={startEdit} aria-label={`${unit}を直接入力`} style={{ background: "transparent", cursor: "text" }}>
            <span style={{ color: C.hi, fontSize: 30, fontWeight: 800, fontVariantNumeric: "tabular-nums", borderBottom: `1px dashed ${C.lo}`, paddingBottom: 1 }}>
              {value}
              <span style={{ color: C.mid, fontSize: 14, fontWeight: 600, marginLeft: 4 }}>{unit}</span>
            </span>
          </button>
        )}
      </div>
      <button aria-label="増やす" {...inc} style={btn}><Plus size={26} /></button>
    </div>
  );
}

function Bar({ value, target, color }) {
  const C = useC();
  const pct = Math.min(100, target ? (value / target) * 100 : 0);
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height: 6, background: C.tactical }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width .4s ease", borderRadius: 999 }} />
    </div>
  );
}

/* ================================================================== */
/* 画面①: 筋トレノート                                                 */
/* ================================================================== */
const BODY_PARTS = ["胸", "背中", "肩", "腕", "脚", "体幹"];

// 部位別の種目テンプレ。ユーザーが手入力した種目もここに追記され保存される。
const EXERCISE_LIBRARY_SEED = {
  "胸": ["ベンチプレス", "ダンベルプレス", "インクラインプレス", "チェストフライ", "ディップス"],
  "背中": ["デッドリフト", "ラットプルダウン", "ベントオーバーロウ", "懸垂", "シーテッドロウ"],
  "肩": ["ショルダープレス", "サイドレイズ", "フロントレイズ", "リアレイズ"],
  "腕": ["バーベルカール", "ダンベルカール", "トライセプスプレスダウン", "ハンマーカール"],
  "脚": ["スクワット", "レッグプレス", "レッグエクステンション", "レッグカール", "カーフレイズ"],
  "体幹": ["プランク", "クランチ", "レッグレイズ", "アブローラー"],
};

function NoteScreen() {
  const C = useC();
  const days = [
    { d: "月", n: 7 }, { d: "火", n: 8 }, { d: "水", n: 9 },
    { d: "木", n: 10 }, { d: "金", n: 11 }, { d: "土", n: 12 },
  ];
  const [active, setActive] = useState(9);
  // library は本番では Supabase のユーザー種目テーブルに保存（ここではセッション内保持）
  const [library, setLibrary] = useState(EXERCISE_LIBRARY_SEED);
  const [logs, setLogs] = useState([
    {
      id: 1, name: "ベンチプレス", part: "胸", weight: 82.5, reps: 10,
      sets: [
        { id: "s1", weight: 82.5, reps: 10 },
        { id: "s2", weight: 82.5, reps: 9 },
      ],
      last: { w: 80, r: 10, s: 3 },
    },
  ]);
  const [adding, setAdding] = useState(false);

  const round1 = (n) => Math.round(n * 10) / 10;
  const patch = (id, p) =>
    setLogs((ls) => ls.map((l) => (l.id === id ? { ...l, ...(typeof p === "function" ? p(l) : p) } : l)));

  const stepW = (id, dir) => patch(id, (l) => ({ weight: Math.max(0, round1(l.weight + dir * 2.5)) }));
  const setW = (id, v) => patch(id, { weight: round1(Math.max(0, v)) });
  const stepR = (id, dir) => patch(id, (l) => ({ reps: Math.max(0, l.reps + dir) }));
  const setR = (id, v) => patch(id, { reps: Math.max(0, Math.round(v)) });
  const completeSet = (id) =>
    patch(id, (l) => ({ sets: [...l.sets, { id: `${Date.now()}-${Math.random()}`, weight: l.weight, reps: l.reps }] }));
  const removeSet = (id, setId) => patch(id, (l) => ({ sets: l.sets.filter((s) => s.id !== setId) }));
  const presetLast = (id) => patch(id, (l) => (l.last ? { weight: l.last.w, reps: l.last.r } : {}));
  const removeLog = (id) => setLogs((ls) => ls.filter((l) => l.id !== id));

  const addToday = (name, part) => {
    setLogs((ls) => [...ls, { id: Date.now() + Math.random(), name, part, weight: 20, reps: 10, sets: [], last: null }]);
    setAdding(false);
  };
  const addCustom = (part, name) => {
    setLibrary((lib) => {
      const list = lib[part] || [];
      return list.includes(name) ? lib : { ...lib, [part]: [...list, name] };
    });
    addToday(name, part);
  };

  const todayNames = logs.map((l) => l.name);

  return (
    <div className="px-5 pt-3 pb-2 relative">
      <div className="flex justify-between mb-5">
        {days.map((day) => {
          const on = day.n === active;
          return (
            <button key={day.n} onClick={() => setActive(day.n)}
              className="flex flex-col items-center rounded-xl py-2"
              style={{
                width: 44,
                background: on ? C.accent : "transparent",
                color: on ? ON_GOLD : C.mid,
                fontWeight: on ? 800 : 600,
                border: on ? "none" : `1px solid ${C.border}`,
              }}>
              <span style={{ fontSize: 11 }}>{day.d}</span>
              <span style={{ fontSize: 15 }}>{day.n}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between mb-3">
        <p style={{ color: C.lo, fontSize: 11, letterSpacing: 2, fontWeight: 700 }}>TODAY&apos;S LOG</p>
        <span style={{ color: C.lo, fontSize: 11 }}>{logs.length}種目</span>
      </div>

      <div className="space-y-3">
        {logs.map((l, i) => (
          <ExerciseCard
            key={l.id} index={i + 1} log={l}
            onStepW={(d) => stepW(l.id, d)} onSetW={(v) => setW(l.id, v)}
            onStepR={(d) => stepR(l.id, d)} onSetR={(v) => setR(l.id, v)}
            onComplete={() => completeSet(l.id)} onRemoveSet={(sid) => removeSet(l.id, sid)}
            onPreset={() => presetLast(l.id)} onRemove={() => removeLog(l.id)}
          />
        ))}
        {logs.length === 0 && (
          <div className="rounded-2xl p-6 text-center" style={{ background: C.surface, border: `1px dashed ${C.border}` }}>
            <p style={{ color: C.mid, fontSize: 13, lineHeight: 1.7 }}>まだ種目がありません。<br />下のボタンから追加しましょう。</p>
          </div>
        )}
      </div>

      <button onClick={() => setAdding(true)}
        className="w-full rounded-xl flex items-center justify-center gap-2 mt-3"
        style={{ minHeight: 56, background: C.tactical, color: C.accent, fontWeight: 800, fontSize: 16, border: `1px solid ${C.border}` }}>
        <Plus size={20} /> 種目を追加
      </button>

      {adding && (
        <AddExerciseSheet
          library={library} todayNames={todayNames}
          onPick={addToday} onAddCustom={addCustom} onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}

function ExerciseCard({ index, log, onStepW, onSetW, onStepR, onSetR, onComplete, onRemoveSet, onPreset, onRemove }) {
  const C = useC();
  const scrollRef = useRef(null);
  const nextSet = log.sets.length + 1;

  // セット完了時、横スクロールを末尾（最新セット）まで移動
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
  }, [log.sets.length]);

  return (
    <div className="rounded-2xl p-4" style={{ background: C.surface, borderLeft: `3px solid ${C.accent}`, border: `1px solid ${C.border}` }}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <span className="rounded px-1.5 py-0.5" style={{ background: C.tactical, color: C.accent, fontSize: 10, fontWeight: 800, letterSpacing: 1 }}>{log.part}</span>
          <h3 style={{ color: C.hi, fontSize: 18, fontWeight: 800, marginTop: 5 }}>{index}. {log.name}</h3>
        </div>
        <button onClick={onRemove} className="flex items-center gap-1" style={{ color: C.lo, fontSize: 12 }}>
          <Trash2 size={13} /> 削除
        </button>
      </div>

      {log.last && (
        <>
          <p style={{ color: C.mid, fontSize: 12 }} className="mb-1">
            前回実績: {log.last.w}kg × {log.last.r}reps × {log.last.s}sets
          </p>
          <button onClick={onPreset} className="mb-3 rounded-md px-2 py-1"
            style={{ color: C.accent, fontSize: 11, fontWeight: 700, background: "rgba(234,179,8,.10)" }}>
            ↺ 前回と同じ値をプリセット
          </button>
        </>
      )}

      {/* 記録済みセット（横並び・完了でスライドイン） */}
      <div className="flex items-center justify-between mb-2">
        <p style={{ color: C.lo, fontSize: 10, letterSpacing: 1.5, fontWeight: 700 }}>SETS</p>
        <span style={{ color: C.lo, fontSize: 11 }}>{log.sets.length}セット完了</span>
      </div>
      <div ref={scrollRef} className="flex gap-2 overflow-x-auto fn-scroll pb-1 mb-4" style={{ scrollBehavior: "smooth" }}>
        {log.sets.length === 0 && (
          <div className="rounded-xl px-3 flex items-center" style={{ minHeight: 56, border: `1px dashed ${C.border}`, color: C.lo, fontSize: 11 }}>
            セットを記録するとここに横並びで追加されます
          </div>
        )}
        {log.sets.map((s, i) => (
          <div key={s.id} className="fn-set-in flex-shrink-0 rounded-xl px-3 flex items-center gap-2"
            style={{ minHeight: 56, minWidth: 104, background: C.tactical, border: `1px solid ${C.border}` }}>
            <div>
              <p style={{ color: C.lo, fontSize: 9, fontWeight: 800, letterSpacing: 1 }}>SET {i + 1}</p>
              <p style={{ color: C.hi, fontSize: 14, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                {s.weight}<span style={{ color: C.mid, fontSize: 10 }}>kg</span> × {s.reps}
              </p>
            </div>
            <button onClick={() => onRemoveSet(s.id)} aria-label="セット削除" style={{ color: C.lo, marginLeft: "auto" }}>
              <X size={13} />
            </button>
          </div>
        ))}
      </div>

      {/* 記録中（次セット）の入力 */}
      <div className="flex items-center justify-between mb-1 ml-1">
        <p style={{ color: C.accent, fontSize: 10, letterSpacing: 1.5, fontWeight: 800 }}>SET {nextSet} を記録中</p>
        <span style={{ color: C.lo, fontSize: 9 }}>数字をタップで直接入力</span>
      </div>
      <div className="space-y-3 mb-4">
        <div>
          <p style={{ color: C.lo, fontSize: 10, letterSpacing: 1.5, fontWeight: 700 }} className="mb-1 ml-1">WEIGHT</p>
          <Counter value={log.weight} unit="kg" onStep={onStepW} onSet={onSetW} />
        </div>
        <div>
          <p style={{ color: C.lo, fontSize: 10, letterSpacing: 1.5, fontWeight: 700 }} className="mb-1 ml-1">REPS</p>
          <Counter value={log.reps} unit="reps" onStep={onStepR} onSet={onSetR} />
        </div>
      </div>

      <button onClick={onComplete}
        className="w-full rounded-xl flex items-center justify-center gap-2"
        style={{ minHeight: 56, background: C.accent, color: ON_GOLD, fontWeight: 800, fontSize: 16, cursor: "pointer" }}>
        <Check size={18} /> SET {nextSet} 完了
      </button>
    </div>
  );
}

function AddExerciseSheet({ library, todayNames, onPick, onAddCustom, onClose }) {
  const C = useC();
  const [mode, setMode] = useState("browse"); // browse | custom
  const [part, setPart] = useState(BODY_PARTS[0]);
  const [name, setName] = useState("");

  const submit = () => {
    const n = name.trim();
    if (n) onAddCustom(part, n);
  };

  return (
    <div className="absolute inset-0 flex items-end" style={{ background: C.scrim, zIndex: 30 }} onClick={onClose}>
      <div className="w-full rounded-t-3xl flex flex-col" style={{ background: C.bg, border: `1px solid ${C.border}`, maxHeight: "82%" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3" style={{ flexShrink: 0 }}>
          <h3 style={{ color: C.hi, fontSize: 16, fontWeight: 800 }}>{mode === "browse" ? "種目を追加" : "オリジナル種目"}</h3>
          <button onClick={onClose} style={{ color: C.mid }}><X size={20} /></button>
        </div>

        {mode === "browse" ? (
          <>
            <div className="overflow-y-auto px-5 fn-scroll" style={{ flex: 1 }}>
              {BODY_PARTS.map((bp) => (
                <div key={bp} className="mb-4">
                  <p style={{ color: C.accent, fontSize: 12, fontWeight: 800, letterSpacing: 1 }} className="mb-2">{bp}</p>
                  <div className="flex flex-wrap gap-2">
                    {(library[bp] || []).map((ex) => {
                      const added = todayNames.includes(ex);
                      return (
                        <button key={ex} onClick={() => onPick(ex, bp)}
                          className="rounded-full px-3 flex items-center gap-1"
                          style={{ minHeight: 40, background: C.tactical, color: C.hi, fontSize: 13, fontWeight: 600, border: `1px solid ${added ? C.accent : C.border}` }}>
                          {added && <Check size={13} color={C.accent} />}{ex}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4" style={{ flexShrink: 0, borderTop: `1px solid ${C.border}` }}>
              <button onClick={() => setMode("custom")}
                className="w-full rounded-xl flex items-center justify-center gap-2"
                style={{ minHeight: 52, background: "transparent", color: C.accent, fontWeight: 800, fontSize: 15, border: `1px dashed ${C.accent}` }}>
                <Plus size={18} /> オリジナル種目を追加
              </button>
            </div>
          </>
        ) : (
          <div className="px-5 pb-5" style={{ overflowY: "auto" }}>
            <p style={{ color: C.lo, fontSize: 10, letterSpacing: 1, fontWeight: 700 }} className="mb-2">部位</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {BODY_PARTS.map((bp) => {
                const on = bp === part;
                return (
                  <button key={bp} onClick={() => setPart(bp)} className="rounded-full px-4"
                    style={{ minHeight: 40, background: on ? C.accent : C.tactical, color: on ? ON_GOLD : C.mid, fontSize: 13, fontWeight: 700, border: on ? "none" : `1px solid ${C.border}` }}>
                    {bp}
                  </button>
                );
              })}
            </div>
            <p style={{ color: C.lo, fontSize: 10, letterSpacing: 1, fontWeight: 700 }} className="mb-2">種目名</p>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例: インクラインダンベルカール"
              className="w-full rounded-xl px-3 mb-2"
              style={{ minHeight: 48, background: C.tactical, color: C.hi, fontSize: 15, border: `1px solid ${C.border}`, outline: "none" }} />
            <p style={{ color: C.lo, fontSize: 11 }} className="mb-4">
              追加すると<b style={{ color: C.mid }}>ライブラリに保存</b>され、次回から「{part}」のリストから選べます。
            </p>
            <div className="flex gap-2">
              <button onClick={() => setMode("browse")} className="rounded-xl px-4"
                style={{ minHeight: 52, background: C.tactical, color: C.mid, fontWeight: 700, fontSize: 15 }}>戻る</button>
              <button onClick={submit} disabled={!name.trim()}
                className="flex-1 rounded-xl flex items-center justify-center gap-2"
                style={{ minHeight: 52, background: name.trim() ? C.accent : C.tactical, color: name.trim() ? ON_GOLD : C.mid, fontWeight: 800, fontSize: 15 }}>
                <Plus size={18} /> 追加して記録
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/* 画面②: AI食事管理ダッシュボード                                      */
/* ================================================================== */
const SEED = [
  { id: 1, dish: "目玉焼き & ブロッコリー", kcal: 220, p: 18, f: 12, c: 4, ai: false, img: null },
  { id: 2, dish: "鶏胸肉の照り焼き弁当", kcal: 580, p: 45, f: 8, c: 72, ai: true, img: null },
];

// 画像を JPEG(最大1024px) に変換。createImageBitmap で File を直接デコードし、
// <img>+blobURL に依存しない（サンドボックス制限を回避）。
// 返り値: { base64, dataUrl }（dataUrl はサムネイル表示にも流用）
async function processImage(file, maxDim = 1024, quality = 0.85) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("画像をデコードできませんでした（HEIC等の可能性）");
  }
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
  if (bitmap.close) bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  return { base64: dataUrl.split(",")[1], dataUrl };
}

// ─────────────────────────────────────────────────────────────
// プレビュー用デモモード。
// このプレビューのサンドボックスは画像をAIへ送れないため、true の間は
// サンプル値を返してUXフローを最後まで確認できるようにする。
// 本番（自前サーバー）では false にして /api/analyze-meal を呼ぶ。
const DEMO_MODE = true;

const DEMO_SAMPLES = [
  { dish: "サーモンとアボカドのサラダ", kcal: 380, p: 24, f: 26, c: 12 },
  { dish: "鶏胸肉とブロッコリーのプレート", kcal: 420, p: 48, f: 9, c: 35 },
  { dish: "牛丼", kcal: 650, p: 22, f: 21, c: 92 },
  { dish: "卵かけご飯と味噌汁", kcal: 410, p: 16, f: 9, c: 68 },
  { dish: "ツナと野菜のパスタ", kcal: 560, p: 26, f: 18, c: 74 },
  { dish: "プロテインオートミール", kcal: 330, p: 30, f: 7, c: 40 },
];

// 解析を実行して { dish, kcal, p, f, c } を返す。
async function analyzeMeal(processed) {
  if (DEMO_MODE) {
    const pick = DEMO_SAMPLES[Math.floor(Math.random() * DEMO_SAMPLES.length)];
    await new Promise((r) => setTimeout(r, 1200)); // 解析中スピナーを見せる
    return pick;
  }
  // 本番: 自前のサーバールート（route.ts）を呼ぶ。キーはサーバー側に隠れる。
  const r = await fetch("/api/analyze-meal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64: processed.base64, mediaType: "image/jpeg" }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error || `APIエラー (${r.status})`);
  return data;
}

function MealScreen() {
  const C = useC();
  const [meals, setMeals] = useState(SEED);
  const [credits, setCredits] = useState(3);
  const [status, setStatus] = useState("idle"); // idle | analyzing | error
  const [errMsg, setErrMsg] = useState("");
  const [draft, setDraft] = useState(null);
  const [picker, setPicker] = useState(false);   // 写真の取得元を選ぶシート
  const cameraRef = useRef(null);                 // カメラ直起動
  const libraryRef = useRef(null);                // アルバム/ファイル選択

  const totals = useMemo(() => meals.reduce(
    (a, m) => ({ kcal: a.kcal + m.kcal, p: a.p + m.p, f: a.f + m.f, c: a.c + m.c }),
    { kcal: 0, p: 0, f: 0, c: 0 }
  ), [meals]);

  const openPicker = () => { if (credits > 0 && status !== "analyzing") setPicker(true); };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setStatus("analyzing");
    setErrMsg("");
    let dataUrl = null; // サムネイル用（処理に成功した場合のみ）
    try {
      const processed = await processImage(file); // createImageBitmap で正規化
      dataUrl = processed.dataUrl;

      const result = await analyzeMeal(processed); // デモ or 本番ルート

      setCredits((n) => n - 1);
      setDraft({
        dish: result.dish || "解析した食事",
        kcal: Number(result.kcal) || 0,
        p: Number(result.p) || 0, f: Number(result.f) || 0, c: Number(result.c) || 0,
        ai: true, demo: DEMO_MODE, failed: false, img: dataUrl,
      });
      setStatus("idle");
    } catch (err) {
      // 失敗しても（画像があれば添えて）手入力フォームに切り替えて記録は続けられる
      setErrMsg(err?.message || "解析に失敗しました");
      setStatus("error");
      setDraft({ dish: "", kcal: 0, p: 0, f: 0, c: 0, ai: false, failed: true, img: dataUrl });
      setTimeout(() => setStatus("idle"), 4000);
    }
  };

  const manual = () => setDraft({ dish: "", kcal: 0, p: 0, f: 0, c: 0, ai: false, failed: false, img: null });
  const save = () => { setMeals((m) => [{ ...draft, id: Date.now() }, ...m]); setDraft(null); };

  return (
    <div className="px-5 pt-3 pb-2 relative">
      <div className="rounded-2xl p-4 mb-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="flex items-baseline justify-between mb-2">
          <span style={{ color: C.mid, fontSize: 12, letterSpacing: 1.5, fontWeight: 700 }}>CALORIES</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            <span style={{ color: C.accent, fontSize: 22, fontWeight: 800 }}>{totals.kcal.toLocaleString()}</span>
            <span style={{ color: C.mid, fontSize: 13 }}> / {TARGET.kcal.toLocaleString()} kcal</span>
          </span>
        </div>
        <Bar value={totals.kcal} target={TARGET.kcal} color={C.accent} />
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[
            ["P", totals.p, TARGET.p, "#38bdf8"],
            ["F", totals.f, TARGET.f, "#fb7185"],
            ["C", totals.c, TARGET.c, "#a78bfa"],
          ].map(([k, v, t, col]) => (
            <div key={k}>
              <p className="mb-1" style={{ fontSize: 11, color: C.mid, fontVariantNumeric: "tabular-nums" }}>
                <b style={{ color: C.hi }}>{k}</b> {v} / {t}g
              </p>
              <Bar value={v} target={t} color={col} />
            </div>
          ))}
        </div>
      </div>

      <button onClick={openPicker} disabled={status === "analyzing"}
        className="w-full rounded-2xl flex flex-col items-center justify-center mb-3"
        style={{
          minHeight: 130, background: C.surface,
          border: `2px dashed ${credits > 0 ? C.accent : C.border}`,
          opacity: credits > 0 ? 1 : 0.55,
          cursor: credits > 0 && status !== "analyzing" ? "pointer" : "default",
        }}>
        {status === "analyzing" ? (
          <>
            <Loader2 size={34} color={C.accent} className="fn-spin" />
            <span style={{ color: C.mid, fontSize: 13, marginTop: 10 }}>AIが解析中…</span>
          </>
        ) : (
          <>
            <Camera size={34} color={credits > 0 ? C.accent : C.lo} />
            <span style={{ color: C.hi, fontSize: 16, fontWeight: 800, letterSpacing: 2, marginTop: 8 }}>SNAP YOUR MEAL</span>
            <span style={{ color: C.mid, fontSize: 11, marginTop: 4 }}>
              {credits > 0 ? (DEMO_MODE ? "撮影/アルバムから（デモ: サンプル値を表示）" : "撮影またはアルバムからAIがPFCに構造化") : "本日の無料解析を使い切りました"}
            </span>
          </>
        )}
      </button>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onFile} hidden />
      <input ref={libraryRef} type="file" accept="image/*" onChange={onFile} hidden />

      {status === "error" && (
        <p className="mb-2 text-center" style={{ color: "#fb7185", fontSize: 12 }}>
          解析に失敗しました（{errMsg}）。手入力で記録できます。
        </p>
      )}

      <div className="flex items-center justify-between mb-2">
        <p style={{ color: C.lo, fontSize: 11, letterSpacing: 2, fontWeight: 700 }}>TODAY&apos;S MEALS</p>
        <button onClick={manual} className="flex items-center gap-1" style={{ color: C.accent, fontSize: 12, fontWeight: 700 }}>
          <Pencil size={12} /> 手入力で追加
        </button>
      </div>

      <div className="space-y-2">
        {meals.map((m) => (
          <div key={m.id} className="rounded-xl p-3 flex items-center gap-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <div className="rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0"
              style={{ width: 44, height: 44, background: C.tactical }}>
              {m.img
                ? <img src={m.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <Utensils size={18} color={C.mid} />}
            </div>
            <div className="flex-1 min-w-0">
              <p style={{ color: C.hi, fontSize: 14, fontWeight: 700 }} className="truncate">
                {m.dish}{m.ai && <span style={{ color: C.accent, fontSize: 10, marginLeft: 6 }}>AI</span>}
              </p>
              <p style={{ color: C.mid, fontSize: 11, fontVariantNumeric: "tabular-nums" }}>
                P {m.p}g · F {m.f}g · C {m.c}g
              </p>
            </div>
            <span style={{ color: C.accent, fontSize: 14, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
              {m.kcal} <span style={{ color: C.mid, fontSize: 10, fontWeight: 500 }}>kcal</span>
            </span>
          </div>
        ))}
      </div>

      {/* 取得元の選択シート */}
      {picker && (
        <div className="absolute inset-0 flex items-end" style={{ background: C.scrim, zIndex: 20 }}
          onClick={() => setPicker(false)}>
          <div className="w-full rounded-t-3xl p-4" style={{ background: C.bg, border: `1px solid ${C.border}` }}
            onClick={(e) => e.stopPropagation()}>
            <p style={{ color: C.lo, fontSize: 11, letterSpacing: 1.5, fontWeight: 700 }} className="mb-3 text-center">
              写真を追加
            </p>
            {[
              { Icon: Camera, label: "写真を撮る", ref: cameraRef },
              { Icon: Images, label: "アルバムから選択", ref: libraryRef },
            ].map(({ Icon, label, ref }) => (
              <button key={label}
                onClick={() => { setPicker(false); ref.current?.click(); }}
                className="w-full rounded-xl flex items-center gap-3 px-4 mb-2"
                style={{ minHeight: 56, background: C.surface, color: C.hi, fontSize: 15, fontWeight: 700, border: `1px solid ${C.border}` }}>
                <Icon size={20} color={C.accent} /> {label}
              </button>
            ))}
            <button onClick={() => setPicker(false)}
              className="w-full rounded-xl mt-1"
              style={{ minHeight: 52, color: C.mid, fontSize: 15, fontWeight: 700 }}>
              キャンセル
            </button>
          </div>
        </div>
      )}

      {draft && <DraftSheet draft={draft} setDraft={setDraft} onSave={save} onCancel={() => setDraft(null)} errMsg={errMsg} />}
    </div>
  );
}

function DraftSheet({ draft, setDraft, onSave, onCancel, errMsg }) {
  const C = useC();
  const fields = [
    ["kcal", "カロリー", "kcal"],
    ["p", "タンパク質", "g"],
    ["f", "脂質", "g"],
    ["c", "炭水化物", "g"],
  ];
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: k === "dish" ? v : Math.max(0, Number(v) || 0) }));
  return (
    <div className="absolute inset-0 flex items-end" style={{ background: C.scrim, zIndex: 30 }}>
      <div className="w-full rounded-t-3xl p-5" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between mb-1">
          <h3 style={{ color: C.hi, fontSize: 16, fontWeight: 800 }}>記録を確定</h3>
          <button onClick={onCancel} style={{ color: C.mid }}><X size={20} /></button>
        </div>
        <p style={{ color: draft.failed ? "#fb7185" : (draft.ai ? C.accent : C.mid), fontSize: 11 }} className="mb-2">
          {draft.failed
            ? "AIが画像を読み取れませんでした。手入力で記録してください。"
            : draft.demo
              ? "デモ用のサンプル値です（本番ではGPT-4oが実際に解析）。修正して確定できます。"
              : draft.ai
                ? "AIの推定値です。間違っていれば修正して確定できます。"
                : "数値を入力して記録します。"}
        </p>
        {draft.failed && errMsg && (
          <p className="mb-3 rounded-md px-2 py-1" style={{ color: "#fb7185", fontSize: 11, background: "rgba(251,113,133,.10)", fontFamily: "monospace", wordBreak: "break-all" }}>
            理由: {errMsg}
          </p>
        )}

        <label style={{ color: C.lo, fontSize: 10, letterSpacing: 1, fontWeight: 700 }}>料理名</label>
        <input value={draft.dish} onChange={(e) => set("dish", e.target.value)} placeholder="例: 鶏胸肉の照り焼き"
          className="w-full rounded-xl px-3 mt-1 mb-4"
          style={{ minHeight: 48, background: C.tactical, color: C.hi, fontSize: 15, border: `1px solid ${C.border}`, outline: "none" }} />

        <div className="grid grid-cols-2 gap-3 mb-5">
          {fields.map(([k, label, unit]) => (
            <div key={k}>
              <label style={{ color: C.lo, fontSize: 10, letterSpacing: 1, fontWeight: 700 }}>{label}</label>
              <div className="flex items-center rounded-xl px-3 mt-1" style={{ background: C.tactical, border: `1px solid ${C.border}` }}>
                <input type="number" inputMode="numeric" value={draft[k]} onChange={(e) => set(k, e.target.value)}
                  className="w-full"
                  style={{ minHeight: 48, background: "transparent", color: C.hi, fontSize: 16, fontWeight: 700, outline: "none", fontVariantNumeric: "tabular-nums" }} />
                <span style={{ color: C.mid, fontSize: 12 }}>{unit}</span>
              </div>
            </div>
          ))}
        </div>

        <button onClick={onSave} className="w-full rounded-xl flex items-center justify-center gap-2"
          style={{ minHeight: 54, background: C.accent, color: ON_GOLD, fontWeight: 800, fontSize: 16 }}>
          <Check size={18} /> この内容で記録
        </button>
      </div>
    </div>
  );
}

/* ================================================================== */
/* 画面③: DATA（プレミアム解放ティザー）                                */
/* ================================================================== */
function DataScreen() {
  const C = useC();
  return (
    <div className="px-5 pt-3 flex flex-col items-center justify-center" style={{ minHeight: 380 }}>
      <div className="rounded-full flex items-center justify-center mb-4"
        style={{ width: 64, height: 64, background: C.surface, border: `1px solid ${C.border}` }}>
        <Lock size={26} color={C.accent} />
      </div>
      <h3 style={{ color: C.hi, fontSize: 18, fontWeight: 800 }} className="mb-2">重量推移グラフ</h3>
      <p style={{ color: C.mid, fontSize: 13, textAlign: "center", lineHeight: 1.6 }} className="mb-5">
        過去の筋トレ重量の自動グラフ化は<br />プレミアムプランで解放されます。
      </p>
      <button className="rounded-xl px-6" style={{ minHeight: 48, background: C.accent, color: ON_GOLD, fontWeight: 800, fontSize: 14 }}>
        プレミアムにする（¥580/月）
      </button>
    </div>
  );
}

/* ================================================================== */
/* シェル（テーマProvider・ステータスバー・ヘッダー・グローバルナビ）     */
/* ================================================================== */
export default function App() {
  const [tab, setTab] = useState("note");
  const [theme, setTheme] = useState("dark");
  const C = THEMES[theme];

  const header = {
    note: { right: "GYM MODE", solid: true },
    meal: { right: "FREE PLAN (3/3)", solid: false },
    data: { right: "PREMIUM", solid: false },
  }[tab];

  const nav = [
    { key: "note", label: "NOTE", Icon: Dumbbell },
    { key: "meal", label: "SHOKUJI", Icon: Utensils },
    { key: "data", label: "DATA", Icon: BarChart3 },
  ];

  return (
    <ThemeCtx.Provider value={C}>
      <div style={{ background: C.page, minHeight: "100vh", transition: "background .3s" }} className="flex items-center justify-center p-4">
        <style>{`
          .fn-spin { animation: fnspin 1s linear infinite; }
          @keyframes fnspin { to { transform: rotate(360deg); } }
          .fn-set-in { animation: fnSetIn .28s ease; }
          @keyframes fnSetIn { from { opacity: 0; transform: translateX(28px); } to { opacity: 1; transform: translateX(0); } }
          button:focus-visible, input:focus-visible { outline: 2px solid ${C.accent}; outline-offset: 2px; border-radius: 8px; }
          @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
          .fn-scroll::-webkit-scrollbar { width: 0; }
        `}</style>

        <div className="relative flex flex-col overflow-hidden"
          style={{
            width: "100%", maxWidth: 390, height: 800, maxHeight: "92vh",
            background: C.bg, borderRadius: 40, border: `1px solid ${C.frame}`,
            boxShadow: C.shadow, transition: "background .3s, border-color .3s",
          }}>
          {/* status bar */}
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
              <button onClick={() => setTheme((p) => (p === "dark" ? "light" : "dark"))}
                aria-label="テーマを切り替える"
                className="rounded-full flex items-center justify-center"
                style={{ width: 34, height: 34, background: C.surface, color: C.accent, border: `1px solid ${C.border}` }}>
                {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
              </button>
              <span className="rounded-full px-3 py-1"
                style={{
                  fontSize: 11, fontWeight: 800, letterSpacing: 1,
                  background: header.solid ? C.accent : "transparent",
                  color: header.solid ? ON_GOLD : C.mid,
                  border: header.solid ? "none" : `1px solid ${C.border}`,
                }}>
                {header.right}
              </span>
            </div>
          </div>

          {/* body */}
          <div className="flex-1 overflow-y-auto fn-scroll">
            {tab === "note" && <NoteScreen />}
            {tab === "meal" && <MealScreen />}
            {tab === "data" && <DataScreen />}
          </div>

          {/* 共通ナビ */}
          <div className="flex" style={{ flexShrink: 0, borderTop: `1px solid ${C.border}`, background: C.bg }}>
            {nav.map(({ key, label, Icon }) => {
              const on = tab === key;
              return (
                <button key={key} onClick={() => setTab(key)}
                  className="flex-1 flex flex-col items-center gap-1 py-3"
                  style={{ color: on ? C.accent : C.lo }}>
                  <Icon size={20} />
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </ThemeCtx.Provider>
  );
}
