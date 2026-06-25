import type { SupabaseClient } from "@supabase/supabase-js";
import { DEMO_USER_ID } from "@/lib/env";
import { TARGET } from "@/lib/theme";
import { DAILY_AI_LIMIT, type AiUsage, type Meal, type MealRepo, type MealSource, type NewMeal, type TargetPFC } from "./meal-types";

// Supabase 実装。migration 0006_meals.sql（meals・ai_usage）に対応。
// RLS はデモユーザー(DEMO_USER_ID)に限定（NOTE と同じ。フェーズ2で auth.uid() に差し替え）。

type MealRow = {
  id: string;
  date: string;
  dish: string;
  kcal: number;
  p: number;
  f: number;
  c: number;
  image_path: string | null;
  source: string | null;
};

function toMeal(row: MealRow): Meal {
  return {
    id: row.id,
    date: row.date,
    dish: row.dish,
    kcal: Number(row.kcal),
    p: Number(row.p),
    f: Number(row.f),
    c: Number(row.c),
    image: row.image_path,
    source: (row.source as MealSource) ?? "manual",
  };
}

const MEAL_SELECT = "id,date,dish,kcal,p,f,c,image_path,source";

export class SupabaseMealRepo implements MealRepo {
  constructor(private sb: SupabaseClient) {}

  async getMeals(date: string): Promise<Meal[]> {
    const { data, error } = await this.sb
      .from("meals")
      .select(MEAL_SELECT)
      .eq("user_id", DEMO_USER_ID)
      .eq("date", date)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as unknown as MealRow[]).map(toMeal);
  }

  async addMeal(date: string, meal: NewMeal): Promise<Meal> {
    const { data, error } = await this.sb
      .from("meals")
      .insert({
        user_id: DEMO_USER_ID,
        date,
        dish: meal.dish,
        kcal: meal.kcal,
        p: meal.p,
        f: meal.f,
        c: meal.c,
        image_path: meal.image,
        source: meal.source,
      })
      .select(MEAL_SELECT)
      .single();
    if (error) throw error;
    return toMeal(data as unknown as MealRow);
  }

  async removeMeal(id: string): Promise<void> {
    const { error } = await this.sb.from("meals").delete().eq("id", id);
    if (error) throw error;
  }

  async getTarget(): Promise<TargetPFC> {
    const { data, error } = await this.sb
      .from("profiles")
      .select("target_kcal,target_p,target_f,target_c")
      .eq("id", DEMO_USER_ID)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ...TARGET };
    return {
      kcal: Number(data.target_kcal) || TARGET.kcal,
      p: Number(data.target_p) || TARGET.p,
      f: Number(data.target_f) || TARGET.f,
      c: Number(data.target_c) || TARGET.c,
    };
  }

  async getUsage(date: string): Promise<AiUsage> {
    const { data, error } = await this.sb
      .from("ai_usage")
      .select("count")
      .eq("user_id", DEMO_USER_ID)
      .eq("date", date)
      .maybeSingle();
    if (error) throw error;
    return { used: Number(data?.count) || 0, limit: DAILY_AI_LIMIT };
  }

  async incrementUsage(): Promise<void> {
    // supabase バックエンドでは analyze-meal ルート（サーバー側）が ai_usage を
    // 更新・上限判定する。クライアント側からの二重カウントを避けるため no-op。
  }
}
