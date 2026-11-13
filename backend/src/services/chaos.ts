import { ChaosAction, type ChaosRequest } from "@ps02/shared";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/ApiError";
import { checkDelayAndReassign, getActiveOffer, respondToOffer } from "./dispatch";
import { killSimulatedDriver } from "./simulator";

export interface ChaosResult {
  action: ChaosAction;
  detail: string;
  reassigned?: boolean;
}

/**
 * Chaos tooling used by both `POST /api/admin/chaos` and the `admin:chaos`
 * socket event. All three triggers feed the same reassignment path as real
 * failures, so what admins see is what production would do.
 */
export async function applyChaos(request: ChaosRequest): Promise<ChaosResult> {
  switch (request.action) {
    case ChaosAction.KILL_DRIVER: {
      if (!request.driverId) throw ApiError.badRequest("driverId is required for killDriver");
      const driver = await prisma.driver.findUnique({ where: { id: request.driverId } });
      if (!driver) throw ApiError.notFound("Driver not found");

      await killSimulatedDriver(request.driverId);
      await prisma.driver.update({
        where: { id: request.driverId },
        data: { status: "OFFLINE" },
      });
      return { action: request.action, detail: `Driver ${request.driverId} taken offline` };
    }

    case ChaosAction.DELAY_DRIVER: {
      if (!request.rideId) throw ApiError.badRequest("rideId is required for delayDriver");
      const ride = await prisma.ride.findUnique({ where: { id: request.rideId } });
      if (!ride) throw ApiError.notFound("Ride not found");

      const inflatedEta = Math.max(ride.promisedEtaMin + 5, ride.promisedEtaMin * 1.6);
      const reassigned = await checkDelayAndReassign(request.rideId, inflatedEta);
      return {
        action: request.action,
        detail: reassigned
          ? `Delay beyond threshold detected; ride reassigned (ETA ${Math.round(inflatedEta)} min)`
          : "Delay reported but still within the allowed threshold",
        reassigned,
      };
    }

    case ChaosAction.FORCE_REJECT: {
      if (!request.rideId) throw ApiError.badRequest("rideId is required for forceReject");
      const offer = getActiveOffer(request.rideId);
      if (!offer) throw ApiError.conflict("That ride has no active driver offer");
      await respondToOffer({ rideId: request.rideId, driverId: offer.driverId, accept: false });
      return {
        action: request.action,
        detail: `Offer for ride ${request.rideId} force-rejected`,
        reassigned: true,
      };
    }

    default:
      throw ApiError.badRequest("Unknown chaos action");
  }
}
