// API untuk mengecek status pemilihan (public, tidak butuh auth)
// GET /api/vote/election-status
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const setting = await prisma.electionSetting.findFirst();
    if (!setting) {
      return NextResponse.json({ status: "DRAFT" });
    }
    return NextResponse.json({ status: setting.election_status });
  } catch (error) {
    console.error("Election status error:", error);
    return NextResponse.json({ status: "DRAFT" }, { status: 500 });
  }
}
