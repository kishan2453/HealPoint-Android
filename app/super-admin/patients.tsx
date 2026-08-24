/**
 * HealPoint - Super Admin · Patients module.
 */
import React from 'react';

import { RoleGuard } from '@/components/RoleGuard';
import { ModuleScreen } from '@/components/ui/ModuleScreen';

export default function SuperAdminPatientsScreen() {
  return (
    <RoleGuard allowedRoles={['super_admin']}>
      <ModuleScreen
        title="Patients"
        icon="people-outline"
        accent="#2E9E5B"
        description="Platform-wide patient accounts and activity."
        features={[
          'Search patient profiles',
          'Appointment history',
          'Account status management',
        ]}
      />
    </RoleGuard>
  );
}