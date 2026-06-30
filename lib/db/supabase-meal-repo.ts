import type { SupabaseClient } from "@supabase/supabase-js";
import { TARGET } from "@/lib/theme";
import { DAILY_AI_LIMIT, type ActivityLevel, type AiUsage, type Goal, type Meal, type MealRepo, type MealSource, type NewMeal, type Profile, type Sex, type TargetPFC } from "./meal-types";

// Supabase 実装。migration 0006_meals.sql（meals・ai_usage）に対応。
// RLS は auth.uid() ベース（フェーズ2）。user_id は default auth.uid() で自動補完。

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
      .eq("date", date)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as unknown as MealRow[]).map(toMeal);
  }

  async addMeal(date: string, meal: NewMeal): Promise<Meal> {
    const { data, error } = await this.sb
      .from("meals")
      .insert({
        date, // user_id は default auth.uid()
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

  async updateMeal(id: string, meal: NewMeal): Promise<Meal> {
    const { data, error } = await this.sb
      .from("meals")
      .update({
        dish: meal.dish,
        kcal: meal.kcal,
        p: meal.p,
        f: meal.f,
        c: meal.c,
        image_path: meal.image,
        source: meal.source,
      })
      .eq("id", id)
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
      // RLS が本人の profiles 行のみ返すため id フィルタは不要。
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

  async getProfile(): Promise<Profile | null> {
    const { data, error } = await this.sb
      .from("profiles")
      .select("height,weight,age,sex,activity_level,goal,target_kcal,target_p,target_f,target_c")
      // RLS が本人の profiles 行のみ返す。
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      height: data.height != null ? Number(data.height) : null,
      weight: data.weight != null ? Number(data.weight) : null,
      age: data.age != null ? Number(data.age) : null,
      sex: (data.sex as Sex) ?? null,
      activityLevel: (data.activity_level as ActivityLevel) ?? null,
      goal: (data.goal as Goal) ?? null,
      target: {
        kcal: Number(data.target_kcal) || TARGET.kcal,
        p: Number(data.target_p) || TARGET.p,
        f: Number(data.target_f) || TARGET.f,
        c: Number(data.target_c) || TARGET.c,
      },
    };
  }

  async saveProfile(profile: Profile): Promise<void> {
    const { data: auth } = await this.sb.auth.getUser();
    if (!auth.user) throw new Error("ログインが必要です");
    const { error } = await this.sb.from("profiles").upsert({
      id: auth.user.id,
      height: profile.height,
      weight: profile.weight,
      age: profile.age,
      sex: profile.sex,
      activity_level: profile.activityLevel,
      goal: profile.goal,
      target_kcal: profile.target.kcal,
      target_p: profile.target.p,
      target_f: profile.target.f,
      target_c: profile.target.c,
    });
    if (error) throw error;
  }

  async getUsage(date: string): Promise<AiUsage> {
    const { data, error } = await this.sb
      .from("ai_usage")
      .select("count")
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
