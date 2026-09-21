import React from 'react';

import { RoleDashboard } from '@/components/ui/RoleDashboard';
import { useAuth } from '@/hooks/use-auth';

export default function DoctorDashboardScreen() {
  const { user } = useAuth();

  return (
    <RoleDashboard
      title="Doctor Dashboard"
      icon="medkit"
      accent="#0E9F8E"
      subtitle={
        user?.hospitalName
          ? `Signed in as ${user?.name || 'Doctor'} · ${user.hospitalName}`
          : undefined
      }
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