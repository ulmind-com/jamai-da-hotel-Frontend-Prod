import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// In development, aggressively unregister any cached service workers.
// VitePWA with autoUpdate can cause continuous page reloads in dev when
// Vite HMR fires, even after disabling the plugin, because the old SW
// is still cached in the browser.
if (import.meta.env.DEV) {
    navigator.serviceWorker
        ?.getRegistrations()
        .then((registrations) => {
            registrations.forEach((r) => r.unregister());
        })
        .catch(() => { });
}

createRoot(document.getElementById("root")!).render(<App />);
