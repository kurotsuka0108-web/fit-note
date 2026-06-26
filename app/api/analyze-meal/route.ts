// app/api/analyze-meal/route.ts
//
// 食事写真（＋任意のヒント）を GPT-4o に送り、{ dish, kcal, p, f, c } を返すルート。
// OpenAI Responses API を使い、web_search ツールでチェーン店・コンビニ・メーカー商品の
// 公式栄養情報も参照して精度を上げる。APIキーはサーバー側でのみ使用しクライアントには出さない。
//
// セットアップ:
//   1. npm i openai
//   2. プロジェクト直下に .env.local を作成し、次を記入:
//        OPENAI_API_KEY=sk-...           # platform.openai.com で発行
//        # OPENAI_MODEL=gpt-4o           # 省略時は gpt-4o。安く回すなら gpt-4.1-mini
//        # OPENAI_WEB_SEARCH=1           # 1=Web検索でブランド商品を照合（既定）。0=無効
//   3. npm run dev → POST /api/analyze-meal

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getServerSupabase } from "@/lib/supabase/server";
import { DEMO_USER_ID } from "@/lib/env";
import { DAILY_AI_LIMIT } from "@/lib/db/meal-types";

export const runtime = "nodejs"; // 画像を扱うので Edge ではなく Node ランタイム
export const maxDuration = 60; // Web 検索を挟むと時間がかかるため上限を延ばす

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o";
// Web 検索でブランド商品（吉野家の牛丼・ファミマのサラダチキン等）の公式値を照合する。
const WEB_SEARCH = process.env.OPENAI_WEB_SEARCH !== "0";

// クライアントは遅延生成する。モジュール読込時に new すると、キー未設定環境で
// ビルド時のページデータ収集が失敗するため。キー確認を通過してから生成する。
function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export type MealAnalysis = {
  dish: string; // 料理名（商品名が分かれば店名込み。日本語）
  kcal: number; // カロリー
  p: number;    // タンパク質 (g)
  f: number;    // 脂質 (g)
  c: number;    // 炭水化物 (g)
};

