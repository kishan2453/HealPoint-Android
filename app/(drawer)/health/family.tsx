/**
 * HealPoint - Family Members (inside the patient drawer).
 */
import React from 'react';

import { PatientModuleLanding } from '@/components/drawer/PatientModuleLanding';

export default function FamilyMembersScreen() {
  return (
    <PatientModuleLanding
      title="Family Members"
      icon="people-outline"
      accent="#2E9E5B"
      description="Add family profiles so you can book appointments and keep their health information together in one place. Each member gets their own private records."
      features={[
        'Add family member profiles',
        'Book appointments for them',
        'Separate private records',
        'Manage permissions',
      ]}
    />
  );
}
