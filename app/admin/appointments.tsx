/**
 * HealPoint - Admin · Appointments module.
 */
import React from 'react';

import { RoleGuard } from '@/components/RoleGuard';
import { ModuleScreen } from '@/components/ui/ModuleScreen';

export default function AdminAppointmentsScreen() {
  return (
    <RoleGuard allowedRoles={['admin', 'super_admin']}>
      <ModuleScreen
        title="Appointments"
        icon="calendar-outline"
        accent="#0E9F8E"
        description="A platform-wide view of every booking with status and payment information."
        features={[
          "Today's appointments",
          'Status & rescheduling overview',
          'Payment state per booking',
        ]}
      />
    </RoleGuard>
  );
}
