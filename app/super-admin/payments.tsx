/**
 * HealPoint - Super Admin · Payments module.
 */
import React from 'react';

import { RoleGuard } from '@/components/RoleGuard';
import { ModuleScreen } from '@/components/ui/ModuleScreen';

export default function SuperAdminPaymentsScreen() {
  return (
    <RoleGuard allowedRoles={['super_admin']}>
      <ModuleScreen
        title="Payments"
        icon="card-outline"
        accent="#E89A3C"
        description="Complete payment and settlement view across all providers."
        features={[
          'Platform revenue summary',
          'Settlements to providers',
          'Refund & dispute tracking',
        ]}
      />
    </RoleGuard>
  );
}