/**
 * HealPoint - role guard for role-scoped route groups.
 *
 * Works like ProtectedRoute but also enforces the minimum role. A user who is
 * unauthenticated is sent to the welcome flow; an authenticated user whose role
 * does not belong in this group is redirected to their own home route (never a
 * blank screen). While the persisted session is restoring we show the splash.
 */
import React from 'react';
import { Redirect } from 'expo-router';

import { SplashScreen } from '@/components/splash-screen';
import { useAuth } from '@/hooks/use-auth';
import { canonicalRole, homeRouteForRole } from '@/lib/roles';

export function RoleRoute({
  allowedRoles,
  children,
}: {
  allowedRoles: ('patient' | 'doctor' | 'admin' | 'super_admin')[];
  children: React.ReactNode;
}) {
  const { isLoading, isAuthenticated, user } = useAuth();

  if (isLoading) {
    return <SplashScreen />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/welcome" />;
  }

  if (!allowedRoles.includes(canonicalRole(user?.role))) {
    // Authenticated but this isn't their module — send them to their own home.
    return <Redirect href={homeRouteForRole(user?.role)} />;
  }

  return <>{children}</>;
}
