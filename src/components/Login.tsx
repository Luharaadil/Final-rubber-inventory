import React, { useState } from "react";
import { useAuth } from "../store/AuthContext";
import { fetchUsers } from "../services/api";
import { PackageOpen, Lock, User, AlertCircle, Loader2 } from "lucide-react";

export function Login() {
  const { login } = useAuth();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Fallback admin
      if (userId === "180044" && password === "MX180044") {
        login({ id: userId, role: "Admin" });
        return;
      }

      const users = await fetchUsers();
      
      const user = users[userId];
      if (user && user.password === password) {
        login({ id: userId, role: user.role });
      } else {
        setError("Invalid user ID or password");
      }
    } catch (err) {
      setError("Failed to verify credentials. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-indigo-600 p-3 rounded-xl shadow-lg">
            <PackageOpen className="w-10 h-10 text-white" />
          </div>
        </div>
        <div className="mt-6 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 uppercase whitespace-nowrap">
            MAXXIS RUBBER INDIA PVT LTD
          </h2>
          <h3 className="mt-2 text-xl font-bold tracking-tight text-indigo-600">
            Final rubber inventory
          </h3>
        </div>
        <h4 className="mt-6 text-center text-lg font-bold tracking-tight text-slate-900">
          Sign in to your account
        </h4>
        <p className="mt-2 text-center text-sm text-slate-500">
          Enter your User ID and Password to continue
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm border border-slate-200 sm:rounded-xl sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="userId" className="block text-xs font-bold text-slate-500 uppercase tracking-widest">
                User ID
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="userId"
                  name="userId"
                  type="text"
                  required
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-slate-900"
                  placeholder="e.g. 180044"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-bold text-slate-500 uppercase tracking-widest">
                Password
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-slate-900"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-rose-50 p-4 border border-rose-100">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-rose-400" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-rose-800">{error}</h3>
                  </div>
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Sign in"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
