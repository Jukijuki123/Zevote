"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Eye, EyeOff } from "lucide-react";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.role === "admin") {
          router.push("/admin");
        } else {
          setError("Akses ditolak. Silakan login di dashboard Panitia.");
        }
      } else {
        setError(data.message || "Password salah!");
      }
    } catch (error) {
      console.error("Login error:", error);
      setError("Terjadi kesalahan koneksi. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md border border-slate-200 p-8 bg-white rounded-2xl shadow-sm">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-rose-50 border border-rose-100 rounded-xl mb-3 shadow-xs">
            <Lock className="w-8 h-8 text-rose-600" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">ZEVOTE</h1>
          <p className="text-slate-500 font-medium mt-1">Portal Super Admin</p>
        </div>

        {error && (
          <div className="mb-6 p-4 border border-rose-100 rounded-xl bg-rose-50/50 text-rose-700 font-semibold text-sm shadow-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              Password Admin
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full neo-input pr-12 rounded-xl font-mono text-slate-800"
                placeholder="••••••••"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                disabled={loading}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 border border-rose-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-sm hover:shadow-md hover:shadow-rose-600/15 transition-all cursor-pointer"
          >
            {loading ? "Memverifikasi..." : "Masuk Dashboard"}
          </button>
        </form>
      </div>
    </div>
  );
}
