import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import type { UserRole } from "../../types/access";

export function RequireRole({
  allowed,
  children,
}: {
  allowed: UserRole[];
  children: ReactNode;
}) {
  const { loading, role } = useAuth();
  if (loading) {
    return <main className="authLoading">Loading access…</main>;
  }
  if (!allowed.includes(role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}
