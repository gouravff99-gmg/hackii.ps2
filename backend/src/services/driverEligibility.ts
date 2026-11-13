import { DriverOnboardingStatus, Prisma } from "@prisma/client";
import { env } from "../config/env";

export function eligibleDriverWhere(options: {
  now?: Date;
  includeSimulated?: boolean;
} = {}): Prisma.DriverWhereInput {
  const now = options.now ?? new Date();
  const verified: Prisma.DriverWhereInput = {
    onboarding: {
      is: {
        status: DriverOnboardingStatus.APPROVED,
        documents: {
          every: {
            status: "APPROVED",
            OR: [{ expiryDate: null }, { expiryDate: { gt: now } }],
          },
        },
      },
    },
    isSimulated: false,
  };
  const allowed: Prisma.DriverWhereInput[] = [verified];

  if (options.includeSimulated || env.demoMode) {
    allowed.push({ isSimulated: true });
  }
  if (env.demoMode && !options.includeSimulated) {
    allowed.push({ user: { is: { email: env.demoDriverEmail } } });
  }

  return { OR: allowed };
}

export function isDriverEligible(driver: {
  isSimulated: boolean;
  user: { email: string };
  onboarding: {
    status: DriverOnboardingStatus;
    documents: { status: string; expiryDate: Date | null }[];
  } | null;
}, options: { now?: Date; includeSimulated?: boolean } = {}): boolean {
  const now = options.now ?? new Date();
  if (options.includeSimulated && driver.isSimulated) return true;
  if (env.demoMode && (driver.isSimulated || driver.user.email === env.demoDriverEmail)) return true;
  if (driver.isSimulated || !driver.onboarding) return false;
  return (
    driver.onboarding.status === DriverOnboardingStatus.APPROVED &&
    driver.onboarding.documents.every(
      (document) =>
        document.status === "APPROVED" &&
        (!document.expiryDate || document.expiryDate.getTime() > now.getTime()),
    )
  );
}
