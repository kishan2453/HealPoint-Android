import React from "react";

const AdminPreloader = ({ show }) => {
  return (
    <div className={`admin-preloader ${show ? "show" : "hide"}`}>
      <div className="admin-preloader-core">
        <div className="admin-preloader-orbit" />
        <strong>H</strong>
        <span>HealPoint Super Admin</span>
        <div className="admin-preloader-progress">
          <i />
        </div>
      </div>
    </div>
  );
};

export default AdminPreloader;
