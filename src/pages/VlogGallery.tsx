import { useQuery, useQueryClient } from '@tanstack/react-query';
import { vlogApi } from '@/api/axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Film, Eye, Play, ArrowLeft, X, Clock, Volume2, VolumeX, Pause } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useRestaurantStore } from '@/store/useRestaurantStore';
import { resolveImageURL } from '@/lib/image-utils';

function timeAgo(dateStr: string) {
    const now = new Date();
    const d = new Date(dateStr);
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/* ── Inline Video Player with autoplay-on-scroll, tap-to-pause, mute toggle ── */
function InlineVideoPlayer({ src, thumbnail, title, onView, vlogId }: { src: string; thumbnail?: string; title: string, onView: (id: string) => void, vlogId: string }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [showPlayPause, setShowPlayPause] = useState(false);
    const hideTimeout = useRef<ReturnType<typeof setTimeout>>();

    // IntersectionObserver: auto-play when ≥60% visible, pause when not
    useEffect(() => {
        const video = videoRef.current;
        const container = containerRef.current;
        if (!video || !container) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    video.play().then(() => {
                        setIsPlaying(true);
                        onView(vlogId); // Count view when successfully auto-played and visible
                    }).catch(() => { });
                } else {
                    video.pause();
                    setIsPlaying(false);
                }
            },
            { threshold: 0.6 }
        );

        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    const togglePlayPause = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;

        if (video.paused) {
            video.play().then(() => setIsPlaying(true)).catch(() => { });
        } else {
            video.pause();
            setIsPlaying(false);
        }

        // Flash the play/pause indicator
        setShowPlayPause(true);
        clearTimeout(hideTimeout.current);
        hideTimeout.current = setTimeout(() => setShowPlayPause(false), 800);
    }, []);

    const toggleMute = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        const video = videoRef.current;
        if (!video) return;
        video.muted = !video.muted;
        setIsMuted(video.muted);
    }, []);

    return (
        <div ref={containerRef} className="relative w-full bg-black overflow-hidden cursor-pointer" onClick={togglePlayPause}>
            <video
                ref={videoRef}
                src={src}
                poster={thumbnail || undefined}
                className="w-full aspect-[4/5] object-cover"
                loop
                autoPlay
                muted={isMuted}
                playsInline
                preload="metadata"
            />

            {/* REEL badge */}
            <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 pointer-events-none">
                <Film className="h-2.5 w-2.5" /> REEL
            </div>

            {/* Mute / Unmute button */}
            <button
                onClick={toggleMute}
                className="absolute bottom-3 right-3 p-2 bg-black/50 backdrop-blur-sm text-white rounded-full hover:bg-black/70 transition-colors z-10"
            >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>

            {/* Play/Pause flash indicator */}
            <AnimatePresence>
                {showPlayPause && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    >
                        <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                            {isPlaying
                                ? <Pause className="h-7 w-7 text-white" fill="white" />
                                : <Play className="h-7 w-7 text-white ml-0.5" fill="white" />}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default function VlogGallery() {
    const restaurant = useRestaurantStore((s) => s.restaurant);
    const queryClient = useQueryClient();

    // Track viewed vlogs in current session to prevent spam tracking
    const viewedVlogsRef = useRef<Set<string>>(new Set());

    const { data: vlogs = [], isLoading } = useQuery({
        queryKey: ['public-vlogs'],
        queryFn: async () => {
            const res = await vlogApi.getPublicVlogs();
            return res.data;
        },
    });

    const [selectedVlog, setSelectedVlog] = useState<any>(null);

    const handleView = useCallback((vlogId: string) => {
        if (!viewedVlogsRef.current.has(vlogId)) {
            viewedVlogsRef.current.add(vlogId);

            // Optimistic update
            queryClient.setQueryData(['public-vlogs'], (oldData: any) => {
                if (!oldData) return oldData;
                return oldData.map((v: any) =>
                    v._id === vlogId ? { ...v, views: (v.views || 0) + 1 } : v
                );
            });

            // Fire and forget API call
            vlogApi.incrementView(vlogId).catch(() => {
                // Revert optimistic update if API fails (optional, simple silent fail here)
                viewedVlogsRef.current.delete(vlogId);
            });
        }
    }, [queryClient]);

    const openVlog = (vlog: any) => {
        if (vlog.mediaType !== 'VIDEO') {
            setSelectedVlog(vlog);
            handleView(vlog._id);
        }
    };

    const restLogo = restaurant?.logo ? resolveImageURL(restaurant.logo) : '';
    const restName = restaurant?.name || 'Our Kitchen';

    return (
        <div className="min-h-screen bg-background">
            {/* Sticky Header */}
            <div className="sticky top-0 z-30 bg-background/90 backdrop-blur-xl border-b border-border">
                <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link to="/" className="p-1.5 -ml-1 hover:bg-muted rounded-xl transition-colors">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <h1 className="text-xl font-extrabold tracking-tight text-foreground">Stories</h1>
                    </div>
                    <Film className="h-5 w-5 text-primary" />
                </div>
            </div>

            {/* Feed */}
            <div className="max-w-xl mx-auto">
                {isLoading ? (
                    <div className="space-y-4 p-4">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="animate-pulse space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-muted" />
                                    <div className="h-3 w-28 bg-muted rounded" />
                                </div>
                                <div className="aspect-[4/5] bg-muted rounded-xl" />
                                <div className="h-3 w-48 bg-muted rounded" />
                            </div>
                        ))}
                    </div>
                ) : vlogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 px-4 text-center text-muted-foreground">
                        <div className="w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center mb-6">
                            <Film className="h-10 w-10 opacity-30" />
                        </div>
                        <p className="text-lg font-semibold">No stories yet</p>
                        <p className="text-sm mt-1 opacity-60">Check back soon for updates! 📸</p>
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {vlogs.map((vlog: any, index: number) => (
                            <motion.article
                                key={vlog._id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.08 }}
                                className="pb-2"
                            >
                                {/* Post Header */}
                                <div className="flex items-center gap-3 px-4 py-3">
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary via-orange-500 to-pink-500 p-[2px] flex-shrink-0">
                                        <div className="w-full h-full rounded-full bg-background flex items-center justify-center overflow-hidden">
                                            {restLogo ? (
                                                <img src={restLogo} className="w-full h-full object-cover" alt="" />
                                            ) : (
                                                <Film className="h-4 w-4 text-primary" />
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-foreground leading-tight truncate">{restName}</p>
                                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                            <Clock className="h-2.5 w-2.5" /> {timeAgo(vlog.createdAt)}
                                        </p>
                                    </div>
                                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Eye className="h-3.5 w-3.5" /> {vlog.views || 0}
                                    </span>
                                </div>

                                {/* Media — Full Bleed */}
                                {vlog.mediaType === 'VIDEO' ? (
                                    <InlineVideoPlayer
                                        src={vlog.mediaUrl}
                                        thumbnail={vlog.thumbnailUrl}
                                        title={vlog.title}
                                        onView={handleView}
                                        vlogId={vlog._id}
                                    />
                                ) : (
                                    <button onClick={() => openVlog(vlog)} className="relative w-full block bg-muted overflow-hidden group">
                                        <img
                                            src={vlog.mediaUrl}
                                            className="w-full aspect-[4/5] object-cover group-hover:scale-[1.02] transition-transform duration-500"
                                            alt={vlog.title}
                                        />
                                    </button>
                                )}

                                {/* Caption */}
                                <div className="px-4 py-3">
                                    <p className="text-sm text-foreground">
                                        <span className="font-bold mr-1.5">{restName}</span>
                                        {vlog.title}
                                    </p>
                                    {vlog.description && (
                                        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{vlog.description}</p>
                                    )}
                                </div>
                            </motion.article>
                        ))}
                    </div>
                )}

                {/* Bottom Spacer */}
                <div className="h-20" />
            </div>

            {/* Fullscreen Viewer (Images only) */}
            <AnimatePresence>
                {selectedVlog && (
                    <VlogViewer vlog={selectedVlog} onClose={() => setSelectedVlog(null)} restName={restName} restLogo={restLogo} />
                )}
            </AnimatePresence>
        </div>
    );
}

