"use client";

import { create } from "zustand";

interface CityState {
  selectedId: string | null;
  focusVersion: number;
  selectBuilding: (buildingId: string) => void;
  clearSelection: () => void;
}

export const useCityStore = create<CityState>((set) => ({
  selectedId: null,
  focusVersion: 0,
  selectBuilding: (buildingId) => set((state) => ({ selectedId: buildingId, focusVersion: state.focusVersion + 1 })),
  clearSelection: () => set({ selectedId: null }),
}));
