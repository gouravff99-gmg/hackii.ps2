export enum Role {
  PASSENGER = "PASSENGER",
  DRIVER = "DRIVER",
  ADMIN = "ADMIN",
}

export enum DriverStatus {
  OFFLINE = "OFFLINE",
  AVAILABLE = "AVAILABLE",
  BUSY = "BUSY",
  REPOSITIONING = "REPOSITIONING",
}

export enum RideStatus {
  REQUESTED = "REQUESTED",
  ACCEPTED = "ACCEPTED",
  ARRIVING = "ARRIVING",
  ONGOING = "ONGOING",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  REASSIGNING = "REASSIGNING",
}

export enum Strategy {
  NEAREST = "NEAREST",
  SMART = "SMART",
}

export enum VehicleType {
  HATCHBACK = "HATCHBACK",
  SEDAN = "SEDAN",
  SUV = "SUV",
}

/**
 * Persisted in RideEvent.type (stored as String in Prisma for flexibility).
 * Keep these values stable: the admin event log and UI rely on them.
 */
export enum RideEventType {
  REQUESTED = "REQUESTED",
  OFFER_SENT = "OFFER_SENT",
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
  TIMEOUT = "TIMEOUT",
  DRIVER_CANCELLED = "DRIVER_CANCELLED",
  ARRIVING = "ARRIVING",
  ONGOING = "ONGOING",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  REASSIGNING = "REASSIGNING",
  REPOSITIONED = "REPOSITIONED",
  POOLED = "POOLED",
  DELAYED = "DELAYED",
  NOTIFICATION = "NOTIFICATION",
  STATUS_CHANGED = "STATUS_CHANGED",
}

/** Values accepted by POST /api/admin/chaos (body.action). */
export enum ChaosAction {
  KILL_DRIVER = "killDriver",
  DELAY_DRIVER = "delayDriver",
  FORCE_REJECT = "forceReject",
}
