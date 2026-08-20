import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCartStore } from "@/store/useCartStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useRestaurantStore } from "@/store/useRestaurantStore";
import { useLocationStore } from "@/store/useLocationStore";
import { orderApi, restaurantApi, menuApi, cartApi } from "@/api/axios";
import { useRazorpay } from "@/hooks/useRazorpay";
import AddressManager from "@/components/AddressManager";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { CreditCard, Banknote, ArrowLeft, Loader2, MapPin, Home, Briefcase, Minus, Plus, FileText, UtensilsCrossed } from "lucide-react";
import TicketCoupon from "@/components/TicketCoupon";

type PaymentMethod = "ONLINE" | "COD";

const CheckoutPage = () => {
  const navigate = useNavigate();
  const { items, totalPrice, discountAmount, finalPrice, deliveryFee, tax, taxBreakdown, appliedCoupon, clearCart, incrementItem, decrementItem, isLoading: isCartLoading } = useCartStore();
  const { user } = useAuthStore();
  const { restaurant, setRestaurant, setLoading } = useRestaurantStore();
  const { selectedAddress: storedAddress } = useLocationStore();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("ONLINE");
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [selectedAddressObj, setSelectedAddressObj] = useState<any>(null);
  const [selectedAddressText, setSelectedAddressText] = useState("");
  const [deliveryInstruction, setDeliveryInstruction] = useState("");
  const [noCutlery, setNoCutlery] = useState(false);
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [isSelectingAddress, setIsSelectingAddress] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const { payNow, loading: paymentLoading } = useRazorpay();
  const [recommendedProducts, setRecommendedProducts] = useState<any[]>([]);
  const { addItem, fetchCart } = useCartStore();

  const isRestaurantClosed = restaurant && !restaurant.isOpen;

  let isCodDisabled = false;
  let codDisableReason = "";

  if (user?.isCodDisabled) {
    isCodDisabled = true;
    codDisableReason = "Disabled for your account";
  } else if (restaurant && restaurant.isCodEnabled === false) {
    isCodDisabled = true;
    codDisableReason = "Currently disabled by restaurant";
  } else if (restaurant?.codStartTime && restaurant?.codEndTime) {
    const now = new Date();
    const istTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const currentHhMm = String(istTime.getHours()).padStart(2, '0') + ':' + String(istTime.getMinutes()).padStart(2, '0');

    const start = restaurant.codStartTime;
    const end = restaurant.codEndTime;

    if (start < end) {
      if (currentHhMm >= start && currentHhMm <= end) {
        isCodDisabled = true;
        codDisableReason = `Not available between ${start} and ${end}`;
      }
    } else if (start > end) {
      if (currentHhMm >= start || currentHhMm <= end) {
        isCodDisabled = true;
        codDisableReason = `Not available between ${start} and ${end}`;
      }
    }
  }

  // Initialize Cart & Sync Address ON MOUNT ONLY
  useEffect(() => {
    // 1. If we have a stored preference, load it!
    if (storedAddress && !selectedAddressId) {
      const full = [
        storedAddress.addressLine1,
        storedAddress.addressLine2,
        storedAddress.city,
        storedAddress.state,
        storedAddress.postalCode,
      ].filter(Boolean).join(", ");

      setSelectedAddressId(storedAddress._id);
      setSelectedAddressObj(storedAddress);
      setSelectedAddressText(full);

      // Fetch cart precisely WITH coordinates to calculate delivery fee instantly
      if (storedAddress.coordinates?.lat && storedAddress.coordinates?.lng) {
        fetchCart({ lat: storedAddress.coordinates.lat, lng: storedAddress.coordinates.lng });
      } else {
        fetchCart();
      }
    }
    // 2. If NO stored preference, just fetch basic cart (Delivery fee will be 0 until picked)
    else if (!storedAddress && !selectedAddressId) {
      fetchCart();
    }
  }, []); // Run ONLY once on mount to prevent fetchCart Race Conditions

  // Fetch Recommended Products
  useEffect(() => {
    cartApi.getRecommendations()
      .then(res => setRecommendedProducts(res.data))
      .catch(err => console.error("Failed to fetch recommendations:", err));
  }, []);

  // Effect to switch back to ONLINE if COD gets disabled while selected
  useEffect(() => {
    if (isCodDisabled && paymentMethod === "COD") {
      setPaymentMethod("ONLINE");
    }
  }, [isCodDisabled, paymentMethod]);

  const isLoading = placingOrder || paymentLoading || isCartLoading;
  const deliveryTime = 30; // Mock delivery time

  const handlePlaceOrder = async () => {
    if (!selectedAddressId) { toast.error("Please select a delivery address"); return; }

    // Prepare items
    const orderItems = items.map((i) => ({
      product: i._id,
      quantity: i.quantity,
      variant: i.variant || "Standard",
      price: i.price
    }));

    if (paymentMethod === "COD") {
      setPlacingOrder(true);
      try {
        const res = await orderApi.placeOrder({
          items: orderItems,
          totalAmount: totalPrice,
          discountApplied: discountAmount,
          finalAmount: finalPrice,
          deliveryAddress: selectedAddressId,
          address: selectedAddressText || user?.address || "",
          deliveryInstruction: `${deliveryInstruction}${noCutlery ? " | Don't send cutlery 🍴❌" : ""}`, // Combine instructions
          deliveryCoordinates: selectedAddressObj?.coordinates || undefined,
          deliveryFee,
          paymentMethod: "COD",
        });
        toast.success("Order placed successfully! 🎉");
        clearCart();
        navigate(`/orders/${res.data?.order?._id || res.data?._id}`);
      } catch (err: any) {
        toast.error(err.response?.data?.message || "Failed to place order");
      } finally {
        setPlacingOrder(false);
      }
    } else {
      payNow({
        items: orderItems,
        deliveryAddress: selectedAddressObj || selectedAddressId,
        deliveryFee,
        finalAmount: finalPrice,
        userName: user?.name,
        userEmail: user?.email,
        onSuccess: async (paymentDetails) => {
          setPlacingOrder(true);
          try {
            const res = await orderApi.placeOrder({
              items: orderItems,
              totalAmount: totalPrice,
              discountApplied: discountAmount,
              finalAmount: finalPrice,
              deliveryAddress: selectedAddressId,
              address: selectedAddressText || user?.address || "",
              deliveryInstruction: `${deliveryInstruction}${noCutlery ? " | Don't send cutlery 🍴❌" : ""}`, // Combine instructions
              deliveryCoordinates: selectedAddressObj?.coordinates || undefined,
              deliveryFee,
              paymentMethod: "ONLINE",
              razorpayOrderId: paymentDetails.razorpay_order_id,
              razorpayPaymentId: paymentDetails.razorpay_payment_id,
              razorpaySignature: paymentDetails.razorpay_signature,
            });
            toast.success("Payment successful! Order placed! 🎉");
            clearCart();
            navigate(`/orders/${res.data?.order?._id || res.data?._id}`);
          } catch (err: any) {
            toast.error("Payment received but order creation failed. Contact support.");
          } finally {
            setPlacingOrder(false);
          }
        },
        onFailure: () => toast.error("Payment cancelled or failed"),
      });
    }
  };

  if (items.length === 0) {
    if (isLoading) {
      return (
        <div className="min-h-screen bg-gray-50/50 pb-32 dark:bg-background p-4">
          <header className="sticky top-0 z-30 flex items-center bg-background px-4 py-4 shadow-sm mb-6">
            <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
            <div className="ml-4 h-6 w-32 rounded bg-muted animate-pulse" />
          </header>
          <div className="mx-auto max-w-lg space-y-6">
            <div className="h-24 w-full rounded-2xl bg-muted animate-pulse" />
            <div className="h-12 w-full rounded-xl bg-orange-50/50 dark:bg-orange-900/10 animate-pulse" />
            <div className="space-y-4 rounded-2xl bg-card p-4 shadow-sm border border-border/50">
              {[1, 2].map((i) => (
                <div key={i} className="flex gap-4">
                  <div className="h-16 w-16 rounded-lg bg-muted animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
                    <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
            <div className="h-40 w-full rounded-2xl bg-muted animate-pulse" />
          </div>
        </div>
      );
    }

    return (
      <div className="flex h-[80vh] flex-col items-center justify-center p-6 text-center">
        <div className="mb-4 rounded-full bg-green-50 p-6">
          <MapPin className="h-10 w-10 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Your cart is empty</h2>
        <p className="mt-2 text-muted-foreground">Add items from the menu to get started.</p>
        <button onClick={() => navigate("/")} className="mt-6 rounded-xl bg-primary px-8 py-3 font-semibold text-primary-foreground">
          Browse Menu
        </button>
      </div>
    );
  }

  const AddressIcon = selectedAddressObj?.type === "WORK" ? Briefcase : selectedAddressObj?.type === "HOME" ? Home : MapPin;

  const filteredRecommendations = recommendedProducts.filter(p => !items.find(i => i._id === p._id));

  return (
    <div className="min-h-screen bg-gray-50/50 pb-48 dark:bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center bg-background px-4 py-4 shadow-sm">
        <button onClick={() => navigate(-1)} className="mr-4 rounded-full p-1 hover:bg-accent">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">Checkout</h1>
      </header>

      <div className="mx-auto max-w-lg space-y-4 p-4">
        {/* Delivery Address Card */}
        <section className="rounded-2xl bg-card p-4 shadow-sm border border-border/50">
          {!isSelectingAddress && selectedAddressId ? (
            <div className="flex items-start justify-between">
              <div className="flex gap-3">
                <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <AddressIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground flex items-center gap-2">
                    Delivery to {selectedAddressObj?.type === "HOME" ? "Home" : selectedAddressObj?.type === "WORK" ? "Work" : "Address"}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{selectedAddressText}</p>
                </div>
              </div>
              <button
                onClick={() => setIsSelectingAddress(true)}
                className="rounded-lg px-3 py-1 text-xs font-bold text-primary hover:bg-primary/10 border border-primary/20"
              >
                Change
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">Select Delivery Address</h3>
                {isSelectingAddress && selectedAddressId && (
                  <button onClick={() => setIsSelectingAddress(false)} className="text-xs font-medium text-muted-foreground">Cancel</button>
                )}
              </div>
              <AddressManager
                selectedAddressId={selectedAddressId}
                onSelect={(id, text, obj) => {
                  setSelectedAddressId(id);
                  setSelectedAddressText(text);
                  setSelectedAddressObj(obj);
                  setIsSelectingAddress(false);

                  // Re-fetch cart immediately with new coordinates
                  if (obj?.coordinates?.lat && obj?.coordinates?.lng) {
                    fetchCart({ lat: obj.coordinates.lat, lng: obj.coordinates.lng });
                  }
                }}
              />
            </div>
          )}
        </section>

        {!isSelectingAddress && (
          <>


            {/* Delivery Instructions */}


            {/* Items List */}
            <section className="rounded-2xl bg-card p-4 shadow-sm border border-border/50">
              <div className="divide-y divide-border">
                {items.map((item) => (
                  <div key={item.itemId || item._id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                      <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                    </div>
                    <div className="flex flex-1 flex-col justify-between">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold text-sm line-clamp-1">{item.name}</h4>
                          <p className="text-xs text-muted-foreground">{item.variant || "Standard"}</p>
                        </div>
                        <div className="flex items-center h-7 rounded-lg border border-border bg-background">
                          <button
                            onClick={() => decrementItem(item.itemId)}
                            className="flex h-full w-7 items-center justify-center text-primary hover:bg-primary/10 rounded-l-lg transition-colors"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-6 text-center text-xs font-bold text-foreground">{item.quantity}</span>
                          <button
                            onClick={() => incrementItem(item.itemId)}
                            className="flex h-full w-7 items-center justify-center text-primary hover:bg-primary/10 rounded-r-lg transition-colors"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="font-bold text-sm">₹{item.price * item.quantity}</span>
                        {item.quantity > 1 && <span className="text-xs text-muted-foreground">₹{item.price} each</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => navigate("/?category=all")}
                className="mt-4 flex w-full items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80"
              >
                <Plus className="h-4 w-4" /> Add more items
              </button>

              <div className="mt-4 pt-4 border-t border-dashed border-border">
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsNoteOpen(!isNoteOpen)}
                    className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-2 py-1.5 text-xs font-semibold transition-all h-9 ${isNoteOpen || deliveryInstruction
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:bg-accent text-muted-foreground"
                      }`}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    {deliveryInstruction ? "Edit Note" : "Add a note"}
                  </button>
                  <button
                    onClick={() => setNoCutlery(!noCutlery)}
                    className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-2 py-1.5 text-xs font-semibold transition-all h-9 ${noCutlery
                      ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                      : "border-border hover:bg-accent text-muted-foreground"
                      }`}
                  >
                    <UtensilsCrossed className="h-3.5 w-3.5" />
                    Don't send cutlery
                  </button>
                </div>

                <AnimatePresence>
                  {(isNoteOpen || deliveryInstruction) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <textarea
                        value={deliveryInstruction}
                        onChange={(e) => setDeliveryInstruction(e.target.value)}
                        placeholder="e.g. Leave at door, don't ring bell..."
                        className="mt-3 w-full rounded-xl border border-border bg-background p-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary min-h-[80px] resize-none"
                        autoFocus={isNoteOpen && !deliveryInstruction}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </section>

            {/* Recommended Products */}
            {filteredRecommendations.length > 0 && (
              <section className="mb-2 space-y-2">
                <h3 className="font-bold text-sm text-foreground px-1">May you like this</h3>

                <div
                  id="rec-scroll"
                  className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  {filteredRecommendations.map((product, index) => (
                    <div
                      key={product._id}
                      className="snap-start flex-shrink-0 w-36 flex flex-col bg-card rounded-lg shadow-sm border border-border/40 overflow-hidden hover:shadow-md transition-shadow group"
                    >
                      <div className="relative h-24 w-full overflow-hidden bg-muted">
                        <img
                          src={product.imageURL}
                          alt={product.name}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded text-[9px] font-bold text-white flex items-center gap-1">
                          <span className={product.type === "Veg" ? "text-green-400" : "text-red-400"}>●</span>
                          {product.type === "Veg" ? "Veg" : "Non-Veg"}
                        </div>
                      </div>

                      <div className="p-2 flex flex-col flex-1 gap-0">
                        <div className="flex-1 mb-1">
                          <h4 className="font-medium text-xs line-clamp-2 leading-tight">{product.name}</h4>
                        </div>

                        <div className="flex items-center justify-between mt-auto pt-1.5 border-t border-border/30">
                          <span className="text-xs font-bold text-foreground">₹{product.variants?.[0]?.price || product.price || 0}</span>
                          <button
                            onClick={() => addItem({
                              _id: product._id,
                              name: product.name,
                              price: Number(product.variants?.[0]?.price || product.price || 0),
                              image: product.imageURL,
                              type: product.type,
                              category: typeof product.category === 'object' ? product.category?._id : product.category
                            })}
                            className="bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border border-green-200 dark:border-green-800 transition-colors shadow-sm active:scale-95"
                          >
                            ADD
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Apply Coupon */}
            <section className="mb-2">
              <TicketCoupon />
            </section>

            {/* Bill Summary */}
            <section className="rounded-2xl bg-card p-4 shadow-sm border border-border/50">
              <h3 className="mb-3 font-bold text-sm">Bill Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Item total</span>
                  <span>₹{totalPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Delivery fee</span>
                  <span>₹{deliveryFee.toFixed(2)}</span>
                </div>
                <div className="flex flex-col gap-1 text-muted-foreground">
                  <div className="flex justify-between">
                    <span>GST (Total)</span>
                    <span>₹{tax.toFixed(2)}</span>
                  </div>
                  {taxBreakdown && (taxBreakdown.cgstTotal > 0 || taxBreakdown.sgstTotal > 0) && (
                    <div className="ml-2 flex flex-col gap-0.5 text-xs text-muted-foreground/80 border-l-2 border-border pl-2">
                      <div className="flex justify-between">
                        <span>CGST</span>
                        <span>₹{taxBreakdown.cgstTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>SGST</span>
                        <span>₹{taxBreakdown.sgstTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                  {taxBreakdown && taxBreakdown.igstTotal > 0 && (
                    <div className="ml-2 text-xs text-muted-foreground/80 border-l-2 border-border pl-2 flex justify-between">
                      <span>IGST</span>
                      <span>₹{taxBreakdown.igstTotal.toFixed(2)}</span>
                    </div>
                  )}
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-green-600 dark:text-green-400">
                    <span>Item Discount</span>
                    <span>-₹{discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="pt-3 mt-3 border-t border-dashed border-border flex justify-between items-center">
                  <span className="font-bold">To Pay</span>
                  <span className="font-extrabold text-lg">₹{finalPrice.toFixed(0)}</span>
                </div>
              </div>
            </section>

            {/* Savings Banner */}
            {discountAmount > 0 && (
              <div className="rounded-xl bg-green-50 p-3 text-center text-sm font-medium text-green-700 dark:bg-green-900/20 dark:text-green-400">
                You Saved ₹{discountAmount.toFixed(0)} on this order! 🎉
              </div>
            )}

            {/* Payment & Order Button (Fixed Bottom) */}
            <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
              <div className="mx-auto max-w-lg space-y-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1 flex flex-col">
                    <button
                      onClick={() => setPaymentMethod("ONLINE")}
                      className={`w-full flex items-center justify-center gap-2 rounded-xl border px-2 py-2.5 transition-all ${paymentMethod === "ONLINE"
                        ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                        : "border-border hover:bg-accent"
                        }`}
                    >
                      <img src="/razorpay.svg" alt="Razorpay" className="h-3.5 w-auto object-contain" />
                      <span className="text-xs font-bold">Pay Online</span>
                      {paymentMethod === "ONLINE" && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
                    </button>
                  </div>

                  <div className="flex-1 flex flex-col gap-1">
                    <button
                      disabled={isCodDisabled}
                      onClick={() => !isCodDisabled && setPaymentMethod("COD")}
                      className={`w-full flex items-center justify-center gap-2 rounded-xl border px-2 py-2.5 transition-all ${isCodDisabled ? "opacity-50 cursor-not-allowed bg-muted/50 border-border" : paymentMethod === "COD"
                        ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                        : "border-border hover:bg-accent"
                        }`}
                    >
                      <Banknote className={`h-4 w-4 ${paymentMethod === "COD" ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="text-xs font-bold">Cash</span>
                      {paymentMethod === "COD" && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
                    </button>
                    {isCodDisabled && (
                      <span className="text-[10px] font-bold text-destructive text-center leading-[1.1] px-1">
                        {codDisableReason}
                      </span>
                    )}
                  </div>
                </div>

                {isRestaurantClosed ? (
                  <div className="rounded-xl bg-destructive/10 p-3 text-center font-bold text-destructive">
                    Restaurant is currently closed
                  </div>
                ) : (
                  <button
                    onClick={handlePlaceOrder}
                    disabled={isLoading}
                    className="w-full flex items-center justify-between rounded-xl bg-gradient-to-r from-primary to-orange-600 p-4 text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:scale-[1.02] disabled:opacity-70 disabled:hover:scale-100 transition-all active:scale-[0.98]"
                  >
                    {isLoading ? (
                      <div className="flex w-full items-center justify-center gap-2 py-1">
                        <Loader2 className="animate-spin h-5 w-5" />
                        <span className="font-bold text-sm">
                          {isCartLoading ? "Preparing Cart..." : paymentLoading ? "Processing Payment..." : "Placing Order..."}
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="text-left">
                          <p className="text-[10px] text-primary-foreground/90 uppercase font-bold tracking-wider">Total to Pay</p>
                          <p className="font-extrabold text-xl leading-none">₹{finalPrice.toFixed(0)}</p>
                        </div>
                        <div className="flex items-center gap-2 font-bold bg-white/20 px-3 py-1.5 rounded-lg backdrop-blur-sm">
                          {paymentMethod === "COD" ? "Place Order" : "Pay Now"} <span className="text-base leading-none">›</span>
                        </div>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div >
  );
};

export default CheckoutPage;
