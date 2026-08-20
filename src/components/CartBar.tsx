import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, ChevronRight } from "lucide-react";
import { useCartStore } from "@/store/useCartStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useLocation } from "react-router-dom";

/**
 * Swiggy/Zomato-style sticky bottom cart bar.
 * Appears when cart has items. Hidden on checkout & admin pages.
 */
const CartBar = () => {
    const { items, totalPrice, finalPrice, deliveryFee, toggleCart, isOpen } = useCartStore();
    const { isAuthenticated } = useAuthStore();
    const location = useLocation();

    const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);

    // Hide on checkout, admin, orders, addresses pages, and profile
    const hiddenRoutes = ["/checkout", "/admin", "/my-orders", "/orders", "/addresses", "/profile"];
    const shouldHide =
        !isAuthenticated() ||
        items.length === 0 ||
        isOpen ||
        hiddenRoutes.some((r) => location.pathname.startsWith(r));

    return (
        <div className="md:hidden">
            <AnimatePresence>
                {!shouldHide && (
                    <motion.div
                        key="cart-bar"
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        transition={{ type: "spring", damping: 25, stiffness: 280 }}
                        className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 w-[calc(100%-2rem)] max-w-lg px-0"
                    >
                        <button
                            onClick={toggleCart}
                            className="group flex w-full items-center justify-between rounded-2xl bg-primary px-5 py-4 shadow-2xl shadow-primary/40 transition-all hover:brightness-105 active:scale-[0.98]"
                        >
                            {/* Left — item count badge + label */}
                            <div className="flex items-center gap-3">
                                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                                    <ShoppingBag className="h-5 w-5 text-primary-foreground" />
                                    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-black text-primary shadow">
                                        {totalItems > 9 ? "9+" : totalItems}
                                    </span>
                                </div>
                                <div className="text-left">
                                    <p className="text-xs font-semibold text-primary-foreground/80 leading-none">
                                        {totalItems} {totalItems === 1 ? "item" : "items"}
                                    </p>
                                    <p className="text-base font-black text-primary-foreground leading-tight">
                                        ₹{(finalPrice - deliveryFee).toFixed(0)}
                                    </p>
                                </div>
                            </div>

                            {/* Right — View Cart */}
                            <div className="flex items-center gap-1 rounded-xl bg-white/20 px-4 py-2">
                                <span className="text-sm font-extrabold text-primary-foreground">View Cart</span>
                                <ChevronRight className="h-4 w-4 text-primary-foreground transition-transform group-hover:translate-x-0.5" />
                            </div>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CartBar;
