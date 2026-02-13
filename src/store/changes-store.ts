import { create } from "zustand";
import type { PendingChange } from "@/types";

interface ChangesState {
  changes: PendingChange[];
  addChange: (change: PendingChange) => void;
  addChanges: (changes: PendingChange[]) => void;
  removeChange: (id: string) => void;
  updateChange: (id: string, updates: Partial<PendingChange>) => void;
  clearChanges: () => void;
  applyingChanges: boolean;
  setApplyingChanges: (applying: boolean) => void;
  lastApplyError: string | null;
  setLastApplyError: (error: string | null) => void;
}

export const useChangesStore = create<ChangesState>((set) => ({
  changes: [],
  addChange: (change) =>
    set((state) => ({ changes: [...state.changes, change] })),
  addChanges: (newChanges) =>
    set((state) => ({ changes: [...state.changes, ...newChanges] })),
  removeChange: (id) =>
    set((state) => ({ changes: state.changes.filter((c) => c.id !== id) })),
  updateChange: (id, updates) =>
    set((state) => ({
      changes: state.changes.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),
  clearChanges: () => set({ changes: [] }),
  applyingChanges: false,
  setApplyingChanges: (applying) => set({ applyingChanges: applying }),
  lastApplyError: null,
  setLastApplyError: (error) => set({ lastApplyError: error }),
}));

let changeCounter = 0;
export function generateChangeId(): string {
  changeCounter++;
  return `change-${Date.now()}-${changeCounter}`;
}
