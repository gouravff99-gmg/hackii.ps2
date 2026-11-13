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

export enum DriverOnboardingStatus {
  NOT_STARTED = "NOT_STARTED",
  IN_PROGRESS = "IN_PROGRESS",
  DOCUMENTS_SUBMITTED = "DOCUMENTS_SUBMITTED",
  UNDER_REVIEW = "UNDER_REVIEW",
  CHANGES_REQUESTED = "CHANGES_REQUESTED",
  APPROVED = "APPROVED",
  REVOKED = "REVOKED",
  REJECTED = "REJECTED",
  EXPIRED = "EXPIRED",
}

export enum DriverDocumentType {
  DRIVING_LICENSE = "DRIVING_LICENSE",
  TRANSPORT_BADGE = "TRANSPORT_BADGE",
  AADHAAR = "AADHAAR",
  PAN = "PAN",
  PROFILE_PHOTO = "PROFILE_PHOTO",
  POLICE_VERIFICATION = "POLICE_VERIFICATION",
  VEHICLE_RC = "VEHICLE_RC",
  INSURANCE = "INSURANCE",
  PERMIT = "PERMIT",
  FITNESS_CERTIFICATE = "FITNESS_CERTIFICATE",
  PUC_CERTIFICATE = "PUC_CERTIFICATE",
  OWNER_NOC = "OWNER_NOC",
  BANK_PROOF = "BANK_PROOF",
  LIVE_SELFIE = "LIVE_SELFIE",
}

export enum DocumentReviewStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export enum RideStatus {
  REQUESTED = "REQUESTED",
  ACCEPTED = "ACCEPTED",
  ARRIVING = "ARRIVING",
  ARRIVED = "ARRIVED",
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
 * Passenger-facing service category. This is deliberately separate from
 * `VehicleType` (body style): a CAR is a service, a SEDAN is a vehicle model.
 * POOL means one pool-enabled car shared by compatible riders.
 */
export enum VehicleCategory {
  BIKE = "BIKE",
  CAR = "CAR",
  POOL = "POOL",
}

export enum DemandLevel {
  VERY_LOW = "VERY_LOW",
  LOW = "LOW",
  MODERATE = "MODERATE",
  HIGH = "HIGH",
  VERY_HIGH = "VERY_HIGH",
  CRITICAL = "CRITICAL",
}

export enum DemandTrend {
  RISING = "RISING",
  STEADY = "STEADY",
  FALLING = "FALLING",
}

export enum AreaKind {
  TRANSPORT_HUB = "TRANSPORT_HUB",
  RESIDENTIAL = "RESIDENTIAL",
  COMMERCIAL = "COMMERCIAL",
  INDUSTRIAL = "INDUSTRIAL",
  EDUCATION = "EDUCATION",
  MIXED = "MIXED",
}

/** Demo (not real) scenario selector. Values are stable API inputs. */
export enum DemoScenario {
  NORMAL = "normal",
  MORNING_PEAK = "morning_peak",
  EVENING_PEAK = "evening_peak",
  WEEKEND = "weekend",
  LOW_DEMAND = "low_demand",
  HIGH_DEMAND_EVENT = "high_demand_event",
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
