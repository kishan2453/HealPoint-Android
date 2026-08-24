/**
 * HealPoint - Doctor availability module (doctor app).
 */
import React from 'react';

import { RoleGuard } from '@/components/RoleGuard';
import { ModuleScreen } from '@/components/ui/ModuleScreen';

export default function DoctorAvailabilityScreen() {
  return (
    <RoleGuard allowedRoles={['doctor']}>
      <ModuleScreen
        title="Availability"
        icon="time-outline"
        accent="#2F80ED"
        description="Control when patients can book you. Set your working hours, weekly schedule and time-slot duration."
        features={[
          'Manage weekly schedule',
          'Set slot duration',
          'Block holidays & leave',
          'Pause online booking when needed',
        ]}
      />
    </RoleGuard>
  );
}
