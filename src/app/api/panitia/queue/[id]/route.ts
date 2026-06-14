// API approve/reject login request individu
// PATCH /api/panitia/queue/[id] { action: "APPROVE" | "REJECT" }
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";

async function checkAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("zevote_session")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await checkAuth();
  if (!auth) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { action } = body;

    if (!action || !["APPROVE", "REJECT"].includes(action)) {
      return NextResponse.json(
        { message: "Action harus 'APPROVE' atau 'REJECT'." },
        { status: 400 }
      );
    }

    const loginRequest = await prisma.loginRequest.findUnique({
      where: { id },
      include: { student: true },
    });

    if (!loginRequest) {
      return NextResponse.json(
        { message: "Request tidak ditemukan." },
        { status: 404 }
      );
    }

    if (loginRequest.status === "VOTED") {
      return NextResponse.json(
        { message: "Siswa sudah selesai menggunakan hak pilihnya. Sesi tidak dapat di-reset." },
        { status: 400 }
      );
    }

    if (loginRequest.status === "REJECTED") {
      return NextResponse.json(
        { message: "Permintaan ini sudah ditolak sebelumnya." },
        { status: 400 }
      );
    }

    if (action === "APPROVE" && loginRequest.status !== "PENDING") {
      return NextResponse.json(
        { message: `Tidak dapat menyetujui permintaan dengan status ${loginRequest.status}.` },
        { status: 400 }
      );
    }

    // Eksekusi aksi berdasarkan status
    if (action === "APPROVE") {
      await prisma.$transaction([
        prisma.loginRequest.update({
          where: { id },
          data: { status: "APPROVED" },
        }),
        prisma.student.update({
          where: { id: loginRequest.student_id },
          data: { hadir: true },
        }),
      ]);
    } else {
      // Jika menolak / meriset request yang sudah APPROVED atau TIMED_OUT, hapus tanda hadir
      if (loginRequest.status === "APPROVED" || loginRequest.status === "TIMED_OUT") {
        await prisma.$transaction([
          prisma.loginRequest.update({
            where: { id },
            data: { status: "REJECTED" },
          }),
          prisma.student.update({
            where: { id: loginRequest.student_id },
            data: { hadir: false },
          }),
        ]);
      } else {
        // Status masih PENDING, cukup tandai REJECTED
        await prisma.loginRequest.update({
          where: { id },
          data: { status: "REJECTED" },
        });
      }
    }

    await prisma.auditLog.create({
      data: {
        actor: auth.role,
        action: `${action} login request untuk siswa ${loginRequest.student.nama} (${loginRequest.student.kelas})`,
      },
    });

    return NextResponse.json({
      message: `Request berhasil di-${action.toLowerCase()}.`,
      status: action === "APPROVE" ? "APPROVED" : "REJECTED",
    });
  } catch (error) {
    console.error("Queue action error:", error);
    return NextResponse.json({ message: "Server error." }, { status: 500 });
  }
}
