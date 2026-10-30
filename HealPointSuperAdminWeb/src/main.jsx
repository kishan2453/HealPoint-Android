import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./AdminFinal.css";
import "./PremiumDesign.css";
import "./UnifiedHealPoint.css";
import "./PremiumAuth.css";
import "./PremiumWorkspace.css";
import "./DesignSystem.css";
import "./HealPointPremier.css";
import "./AdminPremium.css";
import "./SuperAdminPro.css";
import "./HealPointSaaS.css";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import store from "./redux/store.js";
import ErrorBoundary from "./components/common/ErrorBoundary.jsx";

createRoot(document.getElementById("root")).render(
  <Provider store={store}>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </Provider>,
);
