/**
 * HealPoint - Super Admin · System Settings module.
 */
import React from 'react';

import { RoleGuard } from '@/components/RoleGuard';
import { ModuleScreen } from '@/components/ui/ModuleScreen';

export default function SystemSettingsScreen() {
  return (
    <RoleGuard allowedRoles={['super_admin']}>
      <ModuleScreen
        title="System Settings"
        icon="settings-outline"
        accent="#5A6C7B"
        description="Platform-wide configuration that applies to patients, doctors and admins."
        features={[
          'Platform branding',
          'Online consultation & verification policies',
          'Notification defaults',
        ]}
      />
    </RoleGuard>
  );
}