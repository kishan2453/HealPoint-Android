/**
 * HealPoint - role-guarded drawer shell for the doctor/admin/super-admin
 * dashboards. Menu content is rendered by `AppDrawerContent` based on the
 * authenticated user's role.
 */
import { Drawer } from 'expo-router/drawer';
import React from 'react';

import { AppDrawerContent } from '@/components/drawer/AppDrawerContent';
import { RoleRoute } from '@/components/RoleRoute';
import { Palette } from '@/constants/theme';
import type { CanonicalRole } from '@/lib/roles';

const roleDrawerScreenOptions = {
  headerShown: false,
  drawerType: 'front' as const,
  drawerStyle: { backgroundColor: Palette.surface, width: 300 },
  drawerItemStyle: { display: 'none' as const },
  drawerActiveTintColor: Palette.primaryDark,
  drawerInactiveTintColor: Palette.textMuted,
  drawerActiveBackgroundColor: Palette.primaryLight,
  sceneStyle: { backgroundColor: Palette.background },
  swipeEdgeWidth: 60,
  overlayColor: 'rgba(9, 20, 18, 0.45)',
};

export function RoleDrawerLayout({
  allowedRoles,
  children,
}: {
  allowedRoles: CanonicalRole[];
  children: React.ReactNode;
}) {
  return (
    <RoleRoute allowedRoles={allowedRoles}>
      <Drawer
        drawerContent={(props) => <AppDrawerContent {...props} />}
        screenOptions={roleDrawerScreenOptions}
      >
        {children}
      </Drawer>
    </RoleRoute>
  );
}

export { Drawer };
