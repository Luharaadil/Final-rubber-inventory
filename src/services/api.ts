import Papa from "papaparse";
import { parse, isValid } from "date-fns";
import { InventoryRawRecord } from "../types";

const SHEET_IDS = {
  Extrusion: "1rVuQf4nBfpFrvDzUHfgYIbKSOvklZCGcOcKZ7zhHdcE",
  Calendering: "1T4tveDcNoiYCjDr6BABeKPfRBlWPUGl_8PRpPrwuiE8",
  Cutting: "1LeGsWB0HTLrY-8kb7rxvNh21Qj2-P9AJYhWz2BlfXo0",
};

const USERS_SHEET_ID = "1GHwq2tHt0ZDwuGHfTZSov6b2JgfURUKt7c8WLZWPGKs";
const CONSUMPTION_SHEET_ID = "1m79DT6yZNg_qJLzMikzVXIV84pFRq6NkItMDA-Wd6P8";

// Common date formats in sheets: MM/dd/yyyy HH:mm:ss
function parseSheetDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim().replace(/\s+/g, ' ');
  
  const formatsToTry = [
    "dd-MM-yyyy HH:mm:ss",
    "dd-MM-yyyy HH:mm",
    "dd/MM/yyyy HH:mm:ss",
    "dd/MM/yyyy HH:mm",
    "MM/dd/yyyy HH:mm:ss",
    "MM/dd/yyyy HH:mm",
    "yyyy/MM/dd HH:mm:ss",
    "yyyy/MM/dd HH:mm",
    "yyyy-MM-dd HH:mm:ss",
    "yyyy-MM-dd HH:mm",
    "yyyy/MM/dd",
    "yyyy-MM-dd",
    "dd-MM-yyyy",
    "dd/MM/yyyy",
    "MM/dd/yyyy",
    "M/d/yyyy H:m:s",
    "d/M/yyyy H:m:s",
    "M/d/yyyy H:m",
    "d/M/yyyy H:m",
    "M/d/yyyy",
    "d/M/yyyy",
    "yyyy/M/d HH:mm:ss",
    "yyyy/M/d HH:mm",
    "yyyy/M/d",
  ];
  
  const referenceDate = new Date();
  for (const formatStr of formatsToTry) {
    const parsed = parse(trimmed, formatStr, referenceDate);
    if (isValid(parsed)) return parsed;
  }

  const nativeParsed = new Date(trimmed);
  if (!isNaN(nativeParsed.getTime())) return nativeParsed;

  return null;
}

export async function fetchUsers(): Promise<Record<string, {password: string, role: string}>> {
  const users: Record<string, {password: string, role: string}> = {};
  try {
    const response = await fetch(`/api/sheet?id=${USERS_SHEET_ID}&gid=1782887198`);
    if (!response.ok) return users;
    
    const csvText = await response.text();
    Papa.parse(csvText, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as string[][];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (row.length >= 3) {
            users[row[0].trim()] = {
              password: row[1].trim(),
              role: row[2].trim(),
            };
          }
        }
      }
    });
  } catch (err) {
    console.error("Error fetching users:", err);
  }
  return users;
}

export async function fetchConsumptionRates(): Promise<Record<string, number>> {
  const consumptionRates: Record<string, number> = {};
  
  try {
    const response = await fetch(`/api/sheet?id=${CONSUMPTION_SHEET_ID}`);
    if (!response.ok) return consumptionRates;
    
    const csvText = await response.text();
    Papa.parse(csvText, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as string[][];
        // O column is index 14, T column is index 19. Start from 4th row (index 3)
        for (let i = 3; i < rows.length; i++) {
          const row = rows[i];
          if (row.length > 19) {
            const rawMaterial = row[14] || "";
            const batchesStr = row[19] || "";
            
            const rubberMatch = rawMaterial.match(/^(\d{4}F)/i);
            const rubberCode = rubberMatch ? rubberMatch[1].toUpperCase() : rawMaterial.trim();
            
            if (rubberCode) {
              const batches = parseFloat(batchesStr);
              if (!isNaN(batches)) {
                consumptionRates[rubberCode] = batches;
              }
            }
          }
        }
      }
    });
  } catch (err) {
    console.error("Error fetching consumption rates:", err);
  }
  
  return consumptionRates;
}

export async function fetchInventoryData(): Promise<{ records: InventoryRawRecord[]; errors: string[] }> {
  const allRecords: InventoryRawRecord[] = [];
  const errors: string[] = [];

  for (const [section, sheetId] of Object.entries(SHEET_IDS)) {
    try {
      const response = await fetch(`/api/sheet?id=${sheetId}`);
      if (!response.ok) {
        errors.push(`Failed to fetch ${section}: Google Sheet access denied. Ensure "Anyone with the link can view".`);
        continue;
      }
      
      const csvText = await response.text();
      
      if (csvText.startsWith("<!DOCTYPE html>")) {
        errors.push(`Failed to fetch ${section}: Received HTML. Ensure the sheet is public.`);
        continue;
      }

      Papa.parse(csvText, {
        header: false, // We'll rely on column indices since headers might vary
        skipEmptyLines: true,
        complete: (results) => {
          // Columns based on user input:
          // A (0) = Date/Time
          // C (2) = Barcode
          // F (5) = Material Name
          // G (6) = Weight
          const rows = results.data as string[][];
          
          for (let i = 1; i < rows.length; i++) { // Skip header row
            const row = rows[i];
            
            const dateStr = row[0];
            const barcode = row[2] || "";
            const rawMaterial = row[5] || "";
            const weightStr = row[6] || "";
            
            if (!dateStr || !rawMaterial) continue;
            
            const rubberMatch = rawMaterial.match(/^(\d{4}F)/i);
            const rubberCode = rubberMatch ? rubberMatch[1].toUpperCase() : rawMaterial.trim();
            
            if (!rubberCode) continue;

            const weight = parseFloat(weightStr);
            if (isNaN(weight)) continue;

            const timestamp = parseSheetDate(dateStr);
            if (!timestamp) continue;

            allRecords.push({
              timestamp,
              barcode,
              rubberCode,
              weight,
              section,
              isFinalRubber: !!rubberMatch
            });
          }
        },
      });
    } catch (err) {
      console.error(`Error processing ${section}:`, err);
      errors.push(`Error processing ${section}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  return { records: allRecords, errors };
}
