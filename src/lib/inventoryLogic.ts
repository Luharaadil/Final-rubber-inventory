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

export function calculateStocks(records: InventoryRawRecord[], settings: AppSettings, allRecords?: InventoryRawRecord[]): RubberStock[] {
  const stockMap = new Map<string, RubberStock>();

  for (const record of records) {
    let code = record.rubberCode;
    if (code === "A19010090") {
      code = "0.955MM";
    }
    const key = `${record.section}-${code}`;
    if (!stockMap.has(key)) {
      stockMap.set(key, {
        rubberCode: code,
        section: record.section,
        totalWeight: 0,
        totalBatches: 0,
        estimatedHoursLeft: null,
        isFinalRubber: record.isFinalRubber,
        items: [],
      });
    }

    const stock = stockMap.get(key)!;
    stock.totalWeight += record.weight;
    stock.items.push({...record, rubberCode: code});
  }

  // Ensure all consumed rubbers are shown even if inventory is 0
  if (settings.consumptionRates) {
    for (const rubberCode of Object.keys(settings.consumptionRates)) {
      const rate = settings.consumptionRates[rubberCode];
      if (rate > 0) {
        const exists = Array.from(stockMap.values()).some((s) => s.rubberCode === rubberCode);
        if (!exists) {
          // Try to find historical section, else default
          let section = "Extrusion";
          let isFinalRubber = !!rubberCode.match(/^(\d{4}F)/i);
          if (allRecords) {
            const past = allRecords.find((r) => r.rubberCode === rubberCode);
            if (past) {
              section = past.section;
              isFinalRubber = past.isFinalRubber ?? isFinalRubber;
            }
          }
          const key = `${section}-${rubberCode}`;
          stockMap.set(key, {
            rubberCode,
            section,
            totalWeight: 0,
            totalBatches: 0,
            estimatedHoursLeft: 0,
            isFinalRubber,
            items: [],
          });
        }
      }
    }
  }

  const ROLL_WEIGHTS: Record<string, number> = {
    "0.955MM": 468,
    "N723J22": 770,
    "N723I22": 770,
    "N728122": 754,
    "N728I22": 754,
    "N728J22": 754,
    "N725122": 768,
    "N725J22": 768,
    "N725I22": 768,
    "NA22GDP": 395
  };

  const results: RubberStock[] = [];
  for (const stock of Array.from(stockMap.values())) {
    const dailyConsumptionBatches = settings.consumptionRates ? settings.consumptionRates[stock.rubberCode] : 0;
    
    // Extrusion "RM16", "RM32", "RM55" should not display at all
    if (stock.section === "Extrusion" && ["RM16", "RM32", "RM55"].includes(stock.rubberCode)) {
      continue;
    }

    // Don't show anything with <= 0 inventory and <= 0 usage
    if (stock.totalWeight <= 0 && (!dailyConsumptionBatches || dailyConsumptionBatches <= 0)) {
      continue;
    }

    if (stock.isFinalRubber) {
      stock.totalBatches = stock.totalWeight / BATCH_WEIGHT_KG;
    } else {
      if (stock.rubberCode in ROLL_WEIGHTS) {
        stock.totalBatches = stock.items.length;
      } else {
        // Fallback for any other non-final rubbers
        stock.totalBatches = Math.round(stock.totalWeight);
      }
    }
    
    // settings.consumptionRates is in batches/day now (from fetchConsumptionRates)
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
