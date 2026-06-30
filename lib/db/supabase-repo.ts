import type { SupabaseClient } from "@supabase/supabase-js";
import { BODY_PARTS } from "./seed";
import type { Library, LastSession, NewSet, NoteRepo, SetStage, Unit, WorkoutLog, WorkoutSet } from "./types";

// Supabase 実装。migration 0001_init_note.sql のスキーマに対応。
// RLS は auth.uid() ベース（フェーズ2）。user_id 列は default auth.uid() なので
// 挿入時に本人IDが自動補完され、参照も RLS が本人の行へ自動で絞り込む。

type LogRow = {
  id: string;
  date: string;
  name: string;
  body_part: string;
  order: number;
  group_id: string | null;
  unit: Unit | null;
  interval_sec: number | null;
  workout_sets:
    | { id: string; weight: number; reps: number; set_index: number; bodyweight: boolean; drops: SetStage[] | null }[]
    | null;
};

function toLog(row: LogRow): WorkoutLog {
  const sets = (row.workout_sets ?? [])
    .sort((a, b) => a.set_index - b.set_index)
    .map((s) => ({
      id: s.id,
      weight: Number(s.weight),
      reps: s.reps,
      bodyweight: s.bodyweight,
      drops: (s.drops ?? []).map((d) => ({ weight: Number(d.weight), reps: d.reps })),
    }));
  return { id: row.id, date: row.date, name: row.name, part: row.body_part, order: row.order, groupId: row.group_id ?? null, unit: row.unit ?? "reps", intervalSec: row.interval_sec ?? 60, sets };
}

const LOG_SELECT = 'id,date,name,body_part,order:"order",group_id,unit,interval_sec,workout_sets(id,weight,reps,set_index,bodyweight,drops)';

export class SupabaseNoteRepo implements NoteRepo {
  constructor(private sb: SupabaseClient) {}

  async getLibrary(): Promise<Library> {
    const { data, error } = await this.sb
      .from("exercises")
      .select("body_part,name,unit,interval_sec,created_at")
      // RLS が「共通テンプレ(null) + 本人の行」に絞るため、明示フィルタは不要。
      .order("created_at", { ascending: true });
    if (error) throw error;

    const lib: Library = {};
    for (const part of BODY_PARTS) lib[part] = [];
    for (const row of data ?? []) {
      const part = row.body_part as string;
      (lib[part] ??= []).push({ name: row.name as string, unit: ((row.unit as Unit) ?? "reps"), intervalSec: (row.interval_sec as number) ?? 60 });
    }
    return lib;
  }

  async addCustomExercise(part: string, name: string, unit: Unit): Promise<void> {
    const { error } = await this.sb
      .from("exercises")
      .insert({ body_part: part, name, unit, is_custom: true }); // user_id は default auth.uid()
    // 23505 = unique 制約違反（重複）。重複は無視する。
    if (error && error.code !== "23505") throw error;
  }

  async setExerciseInterval(name: string, intervalSec: number): Promise<void> {
    // ユーザー所有の同名種目の既定インターバルを更新（共通テンプレは RLS で更新不可のため対象外）。
    const { error } = await this.sb
      .from("exercises")
      .update({ interval_sec: Math.max(0, Math.round(intervalSec)) })
      // RLS の update ポリシーが本人所有の行のみ許可（共通テンプレは対象外）。
      .eq("name", name);
    if (error) throw error;
  }

  async getLogs(date: string): Promise<WorkoutLog[]> {
    const { data, error } = await this.sb
      .from("workout_logs")
      .select(LOG_SELECT)
      .eq("date", date)
      .order("order", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as unknown as LogRow[]).map(toLog);
  }

  async getMonthParts(month: string): Promise<Record<string, string[]>> {
    // month = "YYYY-MM"。[月初, 翌月初) の date・body_part を取得し日付ごとに集約。
    const [y, m] = month.split("-").map(Number);
    const start = `${month}-01`;
    const end = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;
    const { data, error } = await this.sb
      .from("workout_logs")
      .select("date,body_part")
      .gte("date", start)
      .lt("date", end);
    if (error) throw error;
    const map: Record<string, Set<string>> = {};
    for (const r of (data ?? []) as { date: string; body_part: string }[]) {
      (map[r.date] ??= new Set()).add(r.body_part);
    }
    const out: Record<string, string[]> = {};
    for (const [d, set] of Object.entries(map)) out[d] = Array.from(set);
    return out;
  }

