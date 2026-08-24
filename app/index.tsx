import { Redirect } from 'expo-router';
import React from 'react';

import { SplashScreen } from '@/components/splash-screen';
import { useAuth } from '@/hooks/use-auth';
import { homeRouteForRole } from '@/lib/roles';

/**
 * Root entry. Shows the splash while the persisted session is being restored,
 * then routes by role to the correct dashboard:
 *   patient     → (drawer)   patient app (drawer shell)
 *   doctor      → (doctor)   doctor dashboard
 *   admin       → (admin)    admin dashboard
 *   super_admin → (super-admin) platform dashboard
 * Unauthenticated users go to the welcome screen.
 */
export default function Index() {
  const { isLoading, isAuthenticated, user } = useAuth();

  if (isLoading) {
    return <SplashScreen />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/welcome" />;
  }

  // NEVER redirect to "/" — this is the very screen running the auth check, so
  // redirecting here would loop and render a blank white screen on Android.
  // Instead we go straight to the role's home route.
  return <Redirect href={homeRouteForRole(user?.role)} />;
}