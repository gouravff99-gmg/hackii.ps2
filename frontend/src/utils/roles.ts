import { Role } from "@ps02/shared";

export const ROLE_HOME: Record<Role, string> = {
  [Role.PASSENGER]: "/passenger",
  [Role.DRIVER]: "/driver",
  [Role.ADMIN]: "/admin",
};

export function homeForRole(role: Role): string {
  return ROLE_HOME[role] ?? "/";
}
