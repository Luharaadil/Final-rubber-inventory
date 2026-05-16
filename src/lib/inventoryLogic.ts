import { startOfDay, parse, addDays, isWithinInterval } from "date-fns";
import { AppSettings, InventoryRawRecord, RubberStock, ShiftType } from "../types";

const BATCH_WEIGHT_KG = 196;

export function filterRecordsByShift(
  records: InventoryRawRecord[],
  selectedDate: Date,
  selectedShift: ShiftType | "ALL",
  settings: AppSettings
): InventoryRawRecord[] {
  if (selectedShift === "ALL") {
    // Just filter by the start and end of the day globally?
    // Or if ALL, maybe we just show everything for that single calendar day.
    const start = startOfDay(selectedDate);
    const end = addDays(start, 1);
    return records.filter((r) => r.timestamp >= start && r.timestamp < end);
  }

  const shiftConfig = settings.shifts[selectedShift];
  const baseDateStr = parse("00:00", "HH:mm", selectedDate);
  const startTime = parse(shiftConfig.start, "HH:mm", selectedDate);
  let endTime = parse(shiftConfig.end, "HH:mm", selectedDate);

  // If end time is mathematically less than start time, it means cross-midnight shift
  if (endTime <= startTime) {
    endTime = addDays(endTime, 1);
  }

  return records.filter((r) => isWithinInterval(r.timestamp, { start: startTime, end: endTime }));
}

export function calculateStocks(records: InventoryRawRecord[], settings: AppSettings): RubberStock[] {
  const stockMap = new Map<string, RubberStock>();

  for (const record of records) {
    const key = `${record.section}-${record.rubberCode}`;
    if (!stockMap.has(key)) {
      stockMap.set(key, {
        rubberCode: record.rubberCode,
        section: record.section,
        totalWeight: 0,
        totalBatches: 0,
        estimatedHoursLeft: null,
        items: [],
      });
    }

    const stock = stockMap.get(key)!;
    stock.totalWeight += record.weight;
    stock.items.push(record);
  }

  const results: RubberStock[] = [];
  for (const stock of Array.from(stockMap.values())) {
    stock.totalBatches = stock.totalWeight / BATCH_WEIGHT_KG;
    
    // settings.consumptionRates is in batches/day now (from fetchConsumptionRates)
    const dailyConsumptionBatches = settings.consumptionRates[stock.rubberCode];
    if (dailyConsumptionBatches && dailyConsumptionBatches > 0) {
      // Hours left = Total Batches / (Consumption Batches per Hour)
      // Consumption Batches per Hour = dailyConsumptionBatches / 24
      stock.estimatedHoursLeft = stock.totalBatches / (dailyConsumptionBatches / 24);
    }

    results.push(stock);
  }

  // Sort by section order, then by rubber code
  const sectionOrder: Record<string, number> = {
    "Extrusion": 1,
    "Calendering": 2,
    "Cutting": 3,
  };

  return results.sort((a, b) => {
    const orderA = sectionOrder[a.section] || 99;
    const orderB = sectionOrder[b.section] || 99;
    if (orderA !== orderB) return orderA - orderB;
    return a.rubberCode.localeCompare(b.rubberCode);
  });
}
