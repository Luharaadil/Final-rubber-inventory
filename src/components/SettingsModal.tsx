import React, { useState } from "react";
import { X, Save, Plus, Trash2 } from "lucide-react";
import { useSettings } from "../store/SettingsContext";
import { ShiftType } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { settings, updateShift, updateConsumption, removeConsumption } = useSettings();
  
  const [newCode, setNewCode] = useState("");
  const [newRate, setNewRate] = useState("");

  if (!isOpen) return null;

  const handleAddConsumption = () => {
    if (newCode.trim() && !isNaN(parseFloat(newRate))) {
      updateConsumption(newCode.trim().toUpperCase(), parseFloat(newRate));
      setNewCode("");
      setNewRate("");
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-xl shadow-sm border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-auto flex flex-col"
        >
          <div className="sticky top-0 z-10 bg-slate-50 p-6 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700 tracking-tight">System Settings</h2>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-10">
            {/* Shift Configurations */}
            <section>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 block">Shift Timings</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                {(Object.keys(settings.shifts) as ShiftType[]).map((shift) => (
                  <div key={shift} className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <div className="font-bold text-slate-700 mb-3 text-sm">Shift {shift}</div>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Start Time</label>
                        <input
                          type="time"
                          value={settings.shifts[shift].start}
                          onChange={(e) => updateShift(shift, e.target.value, settings.shifts[shift].end)}
                          className="w-full px-3 py-1.5 text-sm rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">End Time</label>
                        <input
                          type="time"
                          value={settings.shifts[shift].end}
                          onChange={(e) => updateShift(shift, settings.shifts[shift].start, e.target.value)}
                          className="w-full px-3 py-1.5 text-sm rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Consumption Rates */}
            <section>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 block">Daily Consumption Rates</h3>
              <p className="text-sm text-slate-500 mb-4">
                Set how many batches of each rubber type are consumed per day to estimate when stock runs out.
              </p>
              
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden mb-4">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Rubber Code</th>
                      <th className="px-4 py-3">Consumption (Batches/day)</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Object.entries(settings.consumptionRates).map(([code, rate]) => (
                      <tr key={code} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium font-mono text-indigo-600">{code}</td>
                        <td className="px-4 py-3 text-slate-600">{rate} batches</td>
                        <td className="px-4 py-3 text-right flex justify-end gap-2">
                          <button 
                            onClick={() => {
                              setNewCode(code);
                              setNewRate(rate.toString());
                            }}
                            className="p-1.5 text-blue-500 hover:bg-blue-50 rounded transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                          </button>
                          <button 
                            onClick={() => removeConsumption(code)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {Object.keys(settings.consumptionRates).length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                           No manual overrides configured. Data synced from sheet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Rubber Code (e.g. 0021F)"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="flex-1 px-4 py-2 rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                />
                <input
                  type="number"
                  placeholder="Batches per day"
                  value={newRate}
                  onChange={(e) => setNewRate(e.target.value)}
                  className="w-40 px-4 py-2 rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                />
                <button
                  onClick={handleAddConsumption}
                  disabled={!newCode.trim() || !newRate}
                  className="px-4 py-2 bg-indigo-600 text-white rounded text-xs font-bold shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  <Plus className="w-4 h-4 mr-1.5" /> Save
                </button>
              </div>
            </section>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
