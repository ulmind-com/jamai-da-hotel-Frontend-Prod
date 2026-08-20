import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { menuApi, adminApi, restaurantApi } from "@/api/axios";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import LoadMore from "@/components/LoadMore";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Plus, Minus, Trash2, Printer, Receipt, ChefHat,
  Percent, Tag, Bluetooth, BluetoothConnected, Check, Package, Utensils,
} from "lucide-react";
import { toast } from "sonner";
import {
  connectPrinter, disconnectPrinter, isPrinterConnected, isBluetoothSupported,
  getSavedPrinterName, printReceipt, tryAutoReconnect, type ReceiptData,
} from "@/lib/thermalPrinter";

interface Product {
  _id: string;
  name: string;
  price: number;
  imageURL: string;
  category: { _id: string; name: string };
  variants: { name: string; price: number }[];
  cgst: number;
  sgst: number;
  igst: number;
  packagingCharge?: number;
}

interface CartItem extends Product {
  cartQuantity: number;
  selectedPrice: number;
}

const PAYMENT_METHODS = ["CASH", "UPI", "CARD"] as const;

export default function SimplePos() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"TERMINAL" | "HISTORY">("TERMINAL");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("CASH");
  // Dine-in customers need no boxes, so packaging only applies to parcels.
  const [isParcel, setIsParcel] = useState(false);
  const [discountType, setDiscountType] = useState<"FLAT" | "PERCENTAGE">("FLAT");
  const [discountValue, setDiscountValue] = useState("");
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [lastBill, setLastBill] = useState<ReceiptData | null>(null);

  // Printer connection state (mirrors the module-level BLE link).
  const [printerName, setPrinterName] = useState(getSavedPrinterName());
  const [printerReady, setPrinterReady] = useState(isPrinterConnected());
  const [connecting, setConnecting] = useState(false);

  // Pick the paired printer back up on load, so a refresh doesn't cost a click.
  useEffect(() => {
    let cancelled = false;
    tryAutoReconnect().then((name) => {
      if (cancelled || !name) return;
      setPrinterName(name);
      setPrinterReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  const { data: menuData = [], isLoading } = useQuery({
    queryKey: ["admin-pos-menu"],
    queryFn: () => menuApi.getMenu().then((r) => r.data),
  });

  const { data: restaurant } = useQuery({
    queryKey: ["restaurant-settings"],
    queryFn: () => restaurantApi.get().then((r) => r.data),
  });

  const categories = useMemo(() => {
    const cats = new Set<string>(["All"]);
    menuData.forEach((item: Product) => item.category?.name && cats.add(item.category.name));
    return Array.from(cats);
  }, [menuData]);

  const filteredMenu = useMemo(
    () =>
      menuData.filter((item: Product) => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCat = selectedCategory === "All" || item.category?.name === selectedCategory;
        return matchesSearch && matchesCat;
      }),
    [menuData, searchTerm, selectedCategory]
  );

  // ── Cart ──────────────────────────────────────────────────────────────────
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i._id === product._id);
      if (existing) {
        return prev.map((i) =>
          i._id === product._id ? { ...i, cartQuantity: i.cartQuantity + 1 } : i
        );
      }
      const basePrice = product.variants?.[0]?.price ?? product.price ?? 0;
      return [...prev, { ...product, cartQuantity: 1, selectedPrice: basePrice }];
    });
  };

  const updateQuantity = (id: string, delta: number) =>
    setCart((prev) =>
      prev.flatMap((item) => {
        if (item._id !== id) return [item];
        const q = item.cartQuantity + delta;
        return q > 0 ? [{ ...item, cartQuantity: q }] : [];
      })
    );

  const removeFromCart = (id: string) => setCart((prev) => prev.filter((i) => i._id !== id));

  // ── Totals ────────────────────────────────────────────────────────────────
  const subtotal = useMemo(
    () => cart.reduce((sum, i) => sum + i.selectedPrice * i.cartQuantity, 0),
    [cart]
  );

  const taxTotal = useMemo(
    () =>
      cart.reduce((sum, i) => {
        const base = i.selectedPrice * i.cartQuantity;
        return sum + (base * ((i.cgst || 0) + (i.sgst || 0) + (i.igst || 0))) / 100;
      }, 0),
    [cart]
  );

  // Per piece, GST-free, and only when the order is going out as a parcel.
  const packagingTotal = useMemo(() => {
    if (!isParcel) return 0;
    return cart.reduce((sum, i) => sum + (i.packagingCharge || 0) * i.cartQuantity, 0);
  }, [cart, isParcel]);

  const discountAmount = useMemo(() => {
    const val = parseFloat(discountValue) || 0;
    if (val <= 0) return 0;
    const base = subtotal + taxTotal + packagingTotal;
    return discountType === "FLAT" ? Math.min(val, base) : Math.min((base * val) / 100, base);
  }, [subtotal, taxTotal, packagingTotal, discountType, discountValue]);

  const grandTotal = Math.ceil(subtotal + taxTotal + packagingTotal - discountAmount);
  const itemCount = cart.reduce((sum, i) => sum + i.cartQuantity, 0);

  // ── Printer ───────────────────────────────────────────────────────────────
  const handleConnectPrinter = async () => {
    setConnecting(true);
    try {
      const name = await connectPrinter();
      setPrinterName(name);
      setPrinterReady(true);
      toast.success(`Printer connected: ${name}`);
    } catch (err: any) {
      // The user dismissing the Chrome device picker isn't an error worth shouting about.
      if (err?.name !== "NotFoundError") {
        toast.error(err?.message || "Could not connect to the printer");
      }
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnectPrinter = () => {
    disconnectPrinter();
    setPrinterReady(false);
    setPrinterName("");
    toast.info("Printer disconnected");
  };

  const sendToPrinter = async (bill: ReceiptData) => {
    try {
      await printReceipt(bill);
      setPrinterReady(true);
      toast.success("Printing…");
    } catch (err: any) {
      setPrinterReady(isPrinterConnected());
      toast.error(err?.message || "Printing failed. Reconnect the printer and retry.");
    }
  };

  // Fallback for when no Bluetooth printer is paired: print through the browser.
  const printViaBrowser = (bill: ReceiptData) => {
    const rows = bill.items
      .map(
        (i) =>
          `<tr><td>${i.name}<br/><small>${i.quantity} × ${i.price.toFixed(2)}</small></td>
           <td class="a">${(i.quantity * i.price).toFixed(2)}</td></tr>`
      )
      .join("");

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${bill.billNumber}</title>
      <style>
        *{font-family:'Courier New',monospace;box-sizing:border-box}
        body{width:280px;margin:0 auto;padding:8px;color:#000}
        h2{text-align:center;margin:2px 0;font-size:16px}
        .c{text-align:center;font-size:11px}
        hr{border:none;border-top:1px dashed #000;margin:6px 0}
        table{width:100%;border-collapse:collapse}
        td{padding:2px 0;font-size:12px;vertical-align:top}
        td.a{text-align:right;white-space:nowrap}
        .grand td{font-size:15px;font-weight:bold;border-top:1px solid #000;padding-top:5px}
      </style></head><body>
      <h2>${bill.restaurantName}</h2>
      ${bill.address ? `<div class="c">${bill.address}</div>` : ""}
      ${bill.phone ? `<div class="c">Ph: ${bill.phone}</div>` : ""}
      ${bill.gstIn ? `<div class="c">GSTIN: ${bill.gstIn}</div>` : ""}
      <hr/>
      <div style="font-size:11px">
        Bill: <b>${bill.billNumber}</b><br/>Date: ${bill.dateTime}<br/>
        Cust: ${bill.customerName || "Walk-in"}<br/>
        ${bill.customerPhone ? `Phone: ${bill.customerPhone}<br/>` : ""}
        Pay: ${bill.paymentMethod}
      </div>
      <hr/><table>${rows}</table><hr/>
      <table>
        <tr><td>Subtotal</td><td class="a">${bill.subtotal.toFixed(2)}</td></tr>
        ${bill.taxAmount > 0 ? `<tr><td>GST</td><td class="a">${bill.taxAmount.toFixed(2)}</td></tr>` : ""}
        ${bill.packagingAmount > 0 ? `<tr><td>Packaging</td><td class="a">${bill.packagingAmount.toFixed(2)}</td></tr>` : ""}
        ${bill.discountAmount > 0 ? `<tr><td>Discount${bill.discountLabel ? ` (${bill.discountLabel})` : ""}</td><td class="a">-${bill.discountAmount.toFixed(2)}</td></tr>` : ""}
        <tr class="grand"><td>TOTAL</td><td class="a">Rs.${bill.total.toFixed(2)}</td></tr>
      </table>
      <hr/><div class="c">Thank you! Visit again</div>
      <script>window.onload=function(){window.print();setTimeout(function(){window.close()},300)}</script>
      </body></html>`;

    const w = window.open("", "_blank", "width=340,height=640");
    if (!w) { toast.error("Allow pop-ups to print the bill"); return; }
    w.document.write(html);
    w.document.close();
  };

  // ── Generate bill ─────────────────────────────────────────────────────────
  const createBill = useMutation({
    mutationFn: adminApi.createPOSOrder,
    onSuccess: (res) => {
      const order = res.data;
      const bill: ReceiptData = {
        restaurantName: restaurant?.name || "Haldia Cloud Kitchen & Restaurant",
        address: restaurant?.address,
        phone: restaurant?.mobile,
        gstIn: restaurant?.gstIn,
        billNumber: order.customId || order._id?.slice(-6).toUpperCase() || "-",
        dateTime: new Date(order.createdAt || Date.now()).toLocaleString("en-IN"),
        customerName: order.customerName,
        customerPhone: order.customerMobile,
        paymentMethod: order.paymentMethod,
        items: cart.map((i) => ({
          name: i.name,
          quantity: i.cartQuantity,
          price: i.selectedPrice,
        })),
        subtotal: order.totalAmount ?? subtotal,
        taxAmount: order.taxAmount ?? taxTotal,
        packagingAmount: order.packagingTotal ?? packagingTotal,
        discountAmount: order.discountApplied ?? 0,
        discountLabel:
          order.discountType === "PERCENTAGE" ? `${order.discountValue}%` : undefined,
        total: order.finalAmount ?? grandTotal,
      };

      setLastBill(bill);
      toast.success("Bill generated");

      // Straight to paper when a printer is already paired.
      if (isPrinterConnected()) sendToPrinter(bill);

      setCart([]);
      setCustomerName("");
      setCustomerMobile("");
      setPaymentMethod("CASH");
      setIsParcel(false);
      setDiscountValue("");
      setIsMobileCartOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-pos-orders"] });
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.message || "Failed to generate bill"),
  });

  // Only the cart is required — name, phone, payment and discount are all optional.
  const handleGenerateBill = () => {
    if (cart.length === 0) return toast.error("Add at least one item");

    createBill.mutate({
      customerName: customerName.trim(),
      customerMobile,
      paymentMethod,
      discountType: parseFloat(discountValue) > 0 ? discountType : "NONE",
      discountValue: parseFloat(discountValue) || 0,
      applyPackaging: isParcel,
      items: cart.map((i) => ({ product: i._id, variant: "Standard", quantity: i.cartQuantity })),
    } as any);
  };

  const canGenerate = cart.length > 0;

  return (
    <div className="relative flex h-[calc(100vh-7rem)] min-h-[520px] flex-col overflow-hidden rounded-2xl border border-border bg-background lg:flex-row">
      {/* ── LEFT: menu ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col border-border bg-muted/20 lg:border-r">
        <div className="flex flex-col gap-3 border-b border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <ChefHat className="h-5 w-5 text-primary" />
              POS Billing
            </h2>

            <div className="flex items-center gap-2">
              <PrinterButton
                supported={isBluetoothSupported()}
                ready={printerReady}
                name={printerName}
                connecting={connecting}
                onConnect={handleConnectPrinter}
                onDisconnect={handleDisconnectPrinter}
              />
              <div className="flex w-fit rounded-xl bg-muted p-1">
                {(["TERMINAL", "HISTORY"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                      mode === m ? "bg-background text-foreground shadow" : "text-muted-foreground"
                    }`}
                  >
                    {m === "TERMINAL" ? "Terminal" : "History"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {mode === "TERMINAL" && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search items…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background py-2 pl-9 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                      selectedCategory === cat
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "border border-border bg-background hover:bg-muted"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {mode === "TERMINAL" ? (
          <div className="flex-1 overflow-y-auto p-3 pb-28 lg:pb-4">
            {isLoading ? (
              <div className="grid animate-pulse grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-36 rounded-xl border border-border bg-card" />
                ))}
              </div>
            ) : filteredMenu.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
                <Receipt className="h-12 w-12 opacity-20" />
                <p>No items match your search</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {filteredMenu.map((product: Product) => {
                  const inCart = cart.find((c) => c._id === product._id);
                  return (
                    <button
                      key={product._id}
                      onClick={() => addToCart(product)}
                      className="group relative flex flex-col rounded-xl border border-border bg-card p-2 text-left transition-all hover:border-primary hover:shadow-md"
                    >
                      {inCart && (
                        <span className="absolute right-2 top-2 z-10 flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground shadow">
                          {inCart.cartQuantity}
                        </span>
                      )}
                      <div className="mb-2 aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted">
                        <img
                          src={product.imageURL}
                          alt={product.name}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                        />
                      </div>
                      <h3 className="mb-1 line-clamp-2 text-xs font-bold leading-tight sm:text-sm">
                        {product.name}
                      </h3>
                      <span className="mt-auto text-sm font-bold text-primary">
                        ₹{product.variants?.[0]?.price ?? product.price ?? 0}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <PosHistory onReprint={(bill) => setLastBill(bill)} restaurant={restaurant} />
        )}
      </div>

      {/* ── RIGHT: cart ─────────────────────────────────────────────────── */}
      {mode === "TERMINAL" && (
        <>
          {isMobileCartOpen && (
            <div
              className="absolute inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
              onClick={() => setIsMobileCartOpen(false)}
            />
          )}

          <div
            className={`absolute inset-y-0 right-0 z-40 flex w-full flex-col bg-card shadow-2xl transition-transform duration-300 sm:w-[380px] lg:relative lg:translate-x-0 ${
              isMobileCartOpen ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <div className="flex items-center justify-between border-b border-border bg-muted/30 p-4">
              <h3 className="flex items-center gap-2 font-bold">
                <Receipt className="h-5 w-5 text-primary" />
                Current Bill
              </h3>
              <button
                onClick={() => setIsMobileCartOpen(false)}
                className="rounded-full bg-background p-2 font-bold text-muted-foreground lg:hidden"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              <AnimatePresence initial={false}>
                {cart.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground opacity-60">
                    <Receipt className="h-12 w-12" />
                    <p className="text-sm">Tap items to add them</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <motion.div
                      layout
                      key={item._id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="flex items-center justify-between rounded-xl border border-border bg-background p-3"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <h4 className="truncate text-sm font-bold">{item.name}</h4>
                        <p className="text-sm font-medium text-primary">
                          ₹{item.selectedPrice} × {item.cartQuantity} ={" "}
                          <span className="text-foreground">
                            ₹{(item.selectedPrice * item.cartQuantity).toFixed(2)}
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center rounded-lg bg-muted">
                          <button
                            onClick={() => updateQuantity(item._id, -1)}
                            className="rounded-l-lg p-1.5 hover:bg-background hover:text-primary"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-6 text-center text-sm font-bold">
                            {item.cartQuantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item._id, 1)}
                            className="rounded-r-lg p-1.5 hover:bg-background hover:text-primary"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <button
                          onClick={() => removeFromCart(item._id)}
                          className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>

            <div className="space-y-3 border-t border-border bg-muted/10 p-4">
              {/* One tap decides whether packaging gets charged. */}
              <div className="flex gap-2 rounded-xl bg-muted p-1">
                <button
                  onClick={() => setIsParcel(false)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all ${
                    !isParcel ? "bg-background text-foreground shadow" : "text-muted-foreground"
                  }`}
                >
                  <Utensils className="h-3.5 w-3.5" /> Dine-in
                </button>
                <button
                  onClick={() => setIsParcel(true)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all ${
                    isParcel ? "bg-background text-foreground shadow" : "text-muted-foreground"
                  }`}
                >
                  <Package className="h-3.5 w-3.5" /> Parcel
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Customer name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  type="tel"
                  placeholder="Phone"
                  value={customerMobile}
                  onChange={(e) => setCustomerMobile(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <p className="mb-1.5 text-xs font-bold text-muted-foreground">PAYMENT METHOD</p>
                <div className="flex gap-2">
                  {PAYMENT_METHODS.map((method) => (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={`flex-1 rounded-lg border py-2 text-xs font-bold transition-all ${
                        paymentMethod === method
                          ? "border-primary bg-primary text-primary-foreground shadow"
                          : "border-border bg-background text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                  <Tag className="h-3.5 w-3.5 text-green-600" />
                  DISCOUNT
                  {discountAmount > 0 && (
                    <span className="text-green-600">−₹{discountAmount.toFixed(2)}</span>
                  )}
                </p>
                <div className="flex gap-2">
                  <div className="flex flex-shrink-0 rounded-lg bg-muted p-0.5">
                    <button
                      onClick={() => setDiscountType("FLAT")}
                      className={`rounded-md px-3 py-1.5 text-xs font-bold ${
                        discountType === "FLAT" ? "bg-background shadow" : "text-muted-foreground"
                      }`}
                    >
                      ₹
                    </button>
                    <button
                      onClick={() => setDiscountType("PERCENTAGE")}
                      className={`rounded-md px-3 py-1.5 text-xs font-bold ${
                        discountType === "PERCENTAGE" ? "bg-background shadow" : "text-muted-foreground"
                      }`}
                    >
                      <Percent className="h-3 w-3" />
                    </button>
                  </div>
                  <input
                    type="number"
                    min="0"
                    placeholder={discountType === "FLAT" ? "Amount" : "Percent"}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                </div>
              </div>

              <div className="space-y-1 border-t border-border/50 pt-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>GST</span>
                  <span>₹{taxTotal.toFixed(2)}</span>
                </div>
                {packagingTotal > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Packaging</span>
                    <span>₹{packagingTotal.toFixed(2)}</span>
                  </div>
                )}
                {discountAmount > 0 && (
                  <div className="flex justify-between font-medium text-green-600">
                    <span>Discount</span>
                    <span>−₹{discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border/50 pt-2 text-xl font-extrabold">
                  <span>Total</span>
                  <span>₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={handleGenerateBill}
                disabled={!canGenerate || createBill.isPending}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Printer className="h-5 w-5" />
                {createBill.isPending
                  ? "Generating…"
                  : printerReady
                  ? "Generate & Print Bill"
                  : "Generate Bill"}
              </button>
            </div>
          </div>

          {!isMobileCartOpen && (
            <button
              onClick={() => setIsMobileCartOpen(true)}
              className="absolute bottom-6 right-6 z-20 flex items-center gap-3 rounded-full bg-primary px-6 py-4 text-primary-foreground shadow-2xl transition-transform hover:scale-105 lg:hidden"
            >
              <Receipt className="h-6 w-6" />
              <span className="font-bold">{itemCount} Items</span>
              <span className="border-l border-primary-foreground/20 pl-3 font-black">
                ₹{grandTotal.toFixed(2)}
              </span>
            </button>
          )}
        </>
      )}

      {/* ── Receipt preview ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {lastBill && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setLastBill(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 text-black shadow-2xl"
            >
              <div className="flex flex-col items-center gap-1 border-b-2 border-dashed border-gray-300 pb-3 text-center font-mono">
                <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                  <Check className="h-5 w-5 text-green-600" />
                </div>
                <h3 className="text-lg font-black">{lastBill.restaurantName}</h3>
                {lastBill.address && <p className="text-xs leading-tight">{lastBill.address}</p>}
                {lastBill.gstIn && <p className="text-xs">GSTIN: {lastBill.gstIn}</p>}
              </div>

              <div className="space-y-0.5 border-b-2 border-dashed border-gray-300 py-2 font-mono text-xs">
                <p>Bill: {lastBill.billNumber}</p>
                <p>Date: {lastBill.dateTime}</p>
                <p>Cust: {lastBill.customerName || "Walk-in"}</p>
                <p>Pay: {lastBill.paymentMethod}</p>
              </div>

              <table className="w-full border-b-2 border-dashed border-gray-300 py-2 font-mono text-xs">
                <tbody>
                  {lastBill.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-1">
                        {item.name}
                        <br />
                        <span className="text-gray-500">
                          {item.quantity} × {item.price.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-1 text-right align-top">
                        {(item.quantity * item.price).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="space-y-1 py-2 font-mono text-xs">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{lastBill.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>GST</span>
                  <span>{lastBill.taxAmount.toFixed(2)}</span>
                </div>
                {lastBill.packagingAmount > 0 && (
                  <div className="flex justify-between">
                    <span>Packaging</span>
                    <span>{lastBill.packagingAmount.toFixed(2)}</span>
                  </div>
                )}
                {lastBill.discountAmount > 0 && (
                  <div className="flex justify-between text-green-700">
                    <span>Discount</span>
                    <span>−{lastBill.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-400 pt-1 text-base font-black">
                  <span>TOTAL</span>
                  <span>₹{lastBill.total.toFixed(2)}</span>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2">
                {printerReady ? (
                  <button
                    onClick={() => sendToPrinter(lastBill)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-black py-3 font-bold text-white hover:bg-gray-800"
                  >
                    <Printer className="h-5 w-5" /> Print again
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      await handleConnectPrinter();
                      if (isPrinterConnected()) sendToPrinter(lastBill);
                    }}
                    disabled={connecting || !isBluetoothSupported()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-black py-3 font-bold text-white hover:bg-gray-800 disabled:opacity-50"
                  >
                    <Bluetooth className="h-5 w-5" />
                    {connecting ? "Connecting…" : "Connect printer & print"}
                  </button>
                )}
                <button
                  onClick={() => printViaBrowser(lastBill)}
                  className="w-full rounded-xl border border-gray-300 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
                >
                  Print via browser
                </button>
                <button
                  onClick={() => setLastBill(null)}
                  className="w-full py-1 text-sm font-medium text-gray-500 hover:text-gray-800"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Printer status / connect control ──────────────────────────────────────
function PrinterButton({
  supported, ready, name, connecting, onConnect, onDisconnect,
}: {
  supported: boolean;
  ready: boolean;
  name: string;
  connecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  if (!supported) {
    return (
      <span
        className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700"
        title="Web Bluetooth needs Chrome or Edge (Android or desktop)."
      >
        No Bluetooth here
      </span>
    );
  }

  if (ready) {
    return (
      <button
        onClick={onDisconnect}
        title={`Connected to ${name} — click to disconnect`}
        className="flex items-center gap-1.5 rounded-lg bg-green-50 px-2.5 py-1.5 text-xs font-bold text-green-700 hover:bg-green-100"
      >
        <BluetoothConnected className="h-3.5 w-3.5" />
        <span className="max-w-[110px] truncate">{name || "Printer"}</span>
      </button>
    );
  }

  return (
    <button
      onClick={onConnect}
      disabled={connecting}
      className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-bold hover:border-primary disabled:opacity-50"
    >
      <Bluetooth className="h-3.5 w-3.5" />
      {connecting ? "Connecting…" : "Connect Printer"}
    </button>
  );
}

// ── History (reprint past bills) ──────────────────────────────────────────
function PosHistory({
  onReprint, restaurant,
}: {
  onReprint: (bill: ReceiptData) => void;
  restaurant: any;
}) {
  const { items: records, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useInfiniteList<any>(["admin-pos-orders"], (p) => adminApi.getPOSOrders(p));

  const toReceipt = (order: any): ReceiptData => ({
    restaurantName: restaurant?.name || "Haldia Cloud Kitchen & Restaurant",
    address: restaurant?.address,
    phone: restaurant?.mobile,
    gstIn: restaurant?.gstIn,
    billNumber: order.customId || order._id.slice(-6).toUpperCase(),
    dateTime: new Date(order.createdAt).toLocaleString("en-IN"),
    customerName: order.customerName,
    customerPhone: order.customerMobile,
    paymentMethod: order.paymentMethod,
    items: (order.items || []).map((it: any) => ({
      name: it.product?.name || "Item",
      quantity: it.quantity,
      price: it.price,
    })),
    subtotal: order.totalAmount || 0,
    taxAmount: order.taxAmount || 0,
    packagingAmount: order.packagingTotal || 0,
    discountAmount: order.discountApplied || 0,
    discountLabel: order.discountType === "PERCENTAGE" ? `${order.discountValue}%` : undefined,
    total: order.finalAmount || 0,
  });

  if (isLoading) {
    return <div className="animate-pulse p-8 text-center text-muted-foreground">Loading bills…</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {records.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-12 text-muted-foreground">
          <Receipt className="mb-4 h-14 w-14 opacity-20" />
          <p className="font-medium">No bills generated yet.</p>
        </div>
      ) : (
        <div className="mx-auto grid w-full max-w-4xl gap-3">
          {records.map((order: any) => (
            <div
              key={order._id}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50"
            >
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-bold">
                  {order.customId || order._id.slice(-6).toUpperCase()}
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                    {new Date(order.createdAt).toLocaleString("en-IN")}
                  </span>
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {order.customerName || "Walk-in"} · {order.items?.length || 0} items ·{" "}
                  {order.paymentMethod}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xl font-black text-primary">
                  ₹{(order.finalAmount || 0).toFixed(2)}
                </span>
                <button
                  onClick={() => onReprint(toReceipt(order))}
                  title="View & reprint"
                  className="rounded-xl bg-muted p-3 transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  <Printer className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))}
          <LoadMore hasMore={!!hasNextPage} isFetching={isFetchingNextPage} onLoad={fetchNextPage} />
        </div>
      )}
    </div>
  );
}
