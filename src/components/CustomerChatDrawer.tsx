import { useState, useEffect, useRef } from "react";
import { chatApi, uploadApi } from "@/api/axios";
import { useRestaurantStore } from "@/store/useRestaurantStore";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { X, Send, MessageCircle, RefreshCw, CheckCheck, ChevronDown, ImagePlus, XCircle } from "lucide-react";
import { playChatSound } from "@/lib/notification-sound";
import { API_URL } from "@/lib/config";

const SOCKET_URL = API_URL;

interface Message {
    _id: string;
    sender: "user" | "admin";
    text: string;
    images?: string[];
    isRead: boolean;
    createdAt: string;
}
interface ChatSession {
    _id: string;
    userName: string;
    messages: Message[];
    isOpen: boolean;
    unreadByUser: number;
}


interface CustomerChatDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

const CustomerChatDrawer = ({ isOpen, onClose }: CustomerChatDrawerProps) => {
    const restaurant = useRestaurantStore((s) => s.restaurant);
    const socketRef = useRef<Socket | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const [chat, setChat] = useState<ChatSession | null>(null);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [text, setText] = useState("");
    const [selectedImages, setSelectedImages] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
    const [closed, setClosed] = useState(false);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [adminTyping, setAdminTyping] = useState(false);
    const adminTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Track chat._id in a ref so socket handlers always have the latest value
    // without needing to recreate the socket
    const chatIdRef = useRef<string | undefined>(undefined);

    /* ── Load / create chat session ────────── */
    useEffect(() => {
        if (!isOpen) return;
        setLoading(true);
        chatApi.getOrCreateChat()
            .then((res) => {
                setChat(res.data);
                chatIdRef.current = res.data._id;
                setClosed(!res.data.isOpen);
                chatApi.markRead().catch(() => { });
                // Once we have the chatId, join the room
                if (socketRef.current) {
                    socketRef.current.emit("joinChat", res.data._id);
                }
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [isOpen]);

    /* ── Socket.IO ──────────────────────── */
    useEffect(() => {
        if (!isOpen) return;

        // Create socket ONCE when drawer opens; not on every chat._id change
        const socket = io(SOCKET_URL, {
            transports: ["websocket", "polling"],
            reconnectionAttempts: 5,
            reconnectionDelay: 2000,
        });
        socketRef.current = socket;

        // If chat is already loaded, join immediately
        if (chatIdRef.current) {
            socket.emit("joinChat", chatIdRef.current);
        }

        socket.on("chatMessage", (data: { chatId: string; message: Message }) => {
            // Use ref so we always compare against the current chatId
            if (data.chatId !== chatIdRef.current) return;
            if (data.message.sender === "user") return; // already added optimistically
            playChatSound();
            chatApi.markRead().catch(() => { });
            setChat((prev) => {
                if (!prev) return prev;
                const exists = prev.messages.some((m) => m._id === data.message._id);
                if (exists) return prev;
                return { ...prev, messages: [...prev.messages, data.message] };
            });
        });

        socket.on("chatClosed", () => { setClosed(true); });

        // Admin typing indicator
        socket.on("typing", () => {
            setAdminTyping(true);
            if (adminTypingTimerRef.current) clearTimeout(adminTypingTimerRef.current);
            adminTypingTimerRef.current = setTimeout(() => setAdminTyping(false), 3000);
        });
        socket.on("stopTyping", () => {
            setAdminTyping(false);
            if (adminTypingTimerRef.current) clearTimeout(adminTypingTimerRef.current);
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [isOpen]); // ← only depends on isOpen, NOT chat._id

    /* ── Auto-scroll (within container) ──────── */
    const scrollToBottom = () => {
        const el = messagesEndRef.current?.parentElement;
        if (el) {
            el.scrollTo({
                top: el.scrollHeight,
                behavior: "smooth"
            });
        }
    };

    useEffect(() => {
        const timeout = setTimeout(scrollToBottom, 150);
        return () => clearTimeout(timeout);
    }, [chat?.messages, isOpen]);

    /* ── Focus input on open ────────────────────── */
    useEffect(() => {
        if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
    }, [isOpen]);

    /* ── Typing emit ─────────────────────────────── */
    const handleTextChange = (val: string) => {
        setText(val);
        if (!socketRef.current || !chat?._id) return;
        socketRef.current.emit("typing", { chatId: chat._id });
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            socketRef.current?.emit("stopTyping", { chatId: chat._id });
        }, 1500);
    };

    /* ── Handle Images ──────────────────────────── */
    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            setSelectedImages((prev) => [...prev, ...files]);
            const previews = files.map(f => URL.createObjectURL(f));
            setImagePreviews((prev) => [...prev, ...previews]);
        }
        if (e.target) e.target.value = '';
    };

    const removeImage = (index: number) => {
        setSelectedImages(prev => prev.filter((_, i) => i !== index));
        setImagePreviews(prev => {
            URL.revokeObjectURL(prev[index]);
            return prev.filter((_, i) => i !== index);
        });
    };

    /* ── Send message ───────────────────────────── */
    const handleSend = async () => {
        if ((!text.trim() && selectedImages.length === 0) || sending || closed) return;
        setSending(true);

        // Stop typing indicator
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        socketRef.current?.emit("stopTyping", { chatId: chat?._id });

        let uploadedImageUrls: string[] = [];
        try {
            if (selectedImages.length > 0) {
                uploadedImageUrls = await uploadApi.uploadMultipleImages(selectedImages);
            }

            const optimisticMsg: Message = {
                _id: `opt-${Date.now()}`,
                sender: "user",
                text: text.trim(),
                images: uploadedImageUrls,
                isRead: false,
                createdAt: new Date().toISOString(),
            };

            // Optimistic UI
            setChat((prev) => prev ? { ...prev, messages: [...prev.messages, optimisticMsg] } : prev);
            setText("");
            setSelectedImages([]);
            setImagePreviews([]);

            const res = await chatApi.sendMessage({ text: optimisticMsg.text, images: optimisticMsg.images });

            // Replace optimistic with real
            setChat((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    messages: prev.messages.map((m) => m._id === optimisticMsg._id ? res.data : m),
                };
            });
        } catch (err) {
            console.error("Failed to send message", err);
            // Could remove optimistic UI if it was added before a failure, but since upload might fail before optimistic UI, 
            // safer to leave it as is, or filter it out if we had a specific ID.
            setChat((prev) => {
                if (!prev) return prev;
                return { ...prev, messages: prev.messages.filter((m) => !m._id.startsWith("opt-")) };
            });
        } finally {
            setSending(false);
        }
    };

    const formatTime = (date: string) => {
        try { return format(new Date(date), "h:mm a"); } catch { return ""; }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm"
                    />

                    {/* Drawer */}
                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 30, stiffness: 300 }}
                        className="fixed bottom-0 left-0 right-0 z-[9999] mx-auto flex max-h-[85vh] max-w-lg flex-col rounded-t-3xl border-t border-border bg-background shadow-2xl"
                    >
                        {/* Handle */}
                        <div className="flex justify-center pt-3 pb-1">
                            <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
                        </div>

                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-border px-5 py-3">
                            <div className="flex items-center gap-3">
                                {restaurant?.logo ? (
                                    <img src={restaurant.logo} alt="" className="h-9 w-9 rounded-full object-cover border border-border" />
                                ) : (
                                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                                        <MessageCircle className="h-5 w-5 text-primary" />
                                    </div>
                                )}
                                <div>
                                    <p className="text-sm font-bold text-foreground">{restaurant?.name || "Support"}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {closed
                                            ? <span className="text-red-500">Chat closed</span>
                                            : <span className="flex items-center gap-1">
                                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                                                Online
                                            </span>
                                        }
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-accent transition-colors"
                            >
                                <ChevronDown className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 overscroll-contain">
                            {loading ? (
                                <div className="space-y-3">
                                    {Array.from({ length: 3 }).map((_, i) => (
                                        <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                                            <div className="h-10 w-44 animate-pulse rounded-2xl bg-muted" />
                                        </div>
                                    ))}
                                </div>
                            ) : chat?.messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-10 text-center">
                                    <MessageCircle className="h-12 w-12 text-muted-foreground/20" />
                                    <p className="mt-3 text-sm font-medium text-muted-foreground">Start a conversation</p>
                                    <p className="mt-1 text-xs text-muted-foreground/60">
                                        We'll reply as quickly as possible
                                    </p>
                                </div>
                            ) : (
                                chat?.messages.map((msg) => {
                                    const isUser = msg.sender === "user";
                                    return (
                                        <motion.div
                                            key={msg._id}
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                                        >
                                            {!isUser && (
                                                <div className="mr-2 self-end flex-shrink-0">
                                                    {restaurant?.logo ? (
                                                        <img src={restaurant.logo} alt="" className="h-7 w-7 rounded-full object-cover border border-border" />
                                                    ) : (
                                                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                                                            A
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            <div className={`max-w-[78%] flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                                                <div
                                                    className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${isUser
                                                        ? "rounded-br-sm bg-primary text-primary-foreground"
                                                        : "rounded-bl-sm bg-muted text-foreground"
                                                        } ${(!msg.text && msg.images?.length) ? '!p-1 !bg-transparent' : ''}`}
                                                >
                                                    {msg.images && msg.images.length > 0 && (
                                                        <div className={`grid gap-1 ${msg.text ? 'mb-2' : ''} ${msg.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                                            {msg.images.map((url, i) => (
                                                                <img
                                                                    key={i}
                                                                    src={url}
                                                                    alt="attachment"
                                                                    className="rounded-xl object-cover max-h-48 w-full border border-border/20 shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                                                                    onClick={() => setFullscreenImage(url)}
                                                                />
                                                            ))}
                                                        </div>
                                                    )}
                                                    {msg.text && <p>{msg.text}</p>}
                                                </div>
                                                <div className={`mt-1 flex items-center gap-1 text-[10px] text-muted-foreground ${isUser ? "flex-row-reverse" : ""}`}>
                                                    <span>{formatTime(msg.createdAt)}</span>
                                                    {isUser && (
                                                        <CheckCheck className={`h-3 w-3 ${msg.isRead ? "text-blue-500" : "text-muted-foreground"}`} />
                                                    )}
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })
                            )}

                            {/* Admin typing indicator — WhatsApp-style dots */}
                            <AnimatePresence>
                                {adminTyping && (
                                    <motion.div
                                        key="admin-typing"
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 6 }}
                                        className="flex items-end gap-2"
                                    >
                                        <div className="mr-2 self-end flex-shrink-0">
                                            {restaurant?.logo ? (
                                                <img src={restaurant.logo} alt="" className="h-7 w-7 rounded-full object-cover border border-border" />
                                            ) : (
                                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">A</div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
                                            {[0, 1, 2].map((i) => (
                                                <motion.span
                                                    key={i}
                                                    className="block h-1.5 w-1.5 rounded-full bg-muted-foreground/60"
                                                    animate={{ y: [0, -4, 0] }}
                                                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                                                />
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div ref={messagesEndRef} />
                        </div>

                        {/* Closed banner */}
                        {closed && (
                            <div className="border-t border-border bg-red-50 dark:bg-red-900/20 px-4 py-4 text-center">
                                <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-3">
                                    This conversation has been closed by the restaurant.
                                </p>
                                <button
                                    onClick={async () => {
                                        try {
                                            setLoading(true);
                                            const res = await chatApi.createNewChat();
                                            setChat(res.data);
                                            chatIdRef.current = res.data._id;
                                            setClosed(res.data.status === 'closed');

                                            // Re-join socket for new chat
                                            if (socketRef.current) {
                                                socketRef.current.emit("joinChat", res.data._id);
                                            }
                                        } catch (err) {
                                            console.error("Failed to start new chat", err);
                                        } finally {
                                            setLoading(false);
                                        }
                                    }}
                                    className="rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-bold text-red-600 shadow-sm transition-colors hover:bg-red-50 dark:border-red-800 dark:bg-red-950 dark:hover:bg-red-900"
                                >
                                    Start New Chat
                                </button>
                            </div>
                        )}

                        {/* Input */}
                        {!closed && (
                            <div className="border-t border-border px-4 py-3 pb-safe bg-background z-10 relative">
                                {imagePreviews.length > 0 && (
                                    <div className="flex gap-2 mb-3 overflow-x-auto pb-2 scrollbar-none">
                                        {imagePreviews.map((preview, i) => (
                                            <div key={i} className="relative h-16 w-16 flex-shrink-0 animate-in fade-in zoom-in duration-200">
                                                <img src={preview} className="h-16 w-16 rounded-xl object-cover border border-border shadow-sm" />
                                                <button onClick={() => removeImage(i)} className="absolute -top-2 -right-2 h-5 w-5 bg-background rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-red-500 shadow-sm">
                                                    <XCircle className="h-4 w-4 fill-background" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="flex items-end gap-2">
                                    <input type="file" multiple accept="image/*" className="hidden" id="chat-images" onChange={handleImageSelect} />
                                    <label htmlFor="chat-images" className="flex h-10 w-10 flex-shrink-0 cursor-pointer items-center justify-center rounded-xl text-muted-foreground bg-muted/30 hover:bg-accent hover:text-foreground transition-colors">
                                        <ImagePlus className="h-5 w-5" />
                                    </label>
                                    <textarea
                                        ref={inputRef}
                                        value={text}
                                        onChange={(e) => handleTextChange(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                                        }}
                                        placeholder="Type a message…"
                                        rows={1}
                                        className="flex-1 resize-none rounded-xl border border-border bg-muted/50 px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:bg-background transition-colors"
                                        style={{ maxHeight: 100, overflowY: "auto" }}
                                    />
                                    <button
                                        onClick={handleSend}
                                        disabled={(!text.trim() && selectedImages.length === 0) || sending}
                                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md transition-all hover:brightness-110 disabled:opacity-50"
                                    >
                                        {sending
                                            ? <RefreshCw className="h-4 w-4 animate-spin" />
                                            : <Send className="h-4 w-4" />
                                        }
                                    </button>
                                </div>
                            </div>
                        )}
                    </motion.div>

                    {/* Fullscreen Image Modal (Rendered above everything inside this component) */}
                    <AnimatePresence>
                        {fullscreenImage && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
                                onClick={() => setFullscreenImage(null)}
                            >
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setFullscreenImage(null);
                                    }}
                                    className="absolute right-4 top-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors"
                                >
                                    <X className="h-6 w-6" />
                                </button>
                                <motion.img
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.9, opacity: 0 }}
                                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                                    src={fullscreenImage}
                                    className="max-h-full max-w-full object-contain rounded-lg"
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </>
            )}
        </AnimatePresence>
    );
};

export default CustomerChatDrawer;
