// app/api/analyze-meal/route.ts
//
// 食事写真を GPT-4o に送り、{ dish, kcal, p, f, c } を JSON で返すルート。
// APIキーはサーバー側でのみ使用し、クライアントには出さない。
//
// セットアップ:
//   1. npm i openai
//   2. プロジェクト直下に .env.local を作成し、次を記入:
//        OPENAI_API_KEY=sk-...           # platform.openai.com で発行（新規は$5無料）
//        # OPENAI_MODEL=gpt-4o           # 省略時は gpt-4o。安く回すなら gpt-4.1-mini
//   3. npm run dev → POST /api/analyze-meal

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs"; // 画像を扱うので Edge ではなく Node ランタイム

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o";

// クライアントは遅延生成する。モジュール読込時に new すると、キー未設定環境で
// ビルド時のページデータ収集が失敗するため。キー確認を通過してから生成する。
function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export type MealAnalysis = {
  dish: string; // 料理名（日本語）
  kcal: number; // カロリー
  p: number;    // タンパク質 (g)
  f: number;    // 脂質 (g)
  c: number;    // 炭水化物 (g)
};

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY が設定されていません（.env.local を確認）" },
      { status: 500 },
    );
  }

  // 入力: { imageBase64: string, mediaType?: string }
  // imageBase64 は data URL でも、プレフィックス無しの素の base64 でも可。
  let imageBase64: string | undefined;
  let mediaType = "image/jpeg";
  try {
    const body = await req.json();
    imageBase64 = body?.imageBase64;
    if (typeof body?.mediaType === "string") mediaType = body.mediaType;
  } catch {
    return NextResponse.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }

  if (!imageBase64 || typeof imageBase64 !== "string") {
    return NextResponse.json({ error: "imageBase64 が必要です" }, { status: 400 });
  }

  const dataUrl = imageBase64.startsWith("data:")
    ? imageBase64
    : `data:${mediaType};base64,${imageBase64}`;

  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: MODEL,
      // JSON モードで「必ず妥当な JSON」を強制（前回のパース不安定を根本解消）
      response_format: { type: "json_object" },
      max_tokens: 300,
      messages: [
        {
          role: "system",
          content:
            "あなたは管理栄養士のアシスタントです。料理写真を見て栄養を推定し、JSON のみを返します。" +
            'スキーマ: {"dish": string(日本語の料理名), "kcal": number, "p": number(タンパク質g), "f": number(脂質g), "c": number(炭水化物g)}。' +
            "数値はすべて整数。食べ物が写っていない場合は dish を「不明」、各数値を 0 にすること。",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "この食事の dish, kcal, p, f, c を推定してください。" },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as Partial<MealAnalysis>;

    // AI 出力を検証・正規化（負値や欠損を防ぐ）
    const result: MealAnalysis = {
      dish: typeof parsed.dish === "string" && parsed.dish.trim() ? parsed.dish.trim() : "不明",
      kcal: clampInt(parsed.kcal),
      p: clampInt(parsed.p),
      f: clampInt(parsed.f),
      c: clampInt(parsed.c),
    };

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[analyze-meal]", err);
    const status = typeof err?.status === "number" ? err.status : 500;
    return NextResponse.json(
      { error: err?.message ?? "解析に失敗しました" },
      { status },
    );
  }
}

function clampInt(v: unknown): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
