import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

function isAdmin(request: NextRequest): boolean {
  const token = request.cookies.get("zevote_session")?.value || null;
  return verifyToken(token) === "admin";
}

export async function GET(request: NextRequest) {
  try {
    if (!isAdmin(request)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const logs = await prisma.auditLog.findMany({
      orderBy: { created_at: "desc" },
      take: 100, // Ambil 100 log terakhir
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error("GET audit logs error:", error);
    return NextResponse.json(
      { message: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}
