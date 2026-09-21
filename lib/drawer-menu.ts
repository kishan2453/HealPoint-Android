/**
 * HealPoint - role-aware drawer menu configuration.
 *
 * Every menu item maps to a real, guarded route. Items are grouped in the same
 * premium structure used by the reference HealPoint app.
 */
import type { Ionicons } from "@expo/vector-icons";
import type { Href } from "expo-router";

import type { CanonicalRole } from "@/lib/roles";

export interface DrawerMenuItem {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: Href;
}

export interface DrawerMenuSection {
  title: string;
  items: DrawerMenuItem[];
}

export function patientDrawerMenu(): DrawerMenuSection[] {
  return [
    {
      title: "Patient",
      items: [
        { label: "Home", icon: "home-outline", href: "/(drawer)" as Href },
        {
          label: "AI Assistant",
          icon: "sparkles-outline",
          href: "/ai-assistant" as Href,
        },
        {
          label: "Consult Online",
          icon: "videocam-outline",
          href: "/consult-online" as Href,
        },
        {
          label: "My Consultations",
          icon: "chatbubbles-outline",
          href: "/consultations" as Href,
        },
        {
          label: "Find Doctors",
          icon: "search-outline",
          href: "/doctors" as Href,
        },
        {
          label: "Hospitals",
          icon: "business-outline",
          href: "/hospitals" as Href,
        },
        {
          label: "My Appointments",
          icon: "calendar-outline",
          href: "/appointments" as Href,
        },
        {
          label: "Reviews & Ratings",
          icon: "star-outline",
          href: "/reviews" as Href,
        },
        {
          label: "Favorites",
          icon: "heart-outline",
          href: "/favorites" as Href,
        },
        {
          label: "Emergency Help",
          icon: "alert-circle-outline",
          href: "/emergency" as Href,
        },
      ],
    },
    {
      title: "Health",
      items: [
        {
          label: "Health Timeline",
          icon: "time-outline",
          href: "/health/timeline" as Href,
        },
        {
          label: "Health Records",
          icon: "folder-open-outline",
          href: "/health/records" as Href,
        },
        {
          label: "Prescriptions",
          icon: "document-text-outline",
          href: "/health/prescriptions" as Href,
        },
        {
          label: "Reports",
          icon: "bar-chart-outline",
          href: "/health/reports" as Href,
        },
        {
          label: "Family Members",
          icon: "people-outline",
          href: "/health/family" as Href,
        },
      ],
    },
    {
      title: "Payments",
      items: [
        {
          label: "Payment History",
          icon: "card-outline",
          href: "/payments/history" as Href,
        },
      ],
    },
    {
      title: "Other",
      items: [
        {
          label: "Notifications",
          icon: "notifications-outline",
          href: "/notification" as Href,
        },
        {
          label: "Help & Support",
          icon: "help-buoy-outline",
          href: "/support" as Href,
        },
        {
          label: "Settings",
          icon: "settings-outline",
          href: "/settings" as Href,
        },
        {
          label: "Privacy",
          icon: "shield-checkmark-outline",
          href: "/privacy" as Href,
        },
        { label: "Terms", icon: "reader-outline", href: "/terms" as Href },
      ],
    },
  ];
}

export function doctorDrawerMenu(): DrawerMenuSection[] {
  return [
    {
      title: "Doctor",
      items: [
        { label: "Dashboard", icon: "grid-outline", href: "/(doctor)" as Href },
        {
          label: "Appointments",
          icon: "calendar-outline",
          href: "/doctor/appointments" as Href,
        },
        {
          label: "Patients",
          icon: "people-outline",
          href: "/doctor/patients" as Href,
        },
        {
          label: "Availability",
          icon: "time-outline",
          href: "/doctor/availability" as Href,
        },
        {
          label: "Profile",
          icon: "person-circle-outline",
          href: "/doctor/profile" as Href,
        },
      ],
    },
    {
      title: "Account",
      items: [
        {
          label: "Notifications",
          icon: "notifications-outline",
          href: "/notification" as Href,
        },
        {
          label: "Settings",
          icon: "settings-outline",
          href: "/settings" as Href,
        },
      ],
    },
  ];
}

