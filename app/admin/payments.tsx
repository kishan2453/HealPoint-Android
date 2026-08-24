/**
 * HealPoint - Admin · Payments module.
 */
import React from 'react';

import { RoleGuard } from '@/components/RoleGuard';
import { ModuleScreen } from '@/components/ui/ModuleScreen';

export default function AdminPaymentsScreen() {
  return (
    <RoleGuard allowedRoles={['admin', 'super_admin']}>
      <ModuleScreen
        title="Payments"
        icon="card-outline"
        accent="#E89A3C"
        description="Transaction overview and settlement information for all bookings."
        features={[
          'Daily transaction summary',
          'Payment status per booking',
          'Refund & settlement tracking',
        ]}
      />
    </RoleGuard>
  );
}
