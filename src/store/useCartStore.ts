import { create } from "zustand";
import { cartApi } from "@/api/axios";
import { toast } from "sonner";

export interface CartItem {
  _id: string;
  itemId: string; // server-side item reference for PUT/DELETE
  name: string;
  price: number;
  image: string;
  quantity: number;
  variant?: string;
  type?: "Veg" | "Non-Veg";
  category?: string;
}

interface AppliedCoupon {
  code: string;
  discountAmount: number;
  minOrderValue?: number;
}

interface ServerCart {
  items: CartItem[];
  totalPrice: number;
  discountAmount: number;
  finalPrice: number;
  deliveryFee: number;
  tax: number;
  appliedCoupon: AppliedCoupon | null;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  isLoading: boolean;
  totalPrice: number;
  discountAmount: number;
  finalPrice: number;
  deliveryFee: number;
  tax: number;
  taxBreakdown?: {
    cgstTotal: number;
    sgstTotal: number;
    igstTotal: number;
  };
  appliedCoupon: AppliedCoupon | null;
  deliveryLocation: { lat: number; lng: number } | null;

  fetchCart: (location?: { lat: number; lng: number }) => Promise<void>;
  addItem: (product: { _id: string; name: string; price: number; image: string; variant?: string; type?: "Veg" | "Non-Veg"; category?: string }) => Promise<void>;
  incrementItem: (itemId: string) => Promise<void>;
  decrementItem: (itemId: string) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: () => Promise<void>;
  toggleCart: () => void;
  getItemCount: () => number;
}

const emptyCart: Omit<CartState, "isOpen" | "isLoading" | "fetchCart" | "addItem" | "incrementItem" | "decrementItem" | "removeItem" | "clearCart" | "applyCoupon" | "removeCoupon" | "toggleCart" | "getItemCount"> = {
  items: [],
  totalPrice: 0,
  discountAmount: 0,
  finalPrice: 0,
  deliveryFee: 0,
  tax: 0,
  taxBreakdown: { cgstTotal: 0, sgstTotal: 0, igstTotal: 0 },
  appliedCoupon: null,
  deliveryLocation: null,
};

/** Compute total from local items (used for optimistic price updates) */
const calcTotal = (items: CartItem[]) =>
  items.reduce((sum, i) => sum + i.price * i.quantity, 0);

/** Helper for unified optimistic calculation of prices */
const getOptimisticPrices = (nextItems: CartItem[], state: CartState) => {
  const optimisticTotal = calcTotal(nextItems);

  // Calculate effective tax rate from previous state, fallback to 4% (standard GST combo)
  const effectiveTaxRate = state.totalPrice > 0 ? (state.tax / state.totalPrice) : 0.04;
  const optimisticTax = optimisticTotal > 0 ? (optimisticTotal * effectiveTaxRate) : 0;

  const optimisticDelivery = optimisticTotal > 0 ? state.deliveryFee : 0;
  const optimisticDiscount = Math.min(state.discountAmount, optimisticTotal);

  return {
    totalPrice: optimisticTotal,
    tax: optimisticTax,
    deliveryFee: optimisticDelivery,
    discountAmount: optimisticDiscount,
    finalPrice: optimisticTotal + optimisticTax + optimisticDelivery - optimisticDiscount
  };
};

