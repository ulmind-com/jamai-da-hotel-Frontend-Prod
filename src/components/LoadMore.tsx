import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

/**
 * Auto-loads the next page when scrolled into view (IntersectionObserver),
 * with a manual "Load more" button fallback.
 */
export default function LoadMore({
  hasMore,
  isFetching,
  onLoad,
  label = "Load more",
}: {
  hasMore: boolean;
  isFetching: boolean;
  onLoad: () => void;
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetching) onLoad();
      },
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, isFetching, onLoad]);

  if (!hasMore) return null;

  return (
    <div ref={ref} className="flex justify-center py-6">
      <button
        onClick={onLoad}
        disabled={isFetching}
        className="flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-bold text-foreground shadow-sm transition-colors hover:bg-accent disabled:opacity-60"
      >
        {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {isFetching ? "Loading…" : label}
      </button>
    </div>
  );
}
