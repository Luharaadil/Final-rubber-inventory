import React, { useState, useEffect, useMemo, useRef } from "react";
import { format } from "date-fns";
import * as htmlToImage from "html-to-image";
import { fetchInventoryData, fetchConsumptionRates } from "../services/api";
import { InventoryRawRecord, RubberStock, ShiftType } from "../types";
import { useSettings } from "../store/SettingsContext";
import { useAuth } from "../store/AuthContext";
import { filterRecordsByShift, calculateStocks } from "../lib/inventoryLogic";
import { SettingsModal } from "./SettingsModal";
import { DetailsModal } from "./DetailsModal";
import { Settings2, RefreshCw, Calendar, Clock, PackageOpen, AlertCircle, Camera, LogOut, Copy } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../lib/utils";

export function Dashboard() {
  const { user, logout } = useAuth();
  const { settings, syncConsumption } = useSettings();
  
  const [allRecords, setAllRecords] = useState<InventoryRawRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [copying, setCopying] = useState(false);
  const [copyingText, setCopyingText] = useState(false);

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedShift, setSelectedShift] = useState<ShiftType | "ALL">("ALL");
  const [filterType, setFilterType] = useState<"ALL_RUBBER" | "OTHER">("ALL_RUBBER");

  const [filteredStocks, setFilteredStocks] = useState<RubberStock[]>([]);
  
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  
  const [detailsCode, setDetailsCode] = useState<string | null>(null);
  const [detailsItems, setDetailsItems] = useState<InventoryRawRecord[]>([]);
  
  const printRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [inventoryResponse, rates] = await Promise.all([
        fetchInventoryData(),
        fetchConsumptionRates()
      ]);
      setAllRecords(inventoryResponse.records);
      if (inventoryResponse.errors.length > 0) {
        setError(inventoryResponse.errors.join("\n"));
      }
      if (Object.keys(rates).length > 0) {
        syncConsumption(rates);
      }
    } catch (err) {
      setError("Failed to fetch data. Please check connection.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const filtered = filterRecordsByShift(allRecords, selectedDate, selectedShift, settings);
    const stocks = calculateStocks(filtered, settings, allRecords);
    setFilteredStocks(stocks);
  }, [allRecords, selectedDate, selectedShift, settings]);

  const handleOpenDetails = (stock: RubberStock) => {
    setDetailsCode(stock.rubberCode);
    setDetailsItems(stock.items);
  };

  const handleCloseDetails = () => {
    setDetailsCode(null);
    setDetailsItems([]);
  };

  const handleCopyPicture = async () => {
    if (!printRef.current) return;
    setCopying(true);
    
    try {
      const blob = await htmlToImage.toBlob(printRef.current, {
        pixelRatio: 2,
        backgroundColor: "#f8fafc", // bg-slate-50
        filter: (node: any) => {
          if (node?.classList?.contains("hide-in-print")) return false;
          return true;
        }
      });
      
      if (!blob) throw new Error("Failed to generate image blob");

      try {
        const item = new ClipboardItem({ "image/png": blob });
        await navigator.clipboard.write([item]);
        setTimeout(() => setCopying(false), 1500); // Keep highlighted for 1.5s
      } catch (err) {
        console.error("Clipboard write failed, trying fallback...", err);
        // Fallback if clipboard API is not fully supported
        const url = await htmlToImage.toPng(printRef.current, {
          pixelRatio: 2,
          backgroundColor: "#f8fafc",
          filter: (node: any) => {
            if (node?.classList?.contains("hide-in-print")) return false;
            return true;
          }
        });
        const a = document.createElement("a");
        a.href = url;
        a.download = `inventory_${format(selectedDate, "yyyy-MM-dd")}.png`;
        a.click();
        setTimeout(() => setCopying(false), 1500);
      }
    } catch (err) {
      console.error("html-to-image error", err);
      setCopying(false);
    }
  };

  const copyText = () => {
    const recordsToCopy = filteredStocks.filter(s => filterType === "ALL_RUBBER" ? s.isFinalRubber : !s.isFinalRubber);
    if (recordsToCopy.length === 0) return;

    const headerTitle = filterType === "ALL_RUBBER" ? "Final Rubber Inventory" : "PLY/CH/BW Inventory";
    const header = `${headerTitle}_${format(selectedDate, "ddMM")}_${format(new Date(), "hh:mm a")}\n\n`;

    // Group by section
    const groupedBySection: Record<string, RubberStock[]> = {};
    recordsToCopy.forEach(s => {
      if (!groupedBySection[s.section]) groupedBySection[s.section] = [];
      groupedBySection[s.section].push(s);
    });

    const sectionStrings: string[] = [];
    const sectionOrder = ["Extrusion", "Calendering", "Cutting"];
    const presentSections = Object.keys(groupedBySection).sort((a, b) => {
        let ia = sectionOrder.indexOf(a);
        let ib = sectionOrder.indexOf(b);
        if (ia === -1) ia = 99;
        if (ib === -1) ib = 99;
        if (ia !== ib) return ia - ib;
        return a.localeCompare(b);
    });

    presentSections.forEach(section => {
      const sectionHeader = `--------------------\n\n${section}:\n\n`;
      const blocks = groupedBySection[section].map(stock => {
        const hrsInfo = stock.estimatedHoursLeft !== null 
          ? `(${stock.estimatedHoursLeft.toFixed(1)}/ 24 hr)` 
          : ``;
        return `>${stock.rubberCode}\n${stock.totalBatches.toFixed(0)} ${stock.isFinalRubber ? "batch" : "roll"} ${hrsInfo}`.trim();
      }).join('\n\n');
      sectionStrings.push(sectionHeader + blocks);
    });

    let fullText = header + sectionStrings.join('\n\n');

    // Calculate totals across sections
    const totals: Record<string, {batches: number, hours: number | null, isFinal: boolean}> = {};
    recordsToCopy.forEach(s => {
      if (!totals[s.rubberCode]) {
        totals[s.rubberCode] = {batches: 0, hours: 0, isFinal: s.isFinalRubber};
      }
      totals[s.rubberCode].batches += s.totalBatches;
    });

    Object.keys(totals).forEach(rc => {
        const dailyConsumptionBatches = settings.consumptionRates ? settings.consumptionRates[rc] : 0;
        if (dailyConsumptionBatches && dailyConsumptionBatches > 0) {
           totals[rc].hours = totals[rc].batches / (dailyConsumptionBatches / 24);
        } else {
           totals[rc].hours = null;
        }
    });

    // For total block, only show if we have inventory (>0) and we are not in final rubber mode
    const validTotals = Object.keys(totals).filter(rc => totals[rc].batches > 0);
    
    if (filterType !== "ALL_RUBBER" && validTotals.length > 0) {
      fullText += '\n\n===============\n\nTotal:\n\n';
      const totalBlocks = validTotals.map(rc => {
          const hrsInfo = totals[rc].hours !== null 
            ? `(${totals[rc].hours!.toFixed(1)}/ 24 hr)` 
            : ``;
          return `>${rc}\n${totals[rc].batches.toFixed(0)} ${totals[rc].isFinal ? "batch" : "roll"} ${hrsInfo}`.trim();
      }).join('\n\n');
      fullText += totalBlocks;
    }

    navigator.clipboard.writeText(fullText);
    setCopyingText(true);
    setTimeout(() => {
      setCopyingText(false);
    }, 2000);
  };

  // Group stocks for table rendering
  const stocksBySection = useMemo(() => {
    const grouped: Record<string, RubberStock[]> = {};
    const recordsToDisplay = filteredStocks.filter(s => filterType === "ALL_RUBBER" ? s.isFinalRubber : !s.isFinalRubber);
    recordsToDisplay.forEach(s => {
      if (!grouped[s.section]) grouped[s.section] = [];
      grouped[s.section].push(s);
    });
    return grouped;
  }, [filteredStocks, filterType]);

  return (
    <div ref={printRef} className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 pb-16">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm print:hidden">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col items-center flex-1">
            <h1 className="text-3xl font-black tracking-tight text-slate-800 uppercase text-center">
              {filterType === "ALL_RUBBER" ? "Final Rubber Inventory" : "PLY/CH/BW Inventory"}
            </h1>
          </div>
          
          <div className="flex items-center gap-3 absolute right-6 hide-in-print">
            <button 
              onClick={copyText}
              className={`px-4 py-2 text-xs font-bold rounded shadow-sm transition-colors flex items-center ${
                copyingText ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 border"
              }`}
            >
              <Copy className="w-4 h-4 mr-1.5" />
              {copyingText ? "Copied!" : "Copy Text"}
            </button>
            <button 
              onClick={handleCopyPicture}
              className={cn(
                "px-4 py-2 text-xs font-bold rounded shadow-sm border transition-colors flex items-center",
                copying ? "bg-emerald-600 text-white border-emerald-600" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              )}
            >
              <Camera className="w-4 h-4 mr-1.5" />
              {copying ? "Copied!" : "Copy Picture"}
            </button>
            <button 
              onClick={() => setSettingsOpen(true)}
              className="p-2 bg-white rounded shadow-sm border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors"
               title="Settings"
            >
              <Settings2 className="w-4 h-4" />
            </button>
            <button 
              onClick={logout}
              className="p-2 bg-white rounded shadow-sm border border-slate-200 text-rose-600 hover:bg-rose-50 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="bg-white border-b border-slate-200 relative z-20 print:hidden">
        <div className="max-w-7xl mx-auto px-6 py-4 flex gap-6 items-end">
          <div className="flex flex-col flex-1 max-w-[200px]">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center">
              <Calendar className="w-3.5 h-3.5 mr-1" /> Date
            </label>
            <input 
              type="date"
              value={format(selectedDate, "yyyy-MM-dd")}
              onChange={(e) => {
                if (e.target.value) setSelectedDate(new Date(e.target.value));
              }}
              className="w-full text-sm border border-slate-200 rounded px-3 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-700 bg-slate-50 shadow-inner"
            />
          </div>
          <div className="flex flex-col flex-1 max-w-[200px]">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center">
              <Clock className="w-3.5 h-3.5 mr-1" /> Shift
            </label>
            <select
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value as ShiftType | "ALL")}
              className="w-full text-sm border border-slate-200 rounded px-3 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-700 bg-slate-50 shadow-inner"
            >
              <option value="ALL">All Day</option>
              {Object.entries(settings.shifts).map(([shift, s]: [string, any]) => (
                <option key={shift} value={shift}>Shift {shift} ({s.start} - {s.end})</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col flex-1 max-w-[200px]">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center">
              <PackageOpen className="w-3.5 h-3.5 mr-1" /> Material Type
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as "ALL_RUBBER" | "OTHER")}
              className="w-full text-sm border border-slate-200 rounded px-3 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-700 bg-slate-50 shadow-inner"
            >
              <option value="ALL_RUBBER">All Rubber</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto px-6 py-8 w-full">
        {loading && allRecords.length === 0 ? (
          <div className="flex justify-center items-center h-64">
            <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="space-y-6">
            {error && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start text-left whitespace-pre-wrap">
                <AlertCircle className="w-5 h-5 text-rose-500 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-rose-800 uppercase tracking-widest mb-1">Sync Warnings</h3>
                  <p className="text-rose-600 text-sm">{error}</p>
                </div>
              </div>
            )}
            
            {filteredStocks.length === 0 ? (
              <div className="bg-white border border-slate-200 border-dashed rounded-xl p-12 text-center flex flex-col items-center shadow-sm">
                <PackageOpen className="w-12 h-12 text-slate-300 mb-4" />
                <h3 className="font-bold text-slate-700 text-base">No stock found</h3>
                <p className="text-slate-400 mt-2 text-sm">There are no inventory entries for the selected parameters.</p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden pb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50 border-b-2 border-slate-200">
                    <th className="px-6 py-4 text-[11px] font-black uppercase text-slate-400 tracking-widest w-40">Section</th>
                    <th className="px-6 py-4 text-[11px] font-black uppercase text-slate-400 tracking-widest">Rubber Name</th>
                    <th className="px-6 py-4 text-[11px] font-black uppercase text-slate-400 tracking-widest text-center">{filterType === "ALL_RUBBER" ? "Batches" : "Rolls"}</th>
                    <th className="px-6 py-4 text-[11px] font-black uppercase text-slate-400 tracking-widest text-right">Weight (kg)</th>
                    <th className="px-6 py-4 text-[11px] font-black uppercase text-slate-400 tracking-widest text-right">Remaining Hrs</th>
                    <th className="px-6 py-4 text-[11px] font-black uppercase text-slate-400 tracking-widest text-right">Summary</th>
                  </tr>
                </thead>
                {["Extrusion", "Calendering", "Cutting"].map((sectionName, sectionIdx, sectionArr) => {
                  const sectionStocks = stocksBySection[sectionName];
                  if (!sectionStocks || sectionStocks.length === 0) return null;

                  const sectionTotalBatches = sectionStocks.reduce((sum, s) => sum + s.totalBatches, 0);
                  const hoursArr = sectionStocks.map(s => s.estimatedHoursLeft).filter(h => h !== null) as number[];
                  const sectionMinHrs = hoursArr.length > 0 ? Math.min(...hoursArr) : null;
                  const sectionAvgHrs = hoursArr.length > 0 ? hoursArr.reduce((sum, h) => sum + h, 0) / hoursArr.length : null;

                  return (
                    <tbody key={sectionName} className={cn("divide-y divide-slate-100", sectionIdx < sectionArr.length - 1 ? "border-b-[4px] border-slate-200" : "")}>
                      {sectionStocks.map((stock, index) => {
                        const isDanger = stock.estimatedHoursLeft !== null && stock.estimatedHoursLeft < 4;
                        const isOverstock = (stock.estimatedHoursLeft !== null && stock.estimatedHoursLeft > 36) || (stock.estimatedHoursLeft === null && stock.totalBatches > 0);
                        
                        return (
                          <tr 
                            key={`${sectionName}-${stock.rubberCode}`} 
                            onDoubleClick={() => handleOpenDetails(stock)}
                            className={cn(
                              "group cursor-pointer transition-colors",
                              isDanger ? "bg-rose-50/50 hover:bg-rose-100/50" :
                              isOverstock ? "bg-amber-50/30 hover:bg-amber-100/30" :
                              "bg-white hover:bg-slate-50"
                            )}
                          >
                            {index === 0 && (
                              <td 
                                rowSpan={sectionStocks.length} 
                                className="px-6 py-4 border-r border-slate-100 align-middle text-center bg-slate-50/50"
                              >
                                <div className={cn(
                                  "text-xs font-bold uppercase tracking-widest px-3 py-1 inline-block rounded",
                                  sectionName === "Extrusion" ? "bg-indigo-100 text-indigo-700" :
                                  sectionName === "Calendering" ? "bg-emerald-100 text-emerald-700" :
                                  "bg-violet-100 text-violet-700"
                                )}>
                                  {sectionName}
                                </div>
                              </td>
                            )}
                            <td className="px-6 py-4">
                              <span className="font-mono font-bold text-slate-800 text-sm bg-slate-100 px-2.5 py-1 rounded">
                                {stock.rubberCode}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="font-black text-slate-800 text-lg">
                                {stock.isFinalRubber ? stock.totalBatches.toFixed(1) : stock.totalBatches.toFixed(0)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="font-medium text-slate-500">
                                {stock.totalWeight.toFixed(0)} <span className="text-[10px]">kg</span>
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              {stock.estimatedHoursLeft === null ? (
                                <span className={cn(
                                  "px-3 py-1.5 rounded font-bold text-xs uppercase tracking-widest",
                                  isOverstock ? "bg-amber-200 text-amber-800 ring-1 ring-amber-300" : "text-slate-300"
                                )}>
                                  N/A (No Usage)
                                </span>
                              ) : (
                                <span className={cn(
                                  "px-3 py-1.5 rounded font-bold text-xs uppercase tracking-widest",
                                  isDanger ? "bg-rose-200 text-rose-800 ring-1 ring-rose-300" :
                                  isOverstock ? "bg-amber-200 text-amber-800 ring-1 ring-amber-300" :
                                  "bg-emerald-100 text-emerald-700"
                                )}>
                                  {stock.estimatedHoursLeft.toFixed(1)} HR
                                </span>
                              )}
                            </td>
                            {index === 0 && (
                              <td 
                                rowSpan={sectionStocks.length} 
                                className="px-6 py-4 border-l border-slate-100 align-middle text-right bg-slate-50/50"
                              >
                                <div className="flex flex-col gap-4 justify-end whitespace-nowrap">
                                  <div>
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">Min<br/>Remaining</div>
                                    <div className="text-sm font-black text-rose-600 mt-1">{sectionMinHrs !== null ? sectionMinHrs.toFixed(1) + ' HR' : 'N/A'}</div>
                                  </div>
                                  <div>
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">Avg<br/>Remaining</div>
                                    <div className="text-sm font-black text-emerald-600 mt-1">{sectionAvgHrs !== null ? sectionAvgHrs.toFixed(1) + ' HR' : 'N/A'}</div>
                                  </div>
                                  <div>
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">Total<br/>Available</div>
                                    <div className="text-sm font-black text-indigo-600 mt-1">
                                      {sectionTotalBatches.toFixed(sectionTotalBatches % 1 === 0 ? 0 : 1)} {filterType === "ALL_RUBBER" ? "Batches" : "Rolls"}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  );
                })}
              </table>
            </div>
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex gap-6 text-[10px] uppercase font-bold text-slate-400">
               <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-rose-200 ring-1 ring-rose-300"></div> &lt; 4 Hrs (Danger)</div>
               <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-amber-200 ring-1 ring-amber-300"></div> &gt; 36 Hrs (Overstock)</div>
               <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-emerald-100"></div> 4 - 36 Hrs (Normal)</div>
            </div>
          </div>
            )}
          </div>
        )}
      </main>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setSettingsOpen(false)} />
      <DetailsModal isOpen={!!detailsCode} onClose={handleCloseDetails} rubberCode={detailsCode} items={detailsItems} />
    </div>
  );
}
