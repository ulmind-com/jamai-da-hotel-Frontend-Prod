import React, { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { vlogApi, uploadApi } from '@/api/axios';
import { useInfiniteList } from '@/hooks/useInfiniteList';
import LoadMore from '@/components/LoadMore';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Eye, EyeOff, Film, Image as ImageIcon, Upload, X, Loader2, Play, Volume2, VolumeX } from 'lucide-react';

/* ── Hover-to-play video card ─────────────────────────────────────────────── */
function VideoCard({ src, thumbnail, title }: { src: string; thumbnail?: string; title: string }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [hovering, setHovering] = useState(false);

    const handleMouseEnter = () => {
        setHovering(true);
        videoRef.current?.play().catch(() => { });
    };

    const handleMouseLeave = () => {
        setHovering(false);
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
        }
    };

    return (
        <div
            className="w-full h-full relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {/* Thumbnail when not hovering */}
            {!hovering && (
                thumbnail ? (
                    <img src={thumbnail} className="w-full h-full object-cover" alt={title} />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                        <Play className="h-16 w-16 text-primary/40" />
                    </div>
                )
            )}
            {/* Video element (always mounted, but only shown on hover) */}
            <video
                ref={videoRef}
                src={src}
                className={`w-full h-full object-cover absolute inset-0 transition-opacity duration-300 ${hovering ? 'opacity-100' : 'opacity-0'}`}
                muted
                loop
                playsInline
                preload="metadata"
            />
            <div className="absolute top-3 left-3 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1 backdrop-blur-sm pointer-events-none">
                <Film className="h-3 w-3" /> VIDEO
            </div>
            {/* Play icon when not hovering */}
            {!hovering && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center border border-white/20">
                        <Play className="h-5 w-5 text-white ml-0.5" fill="white" />
                    </div>
                </div>
            )}
        </div>
    );
}

