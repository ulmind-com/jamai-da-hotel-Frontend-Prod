import { useQuery } from "@tanstack/react-query";
import { reviewApi } from "@/api/axios";
import { Star, MessageSquare, TrendingUp, Users } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import LoadMore from "@/components/LoadMore";

const AdminReviews = () => {
    const { data: stats, isLoading: statsLoading } = useQuery({
        queryKey: ["review-stats"],
        queryFn: () => reviewApi.getStats().then((r) => r.data),
    });

    const {
        items: reviews,
        isLoading: reviewsLoading,
        hasNextPage,
        isFetchingNextPage,
        fetchNextPage,
    } = useInfiniteList<any>(["admin-reviews"], (p) => reviewApi.getAdminReviews(p));

    const isLoading = statsLoading || reviewsLoading;

    // Calculate derived stats from checks if API doesn't provide them
    const totalReviews = stats?.totalReviews || reviews?.length || 0;
    const averageRating = stats?.averageRating ? Number(stats.averageRating) : 0;
    const fiveStarCount = reviews?.filter((r: any) => r.rating === 5).length || 0;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h2 className="text-xl font-bold text-foreground">Reviews & Ratings</h2>
                <p className="text-sm text-muted-foreground">Monitor customer feedback and satisfaction</p>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <StatsCard
                    label="Total Reviews"
                    value={totalReviews}
                    icon={MessageSquare}
                    loading={isLoading}
                    className="bg-blue-500/10 text-blue-600"
                />
                <StatsCard
                    label="Average Rating"
                    value={averageRating.toFixed(1)}
                    icon={Star}
                    loading={isLoading}
                    className="bg-yellow-500/10 text-yellow-600"
                />
                <StatsCard
                    label="5 Star Reviews"
                    value={fiveStarCount}
                    icon={TrendingUp}
                    loading={isLoading}
                    className="bg-green-500/10 text-green-600"
                />
                <StatsCard
                    label="Active Reviewers"
                    value={totalReviews} // Placeholder if unique users not available easily
                    icon={Users}
                    loading={isLoading}
                    className="bg-purple-500/10 text-purple-600"
                />
            </div>

            {/* Reviews Table */}
            <div className="rounded-2xl border border-border bg-card shadow-sm">
                <div className="flex items-center justify-between border-b border-border p-6">
                    <h3 className="text-lg font-bold text-foreground">Recent Reviews</h3>
                </div>

                <div className="overflow-x-auto">
                    {isLoading ? (
                        <div className="space-y-4 p-6">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <Skeleton key={i} className="h-16 w-full rounded-xl" />
                            ))}
                        </div>
                    ) : !reviews?.length ? (
                        <div className="p-12 text-center text-muted-foreground">No reviews found.</div>
                    ) : (
                        <table className="w-full min-w-[800px] text-left text-sm">
                            <thead className="bg-muted/50 text-muted-foreground">
                                <tr>
                                    <th className="px-6 py-4 font-medium">Customer</th>
                                    <th className="px-6 py-4 font-medium">Order</th>
                                    <th className="px-6 py-4 font-medium">Items</th>
                                    <th className="px-6 py-4 font-medium">Rating</th>
                                    <th className="px-6 py-4 font-medium">Comment</th>
                                    <th className="px-6 py-4 font-medium text-right">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {reviews.map((review: any) => (
                                    <tr key={review._id} className="group transition-colors hover:bg-muted/30">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary overflow-hidden">
                                                    {review.user?.profileImage ? (
                                                        <img src={review.user.profileImage} alt="" className="h-full w-full object-cover" />
                                                    ) : (
                                                        review.user?.name?.charAt(0) || "U"
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-foreground">{review.user?.name || "Anonymous"}</p>
                                                    <p className="text-xs text-muted-foreground">{review.user?.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-foreground uppercase text-xs">
                                                    {review.order && typeof review.order === "object"
                                                        ? review.order.customId || `#${review.order._id?.slice(-6).toUpperCase()}`
                                                        : `#${(typeof review.order === "string" ? review.order : "").slice(-6).toUpperCase() || "N/A"}`}
                                                </span>
                                                {review.order && typeof review.order === "object" && (
                                                    <span className="text-xs text-muted-foreground">
                                                        ₹{Number(review.order.finalAmount || 0).toFixed(2)}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs text-muted-foreground max-w-[150px]">
                                                {review.order && typeof review.order === "object" && review.order.items?.length > 0
                                                    ? review.order.items.map((i: any) => `${i.product?.name || "Item"} x${i.quantity}`).join(", ")
                                                    : "—"}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex text-yellow-500">
                                                {Array.from({ length: 5 }).map((_, i) => (
                                                    <Star
                                                        key={i}
                                                        className={`h-3 w-3 ${i < review.rating ? "fill-current" : "text-muted/30"}`}
                                                    />
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="max-w-xs truncate text-muted-foreground text-xs" title={review.comment}>
                                                {review.comment || "—"}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4 text-right text-xs text-muted-foreground">
                                            {format(new Date(review.createdAt), "dd MMM yyyy")}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                <LoadMore hasMore={!!hasNextPage} isFetching={isFetchingNextPage} onLoad={fetchNextPage} />
            </div>
        </div>
    );
};

const StatsCard = ({ label, value, icon: Icon, loading, className }: any) => (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md">
        <div className="flex items-center justify-between">
            <div>
                <p className="text-sm font-medium text-muted-foreground">{label}</p>
                {loading ? (
                    <Skeleton className="mt-2 h-8 w-16" />
                ) : (
                    <p className="mt-1 text-3xl font-bold text-foreground">{value}</p>
                )}
            </div>
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${className}`}>
                <Icon className="h-6 w-6" />
            </div>
        </div>
    </div>
);

export default AdminReviews;
