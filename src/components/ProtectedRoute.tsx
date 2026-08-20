import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";

const ProtectedRoute = ({
  children,
  adminOnly = false,
  staffOnly = false,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
  staffOnly?: boolean;
}) => {
  const { isAuthenticated, isAdmin, isStaff } = useAuthStore();

  if (!isAuthenticated()) return <Navigate to="/" replace />;
  if (adminOnly && !isAdmin()) {
    return <Navigate to="/" replace />;
  }
  // Staff routes admit both Admin and Manager.
  if (staffOnly && !isStaff()) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
