import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Production-safe bootstrap seed.
 * Creates ONLY the initial Factory Admin user (from env vars) and an unconfigured
 * CompanySettings record if none exist yet. Never writes demo/benchmark records.
 */
async function main() {
  const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim();
  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const adminName = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "Factory Admin";

  if (!adminEmail || !adminPassword) {
    throw new Error(
      "BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD must be set for production bootstrap."
    );
  }

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(adminPassword, 12);
    await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        name: adminName,
        role: Role.FACTORY_ADMIN,
        active: true,
      },
    });
    console.log(`Bootstrapped initial FACTORY_ADMIN user: ${adminEmail}`);
  } else {
    console.log(`Admin user already exists: ${adminEmail}`);
  }

  const existingSettings = await prisma.companySettings.findUnique({
    where: { id: "default" },
  });

  if (!existingSettings) {
    await prisma.companySettings.create({
      data: {
        id: "default",
        companyName: "Configure Factory Profile",
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
      "Created initial unconfigured CompanySettings. Complete setup at /admin/masters."
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
