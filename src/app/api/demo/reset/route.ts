import { NextRequest, NextResponse } from "next/server";
import { isDemoModeEnabled } from "@/lib/auth";
import { runDemoBenchmarkSeed } from "@/lib/demo-seed";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  if (!isDemoModeEnabled()) {
    return NextResponse.json(
      { error: "Demo endpoints are disabled in production mode." },
      { status: 403 }
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = checkRateLimit(`demo-reset:${ip}`, 5, 5 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many demo reset attempts. Retry in ${rl.retryAfterSeconds}s.` },
      { status: 429 }
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
