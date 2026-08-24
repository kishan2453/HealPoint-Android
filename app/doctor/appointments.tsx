/**
 * HealPoint - Doctor appointments module (doctor app).
 */
import React from 'react';

import { RoleGuard } from '@/components/RoleGuard';
import { ModuleScreen } from '@/components/ui/ModuleScreen';

export default function DoctorAppointmentsScreen() {
  return (
    <RoleGuard allowedRoles={['doctor']}>
      <ModuleScreen
        title="Appointments"
        icon="calendar-outline"
        accent="#0E9F8E"
        description="Manage the appointments scheduled with you. Confirm, start, complete or cancel visits and keep your patients informed."
        features={[
          "Today's & upcoming appointments",
          'Update appointment status',
          'Consultation notes per visit',
          'Patient contact details',
        ]}
      />
    </RoleGuard>
  );
}
