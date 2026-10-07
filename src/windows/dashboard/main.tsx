import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { DashboardApp } from "./DashboardApp";
import "@/styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DashboardApp />
  </StrictMode>,
);
