/**
 * HealPoint - Admin · Reports module.
 */
import React from 'react';

import { RoleGuard } from '@/components/RoleGuard';
import { ModuleScreen } from '@/components/ui/ModuleScreen';

export default function AdminReportsScreen() {
  return (
    <RoleGuard allowedRoles={['admin', 'super_admin']}>
      <ModuleScreen
        title="Reports"
        icon="bar-chart-outline"
        accent="#2F80ED"
        description="Platform analytics: bookings, revenue, active doctors and hospital performance."
        features={[
          'Bookings over time',
          'Revenue summary',
          'Doctor & hospital activity',
        ]}
      />
    </RoleGuard>
  );
}
