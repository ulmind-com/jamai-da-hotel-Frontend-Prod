// ── Central backend URL config ──────────────────────────────────────────────
// Set VITE_API_URL in your .env / hosting env to your backend's base URL
// (NO trailing slash, NO "/api" suffix). Example:
//   VITE_API_URL=https://haldia-cloud-kitchen-backend-prod.onrender.com
//
// The fallback below is only used when VITE_API_URL is not set.
export const API_URL: string =
  import.meta.env.VITE_API_URL || "https://food-delivery-backend-173b.onrender.com";
