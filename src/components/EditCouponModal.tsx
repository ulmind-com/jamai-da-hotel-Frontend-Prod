import { useState, useEffect } from "react";
import { couponApi } from "@/api/axios";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tag, FileText, AlignLeft, Loader2, X, ToggleLeft, Calendar } from "lucide-react";

interface Props {
  open: boolean;
  coupon: any;
  onClose: () => void;
}

const EditCouponModal = ({ open, coupon, onClose }: Props) => {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    description: "",
    isActive: true,
    validFrom: "",
    validUntil: "",
  });

  const toLocalDatetime = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  };

  useEffect(() => {
    if (coupon) {
      setForm({
        code: coupon.code || "",
        name: coupon.name || "",
        description: coupon.description || "",
        isActive: coupon.isActive !== false,
        validFrom: toLocalDatetime(coupon.validFrom || ""),
        validUntil: toLocalDatetime(coupon.validUntil || ""),
      });
    }
  }, [coupon]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code) {
      toast.error("Coupon code is required");
      return;
    }
    setSaving(true);
    try {
      await couponApi.update(coupon._id, {
        code: form.code.toUpperCase(),
        name: form.name || undefined,
        description: form.description || undefined,
        isActive: form.isActive,
        validFrom: form.validFrom ? new Date(form.validFrom).toISOString() : undefined,
        validUntil: form.validUntil ? new Date(form.validUntil).toISOString() : undefined,
      });
      toast.success("Coupon updated! ✅");
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update coupon");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && coupon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border bg-primary/5 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">Edit Coupon</h2>
                <p className="text-xs text-muted-foreground">Update code, description & status</p>
              </div>
              <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              {/* Discount info (read-only) */}
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Discount (Read-only)</p>
                <p className="mt-1 text-lg font-black text-primary">
                  {coupon.discountType === "FLAT"
                    ? `₹${coupon.discountAmount} OFF`
                    : `${coupon.discountPercent}% OFF`}
                </p>
              </div>

              <div>
                <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Tag className="h-3 w-3" /> Coupon Code *
                </Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
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
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Summer Sale"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <AlignLeft className="h-3 w-3" /> Description
                </Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Get 50% off on your order"
                  className="mt-1.5"
                />
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
                    onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))}
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
                    onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))}
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border p-3">
                <Label className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <ToggleLeft className="h-4 w-4" /> Active Status
                </Label>
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <motion.button
                  type="submit"
                  disabled={saving}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-lg transition-all hover:brightness-110 disabled:opacity-50"
                >
                  {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : "Save Changes"}
                </motion.button>
                <button
                  type="button"
                  onClick={onClose}
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

export default EditCouponModal;
