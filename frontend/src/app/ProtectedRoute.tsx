import { Navigate, useLocation } from "react-router-dom";
import type { Role } from "@ps02/shared";
import { useAuth } from "../hooks/useAuth";
import { FullPageLoader } from "../components/ui/Spinner";
import { homeForRole } from "../utils/roles";

/**
 * Client-side route guard. This is a UX convenience only: every API call is
 * authorized again on the server from the signed token.
 */
export function ProtectedRoute({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageLoader label="Checking your session" />;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (user.role !== role) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }

  return <>{children}</>;
}
