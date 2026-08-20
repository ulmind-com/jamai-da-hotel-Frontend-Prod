import { io } from "socket.io-client";
import { API_URL } from "@/lib/config";

const SOCKET_URL = API_URL;

// Allow polling first, then upgrade to websocket. A websocket-only transport
// silently fails to connect behind some hosts (e.g. Render), which breaks
// real-time order updates. Polling handshake is reliable and upgrades cleanly.
export const socket = io(SOCKET_URL, {
  transports: ["polling", "websocket"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  autoConnect: true,
});

if (typeof window !== "undefined") {
  socket.on("connect", () => console.log("[socket] connected:", socket.id));
  socket.on("connect_error", (err) => console.warn("[socket] connect_error:", err?.message));
  socket.on("disconnect", (reason) => console.warn("[socket] disconnected:", reason));
}
