import { BODY_PARTS, EXERCISE_LIBRARY_SEED } from "./seed";
import type { Library, LastSession, NewSet, NoteRepo, WorkoutLog, WorkoutSet } from "./types";

// Supabase 未設定時のフォールバック。ブラウザの localStorage に永続化する。
// （リロードしても残る = 受け入れ基準を満たす。本番は Supabase 実装に切替）

const KEY = "fitnote.note.v1";

type Store = {
  custom: Library; // ユーザー追加の種目（部位別）
  logs: WorkoutLog[]; // 全日付のログ
};

const uid = (): string =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function load(): Store {
  if (typeof window === "undefined") return { custom: {}, logs: [] };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { custom: {}, logs: [] };
    const parsed = JSON.parse(raw) as Partial<Store>;
    return { custom: parsed.custom ?? {}, logs: parsed.logs ?? [] };
  } catch {
    return { custom: {}, logs: [] };
  }
}

function save(store: Store): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(store));
}

export class LocalNoteRepo implements NoteRepo {
  async getLibrary(): Promise<Library> {
    const { custom } = load();
    // seed をベースに、ユーザー追加分を部位ごとにマージ（重複排除・seed順を維持）
    const lib: Library = {};
    for (const part of BODY_PARTS) {
      const seeded = EXERCISE_LIBRARY_SEED[part] ?? [];
      const added = (custom[part] ?? []).filter((n) => !seeded.includes(n));
      lib[part] = [...seeded, ...added];
    }
    return lib;
  }

  async addCustomExercise(part: string, name: string): Promise<void> {
    const store = load();
    const seeded = EXERCISE_LIBRARY_SEED[part] ?? [];
    const list = store.custom[part] ?? [];
    if (seeded.includes(name) || list.includes(name)) return; // 重複は無視
    store.custom[part] = [...list, name];
    save(store);
  }

  async getLogs(date: string): Promise<WorkoutLog[]> {
    return load()
      .logs.filter((l) => l.date === date)
      .sort((a, b) => a.order - b.order)
      // 旧データ（bodyweight / drops 未保存）を正規化
      .map((l) => ({
        ...l,
        sets: l.sets.map((s) => ({ ...s, bodyweight: s.bodyweight ?? false, drops: s.drops ?? [] })),
      }));
  }

  async addLog(date: string, name: string, part: string): Promise<WorkoutLog> {
    const store = load();
    const sameDay = store.logs.filter((l) => l.date === date);
    const log: WorkoutLog = {
      id: uid(),
      date,
      name,
      part,
      order: sameDay.length,
      sets: [],
    };
    store.logs.push(log);
    save(store);
    return log;
  }

  async removeLog(logId: string): Promise<void> {
    const store = load();
    store.logs = store.logs.filter((l) => l.id !== logId);
    save(store);
  }

  async addSet(logId: string, set: NewSet): Promise<WorkoutSet> {
    const store = load();
    const log = store.logs.find((l) => l.id === logId);
    if (!log) throw new Error("ログが見つかりません");
    const created: WorkoutSet = {
      id: uid(),
      weight: set.weight,
      reps: set.reps,
      bodyweight: set.bodyweight,
      drops: set.drops,
    };
    log.sets.push(created);
    save(store);
    return created;
  }

  async removeSet(logId: string, setId: string): Promise<void> {
    const store = load();
    const log = store.logs.find((l) => l.id === logId);
    if (!log) return;
    log.sets = log.sets.filter((s) => s.id !== setId);
    save(store);
  }

  async getLastSession(date: string, name: string): Promise<LastSession> {
    const prior = load()
      .logs.filter((l) => l.name === name && l.date < date && l.sets.length > 0)
      .sort((a, b) => (a.date < b.date ? 1 : -1)); // 日付降順
    const last = prior[0];
    if (!last) return null;
    const lastSet = last.sets[last.sets.length - 1];
    return { w: lastSet.weight, r: lastSet.reps, s: last.sets.length, bw: lastSet.bodyweight ?? false };
  }
}
