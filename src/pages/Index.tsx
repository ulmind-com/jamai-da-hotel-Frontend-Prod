import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Search, ArrowRight, Zap, ChevronRight } from "lucide-react";
import { menuApi, restaurantApi } from "@/api/axios";
import { useAuthStore } from "@/store/useAuthStore";
import ProductCard from "@/components/ProductCard";
import CategoryCarousel from "@/components/CategoryCarousel";
import { SkeletonCard, SkeletonCategory } from "@/components/Skeletons";
import { resolveImageURL } from "@/lib/image-utils";


const PLACEHOLDER_TEXTS = [
  "Search for Biryani...",
  "Search for Pizza...",
  "Search for Burger...",
  "Search for Dosa...",
  "Search for Ice Cream...",
];

import { useRestaurantStore } from "@/store/useRestaurantStore";

import ReviewModal from "@/components/ReviewModal";

const FALLBACK_VIDEOS = ["/burger.mp4", "/icecream.mp4", "/coocking.mp4"];

const Index = () => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("");
  const [vegOnly, setVegOnly] = useState(false);
  const [placeholder, setPlaceholder] = useState(PLACEHOLDER_TEXTS[0]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [videoVisible, setVideoVisible] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { isAuthenticated, isAdmin } = useAuthStore();
  const restaurant = useRestaurantStore((s) => s.restaurant);

  // Debounce search input — only fire API after user stops typing for 400ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const isAdminUser = isAuthenticated() && isAdmin();

  /* ──────────────── Review Prompt Logic ──────────────── */
  const [pendingReviewOrder, setPendingReviewOrder] = useState<any | null>(null);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % PLACEHOLDER_TEXTS.length;
      setPlaceholder(PLACEHOLDER_TEXTS[i]);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isAuthenticated() && !isAdmin()) {
      Promise.all([
        import("@/api/axios").then(m => m.orderApi.getMyOrders()),
        import("@/api/axios").then(m => m.reviewApi.getMyReviews())
      ]).then(([ordersRes, reviewsRes]) => {
        const orders = ordersRes.data.orders || ordersRes.data || [];
        const reviews = reviewsRes.data || [];

        // Create a set of reviewed order IDs
        const reviewedOrderIds = new Set(reviews.map((r: any) =>
          typeof r.order === "object" ? r.order?._id : r.order
        ));

        // Filter for eligible orders: Delivered AND Not Reviewed
        const eligibleOrders = orders
          .filter((o: any) => {
            const status = (o.status || o.orderStatus);
            return status === "DELIVERED" && !reviewedOrderIds.has(o._id);
          })
          .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        // Find the first one that hasn't been dismissed locally
        const orderToReview = eligibleOrders.find((o: any) => {
          return !localStorage.getItem(`review_dismissed_${o._id}`);
        });

        if (orderToReview) {
          // Be gentle, wait a few seconds before popping up
          setTimeout(() => setPendingReviewOrder(orderToReview), 2000);
        }
      }).catch(() => { });
    }
  }, [isAuthenticated, isAdmin]);

  const handleCloseReview = () => {
    if (pendingReviewOrder) {
      localStorage.setItem(`review_dismissed_${pendingReviewOrder._id}`, "true");
      setPendingReviewOrder(null);
    }
  };

  const { data: categories, isLoading: catLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: () => menuApi.getCategories().then((r) => r.data),
  });

  // Fetch admin-configured hero videos
  const { data: heroVideosData } = useQuery({
    queryKey: ["hero-videos"],
    queryFn: () => restaurantApi.getVideos().then((r) => r.data.videos as string[]),
  });

  // Admin videos are ALWAYS shown first.
  // Empty slots are filled with randomly-picked local fallbacks (stable, no reshuffling on re-render).
  const videos = useMemo(() => {
    const cloudinary = heroVideosData || [];
    const needed = 3 - cloudinary.length;
    if (needed <= 0) return cloudinary.slice(0, 3); // all 3 from cloudinary
    const shuffled = [...FALLBACK_VIDEOS].sort(() => Math.random() - 0.5);
    return [...cloudinary, ...shuffled.slice(0, needed)]; // admin first, fallback fills the rest
  }, [heroVideosData]);



  /* ──────────────── Menu Fetching Logic ──────────────── */
  // Per user request, we use specific endpoints based on interaction
  const { data: rawMenuItems, isLoading: menuLoading } = useQuery({
    queryKey: ["menu", category, vegOnly, debouncedSearch],
    queryFn: async () => {
      if (category) {
        const res = await menuApi.getCategoryById(category);
        let products = res.data.products || [];
        if (vegOnly) products = products.filter((p: any) => p.type === "Veg");
        return products;
      } else {
        const res = await menuApi.getMenu({
          type: vegOnly ? "Veg" : undefined,
          search: debouncedSearch || undefined,
        });
        return res.data;
      }
    },
  });

  // Client-side filter uses live `search` for instant results (no flash)
  // API call uses debouncedSearch to avoid spamming the server
  const menuItems = search
    ? rawMenuItems?.filter((p: any) =>
      p.name.toLowerCase().includes(search.toLowerCase())
    )
    : rawMenuItems;

  // Admin users go to /admin — this page is customer-only
  if (isAdminUser) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-5xl">👨‍🍳</p>
          <h2 className="mt-4 text-xl font-bold text-foreground">Admin Mode</h2>
          <p className="mt-1 text-sm text-muted-foreground">Use the Dashboard to manage your restaurant</p>
          <a href="/admin" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-transform hover:scale-105">
            Go to Dashboard <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero — Premium Single Restaurant */}
      <section className="relative overflow-hidden">
        {/* Video Background */}
        <video
          ref={videoRef}
          key={currentVideoIndex}
          src={videos[currentVideoIndex]}
          autoPlay
          muted
          playsInline
          onEnded={() => {
            setVideoVisible(false);
            setTimeout(() => {
              setCurrentVideoIndex((prev) => (prev + 1) % videos.length);
              setVideoVisible(true);
            }, 400);
          }}
          className={`absolute top-0 left-0 w-full h-full object-cover object-center z-0 transition-opacity duration-500 ${videoVisible ? "opacity-100" : "opacity-0"
            }`}
        />
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/35 z-[1]" />

        <div className="relative z-10 container mx-auto px-4 py-28 md:py-44 min-h-[55vh] flex flex-col justify-center">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm font-semibold uppercase tracking-widest text-primary"
          >
            Welcome to {restaurant?.name || "our kitchen"}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="mt-3 text-4xl font-black leading-tight tracking-tight text-white md:text-6xl"
          >
            Crafted with <span className="text-primary">passion</span>,<br />
            served with love.
          </motion.h1>


          {/* Search */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-8 flex max-w-xl items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 shadow-2xl backdrop-blur-xl"
          >
            <Search className="h-5 w-5 text-white/60" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                // Clear category filter when user starts searching
                if (e.target.value) setCategory("");
              }}
              placeholder={placeholder}
              className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
            />
            <button
              onClick={() => setVegOnly(!vegOnly)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${vegOnly
                ? "bg-swiggy-success text-white"
                : "bg-white/10 text-white/80 hover:bg-white/20"
                }`}
            >
              <div className={`h-2.5 w-2.5 rounded-sm border ${vegOnly ? "border-white bg-white" : "border-swiggy-success bg-swiggy-success"}`} />
              Veg
            </button>
          </motion.div>
        </div>
      </section>

      {/* Categories — hidden when user is searching */}
      {!search && (
        <section className="container mx-auto px-4 pt-8 pb-4">
          <h2 className="mb-5 text-lg font-bold text-foreground">What's on your mind?</h2>
          {catLoading ? (
            <div className="flex gap-6 overflow-hidden">
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonCategory key={i} />
              ))}
            </div>
          ) : (
            <CategoryCarousel
              categories={categories || []}
              selected={category}
              onSelect={setCategory}
            />
          )}
        </section>
      )}

      {/* Divider — hidden when searching */}
      {!search && (
        <div className="container mx-auto px-4">
          <div className="border-t border-border" />
        </div>
      )}

      {/* ── Today's Deals Section ─────────────────────────────────────── */}
      {!search && !category && (() => {
        const dealItems = (rawMenuItems || []).filter((p: any) => p.hasDiscount && p.originalPrice);
        if (dealItems.length === 0) return null;
        return (
          <section className="container mx-auto px-4 pt-8 pb-2">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-red-500 shadow-md">
                  <Zap className="h-4 w-4 text-white" fill="white" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-foreground leading-tight">Today's Deals</h2>
                  <p className="text-[11px] text-muted-foreground">Limited time offers on your favourites</p>
                </div>
              </div>
              <span className="text-xs font-bold text-primary flex items-center gap-0.5">
                {dealItems.length} offers <ChevronRight className="h-3 w-3" />
              </span>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 scroll-smooth no-scrollbar">
              {dealItems.map((item: any) => {
                let effectiveItem = item;
                if (typeof item.category === "string" && categories) {
                  const foundCat = categories.find((c: any) => c._id === item.category);
                  if (foundCat) {
                    effectiveItem = { ...item, category: foundCat };
                  }
                }

                return (
                  <div key={`deal-${item._id}`} className="flex-shrink-0 w-[85vw] sm:w-[320px] pb-4">
                    <ProductCard item={effectiveItem} />
                  </div>
                );
              })}
            </div>

            <div className="border-t border-border" />
          </section>
        );
      })()}

      {/* Menu Grid */}
      <section className="container mx-auto px-4 pt-10 pb-8">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">
            {category
              ? `${categories?.find((c: any) => c._id === category)?.name || "Category"}`
              : search
                ? `Results for "${search}"`
                : "Our Menu"}
          </h2>
          <span className="text-sm text-muted-foreground">
            {menuItems?.length || 0} items
          </span>
        </div>

        {menuLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : menuItems?.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-20 text-center"
          >
            <p className="text-4xl">🍽️</p>
            <p className="mt-3 text-sm font-medium text-muted-foreground">No items found</p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {menuItems?.map((item: any) => {
              // Fix: If category is just an ID (string), look it up from cached categories to show Name instead of ID
              let effectiveItem = item;
              if (typeof item.category === "string" && categories) {
                const foundCat = categories.find((c: any) => c._id === item.category);
                if (foundCat) {
                  effectiveItem = { ...item, category: foundCat };
                }
              }
              return <ProductCard key={item._id} item={effectiveItem} />;
            })}
          </motion.div>
        )}
      </section>

      {/* Review Modal Prompt */}
      {pendingReviewOrder && (
        <ReviewModal
          isOpen={!!pendingReviewOrder}
          onClose={handleCloseReview}
          orderId={pendingReviewOrder._id}
          orderDetails={{
            customId: pendingReviewOrder.customId || `#${pendingReviewOrder._id.slice(-6).toUpperCase()}`,
            items: pendingReviewOrder.items
          }}
        />
      )}
    </div>
  );
};

export default Index;
