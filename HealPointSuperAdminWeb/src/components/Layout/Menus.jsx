import React, { useMemo } from "react";
import { NavLink } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  FaTachometerAlt,
  FaHospital,
  FaStethoscope,
  FaUserInjured,
  FaCalendarCheck,
  FaHistory,
  FaStar,
  FaChartLine,
  FaCreditCard,
  FaHeadset,
  FaCog,
  FaUserTie,
  FaHeartbeat,
  FaSignOutAlt,
} from "react-icons/fa";
import { hasPermission } from "../../utils/permissions";
import HealPointBrandLogo from "../common/HealPointBrandLogo";

const NAV_GROUPS = [
  {
    label: "Main Navigation",
    items: [
      {
        to: "/home",
        label: "Dashboard",
        icon: <FaTachometerAlt />,
        permission: "dashboard",
      },
      {
        to: "/hospitals",
        label: "Hospitals",
        icon: <FaHospital />,
        permission: "hospitals",
      },
    ],
  },
  {
    label: "Management & Insights",
    items: [
      {
        to: "/reviews",
        label: "Reviews",
        icon: <FaStar />,
        permission: "reviews",
      },
      {
        to: "/platform-analytics",
        label: "Analytics",
        icon: <FaChartLine />,
        permission: "reports",
      },
      {
        to: "/subscriptions",
        label: "Subscriptions",
        icon: <FaCreditCard />,
        permission: "subscriptions",
      },
      {
        to: "/support",
        label: "Help & Support",
        icon: <FaHeadset />,
        permission: "support",
      },
    ],
  },
  {
    label: "System & Administration",
    items: [
      {
        to: "/hospital-admins",
        label: "Hospital Admins",
        icon: <FaUserTie />,
        permission: "hospital_admins",
      },
      {
        to: "/system-health",
        label: "System Health",
        icon: <FaHeartbeat />,
        permission: "system_health",
      },
      {
        to: "/settings",
        label: "Settings",
        icon: <FaCog />,
        permission: "settings",
      },
    ],
  },
];

const Menus = ({ onLogoutRequest, collapsed = false }) => {
  const reduxUser = useSelector((state) => state.auth?.user);
  const user = useMemo(() => {
    if (reduxUser) return reduxUser;
    try {
      const localStr = localStorage.getItem("appData");
      return localStr ? JSON.parse(localStr)?.user : null;
    } catch {
      return null;
    }
  }, [reduxUser]);

  const visibleGroups = useMemo(() => {
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.permission || hasPermission(user, item.permission),
      ),
    })).filter((group) => group.items.length > 0);
  }, [user]);

  return (
    <div
      className={`admin-menu-wrap sa-menu ${collapsed ? "sa-menu-collapsed" : ""}`}
    >
      {/* Brand Header */}
      <div className="admin-brand sa-brand">
        <HealPointBrandLogo size={34} showTagline={!collapsed} />
      </div>

      {/* Nav List */}
      <nav className="sa-nav" aria-label="Super Admin navigation">
        {visibleGroups.map((group) => (
          <div className="sa-nav-group" key={group.label}>
            {!collapsed && <p className="sa-nav-group-label">{group.label}</p>}
            <ul className="nav admin-nav-list sa-nav-list">
              {group.items.map((item) => (
                <li className="nav-item sa-nav-item" key={item.to}>
                  <NavLink
                    className={({ isActive }) =>
                      `nav-link sa-nav-link${isActive ? " active" : ""}`
                    }
                    to={item.to}
                    title={collapsed ? item.label : undefined}
                  >
                    <span className="sa-nav-icon">{item.icon}</span>
                    {!collapsed && (
                      <span className="sa-nav-text">{item.label}</span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Healthcare Promotional Card */}
      {!collapsed && (
        <div className="sa-sidebar-promo-card">
          <div className="sa-sidebar-promo-badge">
            <FaStethoscope />
          </div>
          <div className="sa-sidebar-promo-content">
            <strong>Better Healthcare</strong>
            <p>for a Brighter Tomorrow</p>
          </div>
        </div>
      )}

      {/* Logout Zone */}
      <div className="sa-logout-zone">
        <button
          type="button"
          className="sa-logout-btn"
          onClick={onLogoutRequest}
          title={collapsed ? "Logout" : undefined}
        >
          <FaSignOutAlt />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );
};

export default Menus;
