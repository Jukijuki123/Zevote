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
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center font-bold text-white text-lg shadow-sm shadow-emerald-600/10">
            P
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Dashboard Panitia</h1>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              Portal Registrasi Bilik & Monitoring · Role: <span className="text-emerald-600">{role}</span>
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl tracking-wide uppercase text-xs transition-all duration-200 hover:shadow-md hover:shadow-rose-600/25 active:scale-98 self-start sm:self-auto cursor-pointer"
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
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex-1 flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-950 uppercase tracking-tight">Antrean Pendaftaran</h2>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Diperbarui otomatis tiap 6 detik</p>
              </div>
              <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full px-3 py-1 text-xs font-semibold">
                {pendingRequests.length} Antrean
              </span>
            </div>

            {/* List Antrean */}
            <div className="flex-1 overflow-y-auto max-h-[300px] space-y-3 pr-1 mb-6 border-b border-dashed border-slate-200 pb-4">
              {pendingRequests.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-center text-slate-400 border border-dashed border-slate-200 rounded-xl p-6">
                  <Users className="w-10 h-10 mb-2 stroke-1 text-slate-300" />
                  <p className="font-semibold text-slate-600 text-sm">Belum ada antrean pendaftaran</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Siswa di bilik suara belum mengirim permintaan login.</p>
                </div>
              ) : (
                pendingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-all hover:bg-slate-100/50"
                  >
                    <div>
                      <p className="font-bold text-slate-900 text-base leading-tight uppercase">{req.student.nama}</p>
                      <p className="text-xs text-slate-500 font-medium uppercase mt-1">Kelas: {req.student.kelas}</p>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                        Waktu: {new Date(req.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </p>
                    </div>

                    {/* Tombol Aksi */}
                    <div className="flex gap-2 self-end sm:self-auto shrink-0">
                      <button
                        disabled={actionLoading[req.id]}
                        onClick={() => handleAction(req.id, "REJECT")}
                        className="p-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                        title="Tolak Akses"
                      >
                        <UserX className="w-5 h-5" />
                      </button>
                      <button
                        disabled={actionLoading[req.id]}
                        onClick={() => handleAction(req.id, "APPROVE")}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold uppercase text-xs tracking-wider transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 hover:shadow-md cursor-pointer"
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
              <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-bold text-slate-950 uppercase tracking-tight">Bilik Suara Aktif</h2>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Siswa sedang di dalam bilik suara</p>
                </div>
                <span className="bg-blue-50 border border-blue-200 text-blue-700 rounded-full px-3 py-1 text-xs font-semibold">
                  {activeVoters.length} Aktif
                </span>
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 mt-4">
                {activeVoters.length === 0 ? (
                  <div className="h-32 flex flex-col items-center justify-center text-center text-slate-400 border border-dashed border-slate-200 rounded-xl p-4">
                    <p className="font-semibold text-xs text-slate-500">Tidak ada bilik suara yang aktif</p>
                  </div>
                ) : (
                  activeVoters.map((req) => (
                    <div
                      key={req.id}
                      className={`border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl transition-all ${
                        req.status === "TIMED_OUT"
                          ? "bg-rose-50/50 border-rose-200"
                          : "bg-blue-50/30 border-blue-100"
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-slate-900 text-base leading-tight uppercase">{req.student.nama}</p>
                          {req.status === "TIMED_OUT" && (
                            <span className="bg-rose-600 text-white text-[9px] font-bold uppercase px-2 py-0.5 animate-pulse rounded-md">
                              WAKTU HABIS / TERKUNCI
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 font-medium uppercase mt-1">Kelas: {req.student.kelas}</p>
                      </div>

                      <div className="shrink-0">
                        <button
                          disabled={actionLoading[req.id]}
                          onClick={() => confirmResetBooth(req.id, req.student.nama)}
                          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold uppercase text-xs tracking-wider transition-all flex items-center gap-1.5 disabled:opacity-50 shadow-sm hover:shadow-md cursor-pointer"
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
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/60">
            <button
              onClick={() => setRightTab("stats")}
              className={`flex-1 py-2 px-4 text-center font-bold uppercase text-xs tracking-wider rounded-lg transition-all cursor-pointer ${
                rightTab === "stats"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-55"
              }`}
            >
              Monitoring & Statistik
            </button>
            <button
              onClick={() => setRightTab("non_voters")}
              className={`flex-1 py-2 px-4 text-center font-bold uppercase text-xs tracking-wider rounded-lg transition-all cursor-pointer ${
                rightTab === "non_voters"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-55"
              }`}
            >
              Siswa Belum Memilih
            </button>
          </div>

          {rightTab === "stats" ? (
            <div className="space-y-6">
              {/* Summary Stats Cards */}
              {summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Total Siswa</p>
                    <p className="text-2xl font-bold text-slate-900 leading-none mt-1">{summary.total_siswa}</p>
                    <p className="text-[10px] text-slate-400 font-semibold mt-2">Daftar DPT</p>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Hadir di TPS</p>
                    <p className="text-2xl font-bold text-emerald-600 leading-none mt-1">{summary.total_hadir}</p>
                    <p className="text-[10px] text-emerald-600 font-semibold mt-2">Kehadiran: {summary.persen_hadir}%</p>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Sudah Memilih</p>
                    <p className="text-2xl font-bold text-blue-600 leading-none mt-1">{summary.total_memilih}</p>
                    <p className="text-[10px] text-blue-600 font-semibold mt-2">Suara Sah: {summary.persen_memilih}%</p>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Belum Memilih</p>
                    <p className="text-2xl font-bold text-rose-600 leading-none mt-1">{summary.total_golput}</p>
                    <p className="text-[10px] text-rose-600 font-semibold mt-2">Golput / Sisa</p>
                  </div>
                </div>
              )}

              {/* List Kelas & Status Kehadiran */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 uppercase tracking-tight">Partisipasi Kelas</h2>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Statistik di-refresh otomatis tiap 10 detik</p>
                  </div>

                  {/* Input Search Kelas */}
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cari Kelas..."
                      value={searchClass}
                      onChange={(e) => setSearchClass(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 font-medium text-sm focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 transition-all text-slate-800"
                    />
                  </div>
                </div>

                {/* List Progress Kelas */}
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {filteredClassStats.length === 0 ? (
                    <p className="text-center py-8 text-slate-400 font-medium">Kelas tidak ditemukan.</p>
                  ) : (
                    filteredClassStats.map((c) => (
                      <div key={c.kelas} className="border border-slate-100 rounded-xl p-3 bg-slate-50/50 hover:bg-slate-50 transition-all">
                        <div className="flex justify-between items-end mb-1.5">
                          <p className="font-bold text-slate-800 uppercase tracking-wider text-xs">{c.kelas}</p>
                          <p className="text-xs text-slate-500 font-medium">
                            Hadir: <span className="text-slate-800 font-bold">{c.hadir}</span>/{c.total} siswa ({c.persen_hadir}%)
                          </p>
                        </div>

                        {/* Progress Bar Kehadiran Kelas */}
                        <div className="w-full h-2 bg-slate-200/70 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-600 rounded-full transition-all duration-500"
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
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 uppercase tracking-tight">Siswa Belum Memilih</h2>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                    Total: {nonVotersTotalCount} Siswa Belum Menyalurkan Suara
                  </p>
                </div>
                <button
                  onClick={() => fetchNonVoters(nonVotersPage, nonVotersSearch, nonVotersClass)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg bg-white hover:bg-slate-55 text-slate-700 font-semibold text-xs uppercase flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 font-medium text-sm focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 transition-all text-slate-800"
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 font-medium text-sm focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 transition-all text-slate-800"
                  />
                </div>
              </div>

              {/* Students List */}
              {loadingNonVoters ? (
                <div className="py-20 flex justify-center items-center">
                  <div className="w-8 h-8 border-3 border-rose-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : nonVoters.length === 0 ? (
                <div className="py-16 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl font-medium text-sm">
                  Semua siswa dalam pencarian ini telah selesai memilih.
                </div>
              ) : (
                <div className="border border-slate-100 rounded-xl overflow-x-auto shadow-xs">
                  <table className="w-full text-left border-collapse min-w-[500px]">
                    <thead>
                      <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        <th className="p-3">Nama Siswa</th>
                        <th className="p-3">Kelas</th>
                        <th className="p-3 text-right">Status Kehadiran</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-xs text-slate-700">
                      {nonVoters.map((student) => (
                        <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-3 font-bold uppercase text-slate-900">{student.nama}</td>
                          <td className="p-3 text-slate-500 font-bold uppercase">{student.kelas}</td>
                          <td className="p-3 text-right">
                            {student.hadir ? (
                              <span className="bg-emerald-50 text-emerald-700 text-[10px] font-semibold px-2 py-1 rounded-full border border-emerald-100">
                                HADIR DI TPS
                              </span>
                            ) : (
                              <span className="bg-rose-50 text-rose-700 text-[10px] font-semibold px-2 py-1 rounded-full border border-rose-100">
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
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <button
                    disabled={nonVotersPage === 1 || loadingNonVoters}
                    onClick={() => setNonVotersPage((prev) => Math.max(prev - 1, 1))}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-semibold uppercase text-xs tracking-wider transition-all disabled:opacity-40 disabled:hover:bg-white cursor-pointer shadow-xs"
                  >
                    Sebelumnya
                  </button>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Halaman {nonVotersPage} dari {nonVotersTotalPages}
                  </span>
                  <button
                    disabled={nonVotersPage === nonVotersTotalPages || loadingNonVoters}
                    onClick={() => setNonVotersPage((prev) => Math.min(prev + 1, nonVotersTotalPages))}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-semibold uppercase text-xs tracking-wider transition-all disabled:opacity-40 disabled:hover:bg-white cursor-pointer shadow-xs"
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
      <footer className="border-t border-slate-200/60 py-4 px-6 text-center bg-white mt-8 shadow-xs">
        <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-widest">
          ZEVOTE © 2026 · Sistem Informasi TPS E-Voting OSIS Digital Terpusat
        </p>
      </footer>

      {/* CUSTOM CONFIRM MODAL (MODERN CLEAN) */}
      {confirmState.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-100 rounded-2xl shadow-xl w-full max-w-md p-6 relative text-slate-900 animate-scale-up">
            <h3 className="text-xl font-bold uppercase tracking-tight text-slate-950 mb-2">
              {confirmState.title}
            </h3>
            <p className="text-slate-600 font-medium text-sm mb-6 whitespace-pre-line">
              {confirmState.message}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setConfirmState({ ...confirmState, isOpen: false })}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold uppercase text-xs tracking-wider transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  if (confirmState.onConfirm) confirmState.onConfirm();
                  setConfirmState({ ...confirmState, isOpen: false });
                }}
                className={`flex-1 py-2.5 rounded-xl font-bold uppercase text-xs tracking-wider transition-all text-white shadow-sm cursor-pointer ${
                  confirmState.isDanger ? "bg-rose-600 hover:bg-rose-700 shadow-rose-200" : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200"
                }`}
              >
                Ya, Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM ALERT MODAL (MODERN CLEAN) */}
      {alertState.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-100 rounded-2xl shadow-xl w-full max-w-sm p-6 relative text-slate-900 animate-scale-up">
            <h3 className={`text-xl font-bold uppercase tracking-tight mb-2 ${alertState.type === "error" ? "text-rose-600" : "text-emerald-600"}`}>
              {alertState.title}
            </h3>
            <p className="text-slate-600 font-medium text-sm mb-6">
              {alertState.message}
            </p>
            <button
              onClick={() => setAlertState({ ...alertState, isOpen: false })}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold uppercase text-xs tracking-wider transition-all shadow-sm cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
