/**
 * HealPoint - Admin · Hospitals (real hospital directory).
 */
import React from 'react';

import { HospitalDirectory } from '@/components/drawer/HospitalDirectory';
import { RoleGuard } from '@/components/RoleGuard';

export default function AdminHospitalsScreen() {
  return (
    <RoleGuard allowedRoles={['admin', 'super_admin']}>
      <HospitalDirectory title="Hospitals" />
    </RoleGuard>
  );
}
