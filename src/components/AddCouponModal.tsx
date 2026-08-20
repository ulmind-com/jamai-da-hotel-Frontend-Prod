import { useState } from "react";
import { couponApi } from "@/api/axios";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tag, Percent, IndianRupee, ShoppingBag, Calendar, Users, Loader2, X, FileText, AlignLeft,
} from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

const AddCouponModal = ({ open, onClose }: Props) => {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    description: "",
    discountType: "PERCENTAGE" as "PERCENTAGE" | "FLAT",
    discountValue: "",
    minOrderValue: "",
    usageLimit: "",
    validFrom: "",
    validUntil: "",
  });

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  const resetAndClose = () => {
    setForm({
      code: "", name: "", description: "",
      discountType: "PERCENTAGE", discountValue: "",
      minOrderValue: "", usageLimit: "", validFrom: "", validUntil: "",
    });
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(form.discountValue);
    if (!form.code || val <= 0) {
      toast.error("Code and a positive discount value are required");
      return;
    }
    if (form.discountType === "PERCENTAGE" && val > 100) {
      toast.error("Percentage cannot exceed 100%");
      return;
    }

    setCreating(true);
    try {
      await couponApi.create({
        code: form.code.toUpperCase(),
        name: form.name || undefined,
        description: form.description || undefined,
        discountType: form.discountType,
        discountPercent: form.discountType === "PERCENTAGE" ? val : 0,
        discountAmount: form.discountType === "FLAT" ? val : 0,
        maxDiscountAmount: 0,
        minOrderValue: Number(form.minOrderValue) || 0,
        usageLimit: Number(form.usageLimit) || undefined,
        validFrom: form.validFrom ? new Date(form.validFrom).toISOString() : undefined,
        validUntil: form.validUntil ? new Date(form.validUntil).toISOString() : undefined,
      });
      toast.success("Coupon created successfully! 🎟️");
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      resetAndClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to create coupon");
    } finally {
      setCreating(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={resetAndClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border bg-primary/5 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">Create Coupon</h2>
                <p className="text-xs text-muted-foreground">Fill in the details below</p>
              </div>
              <button onClick={resetAndClose} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto p-6">
              {/* Code & Name */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Tag className="h-3 w-3" /> Coupon Code *
                  </Label>
                  <Input
                    value={form.code}
                    onChange={(e) => set("code", e.target.value.toUpperCase())}
                    placeholder="SUMMER50"
                    className="mt-1.5 font-mono uppercase"
                    required
                  />
                </div>
                <div>
                  <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <FileText className="h-3 w-3" /> Display Name
                  </Label>
                  <Input
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    placeholder="Summer Sale"
                    className="mt-1.5"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <AlignLeft className="h-3 w-3" /> Description
                </Label>
                <Input
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="Get 50% off on your order"
                  className="mt-1.5"
                />
              </div>

              {/* Discount Type & Value */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Discount Type *
                  </Label>
                  <Select
                    value={form.discountType}
                    onValueChange={(v) => set("discountType", v)}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERCENTAGE">
                        <span className="flex items-center gap-2">
                          <Percent className="h-3.5 w-3.5 text-primary" /> Percentage (% Off)
                        </span>
                      </SelectItem>
                      <SelectItem value="FLAT">
                        <span className="flex items-center gap-2">
                          <IndianRupee className="h-3.5 w-3.5 text-primary" /> Flat (₹ Off)
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {form.discountType === "PERCENTAGE" ? (
                      <><Percent className="h-3 w-3" /> Discount Percentage (%) *</>
                    ) : (
                      <><IndianRupee className="h-3 w-3" /> Discount Amount (₹) *</>
                    )}
                  </Label>
                  <Input
                    type="number"
                    value={form.discountValue}
                    onChange={(e) => set("discountValue", e.target.value)}
                    placeholder={form.discountType === "PERCENTAGE" ? "50" : "100"}
                    className="mt-1.5"
                    min={1}
                    max={form.discountType === "PERCENTAGE" ? 100 : undefined}
                    required
                  />
                </div>
              </div>

              {/* Min Order, Usage Limit, Expiry */}
              {/* Min Order & Usage Limit */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <ShoppingBag className="h-3 w-3" /> Min Order (₹)
                  </Label>
                  <Input
                    type="number"
                    value={form.minOrderValue}
                    onChange={(e) => set("minOrderValue", e.target.value)}
                    placeholder="200"
                    className="mt-1.5"
                    min={0}
                  />
                </div>
                <div>
                  <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Users className="h-3 w-3" /> Usage Limit
                  </Label>
                  <Input
                    type="number"
                    value={form.usageLimit}
                    onChange={(e) => set("usageLimit", e.target.value)}
                    placeholder="100"
                    className="mt-1.5"
                    min={1}
                  />
                </div>
              </div>

              {/* Valid From & Valid Until */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Calendar className="h-3 w-3" /> Valid From
                  </Label>
                  <Input
                    type="datetime-local"
                    value={form.validFrom}
                    onChange={(e) => set("validFrom", e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Calendar className="h-3 w-3" /> Valid Until
                  </Label>
                  <Input
                    type="datetime-local"
                    value={form.validUntil}
                    onChange={(e) => set("validUntil", e.target.value)}
                    className="mt-1.5"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <motion.button
                  type="submit"
                  disabled={creating}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-lg transition-all hover:brightness-110 disabled:opacity-50"
                >
                  {creating ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</> : "Create Coupon"}
                </motion.button>
                <button
                  type="button"
                  onClick={resetAndClose}
                  className="rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AddCouponModal;
