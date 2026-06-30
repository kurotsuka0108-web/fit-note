import { BODY_PARTS, DEFAULT_INTERVAL_SEC, defaultUnit, EXERCISE_LIBRARY_SEED } from "./seed";
import type { ExerciseDef, Library, LastSession, NewSet, NoteRepo, Unit, WorkoutLog, WorkoutSet } from "./types";

// Supabase 未設定時のフォールバック。ブラウザの localStorage に永続化する。
// （リロードしても残る = 受け入れ基準を満たす。本番は Supabase 実装に切替）

const KEY = "fitnote.note.v1";

type Store = {
  custom: Library; // ユーザー追加の種目（部位別）
  logs: WorkoutLog[]; // 全日付のログ
  intervalByName?: Record<string, number>; // 種目ごとに記憶した既定インターバル秒
};

const uid = (): string =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

// 旧データ互換: custom は以前 string[] で保存していたため ExerciseDef[] へ正規化する。
function normalizeCustom(custom: unknown): Library {
  const out: Library = {};
  if (!custom || typeof custom !== "object") return out;
  for (const [part, list] of Object.entries(custom as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue;
    out[part] = list.map((e): ExerciseDef => {
      if (typeof e === "string") return { name: e, unit: defaultUnit(e), intervalSec: DEFAULT_INTERVAL_SEC };
      const d = e as Partial<ExerciseDef>;
      return { name: d.name ?? "", unit: d.unit ?? "reps", intervalSec: d.intervalSec ?? DEFAULT_INTERVAL_SEC };
    });
  }
  return out;
}

function load(): Store {
  if (typeof window === "undefined") return { custom: {}, logs: [], intervalByName: {} };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { custom: {}, logs: [], intervalByName: {} };
    const parsed = JSON.parse(raw) as Partial<Store>;
    return { custom: normalizeCustom(parsed.custom), logs: parsed.logs ?? [], intervalByName: parsed.intervalByName ?? {} };
  } catch {
    return { custom: {}, logs: [], intervalByName: {} };
  }
}

function save(store: Store): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(store));
}

export class LocalNoteRepo implements NoteRepo {
  async getLibrary(): Promise<Library> {
    const { custom, intervalByName = {} } = load();
    // seed をベースに、ユーザー追加分を部位ごとにマージ（名前で重複排除・seed順を維持）。
    // インターバルは記憶した値（intervalByName）があれば優先。
    const lib: Library = {};
    const withPref = (d: ExerciseDef): ExerciseDef => ({ ...d, intervalSec: intervalByName[d.name] ?? d.intervalSec ?? DEFAULT_INTERVAL_SEC });
    for (const part of BODY_PARTS) {
      const seeded = EXERCISE_LIBRARY_SEED[part] ?? [];
      const names = new Set(seeded.map((d) => d.name));
      const added = (custom[part] ?? []).filter((d) => !names.has(d.name));
      lib[part] = [...seeded, ...added].map(withPref);
    }
    return lib;
  }

  async addCustomExercise(part: string, name: string, unit: Unit): Promise<void> {
    const store = load();
    const seeded = EXERCISE_LIBRARY_SEED[part] ?? [];
    const list = store.custom[part] ?? [];
    if (seeded.some((d) => d.name === name) || list.some((d) => d.name === name)) return; // 重複は無視
    store.custom[part] = [...list, { name, unit, intervalSec: DEFAULT_INTERVAL_SEC }];
    save(store);
  }

  async setExerciseInterval(name: string, intervalSec: number): Promise<void> {
    const store = load();
    const map = store.intervalByName ?? {};
    map[name] = Math.max(0, Math.round(intervalSec));
    store.intervalByName = map;
    save(store);
  }

  async getLogs(date: string): Promise<WorkoutLog[]> {
    return load()
      .logs.filter((l) => l.date === date)
      .sort((a, b) => a.order - b.order)
      // 旧データ（bodyweight / drops / groupId / unit / intervalSec 未保存）を正規化
      .map((l) => ({
        ...l,
        groupId: l.groupId ?? null,
        unit: l.unit ?? "reps",
        intervalSec: l.intervalSec ?? DEFAULT_INTERVAL_SEC,
        sets: l.sets.map((s) => ({ ...s, bodyweight: s.bodyweight ?? false, drops: s.drops ?? [] })),
      }));
  }

  async getMonthParts(month: string): Promise<Record<string, string[]>> {
    // month = "YYYY-MM"。日付ごとに実施部位を重複なしで集める。
    const map: Record<string, Set<string>> = {};
    for (const l of load().logs) {
      if (!l.date.startsWith(`${month}-`)) continue;
      (map[l.date] ??= new Set()).add(l.part);
    }
    const out: Record<string, string[]> = {};
    for (const [d, set] of Object.entries(map)) out[d] = Array.from(set);
    return out;
  }

  async addLog(date: string, name: string, part: string, unit: Unit, intervalSec: number): Promise<WorkoutLog> {
    const store = load();
    const sameDay = store.logs.filter((l) => l.date === date);
    const log: WorkoutLog = {
      id: uid(),
      date,
      name,
      part,
      order: sameDay.length,
      groupId: null,
      unit,
      intervalSec: Math.max(0, Math.round(intervalSec)),
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

  async setLogInterval(logId: string, intervalSec: number): Promise<void> {
    const store = load();
    const log = store.logs.find((l) => l.id === logId);
    if (!log) return;
    log.intervalSec = Math.max(0, Math.round(intervalSec));
    save(store);
  }

  async createGroup(logIds: string[]): Promise<string> {
    const store = load();
    const groupId = uid();
    for (const l of store.logs) if (logIds.includes(l.id)) l.groupId = groupId;
    save(store);
    return groupId;
  }

  async ungroup(groupId: string): Promise<void> {
    const store = load();
    for (const l of store.logs) if (l.groupId === groupId) l.groupId = null;
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

  async updateSet(logId: string, setId: string, set: NewSet): Promise<WorkoutSet> {
    const store = load();
    const log = store.logs.find((l) => l.id === logId);
    if (!log) throw new Error("ログが見つかりません");
    const target = log.sets.find((s) => s.id === setId);
    if (!target) throw new Error("セットが見つかりません");
    target.weight = set.weight;
    target.reps = set.reps;
    target.bodyweight = set.bodyweight;
    target.drops = set.drops;
    save(store);
    return { ...target };
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
