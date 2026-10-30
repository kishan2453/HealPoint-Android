import { useEffect, useRef, useState } from "react";
import { FaPowerOff } from "react-icons/fa";

export default function LogoutConfirmation() {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const cancelRef = useRef(null);

  useEffect(() => {
    const handler = (event) => {
      const button = event.target.closest(".dp-logout, .doctor-logout");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setOpen(true);
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => cancelRef.current?.focus(), 80);
    const onKey = (event) => {
      if (event.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const requestClose = () => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      setOpen(false);
    }, 240);
  };

  const confirmLogout = () => {
    try {
      sessionStorage.clear();
      localStorage.removeItem("doctorApp");
      localStorage.removeItem("doctorToken");
      localStorage.removeItem("selectedHospital");
    } catch {
      // ignore
    }
    window.location.href = "/login";
  };

  if (!open) return null;

  return (
    <div
      className="portal-logout-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <div
        className={`portal-logout-dialog${closing ? " hp-closing" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hp-logout-title"
        aria-describedby="hp-logout-desc"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="portal-logout-icon">
          <FaPowerOff />
        </div>
        <h3 id="hp-logout-title">Sign out of HealPoint?</h3>
        <p id="hp-logout-desc">
          Your Doctor Portal session will be closed and you'll return to the
          login page.
        </p>
        <div className="portal-logout-actions">
          <button type="button" ref={cancelRef} onClick={requestClose}>
            Cancel
          </button>
          <button type="button" className="confirm" onClick={confirmLogout}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
