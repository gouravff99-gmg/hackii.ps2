import type { ChaosRequest, NearbyDriver, SimStatus } from "./types";
import type { VehicleCategory } from "./enums";

/** Every Socket.IO event name lives here. Backend and frontend import these. */
export const SOCKET_EVENTS = {
  /* server -> client */
  DRIVER_LOCATION: "driver:location",
  RIDE_DRIVER_LOCATION: "ride:driverLocation",
  DRIVERS_SNAPSHOT: "drivers:snapshot",
  RIDE_STATUS: "ride:status",
  RIDE_OFFER: "ride:offer",
  RIDE_REASSIGNED: "ride:reassigned",
  NOTIFICATION: "notification",
  ZONES_UPDATE: "zones:update",
  SIM_TICK: "sim:tick",

  /* client -> server */
  DRIVER_SET_STATUS: "driver:setStatus",
  DRIVER_UPDATE_LOCATION: "driver:updateLocation",
  RIDE_RESPOND: "ride:respond",
  ADMIN_CHAOS: "admin:chaos",
} as const;

export type SocketEventName = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

export const ROOMS = {
  user: (id: string) => `user:${id}`,
  admin: "role:admin",
  ride: (id: string) => `ride:${id}`,
} as const;

/* ------------------------------------------------------------------ */
/* Server -> client payloads                                           */
/* ------------------------------------------------------------------ */

export interface DriverLocationPayload {
  driverId: string;
  lat: number;
  lng: number;
  status?: string;
  at: string;
}

export interface RideDriverLocationPayload extends DriverLocationPayload {
  rideId: string;
}

export interface DriversSnapshotPayload {
  drivers: NearbyDriver[];
  at: string;
}

export interface RideStatusPayload {
  rideId: string;
  status: string;
  driverId?: string | null;
  etaMin?: number;
  message?: string;
  at: string;
}

export interface RideOfferPayload {
  rideId: string;
  pickup: { lat: number; lng: number };
  drop: { lat: number; lng: number };
  distanceKm: number;
  etaMin: number;
  fareEstimate: number;
  expiresAt: string;
  timeoutMs: number;
  demoMode?: boolean;
  /** Service category the passenger booked (BIKE / CAR / POOL). */
  category?: VehicleCategory;
}

export interface RideReassignedPayload {
  rideId: string;
  previousDriverId: string | null;
  newDriverId: string;
  etaMin: number;
  reason: string;
  at: string;
}

export interface NotificationPayload {
  kind: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
  rideId?: string;
  at: string;
}

export interface SimTickPayload extends SimStatus {
  at: string;
}

export interface ZonesUpdatePayload {
  at: string;
}

/* ------------------------------------------------------------------ */
/* Client -> server payloads                                           */
/* ------------------------------------------------------------------ */

export interface DriverSetStatusPayload {
  status: string;
}

export interface DriverUpdateLocationPayload {
  lat: number;
  lng: number;
}

export interface RideRespondPayload {
  rideId: string;
  accept: boolean;
}

export type AdminChaosPayload = ChaosRequest;
