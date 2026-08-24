/**
 * HealPoint - Super Admin · Reports module.
 */
import React from 'react';

import { RoleGuard } from '@/components/RoleGuard';
import { ModuleScreen } from '@/components/ui/ModuleScreen';

export default function SuperAdminReportsScreen() {
  return (
    <RoleGuard allowedRoles={['super_admin']}>
      <ModuleScreen
        title="Reports"
        icon="bar-chart-outline"
        accent="#2F80ED"
        description="Global platform analytics for growth and operational decisions."
        features={[
          'Revenue & bookings trends',
          'Active users & providers',
          'Regional activity',
        ]}
      />
    </RoleGuard>
  );
}