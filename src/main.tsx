import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/screens.css";
import { AppProviders } from "./app/providers";
import { App } from "./app/App";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Elemento #root não encontrado");

createRoot(rootEl).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
