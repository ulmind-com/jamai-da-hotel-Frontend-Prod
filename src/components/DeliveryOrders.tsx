import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { deliveryApi } from "@/api/axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bike, Phone, MapPin, Check, Package, Banknote, Clock, RefreshCw, X,
} from "lucide-react";
import { toast } from "sonner";

type Order = {
  _id: string;
  customId?: string;
  orderStatus: string;
  paymentMethod: string;
  finalAmount: number;
  createdAt: string;
  customerName?: string;
  customerMobile?: string;
  customer?: { name?: string; mobile?: string };
  deliveryAddress?: {
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    mobile?: string;
  };
  deliveryCoordinates?: { lat?: number; lng?: number };
  items?: { quantity: number; product?: { name?: string } }[];
  deliveredBy?: { name?: string };
};

const money = (n: number) => `₹${(n || 0).toFixed(2)}`;

const customerName = (o: Order) => o.customer?.name || o.customerName || "Customer";

const customerPhone = (o: Order) =>
  o.deliveryAddress?.mobile || o.customer?.mobile || o.customerMobile || "";

const addressText = (o: Order) => {
  const a = o.deliveryAddress;
  if (!a) return "";
  return [a.addressLine1, a.addressLine2, a.city, a.state, a.postalCode]
    .filter(Boolean)
    .join(", ");
};

const mapsUrl = (o: Order) => {
  const { lat, lng } = o.deliveryCoordinates || {};
  const query = lat && lng ? `${lat},${lng}` : addressText(o);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
};

// How long the order has been waiting — the number a rider actually cares about.
const waitingFor = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
};

const STATUS_STYLES: Record<string, string> = {
  ACCEPTED: "bg-blue-100 text-blue-700",
  PREPARING: "bg-amber-100 text-amber-700",
  OUT_FOR_DELIVERY: "bg-purple-100 text-purple-700",
  DELIVERED: "bg-green-100 text-green-700",
};

const STATUS_LABELS: Record<string, string> = {
  ACCEPTED: "Accepted",
  PREPARING: "Preparing",
  OUT_FOR_DELIVERY: "On the way",
  DELIVERED: "Delivered",
};

