/**
 * HealPoint - Admin · Patients module.
 */
import React from 'react';

import { RoleGuard } from '@/components/RoleGuard';
import { ModuleScreen } from '@/components/ui/ModuleScreen';

export default function AdminPatientsScreen() {
  return (
    <RoleGuard allowedRoles={['admin', 'super_admin']}>
      <ModuleScreen
        title="Patients"
        icon="people-outline"
        accent="#2E9E5B"
        description="Patient accounts, activity and visit history across the platform."
        features={[
          'Search & view patient profiles',
          'Appointment history per patient',
          'Account status management',
        ]}
      />
    </RoleGuard>
  );
}
