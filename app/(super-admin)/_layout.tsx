import { Drawer, RoleDrawerLayout } from '@/components/drawer/RoleDrawerLayout';
import React from 'react';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function SuperAdminLayout() {
  return (
    <RoleDrawerLayout allowedRoles={['super_admin']}>
      <Drawer.Screen name="index" options={{ title: 'Dashboard', drawerItemStyle: { display: 'none' } }} />
    </RoleDrawerLayout>
  );
}
