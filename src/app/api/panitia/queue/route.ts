// API untuk panitia: list semua login request yang PENDING
// GET /api/panitia/queue → daftar antrean
// PATCH /api/panitia/queue/:id → approve/reject
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";

// Helper: cek apakah caller adalah panitia atau admin
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
    const requests = await prisma.loginRequest.findMany({
      where: { status: { in: ["PENDING", "APPROVED", "TIMED_OUT"] } },
      include: {
        student: {
          select: { id: true, nama: true, kelas: true, sudah_memilih: true },
        },
      },
      orderBy: { created_at: "asc" },
    });

    return NextResponse.json(requests);
  } catch (error) {
    console.error("Queue fetch error:", error);
    return NextResponse.json({ message: "Server error." }, { status: 500 });
  }
}
