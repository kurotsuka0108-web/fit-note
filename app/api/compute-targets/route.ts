// app/api/compute-targets/route.ts
//
// 身体情報（身長・体重・年齢・性別・活動量・目標）から、1日の目標カロリーと PFC を算出するルート。
// GPT に「Mifflin-St Jeor 式 + 活動係数 + 目標補正 + PFC配分」で計算させる（仕様 §3.3 / §5）。
// API キー未設定や GPT 失敗時は、サーバー側の決定論的計算（同式）にフォールバックして必ず返す。

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o";

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

type Input = {
  height: number; // cm
  weight: number; // kg
  age: number;
  sex: "male" | "female";
  activityLevel: "low" | "mid" | "high";
  goal: "増量" | "維持" | "減量";
};

export type Targets = { kcal: number; p: number; f: number; c: number };

const ACTIVITY_FACTOR: Record<Input["activityLevel"], number> = { low: 1.4, mid: 1.55, high: 1.725 };

// Mifflin-St Jeor 式による決定論的な目標算出（GPT のフォールバック兼検算）。
function computeDeterministic(i: Input): Targets {
  const bmr =
    i.sex === "male"
      ? 10 * i.weight + 6.25 * i.height - 5 * i.age + 5
      : 10 * i.weight + 6.25 * i.height - 5 * i.age - 161;
  const tdee = bmr * (ACTIVITY_FACTOR[i.activityLevel] ?? 1.55);
  const kcal = i.goal === "増量" ? tdee * 1.15 : i.goal === "減量" ? tdee * 0.8 : tdee;
  // タンパク質: 体重×2.0g、脂質: 総kcalの25%、炭水化物: 残り。
  const p = Math.round(i.weight * 2.0);
  const f = Math.round((kcal * 0.25) / 9);
  const c = Math.max(0, Math.round((kcal - p * 4 - f * 9) / 4));
  return { kcal: Math.round(kcal), p, f, c };
}

function validInput(b: unknown): Input | null {
  const o = b as Record<string, unknown>;
  const height = Number(o?.height);
  const weight = Number(o?.weight);
  const age = Number(o?.age);
  const sex = o?.sex === "male" || o?.sex === "female" ? o.sex : null;
  const activityLevel = o?.activityLevel === "low" || o?.activityLevel === "mid" || o?.activityLevel === "high" ? o.activityLevel : null;
  const goal = o?.goal === "増量" || o?.goal === "維持" || o?.goal === "減量" ? o.goal : null;
  if (!Number.isFinite(height) || height < 100 || height > 250) return null;
  if (!Number.isFinite(weight) || weight < 25 || weight > 300) return null;
  if (!Number.isFinite(age) || age < 10 || age > 100) return null;
  if (!sex || !activityLevel || !goal) return null;
  return { height, weight, age, sex, activityLevel, goal };
}

function clampInt(v: unknown): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }
  const input = validInput(body);
  if (!input) {
    return NextResponse.json({ error: "身体情報の値が不正です（身長・体重・年齢・性別・活動量・目標を確認）" }, { status: 400 });
  }

  const fallback = computeDeterministic(input);

  // API キーが無ければ決定論的計算のみで返す。
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ...fallback, source: "formula" });
  }

  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: MODEL,
      response_format: { type: "json_object" },
      max_tokens: 300,
      messages: [
        {
          role: "system",
          content:
            "あなたは管理栄養士・パーソナルトレーナーです。利用者の身体情報から1日の目標を算出し、JSON のみを返します。" +
            "手順: (1)Mifflin-St Jeor 式で基礎代謝(BMR)を求める。male=10*kg+6.25*cm-5*age+5, female=10*kg+6.25*cm-5*age-161。" +
            "(2)活動係数を掛けて TDEE を求める（low=1.4, mid=1.55, high=1.725）。(3)目標で補正（増量=+15%, 維持=±0, 減量=-20%）。" +
            "(4)PFC配分: タンパク質=体重×2.0g、脂質=総kcalの25%、炭水化物=残り。" +
            'スキーマ: {"kcal":number,"p":number(g),"f":number(g),"c":number(g)}。すべて正の整数。',
        },
        {
          role: "user",
          content: `身長${input.height}cm 体重${input.weight}kg 年齢${input.age} 性別${input.sex === "male" ? "男性" : "女性"} 活動量${input.activityLevel} 目標${input.goal}。目標 kcal,p,f,c を算出してください。`,
        },
      ],
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as Partial<Targets>;
    const kcal = clampInt(parsed.kcal);
    const p = clampInt(parsed.p);
    const f = clampInt(parsed.f);
    const c = clampInt(parsed.c);
    // GPT が極端な値を返した場合は決定論的計算で代替（堅牢性）。
    if (kcal < 800 || kcal > 6000 || p === 0) {
      return NextResponse.json({ ...fallback, source: "formula" });
    }
    return NextResponse.json({ kcal, p, f, c, source: "ai" });
  } catch (err) {
    console.error("[compute-targets]", err);
    // GPT 失敗時も決定論的計算で必ず返す。
    return NextResponse.json({ ...fallback, source: "formula" });
  }
}
