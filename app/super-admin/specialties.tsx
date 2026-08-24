/**
 * HealPoint - Super Admin · Specialties module.
 */
import React from 'react';

import { RoleGuard } from '@/components/RoleGuard';
import { ModuleScreen } from '@/components/ui/ModuleScreen';

export default function SuperAdminSpecialtiesScreen() {
  return (
    <RoleGuard allowedRoles={['super_admin']}>
      <ModuleScreen
        title="Specialties"
        icon="ribbon-outline"
        accent="#0E9F8E"
        description="The catalog of medical specialties doctors can be listed under."
        features={[
          'Add new specialties',
          'Rename & organise categories',
          'Doctor counts per specialty',
        ]}
      />
    </RoleGuard>
  );
}