// API endpoint untuk submit suara dari bilik suara siswa
// POST /api/vote/submit  { candidate_id: string }
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { PrismaClient } from "@/generated/client/client";

type TransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { candidate_id } = body;

    if (!candidate_id || typeof candidate_id !== "string") {
      return NextResponse.json(
        { message: "Kandidat wajib dipilih." },
        { status: 400 }
      );
    }

    // Pastikan election sedang OPEN
    const setting = await prisma.electionSetting.findFirst();
    if (!setting || setting.election_status !== "OPEN") {
      return NextResponse.json(
        { message: "Pemilihan belum dibuka atau sudah ditutup." },
        { status: 403 }
      );
    }

    // Baca cookies sesi voting
    const cookieStore = await cookies();
    const voteRequestId = cookieStore.get("vote_request_id")?.value;
    const voteStudentId = cookieStore.get("vote_student_id")?.value;

    if (!voteRequestId || !voteStudentId) {
      return NextResponse.json(
        { message: "Sesi voting Anda tidak ditemukan. Silakan login kembali." },
        { status: 401 }
      );
    }

    // Verifikasi request login di database
    const loginRequest = await prisma.loginRequest.findUnique({
      where: { id: voteRequestId },
      include: { student: true },
    });

    if (!loginRequest || loginRequest.student_id !== voteStudentId) {
      return NextResponse.json(
        { message: "Sesi voting tidak valid." },
        { status: 401 }
      );
    }

    if (loginRequest.status !== "APPROVED") {
      return NextResponse.json(
        { message: "Akses voting belum disetujui oleh panitia." },
        { status: 403 }
      );
    }

    if (loginRequest.student.sudah_memilih) {
      return NextResponse.json(
        { message: "Anda sudah pernah menyalurkan hak suara Anda." },
        { status: 409 }
      );
    }

    // Pastikan kandidat yang dipilih benar-benar terdaftar
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidate_id },
    });

    if (!candidate) {
      return NextResponse.json(
        { message: "Kandidat tidak ditemukan." },
        { status: 404 }
      );
    }

    // Jalankan transaksi database (Atomik)
    await prisma.$transaction(async (tx: TransactionClient) => {
      // 1. Simpan suara di tabel Vote
      await tx.vote.create({
        data: {
          student_id: voteStudentId,
          candidate_id: candidate_id,
        },
      });

      // 2. Tandai siswa sudah memilih dan hadir
      await tx.student.update({
        where: { id: voteStudentId },
        data: {
          sudah_memilih: true,
          hadir: true,
        },
      });

      // 3. Update status login request menjadi VOTED
      await tx.loginRequest.update({
        where: { id: voteRequestId },
        data: {
          status: "VOTED",
        },
      });

      // 4. Catat ke Audit Log
      await tx.auditLog.create({
        data: {
          actor: "Siswa",
          action: `Suara berhasil direkam untuk kandidat No. Urut ${candidate.nomor_urut} (${candidate.nama})`,
        },
      });
    });

    // Hapus cookies sesi bilik
    cookieStore.delete("vote_request_id");
    cookieStore.delete("vote_student_id");

    return NextResponse.json({
      success: true,
      message: "Suara Anda berhasil direkam. Terima kasih atas partisipasinya!",
    });
  } catch (error) {
    console.error("Submit vote error:", error);
    return NextResponse.json(
      { message: "Terjadi kesalahan server saat merekam suara." },
      { status: 500 }
    );
  }
}
