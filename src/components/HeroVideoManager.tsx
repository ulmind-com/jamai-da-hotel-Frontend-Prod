import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { restaurantApi, uploadApi } from "@/api/axios";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Trash2, Film, Plus, Loader2, AlertCircle } from "lucide-react";

const MAX_VIDEOS = 3;
const MAX_SIZE_MB = 5;

const HeroVideoManager = () => {
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ["hero-videos"],
        queryFn: () => restaurantApi.getVideos().then((r) => r.data.videos as string[]),
    });

    const videos: string[] = data || [];

    const addMutation = useMutation({
        mutationFn: (url: string) => restaurantApi.addVideo({ url }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["hero-videos"] });
            toast.success("Video added to hero section!");
        },
        onError: () => toast.error("Failed to add video."),
    });

    const deleteMutation = useMutation({
        mutationFn: (index: number) => restaurantApi.deleteVideo(index),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["hero-videos"] });
            toast.success("Video removed.");
        },
        onError: () => toast.error("Failed to remove video."),
    });

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = ""; // reset input
        if (!file) return;

        // ── Validate size ──────────────────────────
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
            toast.error(`Video must be under ${MAX_SIZE_MB}MB.`);
            return;
        }

        // ── Validate 16:9 ratio via a temporary <video> element ──
        const checkRatio = () =>
            new Promise<boolean>((resolve) => {
                const video = document.createElement("video");
                video.preload = "metadata";
                video.onloadedmetadata = () => {
                    window.URL.revokeObjectURL(video.src);
                    const ratio = video.videoWidth / video.videoHeight;
                    // Allow some tolerance (16:9 = 1.777...) ±5%
                    resolve(Math.abs(ratio - 16 / 9) < 0.1);
                };
                video.onerror = () => resolve(true); // skip check on error
                video.src = URL.createObjectURL(file);
            });

        const isCorrectRatio = await checkRatio();
        if (!isCorrectRatio) {
            toast.error("Video must be 16:9 aspect ratio (landscape).");
            return;
        }

        if (videos.length >= MAX_VIDEOS) {
            toast.error(`Maximum ${MAX_VIDEOS} videos allowed. Delete one first.`);
            return;
        }

        // ── Upload ─────────────────────────────────
        try {
            setIsUploading(true);
            setUploadProgress(0);
            const res = await uploadApi.uploadVideo(file, setUploadProgress);
            const url = res.data.url as string;
            await addMutation.mutateAsync(url);
        } catch {
            toast.error("Upload failed. Please try again.");
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                    <Film className="h-6 w-6 text-primary" />
                    Hero Videos
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Manage the rotating background videos shown in the customer hero section.
                    Up to <strong>3 videos</strong> · 16:9 ratio · Max {MAX_SIZE_MB}MB each.
                </p>
            </div>

            {/* Upload button */}
            <div>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/mp4,video/webm,video/mov"
                    className="hidden"
                    onChange={handleFileSelect}
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading || videos.length >= MAX_VIDEOS}
                    className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-md transition-all hover:scale-105 disabled:pointer-events-none disabled:opacity-50"
                >
                    {isUploading ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Uploading {uploadProgress}%</>
                    ) : (
                        <><Plus className="h-4 w-4" /> Add Video</>
                    )}
                </button>

                {/* Upload progress bar */}
                {isUploading && (
                    <div className="mt-3 h-2 w-full max-w-md rounded-full bg-muted overflow-hidden">
                        <motion.div
                            className="h-full rounded-full bg-primary"
                            initial={{ width: 0 }}
                            animate={{ width: `${uploadProgress}%` }}
                            transition={{ ease: "linear", duration: 0.2 }}
                        />
                    </div>
                )}
            </div>

            {/* Slot limit info */}
            {videos.length >= MAX_VIDEOS && (
                <div className="flex items-center gap-2 rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-300">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    Maximum 3 videos reached. Delete a video before adding a new one.
                </div>
            )}

            {/* Video Grid */}
            {isLoading ? (
                <div className="grid gap-4 sm:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="aspect-video rounded-2xl bg-muted animate-pulse" />
                    ))}
                </div>
            ) : videos.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border py-16 text-center text-muted-foreground">
                    <Upload className="mb-3 h-10 w-10 opacity-30" />
                    <p className="text-sm font-medium">No hero videos yet</p>
                    <p className="mt-1 text-xs">Click "Add Video" to upload the first one</p>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-3">
                    <AnimatePresence>
                        {videos.map((url, index) => (
                            <motion.div
                                key={url}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="group relative aspect-video overflow-hidden rounded-2xl border border-border bg-black shadow-md"
                            >
                                <video
                                    src={url}
                                    muted
                                    playsInline
                                    loop
                                    className="h-full w-full object-cover"
                                    onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play()}
                                    onMouseLeave={(e) => {
                                        const v = e.currentTarget as HTMLVideoElement;
                                        v.pause();
                                        v.currentTime = 0;
                                    }}
                                />
                                {/* Slot label */}
                                <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-bold text-white">
                                    Slot {index + 1}
                                </span>
                                {/* Delete button */}
                                <button
                                    onClick={() => deleteMutation.mutate(index)}
                                    disabled={deleteMutation.isPending}
                                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-600/90 text-white opacity-0 shadow transition-all hover:bg-red-700 group-hover:opacity-100 disabled:pointer-events-none"
                                    title="Delete video"
                                >
                                    {deleteMutation.isPending ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <Trash2 className="h-3.5 w-3.5" />
                                    )}
                                </button>
                                {/* Hover-to-preview hint */}
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 text-center text-xs text-white/70 opacity-0 transition-opacity group-hover:opacity-100">
                                    Hover to preview
                                </div>
                            </motion.div>
                        ))}
                        {/* Empty slots */}
                        {Array.from({ length: MAX_VIDEOS - videos.length }).map((_, i) => (
                            <motion.div
                                key={`empty-${i}`}
                                className="flex aspect-video cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Plus className="h-6 w-6" />
                                <span className="mt-1 text-xs font-medium">Add video</span>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
};

export default HeroVideoManager;
