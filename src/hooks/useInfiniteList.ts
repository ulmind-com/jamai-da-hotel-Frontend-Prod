import { useInfiniteQuery } from "@tanstack/react-query";

/**
 * Reusable infinite-scroll list hook for admin pages.
 * Works with the backend's backward-compatible pagination:
 *   - paginated response: { data, page, hasMore, ...meta }
 *   - legacy response: plain array (treated as a single, complete page)
 *
 * Usage:
 *   const { items, meta, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
 *     useInfiniteList(["admin-orders", filters], (p) => adminApi.getOrders({ ...filters, ...p }));
 */
export function useInfiniteList<T = any>(
  queryKey: any[],
  fetcher: (params: { page: number; limit: number }) => Promise<any>,
  opts?: { limit?: number; enabled?: boolean }
) {
  const limit = opts?.limit ?? 20;

  const query = useInfiniteQuery({
    queryKey,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const res = await fetcher({ page: pageParam as number, limit });
      const d = res?.data;
      if (Array.isArray(d)) {
        return { data: d as T[], page: 1, hasMore: false, meta: {} as any };
      }
      return {
        data: (d?.data ?? []) as T[],
        page: d?.page ?? (pageParam as number),
        hasMore: !!d?.hasMore,
        meta: d ?? {},
      };
    },
    getNextPageParam: (last: any) => (last?.hasMore ? last.page + 1 : undefined),
    ...(opts?.enabled !== undefined ? { enabled: opts.enabled } : {}),
  });

  const items: T[] = (query.data?.pages ?? []).flatMap((p: any) => p.data as T[]);
  const meta: any = query.data?.pages?.[0]?.meta ?? {};

  return { ...query, items, meta };
}
