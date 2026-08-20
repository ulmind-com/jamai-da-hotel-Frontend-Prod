import { motion } from "framer-motion";

interface Category {
  _id: string;
  name: string;
  image?: string;
  imageURL?: string;
}

interface CategoryCarouselProps {
  categories: Category[];
  selected: string;
  onSelect: (id: string) => void;
}

const CategoryCarousel = ({ categories, selected, onSelect }: CategoryCarouselProps) => {
  const allItems = [{ _id: "", name: "All", image: null }];
  const combined = [...allItems, ...categories];

  // Split into 2 rows: top row = first half, bottom row = second half
  const mid = Math.ceil(combined.length / 2);
  const topRow = combined.slice(0, mid);
  const bottomRow = combined.slice(mid);

  const renderItem = (item: { _id: string; name: string; image?: string | null; imageURL?: string }) => {
    const isSelected = selected === item._id;
    return (
      <motion.button
        key={item._id}
        whileTap={{ scale: 0.92 }}
        onClick={() => onSelect(item._id)}
        className={`flex flex-shrink-0 flex-col items-center gap-1.5 transition-all ${isSelected ? "scale-105" : "opacity-70 hover:opacity-100"
          }`}
      >
        <div
          className={`h-16 w-16 overflow-hidden rounded-full border-2 transition-colors ${isSelected ? "border-primary" : "border-border bg-card"
            }`}
        >
          {item.image || item.imageURL ? (
            <img
              src={(item.image || item.imageURL) as string}
              alt={item.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-secondary">
              <span className="text-xl">🍽️</span>
            </div>
          )}
        </div>
        <span className="max-w-[64px] truncate text-[11px] font-semibold text-foreground">
          {item.name}
        </span>
      </motion.button>
    );
  };

  return (
    <div
      className="overflow-x-auto scrollbar-hide"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      <div className="flex flex-col gap-3 min-w-max px-1 py-1">
        {/* Top Row */}
        <div className="flex gap-4">
          {topRow.map((item) => renderItem(item as any))}
        </div>
        {/* Bottom Row */}
        {bottomRow.length > 0 && (
          <div className="flex gap-4">
            {bottomRow.map((item) => renderItem(item as any))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryCarousel;
