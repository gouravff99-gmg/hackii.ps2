import { Navigate, Route, Routes } from "react-router-dom";
import { Role } from "@ps02/shared";
import { useAuth } from "../hooks/useAuth";
import { AdminLayout } from "../layouts/AdminLayout";
import { DriverLayout } from "../layouts/DriverLayout";
import { PassengerLayout } from "../layouts/PassengerLayout";
import { PublicLayout } from "../layouts/PublicLayout";
import { Landing } from "../pages/Landing";
import { NotFound } from "../pages/NotFound";
import { Login } from "../pages/auth/Login";
import { Register } from "../pages/auth/Register";
import { PassengerHome } from "../pages/passenger/PassengerHome";
import { BookRide } from "../pages/passenger/BookRide";
import { MyRides } from "../pages/passenger/MyRides";
import { Profile } from "../pages/passenger/Profile";
import { DriverDashboard } from "../pages/driver/DriverDashboard";
import { RideRequests } from "../pages/driver/RideRequests";
import { MyTrips } from "../pages/driver/MyTrips";
import { DriverProfile } from "../pages/driver/DriverProfile";
import { Onboarding } from "../pages/driver/Onboarding";
import { DemandInsights as DriverDemandInsights } from "../pages/driver/DemandInsights";
import { Overview } from "../pages/admin/Overview";
import { LiveFleet } from "../pages/admin/LiveFleet";
import { DemandIntelligence } from "../pages/admin/DemandIntelligence";
import { RideManagement } from "../pages/admin/RideManagement";
import { DriverManagement } from "../pages/admin/DriverManagement";
import { SmartAllocation } from "../pages/admin/SmartAllocation";
import { Simulation } from "../pages/admin/Simulation";
import { Evaluation } from "../pages/admin/Evaluation";
import { Settings } from "../pages/admin/Settings";
import { DriverVerification } from "../pages/admin/DriverVerification";
import { FullPageLoader } from "../components/ui/Spinner";
import { homeForRole } from "../utils/roles";
import { ProtectedRoute } from "./ProtectedRoute";

/** Send already-authenticated users away from /login and /register. */
function GuestOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageLoader label="Checking your session" />;
  if (user) return <Navigate to={homeForRole(user.role)} replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Landing />} />
        <Route
          path="login"
          element={
            <GuestOnly>
              <Login />
            </GuestOnly>
          }
        />
        <Route
          path="register"
          element={
            <GuestOnly>
              <Register />
            </GuestOnly>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>

      <Route
        path="passenger"
        element={
          <ProtectedRoute role={Role.PASSENGER}>
            <PassengerLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<PassengerHome />} />
        <Route path="book" element={<BookRide />} />
        <Route path="rides" element={<MyRides />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      <Route
        path="driver"
        element={
          <ProtectedRoute role={Role.DRIVER}>
            <DriverLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DriverDashboard />} />
        <Route path="requests" element={<RideRequests />} />
        <Route path="trips" element={<MyTrips />} />
        <Route path="profile" element={<DriverProfile />} />
        <Route path="onboarding" element={<Onboarding />} />
        <Route path="demand" element={<DriverDemandInsights />} />
      </Route>

      <Route
        path="admin"
        element={
          <ProtectedRoute role={Role.ADMIN}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Overview />} />
        <Route path="fleet" element={<LiveFleet />} />
        <Route path="demand" element={<DemandIntelligence />} />
        <Route path="rides" element={<RideManagement />} />
        <Route path="drivers" element={<DriverManagement />} />
        <Route path="verification" element={<DriverVerification />} />
        <Route path="allocation" element={<SmartAllocation />} />
        <Route path="simulation" element={<Simulation />} />
        <Route path="evaluation" element={<Evaluation />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
