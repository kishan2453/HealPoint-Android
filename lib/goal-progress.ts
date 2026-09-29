/**
 * Health Goals progress calculation engine.
 * This engine never fabricates data and only shows real progress from existing HealPoint data.
 * It strictly derives metrics factually and is not a diagnosis system.
 */

import type {
  Appointment,
  FollowUpOverviewItem,
  HealthGoal,
  HealthGoalProgress,
  HealthGoalType,
  MedicationReminder,
  PatientMedicalOverview,
} from '@/types';
import type { HealthWalletCounts } from '@/services/wallet';

export function calculateAppointmentProgress(appointments: Appointment[], target: number): HealthGoalProgress {
  if (!appointments || appointments.length === 0) {
    return {
      current: 0,
      target,
      percentage: 0,
      hasEnoughData: false,
      label: 'Not enough data yet',
    };
  }

  const completedCount = appointments.filter((app) => app.status === 'completed').length;
  const current = Math.min(completedCount, target);
  const percentage = target > 0 ? Math.max(0, Math.min(100, Math.round((current / target) * 100))) : 0;

  return {
    current,
    target,
    percentage,
    hasEnoughData: true,
    label: `${current} of ${target} appointments completed`,
  };
}

export function calculateMedicationProgress(reminders: MedicationReminder[], target: number): HealthGoalProgress {
  if (!reminders || reminders.length === 0) {
    return {
      current: 0,
      target,
      percentage: 0,
      hasEnoughData: false,
      label: 'Not enough data yet',
    };
  }

  let takenCount = 0;
  let hasLogs = false;
  for (const reminder of reminders) {
    if (reminder.logs && reminder.logs.length > 0) {
      hasLogs = true;
      takenCount += reminder.logs.filter((log) => log.status === 'taken').length;
    }
  }

  if (!hasLogs) {
    return {
      current: 0,
      target,
      percentage: 0,
      hasEnoughData: false,
      label: 'Not enough data yet',
    };
  }

  const current = Math.min(takenCount, target);
  const percentage = target > 0 ? Math.max(0, Math.min(100, Math.round((current / target) * 100))) : 0;

  return {
    current,
    target,
    percentage,
    hasEnoughData: true,
    label: `${current} of ${target} reminders marked taken`,
  };
}

export function calculateFollowUpProgress(followUps: FollowUpOverviewItem[], target: number): HealthGoalProgress {
  if (!followUps || followUps.length === 0) {
    return {
      current: 0,
      target,
      percentage: 0,
      hasEnoughData: false,
      label: 'Not enough data yet',
    };
  }

  const completedCount = followUps.filter((fu) => fu.status === 'completed').length;
  const current = Math.min(completedCount, target);
  const percentage = target > 0 ? Math.max(0, Math.min(100, Math.round((current / target) * 100))) : 0;

  return {
    current,
    target,
    percentage,
    hasEnoughData: true,
    label: `${current} of ${target} follow-ups completed`,
  };
}

export function calculateRecordProgress(walletCounts: HealthWalletCounts | null, target: number): HealthGoalProgress {
  if (!walletCounts) {
    return {
      current: 0,
      target,
      percentage: 0,
      hasEnoughData: false,
      label: 'Not enough data yet',
    };
  }

  const documentCount = walletCounts.total || 0;
  const current = Math.min(documentCount, target);
  const percentage = target > 0 ? Math.max(0, Math.min(100, Math.round((current / target) * 100))) : 0;

  return {
    current,
    target,
    percentage,
    hasEnoughData: true,
    label: `${current} of ${target} documents organized`,
  };
}

export function calculateGoalProgress(
  goal: HealthGoal,
  data: {
    appointments?: Appointment[];
    reminders?: MedicationReminder[];
    followUps?: FollowUpOverviewItem[];
    walletCounts?: HealthWalletCounts | null;
  }
): HealthGoalProgress {
  switch (goal.goalType) {
    case 'appointment_adherence':
      return calculateAppointmentProgress(data.appointments || [], goal.target);
    case 'medication_adherence':
      return calculateMedicationProgress(data.reminders || [], goal.target);
    case 'followup_completion':
      return calculateFollowUpProgress(data.followUps || [], goal.target);
    case 'record_organization':
      return calculateRecordProgress(data.walletCounts || null, goal.target);
    default:
      return {
        current: 0,
        target: goal.target,
        percentage: 0,
        hasEnoughData: false,
        label: 'Not enough data yet',
      };
  }
}

export function computeCareScore(metrics: PatientMedicalOverview): number {
  if (
    !metrics.completedConsultations &&
    !metrics.prescriptionsCount &&
    !metrics.reportsCount &&
    !metrics.upcomingAppointments &&
    !metrics.reviewsSubmitted
  ) {
    return 0;
  }

  let score = 0;

  // completedConsultations: weight 35 (cap at 10 for full points)
  score += Math.min((metrics.completedConsultations || 0) / 10, 1) * 35;

  // prescriptionsCount: weight 20 (cap at 5)
  score += Math.min((metrics.prescriptionsCount || 0) / 5, 1) * 20;

  // reportsCount: weight 15 (cap at 5)
  score += Math.min((metrics.reportsCount || 0) / 5, 1) * 15;

  // upcomingAppointments: weight 15 (cap at 3)
  score += Math.min((metrics.upcomingAppointments || 0) / 3, 1) * 15;

  // reviewsSubmitted: weight 15 (cap at 3)
  score += Math.min((metrics.reviewsSubmitted || 0) / 3, 1) * 15;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export const GOAL_TYPE_CONFIG: Record<
  HealthGoalType,
  { label: string; icon: string; color: string; description: string }
> = {
  appointment_adherence: {
    label: 'Appointment Adherence',
    icon: 'calendar-outline',
    color: '#2F80ED',
    description: 'Track completed appointments',
  },
  medication_adherence: {
    label: 'Medication Adherence',
    icon: 'medical-outline',
    color: '#10B981',
    description: 'Track medication reminders marked taken',
  },
  followup_completion: {
    label: 'Follow-Up Completion',
    icon: 'refresh-outline',
    color: '#9356D6',
    description: 'Track completed follow-up visits',
  },
  record_organization: {
    label: 'Record Organization',
    icon: 'folder-open-outline',
    color: '#0284C7',
    description: 'Track health documents organized',
  },
};
