import React, { useState } from "react";
import { format } from "date-fns";
import { X, Search } from "lucide-react";
import { InventoryRawRecord } from "../types";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";

interface DetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  rubberCode: string | null;
  items: InventoryRawRecord[];
}

export function DetailsModal({ isOpen, onClose, rubberCode, items }: DetailsModalProps) {
  const [searchTerm, setSearchTerm] = useState("");

  if (!isOpen || !rubberCode) return null;

  const filteredItems = items.filter(
    (i) => i.barcode.toLowerCase().includes(searchTerm.toLowerCase()) || 
           i.section.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime());

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-xl shadow-sm border border-slate-200 w-full max-w-3xl flex flex-col max-h-[85vh] overflow-hidden"
        >
          <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div>
              <h2 className="text-sm font-bold text-slate-700 tracking-tight">Rubber Barcodes: <span className="text-indigo-600">{rubberCode}</span></h2>
              <p className="text-[10px] text-slate-400 italic mt-1">
                {items.length} total items listed
              </p>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 border-b border-slate-100 bg-white">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search barcodes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm text-slate-700 shadow-sm"
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto p-0">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="py-2 px-6">Date & Time</th>
                  <th className="py-2 px-6">Barcode</th>
                  <th className="py-2 px-6">Section</th>
                  <th className="py-2 px-6 text-right">Weight (kg)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400 text-sm">
                      No matching barcodes found.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 cursor-pointer">
                      <td className="py-3 px-6 text-sm text-slate-600 font-medium whitespace-nowrap">
                        {format(item.timestamp, "dd-MM-yyyy")}{format(item.timestamp, "HH:mm") !== "00:00" ? ` ${format(item.timestamp, "HH:mm")}` : ""}
                      </td>
                      <td className="py-3 px-6 text-sm text-slate-600 font-bold font-mono">
                        {item.barcode || "N/A"}
                      </td>
                      <td className="py-3 px-6 text-sm text-slate-500">
                        <span className={cn(
                          "px-2 py-1 rounded text-[10px] font-bold",
                          item.section === "Extrusion" ? "bg-amber-100 text-amber-700" :
                          item.section === "Calendering" ? "bg-indigo-100 text-indigo-700" :
                          "bg-emerald-100 text-emerald-700"
                        )}>
                          {item.section}
                        </span>
                      </td>
                      <td className="py-3 px-6 text-sm text-slate-700 font-bold text-right">
                        {item.weight.toFixed(1)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td colSpan={3} className="py-4 px-6 text-right text-xs font-black uppercase text-slate-500 tracking-widest">
                    Total Items: {filteredItems.length} | Total Weight
                  </td>
                  <td className="py-4 px-6 text-right">
                    <span className="font-black text-slate-800 text-base">
                      {filteredItems.reduce((sum, item) => sum + item.weight, 0).toFixed(1)}
                    </span>
                    <span className="text-[10px] text-slate-500 font-normal ml-1">kg</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
