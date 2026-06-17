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
    <div className="flex-1 flex flex-col bg-white">
      {/* Header */}
      <header className="border-b-4 border-black bg-rose-600 text-white p-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">ZEVOTE PANEL</h1>
          <p className="font-semibold text-rose-100 mt-0.5">Kontrol Pemilihan Ketua OSIS Terpusat</p>
        </div>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-black border-2 border-white hover:bg-zinc-800 text-white font-bold text-sm tracking-wider uppercase transition-colors flex items-center gap-2"
        >
          <LogOut className="w-4 h-4" /> Keluar
        </button>
      </header>

      {/* Main Grid Layout */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-5">
        {/* Navigation Sidebar */}
        <nav className="md:col-span-1 border-r-4 border-b-4 md:border-b-0 border-black p-6 bg-zinc-50 flex flex-col space-y-4">
          <button
            onClick={() => setActiveTab("status")}
            className={`w-full py-3 px-4 text-left font-bold border-2 border-black flex items-center gap-3 transition-all ${
              activeTab === "status"
                ? "bg-black text-white translate-x-1 shadow-[2px_2px_0px_0px_#e11d48]"
                : "bg-white text-black hover:bg-zinc-100"
            }`}
          >
            <Settings className="w-5 h-5" /> Status & Kontrol
          </button>
          <button
            onClick={() => setActiveTab("candidates")}
            className={`w-full py-3 px-4 text-left font-bold border-2 border-black flex items-center gap-3 transition-all ${
              activeTab === "candidates"
                ? "bg-black text-white translate-x-1 shadow-[2px_2px_0px_0px_#e11d48]"
                : "bg-white text-black hover:bg-zinc-100"
            }`}
          >
            <Users className="w-5 h-5" /> Kelola Kandidat
          </button>
          <button
            onClick={() => setActiveTab("students")}
            className={`w-full py-3 px-4 text-left font-bold border-2 border-black flex items-center gap-3 transition-all ${
              activeTab === "students"
                ? "bg-black text-white translate-x-1 shadow-[2px_2px_0px_0px_#e11d48]"
                : "bg-white text-black hover:bg-zinc-100"
            }`}
          >
            <UserCheck className="w-5 h-5" /> Kelola Siswa
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`w-full py-3 px-4 text-left font-bold border-2 border-black flex items-center gap-3 transition-all ${
              activeTab === "logs"
                ? "bg-black text-white translate-x-1 shadow-[2px_2px_0px_0px_#e11d48]"
                : "bg-white text-black hover:bg-zinc-100"
            }`}
          >
            <FileSpreadsheet className="w-5 h-5" /> Log Audit
          </button>
        </nav>

        {/* Content Pane */}
        <main className="md:col-span-4 p-8 overflow-y-auto">
          {/* Global Alert Notification */}
          {alert && (
            <div
              className={`mb-6 p-4 border-2 border-black font-bold flex items-center gap-3 ${
                alert.type === "success" ? "bg-green-50 text-green-700" : "bg-rose-50 text-rose-700"
              }`}
            >
              {alert.type === "success" ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
              {alert.message}
            </div>
          )}

          {/* ------------------ TAB 1: STATUS & CONTROL ------------------ */}
          {activeTab === "status" && (
            <div className="space-y-8">
              <div className="neo-box p-6 bg-white">
                <h2 className="text-2xl font-black mb-4 uppercase tracking-wide">Status Pemilihan Sekarang</h2>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <span className="font-bold uppercase">Status:</span>
                    <span
                      className={`px-4 py-1.5 border-2 border-black font-black text-sm uppercase tracking-wider ${
                        setting?.election_status === "OPEN"
                          ? "bg-green-500 text-white"
                          : setting?.election_status === "CLOSED"
                          ? "bg-black text-white"
                          : "bg-yellow-400 text-black"
                      }`}
                    >
                      {setting?.election_status || "DRAFT"}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {setting?.election_status === "DRAFT" && (
                      <button
                        onClick={() => updateElectionStatus("OPEN")}
                        className="px-6 py-2 neo-btn-primary bg-green-600 hover:bg-green-700 text-sm"
                      >
                        Buka Pemilihan
                      </button>
                    )}
                    {setting?.election_status === "OPEN" && (
                      <button
                        onClick={() => updateElectionStatus("CLOSED")}
                        className="px-6 py-2 neo-btn-primary bg-black hover:bg-zinc-800 text-sm"
                      >
                        Tutup Pemilihan
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Reset Control */}
              <div className="neo-box p-6 border-rose-600 bg-rose-50">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-rose-100 border-2 border-rose-600">
                    <AlertTriangle className="w-8 h-8 text-rose-600" />
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-xl font-black text-rose-800 uppercase tracking-wide">Reset Total Pemilihan</h3>
                    <p className="text-rose-700 text-sm font-medium leading-relaxed">
                      Tindakan ini akan menghapus semua perolehan suara kandidat dan menghapus status kehadiran siswa
                      sehingga pemilihan dapat diulang dari awal. Data kandidat dan data siswa tidak akan terhapus.
                    </p>
                    <button onClick={resetElection} className="px-6 py-2.5 neo-btn-primary bg-rose-600 hover:bg-rose-700 text-sm">
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
                <div className="neo-box p-6 bg-white sticky top-6">
                  <h2 className="text-2xl font-black mb-6 uppercase tracking-wide">
                    {editingCandidate ? "Edit Kandidat" : "Tambah Kandidat"}
                  </h2>

                  {candidateError && (
                    <div className="mb-4 p-3 border-2 border-black bg-rose-50 text-rose-700 font-bold text-xs">
                      {candidateError}
                    </div>
                  )}

                  <form onSubmit={handleCandidateSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-1">Nomor Urut</label>
                      <input
                        type="number"
                        min="1"
                        value={candidateForm.nomor_urut}
                        onChange={(e) => setCandidateForm({ ...candidateForm, nomor_urut: e.target.value })}
                        required
                        className="w-full neo-input text-sm rounded-none"
                        placeholder="1, 2, atau 3"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-1">Nama Kandidat</label>
                      <input
                        type="text"
                        value={candidateForm.nama}
                        onChange={(e) => setCandidateForm({ ...candidateForm, nama: e.target.value })}
                        required
                        className="w-full neo-input text-sm rounded-none"
                        placeholder="Nama Lengkap Kandidat"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-1">URL Foto (Opsional)</label>
                      <input
                        type="text"
                        value={candidateForm.foto_url}
                        onChange={(e) => setCandidateForm({ ...candidateForm, foto_url: e.target.value })}
                        className="w-full neo-input text-sm rounded-none mb-3"
                        placeholder="/images/kandidat1.jpg"
                      />
                      <label className="block text-xs font-bold uppercase tracking-wider mb-1">Atau Unggah Foto Baru</label>
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
                        className="w-full bg-slate-50 border-2 border-black p-2 text-xs font-bold focus:outline-none"
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button type="submit" className="flex-1 py-2 neo-btn-primary text-xs">
                        {editingCandidate ? "Simpan Perubahan" : "Tambah"}
                      </button>
                      {editingCandidate && (
                        <button
                          type="button"
                          onClick={() => {
                            setCandidateForm({ id: "", nomor_urut: "", nama: "", foto_url: "" });
                            setEditingCandidate(false);
                          }}
                          className="px-4 py-2 neo-btn-secondary text-xs"
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
                <h2 className="text-2xl font-black mb-6 uppercase tracking-wide">Daftar Kandidat</h2>
                {candidates.length === 0 ? (
                  <div className="neo-box p-8 text-center text-gray-500 font-bold">Belum ada kandidat terdaftar.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {candidates.map((c) => (
                      <div key={c.id} className="neo-box p-6 bg-white flex flex-col justify-between">
                        <div>
                          {/* Photo Placeholder/Visual */}
                          <div className="w-full aspect-video border-2 border-black bg-zinc-100 flex items-center justify-center overflow-hidden mb-4 rounded-none">
                            {c.foto_url ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={c.foto_url} alt={c.nama} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-4xl font-black text-gray-400">PASLON {c.nomor_urut}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mb-2">
                            <span className="w-8 h-8 rounded-none border-2 border-black bg-black text-white font-black flex items-center justify-center text-sm">
                              {c.nomor_urut}
                            </span>
                            <h3 className="font-extrabold text-lg truncate uppercase">{c.nama}</h3>
                          </div>
                        </div>

                        <div className="flex border-t-2 border-black pt-4 mt-4 gap-2">
                          <button
                            onClick={() => handleEditCandidate(c)}
                            className="flex-1 py-1.5 neo-btn-secondary text-xs flex items-center justify-center gap-1.5"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> Edit
                          </button>
                          <button
                            onClick={() => handleDeleteCandidate(c.id, c.nama)}
                            className="px-3 py-1.5 neo-btn-primary bg-rose-600 hover:bg-rose-700 text-xs flex items-center justify-center"
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
                <div className="neo-box p-6 bg-white">
                  <h2 className="text-2xl font-black mb-4 uppercase tracking-wide">Import Data Siswa secara Massal</h2>
                  <p className="text-gray-500 font-medium text-sm mb-6">
                    Unggah berkas CSV yang berisi daftar siswa. Berkas wajib memiliki kolom/header: **Nama** dan **Kelas**.
                  </p>

                  {importStatus.message && (
                    <div
                      className={`mb-6 p-4 border-2 border-black font-bold text-sm ${
                        importStatus.success ? "bg-green-50 text-green-700" : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {importStatus.message}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                    {/* File Input */}
                    <label className="flex-1 neo-box p-4 bg-zinc-50 border-dashed border-gray-400 flex flex-col items-center justify-center cursor-pointer hover:bg-zinc-100 transition-colors">
                      <Upload className="w-8 h-8 text-gray-500 mb-2" />
                      <span className="font-bold text-sm text-black">Pilih Berkas CSV</span>
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
                          className="w-5 h-5 border-2 border-black accent-rose-600 rounded-none cursor-pointer"
                          disabled={importStatus.loading}
                        />
                        <label htmlFor="overwrite" className="font-bold text-sm cursor-pointer select-none">
                          Hapus siswa lama & timpa baru (Overwrite)
                        </label>
                      </div>

                      <button
                        onClick={handleImportSubmit}
                        disabled={csvPreview.length === 0 || importStatus.loading}
                        className="w-full py-3 neo-btn-primary bg-black hover:bg-zinc-800 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
                      >
                        {importStatus.loading
                          ? "Mengimpor..."
                          : `Unggah & Simpan ${csvPreview.length ? `(${csvPreview.length} Siswa)` : ""}`}
                      </button>
                    </div>
                  </div>

                  {/* CSV Preview */}
                  {csvPreview.length > 0 && (
                    <div className="mt-6 border-2 border-black max-h-48 overflow-y-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-zinc-100 border-b-2 border-black font-bold text-xs uppercase">
                            <th className="p-3 border-r-2 border-black">No</th>
                            <th className="p-3 border-r-2 border-black">Nama</th>
                            <th className="p-3">Kelas</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm font-medium">
                          {csvPreview.slice(0, 50).map((row, idx) => (
                            <tr key={idx} className="border-b border-gray-200">
                              <td className="p-2 border-r-2 border-black bg-zinc-50 font-bold text-xs text-center">
                                {idx + 1}
                              </td>
                              <td className="p-2 border-r-2 border-black">{row.nama}</td>
                              <td className="p-2">{row.kelas}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {csvPreview.length > 50 && (
                        <div className="p-3 bg-zinc-50 text-center text-xs font-bold text-gray-500 border-t border-black">
                          Dan {csvPreview.length - 50} data siswa lainnya...
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Manual Input Box */}
                <div className="neo-box p-6 bg-white">
                  <h2 className="text-2xl font-black mb-4 uppercase tracking-wide">Input Siswa secara Manual</h2>
                  <p className="text-gray-500 font-medium text-sm mb-6">
                    Tambahkan data siswa satu per satu secara langsung ke dalam database pemilihan.
                  </p>

                  {manualStatus.message && (
                    <div
                      className={`mb-6 p-4 border-2 border-black font-bold text-sm ${
                        manualStatus.success ? "bg-green-50 text-green-700" : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {manualStatus.message}
                    </div>
                  )}

                  <form onSubmit={handleManualStudentSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-1">Nama Siswa</label>
                      <input
                        type="text"
                        value={manualStudent.nama}
                        onChange={(e) => setManualStudent({ ...manualStudent, nama: e.target.value })}
                        required
                        className="w-full neo-input text-sm rounded-none"
                        placeholder="Contoh: Juki Sadikin"
                        disabled={manualStatus.loading}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-1">Kelas</label>
                      <input
                        type="text"
                        value={manualStudent.kelas}
                        onChange={(e) => setManualStudent({ ...manualStudent, kelas: e.target.value })}
                        required
                        className="w-full neo-input text-sm rounded-none"
                        placeholder="Contoh: XII-RPL-1"
                        disabled={manualStatus.loading}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={manualStatus.loading || !manualStudent.nama || !manualStudent.kelas}
                      className="w-full py-3 neo-btn-primary bg-black hover:bg-zinc-800 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
                    >
                      {manualStatus.loading ? "Menyimpan..." : "Tambah Siswa"}
                    </button>
                  </form>
                </div>
              </div>

              {/* Student Database List */}
              <div className="neo-box p-6 bg-white">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <h2 className="text-2xl font-black uppercase tracking-wide">Daftar Data Siswa ({totalStudentsCount})</h2>

                  <form onSubmit={handleStudentSearch} className="flex gap-2 w-full sm:max-w-md">
                    <input
                      type="text"
                      placeholder="Cari nama atau kelas..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="flex-1 neo-input text-sm rounded-none"
                    />
                    <button type="submit" className="px-4 py-2 neo-btn-primary bg-black text-white hover:bg-zinc-800 flex items-center justify-center">
                      <Search className="w-4 h-4" />
                    </button>
                  </form>
                </div>

                {students.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 font-bold border-2 border-black border-dashed">
                    Tidak ditemukan data siswa.
                  </div>
                ) : (
                  <div className="border-2 border-black overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                      <thead>
                        <tr className="bg-black text-white font-bold text-xs uppercase tracking-wider">
                          <th className="p-3 border-r border-zinc-700">Nama</th>
                          <th className="p-3 border-r border-zinc-700">Kelas</th>
                          <th className="p-3 border-r border-zinc-700 text-center">Hadir</th>
                          <th className="p-3 text-center">Sudah Voting</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm font-medium">
                        {students.map((student) => (
                          <tr key={student.id} className="border-b-2 border-black hover:bg-zinc-50">
                            <td className="p-3 border-r border-black font-extrabold">{student.nama}</td>
                            <td className="p-3 border-r border-black">{student.kelas}</td>
                            <td className="p-3 border-r border-black text-center">
                              <span
                                className={`inline-flex px-2 py-0.5 border font-bold text-xs uppercase ${
                                  student.hadir
                                    ? "bg-green-100 border-green-600 text-green-700"
                                    : "bg-gray-100 border-gray-400 text-gray-600"
                                }`}
                              >
                                {student.hadir ? "YA" : "TIDAK"}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <span
                                className={`inline-flex px-2 py-0.5 border font-bold text-xs uppercase ${
                                  student.sudah_memilih
                                    ? "bg-rose-100 border-rose-600 text-rose-700"
                                    : "bg-gray-100 border-gray-400 text-gray-600"
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
                      className="px-4 py-2 neo-btn-secondary text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Sebelumnya
                    </button>
                    <span className="font-bold text-sm">
                      Halaman {studentPage} dari {studentTotalPages}
                    </span>
                    <button
                      onClick={() => {
                        const next = Math.min(studentTotalPages, studentPage + 1);
                        setStudentPage(next);
                        fetchStudents(next);
                      }}
                      disabled={studentPage === studentTotalPages}
                      className="px-4 py-2 neo-btn-secondary text-xs disabled:opacity-40 disabled:cursor-not-allowed"
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
            <div className="neo-box p-6 bg-white">
              <h2 className="text-2xl font-black mb-6 uppercase tracking-wide">Log Audit Aktivitas (100 Terakhir)</h2>
              {logs.length === 0 ? (
                <div className="p-8 text-center text-gray-500 font-bold border-2 border-black border-dashed">
                  Belum ada catatan aktivitas.
                </div>
              ) : (
                <div className="border-2 border-black overflow-x-auto max-h-[600px] overflow-y-auto">
                  <table className="w-full text-left border-collapse min-w-[500px]">
                    <thead>
                      <tr className="bg-black text-white font-bold text-xs uppercase tracking-wider sticky top-0">
                        <th className="p-3 border-r border-zinc-700">Waktu</th>
                        <th className="p-3 border-r border-zinc-700">Aktor</th>
                        <th className="p-3">Aktivitas</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm font-medium">
                      {logs.map((log) => (
                        <tr key={log.id} className="border-b border-gray-200 hover:bg-zinc-50">
                          <td className="p-3 border-r border-gray-200 text-xs text-gray-500 font-mono">
                            {new Date(log.created_at).toLocaleString("id-ID")}
                          </td>
                          <td className="p-3 border-r border-gray-200 font-bold text-rose-600 text-xs tracking-wider uppercase">
                            {log.actor}
                          </td>
                          <td className="p-3 text-black font-semibold">{log.action}</td>
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

      {/* CUSTOM CONFIRM MODAL (NEO-BRUTALIST) */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="bg-white border-4 border-black w-full max-w-md p-6 relative text-black animate-scale-up"
            style={{ boxShadow: "8px 8px 0px 0px #000" }}
          >
            <h3 className="text-2xl font-black uppercase tracking-wide text-black mb-3">
              {confirmModal.title}
            </h3>
            <p className="text-slate-600 font-semibold text-sm mb-6 whitespace-pre-line">
              {confirmModal.message}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-black border-2 border-black font-black uppercase text-xs tracking-wider transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  if (confirmModal.onConfirm) confirmModal.onConfirm();
                  setConfirmModal({ ...confirmModal, isOpen: false });
                }}
                className={`flex-1 py-3 border-2 border-black font-black uppercase text-xs tracking-wider transition-colors text-white ${
                  confirmModal.isDanger ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"
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
