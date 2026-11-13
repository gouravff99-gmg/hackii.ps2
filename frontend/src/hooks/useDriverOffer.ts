import { useEffect, useState } from "react";
import type { RideOfferPayload } from "@ps02/shared";
import { getOffer, subscribeOffer } from "../features/driver/offerStore";

/** Live offer for the signed-in driver, shared across driver routes. */
export function useDriverOffer(): RideOfferPayload | null {
  const [offer, setOffer] = useState<RideOfferPayload | null>(getOffer());

  useEffect(() => subscribeOffer(setOffer), []);

  return offer;
}
