import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { runDemoBenchmarkSeed } from "../src/lib/demo-seed";

const prisma = new PrismaClient();

runDemoBenchmarkSeed(prisma)
  .then(() => {
    console.log("Section 5 Benchmark Demo Dataset seeded successfully.");
  })
  .catch((err) => {
    console.error("Demo seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
