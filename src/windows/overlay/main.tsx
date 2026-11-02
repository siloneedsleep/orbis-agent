import { initializeOrbis } from '@/state/orbisBridge';
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { OverlayApp } from "./OverlayApp";
import "@/styles/globals.css";

initializeOrbis().then(() => ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <OverlayApp />
  </StrictMode>,
))
.catch(error => { const root = document.getElementById('root')!; root.style.cssText = 'padding:32px;color:#fca5a5;background:#09090b'; root.textContent = `Không khởi tạo được Orbis: ${String(error)}`; });
