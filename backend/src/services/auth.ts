import bcrypt from "bcryptjs";
import { CITY, DriverStatus, Role, type AuthResponse, type AuthUser } from "@ps02/shared";
import { prisma } from "../lib/prisma";
import { signToken } from "../lib/jwt";
import { ApiError } from "../utils/ApiError";

const BCRYPT_ROUNDS = 10;

type UserRow = { id: string; name: string; email: string; role: string };
type UserRowWithDriver = UserRow & { driver: { id: string } | null };

function toAuthUser(user: UserRowWithDriver): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as Role,
    driverId: user.driver?.id,
  };
}

function issueToken(user: UserRowWithDriver): AuthResponse {
  const token = signToken({
    sub: user.id,
    role: user.role as Role,
    driverId: user.driver?.id,
  });
  return { token, user: toAuthUser(user) };
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role: Role;
  vehicleType?: string;
}

/** Self-service registration. Admins are provisioned by seed, never here. */
export async function register(input: RegisterInput): Promise<AuthResponse> {
  if (input.role === Role.ADMIN) {
    throw ApiError.forbidden("Administrator accounts cannot be self-registered");
  }

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw ApiError.conflict("An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
      driver:
        input.role === Role.DRIVER
          ? {
              create: {
                vehicleType: input.vehicleType ?? "SEDAN",
                status: DriverStatus.OFFLINE,
                lat: CITY.center.lat,
                lng: CITY.center.lng,
              },
            }
          : undefined,
    },
    include: { driver: { select: { id: true } } },
  });

  return issueToken(user);
}

export interface LoginInput {
  email: string;
  password: string;
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: { driver: { select: { id: true } } },
  });

  // Same message for unknown email and wrong password: do not leak which one.
  if (!user) throw ApiError.unauthorized("Invalid email or password");

  const matches = await bcrypt.compare(input.password, user.passwordHash);
  if (!matches) throw ApiError.unauthorized("Invalid email or password");

  return issueToken(user);
}

export async function getCurrentUser(userId: string): Promise<AuthUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { driver: { select: { id: true } } },
  });
  if (!user) throw ApiError.unauthorized("Account no longer exists");
  return toAuthUser(user);
}
