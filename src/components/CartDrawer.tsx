import { useEffect, useState } from "react";
import { useCartStore } from "@/store/useCartStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useRestaurantStore } from "@/store/useRestaurantStore";
import { restaurantApi } from "@/api/axios";
import { Minus, Plus, Trash2, Truck, PartyPopper, Loader2, X, ShoppingBag } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import TicketCoupon from "./TicketCoupon";

/** True when viewport is desktop-sized (≥ 768px) */
const useIsDesktop = () => {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 768);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isDesktop;
};

const FREE_DELIVERY_THRESHOLD = 500;

const CartDrawer = () => {
  const {
    items, isOpen, isLoading, toggleCart, incrementItem, decrementItem,
    clearCart, totalPrice, discountAmount, finalPrice, deliveryFee, tax,
    appliedCoupon,
  } = useCartStore();
  const { isAuthenticated, openAuthModal } = useAuthStore();
  const { restaurant, setRestaurant, setLoading } = useRestaurantStore();
  const isRestaurantClosed = restaurant && !restaurant.isOpen;
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();

  useEffect(() => {
    if (isOpen) {
      restaurantApi.get().then((res) => setRestaurant(res.data)).catch(() => setLoading(false));
    }
  }, [isOpen, setRestaurant, setLoading]);

  // Auto-close when cart becomes empty (e.g. after clearing)
  useEffect(() => {
    if (isOpen && items.length === 0) {
      const timer = setTimeout(() => toggleCart(), 300);
      return () => clearTimeout(timer);
    }
  }, [items.length, isOpen]);

  const freeDeliveryProgress = Math.min((totalPrice / FREE_DELIVERY_THRESHOLD) * 100, 100);
  const freeDeliveryUnlocked = totalPrice >= FREE_DELIVERY_THRESHOLD;
  const remaining = FREE_DELIVERY_THRESHOLD - totalPrice;

  const handleProceed = () => {
    if (!isAuthenticated()) { openAuthModal("login"); return; }
    toggleCart();
    navigate("/checkout");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="cart-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={toggleCart}
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
          />

          {/* Desktop: Right Side Sheet | Mobile: Bottom Sheet */}
          <motion.div
            key="cart-sheet"
            initial={isDesktop ? { x: "100%" } : { y: "100%" }}
            animate={isDesktop ? { x: 0 } : { y: 0 }}
            exit={isDesktop ? { x: "100%" } : { y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className={
              isDesktop
                ? "fixed right-0 top-0 bottom-0 z-[70] flex w-96 flex-col bg-card shadow-2xl border-l border-border"
                : "fixed bottom-0 left-0 right-0 z-[70] flex max-h-[92dvh] flex-col rounded-t-3xl bg-card shadow-2xl"
            }
          >
            {/* Drag handle — mobile only */}
            {!isDesktop && (
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="h-1 w-12 rounded-full bg-muted-foreground/30" />
              </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-extrabold tracking-tight text-foreground">My Order</h2>
                {items.length > 0 && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                    {items.length} {items.length === 1 ? "item" : "items"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {items.length > 0 && (
                  <button
                    onClick={() => { clearCart(); toast.success("Cart cleared"); }}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Clear
                  </button>
                )}
                <button
                  onClick={toggleCart}
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent transition-colors"
                >
                  <X className="h-4 w-4 text-foreground" />
                </button>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {!isAuthenticated() ? (
                <div className="flex flex-col items-center justify-center gap-4 py-16 text-muted-foreground">
                  <ShoppingCartEmpty />
                  <p className="text-sm font-semibold">Please login to manage your cart</p>
                  <button
                    onClick={() => openAuthModal("login")}
                    className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-transform hover:scale-105"
                  >
                    Login
                  </button>
                </div>
              ) : isLoading && items.length === 0 ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                  <ShoppingCartEmpty />
                  <p className="text-sm font-semibold">Your cart is empty</p>
                  <p className="text-xs">Add items from the menu to get started</p>
                </div>
              ) : (
                <div className="space-y-0">
                  {/* Delivery calculated at checkout instead */}

                  {/* Items */}
                  <div className="space-y-2 px-5 py-4">
                    <AnimatePresence>
                      {items.map((item) => (
                        <motion.div
                          key={item.itemId || `${item._id}-${item.variant}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                          transition={{ duration: 0.2 }}
                          className="flex items-center gap-3 rounded-2xl border border-border bg-background p-3"
                        >
                          <img src={item.image} alt={item.name} className="h-14 w-14 rounded-xl object-cover flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              {item.type === "Veg" ? (
                                <div className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border-[1.5px] border-green-600">
                                  <div className="h-1.5 w-1.5 rounded-full bg-green-600" />
                                </div>
                              ) : (
                                <div className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border-[1.5px] border-red-500">
                                  <div className="h-0 w-0 border-x-[3px] border-b-[5px] border-x-transparent border-b-red-500" />
                                </div>
                              )}
                              <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
                            </div>
                            {item.variant && <p className="text-[10px] text-muted-foreground">{item.variant}</p>}
                            <p className="text-sm font-bold text-foreground">₹{item.price * item.quantity}</p>
                          </div>
                          {/* Qty stepper */}
                          <div className="flex items-center gap-1 rounded-xl border-2 border-primary bg-primary/5 px-1 py-0.5">
                            <button
                              onClick={() => decrementItem(item.itemId)}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="min-w-[22px] text-center text-sm font-black text-primary">{item.quantity}</span>
                            <button
                              onClick={() => incrementItem(item.itemId)}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  {/* Coupon */}
                  <div className="px-5 pb-2">
                    <TicketCoupon />
                  </div>

                  {/* Bill Details */}
                  <div className="mx-5 mb-4 space-y-2 rounded-2xl border border-border bg-accent/30 p-4 text-sm">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Bill Details</p>
                    <div className="flex justify-between text-foreground">
                      <span>Item Total</span>
                      <span className="font-semibold">₹{totalPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Delivery Fee</span>
                      <span className="text-xs italic text-muted-foreground/70">Calculated at Checkout</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>GST & Taxes</span>
                      <span>₹{tax.toFixed(2)}</span>
                    </div>
                    {discountAmount > 0 && appliedCoupon && (
                      <div className="flex justify-between font-medium text-green-600">
                        <span>Coupon ({appliedCoupon.code})</span>
                        <span>-₹{discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="border-t border-border pt-2">
                      <div className="flex justify-between text-base font-extrabold text-foreground">
                        <span>To Pay</span>
                        <span>₹{(finalPrice - deliveryFee).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sticky CTA at bottom of sheet */}
            {items.length > 0 && (
              <div className="flex-shrink-0 border-t border-border bg-card px-5 pb-8 pt-4 space-y-2">
                {isRestaurantClosed && (
                  <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-2.5 text-center text-sm font-semibold text-destructive">
                    We're currently offline. Please check back later.
                  </div>
                )}
                <motion.button
                  whileTap={isRestaurantClosed ? {} : { scale: 0.97 }}
                  onClick={handleProceed}
                  disabled={!!isRestaurantClosed}
                  className="w-full rounded-2xl bg-primary py-4 text-base font-extrabold text-primary-foreground shadow-lg transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isRestaurantClosed ? "RESTAURANT CLOSED" : `CHECKOUT — ₹${(finalPrice - deliveryFee).toFixed(2)}`}
                </motion.button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const ShoppingCartEmpty = () => (
  <svg width="100" height="100" viewBox="0 0 24 24" fill="none" className="text-muted-foreground/30">
    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="currentColor" strokeWidth="1.5" />
    <line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="1.5" />
    <path d="M16 10a4 4 0 01-8 0" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

export default CartDrawer;
