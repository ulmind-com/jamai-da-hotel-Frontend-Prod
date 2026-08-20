import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { adminApi, chatApi } from "@/api/axios";
import { useAuthStore } from "@/store/useAuthStore";
import { toast } from "sonner";
import { socket } from "@/api/socket";
import { chimeNewOrder, playChatSound } from "@/lib/notification-sound";
import { motion } from "framer-motion";
import {
  LayoutDashboard, UtensilsCrossed, Layers, ClipboardList, BarChart3,
  DollarSign, ShoppingBag, TrendingUp, Package, Plus, Menu, X, Settings, Tag, Users,
  PieChart as PieChartIcon, MessageSquare, Printer, Map as MapIcon, Film, Bike,
} from "lucide-react";
import AdminMenuTable from "@/components/AdminMenuTable";
import CategoryManager from "@/components/CategoryManager";
import AddProductModal from "@/components/AddProductModal";
import RestaurantSettings from "@/components/RestaurantSettings";
import CouponManager from "@/components/CouponManager";
import AdminUsers from "@/components/AdminUsers";
import AdminOrders from "@/components/AdminOrders";
import DashboardAnalytics from "@/components/DashboardAnalytics";
import AdminReviews from "@/components/AdminReviews";
import AdminChat from "@/components/AdminChat";
import HeroVideoManager from "@/components/HeroVideoManager";
import AdminMapAnalytics from "@/components/AdminMapAnalytics";
import SimplePos from "@/components/SimplePos";
import PosReports from "@/components/PosReports";
import PosDashboardSummary from "@/components/PosDashboardSummary";
import AdminVlogs from "@/components/AdminVlogs";
import DeliveryOrders from "@/components/DeliveryOrders";

type AdminTab = "dashboard" | "menu" | "categories" | "orders" | "analytics" | "map" | "coupons" | "settings" | "users" | "reviews" | "chat" | "videos" | "billing" | "vlogs" | "reports" | "delivery";

const VALID_TABS: AdminTab[] = ["dashboard", "menu", "categories", "orders", "analytics", "map", "coupons", "settings", "users", "reviews", "chat", "videos", "billing", "vlogs", "reports", "delivery"];

const sidebarLinks: { key: AdminTab; label: string; icon: any }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "billing", label: "POS Billing", icon: Printer },
  { key: "delivery", label: "Delivery", icon: Bike },
  { key: "reports", label: "Reports", icon: BarChart3 },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "map", label: "Map Analytics", icon: MapIcon },
  { key: "reviews", label: "Reviews", icon: MessageSquare }, // New Reviews Tab
  { key: "menu", label: "Menu Items", icon: UtensilsCrossed },
  { key: "categories", label: "Categories", icon: Layers },
  { key: "coupons", label: "Coupons", icon: Tag },
  { key: "users", label: "Users", icon: Users },
  { key: "orders", label: "Orders", icon: ClipboardList },
  { key: "videos", label: "Hero Videos", icon: Package },
  { key: "vlogs", label: "Vlogs / Gallery", icon: Film },
  { key: "chat", label: "Chat", icon: MessageSquare },
  { key: "settings", label: "Settings", icon: Settings },
];

// ... (statCards array stays same)

// Tabs only an Admin may open (Managers get everything else).
const ADMIN_ONLY_TABS: AdminTab[] = ["users"];
// A Delivery rider only ever sees their delivery run.
const DELIVERY_TABS: AdminTab[] = ["delivery"];

