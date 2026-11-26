import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Production-safe bootstrap seed.
 * Creates ONLY the top-level OWNER account from BOOTSTRAP_OWNER_* env vars
 * and an initial unconfigured CompanySettings record.
 * The Owner logs in under /dashboard/team to configure Company GST Details
 * and create Factory Admin accounts.
 */
async function main() {
  const ownerEmail = process.env.BOOTSTRAP_OWNER_EMAIL?.trim();
  const ownerPassword = process.env.BOOTSTRAP_OWNER_PASSWORD;
  const ownerName = process.env.BOOTSTRAP_OWNER_NAME?.trim() || "Business Owner";

  if (!ownerEmail || !ownerPassword) {
    throw new Error(
      "BOOTSTRAP_OWNER_EMAIL and BOOTSTRAP_OWNER_PASSWORD must be set for production bootstrap."
    );
  }

  const existingOwner = await prisma.user.findUnique({
    where: { email: ownerEmail },
  });

  if (!existingOwner) {
    const hashedPassword = await bcrypt.hash(ownerPassword, 12);
    await prisma.user.create({
      data: {
        email: ownerEmail,
        password: hashedPassword,
        name: ownerName,
        role: Role.OWNER,
        active: true,
      },
    });
    console.log(`Bootstrapped top-level OWNER user: ${ownerEmail}`);
  } else {
    console.log(`Owner user already exists: ${ownerEmail}`);
  }

  const existingSettings = await prisma.companySettings.findUnique({
    where: { id: "default" },
  });

  if (!existingSettings) {
    await prisma.companySettings.create({
      data: {
        id: "default",
        companyName: "Configure Company Profile",
        gstin: "",
        state: "",
        stateCode: "",
        address: "",
        phone: "",
        bankDetails: "",
        defaultTolerancePercent: 3.0,
        isConfigured: false,
      },
    });
    console.log(
      "Created initial unconfigured CompanySettings. Owner can configure GST details at /dashboard/team."
    );
  }
}

main()
  .catch((err) => {
    console.error("Production bootstrap seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
