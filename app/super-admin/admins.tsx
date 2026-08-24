/**
 * HealPoint - Super Admin · Admins module.
 */
import React from 'react';

import { RoleGuard } from '@/components/RoleGuard';
import { ModuleScreen } from '@/components/ui/ModuleScreen';

export default function SuperAdminAdminsScreen() {
  return (
    <RoleGuard allowedRoles={['super_admin']}>
      <ModuleScreen
        title="Admins"
        icon="shield-checkmark-outline"
        accent="#E89A3C"
        description="Manage platform administrators and their access levels."
        features={[
          'List & invite admins',
          'Set admin roles',
          'Revoke access',
        ]}
      />
    </RoleGuard>
  );
}