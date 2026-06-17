"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, UserX, Users, LogOut, Search, RefreshCw } from "lucide-react";

interface Student {
  id: string;
  nama: string;
  kelas: string;
  sudah_memilih: boolean;
  hadir?: boolean;
}

interface LoginRequest {
  id: string;
  student_id: string;
  student: Student;
  status: "PENDING" | "APPROVED" | "REJECTED" | "VOTED" | "TIMED_OUT";
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

  // Tab Panel Kanan ("stats" | "non_voters")
  const [rightTab, setRightTab] = useState<"stats" | "non_voters">("stats");

  // State Siswa Belum Memilih
  const [nonVoters, setNonVoters] = useState<Student[]>([]);
  const [nonVotersSearch, setNonVotersSearch] = useState("");
  const [nonVotersClass, setNonVotersClass] = useState("");
  const [nonVotersPage, setNonVotersPage] = useState(1);
  const [nonVotersTotalPages, setNonVotersTotalPages] = useState(1);
  const [nonVotersTotalCount, setNonVotersTotalCount] = useState(0);
  const [loadingNonVoters, setLoadingNonVoters] = useState(false);

  // Custom Alert & Confirm Popups
  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error";
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "error",
  });

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: (() => void) | null;
    isDanger?: boolean;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: null,
    isDanger: false,
  });

  const triggerCustomAlert = (title: string, message: string, type: "success" | "error" = "error") => {
    setAlertState({
      isOpen: true,
      title,
      message,
      type,
    });
  };

  const confirmResetBooth = (requestId: string, studentName: string) => {
    setConfirmState({
      isOpen: true,
      title: "Reset Bilik Suara",
      message: `Apakah Anda yakin ingin MERESET bilik suara untuk siswa: ${studentName}?\nSesi bilik suara mereka akan langsung ditutup dan kehadiran mereka akan diatur ulang.`,
      isDanger: true,
      onConfirm: () => handleAction(requestId, "REJECT"),
    });
  };

  const queueTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nonVotersDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchNonVoters = useCallback(async (page = 1, search = nonVotersSearch, classFilter = nonVotersClass) => {
    setLoadingNonVoters(true);
    try {
      const res = await fetch(`/api/panitia/non-voters?page=${page}&limit=12&search=${encodeURIComponent(search)}&kelas=${encodeURIComponent(classFilter)}`);
      if (res.ok) {
        const data = await res.json();
        setNonVoters(data.students);
        setNonVotersTotalPages(data.totalPages);
        setNonVotersTotalCount(data.total);
        setNonVotersPage(data.page);
      }
    } catch (err) {
      console.error("Gagal mengambil data siswa belum memilih", err);
    } finally {
      setLoadingNonVoters(false);
    }
  }, [nonVotersSearch, nonVotersClass]);

  // Hook Polling & Debounce untuk Siswa Belum Memilih
  useEffect(() => {
    if (!role || rightTab !== "non_voters") return;

    if (nonVotersDebounceRef.current) clearTimeout(nonVotersDebounceRef.current);

    nonVotersDebounceRef.current = setTimeout(() => {
      fetchNonVoters(nonVotersPage, nonVotersSearch, nonVotersClass);
    }, 300);

    return () => {
      if (nonVotersDebounceRef.current) clearTimeout(nonVotersDebounceRef.current);
    };
  }, [role, rightTab, nonVotersPage, nonVotersSearch, nonVotersClass, fetchNonVoters]);

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
        triggerCustomAlert("Aksi Gagal", "Gagal melakukan aksi. Silakan coba lagi.", "error");
      }
    } catch {
      triggerCustomAlert("Kesalahan Koneksi", "Terjadi kesalahan koneksi saat menghubungi server.", "error");
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

  const pendingRequests = queue.filter((r) => r.status === "PENDING");
  const activeVoters = queue.filter((r) => r.status === "APPROVED" || r.status === "TIMED_OUT");

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
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Diperbarui otomatis tiap 6 detik</p>
              </div>
              <span className="bg-emerald-100 border border-emerald-600 text-emerald-800 font-bold px-3 py-1 text-sm">
                {pendingRequests.length} Antrean
              </span>
            </div>

            {/* List Antrean */}
            <div className="flex-1 overflow-y-auto max-h-[300px] space-y-4 pr-1 mb-6 border-b-2 border-dashed border-slate-200 pb-4">
              {pendingRequests.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-center text-slate-400 border-2 border-dashed border-slate-300 p-6">
                  <Users className="w-10 h-10 mb-2 stroke-1" />
                  <p className="font-bold text-sm">Belum ada antrean pendaftaran</p>
                  <p className="text-[10px] mt-0.5">Siswa di bilik suara belum mengirim permintaan login.</p>
                </div>
              ) : (
                pendingRequests.map((req) => (
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

            {/* Bilik Suara Aktif */}
            <div>
              <div className="flex justify-between items-center pb-4 mb-4">
                <div>
                  <h2 className="text-xl font-black uppercase text-black">Bilik Suara Aktif</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Siswa sedang di dalam bilik suara</p>
                </div>
                <span className="bg-blue-100 border border-blue-600 text-blue-800 font-bold px-3 py-1 text-sm">
                  {activeVoters.length} Aktif
                </span>
              </div>

              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                {activeVoters.length === 0 ? (
                  <div className="h-32 flex flex-col items-center justify-center text-center text-slate-400 border-2 border-dashed border-slate-300 p-4">
                    <p className="font-bold text-xs">Tidak ada bilik suara yang aktif</p>
                  </div>
                ) : (
                  activeVoters.map((req) => (
                    <div
                      key={req.id}
                      className={`border-2 border-black p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-all ${
                        req.status === "TIMED_OUT" ? "bg-rose-50 border-rose-600" : "bg-blue-50"
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-black text-black text-lg leading-tight uppercase">{req.student.nama}</p>
                          {req.status === "TIMED_OUT" && (
                            <span className="bg-rose-600 text-white text-[9px] font-black uppercase px-2 py-0.5 animate-pulse rounded">
                              WAKTU HABIS / TERKUNCI
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 font-bold uppercase mt-1">Kelas: {req.student.kelas}</p>
                      </div>

                      <div className="shrink-0">
                        <button
                          disabled={actionLoading[req.id]}
                          onClick={() => confirmResetBooth(req.id, req.student.nama)}
                          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white border-2 border-black font-black uppercase text-xs tracking-wider transition-colors flex items-center gap-1.5 disabled:opacity-50"
                          style={{ boxShadow: "2px 2px 0px 0px #000" }}
                        >
                          {actionLoading[req.id] ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <UserX className="w-4 h-4" />
                          )}
                          RESET BILIK
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ==============================================
        // PANEL KANAN: Statistik Kehadiran & Siswa Belum Memilih (7 Kolom)
        // ============================================== */}
        <section className="lg:col-span-7 space-y-6">
          
          {/* Tab Header Panel Kanan */}
          <div className="flex border-b-4 border-black">
            <button
              onClick={() => setRightTab("stats")}
              className={`flex-1 py-3 px-6 text-center font-black uppercase text-xs tracking-wider border-t-4 border-x-4 border-black transition-colors ${
                rightTab === "stats"
                  ? "bg-white text-black translate-y-[4px]"
                  : "bg-slate-200 text-slate-500 hover:bg-slate-100 hover:text-black border-b-4 border-b-black"
              }`}
            >
              Monitoring & Statistik
            </button>
            <button
              onClick={() => setRightTab("non_voters")}
              className={`flex-1 py-3 px-6 text-center font-black uppercase text-xs tracking-wider border-t-4 border-x-4 border-black transition-colors ${
                rightTab === "non_voters"
                  ? "bg-white text-black translate-y-[4px]"
                  : "bg-slate-200 text-slate-500 hover:bg-slate-100 hover:text-black border-b-4 border-b-black"
              }`}
            >
              Siswa Belum Memilih
            </button>
          </div>

          {rightTab === "stats" ? (
            <div className="space-y-8">
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
            </div>
          ) : (
            <div className="bg-white border-4 border-black p-6 space-y-6" style={{ boxShadow: "6px 6px 0px 0px #000" }}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b-2 border-black pb-4">
                <div>
                  <h2 className="text-xl font-black uppercase text-black">Siswa Belum Memilih</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Total: {nonVotersTotalCount} Siswa Belum Menyalurkan Suara
                  </p>
                </div>
                <button
                  onClick={() => fetchNonVoters(nonVotersPage, nonVotersSearch, nonVotersClass)}
                  className="px-3 py-1.5 border-2 border-black bg-slate-50 hover:bg-slate-100 text-black font-black text-xs uppercase flex items-center gap-1.5 transition-colors self-start sm:self-auto"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh
                </button>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari nama siswa..."
                    value={nonVotersSearch}
                    onChange={(e) => {
                      setNonVotersSearch(e.target.value);
                      setNonVotersPage(1);
                    }}
                    className="w-full bg-slate-50 border-2 border-black pl-9 pr-3 py-2 font-semibold text-sm focus:outline-none focus:border-emerald-600 transition-colors"
                  />
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filter kelas..."
                    value={nonVotersClass}
                    onChange={(e) => {
                      setNonVotersClass(e.target.value);
                      setNonVotersPage(1);
                    }}
                    className="w-full bg-slate-50 border-2 border-black pl-9 pr-3 py-2 font-semibold text-sm focus:outline-none focus:border-emerald-600 transition-colors"
                  />
                </div>
              </div>

              {/* Students List */}
              {loadingNonVoters ? (
                <div className="py-20 flex justify-center items-center">
                  <div className="w-8 h-8 border-3 border-rose-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : nonVoters.length === 0 ? (
                <div className="py-16 text-center text-slate-400 border-2 border-dashed border-slate-300 font-bold text-sm">
                  Semua siswa dalam pencarian ini telah selesai memilih.
                </div>
              ) : (
                <div className="border-2 border-black overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[500px]">
                    <thead>
                      <tr className="bg-slate-100 border-b-2 border-black text-xs font-black uppercase tracking-wider">
                        <th className="p-3">Nama Siswa</th>
                        <th className="p-3">Kelas</th>
                        <th className="p-3 text-right">Status Kehadiran</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-semibold text-xs">
                      {nonVoters.map((student) => (
                        <tr key={student.id} className="hover:bg-slate-50">
                          <td className="p-3 font-black uppercase text-black">{student.nama}</td>
                          <td className="p-3 text-slate-500 font-bold uppercase">{student.kelas}</td>
                          <td className="p-3 text-right">
                            {student.hadir ? (
                              <span className="bg-emerald-100 border border-emerald-600 text-emerald-800 text-[9px] font-black px-2 py-0.5 rounded">
                                HADIR DI TPS
                              </span>
                            ) : (
                              <span className="bg-rose-100 border border-rose-600 text-rose-800 text-[9px] font-black px-2 py-0.5 rounded">
                                BELUM HADIR
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {nonVotersTotalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                  <button
                    disabled={nonVotersPage === 1 || loadingNonVoters}
                    onClick={() => setNonVotersPage((prev) => Math.max(prev - 1, 1))}
                    className="px-3 py-1.5 border-2 border-black bg-slate-50 hover:bg-slate-100 text-black font-black uppercase text-xs tracking-wider transition-colors disabled:opacity-40"
                  >
                    Sebelumnya
                  </button>
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Halaman {nonVotersPage} dari {nonVotersTotalPages}
                  </span>
                  <button
                    disabled={nonVotersPage === nonVotersTotalPages || loadingNonVoters}
                    onClick={() => setNonVotersPage((prev) => Math.min(prev + 1, nonVotersTotalPages))}
                    className="px-3 py-1.5 border-2 border-black bg-slate-50 hover:bg-slate-100 text-black font-black uppercase text-xs tracking-wider transition-colors disabled:opacity-40"
                  >
                    Selanjutnya
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

      </main>

      {/* Footer Dashboard */}
      <footer className="border-t-2 border-slate-200 py-4 px-6 text-center bg-white mt-8">
        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
          ZEVOTE © 2026 · Sistem Informasi TPS E-Voting OSIS Digital Terpusat
        </p>
      </footer>

      {/* CUSTOM CONFIRM MODAL (NEO-BRUTALIST) */}
      {confirmState.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="bg-white border-4 border-black w-full max-w-md p-6 relative text-black animate-scale-up"
            style={{ boxShadow: "8px 8px 0px 0px #000" }}
          >
            <h3 className="text-2xl font-black uppercase tracking-wide text-black mb-3">
              {confirmState.title}
            </h3>
            <p className="text-slate-600 font-semibold text-sm mb-6 whitespace-pre-line">
              {confirmState.message}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setConfirmState({ ...confirmState, isOpen: false })}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-black border-2 border-black font-black uppercase text-xs tracking-wider transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  if (confirmState.onConfirm) confirmState.onConfirm();
                  setConfirmState({ ...confirmState, isOpen: false });
                }}
                className={`flex-1 py-3 border-2 border-black font-black uppercase text-xs tracking-wider transition-colors text-white ${
                  confirmState.isDanger ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                Ya, Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM ALERT MODAL (NEO-BRUTALIST) */}
      {alertState.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="bg-white border-4 border-black w-full max-w-sm p-6 relative text-black animate-scale-up"
            style={{ boxShadow: "8px 8px 0px 0px #000" }}
          >
            <h3 className={`text-2xl font-black uppercase tracking-wide mb-3 ${alertState.type === "error" ? "text-rose-600" : "text-emerald-600"}`}>
              {alertState.title}
            </h3>
            <p className="text-slate-600 font-semibold text-sm mb-6">
              {alertState.message}
            </p>
            <button
              onClick={() => setAlertState({ ...alertState, isOpen: false })}
              className="w-full py-3 bg-black hover:bg-zinc-800 text-white border-2 border-black font-black uppercase text-xs tracking-wider transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