export default function DeliveryOrders() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<"ACTIVE" | "DONE">("ACTIVE");
  const [confirming, setConfirming] = useState<Order | null>(null);

  const active = useQuery<Order[]>({
    queryKey: ["delivery-orders"],
    queryFn: () => deliveryApi.getActiveOrders().then((r) => r.data),
    refetchInterval: 30000, // new orders should surface without a manual refresh
  });

  const done = useQuery<Order[]>({
    queryKey: ["delivery-orders", "done"],
    queryFn: () => deliveryApi.getCompletedToday().then((r) => r.data),
    enabled: view === "DONE",
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status, codCollected }: { id: string; status: string; codCollected?: boolean }) =>
      deliveryApi.updateStatus(id, { status, codCollected }),
    onSuccess: (_res, vars) => {
      toast.success(vars.status === "DELIVERED" ? "Marked delivered ✅" : "Marked out for delivery 🛵");
      setConfirming(null);
      queryClient.invalidateQueries({ queryKey: ["delivery-orders"] });
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.message || "Could not update the order"),
  });

  const orders = view === "ACTIVE" ? active.data || [] : done.data || [];
  const isLoading = view === "ACTIVE" ? active.isLoading : done.isLoading;

  // COD needs the rider to confirm the cash, so it goes through a prompt first.
  const handleDeliver = (order: Order) => {
    if (order.paymentMethod === "COD") setConfirming(order);
    else updateStatus.mutate({ id: order._id, status: "DELIVERED" });
  };

  return (
    <div className="mx-auto w-full max-w-2xl pb-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <Bike className="h-6 w-6 text-primary" />
          My Deliveries
        </h2>
        <button
          onClick={() => {
            active.refetch();
            if (view === "DONE") done.refetch();
          }}
          className="rounded-lg border border-border p-2 hover:bg-muted"
          title="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${active.isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="mb-4 flex rounded-xl bg-muted p-1">
        {(["ACTIVE", "DONE"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 rounded-lg py-2 text-sm font-bold transition-all ${
              view === v ? "bg-background text-foreground shadow" : "text-muted-foreground"
            }`}
          >
            {v === "ACTIVE" ? `To Deliver${active.data?.length ? ` (${active.data.length})` : ""}` : "Done Today"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl border border-border bg-card" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-12 text-center text-muted-foreground">
          <Package className="mb-4 h-14 w-14 opacity-20" />
          <p className="font-medium">
            {view === "ACTIVE" ? "Nothing to deliver right now." : "No deliveries completed today yet."}
          </p>
          {view === "ACTIVE" && (
            <p className="mt-1 text-sm">New orders show up here automatically.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const phone = customerPhone(order);
            const address = addressText(order);
            const isCod = order.paymentMethod === "COD";
            const onTheWay = order.orderStatus === "OUT_FOR_DELIVERY";
            const isDone = order.orderStatus === "DELIVERED";

            return (
              <div
                key={order._id}
                className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{order.customId || order._id.slice(-6).toUpperCase()}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_STYLES[order.orderStatus] || "bg-muted"}`}>
                      {STATUS_LABELS[order.orderStatus] || order.orderStatus}
                    </span>
                  </div>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {waitingFor(order.createdAt)}
                  </span>
                </div>

                <div className="space-y-3 p-4">
                  <div>
                    <p className="font-bold">{customerName(order)}</p>
                    {address && (
                      <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{address}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="font-bold text-primary">{money(order.finalAmount)}</span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-bold ${
                        isCod ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"
                      }`}
                    >
                      {isCod ? `COLLECT ${money(order.finalAmount)}` : `${order.paymentMethod} · PAID`}
                    </span>
                    <span className="text-muted-foreground">
                      {order.items?.reduce((n, i) => n + i.quantity, 0) || 0} items
                    </span>
                  </div>

                  {order.items && order.items.length > 0 && (
                    <p className="text-xs leading-snug text-muted-foreground">
                      {order.items.map((i) => `${i.quantity}× ${i.product?.name || "Item"}`).join(", ")}
                    </p>
                  )}

                  {isDone && order.deliveredBy?.name && (
                    <p className="text-xs text-muted-foreground">
                      Delivered by {order.deliveredBy.name}
                    </p>
                  )}

                  {!isDone && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <a
                        href={phone ? `tel:${phone}` : undefined}
                        onClick={(e) => { if (!phone) { e.preventDefault(); toast.error("No phone number on this order"); } }}
                        className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background py-3 text-sm font-bold hover:bg-muted"
                      >
                        <Phone className="h-4 w-4" /> Call
                      </a>
                      <a
                        href={mapsUrl(order)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background py-3 text-sm font-bold hover:bg-muted"
                      >
                        <MapPin className="h-4 w-4" /> Map
                      </a>

                      {!onTheWay && (
                        <button
                          onClick={() => updateStatus.mutate({ id: order._id, status: "OUT_FOR_DELIVERY" })}
                          disabled={updateStatus.isPending}
                          className="col-span-2 flex items-center justify-center gap-2 rounded-xl border-2 border-primary bg-background py-3 font-bold text-primary hover:bg-primary/5 disabled:opacity-50"
                        >
                          <Bike className="h-5 w-5" /> Picked up — on the way
                        </button>
                      )}

                      <button
                        onClick={() => handleDeliver(order)}
                        disabled={updateStatus.isPending}
                        className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50"
                      >
                        <Check className="h-5 w-5" /> Mark Delivered
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* COD cash confirmation */}
      <AnimatePresence>
        {confirming && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
            onClick={() => setConfirming(null)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-2xl"
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Banknote className="h-6 w-6 text-orange-600" />
                  <h3 className="text-lg font-bold">Cash on delivery</h3>
                </div>
                <button onClick={() => setConfirming(null)} className="text-muted-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="mb-1 text-sm text-muted-foreground">
                Order {confirming.customId} · {customerName(confirming)}
              </p>
              <p className="mb-5 text-3xl font-black">{money(confirming.finalAmount)}</p>

              <button
                onClick={() => updateStatus.mutate({ id: confirming._id, status: "DELIVERED", codCollected: true })}
                disabled={updateStatus.isPending}
                className="mb-2 w-full rounded-xl bg-primary py-3.5 font-bold text-primary-foreground disabled:opacity-50"
              >
                {updateStatus.isPending ? "Saving…" : "Cash collected — deliver"}
              </button>
              <button
                onClick={() => updateStatus.mutate({ id: confirming._id, status: "DELIVERED", codCollected: false })}
                disabled={updateStatus.isPending}
                className="w-full rounded-xl border border-border py-2.5 text-sm font-bold text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                Delivered without collecting
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
