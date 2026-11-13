import path from "node:path";
import dotenv from "dotenv";

// Load the repo-root .env (monorepo single source), then allow a local override.
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DriverStatus, Role } from "@ps02/shared";

const prisma = new PrismaClient();
const DEMO_PASSWORD = "password123";

async function upsertUser(name: string, email: string, role: Role) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  return prisma.user.upsert({
    where: { email },
    update: { name, role, passwordHash },
    create: { name, email, role, passwordHash },
  });
}

async function main() {
  const admin = await upsertUser("Demo Admin", "admin@demo", Role.ADMIN);
  const passenger = await upsertUser("Demo Passenger", "passenger@demo", Role.PASSENGER);
  const driverUser = await upsertUser("Demo Driver", "driver@demo", Role.DRIVER);

  await prisma.driver.upsert({
    where: { userId: driverUser.id },
    update: {},
    create: {
      userId: driverUser.id,
      vehicleType: "SEDAN",
      status: DriverStatus.OFFLINE,
      lat: 12.9716,
      lng: 77.5946,
      acceptanceRate: 0.9,
      isSimulated: false,
    },
  });

  console.log("[seed] demo users ready:");
  console.log(`  ADMIN     ${admin.email} / ${DEMO_PASSWORD}`);
  console.log(`  PASSENGER ${passenger.email} / ${DEMO_PASSWORD}`);
  console.log(`  DRIVER    ${driverUser.email} / ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error("[seed] failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