const AdminDashboard = () => {
  const queryClient = useQueryClient();
  const { isAdmin, isDelivery } = useAuthStore();
  const rider = isDelivery();
  const visibleLinks = sidebarLinks.filter((l) =>
    rider ? DELIVERY_TABS.includes(l.key) : isAdmin() || !ADMIN_ONLY_TABS.includes(l.key)
  );

  // ── Global new-order notifier (works on ANY admin tab) ──
  // De-duplicated across the socket (instant) and the dashboard polling
  // safety net, so an order chimes + pops once even if both fire.
  const lastNotifiedOrderRef = useRef<string | null>(null);
  const notifierInitializedRef = useRef(false);
  const handleIncomingOrderRef = useRef<(order: any) => void>(() => {});
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab") as AdminTab | null;
  // Riders are locked to the delivery screen.
  const activeTab: AdminTab = rider
    ? "delivery"
    : tabFromUrl && VALID_TABS.includes(tabFromUrl) ? tabFromUrl : "dashboard";

  // Fetch admin chats to calculate unread badge
  const { data: adminChats } = useQuery({
    queryKey: ["admin-chats"],
    queryFn: () => chatApi.getAllChats().then((r) => r.data || []),
    enabled: isAdmin(), // chat management is admin-only
  });

  const totalUnreadChats = (adminChats || []).reduce((acc: number, chat: any) => acc + (chat.unreadByAdmin || 0), 0);

  // Global socket listeners — orders + chat (from any admin section)
  useEffect(() => {
    if (rider) return; // riders don't handle orders/chat
    // JOIN the admin room so this socket receives chatMessage events
    socket.emit("joinAdminChat");

    socket.on("newOrder", (data: any) => {
      handleIncomingOrderRef.current(data);
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    });

    socket.on("chatMessage", (data: { chatId: string; userName?: string; message: any }) => {
      // Only ring for messages sent BY users (not admin's own messages)
      if (data.message?.sender !== "user") return;

      playChatSound();

      toast(`💬 ${data.userName || "Customer"}`, {
        description: data.message.text || "Sent an attachment",
        duration: 7000,
        action: {
          label: "Open Chat",
          onClick: () => setActiveTab("chat"),
        },
      });

      queryClient.invalidateQueries({ queryKey: ["admin-chats"] });
    });

    return () => {
      socket.off("newOrder");
      socket.off("chatMessage");
    };
  }, [queryClient, rider]);


  const setActiveTab = (tab: AdminTab) => {
    const currentMode = searchParams.get("mode") || "NORMAL";
    setSearchParams(tab === "dashboard" ? { mode: currentMode } : { tab, mode: currentMode }, { replace: true });
  };

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  /* ──────────────── Mode & Tabs State ──────────────── */
  // Derived state from URL (Source of Truth)
  const dashboardMode = (searchParams.get("mode") as "NORMAL" | "VISUAL") || "NORMAL";

  const setDashboardMode = (mode: "NORMAL" | "VISUAL") => {
    const currentTab = searchParams.get("tab") || "dashboard";
    setSearchParams({ tab: currentTab, mode }, { replace: true });
  };

  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => adminApi.getDashboard().then((r) => r.data),
    // Poll globally so new orders are caught on ANY tab even if the socket
    // dropped the broadcast — keeps the chime + popup reliable everywhere.
    refetchInterval: 20000,
    refetchIntervalInBackground: true,
    enabled: !rider, // riders don't get the order dashboard
  });

  // Keep the notifier closure fresh (latest setActiveTab) without re-running effects.
  handleIncomingOrderRef.current = (order: any) => {
    const id = order?._id || order?.customId;
    if (!id || id === lastNotifiedOrderRef.current) return;
    lastNotifiedOrderRef.current = id;
    chimeNewOrder(id);
    const name = order?.customer?.name || order?.customerName || "Customer";
    const amt = order?.finalAmount ?? order?.totalAmount;
    toast(`🛎️ New order ${order?.customId || ""}`.trim(), {
      description: `${name}${amt != null ? ` · ₹${amt}` : ""} · ${order?.paymentMethod || "COD"}`,
      duration: 12000,
      action: { label: "View orders", onClick: () => setActiveTab("orders") },
    });
  };

  // Global polling safety net: detect a new top order from the dashboard feed
  // on any tab and fire the notifier (deduped against the socket).
  useEffect(() => {
    const latest = stats?.recentOrders?.[0];
    if (!latest) return;
    const id = latest._id || latest.customId;
    if (!notifierInitializedRef.current) {
      notifierInitializedRef.current = true;
      lastNotifiedOrderRef.current = id; // baseline — don't chime existing orders
      return;
    }
    if (id !== lastNotifiedOrderRef.current) handleIncomingOrderRef.current(latest);
  }, [stats]);

  const renderContent = () => {
    // Managers cannot open admin-only tabs even via a direct URL.
    if (ADMIN_ONLY_TABS.includes(activeTab) && !isAdmin()) {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <h2 className="text-xl font-bold text-foreground">Admin access required</h2>
          <p className="mt-1 text-sm text-muted-foreground">This section is restricted to administrators.</p>
        </div>
      );
    }
    switch (activeTab) {
      case "dashboard":
        // ... (dashboard case)
        return (
          <div className="space-y-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h2>
                <p className="text-sm text-muted-foreground">Overview of your business performance.</p>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-1 shadow-sm">
                <button
                  onClick={() => setDashboardMode("NORMAL")}
                  className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${dashboardMode === "NORMAL"
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:bg-muted"
                    }`}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Overview
                </button>
                <button
                  onClick={() => setDashboardMode("VISUAL")}
                  className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${dashboardMode === "VISUAL"
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:bg-muted"
                    }`}
                >
                  <PieChartIcon className="h-4 w-4" />
                  Analytics
                </button>
              </div>
            </div>

            {dashboardMode === "NORMAL" ? (
              <DashboardView stats={stats} isLoading={isLoading} />
            ) : (
              <DashboardAnalytics />
            )}

            {/* Offline POS (settled bills) — online vs offline split + audit */}
            <PosDashboardSummary />
          </div>
        );
      case "analytics":
        return <DashboardAnalytics />;
      case "map":
        return <AdminMapAnalytics />;
      case "reviews":
        return <AdminReviews />;
      case "menu":
        // ... (menu case)
        return (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground">Menu Management</h2>
                <p className="text-sm text-muted-foreground">Add, edit, or remove items from your menu</p>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setAddModalOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-lg transition-transform hover:scale-105"
              >
                <Plus className="h-4 w-4" />
                Add Product
              </motion.button>
            </div>
            <AdminMenuTable />
          </div>
        );
      case "categories":
        // ... (categories case)
        return (
          <div>
            <h2 className="mb-2 text-xl font-bold text-foreground">Category Management</h2>
            <p className="mb-6 text-sm text-muted-foreground">Organize your menu with categories</p>
            <CategoryManager />
          </div>
        );
      case "coupons":
        return <CouponManager />;
      case "users":
        return <AdminUsers />;
      case "settings":
        return <RestaurantSettings />;
      case "orders":
        return <AdminOrders />;
      case "chat":
        return <AdminChat />;
      case "videos":
        return <HeroVideoManager />;
      case "billing":
        return <SimplePos />;
      case "delivery":
        return <DeliveryOrders />;
      case "reports":
        return <PosReports />;
      case "vlogs":
        return <AdminVlogs />;
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed bottom-6 left-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl md:hidden"
      >
        {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-sidebar-border bg-sidebar pt-20 transition-transform duration-300 md:sticky md:top-0 md:h-screen md:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="px-4 pb-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Admin Panel</h2>
        </div>

        <nav className="flex-1 min-h-0 space-y-1 overflow-y-auto px-3 pb-6">
          {visibleLinks.map((link) => {
            const Icon = link.icon;
            const active = activeTab === link.key;
            return (
              <button
                key={link.key}
                onClick={() => { setActiveTab(link.key); setSidebarOpen(false); }}
                className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition-all ${active
                  ? "bg-sidebar-accent text-sidebar-primary font-semibold"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-5 w-5 ${active ? "text-sidebar-primary" : ""}`} />
                  {link.label}
                </div>
                {link.key === "chat" && totalUnreadChats > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white shadow-sm">
                    {totalUnreadChats}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 w-full min-w-0 overflow-x-hidden px-4 py-8 md:px-8">
        {renderContent()}
      </main>

      <AddProductModal open={addModalOpen} onClose={() => setAddModalOpen(false)} />
    </div>
  );
};

/* ──────────────── Dashboard Stats View (Enhanced) ──────────────── */

interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  topSellingItems: Array<{
    _id: string;
    name: string;
    totalQuantity: number;
    imageURL: string;
  }>;
  recentOrders: Array<{
    _id: string;
    customId: string;
    customer: { name: string };
    totalAmount: number;
    discountApplied: number;
    finalAmount: number;
    status: string;
    orderStatus: string;
    createdAt: string;
    items: Array<{ product: string; variant: string; quantity: number }>;
    paymentMethod: string;
    paymentStatus: "PAID" | "PENDING" | "FAILED";
    deliveryAddress: { city: string; state: string };
  }>;
  todaysRevenue: number;
  todaysOrders: number;
}

const DashboardView = ({ stats, isLoading }: { stats: DashboardStats; isLoading: boolean }) => {
  // Derived Metrics
  const avgOrderValue = stats?.totalOrders > 0 ? (stats.totalRevenue / stats.totalOrders).toFixed(0) : "0";

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* KPI Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Today's Metrics */}
        <StatsCard
          label="Today's Revenue"
          value={`₹${stats?.todaysRevenue?.toLocaleString() || 0}`}
          icon={DollarSign}
          loading={isLoading}
          className="bg-green-500/10 text-green-600"
        />
        <StatsCard
          label="Today's Orders"
          value={stats?.todaysOrders || 0}
          icon={ShoppingBag}
          loading={isLoading}
          className="bg-blue-500/10 text-blue-600"
        />

        {/* Total Metrics */}
        <StatsCard
          label="Total Revenue"
          value={`₹${stats?.totalRevenue?.toLocaleString() || 0}`}
          icon={DollarSign}
          loading={isLoading}
          className="bg-emerald-500/10 text-emerald-600"
        />
        <StatsCard
          label="Total Orders"
          value={stats?.totalOrders || 0}
          icon={ShoppingBag}
          loading={isLoading}
          className="bg-blue-500/10 text-blue-600"
        />
        <StatsCard
          label="Avg. Order Value"
          value={`₹${avgOrderValue}`}
          icon={TrendingUp}
          loading={isLoading}
          className="bg-violet-500/10 text-violet-600"
        />
        <StatsCard
          label="Best Seller Sales"
          value={stats?.topSellingItems?.[0]?.totalQuantity || 0}
          icon={Tag}
          loading={isLoading}
          className="bg-orange-500/10 text-orange-600"
        />
      </div>

      <div className="grid gap-8 xl:grid-cols-3">
        {/* Top Selling Items (Left Column) */}
        <div className="xl:col-span-1 min-w-0">
          <div className="h-full rounded-2xl border border-border bg-card shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between border-b border-border p-6">
              <h3 className="text-lg font-bold text-foreground">🔥 Top Items</h3>
            </div>
            <div className="p-6">
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <div key={i} className="h-16 w-full animate-pulse rounded-xl bg-muted" />)}
                </div>
              ) : !stats?.topSellingItems?.length ? (
                <div className="flex h-40 items-center justify-center text-muted-foreground">No data available</div>
              ) : (
                <div className="space-y-4">
                  {stats.topSellingItems.map((item, index) => (
                    <div key={item._id} className="group flex items-center gap-4 rounded-xl border border-transparent p-2 transition-colors hover:border-border hover:bg-muted/30">
                      <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg">
                        <img
                          src={item.imageURL}
                          alt={item.name}
                          className="h-full w-full object-cover transition-transform group-hover:scale-110"
                          onError={(e) => (e.currentTarget.src = "https://placehold.co/100?text=Food")}
                        />
                        <div className="absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-br-lg bg-black/60 text-xs font-bold text-white">
                          #{index + 1}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-semibold text-foreground">{item.name}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="inline-flex items-center rounded-md bg-orange-100 px-2 py-1 text-xs font-bold text-orange-700">
                            {item.totalQuantity} Sold
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Orders (Right 2 Columns) */}
        <div className="xl:col-span-2 min-w-0">
          <div className="h-full rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border p-6">
              <h3 className="text-lg font-bold text-foreground">📦 Recent Orders</h3>
            </div>
            <div className="overflow-x-auto p-0">
              {isLoading ? (
                <div className="space-y-4 p-6">
                  {[1, 2, 3, 4].map(i => <div key={i} className="h-12 w-full animate-pulse rounded-lg bg-muted" />)}
                </div>
              ) : !stats?.recentOrders?.length ? (
                <div className="p-6 text-center text-muted-foreground">No recent orders.</div>
              ) : (
                <table className="w-full min-w-[800px] text-left text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-6 py-4 font-medium">Order Details</th>
                      <th className="px-6 py-4 font-medium">Customer & Location</th>
                      <th className="px-6 py-4 font-medium">Payment</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {stats.recentOrders.map((order) => (
                      <tr key={order._id} className="group transition-colors hover:bg-muted/30">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-foreground">{order.customId || order._id.slice(-6).toUpperCase()}</span>
                            <span className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</span>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {order.items?.length} Items • <span className="italic">{order.items?.[0]?.product ? "..." : ""}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                              {order.customer?.name?.charAt(0) || "G"}
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{order.customer?.name || "Guest"}</p>
                              <p className="text-xs text-muted-foreground">{order.deliveryAddress?.city}, {order.deliveryAddress?.state}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-foreground uppercase text-xs">{order.paymentMethod}</span>
                            <span className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${order.paymentStatus === "PAID" ? "bg-green-100 text-green-700" :
                              order.paymentStatus === "PENDING" ? "bg-yellow-100 text-yellow-700" :
                                "bg-red-100 text-red-700"
                              }`}>
                              {order.paymentStatus}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold shadow-sm ${order.orderStatus === "DELIVERED" ? "bg-green-500 text-white" :
                            order.orderStatus === "CANCELLED" ? "bg-red-500 text-white" :
                              order.orderStatus === "PLACED" ? "bg-blue-500 text-white" :
                                "bg-yellow-500 text-white"
                            }`}>
                            {order.orderStatus}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-bold text-foreground text-base">₹{Number(order.finalAmount || 0).toFixed(2)}</span>
                            {order.discountApplied > 0 && (
                              <span className="text-xs text-green-600 line-through decoration-muted-foreground/50">
                                -₹{order.discountApplied}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
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
          <div className="mt-2 h-8 w-24 animate-pulse rounded bg-muted" />
        ) : (
          <p className="mt-1 text-3xl font-bold text-foreground">{value}</p>
        )}
      </div>
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${className} bg-opacity-20`}>
        <Icon className="h-6 w-6" />
      </div>
    </div>
  </div>
);

export default AdminDashboard;
