import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orderApi, restaurantApi, userApi } from "@/api/axios";
import { useLocationStore } from "@/store/useLocationStore";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { io } from "socket.io-client";
import { API_URL } from "@/lib/config";
import {
    ArrowLeft, ShoppingBag, CheckCircle, ChefHat, Bike,
    XCircle, Clock, MapPin, CreditCard, Package, RefreshCw,
    Navigation, Layers, Phone, MessageCircle,
} from "lucide-react";
import CustomerChatDrawer from "@/components/CustomerChatDrawer";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { playOrderPlacedSound } from "@/lib/notification-sound";

// Fix Leaflet default marker icons in bundlers
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

/* ─── Constants ─────────────────────────────────────────────────────────── */
const STATUS_STEPS = ["PLACED", "ACCEPTED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"];
const CANCEL_WINDOW_MS = 3 * 60 * 1000;

const STATUS_CONFIG: Record<string, {
    label: string; icon: any; color: string; bg: string;
    ringColor: string; emoji: string; desc: string;
}> = {
    PLACED: {
        label: "Order Placed", icon: ShoppingBag, emoji: "🛒",
        color: "text-blue-600", bg: "bg-blue-500", ringColor: "ring-blue-400",
        desc: "Your order has been received",
    },
    ACCEPTED: {
        label: "Accepted", icon: CheckCircle, emoji: "✅",
        color: "text-cyan-600", bg: "bg-cyan-500", ringColor: "ring-cyan-400",
        desc: "Restaurant accepted your order",
    },
    PREPARING: {
        label: "Preparing", icon: ChefHat, emoji: "👨‍🍳",
        color: "text-orange-600", bg: "bg-orange-500", ringColor: "ring-orange-400",
        desc: "Your food is being prepared",
    },
    OUT_FOR_DELIVERY: {
        label: "Out for Delivery", icon: Bike, emoji: "🛵",
        color: "text-purple-600", bg: "bg-purple-500", ringColor: "ring-purple-400",
        desc: "Your order is on the way!",
    },
    DELIVERED: {
        label: "Delivered", icon: CheckCircle, emoji: "🎉",
        color: "text-green-600", bg: "bg-green-500", ringColor: "ring-green-400",
        desc: "Enjoy your meal!",
    },
    CANCELLED: {
        label: "Cancelled", icon: XCircle, emoji: "❌",
        color: "text-red-600", bg: "bg-red-500", ringColor: "ring-red-400",
        desc: "Order was cancelled",
    },
};

const PAYMENT_CONFIG: Record<string, { color: string; bg: string }> = {
    PENDING: { color: "text-yellow-700", bg: "bg-yellow-100" },
    PAID: { color: "text-green-700", bg: "bg-green-100" },
    FAILED: { color: "text-red-700", bg: "bg-red-100" },
};

const formatDate = (d: string) => {
    try { return format(new Date(d), "dd MMM yyyy, hh:mm a"); } catch { return "—"; }
};

/* ─── Polyline decoder (for Valhalla encoded shape, precision 6) ─────────── */
function decodePolyline(encoded: string, precision = 6): [number, number][] {
    const factor = Math.pow(10, precision);
    const coords: [number, number][] = [];
    let index = 0, lat = 0, lng = 0;
    while (index < encoded.length) {
        let b, shift = 0, result = 0;
        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        lat += (result & 1) ? ~(result >> 1) : (result >> 1);
        shift = 0; result = 0;
        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        lng += (result & 1) ? ~(result >> 1) : (result >> 1);
        coords.push([lat / factor, lng / factor]);
    }
    return coords;
}

/* ─── Route Map Component ───────────────────────────────────────────────── */
interface RouteMapProps {
    userLat?: number;
    userLng?: number;
    restaurantLat?: number;
    restaurantLng?: number;
    orderStatus: string;
}

