"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, UserX, Users, LogOut, CheckCircle2, Search } from "lucide-react";

interface Student {
  id: string;
  nama: string;
  kelas: string;
  sudah_memilih: boolean;
}

interface LoginRequest {
  id: string;
  student_id: string;
  student: Student;
  created_at: string;
}

interface SummaryStats {
  total_siswa: number;
  total_hadir: number;
  total_memilih: number;
  total_golput: number;
  persen_hadir: number;
  persen_memilih: number;
}

interface ClassStat {
  kelas: string;
  total: number;
  hadir: number;
  memilih: number;
  persen_hadir: number;
}

export default function PanitiaDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);

  // Data Queue Antrean
  const [queue, setQueue] = useState<LoginRequest[]>([]);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  // Data Statistik
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [classStats, setClassStats] = useState<ClassStat[]>([]);
  const [searchClass, setSearchClass] = useState("");

  const queueTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 1. Verifikasi Autentikasi Sesi Panitia
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) {
        router.replace("/panitia/login");
        return;
      }
      const data = await res.json();
      if (data.role !== "panitia" && data.role !== "admin") {
        router.replace("/panitia/login");
        return;
      }
      setRole(data.role);
    } catch {
      router.replace("/panitia/login");
    }
  }, [router]);

  // 2. Fetch Antrean PENDING
  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/panitia/queue");
      if (res.ok) {
        const data = await res.json();
        setQueue(data);
      }
    } catch (err) {
      console.error("Gagal mengambil data antrean", err);
    }
  }, []);

  // 3. Fetch Statistik Kehadiran
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/panitia/stats");
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        setClassStats(data.class_stats);
      }
    } catch (err) {
      console.error("Gagal mengambil data statistik", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await checkAuth();
      await fetchQueue();
      await fetchStats();
    };
    init();
  }, [checkAuth, fetchQueue, fetchStats]);

  // Polling data antrean (setiap 3 detik) & statistik (setiap 10 detik)
  useEffect(() => {
    if (!role) return;

    queueTimerRef.current = setInterval(fetchQueue, 6000);
    statsTimerRef.current = setInterval(fetchStats, 30000);

    return () => {
      if (queueTimerRef.current) clearInterval(queueTimerRef.current);
      if (statsTimerRef.current) clearInterval(statsTimerRef.current);
    };
  }, [role, fetchQueue, fetchStats]);

  // 4. Tindakan Setujui / Tolak Pendaftaran
  const handleAction = async (requestId: string, action: "APPROVE" | "REJECT") => {
    setActionLoading((prev) => ({ ...prev, [requestId]: true }));
    try {
      const res = await fetch(`/api/panitia/queue/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        // Hapus langsung dari UI antrean agar UX instan
        setQueue((prev) => prev.filter((r) => r.id !== requestId));
        // Refresh statistik secara berkala
        fetchStats();
      } else {
        alert("Gagal melakukan aksi. Silakan coba lagi.");
      }
    } catch {
      alert("Terjadi kesalahan koneksi.");
    } finally {
      setActionLoading((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  // 5. Logout
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    router.replace("/panitia/login");
  };

  // Filter rekapitulasi kelas
  const filteredClassStats = classStats.filter((c) =>
    c.kelas.toLowerCase().includes(searchClass.toLowerCase())
  );

  if (loading || !role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-800">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="font-bold">Memuat Dashboard Panitia...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* Header Dashboard */}
      <header className="bg-white border-b-4 border-black px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-600 border-2 border-black flex items-center justify-center font-black text-white text-lg">
            P
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-wider text-black">Dashboard Panitia</h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
              Portal Registrasi Bilik & Monitoring · Role: <span className="text-emerald-600">{role}</span>
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold border-2 border-black tracking-wider uppercase text-xs transition-colors self-start sm:self-auto"
          style={{ boxShadow: "2px 2px 0px 0px #000" }}
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </header>

      {/* Main Content Grid */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* ==============================================
        // PANEL KIRI: Antrean Registrasi Bilik (5 Kolom)
        // ============================================== */}
        <section className="lg:col-span-5 flex flex-col">
          <div className="bg-white border-4 border-black p-6 flex-1 flex flex-col" style={{ boxShadow: "6px 6px 0px 0px #000" }}>
            <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-4">
              <div>
                <h2 className="text-xl font-black uppercase text-black">Antrean Pendaftaran</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Diperbarui otomatis tiap 3 detik</p>
              </div>
              <span className="bg-emerald-100 border border-emerald-600 text-emerald-800 font-bold px-3 py-1 text-sm">
                {queue.length} Antrean
              </span>
            </div>

            {/* List Antrean */}
            <div className="flex-1 overflow-y-auto max-h-[600px] space-y-4 pr-1">
              {queue.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center text-slate-400 border-2 border-dashed border-slate-300 p-6">
                  <Users className="w-12 h-12 mb-3 stroke-1" />
                  <p className="font-bold">Belum ada antrean pendaftaran</p>
                  <p className="text-xs mt-1">Siswa di bilik suara belum mengirim permintaan login.</p>
                </div>
              ) : (
                queue.map((req) => (
                  <div
                    key={req.id}
                    className="bg-slate-50 border-2 border-black p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-all"
                  >
                    <div>
                      <p className="font-black text-black text-lg leading-tight uppercase">{req.student.nama}</p>
                      <p className="text-xs text-slate-500 font-bold uppercase mt-1">Kelas: {req.student.kelas}</p>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                        Waktu: {new Date(req.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </p>
                    </div>

                    {/* Tombol Aksi */}
                    <div className="flex gap-2 self-end sm:self-auto shrink-0">
                      <button
                        disabled={actionLoading[req.id]}
                        onClick={() => handleAction(req.id, "REJECT")}
                        className="p-2.5 bg-rose-50 hover:bg-rose-100 border-2 border-rose-600 text-rose-600 transition-colors disabled:opacity-50"
                        title="Tolak Akses"
                      >
                        <UserX className="w-5 h-5" />
                      </button>
                      <button
                        disabled={actionLoading[req.id]}
                        onClick={() => handleAction(req.id, "APPROVE")}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white border-2 border-black font-black uppercase text-xs tracking-wider transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {actionLoading[req.id] ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <UserCheck className="w-4 h-4" />
                        )}
                        SETUJUI
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* ==============================================
        // PANEL KANAN: Statistik Kehadiran (7 Kolom)
        // ============================================== */}
        <section className="lg:col-span-7 space-y-8">

          {/* Summary Stats Cards */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white border-3 border-black p-4" style={{ boxShadow: "4px 4px 0px 0px #000" }}>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Total Siswa</p>
                <p className="text-2xl font-black text-black leading-none">{summary.total_siswa}</p>
                <p className="text-[10px] text-slate-400 font-semibold mt-1">Daftar DPT</p>
              </div>

              <div className="bg-white border-3 border-black p-4" style={{ boxShadow: "4px 4px 0px 0px #000" }}>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Hadir di TPS</p>
                <p className="text-2xl font-black text-emerald-600 leading-none">{summary.total_hadir}</p>
                <p className="text-[10px] text-slate-400 font-semibold mt-1">Kehadiran: **{summary.persen_hadir}%**</p>
              </div>

              <div className="bg-white border-3 border-black p-4" style={{ boxShadow: "4px 4px 0px 0px #000" }}>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Sudah Memilih</p>
                <p className="text-2xl font-black text-blue-600 leading-none">{summary.total_memilih}</p>
                <p className="text-[10px] text-slate-400 font-semibold mt-1">Suara Sah: **{summary.persen_memilih}%**</p>
              </div>

              <div className="bg-white border-3 border-black p-4" style={{ boxShadow: "4px 4px 0px 0px #000" }}>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Belum Memilih</p>
                <p className="text-2xl font-black text-rose-600 leading-none">{summary.total_golput}</p>
                <p className="text-[10px] text-slate-400 font-semibold mt-1">Golput/Belum hadir</p>
              </div>
            </div>
          )}

          {/* List Kelas & Status Kehadiran */}
          <div className="bg-white border-4 border-black p-6" style={{ boxShadow: "6px 6px 0px 0px #000" }}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b-2 border-black pb-4 mb-6">
              <div>
                <h2 className="text-xl font-black uppercase text-black">Partisipasi Kelas</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Statistik di-refresh otomatis tiap 10 detik</p>
              </div>

              {/* Input Search Kelas */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari Kelas..."
                  value={searchClass}
                  onChange={(e) => setSearchClass(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-black pl-9 pr-3 py-2 font-semibold text-sm focus:outline-none focus:border-emerald-600 transition-colors"
                />
              </div>
            </div>

            {/* List Progress Kelas */}
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
              {filteredClassStats.length === 0 ? (
                <p className="text-center py-8 text-slate-400 font-bold">Kelas tidak ditemukan.</p>
              ) : (
                filteredClassStats.map((c) => (
                  <div key={c.kelas} className="border border-slate-200 p-3 bg-slate-50">
                    <div className="flex justify-between items-end mb-1">
                      <p className="font-bold text-black uppercase tracking-wider text-sm">{c.kelas}</p>
                      <p className="text-xs text-slate-500 font-bold">
                        Hadir: <span className="text-black">{c.hadir}</span>/{c.total} siswa ({c.persen_hadir}%)
                      </p>
                    </div>

                    {/* Progress Bar Kehadiran Kelas */}
                    <div className="w-full h-3 bg-slate-200 border border-black overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 transition-all duration-500"
                        style={{ width: `${c.persen_hadir}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

      </main>

      {/* Footer Dashboard */}
      <footer className="border-t-2 border-slate-200 py-4 px-6 text-center bg-white mt-8">
        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
          ZEVOTE © 2026 · Sistem Informasi TPS E-Voting OSIS Digital Terpusat
        </p>
      </footer>
    </div>
  );
}
