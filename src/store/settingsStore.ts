import { create } from "zustand";
import { persist } from "zustand/middleware";

type FontSize = "sm" | "base" | "lg";

interface SettingsState {
  groqApiKey: string;
  preferredFontSize: FontSize;
  setGroqApiKey: (key: string) => void;
  setFontSize: (s: FontSize) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      groqApiKey: "",
      preferredFontSize: "base",
      setGroqApiKey: (key) => set({ groqApiKey: key }),
      setFontSize: (s) => set({ preferredFontSize: s }),
    }),
    { name: "physics-settings-v1" },
  ),
);
