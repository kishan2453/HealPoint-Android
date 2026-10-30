import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "react-toastify/dist/ReactToastify.css";
import "./styles.css";
import "./DesignSystem.css";
import "./HospitalPremier.css";
import "./HealPointSaaS.css";
import App from "./App";
createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
