export const MODULE_PERMISSIONS = [
  {
    id: 'dashboard',
    name: 'Dashboard & KPIs',
    description: 'Access executive dashboard, KPI metrics, and operational overview.',
    category: 'Overview',
    route: '/home',
  },
  {
    id: 'hospitals',
    name: 'Hospital Directory',
    description: 'Manage hospital profiles, facilities, bed counts, and operational statuses.',
    category: 'Overview',
    route: '/hospitals',
  },
  {
    id: 'hospital_admins',
    name: 'Hospital Administrators',
    description: 'Provision, manage, activate/suspend hospital admin accounts and assign hospitals.',
    category: 'Overview',
    route: '/hospital-admins',
  },
  {
    id: 'doctors',
    name: 'Doctor Directory & Verification',
    description: 'Inspect medical credentials, verify licenses, and manage doctor availability.',
    category: 'Clinical',
    route: '/all-doctors',
  },
  {
    id: 'patients',
    name: 'Patient Records',
    description: 'Access patient profiles, booking history, and account activity.',
    category: 'Clinical',
    route: '/all-users',
  },
  {
    id: 'appointments',
    name: 'Appointment Engine',
    description: 'Inspect scheduling slots, reschedule, cancel, and review consultation history.',
    category: 'Clinical',
    route: '/all-appointments',
  },
  {
    id: 'reviews',
    name: 'Reputation & Reviews',
    description: 'Moderate patient feedback, approve or hide ratings, and eliminate spam.',
    category: 'Management',
    route: '/reviews',
  },
  {
    id: 'support',
    name: 'Help Desk & Escalations',
    description: 'Manage customer support inquiries, submit ticket replies, and track resolution.',
    category: 'Management',
    route: '/support',
  },
  {
    id: 'subscriptions',
    name: 'Subscription Management',
    description: 'Configure SaaS tiers, monitor recurring hospital billing, and manage plans.',
    category: 'Finance',
    route: '/subscriptions',
  },
  {
    id: 'reports',
    name: 'Platform Analytics',
    description: 'View financial trends, platform utilization metrics, and growth reports.',
    category: 'Finance',
    route: '/platform-analytics',
  },
  {
    id: 'video_guide',
    name: 'Video Guides & Tutorials',
    description: 'Configure instructional walkthrough videos for patients and healthcare providers.',
    category: 'Content',
    route: '/video-guide',
  },
  {
    id: 'notifications',
    name: 'Signal Center Alerts',
    description: 'Monitor system notifications, operational events, and broadcast alerts.',
    category: 'Content',
    route: '/notifications',
  },
  {
    id: 'gallery',
    name: 'Visual Assets & Gallery',
    description: 'Upload and curate facility photography and medical department visual assets.',
    category: 'Content',
    route: '/gallery-management',
  },
  {
    id: 'system_health',
    name: 'Diagnostics & System Health',
    description: 'Inspect subsystem diagnostics (MongoDB, API server, Razorpay, Comms).',
    category: 'System',
    route: '/system-health',
  },
  {
    id: 'audit_logs',
    name: 'Security Audit Logs',
    description: 'Inspect forensic security logs, login audits, and administrative activities.',
    category: 'System',
    route: '/audit-logs',
  },
  {
    id: 'settings',
    name: 'Platform & Security Settings',
    description: 'Configure global booking parameters, emergency contacts, and security rules.',
    category: 'System',
    route: '/settings',
  },
];

export const ALL_PERMISSION_IDS = MODULE_PERMISSIONS.map((p) => p.id);

export const DEFAULT_HOSPITAL_ADMIN_PERMISSIONS = [
  'dashboard',
  'doctors',
  'patients',
  'appointments',
  'reviews',
  'support',
  'notifications',
  'gallery',
];

/**
 * Checks if a user has access to a specific permission.
 * Super Admin always has full access to all modules.
 */
export const hasPermission = (user, permissionId) => {
  if (!permissionId) return true;
  if (!user) return false;
  if (user.role === 'Super Admin' || user.isSuperAdmin) return true;
  const permissions = user.permissions;
  if (!permissions || !Array.isArray(permissions)) return false;
  return permissions.includes(permissionId);
};
