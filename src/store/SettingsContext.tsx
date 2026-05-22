import React, { createContext, useContext, useEffect, useState } from "react";
import { AppSettings, ShiftType } from "../types";

const DEFAULT_SETTINGS: AppSettings = {
  shifts: {
    A: { start: "05:00", end: "11:00" },
    B: { start: "11:00", end: "19:00" },
    C: { start: "19:00", end: "05:00" },
  },
  consumptionRates: {},
};

interface SettingsContextType {
  settings: AppSettings;
  updateShift: (shift: ShiftType, start: string, end: string) => void;
  updateConsumption: (rubberCode: string, rate: number) => void;
  removeConsumption: (rubberCode: string) => void;
  syncConsumption: (rates: Record<string, number>) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem("inventory_settings");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse settings");
      }
    }
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem("inventory_settings", JSON.stringify(settings));
  }, [settings]);

  const updateShift = (shift: ShiftType, start: string, end: string) => {
    setSettings((prev) => ({
      ...prev,
      shifts: {
        ...prev.shifts,
        [shift]: { start, end },
      },
    }));
  };

  const updateConsumption = (rubberCode: string, rate: number) => {
    setSettings((prev) => ({
      ...prev,
      consumptionRates: {
        ...prev.consumptionRates,
        [rubberCode]: rate,
      },
    }));
  };

  const removeConsumption = (rubberCode: string) => {
    setSettings((prev) => {
      const copy = { ...prev };
      delete copy.consumptionRates[rubberCode];
      return copy;
    });
  };

  const syncConsumption = (rates: Record<string, number>) => {
    setSettings((prev) => ({
      ...prev,
      consumptionRates: rates
    }));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateShift, updateConsumption, removeConsumption, syncConsumption }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettings must be used within SettingsProvider");
  return context;
}