const RouteMap = ({ userLat, userLng, restaurantLat, restaurantLng, orderStatus }: RouteMapProps) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const leafletMapRef = useRef<L.Map | null>(null);
    const [routeDrawn, setRouteDrawn] = useState(false);
    const [distance, setDistance] = useState<string | null>(null);
    const [eta, setEta] = useState<string | null>(null);

    const isDelivered = orderStatus === "DELIVERED";
    const isCancelled = orderStatus === "CANCELLED";
    const isActive = !isDelivered && !isCancelled;

    useEffect(() => {
        if (!mapRef.current) return;
        if (leafletMapRef.current) {
            leafletMapRef.current.remove();
            leafletMapRef.current = null;
        }

        const hasRestaurant = restaurantLat != null && restaurantLng != null;
        const hasUser = userLat != null && userLng != null;

        // Center on restaurant if available, else user, else Kolkata
        const centerLat = hasRestaurant ? restaurantLat! : hasUser ? userLat! : 22.5726;
        const centerLng = hasRestaurant ? restaurantLng! : hasUser ? userLng! : 88.3639;

        const map = L.map(mapRef.current, {
            center: [centerLat, centerLng],
            zoom: hasUser && hasRestaurant ? 13 : 15,
            zoomControl: true,
            attributionControl: false,
        });

        // Always use CartoDB Voyager — clean, premium look like Zomato
        L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
            maxZoom: 19,
        }).addTo(map);

        // ── Restaurant marker (orange teardrop pin) ──────────────────────
        if (hasRestaurant) {
            const restaurantIcon = L.divIcon({
                html: `<div style="
          position:relative;
          width:44px;height:44px;
          border-radius:50% 50% 50% 0;
          background:linear-gradient(135deg,#f97316,#ea580c);
          transform:rotate(-45deg);
          box-shadow:0 6px 16px rgba(249,115,22,0.55);
          border:3px solid white;
          display:flex;align-items:center;justify-content:center;
        ">
          <span style="transform:rotate(45deg);font-size:18px;line-height:1;">🍽️</span>
        </div>`,
                className: "",
                iconSize: [44, 44],
                iconAnchor: [22, 44],
                popupAnchor: [0, -44],
            });
            L.marker([restaurantLat!, restaurantLng!], { icon: restaurantIcon })
                .addTo(map)
                .bindPopup("<b style='font-size:13px'>🍽️ Restaurant</b><br><span style='font-size:11px;color:#666'>Your food is being prepared here</span>");
        }

        // ── Delivery marker (green pin, pulsing ring for active orders) ──
        if (hasUser) {
            const pulseRing = isActive
                ? `<div style="
              position:absolute;top:-8px;left:-8px;
              width:60px;height:60px;
              border-radius:50%;
              background:rgba(34,197,94,0.25);
              animation:pulse-ring 1.8s ease-out infinite;
            "></div>
            <style>
              @keyframes pulse-ring {
                0%   { transform:scale(0.6); opacity:1; }
                100% { transform:scale(1.4); opacity:0; }
              }
            </style>`
                : "";

            const userIcon = L.divIcon({
                html: `<div style="position:relative;width:44px;height:44px;">
          ${pulseRing}
          <div style="
            position:relative;z-index:1;
            width:44px;height:44px;
            border-radius:50% 50% 50% 0;
            background:linear-gradient(135deg,#22c55e,#16a34a);
            transform:rotate(-45deg);
            box-shadow:0 6px 16px rgba(34,197,94,0.55);
            border:3px solid white;
            display:flex;align-items:center;justify-content:center;
          ">
            <span style="transform:rotate(45deg);font-size:18px;line-height:1;">🏠</span>
          </div>
        </div>`,
                className: "",
                iconSize: [44, 44],
                iconAnchor: [22, 44],
                popupAnchor: [0, -44],
            });
            L.marker([userLat!, userLng!], { icon: userIcon })
                .addTo(map)
                .bindPopup("<b style='font-size:13px'>🏠 Delivery Location</b><br><span style='font-size:11px;color:#666'>Your order arrives here</span>");
        }

        // ── Route line between restaurant and delivery address ───────────
        if (hasRestaurant && hasUser) {
            const drawRoute = (coords: [number, number][], distance: number, duration: number) => {
                L.polyline(coords, {
                    color: "#f97316",
                    weight: 5,
                    opacity: 0.95,
                    dashArray: "14, 8",
                    lineCap: "round",
                    lineJoin: "round",
                }).addTo(map);
                map.fitBounds(L.latLngBounds(coords), { padding: [55, 55] });
                setDistance(`${(distance / 1000).toFixed(1)} km`);
                setEta(`~${Math.ceil(duration / 60)} min`);
                setRouteDrawn(true);
            };

            const fetchRoute = async () => {
                // ── 1st choice: Valhalla (best routing, no API key needed) ──
                try {
                    const valhallaBody = JSON.stringify({
                        locations: [
                            { lon: restaurantLng, lat: restaurantLat },
                            { lon: userLng, lat: userLat },
                        ],
                        costing: "auto",
                        directions_options: { units: "km" },
                    });
                    const valhallaRes = await fetch("https://valhalla1.openstreetmap.de/route", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: valhallaBody,
                    });
                    if (valhallaRes.ok) {
                        const valhallaData = await valhallaRes.json();
                        const leg = valhallaData.trip?.legs?.[0];
                        if (leg?.shape) {
                            // Valhalla returns encoded polyline — decode it
                            const decoded = decodePolyline(leg.shape, 6);
                            const distM = valhallaData.trip.summary.length * 1000;
                            const durS = valhallaData.trip.summary.time;
                            drawRoute(decoded, distM, durS);
                            return;
                        }
                    }
                } catch { /* fall through */ }

                // ── 2nd choice: OSRM (reliable fallback) ─────────────────
                try {
                    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${restaurantLng},${restaurantLat};${userLng},${userLat}?overview=full&geometries=geojson&alternatives=false&steps=false`;
                    const osrmRes = await fetch(osrmUrl);
                    const osrmData = await osrmRes.json();
                    if (osrmData.routes?.[0]) {
                        const route = osrmData.routes[0];
                        const coords: [number, number][] = route.geometry.coordinates.map(
                            ([lng, lat]: [number, number]) => [lat, lng]
                        );
                        drawRoute(coords, route.distance, route.duration);
                        return;
                    }
                } catch { /* fall through */ }

                // ── 3rd choice: straight line (last resort) ───────────────
                const straightCoords: [number, number][] = [
                    [restaurantLat!, restaurantLng!],
                    [userLat!, userLng!],
                ];
                L.polyline(straightCoords, {
                    color: "#f97316",
                    weight: 4,
                    opacity: 0.75,
                    dashArray: "10, 6",
                }).addTo(map);
                map.fitBounds(L.latLngBounds(straightCoords), { padding: [55, 55] });
                setRouteDrawn(true);
            };
            fetchRoute();
        }

        leafletMapRef.current = map;
        setTimeout(() => map.invalidateSize(), 200);

        return () => {
            map.remove();
            leafletMapRef.current = null;
        };
    }, [userLat, userLng, restaurantLat, restaurantLng, isActive, isDelivered]);

    return (
        <div className="relative">
            {/* Map container */}
            <div
                ref={mapRef}
                className="w-full rounded-2xl overflow-hidden shadow-lg"
                style={{ height: 320 }}
            />


            {/* Legend (top-right) */}
            <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-1.5 rounded-xl bg-card/95 backdrop-blur-sm px-3 py-2 shadow-lg border border-border">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-foreground">
                    <span>🍽️</span> Restaurant
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-foreground">
                    <span>🏠</span> Your Location
                </div>
            </div>
        </div>
    );
};

/* ─── Status Stepper ────────────────────────────────────────────────────── */
const StatusStepper = ({ status, reason, refundStatus, refundProcessedAt }: { status: string; reason?: string; refundStatus?: string; refundProcessedAt?: string }) => {
    const isCancelled = status === "CANCELLED";
    const currentIdx = STATUS_STEPS.indexOf(status);

    if (isCancelled) {
        return (
            <div className="flex flex-col gap-3 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-4 relative z-0">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500 text-white text-lg">❌</div>
                    <div>
                        <p className="font-bold text-red-600">Order Cancelled</p>
                        <p className="text-xs text-red-500/80">This order has been cancelled</p>
                    </div>
                </div>
                {reason && (
                    <div className="rounded-xl bg-red-100/50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
                        <span className="font-semibold">Reason:</span> {reason}
                    </div>
                )}

                {/* Refund Status Timeline */}
                {refundStatus && refundStatus !== 'NO_REFUND' && (
                    <div className="mt-4 border-t border-red-200/50 dark:border-red-800/50 pt-6 relative">
                        {/* Vertical connection line */}
                        <div className="absolute left-[19px] top-[40px] h-[calc(100%-60px)] w-0.5 bg-border -z-10" />

                        <div className="space-y-6">
                            {/* Refund Initiated Step */}
                            <div className="flex items-start gap-4">
                                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-yellow-100 border-2 border-yellow-500 shadow-sm bg-card z-10">
                                    <CreditCard className="h-4.5 w-4.5 text-yellow-600" />
                                </div>
                                <div className="pt-2 pb-1">
                                    <p className="text-sm font-bold text-foreground">Refund Initiated</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">Your refund request is being processed.</p>
                                </div>
                            </div>

                            {/* Refund Processed Step */}
                            <div className={`flex items-start gap-4 ${refundStatus !== 'PROCESSED' ? 'opacity-50' : ''}`}>
                                <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 shadow-sm z-10 bg-card ${refundStatus === 'PROCESSED' ? 'border-green-500 bg-green-50' : 'border-border'}`}>
                                    <CheckCircle className={`h-4.5 w-4.5 ${refundStatus === 'PROCESSED' ? 'text-green-600' : 'text-muted-foreground'}`} />
                                </div>
                                <div className="pt-2">
                                    <p className="text-sm font-bold text-foreground">Refund Processed</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {refundStatus === 'PROCESSED'
                                            ? `Processed on ${formatDate(refundProcessedAt || new Date().toISOString())}. It may take 5-7 business days to reflect in your account.`
                                            : "Awaiting manual processor..."}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {STATUS_STEPS.map((step, idx) => {
                const cfg = STATUS_CONFIG[step];
                const Icon = cfg.icon;
                const isActive = idx <= currentIdx;
                const isCurrent = idx === currentIdx;

                return (
                    <motion.div
                        key={step}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.06 }}
                        className={`flex items-center gap-4 ${!isActive ? "opacity-40" : ""}`}
                    >
                        {/* Icon circle */}
                        <div className="relative flex-shrink-0">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-full text-white shadow-md transition-all ${isActive ? cfg.bg : "bg-muted"
                                } ${isCurrent ? `ring-4 ${cfg.ringColor}/30` : ""}`}>
                                <Icon className="h-4.5 w-4.5" style={{ height: "1.1rem", width: "1.1rem" }} />
                            </div>
                            {/* Connector line */}
                            {idx < STATUS_STEPS.length - 1 && (
                                <div className={`absolute left-1/2 top-10 h-6 w-0.5 -translate-x-1/2 rounded-full transition-colors ${idx < currentIdx ? cfg.bg : "bg-muted"
                                    }`} />
                            )}
                        </div>

                        {/* Label */}
                        <div className="flex-1 pb-5">
                            <div className="flex items-center gap-2">
                                <p className={`text-sm font-bold ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                                    {cfg.label}
                                </p>
                                {isCurrent && (
                                    <motion.span
                                        animate={{ scale: [1, 1.15, 1] }}
                                        transition={{ repeat: Infinity, duration: 1.5 }}
                                        className="text-base"
                                    >
                                        {cfg.emoji}
                                    </motion.span>
                                )}
                            </div>
                            {isCurrent && (
                                <p className="text-xs text-muted-foreground">{cfg.desc}</p>
                            )}
                        </div>
                    </motion.div>
                );
            })}
        </div>
    );
};

