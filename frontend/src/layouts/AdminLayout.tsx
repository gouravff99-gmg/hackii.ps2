import { DashboardLayout, type NavItem } from "./DashboardLayout";

const NAV: NavItem[] = [
  { to: "/admin", label: "Overview", icon: "chart", end: true },
  { to: "/admin/fleet", label: "Live fleet", icon: "car" },
  { to: "/admin/demand", label: "Demand intelligence", icon: "layers" },
  { to: "/admin/rides", label: "Ride management", icon: "route" },
  { to: "/admin/drivers", label: "Driver management", icon: "users" },
  { to: "/admin/allocation", label: "Smart allocation", icon: "zap" },
  { to: "/admin/simulation", label: "Simulation", icon: "play" },
  { to: "/admin/evaluation", label: "Evaluation", icon: "activity" },
  { to: "/admin/settings", label: "Settings", icon: "settings" },
];

export function AdminLayout() {
  return (
    <DashboardLayout
      nav={NAV}
      roleLabel="Administrator"
      workspaceName="Operations console"
      accent="violet"
    />
  );
}
