"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Lock, RefreshCw, Trophy, ArrowLeft } from "lucide-react";

interface CandidateResult {
  id: string;
  nomor_urut: number;
  nama: string;
  foto_url: string;
  votes_count: number;
  percentage: number;
}

interface SummaryStats {
  total_siswa: number;
  total_hadir: number;
  total_suara_sah: number;
  total_golput: number;
  persen_kehadiran: number;
  persen_golput: number;
}

export default function ResultsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(true);
  const [status, setStatus] = useState<string>("OPEN");
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [results, setResults] = useState<CandidateResult[]>([]);

  // Mengambil Data Hasil
  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch("/api/vote/results");
      if (res.status === 403) {
        setAuthorized(false);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setAuthorized(true);
        setStatus(data.status);
        setSummary(data.summary);
        setResults(data.results);
      }
    } catch (err) {
      console.error("Gagal memuat hasil quick count", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fungsi refresh manual dengan loading screen
  const handleRefresh = useCallback(async () => {
    setLoading(true);
    await fetchResults();
  }, [fetchResults]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  // Cari Kandidat dengan Suara Terbanyak (Pemenang Sementara)
  const getWinnerId = () => {
    if (results.length === 0) return null;
    // Cek jika seluruh suara masih 0
    const allZero = results.every((r) => r.votes_count === 0);
    if (allZero) return null;

    let maxVotes = -1;
    let winnerId: string | null = null;
    let isTie = false;

    for (const r of results) {
      if (r.votes_count > maxVotes) {
        maxVotes = r.votes_count;
        winnerId = r.id;
        isTie = false;
      } else if (r.votes_count === maxVotes) {
        isTie = true;
      }
    }

    // Jika terjadi seri, tidak menampilkan lencana pemenang tunggal
    return isTie ? null : winnerId;
  };

  const winnerId = getWinnerId();

  // Inisial nama jika foto kosong
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-800">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-rose-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="font-semibold text-slate-650">Memuat hasil perhitungan suara...</p>
        </div>
      </div>
    );
  }

  // ========================
  // RENDER: LAYAR TERKUNCI (PEMILU MASIH OPEN/DRAFT)
  // ========================
  if (!authorized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-800 p-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-md">
          <div className="w-16 h-16 bg-rose-50 border border-rose-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xs">
            <Lock className="w-8 h-8 text-rose-650" />
          </div>
          <h1 className="text-xl font-bold uppercase tracking-tight text-slate-900 mb-2">Quick Count Terkunci</h1>
          <p className="text-slate-600 font-medium text-sm mb-6 leading-relaxed">
            Hasil perhitungan suara (Quick Count) saat ini disegel demi menjaga kerahasiaan dan integritas pemilihan.
          </p>
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-8">
            Hasil akan dibuka otomatis setelah pemungutan suara resmi ditutup oleh panitia.
          </p>
          <button
            onClick={() => router.replace("/")}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl uppercase tracking-wider transition-all shadow-sm hover:shadow-md cursor-pointer flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            Kembali ke Booth
          </button>
        </div>
      </div>
    );
  }

  // ========================
  // RENDER: HASIL QUICK COUNT
  // ========================
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* Header Halaman */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-900 rounded-xl text-white flex items-center justify-center font-bold text-lg shadow-sm">
            Q
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Hasil Pemilihan (Quick Count)</h1>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              Status Pemilihan: <span className="text-rose-600 font-bold">{status}</span>
            </p>
          </div>
        </div>

        <div className="flex gap-3 self-start sm:self-auto">
          <button
            onClick={handleRefresh}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl tracking-wide uppercase text-xs transition-all cursor-pointer border border-slate-200 shadow-xs hover:shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Segarkan
          </button>
          <button
            onClick={() => router.push("/")}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl tracking-wide uppercase text-xs transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md hover:shadow-rose-600/25 active:scale-98"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali
          </button>
        </div>
      </header>

      {/* Main Content Dashboard */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 space-y-8">
        
        {/* Metrik Statistik Utama */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Total Suara Sah</p>
              <p className="text-2xl font-bold text-slate-900 leading-none mt-1">{summary.total_suara_sah}</p>
              <p className="text-[10px] text-slate-400 font-medium mt-2">Hak Suara Terpakai</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Daftar Pemilih (DPT)</p>
              <p className="text-2xl font-bold text-slate-900 leading-none mt-1">{summary.total_siswa}</p>
              <p className="text-[10px] text-slate-400 font-medium mt-2">Siswa Terdaftar</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Tingkat Kehadiran</p>
              <p className="text-2xl font-bold text-emerald-600 leading-none mt-1">{summary.persen_kehadiran}%</p>
              <p className="text-[10px] text-emerald-600 font-medium mt-2">Siswa Hadir di TPS</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Tidak Memilih (Golput)</p>
              <p className="text-2xl font-bold text-rose-600 leading-none mt-1">{summary.total_golput}</p>
              <p className="text-[10px] text-rose-600 font-medium mt-2">Persentase: {summary.persen_golput}%</p>
            </div>
          </div>
        )}

        {/* Layout Visual Perolehan Suara */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-bold uppercase tracking-tight text-slate-900 border-b border-slate-100 pb-4 mb-8">
            Rekapitulasi Perolehan Suara Kandidat
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto justify-center">
            {results.map((candidate) => {
              const isWinner = candidate.id === winnerId;
              return (
                <div
                  key={candidate.id}
                  className={`bg-white border border-slate-200 rounded-2xl p-6 flex flex-col items-center relative transition-all duration-300 hover:shadow-md ${
                    isWinner ? "border-yellow-400 ring-4 ring-yellow-400/20 -translate-y-1 shadow-sm" : "shadow-xs"
                  }`}
                >
                  {/* Badge Pemenang Terbanyak */}
                  {isWinner && (
                    <div className="absolute -top-3.5 bg-yellow-400 rounded-full px-4 py-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-900 shadow-sm border border-yellow-350">
                      <Trophy className="w-3.5 h-3.5" />
                      Suara Terbanyak
                    </div>
                  )}

                  {/* Nomor Urut */}
                  <div className="w-12 h-12 bg-slate-900 rounded-xl text-white flex items-center justify-center text-xl font-bold mb-4 shadow-sm">
                    {candidate.nomor_urut.toString().padStart(2, "0")}
                  </div>

                  {/* Foto Kandidat */}
                  <div className="w-36 h-44 bg-slate-55 border border-slate-200 rounded-xl mb-4 overflow-hidden relative flex items-center justify-center shadow-xs">
                    {candidate.foto_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={candidate.foto_url}
                        alt={candidate.nama}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-rose-50 text-rose-300">
                        <span className="text-3xl font-black">{getInitials(candidate.nama)}</span>
                      </div>
                    )}
                  </div>

                  {/* Info Kandidat */}
                  <div className="text-center w-full mb-4">
                    <h3 className="font-bold text-slate-900 uppercase tracking-wide truncate">{candidate.nama}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Kandidat Ketua OSIS</p>
                  </div>

                  {/* Visual Grafik Perolehan Suara */}
                  <div className="w-full border-t border-slate-100 pt-4 text-center">
                    <p className="text-3xl font-extrabold text-slate-900 leading-none">{candidate.percentage}%</p>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">
                      {candidate.votes_count} Suara
                    </p>

                    {/* Progress Bar Persentase */}
                    <div className="w-full h-2.5 bg-slate-100 border border-slate-200 rounded-full overflow-hidden mt-3 shadow-xs">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${isWinner ? "bg-emerald-500" : "bg-slate-700"}`}
                        style={{ width: `${candidate.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </main>

      {/* Footer Halaman */}
      <footer className="border-t border-slate-200/60 py-4 px-6 text-center bg-white mt-8 shadow-xs">
        <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-widest">
          ZEVOTE © 2026 · Hasil Rekapitulasi Suara Mandiri & Transparan
        </p>
      </footer>
    </div>
  );
}
