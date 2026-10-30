import { useEffect, useState } from "react";

export default function LogoutConfirmation() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("hospital-admin:logout-request", handler);
    return () => window.removeEventListener("hospital-admin:logout-request", handler);
  }, []);

  if (!open) return null;

  const confirmLogout = () => {
    localStorage.removeItem("hospitalAdminApp");
    window.location.href = "/login";
  };

  return (
    <div className="portal-logout-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
      <div className="portal-logout-dialog" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="portal-logout-icon">?</div>
        <h3>Are you sure you want to logout?</h3>
        <p>Your Hospital Admin session will be closed.</p>
        <div className="portal-logout-actions">
          <button type="button" onClick={() => setOpen(false)}>Cancel</button>
          <button type="button" className="confirm" onClick={confirmLogout}>Yes, Logout</button>
        </div>
      </div>
    </div>
  );
}
