import {
  SOCKET_EVENTS,
  type RideOfferPayload,
  type RideStatusPayload,
} from "@ps02/shared";
import { DashboardLayout, type NavItem } from "./DashboardLayout";
import { useSocketEvent } from "../hooks/useSocketEvent";
import { clearOffer, getOffer, setOffer } from "../features/driver/offerStore";

const NAV: NavItem[] = [
  { to: "/driver", label: "Dashboard", icon: "home", end: true },
  { to: "/driver/requests", label: "Ride requests", icon: "zap" },
  { to: "/driver/trips", label: "My trips", icon: "list" },
  { to: "/driver/profile", label: "Profile", icon: "user" },
];

/**
 * Mounted for every driver route. Keeps the live offer in the shared store so
 * a 15-second offer survives navigation between the dashboard and requests.
 */
function DriverRealtimeBridge() {
  useSocketEvent<RideOfferPayload>(SOCKET_EVENTS.RIDE_OFFER, (offer) => setOffer(offer));

  useSocketEvent<RideStatusPayload>(SOCKET_EVENTS.RIDE_STATUS, (payload) => {
    if (getOffer()?.rideId === payload.rideId) clearOffer();
  });

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
