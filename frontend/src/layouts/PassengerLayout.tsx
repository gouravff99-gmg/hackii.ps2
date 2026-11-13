import { DashboardLayout, type NavItem } from "./DashboardLayout";

const NAV: NavItem[] = [
  { to: "/passenger", label: "Home", icon: "home", end: true },
  { to: "/passenger/book", label: "Book a ride", icon: "map-pin" },
  { to: "/passenger/rides", label: "My rides", icon: "list" },
  { to: "/passenger/profile", label: "Profile", icon: "user" },
];

export function PassengerLayout() {
  return <DashboardLayout nav={NAV} roleLabel="Passenger" workspaceName="RideOps" />;
}