  async addLog(date: string, name: string, part: string, unit: Unit, intervalSec: number): Promise<WorkoutLog> {
    const { count } = await this.sb
      .from("workout_logs")
      .select("id", { count: "exact", head: true })
      .eq("date", date);

    const { data, error } = await this.sb
      .from("workout_logs")
      .insert({ date, name, body_part: part, order: count ?? 0, unit, interval_sec: Math.max(0, Math.round(intervalSec)) }) // user_id は default auth.uid()
      .select(LOG_SELECT)
      .single();
    if (error) throw error;
    return toLog(data as unknown as LogRow);
  }

  async removeLog(logId: string): Promise<void> {
    const { error } = await this.sb.from("workout_logs").delete().eq("id", logId);
    if (error) throw error;
  }

  async setLogInterval(logId: string, intervalSec: number): Promise<void> {
    const { error } = await this.sb
      .from("workout_logs")
      .update({ interval_sec: Math.max(0, Math.round(intervalSec)) })
      .eq("id", logId);
    if (error) throw error;
  }

  async createGroup(logIds: string[]): Promise<string> {
    const groupId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const { error } = await this.sb.from("workout_logs").update({ group_id: groupId }).in("id", logIds);
    if (error) throw error;
    return groupId;
  }

  async ungroup(groupId: string): Promise<void> {
    const { error } = await this.sb.from("workout_logs").update({ group_id: null }).eq("group_id", groupId);
    if (error) throw error;
  }

  async addSet(logId: string, set: NewSet): Promise<WorkoutSet> {
    const { count } = await this.sb
      .from("workout_sets")
      .select("id", { count: "exact", head: true })
      .eq("workout_log_id", logId);

    const { data, error } = await this.sb
      .from("workout_sets")
      .insert({
        workout_log_id: logId,
        set_index: count ?? 0,
        weight: set.weight,
        reps: set.reps,
        bodyweight: set.bodyweight,
        drops: set.drops,
      })
      .select("id,weight,reps,bodyweight,drops")
      .single();
    if (error) throw error;
    return {
      id: data.id as string,
      weight: Number(data.weight),
      reps: data.reps as number,
      bodyweight: data.bodyweight as boolean,
      drops: ((data.drops ?? []) as SetStage[]).map((d) => ({ weight: Number(d.weight), reps: d.reps })),
    };
  }

  async updateSet(_logId: string, setId: string, set: NewSet): Promise<WorkoutSet> {
    const { data, error } = await this.sb
      .from("workout_sets")
      .update({ weight: set.weight, reps: set.reps, bodyweight: set.bodyweight, drops: set.drops })
      .eq("id", setId)
      .select("id,weight,reps,bodyweight,drops")
      .single();
    if (error) throw error;
    return {
      id: data.id as string,
      weight: Number(data.weight),
      reps: data.reps as number,
      bodyweight: data.bodyweight as boolean,
      drops: ((data.drops ?? []) as SetStage[]).map((d) => ({ weight: Number(d.weight), reps: d.reps })),
    };
  }

  async removeSet(_logId: string, setId: string): Promise<void> {
    const { error } = await this.sb.from("workout_sets").delete().eq("id", setId);
    if (error) throw error;
  }

  async getLastSession(date: string, name: string): Promise<LastSession> {
    const { data, error } = await this.sb
      .from("workout_logs")
      .select(LOG_SELECT)
      .eq("name", name)
      .lt("date", date)
      .order("date", { ascending: false })
      .limit(1);
    if (error) throw error;
    const rows = (data ?? []) as unknown as LogRow[];
    const log = rows[0] ? toLog(rows[0]) : null;
    if (!log || log.sets.length === 0) return null;
    const lastSet = log.sets[log.sets.length - 1];
    return { w: lastSet.weight, r: lastSet.reps, s: log.sets.length, bw: lastSet.bodyweight };
  }
}
