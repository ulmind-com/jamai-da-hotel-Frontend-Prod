import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { couponApi } from "@/api/axios";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, Tag, Percent, IndianRupee, Calendar, ShoppingBag,
  Users, Pencil, Copy, CheckCircle2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import AddCouponModal from "@/components/AddCouponModal";
import EditCouponModal from "@/components/EditCouponModal";

const CouponManager = () => {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: coupons, isLoading } = useQuery({
    queryKey: ["coupons"],
    queryFn: () => couponApi.getAll().then((r) => r.data),
  });

  // Optimistic toggle
  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      couponApi.update(id, { isActive }),
    onMutate: async ({ id, isActive }) => {
      await queryClient.cancelQueries({ queryKey: ["coupons"] });
      const prev = queryClient.getQueryData(["coupons"]);
      queryClient.setQueryData(["coupons"], (old: any[]) =>
        old?.map((c) => (c._id === id ? { ...c, isActive } : c))
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      queryClient.setQueryData(["coupons"], ctx?.prev);
      toast.error("Failed to update status");
    },
    onSuccess: () => toast.success("Status updated"),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["coupons"] }),
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await couponApi.delete(deleteTarget._id);
      toast.success("Coupon deleted 🗑️");
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
    } catch {
      toast.error("Failed to delete coupon");
    }
    setDeleteTarget(null);
  };

  const copyCode = (coupon: any) => {
    navigator.clipboard.writeText(coupon.code);
    setCopiedId(coupon._id);
    toast.success("Code copied!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getDiscountLabel = (coupon: any) =>
    coupon.discountType === "FLAT" ? `₹${coupon.discountAmount} OFF` : `${coupon.discountPercent}% OFF`;

  const DiscountIcon = (coupon: any) =>
    coupon.discountType === "FLAT" ? IndianRupee : Percent;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Coupon Manager</h2>
          <p className="text-sm text-muted-foreground">Create, toggle, edit & delete coupons</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-lg transition-transform hover:scale-105"
        >
          <Plus className="h-4 w-4" /> New Coupon
        </motion.button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : !coupons?.length ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <Tag className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <h3 className="mt-4 text-lg font-bold text-foreground">No Coupons Yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">Create your first coupon to offer discounts</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {coupons.map((coupon: any) => {
              const Icon = DiscountIcon(coupon);
              const isActive = coupon.isActive !== false;
              const expiry = coupon.validUntil || coupon.expiry;
              return (
                <motion.div
                  key={coupon._id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: isActive ? 1 : 0.6, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-lg"
                >
                  {/* Ticket notches */}
                  <div className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-background" />
                  <div className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-background" />

                  <div className="flex min-h-[10rem] flex-col sm:flex-row">
                    {/* Left – Discount */}
                    <div className={`flex w-full sm:w-[40%] flex-col items-center justify-center gap-1.5 p-4 transition-colors border-b sm:border-b-0 sm:border-r border-dashed border-border ${isActive ? "bg-primary/10" : "bg-muted/50"}`}>
                      <Icon className={`h-5 w-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                      <p className={`text-center text-xl font-black leading-tight ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                        {getDiscountLabel(coupon)}
                      </p>
                      {coupon.name && (
                        <p className="text-center text-[10px] font-medium text-muted-foreground line-clamp-1">
                          {coupon.name}
                        </p>
                      )}
                      {/* Status badge */}
                      <span className={`mt-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${isActive ? "bg-green-500/15 text-green-600" : "bg-muted text-muted-foreground"}`}>
                        {isActive ? "Active" : "Inactive"}
                      </span>
                    </div>

                    {/* Optional notch line visual logic removed as it's built into borders now */}

                    {/* Right – Details & Actions */}
                    <div className="flex flex-1 flex-col justify-between p-4">
                      {/* Code – clickable to copy */}
                      <button
                        onClick={() => copyCode(coupon)}
                        className="group/code flex items-center gap-2 self-start rounded-lg border border-dashed border-primary/30 bg-primary/5 px-3 py-1.5 transition-colors hover:bg-primary/10"
                      >
                        <p className="font-mono text-sm font-black tracking-wider text-primary">
                          {coupon.code}
                        </p>
                        {copiedId === coupon._id ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 text-primary/50 transition-colors group-hover/code:text-primary" />
                        )}
                      </button>

                      {/* Meta */}
                      <div className="mt-2 space-y-1">
                        {coupon.minOrderValue > 0 && (
                          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <ShoppingBag className="h-3 w-3" /> Min: ₹{coupon.minOrderValue}
                          </p>
                        )}
                        {coupon.usageLimit && (
                          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Users className="h-3 w-3" /> Limit: {coupon.usageLimit}
                          </p>
                        )}
                        {expiry && (
                          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Calendar className="h-3 w-3" /> {new Date(expiry).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        )}
                      </div>

                      {/* Actions row */}
                      <div className="mt-3 flex items-center gap-2 border-t border-border pt-2">
                        <Switch
                          checked={isActive}
                          onCheckedChange={(v) => toggleMutation.mutate({ id: coupon._id, isActive: v })}
                          className="scale-75"
                        />
                        <button
                          onClick={() => setEditTarget(coupon)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(coupon)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-destructive transition-colors hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Modals */}
      <AddCouponModal open={showAddModal} onClose={() => setShowAddModal(false)} />
      <EditCouponModal open={!!editTarget} coupon={editTarget} onClose={() => setEditTarget(null)} />

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete coupon "{deleteTarget?.code}"?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CouponManager;
