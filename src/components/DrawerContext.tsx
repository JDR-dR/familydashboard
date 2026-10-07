"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from "react";

/**
 * The drawer used to live in the URL, which meant opening or closing it was a
 * navigation: a full server re-render of the page behind it, every time. It is
 * now client state, and the URL is kept in step with history.replaceState so a
 * link to an item still opens it.
 */

export interface DrawerTarget {
  itemId: string | null;
  kind: string | null;
  presets: Record<string, string>;
}

interface DrawerApi extends DrawerTarget {
  openItem: (id: string) => void;
  createItem: (kind: string, presets?: Record<string, string>) => void;
  close: () => void;
}

const DrawerContext = createContext<DrawerApi | null>(null);

const EMPTY: DrawerTarget = { itemId: null, kind: null, presets: {} };
const PRESET_KEYS = ["category", "projectId", "type", "slot", "section", "who", "stage"];

function writeUrl(target: DrawerTarget) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  for (const key of ["item", "new", ...PRESET_KEYS]) url.searchParams.delete(key);
  if (target.itemId) url.searchParams.set("item", target.itemId);
  else if (target.kind) {
    url.searchParams.set("new", target.kind);
    for (const [key, value] of Object.entries(target.presets)) url.searchParams.set(key, value);
  }
  // replaceState, not router.push: the URL changes without a server round trip.
  window.history.replaceState(window.history.state, "", url.toString());
}

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<DrawerTarget>(EMPTY);

  // A shared link that already names an item opens it on first load.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const item = params.get("item");
    const kind = params.get("new");
    if (!item && !kind) return;
    const presets: Record<string, string> = {};
    for (const key of PRESET_KEYS) {
      const value = params.get(key);
      if (value) presets[key] = value;
    }
    setTarget({ itemId: item, kind, presets });
  }, []);

  const openItem = useCallback((id: string) => {
    const next = { itemId: id, kind: null, presets: {} };
    setTarget(next);
    writeUrl(next);
  }, []);

  const createItem = useCallback((kind: string, presets: Record<string, string> = {}) => {
    const next = { itemId: null, kind, presets };
    setTarget(next);
    writeUrl(next);
  }, []);

  const close = useCallback(() => {
    setTarget(EMPTY);
    writeUrl(EMPTY);
  }, []);

  const value = useMemo<DrawerApi>(
    () => ({ ...target, openItem, createItem, close }),
    [target, openItem, createItem, close],
  );

  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>;
}

export function useDrawer(): DrawerApi {
  const context = useContext(DrawerContext);
  if (!context) throw new Error("useDrawer must be used inside DrawerProvider");
  return context;
}
