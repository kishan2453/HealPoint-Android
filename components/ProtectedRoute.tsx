/**
 * HealPoint - route guard for authenticated screens.
 *
 * Renders the splash while the session is restoring and redirects to the
 * welcome screen when there is no valid session.
 */
import React from 'react';
import { Redirect } from 'expo-router';

import { SplashScreen } from '@/components/splash-screen';
import { useAuth } from '@/hooks/use-auth';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return <SplashScreen />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/welcome" />;
  }

  return <>{children}</>;
}