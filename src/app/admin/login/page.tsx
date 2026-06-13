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
    <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-md neo-box p-8 bg-white rounded-none">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-rose-100 border-2 border-black rounded-none mb-3">
            <Lock className="w-8 h-8 text-rose-600" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">ZEVOTE</h1>
          <p className="text-gray-500 font-medium mt-1">Portal Super Admin</p>
        </div>

        {error && (
          <div className="mb-6 p-4 border-2 border-black bg-rose-50 text-rose-700 font-bold text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-black uppercase tracking-wider mb-2">
              Password Admin
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full neo-input pr-12 rounded-none font-mono"
                placeholder="••••••••"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black"
                disabled={loading}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 neo-btn-primary rounded-none flex items-center justify-center gap-2"
          >
            {loading ? "Memverifikasi..." : "Masuk Dashboard"}
          </button>
        </form>
      </div>
    </div>
  );
}
