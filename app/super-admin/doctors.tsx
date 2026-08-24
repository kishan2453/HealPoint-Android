/**
 * HealPoint - Super Admin · Doctors (real doctor directory).
 */
import React from 'react';

import { DoctorDirectory } from '@/components/drawer/DoctorDirectory';
import { RoleGuard } from '@/components/RoleGuard';

export default function SuperAdminDoctorsScreen() {
  return (
    <RoleGuard allowedRoles={['super_admin']}>
      <DoctorDirectory title="Doctors" />
    </RoleGuard>
  );
}