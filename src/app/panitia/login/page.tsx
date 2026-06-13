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
      <div className="w-full max-w-md bg-white border-4 border-black p-8" style={{ boxShadow: "8px 8px 0px 0px #000" }}>
        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-emerald-100 border-2 border-black mb-3">
            <Lock className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-black">ZEVOTE</h1>
          <p className="text-slate-500 font-bold mt-1 uppercase text-xs tracking-wider">Dashboard Panitia Registrasi</p>
        </div>

        {error && (
          <div className="mb-6 p-4 border-2 border-black bg-rose-50 text-rose-700 font-bold text-sm">
            ⚠ {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-black uppercase tracking-widest mb-2">
              Password Panitia
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-slate-50 border-3 border-black focus:border-rose-600 text-black px-4 py-3 font-semibold focus:outline-none transition-colors"
                placeholder="••••••••"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-black"
                disabled={loading}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest border-3 border-black transition-colors"
            style={{ boxShadow: "4px 4px 0px 0px #000" }}
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
