// API endpoint untuk mengambil data statistik monitoring panitia
// GET /api/panitia/stats
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";

async function checkPanitiaAuth() {
  const cookieStore = await cookies();
  const authToken = cookieStore.get("zevote_session")?.value;
  if (!authToken) return false;
  const payload = verifyAdminToken(authToken);
  return !!payload;
}

export async function GET() {
  const isAuth = await checkPanitiaAuth();
  if (!isAuth) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Ambil ringkasan total
    const totalStudents = await prisma.student.count();
    const totalPresent = await prisma.student.count({ where: { hadir: true } });
    const totalVoted = await prisma.student.count({ where: { sudah_memilih: true } });

    // 2. Ambil semua siswa untuk diproses rekap per kelas
    const allStudents = await prisma.student.findMany({
      select: { kelas: true, hadir: true, sudah_memilih: true },
    });

    // 3. Proses rekap per kelas
    const classMap: Record<string, { total: number; hadir: number; memilih: number }> = {};

    for (const s of allStudents) {
      const className = s.kelas || "TIDAK ADA KELAS";
      if (!classMap[className]) {
        classMap[className] = { total: 0, hadir: 0, memilih: 0 };
      }
      classMap[className].total += 1;
      if (s.hadir) classMap[className].hadir += 1;
      if (s.sudah_memilih) classMap[className].memilih += 1;
    }

    // Ubah map ke array dan urutkan berdasarkan nama kelas
    const classStats = Object.keys(classMap)
      .map((className) => {
        const stats = classMap[className];
        return {
          kelas: className,
          total: stats.total,
          hadir: stats.hadir,
          memilih: stats.memilih,
          persen_hadir: stats.total > 0 ? Math.round((stats.hadir / stats.total) * 100) : 0,
        };
      })
      .sort((a, b) => a.kelas.localeCompare(b.kelas));

    return NextResponse.json({
      summary: {
        total_siswa: totalStudents,
        total_hadir: totalPresent,
        total_memilih: totalVoted,
        total_golput: totalStudents - totalVoted,
        persen_hadir: totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 100) : 0,
        persen_memilih: totalStudents > 0 ? Math.round((totalVoted / totalStudents) * 100) : 0,
      },
      class_stats: classStats,
    });
  } catch (error) {
    console.error("GET panitia stats error:", error);
    return NextResponse.json(
      { message: "Terjadi kesalahan server saat mengambil data statistik." },
      { status: 500 }
    );
  }
}
