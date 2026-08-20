import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { couponApi } from "@/api/axios";
import { useCartStore } from "@/store/useCartStore";
import { toast } from "sonner";
import { Sparkles, X, Copy, ChevronDown, ChevronUp, Percent, BadgeIndianRupee, Ticket } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Coupon {
  _id: string;
  code: string;
  name?: string;
  description?: string;
  discountType: "PERCENTAGE" | "FLAT";
  discountAmount: number;
  discountPercent: number;
  minOrderValue?: number;
  validFrom?: string;
  validUntil?: string;
  isActive?: boolean;
}

const shakeAnimation = {
  x: [0, -8, 8, -6, 6, -3, 3, 0],
  transition: { duration: 0.5 },
};

const TicketCoupon = () => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCoupons, setShowCoupons] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [shakingId, setShakingId] = useState<string | null>(null);

  const totalPrice = useCartStore((s) => s.totalPrice);
  const appliedCoupon = useCartStore((s) => s.appliedCoupon);
  const applyCouponAction = useCartStore((s) => s.applyCoupon);
  const removeCouponAction = useCartStore((s) => s.removeCoupon);
  const discountAmount = useCartStore((s) => s.discountAmount);

  const { data: coupons } = useQuery({
    queryKey: ["coupons-available"],
    queryFn: () => couponApi.getAll().then((r) => r.data),
  });

  const isExpired = (c: Coupon) => {
    if (!c.isActive) return true;
    if (c.validUntil && new Date(c.validUntil) < new Date()) return true;
    return false;
  };

  const bestCoupon = useMemo(() => {
    if (!coupons || coupons.length === 0) return null;
    const valid = coupons.filter((c: Coupon) => !isExpired(c));
    if (valid.length === 0) return null;
    return valid.reduce((best: Coupon, c: Coupon) => {
      const bestVal = best.discountType === "PERCENTAGE" ? best.discountPercent : best.discountAmount;
      const cVal = c.discountType === "PERCENTAGE" ? c.discountPercent : c.discountAmount;
      return cVal > bestVal ? c : best;
    }, valid[0]);
  }, [coupons]);

  const otherCoupons = useMemo(() => {
    if (!coupons || !bestCoupon) return coupons || [];
    return coupons.filter((c: Coupon) => c._id !== bestCoupon._id);
  }, [coupons, bestCoupon]);

  const handleApply = async (applyCode: string, couponId?: string) => {
    if (!applyCode.trim()) return;
    setLoading(true);
    try {
      await applyCouponAction(applyCode);
      setCode("");
      setShowManualInput(false);
    } catch {
      // Shake the coupon card — toast already handled by store
      setShakingId(couponId || "manual");
      setTimeout(() => setShakingId(null), 600);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    await removeCouponAction();
  };

  const isEligible = (c: Coupon) => {
    if (isExpired(c)) return false;
    if (c.minOrderValue && totalPrice < c.minOrderValue) return false;
    return true;
  };

  const getShortfall = (c: Coupon) => {
    if (c.minOrderValue && totalPrice < c.minOrderValue) return c.minOrderValue - totalPrice;
    return 0;
  };

  const getDiscountLabel = (c: Coupon) =>
    c.discountType === "PERCENTAGE" ? `${c.discountPercent}% OFF` : `₹${c.discountAmount} OFF`;

  // ── Applied state ──
  if (appliedCoupon) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-swiggy-success/30 bg-swiggy-success/10 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-swiggy-success" />
            <div>
              <span className="text-sm font-bold text-swiggy-success">"{appliedCoupon.code}" applied!</span>
              <p className="text-xs text-swiggy-success/80">You save ₹{discountAmount.toFixed(0)}</p>
            </div>
          </div>
          <button
            onClick={handleRemove}
            className="rounded-lg p-1.5 text-swiggy-success/70 transition-colors hover:bg-swiggy-success/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Featured "Best Coupon" Yellow Ticket ── */}
      {bestCoupon && (
        <motion.div animate={shakingId === bestCoupon._id ? shakeAnimation : {}} className="relative">
          <div
            className="relative flex overflow-hidden rounded-xl"
            style={{
              background: isEligible(bestCoupon)
                ? "linear-gradient(135deg, hsl(45 100% 60%), hsl(35 100% 50%))"
                : "linear-gradient(135deg, hsl(var(--muted)), hsl(var(--muted)))",
            }}
          >
            <div className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-background" />
            <div className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-background" />

            <div className="flex w-[70%] flex-col justify-center gap-1 py-4 pl-6 pr-3">
              <div className="flex items-center gap-1.5">
                <Ticket className={`h-3.5 w-3.5 ${isEligible(bestCoupon) ? "text-amber-900" : "text-muted-foreground"}`} />
                <span className={`text-[10px] font-bold uppercase tracking-widest ${isEligible(bestCoupon) ? "text-amber-900/70" : "text-muted-foreground"}`}>
                  Best Offer
                </span>
              </div>
              <p className={`text-xl font-black leading-tight ${isEligible(bestCoupon) ? "text-amber-950" : "text-muted-foreground"}`}>
                {getDiscountLabel(bestCoupon)}
              </p>
              {bestCoupon.name && (
                <p className={`text-xs font-semibold ${isEligible(bestCoupon) ? "text-amber-900/80" : "text-muted-foreground"}`}>
                  {bestCoupon.name}
                </p>
              )}
              {bestCoupon.minOrderValue && (
                <p className={`text-[11px] ${isEligible(bestCoupon) ? "text-amber-900/60" : "text-muted-foreground"}`}>
                  On orders above ₹{bestCoupon.minOrderValue}
                </p>
              )}
            </div>

            <div className="flex items-center">
              <div className={`h-[70%] border-l-2 border-dashed ${isEligible(bestCoupon) ? "border-amber-900/25" : "border-border"}`} />
            </div>

            <div className="flex w-[30%] flex-col items-center justify-center gap-2 py-4 pr-4 pl-3">
              <button
                onClick={() => { navigator.clipboard.writeText(bestCoupon.code); toast.success("Copied!"); }}
                className={`flex items-center gap-1 rounded-lg px-2 py-1 font-mono text-xs font-bold ${
                  isEligible(bestCoupon) ? "bg-amber-100/50 text-amber-950" : "bg-muted text-muted-foreground"
                }`}
              >
                {bestCoupon.code}
                <Copy className="h-3 w-3 opacity-60" />
              </button>
              {isEligible(bestCoupon) ? (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleApply(bestCoupon.code, bestCoupon._id)}
                  disabled={loading}
                  className="w-full rounded-lg bg-amber-950 px-2 py-1.5 text-[11px] font-bold text-amber-100 transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? "..." : "APPLY"}
                </motion.button>
              ) : isExpired(bestCoupon) ? (
                <span className="text-[10px] font-bold text-muted-foreground">EXPIRED</span>
              ) : (
                <span className="text-[10px] font-bold text-primary">+₹{getShortfall(bestCoupon).toFixed(0)} more</span>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Manual input toggle ── */}
      <button
        onClick={() => setShowManualInput(!showManualInput)}
        className="text-xs font-semibold text-primary underline underline-offset-2 transition-colors hover:text-primary/80"
      >
        {showManualInput ? "Hide" : "Have a different code?"}
      </button>

      <AnimatePresence>
        {showManualInput && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <motion.div animate={shakingId === "manual" ? shakeAnimation : {}} className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Enter coupon code"
                maxLength={16}
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm font-bold uppercase text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-ring"
              />
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => handleApply(code)}
                disabled={loading || !code.trim()}
                className="shrink-0 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "..." : "APPLY"}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Other available coupons ── */}
      {otherCoupons && otherCoupons.length > 0 && (
        <>
          <button
            onClick={() => setShowCoupons(!showCoupons)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/5"
          >
            {showCoupons ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {showCoupons ? "Hide" : "View"} {otherCoupons.length} more coupon{otherCoupons.length > 1 ? "s" : ""}
          </button>

          <AnimatePresence>
            {showCoupons && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="space-y-2 overflow-hidden">
                {otherCoupons.map((coupon: Coupon) => {
                  const expired = isExpired(coupon);
                  const eligible = isEligible(coupon);
                  const shortfall = getShortfall(coupon);

                  return (
                    <motion.div
                      key={coupon._id}
                      animate={shakingId === coupon._id ? shakeAnimation : {}}
                      className={`relative flex overflow-hidden rounded-xl border transition-all ${
                        expired ? "border-border opacity-50 grayscale" : eligible ? "border-primary/20 bg-primary/5" : "border-border bg-muted/50"
                      }`}
                    >
                      <div className="absolute -left-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-background" />
                      <div className="absolute -right-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-background" />

                      <div className={`flex w-24 shrink-0 flex-col items-center justify-center p-3 ${expired ? "bg-muted" : "bg-gradient-to-br from-primary/15 to-primary/5"}`}>
                        {coupon.discountType === "PERCENTAGE" ? (
                          <>
                            <Percent className={`h-3.5 w-3.5 ${expired ? "text-muted-foreground" : "text-primary"}`} />
                            <span className={`text-xl font-black ${expired ? "text-muted-foreground" : "text-primary"}`}>{coupon.discountPercent}%</span>
                          </>
                        ) : (
                          <>
                            <BadgeIndianRupee className={`h-3.5 w-3.5 ${expired ? "text-muted-foreground" : "text-primary"}`} />
                            <span className={`text-xl font-black ${expired ? "text-muted-foreground" : "text-primary"}`}>₹{coupon.discountAmount}</span>
                          </>
                        )}
                        <span className={`text-[9px] font-bold uppercase ${expired ? "text-muted-foreground" : "text-primary/70"}`}>OFF</span>
                      </div>

                      <div className="flex items-center">
                        <div className="h-[70%] border-l border-dashed border-border" />
                      </div>

                      <div className="flex flex-1 items-center justify-between gap-2 px-3 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold text-foreground">{coupon.code}</span>
                            <button onClick={() => { navigator.clipboard.writeText(coupon.code); toast.success("Copied!"); }} className="text-muted-foreground hover:text-foreground">
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                          {coupon.name && <p className="mt-0.5 truncate text-xs font-semibold text-foreground">{coupon.name}</p>}
                          {coupon.minOrderValue ? <p className="text-[10px] text-muted-foreground">Min order: ₹{coupon.minOrderValue}</p> : null}
                        </div>

                        <div className="shrink-0">
                          {expired ? (
                            <span className="rounded-lg bg-muted px-3 py-1.5 text-[10px] font-bold text-muted-foreground">EXPIRED</span>
                          ) : eligible ? (
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleApply(coupon.code, coupon._id)}
                              disabled={loading}
                              className="rounded-lg bg-primary px-3 py-1.5 text-[10px] font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                            >
                              APPLY
                            </motion.button>
                          ) : (
                            <span className="rounded-lg bg-primary/10 px-2 py-1.5 text-[10px] font-bold text-primary">+₹{shortfall.toFixed(0)} more</span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
};

export default TicketCoupon;
