// API endpoint untuk polling status login request siswa
// GET /api/vote/status  → membaca cookie vote_request_id
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const requestId = cookieStore.get("vote_request_id")?.value;
    const studentId = cookieStore.get("vote_student_id")?.value;

    if (!requestId || !studentId) {
      return NextResponse.json(
        { status: "NO_REQUEST", message: "Tidak ada sesi yang aktif." },
        { status: 401 }
      );
    }

    const loginRequest = await prisma.loginRequest.findUnique({
      where: { id: requestId },
      include: { student: true },
    });

    if (!loginRequest) {
      return NextResponse.json(
        { status: "NO_REQUEST", message: "Request tidak ditemukan." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: loginRequest.status,
      student: {
        id: loginRequest.student.id,
        nama: loginRequest.student.nama,
        kelas: loginRequest.student.kelas,
        sudah_memilih: loginRequest.student.sudah_memilih,
      },
    });
  } catch (error) {
    console.error("Status check error:", error);
    return NextResponse.json(
      { status: "ERROR", message: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}

// DELETE → hapus sesi (logout dari booth)
export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("vote_request_id");
    cookieStore.delete("vote_student_id");
    return NextResponse.json({ message: "Sesi berhasil dihapus." });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { message: "Terjadi kesalahan." },
      { status: 500 }
    );
  }
}
