import { useState, useEffect } from "react";
import { Star, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { reviewApi } from "@/api/axios";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface ReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    orderId: string;
    onReviewSubmitted?: () => void;
    initialData?: { rating: number; comment: string } | null;
    orderDetails?: {
        customId: string;
        items: Array<{ name?: string; product?: { name: string }; menuItem?: { name: string }; quantity: number }>;
    };
}

const ReviewModal = ({ isOpen, onClose, orderId, onReviewSubmitted, initialData, orderDetails }: ReviewModalProps) => {
    const [rating, setRating] = useState(initialData?.rating || 5);
    const [comment, setComment] = useState(initialData?.comment || "");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const queryClient = useQueryClient();

    // Effect to reset or update state when modal opens or data changes
    useEffect(() => {
        if (isOpen) {
            setRating(initialData?.rating || 5);
            setComment(initialData?.comment || "");
        }
    }, [isOpen, initialData]);

    const handleSubmit = async () => {
        if (initialData) return; // Prevent re-submitting for now (View Only)

        if (!comment.trim()) {
            toast.error("Please add a comment");
            return;
        }

        setIsSubmitting(true);
        try {
            if (orderId) {
                await reviewApi.add({ orderId, rating, comment });
                toast.success("Review submitted! Thank you! ⭐");
                // Invalidate queries to refresh order list (and button state)
                queryClient.invalidateQueries({ queryKey: ["my-orders"] });
                queryClient.invalidateQueries({ queryKey: ["my-reviews"] });
                if (onReviewSubmitted) onReviewSubmitted();
                onClose();
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to submit review");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="w-full max-w-sm overflow-hidden rounded-2xl bg-card p-6 shadow-xl border border-border"
                >
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-foreground">Rate Your Order</h3>
                            {orderDetails && (
                                <div className="mt-1">
                                    <p className="text-xs font-semibold text-primary">{orderDetails.customId}</p>
                                    <p className="text-[10px] text-muted-foreground line-clamp-1">
                                        {orderDetails.items?.map(i => i.name || i.product?.name || i.menuItem?.name || "Item").join(", ")}
                                    </p>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            className="rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="flex flex-col items-center gap-4">
                        <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    onClick={() => setRating(star)}
                                    className="transition-transform hover:scale-110 active:scale-95 focus:outline-none"
                                >
                                    <Star
                                        className={`h-8 w-8 ${rating >= star
                                            ? "fill-yellow-400 text-yellow-400"
                                            : "fill-transparent text-muted-foreground/30"
                                            }`}
                                    />
                                </button>
                            ))}
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">
                            {rating === 5
                                ? "Excellent! 😍"
                                : rating === 4
                                    ? "Good! 🙂"
                                    : rating === 3
                                        ? "Average 😐"
                                        : rating === 2
                                            ? "Poor 😞"
                                            : "Very Bad 😡"}
                        </p>

                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder={initialData ? "No comment provided." : "Suggest anything we can improve..."}
                            disabled={!!initialData}
                            className="h-24 w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground outline-none focus:border-primary resize-none disabled:opacity-80 disabled:cursor-not-allowed"
                        />

                        {initialData ? (
                            <div className="w-full rounded-xl bg-muted py-3 text-center text-sm font-bold text-muted-foreground">
                                Review Submitted
                            </div>
                        ) : (
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? "Submitting..." : "Submit Review"}
                            </button>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default ReviewModal;
