"use client";

import { getBrowserSupabase } from "@/lib/supabase/client";
import { LocalNoteRepo } from "./local-repo";
import { SupabaseNoteRepo } from "./supabase-repo";
import { LocalMealRepo } from "./local-meal-repo";
import { SupabaseMealRepo } from "./supabase-meal-repo";
import type { NoteRepo } from "./types";
import type { MealRepo } from "./meal-types";

export * from "./types";
export * from "./meal-types";
export { BODY_PARTS, DEFAULT_INTERVAL_SEC, EXERCISE_LIBRARY_SEED } from "./seed";

let repo: NoteRepo | null = null;
let mealRepo: MealRepo | null = null;

/**
 * NOTE のリポジトリを返す（シングルトン）。
 * Supabase env があれば Supabase 実装、無ければ localStorage 実装にフォールバック。
 */
export function getNoteRepo(): NoteRepo {
  if (repo) return repo;
  const sb = getBrowserSupabase();
  repo = sb ? new SupabaseNoteRepo(sb) : new LocalNoteRepo();
  return repo;
}

/**
 * SHOKUJI のリポジトリを返す（シングルトン）。
 * Supabase env があれば Supabase 実装、無ければ localStorage 実装にフォールバック。
 */
export function getMealRepo(): MealRepo {
  if (mealRepo) return mealRepo;
  const sb = getBrowserSupabase();
  mealRepo = sb ? new SupabaseMealRepo(sb) : new LocalMealRepo();
  return mealRepo;
}

/** 永続化先が Supabase か localStorage か（UI 表示用） */
export function getBackendLabel(): "supabase" | "local" {
  return getBrowserSupabase() ? "supabase" : "local";
}
