"use client";

import { useCallback, useEffect, useRef } from "react";

// タップ/スクロールの判別しきい値（px）。これを超える移動はスクロール扱いで増減しない。
const MOVE_THRESHOLD = 8;

/**
 * 長押し追従フック（仕様 §3.2 Tactical Counter）。
 * - 単発タップは「指を離した時」に1ステップ（押下即時に反映しない → スクロール誤爆を防ぐ）。
 * - 押下を 350ms 維持すると加速連打（約70ms間隔）。
 * - 押下後に MOVE_THRESHOLD 以上動いた / pointercancel（=ブラウザのスクロール開始）はキャンセル。
 *   touchAction: pan-y で縦スクロールはブラウザに委ね、スクロール時は増減しない。
 */
export function useHold(onStep: () => void) {
  const cb = useRef(onStep);
  cb.current = onStep;
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);
  const held = useRef(false); // 加速連打に入ったか（入った場合は離しても追加ステップしない）
  const moved = useRef(false); // しきい値を超えて動いたか（=スクロール）
  const origin = useRef({ x: 0, y: 0 });

  const clear = useCallback(() => {
    if (timeout.current) clearTimeout(timeout.current);
    if (interval.current) clearInterval(interval.current);
    timeout.current = null;
    interval.current = null;
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    moved.current = false;
    held.current = false;
    origin.current = { x: e.clientX, y: e.clientY };
    // 350ms 押し続けたら加速連打を開始（最初の1ステップもこのタイミング）
    timeout.current = setTimeout(() => {
      if (moved.current) return;
      held.current = true;
      cb.current();
      interval.current = setInterval(() => cb.current(), 70);
    }, 350);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (moved.current) return;
    if (Math.abs(e.clientX - origin.current.x) > MOVE_THRESHOLD ||
        Math.abs(e.clientY - origin.current.y) > MOVE_THRESHOLD) {
      moved.current = true; // スクロールと判断 → 以降このジェスチャでは増減しない
      clear();
    }
  }, [clear]);

  const onPointerUp = useCallback(() => {
    // 加速前 かつ 非スクロール のときだけ、離した瞬間に1ステップ
    if (!held.current && !moved.current) cb.current();
    clear();
    held.current = false;
  }, [clear]);

  const cancel = useCallback(() => {
    moved.current = true;
    clear();
    held.current = false;
  }, [clear]);

  useEffect(() => clear, [clear]);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    style: {
      touchAction: "pan-y" as const,
      userSelect: "none" as const,
      WebkitUserSelect: "none" as const,
      WebkitTouchCallout: "none" as const, // iOS の長押しコールアウト（選択/調べる等）を抑止
    },
  };
}
