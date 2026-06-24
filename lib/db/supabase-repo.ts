import type { SupabaseClient } from "@supabase/supabase-js";
import { DEMO_USER_ID } from "@/lib/env";
import { BODY_PARTS } from "./seed";
import type { Library, LastSession, NewSet, NoteRepo, SetStage, Unit, WorkoutLog, WorkoutSet } from "./types";

// Supabase 実装。migration 0001_init_note.sql のスキーマに対応。
// RLS はデモユーザー(DEMO_USER_ID)に限定（フェーズ2で auth.uid() に差し替え）。

type LogRow = {
  id: string;
  date: string;
  name: string;
  body_part: string;
  order: number;
  group_id: string | null;
  unit: Unit | null;
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
  return { id: row.id, date: row.date, name: row.name, part: row.body_part, order: row.order, groupId: row.group_id ?? null, unit: row.unit ?? "reps", sets };
}

const LOG_SELECT = 'id,date,name,body_part,order:"order",group_id,unit,workout_sets(id,weight,reps,set_index,bodyweight,drops)';

export class SupabaseNoteRepo implements NoteRepo {
  constructor(private sb: SupabaseClient) {}

  async getLibrary(): Promise<Library> {
    const { data, error } = await this.sb
      .from("exercises")
      .select("body_part,name,unit,created_at")
      .or(`user_id.is.null,user_id.eq.${DEMO_USER_ID}`)
      .order("created_at", { ascending: true });
    if (error) throw error;

    const lib: Library = {};
    for (const part of BODY_PARTS) lib[part] = [];
    for (const row of data ?? []) {
      const part = row.body_part as string;
      (lib[part] ??= []).push({ name: row.name as string, unit: ((row.unit as Unit) ?? "reps") });
    }
    return lib;
  }

  async addCustomExercise(part: string, name: string, unit: Unit): Promise<void> {
    const { error } = await this.sb
      .from("exercises")
      .insert({ user_id: DEMO_USER_ID, body_part: part, name, unit, is_custom: true });
    // 23505 = unique 制約違反（重複）。重複は無視する。
    if (error && error.code !== "23505") throw error;
  }

  async getLogs(date: string): Promise<WorkoutLog[]> {
    const { data, error } = await this.sb
      .from("workout_logs")
      .select(LOG_SELECT)
      .eq("user_id", DEMO_USER_ID)
      .eq("date", date)
      .order("order", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as unknown as LogRow[]).map(toLog);
  }

  async addLog(date: string, name: string, part: string, unit: Unit): Promise<WorkoutLog> {
    const { count } = await this.sb
      .from("workout_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", DEMO_USER_ID)
      .eq("date", date);

    const { data, error } = await this.sb
      .from("workout_logs")
      .insert({ user_id: DEMO_USER_ID, date, name, body_part: part, order: count ?? 0, unit })
      .select(LOG_SELECT)
      .single();
    if (error) throw error;
    return toLog(data as unknown as LogRow);
  }

  async removeLog(logId: string): Promise<void> {
    const { error } = await this.sb.from("workout_logs").delete().eq("id", logId);
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
      .eq("user_id", DEMO_USER_ID)
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