export default function AdminVlogs() {
    const queryClient = useQueryClient();
    const [showModal, setShowModal] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [mediaType, setMediaType] = useState<'IMAGE' | 'VIDEO'>('IMAGE');
    const [uploading, setUploading] = useState(false);
    const [mediaUrl, setMediaUrl] = useState('');
    const [thumbnailUrl, setThumbnailUrl] = useState('');
    const [previewVlog, setPreviewVlog] = useState<any>(null);

    const {
        items: vlogs,
        isLoading,
        hasNextPage,
        isFetchingNextPage,
        fetchNextPage,
    } = useInfiniteList<any>(['admin-vlogs'], (p) => vlogApi.getAdminVlogs(p));

    const createMutation = useMutation({
        mutationFn: vlogApi.createVlog,
        onSuccess: () => {
            toast.success('Post published successfully! 🎉');
            queryClient.invalidateQueries({ queryKey: ['admin-vlogs'] });
            resetForm();
        },
        onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to create post'),
    });

    const deleteMutation = useMutation({
        mutationFn: vlogApi.deleteVlog,
        onSuccess: () => {
            toast.success('Post deleted');
            queryClient.invalidateQueries({ queryKey: ['admin-vlogs'] });
        },
        onError: () => toast.error('Failed to delete'),
    });

    const togglePublish = useMutation({
        mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) =>
            vlogApi.updateVlog(id, { isPublished }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-vlogs'] });
            toast.success('Visibility updated');
        },
    });

    const resetForm = () => {
        setShowModal(false);
        setTitle('');
        setDescription('');
        setMediaUrl('');
        setThumbnailUrl('');
        setMediaType('IMAGE');
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'media' | 'thumbnail') => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            let url: string;
            if (type === 'media' && mediaType === 'VIDEO') {
                const res = await uploadApi.uploadVideo(file);
                url = res.data.url;
            } else {
                const res = await uploadApi.uploadImage(file);
                url = res.data.url;
            }

            if (url) {
                if (type === 'media') setMediaUrl(url);
                else setThumbnailUrl(url);
                toast.success(`${type === 'media' ? 'Media' : 'Thumbnail'} uploaded!`);
            } else {
                toast.error('Upload failed');
            }
        } catch (err) {
            console.error('Upload error:', err);
            toast.error('Upload failed. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = () => {
        if (!title.trim()) return toast.error('Title is required');
        if (!mediaUrl) return toast.error('Please upload media first');

        createMutation.mutate({
            title,
            description,
            mediaUrl,
            mediaType,
            thumbnailUrl,
        });
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h2 className="text-3xl flex items-center gap-3 font-bold tracking-tight text-foreground">
                        <Film className="h-8 w-8 text-primary" />
                        Vlog Gallery
                    </h2>
                    <p className="text-sm text-muted-foreground">Upload reels, images & posts for your customers to see.</p>
                </div>
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-lg transition-transform hover:scale-105"
                >
                    <Plus className="h-4 w-4" />
                    New Post
                </motion.button>
            </div>

            {/* Posts Grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-pulse">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="h-72 bg-muted rounded-2xl"></div>
                    ))}
                </div>
            ) : vlogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-16 text-muted-foreground border-2 border-dashed border-border rounded-2xl">
                    <Film className="h-16 w-16 mb-4 opacity-20" />
                    <p className="text-lg font-medium">No posts yet. Create your first one!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {vlogs.map((vlog: any) => (
                        <motion.div
                            key={vlog._id}
                            layout
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="group relative bg-card border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all hover:border-primary/40"
                        >
                            {/* Media Preview — Click to open preview */}
                            <button
                                onClick={() => setPreviewVlog(vlog)}
                                className="aspect-[9/12] relative bg-muted overflow-hidden w-full block cursor-pointer"
                            >
                                {vlog.mediaType === 'VIDEO' ? (
                                    <VideoCard src={vlog.mediaUrl} thumbnail={vlog.thumbnailUrl} title={vlog.title} />
                                ) : (
                                    <img src={vlog.mediaUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={vlog.title} />
                                )}

                                {!vlog.isPublished && (
                                    <div className="absolute top-3 right-3 bg-amber-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">Draft</div>
                                )}
                            </button>

                            {/* Overlay Actions */}
                            <div className="absolute top-0 left-0 right-0 bottom-auto aspect-[9/12] bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4 pointer-events-none">
                                <div className="flex gap-2 w-full pointer-events-auto">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); togglePublish.mutate({ id: vlog._id, isPublished: !vlog.isPublished }); }}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${vlog.isPublished
                                            ? 'bg-amber-500/90 text-white hover:bg-amber-600'
                                            : 'bg-green-500/90 text-white hover:bg-green-600'
                                            }`}
                                    >
                                        {vlog.isPublished ? <><EyeOff className="h-3.5 w-3.5" /> Hide</> : <><Eye className="h-3.5 w-3.5" /> Publish</>}
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); if (confirm('Delete this post?')) deleteMutation.mutate(vlog._id); }}
                                        className="py-2 px-4 rounded-lg bg-red-500/90 text-white text-xs font-bold hover:bg-red-600 transition-colors flex items-center gap-1.5"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>

                            {/* Info */}
                            <div className="p-4">
                                <h3 className="font-bold text-sm line-clamp-1 text-foreground">{vlog.title}</h3>
                                {vlog.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{vlog.description}</p>}
                                <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {vlog.views || 0}</span>
                                    <span>{new Date(vlog.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            <LoadMore hasMore={!!hasNextPage} isFetching={isFetchingNextPage} onLoad={fetchNextPage} />

            {/* Preview Modal */}
            <AnimatePresence>
                {previewVlog && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setPreviewVlog(null)}
                    >
                        <button
                            onClick={() => setPreviewVlog(null)}
                            className="absolute top-4 right-4 z-50 p-2.5 text-white/80 bg-white/10 backdrop-blur-md rounded-full hover:bg-white/20 transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                        <div className="relative max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                            <div className="flex-1 flex items-center justify-center rounded-2xl overflow-hidden bg-black">
                                {previewVlog.mediaType === 'VIDEO' ? (
                                    <video
                                        src={previewVlog.mediaUrl}
                                        className="w-full max-h-[75vh] object-contain rounded-2xl"
                                        controls
                                        autoPlay
                                        playsInline
                                    />
                                ) : (
                                    <img
                                        src={previewVlog.mediaUrl}
                                        className="w-full max-h-[75vh] object-contain rounded-2xl"
                                        alt={previewVlog.title}
                                    />
                                )}
                            </div>
                            <div className="mt-4 px-2">
                                <h2 className="text-white text-xl font-extrabold">{previewVlog.title}</h2>
                                {previewVlog.description && (
                                    <p className="text-white/50 text-sm mt-1">{previewVlog.description}</p>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Create Post Modal */}
            <AnimatePresence>
                {showModal && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => resetForm()}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-card text-foreground w-full max-w-lg rounded-2xl shadow-2xl border border-border overflow-hidden"
                        >
                            <div className="p-6 border-b border-border flex justify-between items-center">
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <Upload className="h-5 w-5 text-primary" /> New Post
                                </h3>
                                <button onClick={resetForm} className="p-2 hover:bg-muted rounded-xl transition-colors">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                                {/* Media Type */}
                                <div>
                                    <label className="text-sm font-bold text-muted-foreground mb-2 block">Media Type</label>
                                    <div className="flex gap-2 p-1 bg-muted rounded-xl">
                                        <button
                                            onClick={() => { setMediaType('IMAGE'); setMediaUrl(''); }}
                                            className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${mediaType === 'IMAGE' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}
                                        >
                                            <ImageIcon className="h-4 w-4" /> Image
                                        </button>
                                        <button
                                            onClick={() => { setMediaType('VIDEO'); setMediaUrl(''); }}
                                            className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${mediaType === 'VIDEO' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}
                                        >
                                            <Film className="h-4 w-4" /> Video / Reel
                                        </button>
                                    </div>
                                </div>

                                {/* Media Upload */}
                                <div>
                                    <label className="text-sm font-bold text-muted-foreground mb-2 block">
                                        {mediaType === 'IMAGE' ? 'Upload Image' : 'Upload Video/Reel'}
                                    </label>
                                    {mediaUrl ? (
                                        <div className="relative rounded-xl overflow-hidden border border-border bg-muted">
                                            {mediaType === 'IMAGE' ? (
                                                <img src={mediaUrl} className="w-full max-h-60 object-cover" alt="preview" />
                                            ) : (
                                                <video src={mediaUrl} className="w-full max-h-60 object-cover" controls />
                                            )}
                                            <button onClick={() => setMediaUrl('')} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600">
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ) : (
                                        <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-all">
                                            {uploading ? (
                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                            ) : (
                                                <>
                                                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                                                    <span className="text-sm text-muted-foreground font-medium">
                                                        Click to upload {mediaType === 'IMAGE' ? 'image' : 'video (max 50MB)'}
                                                    </span>
                                                </>
                                            )}
                                            <input
                                                type="file"
                                                accept={mediaType === 'IMAGE' ? 'image/*' : 'video/*'}
                                                onChange={(e) => handleFileUpload(e, 'media')}
                                                className="hidden"
                                                disabled={uploading}
                                            />
                                        </label>
                                    )}
                                </div>

                                {/* Thumbnail (for videos) */}
                                {mediaType === 'VIDEO' && (
                                    <div>
                                        <label className="text-sm font-bold text-muted-foreground mb-2 block">Thumbnail Image (optional)</label>
                                        {thumbnailUrl ? (
                                            <div className="relative rounded-xl overflow-hidden border border-border bg-muted">
                                                <img src={thumbnailUrl} className="w-full h-32 object-cover" alt="thumbnail" />
                                                <button onClick={() => setThumbnailUrl('')} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full">
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        ) : (
                                            <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/60 transition-all">
                                                {uploading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
                                                <span className="text-xs text-muted-foreground mt-1 font-medium">Upload thumbnail</span>
                                                <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'thumbnail')} className="hidden" disabled={uploading} />
                                            </label>
                                        )}
                                    </div>
                                )}

                                {/* Title */}
                                <div>
                                    <label className="text-sm font-bold text-muted-foreground mb-2 block">Title</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Behind the scenes at our kitchen 🍕"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-medium"
                                    />
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="text-sm font-bold text-muted-foreground mb-2 block">Description (optional)</label>
                                    <textarea
                                        placeholder="Write something about this post..."
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        rows={3}
                                        className="w-full px-4 py-3 rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm resize-none"
                                    />
                                </div>
                            </div>

                            <div className="p-6 border-t border-border">
                                <button
                                    onClick={handleSubmit}
                                    disabled={!title || !mediaUrl || createMutation.isPending}
                                    className="w-full py-3.5 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {createMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                                    {createMutation.isPending ? 'Publishing...' : 'Publish Post'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}