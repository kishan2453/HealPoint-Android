import React from 'react';

import { RoleDashboard } from '@/components/ui/RoleDashboard';

export default function DoctorDashboardScreen() {
  return (
    <RoleDashboard
      title="Doctor Dashboard"
      icon="medkit"
      accent="#0E9F8E"
      modules={[
        'Today\'s & upcoming appointments',
        'Update appointment status',
        'Manage availability & time slots',
        'Patients with scheduled visits',
        'Doctor profile & clinic info',
      ]}
    />
  );
}