import React from "react";

const AdminActionButton = ({
  children,
  className = "",
  icon,
  type = "button",
  variant = "primary",
  ...props
}) => {
  return (
    <button
      className={`admin-action-button admin-action-button--${variant} ${className}`.trim()}
      type={type}
      {...props}
    >
      {icon && <span className="admin-action-button-icon">{icon}</span>}
      <div className="admin-action-button-label">{children}</div>
    </button>
  );
};

export default AdminActionButton;
