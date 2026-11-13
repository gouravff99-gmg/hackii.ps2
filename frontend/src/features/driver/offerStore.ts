import type { RideOfferPayload } from "@ps02/shared";

/**
 * Module-level store for the live driver offer. A driver offer arrives over a
 * socket and must survive route changes (dashboard <-> requests) for the full
 * countdown, so it cannot live in a single page's component state.
 */
type Listener = (offer: RideOfferPayload | null) => void;

let current: RideOfferPayload | null = null;
const listeners = new Set<Listener>();

export function setOffer(offer: RideOfferPayload) {
  current = offer;
  listeners.forEach((listener) => listener(current));
}

export function clearOffer() {
  if (!current) return;
  current = null;
  listeners.forEach((listener) => listener(null));
}

export function getOffer(): RideOfferPayload | null {
  return current;
}

export function subscribeOffer(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
