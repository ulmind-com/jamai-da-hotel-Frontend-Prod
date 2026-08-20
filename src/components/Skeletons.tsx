const SkeletonCard = () => (
  <div className="flex gap-4 rounded-2xl border border-border bg-card p-4">
    <div className="flex flex-1 flex-col gap-2">
      <div className="shimmer h-3 w-12 rounded" />
      <div className="shimmer h-4 w-3/4 rounded" />
      <div className="shimmer h-3 w-16 rounded" />
      <div className="shimmer mt-2 h-3 w-full rounded" />
      <div className="shimmer h-3 w-2/3 rounded" />
    </div>
    <div className="shimmer h-28 w-28 flex-shrink-0 rounded-xl" />
  </div>
);

const SkeletonCategory = () => (
  <div className="flex flex-shrink-0 flex-col items-center gap-2">
    <div className="shimmer h-20 w-20 rounded-full" />
    <div className="shimmer h-3 w-14 rounded" />
  </div>
);

export { SkeletonCard, SkeletonCategory };
