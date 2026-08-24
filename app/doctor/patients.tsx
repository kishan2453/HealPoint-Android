/**
 * HealPoint - Doctor patients module (doctor app).
 */
import React from 'react';

import { RoleGuard } from '@/components/RoleGuard';
import { ModuleScreen } from '@/components/ui/ModuleScreen';

export default function DoctorPatientsScreen() {
  return (
    <RoleGuard allowedRoles={['doctor']}>
      <ModuleScreen
        title="Patients"
        icon="people-outline"
        accent="#2E9E5B"
        description="Your patient list with visit history and past consultations, so you can pick up right where you left off."
        features={[
          'Patients with scheduled visits',
          'Consultation history',
          'Health records shared with you',
          'Follow-up reminders',
        ]}
      />
    </RoleGuard>
  );
}
