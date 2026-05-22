import { parse, isValid } from "date-fns";
import { InventoryRawRecord } from "../types";

const SHEET_IDS = {
  Extrusion: "1rVuQf4nBfpFrvDzUHfgYIbKSOvklZCGcOcKZ7zhHdcE",
  Calendering: "1T4tveDcNoiYCjDr6BABeKPfRBlWPUGl_8PRpPrwuiE8",
  Cutting: "1LeGsWB0HTLrY-8kb7rxvNh21Qj2-P9AJYhWz2BlfXo0",
};

const USERS_SHEET_ID = "1GHwq2tHt0ZDwuGHfTZSov6b2JgfURUKt7c8WLZWPGKs";
const CONSUMPTION_SHEET_ID = "1m79DT6yZNg_qJLzMikzVXIV84pFRq6NkItMDA-Wd6P8";

// --- JSONP Helper for Google Sheets ---
async function fetchSheetData(sheetId: string, gid?: string): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    const cbName = 'sheet_cb_' + Math.random().toString(36).substring(2, 11);
    const tqx = `out:json;responseHandler:${cbName}`;
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=${tqx}${gid ? `&gid=${gid}` : ''}`;
    
    const script = document.createElement('script');
    script.src = url;
    
    (window as any)[cbName] = (data: any) => {
      document.head.removeChild(script);
      delete (window as any)[cbName];
      
      try {
        const rows: string[][] = [];
        if (data && data.table && data.table.cols) {
          rows.push(data.table.cols.map((c: any) => c ? String(c.label || '') : ''));
        }
        if (data && data.table && data.table.rows) {
          for (const row of data.table.rows) {
            if (!row || !row.c) continue;
            const rData = row.c.map((cell: any) => {
              if (!cell) return '';
              if (cell.f !== undefined && cell.f !== null) return String(cell.f);
              if (cell.v !== undefined && cell.v !== null) return String(cell.v);
              return '';
            });
            rows.push(rData);
          }
        }
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    
    script.onerror = () => {
      document.head.removeChild(script);
      delete (window as any)[cbName];
      reject(new Error("JSONP fetch failed"));
    };
    
    document.head.appendChild(script);
  });
}

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
    const rows = await fetchSheetData(USERS_SHEET_ID, "1782887198");
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length >= 3 && row[0]) {
        users[row[0].trim()] = {
          password: String(row[1] || "").trim(),
          role: String(row[2] || "").trim(),
        };
      }
    }
  } catch (err) {
    console.error("Error fetching users:", err);
  }
  return users;
}

export async function fetchConsumptionRates(): Promise<Record<string, number>> {
  const consumptionRates: Record<string, number> = {};
  
  try {
    const rows = await fetchSheetData(CONSUMPTION_SHEET_ID);
    // O column is index 14, T column is index 19. Start from 4th row (index 3)
    for (let i = 3; i < rows.length; i++) {
      const row = rows[i];
      if (row.length > 19) {
        const rawMaterial = String(row[14] || "");
        const batchesStr = String(row[19] || "");
        
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
      const rows = await fetchSheetData(sheetId);
      
      // Columns based on user input:
      // A (0) = Date/Time
      // C (2) = Barcode
      // F (5) = Material Name
      // G (6) = Weight
      for (let i = 1; i < rows.length; i++) { // Skip header row
        const row = rows[i];
        if (!row || row.length < 7) continue;
        
        const dateStr = String(row[0] || "");
        const barcode = String(row[2] || "");
        const rawMaterial = String(row[5] || "");
        const weightStr = String(row[6] || "").replace(/,/g, ''); // Handle comma thousands separator just in case
        
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
    } catch (err) {
      console.error(`Error processing ${section}:`, err);
      errors.push(`Failed to fetch ${section}: Google Sheet access denied. Ensure "Anyone with the link can view".`);
    }
  }

  return { records: allRecords, errors };
}