function VlogViewer({ vlog, onClose, restName, restLogo }: { vlog: any; onClose: () => void; restName: string; restLogo: string }) {
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
            onClick={onClose}
        >
            <button
                onClick={onClose}
                className="absolute top-4 right-4 z-50 p-2.5 text-white/80 bg-white/10 backdrop-blur-md rounded-full hover:bg-white/20 transition-colors"
            >
                <X className="h-5 w-5" />
            </button>

            <div className="relative w-full max-w-lg mx-4 max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center gap-3 px-2 pb-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary via-orange-500 to-pink-500 p-[2px]">
                        <div className="w-full h-full rounded-full bg-black flex items-center justify-center overflow-hidden">
                            {restLogo ? <img src={restLogo} className="w-full h-full object-cover" alt="" /> : <Film className="h-4 w-4 text-white" />}
                        </div>
                    </div>
                    <div>
                        <p className="text-white text-sm font-bold">{restName}</p>
                        <p className="text-white/40 text-[11px]">{timeAgo(vlog.createdAt)}</p>
                    </div>
                </div>

                {/* Media */}
                <div className="flex-1 flex items-center justify-center rounded-2xl overflow-hidden bg-black">
                    <img src={vlog.mediaUrl} className="w-full max-h-[70vh] object-contain rounded-xl" alt={vlog.title} />
                </div>

                {/* Caption */}
                <div className="pt-4 px-2">
                    <p className="text-white text-base">
                        <span className="font-bold mr-2">{restName}</span>
                        {vlog.title}
                    </p>
                    {vlog.description && (
                        <p className="text-white/50 text-sm mt-1">{vlog.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-white/30 text-xs">
                        <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {vlog.views || 0} views</span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
