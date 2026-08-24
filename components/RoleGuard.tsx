/**
 * HealPoint - role guard for screens outside the role route groups.
 *
 * Keeps admin/super-admin management screens safe from direct links opened by
 * a patient: unauthenticated users go to the welcome flow, wrong roles see a
 * friendly "not authorised" state instead of the screen.
 */
import React from 'react';

import { SplashScreen } from '@/components/splash-screen';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/hooks/use-auth';
import { canonicalRole, type CanonicalRole } from '@/lib/roles';

export function RoleGuard({
  allowedRoles,
  children,
}: {
  allowedRoles: CanonicalRole[];
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <SplashScreen />;
  }

  if (!allowedRoles.includes(canonicalRole(user?.role))) {
    return (
      <Screen>
        <EmptyState
          title="Not authorised"
          message="This screen is only available to authorised staff accounts. Use the menu to go back."
        />
      </Screen>
    );
  }

  return <>{children}</>;
}
