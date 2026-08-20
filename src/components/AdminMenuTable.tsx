import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { menuApi, adminApi } from "@/api/axios";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil, Trash2, Loader2, Tag } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { resolveImageURL } from "@/lib/image-utils";
import EditProductModal from "@/components/EditProductModal";
import DiscountModal from "@/components/DiscountModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const AdminMenuTable = () => {
  const queryClient = useQueryClient();
  const [editItem, setEditItem] = useState<any | null>(null);
  const [deleteItem, setDeleteItem] = useState<any | null>(null);
  const [discountItem, setDiscountItem] = useState<any | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const { data: menuItems, isLoading } = useQuery({
    queryKey: ["admin-menu"],
    queryFn: () => menuApi.getAdminMenu().then((r) => r.data),
  });

  const handleToggle = async (item: any) => {
    setTogglingId(item._id);
    try {
      await adminApi.updateMenuItem(item._id, { isAvailable: !item.isAvailable });
      queryClient.invalidateQueries({ queryKey: ["admin-menu"] });
      toast.success(`${item.name} ${!item.isAvailable ? "enabled" : "disabled"}`);
    } catch {
      toast.error("Failed to update status");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      await adminApi.deleteMenuItem(deleteItem._id);
      toast.success("Product deleted successfully 🗑️");
      queryClient.invalidateQueries({ queryKey: ["admin-menu"] });
    } catch {
      toast.error("Failed to delete product");
    }
    setDeleteItem(null);
  };

  const getCategoryName = (cat: any) => {
    if (!cat) return "—";
    return typeof cat === "object" ? cat.name : cat;
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="shimmer h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {/* Header */}
        <div className="hidden grid-cols-[60px_1fr_120px_80px_100px_100px] items-center gap-4 border-b border-border bg-muted/50 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground md:grid">
          <span>Image</span>
          <span>Name</span>
          <span>Category</span>
          <span>Price</span>
          <span>Status</span>
          <span className="text-right">Actions</span>
        </div>

        {/* Rows */}
        <AnimatePresence>
          {menuItems?.map((item: any) => (
            <motion.div
              key={item._id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-col gap-4 border-b border-border px-6 py-4 last:border-b-0 md:grid md:grid-cols-[60px_1fr_120px_80px_100px_100px] md:items-center"
            >
              {/* Top Row for Mobile (Image + Name + Category) / Left block for Desktop */}
              <div className="flex items-start gap-4 md:contents">
                {/* Image */}
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg md:h-10 md:w-10">
                  <img
                    src={resolveImageURL(item.image || item.imageURL)}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                </div>

                {/* Name + Description + Category */}
                <div className="flex flex-col gap-1 md:contents">
                  <div className="flex items-start gap-2 md:items-center">
                    <div className={`mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-sm md:mt-0 ${item.type === "Veg" ? "bg-swiggy-success" : "bg-swiggy-danger"}`} />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.name}</p>
                      {item.description && (
                        <p className="line-clamp-1 text-xs text-muted-foreground">{item.description}</p>
                      )}
                    </div>
                  </div>
                  {/* Category shows under name on mobile, gets its own grid column on desktop */}
                  <span className="text-xs font-medium text-muted-foreground md:hidden">
                    {getCategoryName(item.category)}
                  </span>
                </div>
              </div>

              {/* Category (Desktop Only) */}
              <span className="hidden text-xs font-medium text-muted-foreground md:block">
                {getCategoryName(item.category)}
              </span>

              {/* Bottom Row for Mobile / Right block for Desktop */}
              <div className="flex items-center justify-between gap-4 md:contents">
                {/* Price & Discount */}
                <div className="flex flex-col items-start min-w-[80px]">
                  <span className="text-sm font-bold text-foreground">
                    ₹{item.price || item.variants?.[0]?.price || 0}
                  </span>
                  {item.discountPercentage > 0 && (
                    <div className="mt-1 flex flex-col items-start gap-0.5">
                      <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                        {item.discountPercentage}% OFF
                      </span>
                      {item.discountExpiresAt && (
                        <span className="text-[10px] text-muted-foreground">
                          Exp: {new Date(item.discountExpiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Status toggle */}
                <div className="flex items-center gap-2">
                  {togglingId === item._id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Switch
                      checked={item.isAvailable !== false}
                      onCheckedChange={() => handleToggle(item)}
                      className="data-[state=checked]:bg-swiggy-success"
                    />
                  )}
                  <span className="text-xs text-muted-foreground md:hidden lg:inline-block">
                    {item.isAvailable !== false ? "Active" : "Off"}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-1 sm:gap-2">
                  <button
                    onClick={() => setEditItem(item)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-primary transition-colors hover:bg-primary/10"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <div className="h-4 w-px bg-border hidden sm:block" />
                  <button
                    onClick={() => setDiscountItem(item)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-orange-500 transition-colors hover:bg-orange-50 dark:hover:bg-orange-900/10"
                    title="Discount"
                  >
                    <Tag className="h-4 w-4" />
                  </button>
                  <div className="h-4 w-px bg-border hidden sm:block" />
                  <button
                    onClick={() => setDeleteItem(item)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-destructive transition-colors hover:bg-destructive/10"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {(!menuItems || menuItems.length === 0) && (
          <div className="py-12 text-center">
            <p className="text-3xl">🍽️</p>
            <p className="mt-2 text-sm text-muted-foreground">No menu items yet. Add your first product!</p>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <EditProductModal open={!!editItem} onClose={() => setEditItem(null)} item={editItem} />

      {/* Discount Modal */}
      {discountItem && (
        <DiscountModal
          isOpen={!!discountItem}
          onClose={() => setDiscountItem(null)}
          item={discountItem}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["admin-menu"] })}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteItem?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently remove the item from your menu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AdminMenuTable;