// 精度最優先のシステムプロンプト（仕様 §4）。
// ・複数品目の合算 ・ブランド商品は Web 検索で公式値を優先 ・分量の見積り ・ヒント最優先。
const SYSTEM_PROMPT = [
  "あなたは日本の食品・外食・コンビニ商品の栄養データに精通した、経験豊富な管理栄養士です。",
  "食事写真（と任意のユーザーヒント）から、カロリーと PFC（たんぱく質・脂質・炭水化物）を可能な限り正確に推定します。",
  "",
  "# 推定の手順",
  "1. 写真に写っている料理・食品をすべて特定する。複数の品目（主食・主菜・副菜・汁物・飲料など）があれば全て挙げ、合算する。",
  "2. それが特定のチェーン店・コンビニ・メーカーの市販/外食商品だと判断できる場合（例: 吉野家 牛丼、ファミリーマート サラダチキン、セブンイレブン 〇〇、すき家、マクドナルド 等）、",
  "   web_search ツールでその『商品名 カロリー たんぱく質 脂質 炭水化物』を検索し、公式サイトや栄養成分表の実数値を最優先で採用する。サイズ/盛り（並・大盛など）も合わせる。",
  "3. ブランドが特定できない一般的な手料理は、写真から分量（皿・茶碗・盛り付けの体積）を見積もり、一般的な食材構成から PFC を積み上げて推定する。",
  "4. ユーザーのヒント（商品名・店名・サイズ・量・食材など）が与えられた場合は最優先で考慮する。",
  "5. 判断に迷う場合は日本の一般的な1人前を想定する。",
  "",
  "# 数値ルール",
  "- kcal・p・f・c はすべて 0 以上の整数（グラムと kcal）。",
  "- c（炭水化物）は糖質＋食物繊維の総量とする。",
  "- 自信が低くても必ず最善の推定値を返す。0 は本当に食べ物が無い場合のみ。",
  "- 食べ物が写っておらずヒントも無いときだけ dish=\"不明\" で全数値 0。",
  "",
  "# 出力（厳守）",
  "最終出力は次の JSON オブジェクトただ1つだけ。前置き・説明・コードフェンスを付けない。",
  '{"dish": string(日本語の料理名。商品なら店名込み 例 "吉野家 牛丼 並盛"), "kcal": number, "p": number, "f": number, "c": number, "source": "brand"|"estimate", "note": string(20字程度の根拠。例 "公式栄養成分を参照" / "写真から推定")}',
].join("\n");

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY が設定されていません（.env.local を確認）" },
      { status: 500 },
    );
  }

  // 入力: { imageBase64?: string, mediaType?: string, date?: string, hint?: string }
  // imageBase64 は data URL でも、プレフィックス無しの素の base64 でも可。
  // hint はユーザーの補足（商品名・サイズ等）。date は日次カウント基準日（ローカル日 YYYY-MM-DD）。
  let imageBase64: string | undefined;
  let mediaType = "image/jpeg";
  let date: string | undefined;
  let hint = "";
  try {
    const body = await req.json();
    imageBase64 = body?.imageBase64;
    if (typeof body?.mediaType === "string") mediaType = body.mediaType;
    if (typeof body?.date === "string") date = body.date;
    if (typeof body?.hint === "string") hint = body.hint.trim().slice(0, 200);
  } catch {
    return NextResponse.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }

  if (!imageBase64 || typeof imageBase64 !== "string") {
    return NextResponse.json({ error: "imageBase64 が必要です" }, { status: 400 });
  }

  const dataUrl = imageBase64.startsWith("data:")
    ? imageBase64
    : `data:${mediaType};base64,${imageBase64}`;

  // 無料プランの日次上限をサーバー側で判定（Supabase 構成時のみ）。
  // 未構成（localStorage モード）はサーバーで永続化できないためスキップし、
  // クライアント表示用カウントに委ねる（仕様 §3.3 / §6）。
  const day = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
  const sb = await getServerSupabase();
  if (sb) {
    const { data: row, error } = await sb
      .from("ai_usage")
      .select("count")
      .eq("user_id", DEMO_USER_ID)
      .eq("date", day)
      .maybeSingle();
    if (error) {
      console.error("[analyze-meal] usage read", error);
      return NextResponse.json({ error: "利用状況の取得に失敗しました" }, { status: 500 });
    }
    const used = Number(row?.count) || 0;
    if (used >= DAILY_AI_LIMIT) {
      return NextResponse.json(
        { error: "本日の無料解析を使い切りました", usage: { used, limit: DAILY_AI_LIMIT } },
        { status: 429 },
      );
    }
  }

  try {
    const openai = getOpenAI();
    let analysis: MealAnalysis & { source?: string; note?: string };
    try {
      analysis = await analyze(openai, dataUrl, hint, WEB_SEARCH);
    } catch (e) {
      // Web 検索ツール経由で失敗した場合は、検索なしでリトライして必ず結果を返す。
      if (WEB_SEARCH) {
        console.error("[analyze-meal] web_search 経由で失敗。検索なしで再試行", e);
        analysis = await analyze(openai, dataUrl, hint, false);
      } else {
        throw e;
      }
    }

    // 解析成功時に日次カウントを +1（Supabase 構成時のみ。判定の正本はサーバー側）。
    let usage: { used: number; limit: number } | null = null;
    if (sb) {
      const { data: cur } = await sb
        .from("ai_usage")
        .select("count")
        .eq("user_id", DEMO_USER_ID)
        .eq("date", day)
        .maybeSingle();
      const next = (Number(cur?.count) || 0) + 1;
      const { error: upErr } = await sb
        .from("ai_usage")
        .upsert({ user_id: DEMO_USER_ID, date: day, count: next, updated_at: new Date().toISOString() });
      if (upErr) console.error("[analyze-meal] usage upsert", upErr);
      else usage = { used: next, limit: DAILY_AI_LIMIT };
    }

    return NextResponse.json({ ...analysis, usage });
  } catch (err: any) {
    console.error("[analyze-meal]", err);
    const status = typeof err?.status === "number" ? err.status : 500;
    return NextResponse.json(
      { error: err?.message ?? "解析に失敗しました" },
      { status },
    );
  }
}

// Responses API を1回呼び、出力テキストから JSON を抽出・正規化して返す。
async function analyze(
  openai: OpenAI,
  dataUrl: string,
  hint: string,
  webSearch: boolean,
): Promise<MealAnalysis & { source?: string; note?: string }> {
  const userText = hint
    ? `この食事の dish, kcal, p, f, c を推定してください。ユーザーからのヒント: 「${hint}」`
    : "この食事の dish, kcal, p, f, c を推定してください。";

  const response = await openai.responses.create({
    model: MODEL,
    instructions: SYSTEM_PROMPT,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: userText },
          { type: "input_image", image_url: dataUrl, detail: "high" },
        ],
      },
    ],
    // ブランド商品の公式栄養値を照合（低コンテキストで安価・低レイテンシ寄りに）。
    tools: webSearch ? [{ type: "web_search", search_context_size: "low" }] : undefined,
    temperature: 0.2,
    max_output_tokens: 1200,
  });

  const parsed = extractJson(response.output_text ?? "");
  return {
    dish: typeof parsed.dish === "string" && parsed.dish.trim() ? parsed.dish.trim() : "不明",
    kcal: clampInt(parsed.kcal),
    p: clampInt(parsed.p),
    f: clampInt(parsed.f),
    c: clampInt(parsed.c),
    source: parsed.source === "brand" ? "brand" : "estimate",
    note: typeof parsed.note === "string" ? parsed.note.trim().slice(0, 60) : undefined,
  };
}

// 出力テキストから JSON オブジェクトを取り出す。コードフェンスや前置きが混じっても拾える。
function extractJson(text: string): Record<string, unknown> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const m = candidate.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("解析結果(JSON)を取得できませんでした");
  return JSON.parse(m[0]) as Record<string, unknown>;
}

function clampInt(v: unknown): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
