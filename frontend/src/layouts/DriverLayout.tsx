import { useEffect } from "react";
import {
  SOCKET_EVENTS,
  type RideOfferPayload,
  type RideStatusPayload,
} from "@ps02/shared";
import { DashboardLayout, type NavItem } from "./DashboardLayout";
import { useSocketEvent } from "../hooks/useSocketEvent";
import { clearOffer, getOffer, setOffer } from "../features/driver/offerStore";
import { rideApi } from "../services/rideApi";
import { useToast } from "../hooks/useToast";

const NAV: NavItem[] = [
  { to: "/driver", label: "Dashboard", icon: "home", end: true },
  { to: "/driver/requests", label: "Ride requests", icon: "zap" },
  { to: "/driver/trips", label: "My trips", icon: "list" },
  { to: "/driver/profile", label: "Profile", icon: "user" },
  { to: "/driver/onboarding", label: "Onboarding & verification", icon: "shield" },
  { to: "/driver/demand", label: "Demand intelligence", icon: "layers" },
];

/**
 * Mounted for every driver route. Keeps the live offer in the shared store so
 * a 15-second offer survives navigation between the dashboard and requests.
 */
function DriverRealtimeBridge() {
  const toast = useToast();

  useSocketEvent<RideOfferPayload>(SOCKET_EVENTS.RIDE_OFFER, (offer) => setOffer(offer));

  useSocketEvent<RideStatusPayload>(SOCKET_EVENTS.RIDE_STATUS, (payload) => {
    if (getOffer()?.rideId === payload.rideId) clearOffer();
  });

  useEffect(() => {
    let active = true;
    rideApi
      .driverOffer()
      .then(({ offer }) => {
        if (active && offer && new Date(offer.expiresAt).getTime() > Date.now()) {
          setOffer(offer);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          const message = error instanceof Error ? error.message : "Could not check for a ride request.";
          toast.push("error", "Ride request sync failed", message);
        }
      });

    return () => {
      active = false;
    };
  }, [toast]);

  return null;
}

export function DriverLayout() {
  return (
    <>
      <DriverRealtimeBridge />
      <DashboardLayout
        nav={NAV}
        roleLabel="Driver"
        workspaceName="Driver workspace"
        accent="emerald"
      />
    </>
  );
}
