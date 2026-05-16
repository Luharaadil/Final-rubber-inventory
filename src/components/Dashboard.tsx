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
import { Settings2, RefreshCw, Calendar, Clock, PackageOpen, AlertCircle, Camera, LogOut } from "lucide-react";
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

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedShift, setSelectedShift] = useState<ShiftType | "ALL">("ALL");

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
    const stocks = calculateStocks(filtered, settings);
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

  const { totalBatches, avgHours } = useMemo(() => {
    let t = 0;
    let sumHrs = 0;
    let countHrs = 0;
    filteredStocks.forEach(s => {
      t += s.totalBatches;
      if (s.estimatedHoursLeft !== null) {
         sumHrs += s.estimatedHoursLeft;
         countHrs++;
      }
    });
    return {
      totalBatches: t,
      avgHours: countHrs > 0 ? (sumHrs / countHrs) : 0
    };
  }, [filteredStocks]);

  // Group stocks for table rendering
  const stocksBySection = useMemo(() => {
    const grouped: Record<string, RubberStock[]> = {};
    filteredStocks.forEach(s => {
      if (!grouped[s.section]) grouped[s.section] = [];
      grouped[s.section].push(s);
    });
    return grouped;
  }, [filteredStocks]);

  return (
    <div ref={printRef} className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 pb-16">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm print:hidden">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col items-center flex-1">
            <h1 className="text-3xl font-black tracking-tight text-slate-800 uppercase text-center">
              Final Rubber Inventory
            </h1>
          </div>
          
          <div className="flex items-center gap-3 absolute right-6 hide-in-print">
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
        <div className="max-w-7xl mx-auto px-6 py-4 grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
          <div className="md:col-span-4 flex gap-4">
            <div className="flex flex-col flex-1">
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
            <div className="flex flex-col flex-1">
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
          </div>
          <div className="md:col-span-8 flex justify-end gap-6 border-l border-slate-100 pl-6">
             <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 shadow-sm flex-1 max-w-[200px]">
               <h3 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Total Available</h3>
               <p className="text-2xl font-black text-indigo-700 mt-1">{totalBatches.toFixed(1)} <span className="text-xs text-indigo-500 font-bold ml-1">Batches</span></p>
             </div>
             <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 shadow-sm flex-1 max-w-[200px]">
               <h3 className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Avg Remaining</h3>
               <p className="text-2xl font-black text-emerald-700 mt-1">{avgHours.toFixed(1)} <span className="text-xs text-emerald-500 font-bold ml-1">Hours</span></p>
             </div>
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
                    <th className="px-6 py-4 text-[11px] font-black uppercase text-slate-400 tracking-widest text-center">Batches</th>
                    <th className="px-6 py-4 text-[11px] font-black uppercase text-slate-400 tracking-widest text-right">Weight (kg)</th>
                    <th className="px-6 py-4 text-[11px] font-black uppercase text-slate-400 tracking-widest text-right">Remaining Hrs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {["Extrusion", "Calendering", "Cutting"].map((sectionName) => {
                    const sectionStocks = stocksBySection[sectionName];
                    if (!sectionStocks || sectionStocks.length === 0) return null;

                    return sectionStocks.map((stock, index) => {
                      const isDanger = stock.estimatedHoursLeft !== null && stock.estimatedHoursLeft < 4;
                      const isOverstock = stock.estimatedHoursLeft !== null && stock.estimatedHoursLeft > 36;
                      
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
                              {stock.totalBatches.toFixed(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="font-medium text-slate-500">
                              {stock.totalWeight.toFixed(0)} <span className="text-[10px]">kg</span>
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {stock.estimatedHoursLeft === null ? (
                              <span className="text-[10px] uppercase font-bold text-slate-300">N/A</span>
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
                        </tr>
                      );
                    });
                  })}
                </tbody>
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
