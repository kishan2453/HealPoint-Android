/**
 * HealPoint - Super Admin · Audit Logs module.
 */
import React from 'react';

import { RoleGuard } from '@/components/RoleGuard';
import { ModuleScreen } from '@/components/ui/ModuleScreen';

export default function AuditLogsScreen() {
  return (
    <RoleGuard allowedRoles={['super_admin']}>
      <ModuleScreen
        title="Audit Logs"
        icon="list-outline"
        accent="#D9435B"
        description="A secure record of administrative actions across the platform."
        features={[
          'Account & settings changes',
          'Admin activity trail',
          'Export logs',
        ]}
      />
    </RoleGuard>
  );
}