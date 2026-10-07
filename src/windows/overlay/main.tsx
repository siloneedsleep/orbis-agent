import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { OverlayApp } from "./OverlayApp";
import "@/styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <OverlayApp />
  </StrictMode>,
);