/* ─── Cancel Modal ──────────────────────────────────────────────────────── */
const CancelModal = ({
    isOpen, onClose, onConfirm, cancelling
}: { isOpen: boolean; onClose: () => void; onConfirm: (reason: string) => void; cancelling: boolean }) => {
    const [reason, setReason] = useState("");

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    if (!isOpen || !mounted) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="relative z-[2001] w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl border border-border"
                    >
                        <h3 className="text-lg font-bold text-foreground">Cancel Order?</h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Please tell us why you want to cancel this order. This helps us improve our service.
                        </p>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Reason for cancellation..."
                            className="mt-4 w-full rounded-xl border border-border bg-background p-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary min-h-[100px] resize-none"
                            autoFocus
                        />
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={onClose}
                                disabled={cancelling}
                                className="rounded-xl px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
                            >
                                Keep Order
                            </button>
                            <button
                                onClick={() => {
                                    if (!reason.trim()) {
                                        toast.error("Please provide a reason");
                                        return;
                                    }
                                    onConfirm(reason);
                                }}
                                disabled={cancelling || !reason.trim()}
                                className="flex items-center gap-2 rounded-xl bg-destructive px-4 py-2 text-sm font-bold text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
                            >
                                {cancelling ? <RefreshCw className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                                Cancel Order
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
};

/* ─── Cancel Button V2 (Trigger + Modal) ────────────────────────────────── */
const CancelButtonV2 = ({
    orderId, createdAt, onCancel, cancelling,
}: { orderId: string; createdAt: string; onCancel: (reason: string) => void; cancelling: boolean }) => {
    const [remaining, setRemaining] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);

    const update = useCallback(() => {
        const left = CANCEL_WINDOW_MS - (Date.now() - new Date(createdAt).getTime());
        if (left <= 0) { setRemaining(""); return; }
        const m = Math.floor(left / 60000);
        const s = Math.floor((left % 60000) / 1000);
        setRemaining(`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    }, [createdAt]);

    useEffect(() => {
        update();
        const t = setInterval(update, 1000);
        return () => clearInterval(t);
    }, [update]);

    if (!remaining) return null;

    return (
        <>
            <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setIsModalOpen(true)}
                disabled={cancelling}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-destructive/30 bg-destructive/5 py-4 text-sm font-bold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
            >
                <XCircle className="h-4 w-4" />
                Cancel Order
                <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-mono">
                    <Clock className="h-3 w-3" /> {remaining}
                </span>
            </motion.button>
            <CancelModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onConfirm={(reason) => {
                    onCancel(reason);
                    setIsModalOpen(false);
                }}
                cancelling={cancelling}
            />
        </>
    );
};

/* ─── Main Page ─────────────────────────────────────────────────────────── */
const OrderTracking = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { selectedAddress } = useLocationStore();

    // ── Real-time status via Socket.IO ───────────────────────────────────
    const [liveStatus, setLiveStatus] = useState<string | null>(null);
    const [livePrepTime, setLivePrepTime] = useState<number | null>(null);
    const [chatDrawerOpen, setChatDrawerOpen] = useState(false);

    useEffect(() => {
        if (!id) return;
        const socket = io(API_URL, { transports: ["websocket", "polling"] });
        socket.emit("joinOrder", id);
        socket.on("orderStatusUpdated", (data: { orderId: string; status: string }) => {
            if (data.status) {
                setLiveStatus(data.status.toUpperCase());
                queryClient.invalidateQueries({ queryKey: ["order-detail", id] });
            }
        });
        socket.on("preparationTimeUpdated", (data: { orderId: string; preparationTime: number }) => {
            if (data.preparationTime !== undefined) {
                setLivePrepTime(data.preparationTime);
                queryClient.invalidateQueries({ queryKey: ["order-detail", id] });
            }
        });
        socket.on("refundStatusUpdated", (data: { orderId: string; refundStatus: string }) => {
            if (data.refundStatus) {
                queryClient.invalidateQueries({ queryKey: ["order-detail", id] });
            }
        });
        return () => { socket.disconnect(); };
    }, [id]);

    // ──────────────────────────────────────────────────────────────────────

    const { data: order, isLoading, refetch } = useQuery({
        queryKey: ["order-detail", id],
        queryFn: () => orderApi.getOrderById(id!).then((r) => r.data?.order || r.data),
        enabled: !!id,
    });

    // Play success sound on mount if order is just placed
    useEffect(() => {
        if (order && (order.status === "PLACED" || order.orderStatus === "PLACED")) {
            // Check if order is recent (within 10 seconds) to avoid playing on refresh/revisit
            const isRecent = (Date.now() - new Date(order.createdAt).getTime()) < 10000;
            if (isRecent) {
                playOrderPlacedSound();
            }
        }
    }, [order]);

    const { data: restaurant } = useQuery({
        queryKey: ["restaurant"],
        queryFn: () => restaurantApi.get().then((r) => r.data),
    });

    // Fetch user's saved addresses as a fallback to get coordinates
    // when the backend doesn't return deliveryCoordinates on the order
    const { data: userAddresses } = useQuery({
        queryKey: ["user-addresses"],
        queryFn: () => userApi.getAddresses().then((r) => r.data?.addresses || r.data || []),
        enabled: !!order,
    });

    const cancelMutation = useMutation({
        mutationFn: ({ oid, reason }: { oid: string; reason: string }) => orderApi.cancelOrder(oid, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["my-orders"] });
            queryClient.invalidateQueries({ queryKey: ["order-detail", id] });
            toast.success("Order cancelled");
        },
        onError: (err: any) => toast.error(err.response?.data?.message || "Cannot cancel"),
    });

    if (isLoading) {
        return (
            <div className="mx-auto max-w-2xl px-4 py-8 space-y-4">
                <div className="h-8 w-32 animate-pulse rounded-xl bg-muted" />
                <div className="h-72 animate-pulse rounded-2xl bg-muted" />
                <div className="h-48 animate-pulse rounded-2xl bg-muted" />
                <div className="h-36 animate-pulse rounded-2xl bg-muted" />
            </div>
        );
    }

    if (!order) {
        return (
            <div className="mx-auto max-w-2xl px-4 py-16 text-center">
                <Package className="mx-auto h-16 w-16 text-muted-foreground/30" />
                <h2 className="mt-4 text-xl font-bold text-foreground">Order not found</h2>
                <button onClick={() => navigate("/my-orders")} className="mt-6 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground">
                    Back to Orders
                </button>
            </div>
        );
    }

    // Use liveStatus from socket if available, otherwise fall back to API data
    const status = (liveStatus || order?.status || order?.orderStatus || "PLACED").toUpperCase();
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PLACED;
    const StatusIcon = cfg.icon;
    const isActive = !["DELIVERED", "CANCELLED"].includes(status);
    const currentPrepTime = livePrepTime !== null ? livePrepTime : order?.preparationTime;

    // ── Coordinate resolution (multiple fallback layers) ──────────────
    // 1. Top-level deliveryCoordinates field on the order (best case)
    // 2. Populated deliveryAddress.coordinates (if backend populates it)
    // 3. deliveryAddress.lat/lng directly on the address object
    // 4. Look up the address from the user's saved addresses by ID (fallback)
    const deliveryAddrId =
        typeof order.deliveryAddress === "string"
            ? order.deliveryAddress
            : order.deliveryAddress?._id;

    const matchedSavedAddress = userAddresses?.find(
        (a: any) => a._id === deliveryAddrId
    );

    const deliveryCoords =
        order.deliveryCoordinates ||
        order.deliveryAddress?.coordinates ||
        (order.deliveryAddress?.lat != null
            ? { lat: order.deliveryAddress.lat, lng: order.deliveryAddress.lng }
            : null) ||
        matchedSavedAddress?.coordinates ||
        null;

    const userLat: number | undefined = deliveryCoords?.lat ?? deliveryCoords?.latitude;
    const userLng: number | undefined = deliveryCoords?.lng ?? deliveryCoords?.longitude;
    const restaurantLat: number | undefined = restaurant?.location?.lat;
    const restaurantLng: number | undefined = restaurant?.location?.lng;
    // Show map only for active orders (hide when DELIVERED or CANCELLED)
    const showMap = isActive && (!!(restaurantLat && restaurantLng) || !!(userLat && userLng));

    const canCancel = status === "PLACED" &&
        (Date.now() - new Date(order.createdAt).getTime()) < CANCEL_WINDOW_MS;

    const deliveryAddr = order.deliveryAddress;
    const deliveryText = typeof deliveryAddr === "object" && deliveryAddr
        ? [deliveryAddr.addressLine1, deliveryAddr.addressLine2, deliveryAddr.city, deliveryAddr.state, deliveryAddr.postalCode]
            .filter(Boolean).join(", ")
        : (order.address || deliveryAddr || "");

    return (
        <div className="mx-auto max-w-2xl px-4 py-6 pb-10">

            {/* Back nav */}
            <button
                onClick={() => navigate("/my-orders")}
                className="mb-5 flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
                <ArrowLeft className="h-4 w-4" /> My Orders
            </button>

            {/* ── Hero Status Banner ─────────────────────────────────────── */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`relative mb-5 overflow-hidden rounded-2xl p-5 text-white shadow-xl ${cfg.bg}`}
            >
                {/* Background pattern */}
                <div className="pointer-events-none absolute inset-0 opacity-10"
                    style={{ backgroundImage: "radial-gradient(circle at 80% 50%, white 1px, transparent 1px)", backgroundSize: "24px 24px" }}
                />
                <div className="relative flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <motion.span
                                animate={isActive ? { scale: [1, 1.2, 1] } : {}}
                                transition={{ repeat: Infinity, duration: 1.5 }}
                                className="text-2xl"
                            >
                                {cfg.emoji}
                            </motion.span>
                            <h1 className="text-xl font-extrabold tracking-tight">{cfg.label}</h1>
                        </div>
                        <p className="text-sm text-white/80">{cfg.desc}</p>
                        {status === "PREPARING" && currentPrepTime > 0 && (
                            <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1 text-sm font-bold text-white shadow-sm backdrop-blur">
                                <Clock className="h-4 w-4" />
                                <span>Takes {currentPrepTime} mins</span>
                            </div>
                        )}
                        <p className="mt-2 text-xs text-white/60 font-mono">
                            {order.customId || `#${order._id?.slice(-6).toUpperCase()}`} · {formatDate(order.createdAt)}
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
                            <StatusIcon className="h-7 w-7 text-white" />
                        </div>
                        {isActive && (
                            <button
                                onClick={() => refetch()}
                                className="flex items-center gap-1 rounded-lg bg-white/20 px-2 py-1 text-[10px] font-bold text-white hover:bg-white/30 transition-colors"
                            >
                                <RefreshCw className="h-3 w-3" /> Refresh
                            </button>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* ── Map — always show when we have location data ────────── */}
            {showMap && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="mb-5 rounded-2xl border border-border bg-card p-4 shadow-sm"
                >
                    <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Layers className="h-4 w-4 text-primary" />
                            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                                {isActive ? "Live Tracking" : "Delivery Route"}
                            </h2>
                        </div>
                        {isActive && userLat && userLng && (
                            <span className="flex items-center gap-1.5 rounded-full bg-green-100 dark:bg-green-900/30 px-2.5 py-1 text-[10px] font-bold text-green-700 dark:text-green-400">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                </span>
                                LIVE
                            </span>
                        )}
                    </div>
                    <RouteMap
                        userLat={userLat}
                        userLng={userLng}
                        restaurantLat={restaurantLat}
                        restaurantLng={restaurantLng}
                        orderStatus={status}
                    />
                    {!userLat && (
                        <p className="mt-2 text-center text-xs text-muted-foreground">
                            📍 No GPS coordinates found for this order's delivery address
                        </p>
                    )}
                </motion.div>
            )}

            {/* ── Restaurant Contact Card ───────────────────────────────── */}
            {restaurant?.mobile && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12 }}
                    className="mb-5 rounded-2xl border border-border bg-card p-4 shadow-sm"
                >
                    <div className="flex items-center justify-between gap-4">
                        {/* Logo + Name */}
                        <div className="flex items-center gap-3">
                            {restaurant.logo ? (
                                <img
                                    src={restaurant.logo}
                                    alt={restaurant.name}
                                    className="h-11 w-11 rounded-xl object-cover border border-border shadow-sm flex-shrink-0"
                                />
                            ) : (
                                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
                                    <Package className="h-5 w-5 text-primary" />
                                </div>
                            )}
                            <div>
                                <p className="text-sm font-bold text-foreground leading-tight">{restaurant.name}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">Need help with your order?</p>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {/* Call */}
                            <a
                                href={`tel:${restaurant.mobile.replace(/\s/g, "")}`}
                                className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-colors"
                                title="Call Restaurant"
                            >
                                <Phone className="h-4 w-4" />
                            </a>
                            {/* In-app Chat */}
                            <button
                                onClick={() => setChatDrawerOpen(true)}
                                className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors"
                                title="Chat with Restaurant"
                            >
                                <MessageCircle className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* ── Status Stepper ────────────────────────────────────────── */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="mb-5 rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
                <div className="mb-4 flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary" />
                    <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Order Progress</h2>
                </div>
                <StatusStepper status={status} reason={order.cancellationReason} refundStatus={order.refundStatus} refundProcessedAt={order.refundProcessedAt} />
            </motion.div>

            {/* ── Order Items ───────────────────────────────────────────── */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mb-5 rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
                <div className="mb-4 flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4 text-primary" />
                    <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                        Items · {order.items?.length || 0}
                    </h2>
                </div>
                <div className="space-y-3">
                    {(order.items || []).map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-3">
                            {item.image && (
                                <img
                                    src={item.image}
                                    alt={item.name}
                                    className="h-12 w-12 rounded-xl object-cover flex-shrink-0"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                />
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate">
                                    {item.name || item.product?.name || item.menuItem?.name || "Item"}
                                </p>
                                {item.variant && <p className="text-xs text-muted-foreground">{item.variant}</p>}
                                <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                            </div>
                            <p className="text-sm font-bold text-foreground flex-shrink-0">
                                ₹{Number((item.price || 0) * item.quantity).toFixed(2)}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Bill summary */}
                <div className="mt-4 space-y-1.5 rounded-xl bg-muted/50 p-4 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                        <span>Subtotal</span>
                        <span>₹{Number(order.totalAmount || 0).toFixed(2)}</span>
                    </div>
                    {order.deliveryFee > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                            <span>Delivery Fee</span>
                            <span>₹{order.deliveryFee}</span>
                        </div>
                    )}
                    {(order.taxAmount > 0 || order.cgstTotal > 0 || order.sgstTotal > 0 || order.igstTotal > 0) && (
                        <div className="flex flex-col gap-1 text-muted-foreground">
                            <div className="flex justify-between">
                                <span>Tax</span>
                                <span>₹{order.taxAmount || ((order.cgstTotal || 0) + (order.sgstTotal || 0) + (order.igstTotal || 0))}</span>
                            </div>
                            {(order.cgstTotal > 0 || order.sgstTotal > 0) && (
                                <div className="ml-2 flex flex-col gap-0.5 text-xs text-muted-foreground/80 border-l-2 border-border pl-2">
                                    {order.cgstTotal > 0 && (
                                        <div className="flex justify-between">
                                            <span>CGST</span>
                                            <span>₹{order.cgstTotal}</span>
                                        </div>
                                    )}
                                    {order.sgstTotal > 0 && (
                                        <div className="flex justify-between">
                                            <span>SGST</span>
                                            <span>₹{order.sgstTotal}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                            {order.igstTotal > 0 && (
                                <div className="ml-2 text-xs text-muted-foreground/80 border-l-2 border-border pl-2 flex justify-between">
                                    <span>IGST</span>
                                    <span>₹{order.igstTotal}</span>
                                </div>
                            )}
                        </div>
                    )}
                    {order.discountApplied > 0 && (
                        <div className="flex justify-between text-green-600 font-medium">
                            <span>Discount</span>
                            <span>-₹{order.discountApplied}</span>
                        </div>
                    )}
                    <div className="flex justify-between border-t border-border pt-2 text-base font-extrabold text-foreground">
                        <span>Total Paid</span>
                        <span>₹{Number(order.finalAmount || order.totalAmount || 0).toFixed(2)}</span>
                    </div>
                </div>
            </motion.div>

            {/* ── Delivery Info ─────────────────────────────────────────── */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="mb-5 rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4"
            >
                <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-primary" />
                    <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Payment & Delivery</h2>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">Payment</span>
                    <span className="text-sm font-semibold text-foreground">{order.paymentMethod || "—"}</span>
                    {order.paymentStatus && (
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${(PAYMENT_CONFIG[order.paymentStatus?.toUpperCase()] || PAYMENT_CONFIG.PENDING).bg
                            } ${(PAYMENT_CONFIG[order.paymentStatus?.toUpperCase()] || PAYMENT_CONFIG.PENDING).color}`}>
                            {order.paymentStatus}
                        </span>
                    )}
                </div>

                {deliveryText && (
                    <div className="flex items-start gap-3">
                        <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                        <p className="text-sm text-foreground leading-snug">{deliveryText}</p>
                    </div>
                )}
            </motion.div>

            {/* ── Cancel ────────────────────────────────────────────────── */}
            {canCancel && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <CancelButtonV2
                        orderId={order._id}
                        createdAt={order.createdAt}
                        onCancel={(reason) => cancelMutation.mutate({ oid: order._id, reason })}
                        cancelling={cancelMutation.isPending}
                    />
                </motion.div>
            )}

            {/* ── Customer Chat Drawer ─────────────────────────────────── */}
            <AnimatePresence>
                {chatDrawerOpen && (
                    <CustomerChatDrawer
                        key="customer-chat"
                        isOpen={chatDrawerOpen}
                        onClose={() => setChatDrawerOpen(false)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default OrderTracking;