export const useCartStore = create<CartState>()((set, get) => ({
  ...emptyCart,
  isOpen: false,
  isLoading: false,

  fetchCart: async (location?: { lat: number; lng: number }) => {
    // If a new location is provided, save it. Otherwise, use what we have in state.
    console.log("[useCartStore] fetchCart called with location:", location);
    const activeLocation = location || get().deliveryLocation;
    console.log("[useCartStore] activeLocation resolved to:", activeLocation);

    set({ isLoading: true, ...(location ? { deliveryLocation: location } : {}) });
    try {
      const res = await cartApi.get();
      const data = res.data;
      const formattedItems: CartItem[] = (data.items || []).map((item: any) => {
        const product = item.product || {};
        let currentPrice = item.price; // Default to stored price

        // Recalculate based on product data if available (fixes stale/incorrect backend cart prices)
        if (product && product._id) {
          let base = product.price;
          // If variant exists, try to find its price
          if (item.variant && Array.isArray(product.variants)) {
            const v = product.variants.find((v: any) => v.name === item.variant);
            if (v) base = v.price;
          }

          // Apply discount if applicable
          if (base && product.discountPercentage > 0) {
            const isExpired = product.discountExpiresAt && new Date(product.discountExpiresAt) < new Date();
            if (!isExpired) {
              currentPrice = Math.round(base * (1 - product.discountPercentage / 100));
            } else {
              currentPrice = base;
            }
          } else if (base) {
            currentPrice = base; // No discount, ensure we match current product price
          }
        }

        return {
          _id: product._id || item._id,
          itemId: item._id, // This is the cart-item ID for PUT/DELETE
          name: item.name || product.name || "Unknown",
          price: currentPrice,
          image: item.imageURL || product.imageURL || "/placeholder.svg",
          quantity: item.quantity,
          variant: item.variant,
          type: item.type || product.type,
          category: product.category,
        };
      });
      // Fetch bill details from dedicated bill API
      let bill: any = { itemsTotal: 0, shipping: 0, discount: 0, finalTotal: 0, appliedCoupon: null };
      try {
        console.log(`[useCartStore] Calling cartApi.getBill(${activeLocation?.lat}, ${activeLocation?.lng})`);
        const billRes = await cartApi.getBill(activeLocation?.lat, activeLocation?.lng);
        bill = billRes.data;
        console.log("[useCartStore] getBill returned:", bill);
      } catch (err) {
        console.error("[useCartStore] getBill failed:", err);
        // Fallback to cart data if bill endpoint fails
      }

      // Re-calculate totals locally if bill API is also returning stale data (optional but safer)
      const localTotal = calcTotal(formattedItems);
      // We prefer local calculation for itemsTotal to ensure consistency with the displayed prices

      set({
        items: formattedItems,
        totalPrice: localTotal, // Use local total to match the recalculated prices
        discountAmount: bill.discount || 0,
        finalPrice: bill.finalAmount || bill.finalTotal || (localTotal + (bill.taxAmount || bill.totalTax || 0) + (bill.shipping || 0) - (bill.discount || 0)),
        deliveryFee: bill.shipping || 0,
        tax: bill.taxAmount || bill.totalTax || 0,
        taxBreakdown: bill.taxBreakdown || { cgstTotal: 0, sgstTotal: 0, igstTotal: 0 },
        appliedCoupon: bill.appliedCoupon || data.appliedCoupon || null,
      });
    } catch (error) {
      console.error("[useCartStore] Error fetching cart:", error);
      // Fallback empty state on critical fetch failure so UI doesn't freeze with ghost items
      set({ ...emptyCart });
    } finally {
      set({ isLoading: false });
    }
  },

  addItem: async (product) => {
    const prev = get().items;
    
    // Check if there is already an optimistic item for this product that hasn't synced yet (empty itemId)
    const existingSyncing = prev.find((i) => i._id === product._id && i.variant === product.variant && !i.itemId);
    if (existingSyncing) {
        toast.info("Item is being added, please wait...");
        return;
    }

    // Optimistic: add locally with instant price update
    const existing = prev.find((i) => i._id === product._id && i.variant === product.variant);
    let nextItems: CartItem[];
    if (existing) {
      nextItems = prev.map((i) =>
        i._id === product._id && i.variant === product.variant
          ? { ...i, quantity: i.quantity + 1, price: Number(product.price) || 0 } // Update price in case it changed
          : i
      );
    } else {
      nextItems = [...prev, { ...product, price: Number(product.price) || 0, itemId: "", quantity: 1 }];
    }
    const optimisticPrices = getOptimisticPrices(nextItems, get());
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;

    // Auto-open cart on desktop when adding items
    const newState: Partial<CartState> = { items: nextItems, ...optimisticPrices };
    if (isDesktop) newState.isOpen = true;

    set(newState);

    try {
      await cartApi.add({ productId: product._id, quantity: 1 });
      await get().fetchCart();
    } catch (err: any) {
      set({ items: prev, totalPrice: calcTotal(prev), finalPrice: calcTotal(prev) }); // Revert
      toast.error(err.response?.data?.message || "Failed to add item");
    }
  },

  incrementItem: async (itemId) => {
    const prev = get().items;
    const item = prev.find((i) => i.itemId === itemId);
    if (!item) return;
    
    // Prevent updating if the item is still syncing from an add
    if (!item.itemId) {
        toast.info("Please wait a moment for the item to sync...");
        return;
    }

    // Optimistic with instant price
    const nextItems = prev.map((i) => (i.itemId === itemId ? { ...i, quantity: i.quantity + 1 } : i));
    const optimisticPrices = getOptimisticPrices(nextItems, get());
    set({ items: nextItems, ...optimisticPrices });

    try {
      await cartApi.updateQty(itemId, { quantity: item.quantity + 1 });
      await get().fetchCart();
    } catch (err: any) {
      set({ items: prev, totalPrice: calcTotal(prev), finalPrice: calcTotal(prev) });
      toast.error(err.response?.data?.message || "Update failed");
    }
  },

  decrementItem: async (itemId) => {
    const prev = get().items;
    const item = prev.find((i) => i.itemId === itemId);
    if (!item) return;

    // Prevent updating if the item is still syncing from an add
    if (!item.itemId) {
        toast.info("Please wait a moment for the item to sync...");
        return;
    }

    if (item.quantity <= 1) {
      return get().removeItem(itemId);
    }

    // Optimistic with instant price
    const nextItems = prev.map((i) => (i.itemId === itemId ? { ...i, quantity: i.quantity - 1 } : i));
    const optimisticPrices = getOptimisticPrices(nextItems, get());
    set({ items: nextItems, ...optimisticPrices });

    try {
      await cartApi.updateQty(itemId, { quantity: item.quantity - 1 });
      await get().fetchCart();
    } catch (err: any) {
      set({ items: prev, totalPrice: calcTotal(prev), finalPrice: calcTotal(prev) });
      toast.error(err.response?.data?.message || "Update failed");
    }
  },

  removeItem: async (itemId) => {
    if (!itemId) {
        toast.info("Item is still syncing, please wait...");
        return;
    }

    const prev = get().items;
    const nextItems = prev.filter((i) => i.itemId !== itemId);
    const optimisticPrices = getOptimisticPrices(nextItems, get());
    set({ items: nextItems, ...optimisticPrices });

    try {
      await cartApi.removeItem(itemId);
      await get().fetchCart();
    } catch (err: any) {
      set({ items: prev });
      toast.error(err.response?.data?.message || "Remove failed");
    }
  },

  clearCart: async () => {
    const prev = { items: get().items, ...emptyCart };
    set({ ...emptyCart });

    try {
      await cartApi.clear();
    } catch (err: any) {
      set(prev);
      toast.error("Failed to clear cart");
    }
  },

  applyCoupon: async (code) => {
    try {
      await cartApi.applyCoupon({ code });
      await get().fetchCart();
      const coupon = get().appliedCoupon;
      toast.success(`Saved ₹${coupon?.discountAmount?.toFixed(0) || ""}! 🎉`);
    } catch (err: any) {
      const message: string = err.response?.data?.message || "";
      const minMatch = message.match(/(\d+)/);
      if (minMatch) {
        const deficit = parseInt(minMatch[1]) - get().totalPrice;
        if (deficit > 0) {
          toast.warning(`Add ₹${deficit.toFixed(0)} more to use this coupon!`, { duration: 4000 });
          throw err; // Re-throw so UI can trigger shake
        }
      }
      toast.error(message || "Could not apply coupon");
      throw err;
    }
  },

  removeCoupon: async () => {
    try {
      await cartApi.removeCoupon();
      await get().fetchCart();
      toast.success("Coupon removed");
    } catch {
      toast.error("Failed to remove coupon");
    }
  },



  toggleCart: () => set((s) => ({ isOpen: !s.isOpen })),
  getItemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
}));
