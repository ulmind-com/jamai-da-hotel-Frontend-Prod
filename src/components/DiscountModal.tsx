import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { menuApi } from "@/api/axios";
import { toast } from "sonner";
import { Loader2, Tag, Clock } from "lucide-react";
import { motion } from "framer-motion";

interface DiscountModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: any;
    onSuccess: () => void;
}

export default function DiscountModal({ isOpen, onClose, item, onSuccess }: DiscountModalProps) {
    const [percentage, setPercentage] = useState<number | "">("");
    const [hours, setHours] = useState<number | "">("");
    const [minutes, setMinutes] = useState<number | "">("");
    const [loading, setLoading] = useState(false);
    const [removing, setRemoving] = useState(false);

    useEffect(() => {
        if (isOpen && item) {
            setPercentage("");
            setHours("");
            setMinutes("");
        }
    }, [isOpen, item]);

    const handleApply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!item) return;
        if (!percentage || Number(percentage) <= 0 || Number(percentage) > 100) {
            toast.error("Please enter a valid percentage (1-100)");
            return;
        }
        if ((!hours && !minutes) || (Number(hours) === 0 && Number(minutes) === 0)) {
            toast.error("Please enter a duration");
            return;
        }

        setLoading(true);
        try {
            await menuApi.applyDiscount(item._id, {
                percentage: Number(percentage),
                duration: {
                    hours: Number(hours) || 0,
                    minutes: Number(minutes) || 0,
                },
            });
            toast.success(`Discount applied to ${item.name}!`);
            onSuccess();
            onClose();
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to apply discount");
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = async () => {
        if (!item) return;
        setRemoving(true);
        try {
            await menuApi.removeDiscount(item._id);
            toast.success("Discount removed!");
            onSuccess();
            onClose();
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to remove discount");
        } finally {
            setRemoving(false);
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="overflow-hidden border-none bg-transparent p-0 shadow-none sm:max-w-md">
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="relative max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-card/95 p-8 shadow-2xl backdrop-blur-xl"
                >
                    <div className="flex items-center justify-between mb-6">
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <Tag className="h-5 w-5 text-swiggy-orange" />
                            Manage Discount
                        </DialogTitle>
                    </div>

                    <div className="mb-6">
                        <h3 className="font-semibold text-lg">{item?.name}</h3>
                        <p className="text-sm text-muted-foreground">
                            Original Price: ₹{item?.originalPrice || item?.price || item?.variants?.[0]?.price || 0}
                        </p>
                        {item?.discountPercentage > 0 && (
                            <div className="mt-2 text-sm bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded-md inline-block">
                                Active Discount: {item.discountPercentage}% OFF
                            </div>
                        )}
                    </div>

                    <form onSubmit={handleApply} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Discount Percentage (%)</label>
                            <input
                                type="number"
                                min="1"
                                max="100"
                                value={percentage}
                                onChange={(e) => setPercentage(Number(e.target.value))}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 focus:ring-2 focus:ring-primary/20 outline-none"
                                placeholder="e.g. 20"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Duration</label>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <div className="relative">
                                        <input
                                            type="number"
                                            min="0"
                                            value={hours}
                                            onChange={(e) => setHours(Number(e.target.value))}
                                            className="w-full rounded-lg border border-border bg-background px-3 py-2 pl-9 focus:ring-2 focus:ring-primary/20 outline-none"
                                            placeholder="0"
                                        />
                                        <Clock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    </div>
                                    <span className="text-xs text-muted-foreground mt-1 ml-1">Hours</span>
                                </div>
                                <div className="flex-1">
                                    <div className="relative">
                                        <input
                                            type="number"
                                            min="0"
                                            max="59"
                                            value={minutes}
                                            onChange={(e) => setMinutes(Number(e.target.value))}
                                            className="w-full rounded-lg border border-border bg-background px-3 py-2 pl-9 focus:ring-2 focus:ring-primary/20 outline-none"
                                            placeholder="0"
                                        />
                                        <Clock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    </div>
                                    <span className="text-xs text-muted-foreground mt-1 ml-1">Minutes</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4">
                            {item?.hasDiscount && (
                                <button
                                    type="button"
                                    onClick={handleRemove}
                                    disabled={loading || removing}
                                    className="flex-1 rounded-xl border border-red-200 bg-red-50 text-red-600 py-3 font-semibold hover:bg-red-100 disabled:opacity-50 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400 decoration-0"
                                >
                                    {removing ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Remove"}
                                </button>
                            )}
                            <button
                                type="submit"
                                disabled={loading || removing}
                                className="flex-1 rounded-xl bg-primary text-primary-foreground py-3 font-semibold hover:opacity-90 disabled:opacity-50 shadow-lg active:scale-95 transition-transform"
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Apply Discount"}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </DialogContent>
        </Dialog>
    );
}