export function adminDrawerMenu(): DrawerMenuSection[] {
  return [
    {
      title: "Hospital",
      items: [
        { label: "Dashboard", icon: "grid-outline", href: "/(admin)" as Href },
        {
          label: "Hospital Profile",
          icon: "business-outline",
          href: "/admin/hospital-profile" as Href,
        },
        {
          label: "Doctors",
          icon: "medkit-outline",
          href: "/admin/doctors" as Href,
        },
        {
          label: "Doctor Verification",
          icon: "shield-checkmark-outline",
          href: "/admin/doctor-verification" as Href,
        },
        {
          label: "Doctor Availability",
          icon: "time-outline",
          href: "/admin/doctor-availability" as Href,
        },
        {
          label: "Slot Management",
          icon: "hourglass-outline",
          href: "/admin/slots" as Href,
        },
        {
          label: "Appointments",
          icon: "calendar-outline",
          href: "/admin/appointments" as Href,
        },
        {
          label: "Patients",
          icon: "people-outline",
          href: "/admin/patients" as Href,
        },
        {
          label: "Departments & Services",
          icon: "layers-outline",
          href: "/admin/departments" as Href,
        },
        {
          label: "Hospital Gallery",
          icon: "images-outline",
          href: "/admin/gallery" as Href,
        },
      ],
    },
    {
      title: "Operations",
      items: [
        {
          label: "Notifications",
          icon: "notifications-outline",
          href: "/admin/notifications" as Href,
        },
        {
          label: "Reviews",
          icon: "star-outline",
          href: "/admin/reviews" as Href,
        },
        {
          label: "Video Guides",
          icon: "videocam-outline",
          href: "/admin/video-guide" as Href,
        },
        {
          label: "Reports",
          icon: "bar-chart-outline",
          href: "/admin/reports" as Href,
        },
      ],
    },
    {
      title: "Finance",
      items: [
        {
          label: "Earnings",
          icon: "cash-outline",
          href: "/admin/earnings" as Href,
        },
        {
          label: "Subscription & Billing",
          icon: "card-outline",
          href: "/admin/subscription" as Href,
        },
      ],
    },
    {
      title: "Account",
      items: [
        {
          label: "Settings",
          icon: "settings-outline",
          href: "/admin/settings" as Href,
        },
      ],
    },
  ];
}

export function superAdminDrawerMenu(): DrawerMenuSection[] {
  // Only modules with real, working backend-backed screens are listed. Every
  // item navigates to a live route - no placeholders, no dead buttons.
  return [
    {
      title: "Overview",
      items: [
        {
          label: "Dashboard",
          icon: "grid-outline",
          href: "/(super-admin)" as Href,
        },
        {
          label: "Notifications & Alerts",
          icon: "notifications-outline",
          href: "/super-admin/notifications" as Href,
        },
        {
          label: "Platform Analytics",
          icon: "stats-chart-outline",
          href: "/super-admin/analytics" as Href,
        },
      ],
    },
    {
      title: "Management",
      items: [
        {
          label: "Users",
          icon: "people-outline",
          href: "/super-admin/users" as Href,
        },
        {
          label: "Patients",
          icon: "person-outline",
          href: "/super-admin/patients" as Href,
        },
        {
          label: "Doctors",
          icon: "medkit-outline",
          href: "/super-admin/doctors" as Href,
        },
        {
          label: "Hospitals",
          icon: "business-outline",
          href: "/super-admin/hospitals" as Href,
        },
        {
          label: "Hospital Admins",
          icon: "person-circle-outline",
          href: "/super-admin/admins" as Href,
        },
        {
          label: "Doctor Verification",
          icon: "shield-checkmark-outline",
          href: "/super-admin/doctor-verification" as Href,
        },
        {
          label: "Appointments",
          icon: "calendar-outline",
          href: "/super-admin/appointments" as Href,
        },
      ],
    },
    {
      title: "Finance",
      items: [
        {
          label: "Earnings & Refunds",
          icon: "cash-outline",
          href: "/super-admin/earnings" as Href,
        },
        {
          label: "Subscriptions",
          icon: "card-outline",
          href: "/super-admin/subscriptions" as Href,
        },
      ],
    },
    {
      title: "Communication",
      items: [
        {
          label: "Reviews",
          icon: "star-outline",
          href: "/super-admin/reviews" as Href,
        },
      ],
    },
  ];
}

export function drawerMenuForRole(role: CanonicalRole): DrawerMenuSection[] {
  switch (role) {
    case "doctor":
      return doctorDrawerMenu();
    case "admin":
      return adminDrawerMenu();
    case "super_admin":
      return superAdminDrawerMenu();
    case "patient":
    default:
      return patientDrawerMenu();
  }
}
