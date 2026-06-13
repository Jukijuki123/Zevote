// API endpoint untuk submit login request siswa
// POST /api/vote/request  { student_id: string }
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { student_id } = body;

    if (!student_id || typeof student_id !== "string") {
      return NextResponse.json(
        { message: "student_id diperlukan." },
        { status: 400 }
      );
    }

    // Pastikan election sedang OPEN
    const setting = await prisma.electionSetting.findFirst();
    if (!setting || setting.election_status !== "OPEN") {
      return NextResponse.json(
        { message: "Pemilihan belum dibuka. Silakan hubungi panitia." },
        { status: 403 }
      );
    }

    // Cek siswa valid & belum memilih
    const student = await prisma.student.findUnique({
      where: { id: student_id },
    });

    if (!student) {
      return NextResponse.json(
        { message: "Siswa tidak ditemukan dalam database." },
        { status: 404 }
      );
    }

    if (student.sudah_memilih) {
      return NextResponse.json(
        { message: "Kamu sudah pernah menggunakan hak pilihmu." },
        { status: 409 }
      );
    }

    // Hapus request PENDING/REJECTED lama milik siswa ini
    await prisma.loginRequest.deleteMany({
      where: {
        student_id,
        status: { in: ["PENDING", "REJECTED"] },
      },
    });

    // Buat request baru
    const loginRequest = await prisma.loginRequest.create({
      data: {
        student_id,
        status: "PENDING",
      },
    });

    // Simpan request ID ke cookie agar bisa di-poll statusnya
    const cookieStore = await cookies();
    cookieStore.set("vote_request_id", loginRequest.id, {
      httpOnly: true,
      sameSite: "strict",
      maxAge: 60 * 30, // 30 menit
      path: "/",
    });
    cookieStore.set("vote_student_id", student_id, {
      httpOnly: true,
      sameSite: "strict",
      maxAge: 60 * 30,
      path: "/",
    });

    return NextResponse.json({
      request_id: loginRequest.id,
      message: "Permintaan login berhasil dikirim. Silakan tunggu persetujuan panitia.",
    });
  } catch (error) {
    console.error("Login request error:", error);
    return NextResponse.json(
      { message: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}
