import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orderApi, reviewApi } from "@/api/axios";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Package, ChevronRight, ArrowLeft, Clock, MapPin, ChefHat, Bike, CheckCircle, XCircle, ShoppingBag, MessageSquare } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";

import { format } from "date-fns";

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: any; label: string }> = {
  PLACED: { color: "text-blue-600", bg: "bg-blue-100", icon: ShoppingBag, label: "Order Placed" },
  ACCEPTED: { color: "text-cyan-600", bg: "bg-cyan-100", icon: CheckCircle, label: "Accepted" },
  PREPARING: { color: "text-orange-600", bg: "bg-orange-100", icon: ChefHat, label: "Preparing" },
  OUT_FOR_DELIVERY: { color: "text-purple-600", bg: "bg-purple-100", icon: Bike, label: "Out for Delivery" },
  DELIVERED: { color: "text-green-600", bg: "bg-green-100", icon: CheckCircle, label: "Delivered" },
  CANCELLED: { color: "text-destructive", bg: "bg-red-100", icon: XCircle, label: "Cancelled" },
};

const PAYMENT_STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  PENDING: { color: "text-yellow-700", bg: "bg-yellow-100" },
  PAID: { color: "text-green-700", bg: "bg-green-100" },
  FAILED: { color: "text-red-700", bg: "bg-red-100" },
};

const STATUS_STEPS = ["PLACED", "ACCEPTED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"];
const CANCEL_WINDOW_MS = 3 * 60 * 1000;

const formatOrderDate = (dateStr: string) => {
  try {
    return format(new Date(dateStr), "dd MMM, hh:mm a");
  } catch {
    return "—";
  }
};

const getItemsSummary = (items: any[]) => {
  if (!items?.length) return "No items";
  const names = items.map((i: any) => `${i.name || i.product?.name || i.menuItem?.name || "Item"} × ${i.quantity}`);
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
};

import ReviewModal from "@/components/ReviewModal";

