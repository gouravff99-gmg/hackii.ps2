import { DriverStatus, RideStatus, Role } from "@ps02/shared";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger" | "accent";

export function formatCurrency(value: number, decimals = 0): string {
  return `₹${value.toFixed(decimals)}`;
}

export function formatKm(value: number): string {
  return `${value.toFixed(1)} km`;
}

export function formatMinutes(value: number): string {
  return `${Math.max(1, Math.round(value))} min`;
}

export function formatWait(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} s`;
  return `${Math.round(seconds / 60)} min`;
}

export function formatPercent(value: number, decimals = 0): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} d ago`;
}

const RIDE_STATUS_LABELS: Record<RideStatus, string> = {
  REQUESTED: "Finding a driver",
  ACCEPTED: "Driver assigned",
  ARRIVING: "Driver arriving",
  ARRIVED: "Driver arrived",
  ONGOING: "Trip in progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REASSIGNING: "Reassigning",
};

export function rideStatusLabel(status: RideStatus): string {
  return RIDE_STATUS_LABELS[status] ?? status;
}

export function rideStatusTone(status: RideStatus): BadgeTone {
  switch (status) {
    case RideStatus.REQUESTED:
      return "warning";
    case RideStatus.ACCEPTED:
    case RideStatus.ARRIVING:
    case RideStatus.ARRIVED:
      return "info";
    case RideStatus.ONGOING:
      return "accent";
    case RideStatus.COMPLETED:
      return "success";
    case RideStatus.CANCELLED:
      return "neutral";
    case RideStatus.REASSIGNING:
      return "warning";
    default:
      return "neutral";
  }
}

const DRIVER_STATUS_LABELS: Record<DriverStatus, string> = {
  OFFLINE: "Offline",
  AVAILABLE: "Available",
  BUSY: "On a trip",
  REPOSITIONING: "Repositioning",
};

export function driverStatusLabel(status: DriverStatus): string {
  return DRIVER_STATUS_LABELS[status] ?? status;
}

export function driverStatusTone(status: DriverStatus): BadgeTone {
  switch (status) {
    case DriverStatus.AVAILABLE:
      return "success";
    case DriverStatus.BUSY:
      return "info";
    case DriverStatus.REPOSITIONING:
      return "accent";
    default:
      return "neutral";
  }
}

export function roleLabel(role: Role): string {
  switch (role) {
    case Role.PASSENGER:
      return "Passenger";
    case Role.DRIVER:
      return "Driver";
    case Role.ADMIN:
      return "Administrator";
    default:
      return role;
  }
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function plural(count: number, singular: string, pluralForm?: string): string {
  return count === 1 ? singular : (pluralForm ?? `${singular}s`);
}
