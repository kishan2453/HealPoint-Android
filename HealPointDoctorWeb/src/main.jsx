import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./HealPointPremier.css";
import "./styles.css";
import "./UnifiedHealPoint.css";
import "./DesignSystem.css";
import "./DoctorPremier.css";
import "./HealPointSaaS.css";
import "./DoctorSaaSMaster.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
