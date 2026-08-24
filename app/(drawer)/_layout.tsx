/**
 * HealPoint - patient drawer navigator.
 *
 * The patient app shell: every main screen (Home, Find Doctors, Hospitals,
 * Appointments, Profile) plus the expanded menu (Favorites, Health, Payments,
 * Other) lives inside a premium role-aware drawer. The hamburger on each
 * screen opens it; every menu item routes to a real, working screen.
 */
import { Drawer } from 'expo-router/drawer';
import React from 'react';

import { AppDrawerContent } from '@/components/drawer/AppDrawerContent';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Palette } from '@/constants/theme';

export const unstable_settings = {
  initialRouteName: 'index',
};

const hidden = { drawerItemStyle: { display: 'none' as const } };

export default function DrawerLayout() {
  return (
    <ProtectedRoute>
      <Drawer
        drawerContent={(props) => <AppDrawerContent {...props} />}
        screenOptions={{
          headerShown: false,
          drawerType: 'front',
          drawerStyle: { backgroundColor: Palette.surface, width: 300 },
          drawerItemStyle: { display: 'none' },
          drawerActiveTintColor: Palette.primaryDark,
          drawerInactiveTintColor: Palette.textMuted,
          drawerActiveBackgroundColor: Palette.primaryLight,
          sceneStyle: { backgroundColor: Palette.background },
          swipeEdgeWidth: 60,
          overlayColor: 'rgba(9, 20, 18, 0.45)',
        }}
      >
        {/* Main screens — reached directly, hidden from the default list since
            the custom drawer content renders them (patient menu). */}
        {/* Main screens — reached directly, hidden from the default list since
            the custom drawer content renders them (patient menu). */}
        <Drawer.Screen name="index" options={{ title: 'Home', ...hidden }} />
        <Drawer.Screen name="doctors" options={{ title: 'Find Doctors', ...hidden }} />
        <Drawer.Screen name="hospitals" options={{ title: 'Hospitals', ...hidden }} />
        <Drawer.Screen name="appointments" options={{ title: 'Appointments', ...hidden }} />
        <Drawer.Screen name="profile" options={{ title: 'Profile', ...hidden }} />
        <Drawer.Screen name="consult-online" options={{ title: 'Consult Online', ...hidden }} />
        <Drawer.Screen name="consultations" options={{ title: 'My Consultations', ...hidden }} />

        {/* Expanded patient menu screens */}
        <Drawer.Screen name="favorites" options={{ title: 'Favorites', ...hidden }} />
        <Drawer.Screen name="health/records" options={{ title: 'Health Records', ...hidden }} />
        <Drawer.Screen name="health/prescriptions" options={{ title: 'Prescriptions', ...hidden }} />
        <Drawer.Screen name="health/reports" options={{ title: 'Reports', ...hidden }} />
        <Drawer.Screen name="health/family" options={{ title: 'Family Members', ...hidden }} />
        <Drawer.Screen name="payments/history" options={{ title: 'Payment History', ...hidden }} />
        <Drawer.Screen name="support" options={{ title: 'Help & Support', ...hidden }} />
        <Drawer.Screen name="privacy" options={{ title: 'Privacy', ...hidden }} />
        <Drawer.Screen name="terms" options={{ title: 'Terms', ...hidden }} />
      </Drawer>
    </ProtectedRoute>
  );
}
