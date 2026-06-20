import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@/generated/client/client";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

type ElectionStatusType = "DRAFT" | "OPEN" | "CLOSED";
// Tipe transaction client yang aman di Prisma 7
type TransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

function isAdmin(request: NextRequest): boolean {
  const token = request.cookies.get("zevote_session")?.value || null;
  return verifyToken(token) === "admin";
}

export async function GET(request: NextRequest) {
  try {
    if (!isAdmin(request)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    let setting = await prisma.electionSetting.findFirst();

    if (!setting) {
      // Jika setting belum ada, buat default DRAFT
      setting = await prisma.electionSetting.create({
        data: {
          election_status: "DRAFT",
        },
      });
    }

    return NextResponse.json(setting);
  } catch (error) {
    console.error("GET settings error:", error);
    return NextResponse.json(
      { message: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isAdmin(request)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { status, reset } = await request.json();

    let setting = await prisma.electionSetting.findFirst();
    if (!setting) {
      setting = await prisma.electionSetting.create({
        data: { election_status: "DRAFT" },
      });
    }

    if (reset) {
      // RESET TOTAL ELEKSI
      await prisma.$transaction(async (tx: TransactionClient) => {
        // Hapus semua data suara
        await tx.vote.deleteMany();
        // Hapus semua data request login
        await tx.loginRequest.deleteMany();
        // Reset kehadiran & status memilih semua siswa
        await tx.student.updateMany({
          data: {
            hadir: false,
            sudah_memilih: false,
          },
        });
        // Reset setting ke DRAFT
        await tx.electionSetting.update({
          where: { id: setting!.id },
          data: {
            election_status: "DRAFT",
            started_at: null,
            ended_at: null,
          },
        });
        // Tambahkan log audit
        await tx.auditLog.create({
          data: {
            actor: "Admin",
            action: "Melakukan RESET TOTAL data pemilihan (Suara direset, kehadiran dinolkan)",
          },
        });
      });

      return NextResponse.json({ success: true, message: "Pemilihan berhasil di-reset total." });
    }

    if (status) {
      const validStatuses: ElectionStatusType[] = ["DRAFT", "OPEN", "CLOSED"];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { message: "Status tidak valid!" },
          { status: 400 }
        );
      }

      const updateData: {
        election_status: ElectionStatusType;
        started_at?: Date;
        ended_at?: Date | null;
      } = {
        election_status: status as ElectionStatusType,
      };

      if (status === "OPEN") {
        updateData.started_at = new Date();
        updateData.ended_at = null; // Reset ended_at jika dibuka kembali
      } else if (status === "CLOSED") {
        updateData.ended_at = new Date();
      }

      const updatedSetting = await prisma.electionSetting.update({
        where: { id: setting.id },
        data: updateData,
      });

      // Tambahkan log audit
      await prisma.auditLog.create({
        data: {
          actor: "Admin",
          action: `Mengubah status pemilihan menjadi ${status}`,
        },
      });

      return NextResponse.json(updatedSetting);
    }

    return NextResponse.json({ message: "Tidak ada aksi yang dipilih." }, { status: 400 });
  } catch (error) {
    console.error("POST settings error:", error);
    return NextResponse.json(
      { message: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}
