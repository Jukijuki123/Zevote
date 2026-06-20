"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock, Eye, EyeOff } from "lucide-react";

export default function PanitiaLogin() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Cek apakah sudah ada sesi aktif
  useEffect(() => {
    const checkMe = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.role === "panitia" || data.role === "admin") {
            router.replace("/panitia");
          }
        }
      } catch {
        // ignore
      }
    };
    checkMe();
  }, [router]);

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
        if (data.role === "panitia" || data.role === "admin") {
          router.push("/panitia");
        } else {
          setError("Akses ditolak.");
        }
      } else {
        setError(data.message || "Password salah!");
      }
    } catch {
      setError("Terjadi kesalahan koneksi. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 text-slate-800">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 shadow-md">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-emerald-50 border border-emerald-100 rounded-xl mb-3 shadow-xs">
            <Lock className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">ZEVOTE</h1>
          <p className="text-slate-500 font-semibold mt-1 uppercase text-xs tracking-wider">Dashboard Panitia Registrasi</p>
        </div>

        {error && (
          <div className="mb-6 p-4 border border-rose-100 rounded-xl bg-rose-50/50 text-rose-700 font-semibold text-sm shadow-xs">
            ⚠ {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-605 uppercase tracking-wider mb-2">
              Password Panitia
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full neo-input pr-12 rounded-xl font-mono text-slate-850"
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
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 border border-emerald-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-sm hover:shadow-md hover:shadow-emerald-600/15 transition-all cursor-pointer"
          >
            {loading ? "Memverifikasi..." : "Masuk Dashboard"}
          </button>
        </form>

        <p className="text-center text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-6">
          Gunakan password panitia yang telah diset di server environment
        </p>
      </div>
    </div>
  );
}
