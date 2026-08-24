/**
 * HealPoint - Super Admin · Hospitals (real hospital directory).
 */
import React from 'react';

import { HospitalDirectory } from '@/components/drawer/HospitalDirectory';
import { RoleGuard } from '@/components/RoleGuard';

export default function SuperAdminHospitalsScreen() {
  return (
    <RoleGuard allowedRoles={['super_admin']}>
      <HospitalDirectory title="Hospitals" />
    </RoleGuard>
  );
}