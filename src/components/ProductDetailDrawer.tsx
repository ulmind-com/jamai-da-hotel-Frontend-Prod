import { useEffect, useState } from "react";
import { menuApi } from "@/api/axios";
import { useCartStore } from "@/store/useCartStore";
import { useAuthStore } from "@/store/useAuthStore";
import { resolveImageURL } from "@/lib/image-utils";
import { Loader2, Plus, Minus, X, ShoppingCart, Zap, Tag } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface ProductDetailDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    productId: string;
    initialData?: any;
}

export function ProductDetailDrawer({
    isOpen,
    onClose,
    productId,
    initialData,
}: ProductDetailDrawerProps) {
    const [product, setProduct] = useState<any>(initialData || null);
    const [loading, setLoading] = useState(false);
    const [localQty, setLocalQty] = useState(1);

    const { items, addItem, incrementItem, decrementItem, toggleCart } = useCartStore();
    const { isAuthenticated, openAuthModal } = useAuthStore();

    const cartItem = items.find((i) => i._id === productId);

    // Sync localQty with cart when drawer opens
    useEffect(() => {
        if (isOpen) {
            setLocalQty(cartItem ? cartItem.quantity : 1);
        }
    }, [isOpen, productId]);

    useEffect(() => {
        if (isOpen && productId) {
            setLoading(true);
            menuApi
                .getProductById(productId)
                .then((res) => {
                    setProduct(res.data);
                })
                .catch((err) => {
                    console.error("Failed to fetch product details", err);
                    toast.error("Failed to load product details");
                })
                .finally(() => setLoading(false));
        }
    }, [isOpen, productId]);

    const handleAddToCart = async () => {
        if (!isAuthenticated()) {
            onClose();
            openAuthModal("login");
            return;
        }
        if (!product) return;

        const imageUrl = resolveImageURL(product.image || product.imageURL);

        onClose();
        toggleCart(); // Open cart sidebar immediately

        if (cartItem) {
            const diff = localQty - cartItem.quantity;
            if (diff > 0) {
                for (let i = 0; i < diff; i++) await incrementItem(cartItem.itemId);
            } else if (diff < 0) {
                for (let i = 0; i < Math.abs(diff); i++) await decrementItem(cartItem.itemId);
            }
        } else {
            await addItem({
                _id: product._id,
                name: product.name,
                price: Number(displayPrice),
                image: imageUrl,
                type: product.type,
                category: typeof product.category === 'object' ? product.category._id : product.category,
            });
            if (localQty > 1) {
                setTimeout(async () => {
                    const updatedCart = useCartStore.getState().items;
                    const newItem = updatedCart.find((i) => i._id === product._id);
                    if (newItem) {
                        for (let i = 1; i < localQty; i++) {
                            await incrementItem(newItem.itemId);
                        }
                    }
                }, 500);
            }
        }
    };

    if (!isOpen) return null;

    const displayPrice = product?.price || product?.variants?.[0]?.price || 0;
    const imageUrl = resolveImageURL(product?.image || product?.imageURL);
    const totalPrice = displayPrice * localQty;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        key="backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Full-screen panel */}
                    <motion.div
                        key="panel"
                        initial={{ opacity: 0, scale: 0.96, y: "100%" }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: "100%" }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex h-fit max-h-[90vh] w-full flex-col bg-background sm:top-1/2 sm:-translate-y-1/2 sm:bottom-auto sm:w-[480px] sm:rounded-2xl shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="absolute right-4 top-4 z-50 flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50"
                        >
                            <X className="h-5 w-5" />
                        </button>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto">
                            {loading && !product ? (
                                <div className="flex h-full items-center justify-center">
                                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                                </div>
                            ) : product ? (
                                <>
                                    {/* Hero Image — takes up top half */}
                                    <div className="relative h-[45vh] w-full sm:h-[300px]">
                                        <img
                                            src={imageUrl}
                                            alt={product.name}
                                            className="h-full w-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />

                                        {/* Discount Badge on Image */}
                                        {product.hasDiscount && (
                                            <motion.div
                                                initial={{ x: -60 }}
                                                animate={{ x: 0 }}
                                                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                                className="absolute top-4 left-0 flex items-center gap-1.5 rounded-r-full bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 pl-3 pr-4 py-2 shadow-xl"
                                            >
                                                <Zap className="h-4 w-4 text-white" fill="white" />
                                                <span className="text-sm font-black text-white tracking-wide">
                                                    {product.discountPercentage}% OFF
                                                </span>
                                            </motion.div>
                                        )}
                                    </div>

                                    {/* Details */}
                                    <div className="px-6 pb-6 pt-3">
                                        {/* Veg / Non-Veg + Category */}
                                        <div className="mb-3 flex items-center gap-2">
                                            {product.type === "Veg" ? (
                                                <div className="flex h-5 w-5 items-center justify-center rounded-sm border-2 border-swiggy-success">
                                                    <div className="h-2.5 w-2.5 rounded-full bg-swiggy-success" />
                                                </div>
                                            ) : (
                                                <div className="flex h-5 w-5 items-center justify-center rounded-sm border-2 border-swiggy-danger">
                                                    <div className="h-0 w-0 border-x-[5px] border-b-[8px] border-x-transparent border-b-swiggy-danger" />
                                                </div>
                                            )}
                                            {product.category && (
                                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                                    {typeof product.category === "object" ? product.category.name : product.category}
                                                </span>
                                            )}
                                        </div>

                                        {/* Name */}
                                        <h2 className="text-3xl font-extrabold leading-tight text-foreground">
                                            {product.name}
                                        </h2>

                                        {/* Price */}
                                        <div className="mt-2 flex items-center gap-3">
                                            {product.hasDiscount && product.originalPrice ? (
                                                <>
                                                    <span className="relative text-lg font-semibold text-muted-foreground">
                                                        ₹{product.originalPrice}
                                                        <span className="absolute left-0 right-0 top-1/2 h-[2px] bg-red-500 -rotate-[8deg]" />
                                                    </span>
                                                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                                                        ₹{displayPrice}
                                                    </p>
                                                </>
                                            ) : (
                                                <p className="text-2xl font-bold text-primary">
                                                    ₹{displayPrice}
                                                </p>
                                            )}
                                        </div>

                                        {/* Savings Banner */}
                                        {product.hasDiscount && product.originalPrice && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.2 }}
                                                className="mt-3 flex items-center gap-2 rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-2.5"
                                            >
                                                <span className="text-lg">🎉</span>
                                                <div>
                                                    <p className="text-sm font-bold text-green-600 dark:text-green-400">
                                                        You save ₹{(product.originalPrice - displayPrice).toFixed(0)} on this item!
                                                    </p>
                                                    <p className="text-[11px] text-green-600/70 dark:text-green-400/60">
                                                        Great deal — limited time offer
                                                    </p>
                                                </div>
                                            </motion.div>
                                        )}

                                        <div className="my-5 h-px w-full bg-border" />

                                        {/* Description */}
                                        <p className="text-base leading-relaxed text-muted-foreground">
                                            {product.description || "No description available for this delicious item."}
                                        </p>
                                    </div>
                                </>
                            ) : null}
                        </div>

                        {/* Sticky Footer */}
                        {product && (
                            <div className="border-t border-border bg-background px-6 py-4 pb-safe">
                                <div className="flex items-center gap-4">
                                    {/* Quantity Selector */}
                                    <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-2 py-1 shadow-sm">
                                        <button
                                            onClick={() => setLocalQty((q) => Math.max(1, q - 1))}
                                            className="flex h-8 w-8 items-center justify-center rounded-lg text-swiggy-danger transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-90"
                                        >
                                            <Minus className="h-4 w-4" />
                                        </button>
                                        <span className="w-5 text-center text-base font-bold text-foreground">
                                            {localQty}
                                        </span>
                                        <button
                                            onClick={() => setLocalQty((q) => q + 1)}
                                            className="flex h-8 w-8 items-center justify-center rounded-lg text-swiggy-success transition-colors hover:bg-green-50 dark:hover:bg-green-900/20 active:scale-90"
                                        >
                                            <Plus className="h-4 w-4" />
                                        </button>
                                    </div>

                                    {/* Add to Cart Button */}
                                    <button
                                        onClick={handleAddToCart}
                                        className="flex flex-1 items-center justify-between rounded-xl bg-primary px-4 py-2.5 text-primary-foreground shadow-lg transition-transform active:scale-95 hover:opacity-90"
                                    >
                                        <div className="flex items-center gap-2">
                                            <ShoppingCart className="h-4 w-4" />
                                            <span className="text-sm font-bold">Add to Cart</span>
                                        </div>
                                        <span className="text-sm font-bold">₹{totalPrice}</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
