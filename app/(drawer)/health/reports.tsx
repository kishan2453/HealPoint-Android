/**
 * HealPoint - Reports (inside the patient drawer).
 */
import React from 'react';

import { PatientModuleLanding } from '@/components/drawer/PatientModuleLanding';

export default function ReportsScreen() {
  return (
    <PatientModuleLanding
      title="Reports"
      icon="bar-chart-outline"
      accent="#E89A3C"
      description="Lab reports and diagnostic results shared by your providers appear here, organised by date so you can track changes over time."
      features={[
        'Lab & diagnostic reports',
        'Organised by date',
        'Share reports with a doctor',
        'Download for your records',
      ]}
    />
  );
}
