"use client";

import { getBrowserSupabase } from "@/lib/supabase/client";
import { LocalNoteRepo } from "./local-repo";
import { SupabaseNoteRepo } from "./supabase-repo";
import type { NoteRepo } from "./types";

export * from "./types";
export { BODY_PARTS, EXERCISE_LIBRARY_SEED } from "./seed";

let repo: NoteRepo | null = null;

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

/** 永続化先が Supabase か localStorage か（UI 表示用） */
export function getBackendLabel(): "supabase" | "local" {
  return getBrowserSupabase() ? "supabase" : "local";
}
