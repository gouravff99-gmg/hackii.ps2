import { RideStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  assertTransition,
  canTransition,
  isTerminal,
  RIDE_TRANSITIONS,
  TERMINAL_STATUSES,
} from "../services/rideStateMachine";

describe("canTransition", () => {
  it("allows the documented forward path", () => {
    expect(canTransition(RideStatus.REQUESTED, RideStatus.ACCEPTED)).toBe(true);
    expect(canTransition(RideStatus.ACCEPTED, RideStatus.ARRIVING)).toBe(true);
    expect(canTransition(RideStatus.ARRIVING, RideStatus.ONGOING)).toBe(true);
    expect(canTransition(RideStatus.ONGOING, RideStatus.COMPLETED)).toBe(true);
  });

  it("allows reassignment and cancellation where specified", () => {
    expect(canTransition(RideStatus.REQUESTED, RideStatus.REASSIGNING)).toBe(true);
    expect(canTransition(RideStatus.ACCEPTED, RideStatus.REASSIGNING)).toBe(true);
    expect(canTransition(RideStatus.ARRIVING, RideStatus.REASSIGNING)).toBe(true);
    expect(canTransition(RideStatus.REASSIGNING, RideStatus.ACCEPTED)).toBe(true);
    expect(canTransition(RideStatus.REASSIGNING, RideStatus.REQUESTED)).toBe(true);
    expect(canTransition(RideStatus.REQUESTED, RideStatus.CANCELLED)).toBe(true);
    expect(canTransition(RideStatus.REASSIGNING, RideStatus.CANCELLED)).toBe(true);
  });

  it("rejects illegal jumps", () => {
    expect(canTransition(RideStatus.REQUESTED, RideStatus.ONGOING)).toBe(false);
    expect(canTransition(RideStatus.REQUESTED, RideStatus.COMPLETED)).toBe(false);
    expect(canTransition(RideStatus.ACCEPTED, RideStatus.ONGOING)).toBe(false);
    expect(canTransition(RideStatus.ONGOING, RideStatus.CANCELLED)).toBe(false);
    expect(canTransition(RideStatus.ONGOING, RideStatus.REASSIGNING)).toBe(false);
  });

  it("treats terminal states as sinks", () => {
    for (const status of TERMINAL_STATUSES) {
      expect(RIDE_TRANSITIONS[status]).toEqual([]);
      for (const target of Object.values(RideStatus)) {
        expect(canTransition(status, target)).toBe(false);
      }
    }
  });
});

describe("assertTransition", () => {
  it("passes silently for a legal transition", () => {
    expect(() => assertTransition(RideStatus.ACCEPTED, RideStatus.ARRIVING)).not.toThrow();
  });

  it("throws a conflict for an illegal transition", () => {
    expect(() => assertTransition(RideStatus.REQUESTED, RideStatus.COMPLETED)).toThrow(
      /Illegal ride transition/,
    );
  });
});

describe("isTerminal", () => {
  it("flags completed and cancelled rides", () => {
    expect(isTerminal(RideStatus.COMPLETED)).toBe(true);
    expect(isTerminal(RideStatus.CANCELLED)).toBe(true);
  });

  it("does not flag in-flight rides", () => {
    expect(isTerminal(RideStatus.REQUESTED)).toBe(false);
    expect(isTerminal(RideStatus.ACCEPTED)).toBe(false);
    expect(isTerminal(RideStatus.ARRIVING)).toBe(false);
    expect(isTerminal(RideStatus.ONGOING)).toBe(false);
    expect(isTerminal(RideStatus.REASSIGNING)).toBe(false);
  });
});
