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

// 食事写真を入れる private バケット（migration 0008）。
const BUCKET = "meal-images";
// 署名URLの有効期限（秒）。ダッシュボード表示用なのでリロードで再発行されれば十分。
const SIGNED_URL_TTL = 60 * 60;

// image_path が Storage のオブジェクトパスか（= 署名が必要か）を判定。
// 旧データの data URL や外部 http(s) URL はそのまま表示するため除外する。
function isStoragePath(s: string): boolean {
  return !s.startsWith("data:") && !s.startsWith("http://") && !s.startsWith("https://");
}

export class SupabaseMealRepo implements MealRepo {
  constructor(private sb: SupabaseClient) {}

  // data URL を Storage にアップロードし、保存したオブジェクトのパスを返す。
  private async uploadImage(dataUrl: string): Promise<string> {
    const { data: auth } = await this.sb.auth.getUser();
    if (!auth.user) throw new Error("ログインが必要です");
    const blob = await (await fetch(dataUrl)).blob(); // data URL → Blob
    const path = `${auth.user.id}/${crypto.randomUUID()}.jpg`;
    const { error } = await this.sb.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (error) throw error;
    return path;
  }

  // Storage パスを表示用の署名URLに変換。
  private async signPath(path: string): Promise<string | null> {
    const { data } = await this.sb.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
    return data?.signedUrl ?? null;
  }

  // 指定 meal が持つ既存の Storage オブジェクトを削除（差し替え・削除時の孤児防止）。
  private async deleteExistingImage(id: string): Promise<void> {
    const { data } = await this.sb.from("meals").select("image_path").eq("id", id).maybeSingle();
    const p = (data as { image_path: string | null } | null)?.image_path;
    if (p && isStoragePath(p)) {
      await this.sb.storage.from(BUCKET).remove([p]);
    }
  }

  async getMeals(date: string): Promise<Meal[]> {
    const { data, error } = await this.sb
      .from("meals")
      .select(MEAL_SELECT)
      .eq("date", date)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const meals = ((data ?? []) as unknown as MealRow[]).map(toMeal);

    // Storage パスをまとめて署名URLへ変換（data URL の旧データはそのまま）。
    const paths = meals
      .map((m) => m.image)
      .filter((img): img is string => !!img && isStoragePath(img));
    if (paths.length > 0) {
      const { data: signed } = await this.sb.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_TTL);
      const map = new Map<string, string>();
      (signed ?? []).forEach((s) => {
        if (s.path && s.signedUrl) map.set(s.path, s.signedUrl);
      });
      for (const m of meals) {
        if (m.image && isStoragePath(m.image)) m.image = map.get(m.image) ?? null;
      }
    }
    return meals;
  }

  async addMeal(date: string, meal: NewMeal): Promise<Meal> {
    // 新規写真（data URL）のみ Storage へアップロード。null はそのまま。
    const imagePath = meal.image?.startsWith("data:") ? await this.uploadImage(meal.image) : null;
    const { data, error } = await this.sb
      .from("meals")
      .insert({
        date, // user_id は default auth.uid()
        dish: meal.dish,
        kcal: meal.kcal,
        p: meal.p,
        f: meal.f,
        c: meal.c,
        image_path: imagePath,
        source: meal.source,
      })
      .select(MEAL_SELECT)
      .single();
    if (error) throw error;
    const created = toMeal(data as unknown as MealRow);
    // 追加直後の表示用に署名URLへ。
    if (imagePath) created.image = (await this.signPath(imagePath)) ?? meal.image;
    return created;
  }

  async updateMeal(id: string, meal: NewMeal): Promise<Meal> {
    // 画像の扱いを3分岐:
    //   - data URL: 新しい写真 → 旧オブジェクト削除＋アップロード
    //   - null: 写真削除 → 旧オブジェクト削除＋ image_path を null に
    //   - それ以外（署名URL = 未変更）: image_path は触らない
    const update: Record<string, unknown> = {
      dish: meal.dish,
      kcal: meal.kcal,
      p: meal.p,
      f: meal.f,
      c: meal.c,
      source: meal.source,
    };
    let newImagePath: string | null = null;
    if (meal.image == null) {
      await this.deleteExistingImage(id);
      update.image_path = null;
    } else if (meal.image.startsWith("data:")) {
      await this.deleteExistingImage(id);
      newImagePath = await this.uploadImage(meal.image);
      update.image_path = newImagePath;
    }

    const { data, error } = await this.sb
      .from("meals")
      .update(update)
      .eq("id", id)
      .select(MEAL_SELECT)
      .single();
    if (error) throw error;
    const updated = toMeal(data as unknown as MealRow);
    // 表示用に署名URLへ（未変更なら image_path は既存の Storage パスのまま）。
    if (updated.image && isStoragePath(updated.image)) {
      updated.image = (await this.signPath(updated.image)) ?? null;
    }
    return updated;
  }

  async removeMeal(id: string): Promise<void> {
    await this.deleteExistingImage(id); // Storage の孤児を残さない
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
