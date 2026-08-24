/**
 * HealPoint - Prescriptions (inside the patient drawer).
 */
import React from 'react';

import { PatientModuleLanding } from '@/components/drawer/PatientModuleLanding';

export default function PrescriptionsScreen() {
  return (
    <PatientModuleLanding
      title="Prescriptions"
      icon="document-text-outline"
      accent="#2F80ED"
      description="Prescriptions issued by your doctors are stored here. Every prescription shows the medication, dosage and instructions from your consultation."
      features={[
        'Digital prescriptions from visits',
        'Dosage & instructions',
        'Refill reminders',
        'Download & share prescriptions',
      ]}
    />
  );
}
