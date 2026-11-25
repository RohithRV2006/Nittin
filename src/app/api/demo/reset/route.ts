import { NextResponse } from "next/server";
import { isDemoModeEnabled } from "@/lib/auth";
import { runDemoBenchmarkSeed } from "@/lib/demo-seed";
import { prisma } from "@/lib/prisma";

export async function POST() {
  if (!isDemoModeEnabled()) {
    return NextResponse.json(
      { error: "Demo endpoints are disabled in production mode." },
      { status: 403 }
    );
  }

  try {
    await runDemoBenchmarkSeed(prisma);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Demo benchmark seed error:", err);
    return NextResponse.json(
      { error: "Failed to load benchmark dataset." },
      { status: 500 }
    );
  }
}
