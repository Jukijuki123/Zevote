import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const voteRequestId = cookieStore.get("vote_request_id")?.value;
    const voteStudentId = cookieStore.get("vote_student_id")?.value;

    if (!voteRequestId || !voteStudentId) {
      return NextResponse.json(
        { message: "Sesi voting tidak ditemukan." },
        { status: 401 }
      );
    }

    const loginRequest = await prisma.loginRequest.findUnique({
      where: { id: voteRequestId },
      include: { student: true },
    });

    if (!loginRequest || loginRequest.student_id !== voteStudentId) {
      return NextResponse.json(
        { message: "Sesi voting tidak valid." },
        { status: 404 }
      );
    }

    if (loginRequest.status === "VOTED") {
      return NextResponse.json(
        { message: "Siswa sudah berhasil memilih." },
        { status: 400 }
      );
    }

    // Ubah status menjadi TIMED_OUT
    await prisma.$transaction([
      prisma.loginRequest.update({
        where: { id: voteRequestId },
        data: { status: "TIMED_OUT" },
      }),
      // Tetap biarkan student.hadir = true karena siswa berada di bilik
    ]);

    await prisma.auditLog.create({
      data: {
        actor: "Bilik Suara",
        action: `Sesi bilik suara siswa ${loginRequest.student.nama} (${loginRequest.student.kelas}) dikunci karena waktu habis.`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Sesi bilik suara berhasil dikunci karena waktu habis.",
      status: "TIMED_OUT",
    });
  } catch (error) {
    console.error("Timeout request error:", error);
    return NextResponse.json(
      { message: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}
