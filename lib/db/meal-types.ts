// SHOKUJI（AI食事ダッシュボード）のドメイン型。UI と各リポジトリ実装が共有する。
// 仕様 §3.3 / §5（meals・ai_usage テーブル）に準拠。

// 記録のソース: ai=写真解析由来 / manual=手入力。
export type MealSource = "ai" | "manual";

// 目標 PFC（フェーズ2: 身体情報から AI が算出して profiles に保存）。
export type TargetPFC = { kcal: number; p: number; f: number; c: number };

// プロフィール（身体情報）。AI 目標算出の入力（仕様 §5 profiles）。
export type Sex = "male" | "female";
export type ActivityLevel = "low" | "mid" | "high"; // デスクワーク中心 / 週1-3運動 / 週4以上・肉体労働
export type Goal = "増量" | "維持" | "減量";

export type ProfileInput = {
  height: number | null; // cm
  weight: number | null; // kg
  age: number | null;
  sex: Sex | null;
  activityLevel: ActivityLevel | null;
  goal: Goal | null;
};

export type Profile = ProfileInput & { target: TargetPFC };

// 1食の記録。
export type Meal = {
  id: string;
  date: string; // YYYY-MM-DD
  dish: string;
  kcal: number;
  p: number; // タンパク質 (g)
  f: number; // 脂質 (g)
  c: number; // 炭水化物 (g)
  // サムネイル。local は data URL を直接保持、supabase は Storage パス/URL（フェーズ4で本対応）。
  image: string | null;
  source: MealSource;
};

// 新規追加のペイロード（id・date はリポジトリが付与）。
export type NewMeal = {
  dish: string;
  kcal: number;
  p: number;
  f: number;
  c: number;
  image: string | null;
  source: MealSource;
};

// AI 写真解析の無料プラン日次上限（仕様 §3.3: 1日3回）。
// サーバー側（analyze-meal ルート）とクライアント表示の両方で参照する。
export const DAILY_AI_LIMIT = 3;

// 当日の AI 利用状況（バッジ表示・上限判定用）。
export type AiUsage = { used: number; limit: number };

/**
 * SHOKUJI のデータアクセス契約。Supabase 実装と localStorage 実装が共通で満たす。
 * NOTE の NoteRepo と同じく、すべて非同期。
 */
export interface MealRepo {
  /** 指定日の食事を新しい順（追加が新しいものが先頭）で返す */
  getMeals(date: string): Promise<Meal[]>;
  /** 当日履歴に1食追加して、作成した Meal を返す */
  addMeal(date: string, meal: NewMeal): Promise<Meal>;
  /** 既存の食事を上書き更新して、更新後の Meal を返す */
  updateMeal(id: string, meal: NewMeal): Promise<Meal>;
  /** 食事を1件削除 */
  removeMeal(id: string): Promise<void>;

  /** 目標 PFC を返す（profiles の値。無ければ既定値） */
  getTarget(): Promise<TargetPFC>;

  /** プロフィール（身体情報＋目標）を返す。未設定なら null */
  getProfile(): Promise<Profile | null>;
  /** プロフィール（身体情報＋AI算出の目標）を保存する */
  saveProfile(profile: Profile): Promise<void>;

  /** 指定日の AI 利用状況（表示用）。判定の正本はサーバー側（analyze-meal ルート） */
  getUsage(date: string): Promise<AiUsage>;
  /**
   * 当日の AI 利用回数を1増やす（local バックエンド専用）。
   * supabase バックエンドはサーバールートが ai_usage を更新するため no-op。
   */
  incrementUsage(date: string): Promise<void>;
}
