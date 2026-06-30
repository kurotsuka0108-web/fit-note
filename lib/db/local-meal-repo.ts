import { TARGET } from "@/lib/theme";
import { DAILY_AI_LIMIT, type AiUsage, type Meal, type MealRepo, type NewMeal, type Profile, type TargetPFC } from "./meal-types";

// Supabase 未設定時のフォールバック。ブラウザの localStorage に永続化する。
// （NOTE の LocalNoteRepo と同じ方針。リロードしても残る）

const KEY = "fitnote.meal.v1";

type Store = {
  meals: Meal[]; // 全日付の食事
  usage: Record<string, number>; // 日付 => AI 解析回数
  profile?: Profile; // 身体情報＋目標PFC
};

const uid = (): string =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function load(): Store {
  if (typeof window === "undefined") return { meals: [], usage: {} };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { meals: [], usage: {} };
    const parsed = JSON.parse(raw) as Partial<Store>;
    return { meals: parsed.meals ?? [], usage: parsed.usage ?? {} };
  } catch {
    return { meals: [], usage: {} };
  }
}

function save(store: Store): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(store));
}

export class LocalMealRepo implements MealRepo {
  async getMeals(date: string): Promise<Meal[]> {
    // 追加が新しいものを先頭に（push 順の逆）。
    return load()
      .meals.filter((m) => m.date === date)
      .reverse();
  }

  async addMeal(date: string, meal: NewMeal): Promise<Meal> {
    const store = load();
    const created: Meal = { id: uid(), date, ...meal };
    store.meals.push(created);
    save(store);
    return created;
  }

  async updateMeal(id: string, meal: NewMeal): Promise<Meal> {
    const store = load();
    const idx = store.meals.findIndex((m) => m.id === id);
    if (idx < 0) throw new Error("食事が見つかりません");
    store.meals[idx] = { ...store.meals[idx], ...meal };
    save(store);
    return store.meals[idx];
  }

  async removeMeal(id: string): Promise<void> {
    const store = load();
    store.meals = store.meals.filter((m) => m.id !== id);
    save(store);
  }

  async getTarget(): Promise<TargetPFC> {
    return { ...(load().profile?.target ?? TARGET) };
  }

  async getProfile(): Promise<Profile | null> {
    return load().profile ?? null;
  }

  async saveProfile(profile: Profile): Promise<void> {
    const store = load();
    store.profile = profile;
    save(store);
  }

  async getUsage(date: string): Promise<AiUsage> {
    return { used: load().usage[date] ?? 0, limit: DAILY_AI_LIMIT };
  }

  async incrementUsage(date: string): Promise<void> {
    const store = load();
    store.usage[date] = (store.usage[date] ?? 0) + 1;
    save(store);
  }
}
