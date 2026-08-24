/**
 * HealPoint - Health Records (inside the patient drawer).
 */
import React from 'react';

import { PatientModuleLanding } from '@/components/drawer/PatientModuleLanding';

export default function HealthRecordsScreen() {
  return (
    <PatientModuleLanding
      title="Health Records"
      icon="folder-open-outline"
      accent="#0E9F8E"
      description="Your medical history, allergies, immunisations and chronic conditions live here once your doctors share them with you through HealPoint."
      features={[
        'Immunisation history',
        'Allergies & conditions',
        'Medication list',
        'Share records with your doctors',
      ]}
    />
  );
}
