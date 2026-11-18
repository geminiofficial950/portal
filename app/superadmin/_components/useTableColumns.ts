"use client";

import { useState, useSyncExternalStore, type DragEvent, type PointerEvent } from "react";

export type ColumnDef<K extends string> = { key: K; label: string; width: number; min?: number };
type Layout = { order?: string[]; widths?: Record<string, number> };

// Saved layouts live in this browser's storage; listeners re-render tables when one is saved
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => (listeners.add(fn), () => listeners.delete(fn));
const readStored = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const parse = (raw: string | null): Layout => {
  try {
    return (raw && (JSON.parse(raw) as Layout)) || {};
  } catch {
    return {};
  }
};
const setResizing = (on: boolean) => document.documentElement.classList.toggle("col-resizing", on);

// Columns that can be resized (drag the right edge of a header) and moved (drag a header onto another).
// The order and widths are remembered in this browser only.
export function useTableColumns<K extends string>(storageKey: string, defs: ColumnDef<K>[]) {
  const stored = useSyncExternalStore(subscribe, () => readStored(storageKey), () => null);
  const [memory, setMemory] = useState<string | null>(null); // used when the browser won't store it
  const [live, setLive] = useState<Record<string, number> | null>(null); // widths while dragging an edge
  const [dragKey, setDragKey] = useState<K | null>(null);
  const [overKey, setOverKey] = useState<K | null>(null);

  const keys = defs.map((d) => d.key);
  const layout = parse(memory ?? stored);
  const order = [...new Set([...(layout.order ?? []).filter((k): k is K => keys.includes(k as K)), ...keys])];
  const widths = { ...Object.fromEntries(defs.map((d) => [d.key, d.width])), ...(layout.widths ?? {}), ...(live ?? {}) } as Record<string, number>;

  const save = (o: K[], w: Record<string, number>) => {
    const raw = JSON.stringify({ order: o, widths: w });
    setMemory(raw);
    try {
      localStorage.setItem(storageKey, raw);
    } catch {}
    listeners.forEach((fn) => fn());
  };

  const cols = order.map((k) => {
    const d = defs.find((x) => x.key === k)!;
    return { ...d, width: Math.max(d.min ?? 80, Number(widths[k]) || d.width) };
  });

  const startResize = (key: K, e: PointerEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const min = defs.find((d) => d.key === key)?.min ?? 80;
    const startX = e.clientX;
    // start from the width on screen (columns stretch to fill a wide table), so the edge follows the mouse
    const shown = e.currentTarget.parentElement?.getBoundingClientRect().width;
    const startW = Math.round(shown || cols.find((c) => c.key === key)!.width);
    // fix every column at its on-screen width first, so only the dragged one changes
    const ths = [...(e.currentTarget.closest("tr")?.children ?? [])];
    let latest: Record<string, number> = { ...widths, ...Object.fromEntries(cols.map((c, i) => [c.key, Math.round(ths[i]?.getBoundingClientRect().width || c.width)])) };
    const move = (ev: globalThis.PointerEvent) => {
      latest = { ...latest, [key]: Math.max(min, Math.round(startW + ev.clientX - startX)) };
      setLive(latest);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setResizing(false);
      save(order, latest);
      setLive(null);
    };
    setResizing(true);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const moveColumn = (from: K, to: K) => {
    if (from === to) return;
    const next = order.filter((k) => k !== from);
    next.splice(next.indexOf(to) + (order.indexOf(from) < order.indexOf(to) ? 1 : 0), 0, from);
    save(next, widths);
  };

  const clear = () => {
    setDragKey(null);
    setOverKey(null);
  };

  // spread onto the header cell
  const dragProps = (key: K) => ({
    draggable: true,
    onDragStart: (e: DragEvent<HTMLElement>) => {
      setDragKey(key);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", key);
    },
    onDragOver: (e: DragEvent<HTMLElement>) => {
      if (!dragKey) return;
      e.preventDefault();
      if (overKey !== key) setOverKey(key);
    },
    onDrop: (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      if (dragKey) moveColumn(dragKey, key);
      clear();
    },
    onDragEnd: clear,
  });

  return { cols, startResize, dragProps, moveColumn, dragKey, overKey, totalWidth: cols.reduce((n, c) => n + c.width, 0) };
}
