export interface ShiftInterval {
  start: string; // HH:mm format
  end: string;   // HH:mm format
}

export type ShiftType = 'A' | 'B' | 'C';

export interface AppSettings {
  shifts: Record<ShiftType, ShiftInterval>;
  consumptionRates: Record<string, number>; // key: rubber code, value: batches per day
}

export interface InventoryRawRecord {
  timestamp: Date;
  barcode: string;
  rubberCode: string; // First 4 digits + "F"
  weight: number;
  section: string;
}

export interface RubberStock {
  rubberCode: string;
  totalWeight: number;
  totalBatches: number;
  estimatedHoursLeft: number | null;
  section: string;
  items: InventoryRawRecord[];
}

export interface User {
  id: string;
  role: string;
}
