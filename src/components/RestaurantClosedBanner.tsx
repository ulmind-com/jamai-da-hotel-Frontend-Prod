import { useRestaurantStore } from "@/store/useRestaurantStore";
import { motion, AnimatePresence } from "framer-motion";
import { Clock } from "lucide-react";

const RestaurantClosedBanner = () => {
  const restaurant = useRestaurantStore((s) => s.restaurant);
  const loading = useRestaurantStore((s) => s.loading);

  if (loading || !restaurant || restaurant.isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="border-b border-destructive/20 bg-destructive/10"
      >
        <div className="container mx-auto flex items-center justify-center gap-2 px-4 py-2.5">
          <Clock className="h-4 w-4 text-destructive" />
          <span className="text-sm font-semibold text-destructive">
            We're currently closed. Please check back later!
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default RestaurantClosedBanner;