const MyOrders = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  /* ─── Reviews Data ─── */
  const { data: myReviews } = useQuery({
    queryKey: ["my-reviews"],
    queryFn: () => reviewApi.getMyReviews().then((r) => r.data),
  });

  // Create a lookup map: orderId -> review
  const reviewsMap = (myReviews || []).reduce((acc: any, review: any) => {
    // Handle both populated order object and string ID
    const orderId = typeof review.order === "object" ? review.order?._id : review.order;
    if (orderId) acc[orderId] = review;
    return acc;
  }, {});

  const [reviewOrderId, setReviewOrderId] = useState<string | null>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["my-orders"],
    queryFn: () => orderApi.getMyOrders().then((r) => r.data?.orders || r.data || []),
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: 30000,
  });


  const cancelMutation = useMutation({
    mutationFn: (id: string) => orderApi.cancelOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-orders"] });
      queryClient.invalidateQueries({ queryKey: ["order-detail"] });
      toast.success("Order cancelled");
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Cannot cancel order"),
  });

  const sortedOrders = [...orders].sort((a: any, b: any) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <button onClick={() => navigate("/")} className="mb-6 flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <h1 className="mb-6 text-2xl font-extrabold text-foreground">My Orders</h1>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      ) : sortedOrders.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <Package className="mx-auto h-12 w-12 text-muted-foreground/30" />
          <h3 className="mt-4 text-lg font-bold text-foreground">No orders yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">Your order history will appear here</p>
          <button onClick={() => navigate("/")} className="mt-6 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground">
            Browse Menu
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {sortedOrders.map((order: any) => {
              const status = (order.status || order.orderStatus || "PLACED").toUpperCase();
              const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PLACED;
              const StatusIcon = cfg.icon;
              return (
                <motion.div
                  key={order._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="cursor-pointer rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-accent/30"
                  onClick={() => navigate(`/orders/${order._id}`)}
                >
                  {/* Header: customId + Date */}
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-foreground">{order.customId || `#${order._id?.slice(-6).toUpperCase()}`}</p>
                    <span className="text-xs text-muted-foreground">{formatOrderDate(order.createdAt)}</span>
                  </div>

                  {/* Body: Items preview */}
                  <p className="mt-1.5 text-xs text-muted-foreground line-clamp-1">{getItemsSummary(order.items)}</p>

                  {/* Footer: Status + Total */}
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cfg.bg} ${cfg.color}`}>
                        <StatusIcon className="h-3 w-3" />
                        {cfg.label}
                      </span>
                      {status === "DELIVERED" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setReviewOrderId(order._id);
                          }}
                          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all hover:scale-105 active:scale-95 ${reviewsMap[order._id]
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-primary text-primary-foreground shadow-sm hover:shadow-md"
                            }`}
                        >
                          {reviewsMap[order._id] ? (
                            <>
                              <span className="text-[10px]">★</span>
                              {reviewsMap[order._id].rating}
                              <span className="ml-1 hidden sm:inline">Rated</span>
                            </>
                          ) : (
                            <>
                              <MessageSquare className="h-3 w-3" />
                              Rate
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {status === "DELIVERED" && (
                        <div className="w-8" /> // Spacer or just remove entirely if layout permits
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">₹{Number(order.finalAmount || order.totalAmount || 0).toFixed(2)}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Review Modal */}
      <ReviewModal
        isOpen={!!reviewOrderId}
        onClose={() => setReviewOrderId(null)}
        orderId={reviewOrderId!}
        initialData={reviewOrderId ? reviewsMap[reviewOrderId] : null}
      />
    </div>
  );
};

/* ─── Order Detail ─── */

const OrderDetail = ({ order, onCancel, cancelling }: { order: any; onCancel: (id: string) => void; cancelling: boolean }) => {
  const status = (order.status || order.orderStatus || "PLACED").toUpperCase();
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PLACED;
  const canCancel = status === "PLACED" && (Date.now() - new Date(order.createdAt).getTime()) < CANCEL_WINDOW_MS;

  return (
    <div className="space-y-5">
      {/* Status + Date */}
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${cfg.bg} ${cfg.color}`}>
          {cfg.label}
        </span>
        <span className="text-xs text-muted-foreground">{formatOrderDate(order.createdAt)}</span>
      </div>

      {/* Timeline Stepper */}
      {status === "CANCELLED" ? (
        <div className="flex items-center gap-3">
          <div className="flex flex-1 flex-col items-center gap-1">
            <div className="h-2 w-full rounded-full bg-muted" />
            <ShoppingBag className="h-3 w-3 text-muted-foreground" />
            <span className="text-[8px] font-bold text-muted-foreground">PLACED</span>
          </div>
          <div className="flex flex-1 flex-col items-center gap-1">
            <div className="h-2 w-full rounded-full bg-destructive" />
            <XCircle className="h-3 w-3 text-destructive" />
            <span className="text-[8px] font-bold text-destructive">CANCELLED</span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          {STATUS_STEPS.map((step, idx) => {
            const currentIdx = STATUS_STEPS.indexOf(status);
            const isActive = idx <= currentIdx;
            const stepCfg = STATUS_CONFIG[step];
            const StepIcon = stepCfg.icon;
            return (
              <div key={step} className="flex flex-1 flex-col items-center gap-1">
                <div className={`h-2 w-full rounded-full transition-colors ${isActive ? "bg-primary" : "bg-muted"}`} />
                <StepIcon className={`h-3 w-3 ${isActive ? "text-primary" : "text-muted-foreground/40"}`} />
                <span className={`text-[8px] font-bold leading-tight text-center ${isActive ? "text-primary" : "text-muted-foreground/50"}`}>
                  {step.replace(/_/g, " ")}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Items */}
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Items</p>
        <div className="space-y-2">
          {(order.items || []).map((item: any, idx: number) => (
            <div key={idx} className="flex justify-between text-sm">
              <span className="text-foreground">{item.name || item.product?.name || item.menuItem?.name || "Item"} × {item.quantity}</span>
              <span className="font-semibold">₹{Number((item.price || 0) * item.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bill */}
      <div className="space-y-1 rounded-xl bg-muted/50 p-4 text-sm">
        <div className="flex justify-between"><span>Subtotal</span><span>₹{Number(order.totalAmount || 0).toFixed(2)}</span></div>
        {order.discountApplied > 0 && (
          <div className="flex justify-between text-green-600"><span>Discount</span><span>-₹{order.discountApplied}</span></div>
        )}
        <div className="flex justify-between border-t border-border pt-1 font-bold">
          <span>Total Paid</span><span>₹{Number(order.finalAmount || order.totalAmount || 0).toFixed(2)}</span>
        </div>
      </div>

      {/* Payment Info */}
      <div className="flex items-center gap-3 text-sm">
        <span className="text-muted-foreground">Payment:</span>
        <span className="font-medium">{order.paymentMethod || "—"}</span>
        {order.paymentStatus && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${(PAYMENT_STATUS_CONFIG[order.paymentStatus?.toUpperCase()] || PAYMENT_STATUS_CONFIG.PENDING).bg} ${(PAYMENT_STATUS_CONFIG[order.paymentStatus?.toUpperCase()] || PAYMENT_STATUS_CONFIG.PENDING).color}`}>
            {order.paymentStatus}
          </span>
        )}
      </div>

      {/* Address */}
      {(order.address || order.deliveryAddress) && (
        <div className="flex items-start gap-2 text-sm">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span className="text-foreground">
            {typeof order.deliveryAddress === "object" && order.deliveryAddress
              ? [order.deliveryAddress.addressLine1 || order.deliveryAddress.houseNo, order.deliveryAddress.addressLine2 || order.deliveryAddress.street, order.deliveryAddress.city, order.deliveryAddress.state, order.deliveryAddress.postalCode || order.deliveryAddress.zip].filter(Boolean).join(", ")
              : (order.address || order.deliveryAddress)}
          </span>
        </div>
      )}

      {/* Cancel */}
      {canCancel && (
        <CancelButton orderId={order._id} createdAt={order.createdAt} onCancel={onCancel} cancelling={cancelling} />
      )}
    </div>
  );
};

/* ─── Cancel with countdown ─── */

const CancelButton = ({ orderId, createdAt, onCancel, cancelling }: { orderId: string; createdAt: string; onCancel: (id: string) => void; cancelling: boolean }) => {
  const [remaining, setRemaining] = useState("");

  const updateTimer = useCallback(() => {
    const elapsed = Date.now() - new Date(createdAt).getTime();
    const left = CANCEL_WINDOW_MS - elapsed;
    if (left <= 0) { setRemaining(""); return; }
    const mins = Math.floor(left / 60000);
    const secs = Math.floor((left % 60000) / 1000);
    setRemaining(`${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`);
  }, [createdAt]);

  useEffect(() => {
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [updateTimer]);

  if (!remaining) return null;

  return (
    <button
      onClick={() => onCancel(orderId)}
      disabled={cancelling}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 py-3 text-sm font-bold text-destructive hover:bg-destructive/10"
    >
      <XCircle className="h-4 w-4" />
      Cancel Order
      <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs">
        <Clock className="h-3 w-3" /> {remaining}
      </span>
    </button>
  );
};

export default MyOrders;
