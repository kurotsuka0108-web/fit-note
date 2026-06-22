"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * 長押し追従フック（仕様 §3.2 Tactical Counter）。
 * onPointerDown/Up で touch・mouse 両対応。350ms 押下後に約70ms間隔で加速連打。
 */
export function useHold(onStep: () => void) {
  const cb = useRef(onStep);
  cb.current = onStep;
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timeout.current) clearTimeout(timeout.current);
    if (interval.current) clearInterval(interval.current);
    timeout.current = null;
    interval.current = null;
  }, []);

  const start = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    cb.current();
    timeout.current = setTimeout(() => {
      interval.current = setInterval(() => cb.current(), 70);
    }, 350);
  }, []);

  useEffect(() => stop, [stop]);

  return {
    onPointerDown: start,
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    style: {
      touchAction: "none" as const,
      userSelect: "none" as const,
      WebkitUserSelect: "none" as const,
    },
  };
}
