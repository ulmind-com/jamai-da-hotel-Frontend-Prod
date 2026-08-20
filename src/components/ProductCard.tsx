import { useState } from "react";
import { motion } from "framer-motion";
import { useCartStore } from "@/store/useCartStore";
import { useAuthStore } from "@/store/useAuthStore";
import { Plus, Minus, Zap } from "lucide-react";
import { resolveImageURL } from "@/lib/image-utils";
import { ProductDetailDrawer } from "./ProductDetailDrawer";

interface ProductCardProps {
  item: {
    _id: string;
    name: string;
    description?: string;
    price: number;
    image?: string;
    imageURL?: string;
    type?: "Veg" | "Non-Veg";
    category?: string | { _id: string; name: string };
    variants?: { name: string; price: number }[];
    hasDiscount?: boolean;
    originalPrice?: number;
    discountPercentage?: number;
    discountExpiresAt?: string;
  };
}

const VegIcon = () => (
  <div className="flex h-4 w-4 items-center justify-center rounded-sm border-2 border-swiggy-success">
    <div className="h-2 w-2 rounded-full bg-swiggy-success" />
  </div>
);

const NonVegIcon = () => (
  <div className="flex h-4 w-4 items-center justify-center rounded-sm border-2 border-swiggy-danger">
    <div className="h-0 w-0 border-x-[4px] border-b-[7px] border-x-transparent border-b-swiggy-danger" />
  </div>
);

const ProductCard = ({ item }: ProductCardProps) => {
  const { items, addItem, incrementItem, decrementItem } = useCartStore();
  const { isAuthenticated, openAuthModal } = useAuthStore();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false); // State for drawer

  const cartItem = items.find((i) => i._id === item._id);

  const displayPrice = item.price || item.variants?.[0]?.price || 0;
  const imageUrl = resolveImageURL(item.image || item.imageURL);

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent drawer opening
    if (!isAuthenticated()) {
      openAuthModal("login");
      return;
    }
    addItem({
      _id: item._id,
      name: item.name,
      price: Number(displayPrice),
      image: imageUrl,
      type: item.type,
      category: typeof item.category === 'object' ? item.category._id : item.category,
    });
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    incrementItem(cartItem!.itemId);
  }

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    decrementItem(cartItem!.itemId);
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -4 }}
        transition={{ duration: 0.3 }}
        onClick={() => setIsDrawerOpen(true)}
        className={`group flex gap-4 rounded-2xl border bg-card p-4 shadow-sm transition-all hover:cursor-pointer hover:shadow-lg ${item.hasDiscount
          ? 'border-green-500/30 ring-1 ring-green-500/10 hover:border-green-500/50'
          : 'border-border'
          }`}
      >
        {/* Text */}
        <div className="flex flex-1 flex-col justify-between">
          <div>
            <div className="mb-1 flex items-center gap-1.5">
              {item.type === "Veg" ? <VegIcon /> : <NonVegIcon />}
              {item.category && (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {typeof item.category === "object" ? item.category.name : item.category}
                </span>
              )}
              {item.hasDiscount && (
                <span className="ml-auto flex items-center gap-0.5 rounded-full bg-green-500/10 px-1.5 py-0.5 text-[10px] font-bold text-green-600 dark:text-green-400">
                  <Zap className="h-2.5 w-2.5" /> Deal
                </span>
              )}
            </div>
            <h3 className="text-base font-bold leading-tight text-foreground">
              {item.name}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {item.hasDiscount && item.originalPrice ? (
                <>
                  <span className="relative text-sm font-semibold text-muted-foreground">
                    ₹{item.originalPrice}
                    <span className="absolute left-0 right-0 top-1/2 h-[2px] bg-red-500 -rotate-[8deg]" />
                  </span>
                  <span className="text-base font-extrabold text-green-600 dark:text-green-400">
                    ₹{displayPrice}
                  </span>
                </>
              ) : (
                <span className="text-sm font-bold text-foreground">₹{displayPrice}</span>
              )}
            </div>
            {item.hasDiscount && item.originalPrice && (
              <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-green-600 dark:text-green-400">
                You save ₹{(item.originalPrice - displayPrice).toFixed(0)} on this item
              </p>
            )}
            {item.description && !item.hasDiscount && (
              <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            )}
            {item.description && item.hasDiscount && (
              <p className="mt-0.5 line-clamp-1 text-xs leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            )}
          </div>
        </div>

        {/* Image + Cart */}
        <div className="relative flex-shrink-0">
          <div className={`h-28 w-28 overflow-hidden rounded-xl ${item.hasDiscount ? 'ring-2 ring-green-500/20' : ''}`}>
            <img
              src={imageUrl}
              alt={item.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
              loading="lazy"
            />
            <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/20 to-transparent" />
            {item.hasDiscount && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -left-1 flex items-center gap-0.5 rounded-br-xl rounded-tl-xl bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 px-2 py-1 shadow-lg"
              >
                <span className="text-[11px] font-black text-white drop-shadow-sm">
                  {item.discountPercentage}%
                </span>
                <span className="text-[9px] font-bold text-white/90">OFF</span>
              </motion.div>
            )}
          </div>

          {/* Add / Counter */}
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
            {cartItem ? (
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="flex items-center gap-1 rounded-lg border border-border bg-card px-1 py-0.5 shadow-md"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={handleDecrement}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-swiggy-success transition-colors hover:bg-accent"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="min-w-[20px] text-center text-sm font-bold text-swiggy-success">
                  {cartItem.quantity}
                </span>
                <button
                  onClick={handleIncrement}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-swiggy-success transition-colors hover:bg-accent"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            ) : (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleAdd}
                className="rounded-lg border border-border bg-card px-6 py-1.5 text-sm font-extrabold uppercase text-swiggy-success shadow-md transition-all hover:bg-accent"
              >
                Add
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>

      <ProductDetailDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        productId={item._id}
        initialData={item}
      />
    </>
  );
};

export default ProductCard;
