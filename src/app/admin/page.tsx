"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Settings,
  Users,
  UserCheck,
  Trash2,
  Edit3,
  Upload,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  Search,
  FileSpreadsheet,
  RefreshCw,
} from "lucide-react";


interface Candidate {
  id: string;
  nomor_urut: number;
  nama: string;
  foto_url: string;
}

interface Student {
  id: string;
  nama: string;
  kelas: string;
  hadir: boolean;
  sudah_memilih: boolean;
}

interface AuditLog {
  id: string;
  actor: string;
  action: string;
  created_at: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"status" | "candidates" | "students" | "logs">("status");
  const [loading, setLoading] = useState(true);

  // Data States
  const [setting, setSetting] = useState<{ election_status: "DRAFT" | "OPEN" | "CLOSED" } | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);

  // Students Pagination & Search States
  const [studentSearch, setStudentSearch] = useState("");
  const [studentPage, setStudentPage] = useState(1);
  const [totalStudentsCount, setTotalStudentsCount] = useState(0);
  const [studentTotalPages, setStudentTotalPages] = useState(1);

  // Candidate Form States
  const [candidateForm, setCandidateForm] = useState({ id: "", nomor_urut: "", nama: "", foto_url: "" });
  const [editingCandidate, setEditingCandidate] = useState(false);
  const [candidateError, setCandidateError] = useState("");

  // CSV Import States
  const [csvPreview, setCsvPreview] = useState<{ nama: string; kelas: string }[]>([]);
  const [importOverwrite, setImportOverwrite] = useState(true);
  const [importStatus, setImportStatus] = useState({ success: false, message: "", loading: false });

  // Manual Student Input States
  const [manualStudent, setManualStudent] = useState({ nama: "", kelas: "" });
  const [manualStatus, setManualStatus] = useState({ success: false, message: "", loading: false });

  // General Error/Success Messages
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Custom Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
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

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) setSetting(await res.json());
    } catch (error) {
      console.error("fetchSettings error:", error);
    }
  }, []);

  const fetchCandidates = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/candidates");
      if (res.ok) setCandidates(await res.json());
    } catch (error) {
      console.error("fetchCandidates error:", error);
    }
  }, []);

  const fetchStudents = useCallback(async (page = 1, search = studentSearch) => {
    try {
      const res = await fetch(`/api/admin/students?page=${page}&limit=20&search=${encodeURIComponent(search)}`);
      if (res.ok) {
        const data = await res.json();
        setStudents(data.students);
        setTotalStudentsCount(data.total);
        setStudentPage(data.page);
        setStudentTotalPages(data.totalPages);
      }
    } catch (error) {
      console.error("fetchStudents error:", error);
    }
  }, [studentSearch]);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/audit-logs");
      if (res.ok) setLogs(await res.json());
    } catch (error) {
      console.error("fetchLogs error:", error);
    }
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) {
        router.push("/admin/login");
        return;
      }
      const data = await res.json();
      if (data.role !== "admin") {
        router.push("/admin/login");
        return;
      }
      // Load all data
      await Promise.all([fetchSettings(), fetchCandidates(), fetchStudents(1), fetchLogs()]);
      setLoading(false);
    } catch (error) {
      console.error("checkAuth error:", error);
      router.push("/admin/login");
    }
  }, [router, fetchSettings, fetchCandidates, fetchStudents, fetchLogs]);

  // Fetch initial data
  useEffect(() => {
    const init = async () => {
      await checkAuth();
    };
    init();
  }, [checkAuth]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
  };

  const triggerAlert = (type: "success" | "error", message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  // ------------------ TAB 1: ELECTION SETTINGS ------------------
  const executeUpdateElectionStatus = async (status: "OPEN" | "CLOSED") => {
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        triggerAlert("success", `Status pemilihan berhasil diubah menjadi ${status}`);
        fetchSettings();
        fetchLogs();
      } else {
        const errorData = await res.json();
        triggerAlert("error", errorData.message || "Gagal mengubah status pemilihan");
      }
    } catch (error) {
      console.error("updateElectionStatus error:", error);
      triggerAlert("error", "Terjadi kesalahan koneksi.");
    }
  };

  const updateElectionStatus = (status: "OPEN" | "CLOSED") => {
    if (status === "CLOSED") {
      setConfirmModal({
        isOpen: true,
        title: "Tutup Pemilihan",
        message: "Apakah Anda yakin ingin MENUTUP pemilihan? Sesi voting akan dihentikan dan hasil akan dirangkum.",
        isDanger: true,
        onConfirm: () => executeUpdateElectionStatus(status),
      });
    } else if (status === "OPEN" && setting?.election_status === "CLOSED") {
      setConfirmModal({
        isOpen: true,
        title: "Buka Kembali Pemilihan",
        message: "Apakah Anda yakin ingin MEMBUKA KEMBALI pemilihan?\nSiswa akan dapat melakukan voting lagi dan seluruh data suara yang sudah masuk sebelumnya TIDAK akan terhapus.",
        isDanger: false,
        onConfirm: () => executeUpdateElectionStatus(status),
      });
    } else {
      executeUpdateElectionStatus(status);
    }
  };

  const executeResetElection = async () => {
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset: true }),
      });
      if (res.ok) {
        triggerAlert("success", "Pemilihan berhasil di-reset total ke DRAFT.");
        fetchSettings();
        fetchCandidates();
        fetchStudents(1, "");
        fetchLogs();
      } else {
        triggerAlert("error", "Gagal mereset pemilihan.");
      }
    } catch (error) {
      console.error("resetElection error:", error);
      triggerAlert("error", "Terjadi kesalahan koneksi.");
    }
  };

  const resetElection = () => {
    setConfirmModal({
      isOpen: true,
      title: "Reset Total Pemilihan",
      message: "PERINGATAN KERAS!\nTindakan ini akan menghapus seluruh suara masuk, menghapus antrean login, dan mengatur ulang status kehadiran siswa ke nol.\n\nApakah Anda yakin ingin mereset total?",
      isDanger: true,
      onConfirm: () => executeResetElection(),
    });
  };

  // ------------------ TAB 2: CANDIDATES CRUD ------------------
  const handleCandidateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCandidateError("");

    const url = editingCandidate
      ? `/api/admin/candidates/${candidateForm.id}`
      : "/api/admin/candidates";
    const method = editingCandidate ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomor_urut: candidateForm.nomor_urut,
          nama: candidateForm.nama,
          foto_url: candidateForm.foto_url,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        triggerAlert(
          "success",
          editingCandidate ? "Data kandidat berhasil diperbarui." : "Kandidat berhasil ditambahkan."
        );
        setCandidateForm({ id: "", nomor_urut: "", nama: "", foto_url: "" });
        setEditingCandidate(false);
        fetchCandidates();
        fetchLogs();
      } else {
        setCandidateError(data.message || "Gagal menyimpan data kandidat.");
      }
    } catch (error) {
      console.error("handleCandidateSubmit error:", error);
      setCandidateError("Terjadi kesalahan koneksi.");
    }
  };

  const handleEditCandidate = (c: Candidate) => {
    setCandidateForm({
      id: c.id,
      nomor_urut: c.nomor_urut.toString(),
      nama: c.nama,
      foto_url: c.foto_url,
    });
    setEditingCandidate(true);
    setCandidateError("");
  };

  const executeDeleteCandidate = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/admin/candidates/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        triggerAlert("success", `Kandidat ${name} berhasil dihapus.`);
        fetchCandidates();
        fetchLogs();
      } else {
        triggerAlert("error", "Gagal menghapus kandidat.");
      }
    } catch (error) {
      console.error("handleDeleteCandidate error:", error);
      triggerAlert("error", "Terjadi kesalahan koneksi.");
    }
  };

  const handleDeleteCandidate = (id: string, name: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Hapus Kandidat",
      message: `Apakah Anda yakin ingin menghapus kandidat: ${name}?`,
      isDanger: true,
      onConfirm: () => executeDeleteCandidate(id, name),
    });
  };

  // ------------------ TAB 3: STUDENTS CSV IMPORT ------------------
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r?\n/);
      const parsed: { nama: string; kelas: string }[] = [];

      if (lines.length <= 1) {
        triggerAlert("error", "File CSV kosong atau tidak valid!");
        return;
      }

      // Deteksi Header
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const namaIdx = headers.indexOf("nama");
      const kelasIdx = headers.indexOf("kelas");

      if (namaIdx === -1 || kelasIdx === -1) {
        // Jika tidak ada header, asumsikan kolom 1: Nama, kolom 2: Kelas
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          const cols = lines[i].split(",").map((c) => c.replace(/^["']|["']$/g, "").trim()); // Bersihkan kutip
          if (cols.length >= 2) {
            parsed.push({ nama: cols[0], kelas: cols[1] });
          }
        }
      } else {
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          const cols = lines[i].split(",").map((c) => c.replace(/^["']|["']$/g, "").trim());
          if (cols.length > Math.max(namaIdx, kelasIdx)) {
            parsed.push({
              nama: cols[namaIdx],
              kelas: cols[kelasIdx],
            });
          }
        }
      }

      setCsvPreview(parsed);
      setImportStatus({ success: false, message: "", loading: false });
    };
    reader.readAsText(file);
  };

  const handleImportSubmit = async () => {
    if (csvPreview.length === 0) return;

    setImportStatus({ success: false, message: "", loading: true });

    try {
      const res = await fetch("/api/admin/students/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          students: csvPreview,
          overwrite: importOverwrite,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setImportStatus({
          success: true,
          message: `Berhasil mengimpor ${data.count} siswa ke dalam database.`,
          loading: false,
        });
        setCsvPreview([]);
        fetchStudents(1);
        fetchLogs();
      } else {
        setImportStatus({
          success: false,
          message: data.message || "Gagal mengimpor data siswa.",
          loading: false,
        });
      }
    } catch (error) {
      console.error("handleImportSubmit error:", error);
      setImportStatus({
        success: false,
        message: "Terjadi kesalahan koneksi saat mengimpor.",
        loading: false,
      });
    }
  };

  const handleManualStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualStudent.nama || !manualStudent.kelas) return;

    setManualStatus({ success: false, message: "", loading: true });

    try {
      const res = await fetch("/api/admin/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(manualStudent),
      });

      const data = await res.json();

      if (res.ok) {
        setManualStatus({
          success: true,
          message: `Berhasil menambahkan siswa: ${data.nama}`,
          loading: false,
        });
        setManualStudent({ nama: "", kelas: "" });
        fetchStudents(1);
        fetchLogs();
        triggerAlert("success", `Siswa ${data.nama} berhasil ditambahkan secara manual.`);
      } else {
        setManualStatus({
          success: false,
          message: data.message || "Gagal menambahkan siswa.",
          loading: false,
        });
      }
    } catch (error) {
      console.error("handleManualStudentSubmit error:", error);
      setManualStatus({
        success: false,
        message: "Terjadi kesalahan koneksi.",
        loading: false,
      });
    }
  };

  const handleStudentSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStudents(1, studentSearch);
  };

  // UI Render loading state
  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white">
        <RefreshCw className="w-12 h-12 text-rose-600 animate-spin mb-4" />
        <h2 className="text-xl font-bold">Memuat Dashboard Admin...</h2>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50/50">
      {/* Header */}
      <header className="border-b border-rose-500 bg-rose-600 text-white p-6 flex items-center justify-between shadow-xs">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">ZEVOTE PANEL</h1>
          <p className="font-semibold text-rose-100 mt-0.5">Kontrol Pemilihan Ketua OSIS Terpusat</p>
        </div>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-rose-750 hover:bg-rose-800 text-white font-semibold text-sm rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer"
        >
          <LogOut className="w-4 h-4" /> Keluar
        </button>
      </header>

      {/* Main Grid Layout */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-5">
        {/* Navigation Sidebar */}
        <nav className="md:col-span-1 border-r border-slate-200 p-6 bg-slate-50 flex flex-col space-y-2">
          <button
            onClick={() => setActiveTab("status")}
            className={`w-full py-2.5 px-4 text-left font-semibold rounded-xl flex items-center gap-3 transition-all cursor-pointer text-sm ${
              activeTab === "status"
                ? "bg-rose-600 text-white shadow-sm shadow-rose-600/10"
                : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Settings className="w-5 h-5" /> Status & Kontrol
          </button>
          <button
            onClick={() => setActiveTab("candidates")}
            className={`w-full py-2.5 px-4 text-left font-semibold rounded-xl flex items-center gap-3 transition-all cursor-pointer text-sm ${
              activeTab === "candidates"
                ? "bg-rose-600 text-white shadow-sm shadow-rose-600/10"
                : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Users className="w-5 h-5" /> Kelola Kandidat
          </button>
          <button
            onClick={() => setActiveTab("students")}
            className={`w-full py-2.5 px-4 text-left font-semibold rounded-xl flex items-center gap-3 transition-all cursor-pointer text-sm ${
              activeTab === "students"
                ? "bg-rose-600 text-white shadow-sm shadow-rose-600/10"
                : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <UserCheck className="w-5 h-5" /> Kelola Siswa
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`w-full py-2.5 px-4 text-left font-semibold rounded-xl flex items-center gap-3 transition-all cursor-pointer text-sm ${
              activeTab === "logs"
                ? "bg-rose-600 text-white shadow-sm shadow-rose-600/10"
                : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <FileSpreadsheet className="w-5 h-5" /> Log Audit
          </button>
        </nav>

        {/* Content Pane */}
        <main className="md:col-span-4 p-8 overflow-y-auto bg-slate-50/30">
          {/* Global Alert Notification */}
          {alert && (
            <div
              className={`mb-6 p-4 border rounded-2xl font-semibold flex items-center gap-3 shadow-xs ${
                alert.type === "success" ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-rose-50 border-rose-100 text-rose-700"
              }`}
            >
              {alert.type === "success" ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
              {alert.message}
            </div>
          )}

          {/* ------------------ TAB 1: STATUS & CONTROL ------------------ */}
          {activeTab === "status" && (
            <div className="space-y-8">
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
                <h2 className="text-xl font-bold text-slate-900 mb-4 uppercase tracking-wide">Status Pemilihan Sekarang</h2>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-slate-600 text-sm uppercase">Status:</span>
                    <span
                      className={`px-3 py-1 font-bold text-xs uppercase tracking-wider rounded-full ${
                        setting?.election_status === "OPEN"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : setting?.election_status === "CLOSED"
                          ? "bg-slate-900 text-white border border-slate-800"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}
                    >
                      {setting?.election_status || "DRAFT"}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {setting?.election_status === "DRAFT" && (
                      <button
                        onClick={() => updateElectionStatus("OPEN")}
                        className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 border border-emerald-600 hover:border-emerald-700 text-white font-semibold text-sm rounded-xl transition-all shadow-sm hover:shadow-md cursor-pointer hover:shadow-emerald-600/10"
                      >
                        Buka Pemilihan
                      </button>
                    )}
                    {setting?.election_status === "OPEN" && (
                      <button
                        onClick={() => updateElectionStatus("CLOSED")}
                        className="px-6 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-900 hover:border-slate-800 text-white font-semibold text-sm rounded-xl transition-all shadow-sm hover:shadow-md cursor-pointer"
                      >
                        Tutup Pemilihan
                      </button>
                    )}
                    {setting?.election_status === "CLOSED" && (
                      <button
                        onClick={() => updateElectionStatus("OPEN")}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 border border-blue-600 hover:border-blue-700 text-white font-semibold text-sm rounded-xl transition-all shadow-sm hover:shadow-md cursor-pointer hover:shadow-blue-600/10"
                      >
                        Buka Kembali Pemilihan
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Reset Control */}
              <div className="border border-rose-100 bg-rose-50/50 rounded-2xl p-6 shadow-xs">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-rose-100/60 rounded-xl border border-rose-200">
                    <AlertTriangle className="w-8 h-8 text-rose-600" />
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-rose-800 uppercase tracking-wide">Reset Total Pemilihan</h3>
                    <p className="text-rose-700 text-sm font-medium leading-relaxed">
                      Tindakan ini akan menghapus semua perolehan suara kandidat dan menghapus status kehadiran siswa
                      sehingga pemilihan dapat diulang dari awal. Data kandidat dan data siswa tidak akan terhapus.
                    </p>
                    <button
                      onClick={resetElection}
                      className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 border border-rose-600 hover:border-rose-700 text-white font-semibold text-sm rounded-xl transition-all shadow-sm hover:shadow-md hover:shadow-rose-600/15 cursor-pointer"
                    >
                      Reset Semua Suara & Status Kehadiran
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ------------------ TAB 2: CANDIDATES CRUD ------------------ */}
          {activeTab === "candidates" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Form Add/Edit */}
              <div className="lg:col-span-1">
                <div className="border border-slate-200 bg-white rounded-2xl shadow-sm p-6 sticky top-6">
                  <h2 className="text-xl font-bold text-slate-900 mb-6 uppercase tracking-wide">
                    {editingCandidate ? "Edit Kandidat" : "Tambah Kandidat"}
                  </h2>

                  {candidateError && (
                    <div className="mb-4 p-3 border border-rose-100 rounded-xl bg-rose-50/50 text-rose-700 font-semibold text-xs">
                      {candidateError}
                    </div>
                  )}

                  <form onSubmit={handleCandidateSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Nomor Urut</label>
                      <input
                        type="number"
                        min="1"
                        value={candidateForm.nomor_urut}
                        onChange={(e) => setCandidateForm({ ...candidateForm, nomor_urut: e.target.value })}
                        required
                        className="w-full neo-input text-sm rounded-xl"
                        placeholder="1, 2, atau 3"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Nama Kandidat</label>
                      <input
                        type="text"
                        value={candidateForm.nama}
                        onChange={(e) => setCandidateForm({ ...candidateForm, nama: e.target.value })}
                        required
                        className="w-full neo-input text-sm rounded-xl"
                        placeholder="Nama Lengkap Kandidat"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">URL Foto (Opsional)</label>
                      <input
                        type="text"
                        value={candidateForm.foto_url}
                        onChange={(e) => setCandidateForm({ ...candidateForm, foto_url: e.target.value })}
                        className="w-full neo-input text-sm rounded-xl mb-3"
                        placeholder="/images/kandidat1.jpg"
                      />
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Atau Unggah Foto Baru</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          
                          const formData = new FormData();
                          formData.append("file", file);
                          
                          try {
                            const res = await fetch("/api/admin/candidates/upload", {
                              method: "POST",
                              body: formData,
                            });
                            const data = await res.json();
                            if (res.ok) {
                              setCandidateForm((prev) => ({ ...prev, foto_url: data.url }));
                              triggerAlert("success", "Foto berhasil diunggah.");
                            } else {
                              triggerAlert("error", data.message || "Gagal mengunggah foto.");
                            }
                          } catch {
                            triggerAlert("error", "Kesalahan koneksi saat mengunggah foto.");
                          }
                        }}
                        className="w-full bg-slate-55 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all text-slate-800"
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="submit"
                        className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 border border-rose-600 text-white font-semibold rounded-xl text-xs shadow-sm hover:shadow-md hover:shadow-rose-600/15 transition-all cursor-pointer"
                      >
                        {editingCandidate ? "Simpan Perubahan" : "Tambah"}
                      </button>
                      {editingCandidate && (
                        <button
                          type="button"
                          onClick={() => {
                            setCandidateForm({ id: "", nomor_urut: "", nama: "", foto_url: "" });
                            setEditingCandidate(false);
                          }}
                          className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-xs shadow-sm hover:shadow-md transition-all cursor-pointer"
                        >
                          Batal
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              </div>

              {/* Grid List */}
              <div className="lg:col-span-2">
                <h2 className="text-xl font-bold text-slate-900 mb-6 uppercase tracking-wide">Daftar Kandidat</h2>
                {candidates.length === 0 ? (
                  <div className="border border-slate-200 rounded-2xl p-8 text-center text-slate-500 font-semibold bg-white shadow-sm">
                    Belum ada kandidat terdaftar.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {candidates.map((c) => (
                      <div key={c.id} className="border border-slate-200 bg-white rounded-2xl shadow-sm p-6 flex flex-col justify-between hover:shadow-md transition-all">
                        <div>
                          {/* Photo Placeholder/Visual */}
                          <div className="w-full aspect-video border border-slate-200 bg-slate-55 flex items-center justify-center overflow-hidden mb-4 rounded-xl shadow-xs">
                            {c.foto_url ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={c.foto_url} alt={c.nama} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-4xl font-black text-gray-400">PASLON {c.nomor_urut}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mb-2">
                            <span className="w-8 h-8 rounded-lg bg-slate-900 text-white font-bold flex items-center justify-center text-sm">
                              {c.nomor_urut}
                            </span>
                            <h3 className="font-extrabold text-slate-800 text-base truncate uppercase">{c.nama}</h3>
                          </div>
                        </div>

                        <div className="flex border-t border-slate-100 pt-4 mt-4 gap-2">
                          <button
                            onClick={() => handleEditCandidate(c)}
                            className="flex-1 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> Edit
                          </button>
                          <button
                            onClick={() => handleDeleteCandidate(c.id, c.nama)}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 border border-rose-600 text-white rounded-xl text-xs flex items-center justify-center transition-all cursor-pointer shadow-xs hover:shadow-md hover:shadow-rose-600/15"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ------------------ TAB 3: STUDENTS IMPORT & LIST ------------------ */}
          {activeTab === "students" && (
            <div className="space-y-8">
              {/* Student Input Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Import Box */}
                <div className="border border-slate-200 bg-white rounded-2xl shadow-sm p-6">
                  <h2 className="text-xl font-bold text-slate-900 mb-4 uppercase tracking-wide">Import Data Siswa secara Massal</h2>
                  <p className="text-slate-500 font-medium text-sm mb-6">
                    Unggah berkas CSV yang berisi daftar siswa. Berkas wajib memiliki kolom/header: **Nama** dan **Kelas**.
                  </p>

                  {importStatus.message && (
                    <div
                      className={`mb-6 p-4 border rounded-xl font-semibold text-sm shadow-xs ${
                        importStatus.success ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-rose-50 border-rose-100 text-rose-700"
                      }`}
                    >
                      {importStatus.message}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                    {/* File Input */}
                    <label className="flex-1 border border-dashed border-slate-300 rounded-2xl p-4 bg-slate-55/50 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100/50 hover:border-slate-400 transition-all shadow-xs">
                      <Upload className="w-8 h-8 text-slate-400 mb-2" />
                      <span className="font-bold text-sm text-slate-700">Pilih Berkas CSV</span>
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleCSVUpload}
                        className="hidden"
                        disabled={importStatus.loading}
                      />
                    </label>

                    {/* Settings and Action */}
                    <div className="flex-1 flex flex-col justify-between space-y-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="overwrite"
                          checked={importOverwrite}
                          onChange={(e) => setImportOverwrite(e.target.checked)}
                          className="w-4 h-4 border border-slate-300 accent-rose-600 rounded-sm cursor-pointer"
                          disabled={importStatus.loading}
                        />
                        <label htmlFor="overwrite" className="font-semibold text-xs text-slate-650 cursor-pointer select-none">
                          Hapus siswa lama & timpa baru (Overwrite)
                        </label>
                      </div>

                      <button
                        onClick={handleImportSubmit}
                        disabled={csvPreview.length === 0 || importStatus.loading}
                        className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow-md"
                      >
                        {importStatus.loading
                          ? "Mengimpor..."
                          : `Unggah & Simpan ${csvPreview.length ? `(${csvPreview.length} Siswa)` : ""}`}
                      </button>
                    </div>
                  </div>

                  {/* CSV Preview */}
                  {csvPreview.length > 0 && (
                    <div className="mt-6 border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto shadow-xs bg-white">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-500 uppercase">
                            <th className="p-3 border-r border-slate-200">No</th>
                            <th className="p-3 border-r border-slate-200">Nama</th>
                            <th className="p-3">Kelas</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm font-medium text-slate-700">
                          {csvPreview.slice(0, 50).map((row, idx) => (
                            <tr key={idx} className="border-b border-slate-100">
                              <td className="p-2 border-r border-slate-200 bg-slate-50 font-semibold text-xs text-center text-slate-500">
                                {idx + 1}
                              </td>
                              <td className="p-2 border-r border-slate-200">{row.nama}</td>
                              <td className="p-2">{row.kelas}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {csvPreview.length > 50 && (
                        <div className="p-3 bg-slate-50 text-center text-xs font-semibold text-slate-500 border-t border-slate-200">
                          Dan {csvPreview.length - 50} data siswa lainnya...
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Manual Input Box */}
                <div className="border border-slate-200 bg-white rounded-2xl shadow-sm p-6">
                  <h2 className="text-xl font-bold text-slate-900 mb-4 uppercase tracking-wide">Input Siswa secara Manual</h2>
                  <p className="text-slate-500 font-medium text-sm mb-6">
                    Tambahkan data siswa satu per satu secara langsung ke dalam database pemilihan.
                  </p>

                  {manualStatus.message && (
                    <div
                      className={`mb-6 p-4 border rounded-xl font-semibold text-sm shadow-xs ${
                        manualStatus.success ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-rose-50 border-rose-100 text-rose-700"
                      }`}
                    >
                      {manualStatus.message}
                    </div>
                  )}

                  <form onSubmit={handleManualStudentSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1">Nama Siswa</label>
                      <input
                        type="text"
                        value={manualStudent.nama}
                        onChange={(e) => setManualStudent({ ...manualStudent, nama: e.target.value })}
                        required
                        className="w-full neo-input text-sm rounded-xl"
                        placeholder="Contoh: Juki Sadikin"
                        disabled={manualStatus.loading}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-655 uppercase tracking-wider mb-1">Kelas</label>
                      <input
                        type="text"
                        value={manualStudent.kelas}
                        onChange={(e) => setManualStudent({ ...manualStudent, kelas: e.target.value })}
                        required
                        className="w-full neo-input text-sm rounded-xl"
                        placeholder="Contoh: XII-RPL-1"
                        disabled={manualStatus.loading}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={manualStatus.loading || !manualStudent.nama || !manualStudent.kelas}
                      className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow-md"
                    >
                      {manualStatus.loading ? "Menyimpan..." : "Tambah Siswa"}
                    </button>
                  </form>
                </div>
              </div>

              {/* Student Database List */}
              <div className="border border-slate-200 bg-white rounded-2xl shadow-sm p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <h2 className="text-xl font-bold text-slate-900 uppercase tracking-wide">Daftar Data Siswa ({totalStudentsCount})</h2>

                  <form onSubmit={handleStudentSearch} className="flex gap-2 w-full sm:max-w-md">
                    <input
                      type="text"
                      placeholder="Cari nama atau kelas..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="flex-1 neo-input text-sm rounded-xl"
                    />
                    <button type="submit" className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 font-semibold rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-sm hover:shadow-md">
                      <Search className="w-4 h-4" />
                    </button>
                  </form>
                </div>

                {students.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 font-semibold border border-dashed border-slate-200 rounded-2xl bg-slate-50/55">
                    Tidak ditemukan data siswa.
                  </div>
                ) : (
                  <div className="border border-slate-100 rounded-xl overflow-hidden overflow-x-auto shadow-xs bg-white">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                      <thead>
                        <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          <th className="p-3 border-r border-slate-200/60">Nama</th>
                          <th className="p-3 border-r border-slate-200/60">Kelas</th>
                          <th className="p-3 border-r border-slate-200/60 text-center">Hadir</th>
                          <th className="p-3 text-center">Sudah Voting</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm font-medium text-slate-700">
                        {students.map((student) => (
                          <tr key={student.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                            <td className="p-3 border-r border-slate-100 font-bold text-slate-900">{student.nama}</td>
                            <td className="p-3 border-r border-slate-100">{student.kelas}</td>
                            <td className="p-3 border-r border-slate-100 text-center">
                              <span
                                className={`inline-flex px-2.5 py-0.5 border rounded-full font-semibold text-[10px] uppercase ${
                                  student.hadir
                                    ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                                    : "bg-slate-100 border-slate-200 text-slate-600"
                                }`}
                              >
                                {student.hadir ? "YA" : "TIDAK"}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <span
                                className={`inline-flex px-2.5 py-0.5 border rounded-full font-semibold text-[10px] uppercase ${
                                  student.sudah_memilih
                                    ? "bg-rose-50 border-rose-100 text-rose-700"
                                    : "bg-slate-100 border-slate-200 text-slate-600"
                                }`}
                              >
                                {student.sudah_memilih ? "SUDAH" : "BELUM"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pagination Controls */}
                {studentTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-4 mt-6">
                    <button
                      onClick={() => {
                        const prev = Math.max(1, studentPage - 1);
                        setStudentPage(prev);
                        fetchStudents(prev);
                      }}
                      disabled={studentPage === 1}
                      className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-xs shadow-xs hover:shadow-md transition-all cursor-pointer disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed"
                    >
                      Sebelumnya
                    </button>
                    <span className="font-semibold text-sm text-slate-600">
                      Halaman {studentPage} dari {studentTotalPages}
                    </span>
                    <button
                      onClick={() => {
                        const next = Math.min(studentTotalPages, studentPage + 1);
                        setStudentPage(next);
                        fetchStudents(next);
                      }}
                      disabled={studentPage === studentTotalPages}
                      className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-xs shadow-xs hover:shadow-md transition-all cursor-pointer disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed"
                    >
                      Selanjutnya
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ------------------ TAB 4: AUDIT LOGS ------------------ */}
          {activeTab === "logs" && (
            <div className="border border-slate-200 bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-6 uppercase tracking-wide">Log Audit Aktivitas (100 Terakhir)</h2>
              {logs.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-semibold border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  Belum ada catatan aktivitas.
                </div>
              ) : (
                <div className="border border-slate-100 rounded-xl overflow-hidden overflow-x-auto max-h-[600px] overflow-y-auto shadow-xs bg-white">
                  <table className="w-full text-left border-collapse min-w-[500px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-505 uppercase tracking-wider sticky top-0">
                        <th className="p-3 border-r border-slate-200/60">Waktu</th>
                        <th className="p-3 border-r border-slate-200/60">Aktor</th>
                        <th className="p-3">Aktivitas</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm font-medium text-slate-700">
                      {logs.map((log) => (
                        <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                          <td className="p-3 border-r border-slate-100 text-xs text-slate-500 font-mono">
                            {new Date(log.created_at).toLocaleString("id-ID")}
                          </td>
                          <td className="p-3 border-r border-slate-100 font-semibold text-rose-600 text-xs tracking-wider uppercase">
                            {log.actor}
                          </td>
                          <td className="p-3 text-slate-700 font-medium">{log.action}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* CUSTOM CONFIRM MODAL (MODERN CLEAN) */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-100 rounded-2xl shadow-xl w-full max-w-md p-6 relative text-slate-900 animate-scale-up">
            <h3 className="text-xl font-bold uppercase tracking-tight text-slate-955 mb-2">
              {confirmModal.title}
            </h3>
            <p className="text-slate-650 font-medium text-sm mb-6 whitespace-pre-line">
              {confirmModal.message}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold uppercase text-xs tracking-wider transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  if (confirmModal.onConfirm) confirmModal.onConfirm();
                  setConfirmModal({ ...confirmModal, isOpen: false });
                }}
                className={`flex-1 py-2.5 rounded-xl font-bold uppercase text-xs tracking-wider transition-all text-white shadow-sm cursor-pointer ${
                  confirmModal.isDanger ? "bg-rose-600 hover:bg-rose-700 shadow-rose-200" : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200"
                }`}
              >
                Ya, Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
