import { useState, useEffect, useRef } from "react";
import { chimeNewOrder } from "@/lib/notification-sound";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/api/axios";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Package, Search, X, Eye, ChefHat, Bike, CheckCircle, XCircle, ShoppingBag, Tag, MapPin, QrCode, ArrowLeftRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { socket } from "@/api/socket";
import QRCode from "react-qr-code";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useRestaurantStore } from "@/store/useRestaurantStore";

const STATUSES = ["PLACED", "ACCEPTED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"];

const STATUS_COLORS: Record<string, string> = {
  PLACED: "bg-blue-100 text-blue-700",
  ACCEPTED: "bg-cyan-100 text-cyan-700",
  PREPARING: "bg-orange-100 text-orange-700",
  OUT_FOR_DELIVERY: "bg-purple-100 text-purple-700",
  DELIVERED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  PAID: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
};

const formatDate = (d: string) => {
  try { return format(new Date(d), "dd MMM, hh:mm a"); } catch { return "—"; }
};

const getItemsSummary = (items: any[]) => {
  if (!items?.length) return "No items";
  return items.map((i: any) => `${i.name || i.product?.name || i.menuItem?.name || "Item"} × ${i.quantity}`).join(", ");
};

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ... existing imports ...

const getBase64ImageFromUrl = async (imageUrl: string) => {
  try {
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    return null;
  }
};

const AdminOrders = () => {
  const { restaurant } = useRestaurantStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [mode, setMode] = useState<"ORDERS" | "REFUNDS">("ORDERS");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-orders", filterStatus],
    queryFn: () => {
      if (filterStatus === "ALL") return adminApi.getOrders().then((r) => r.data?.orders || r.data || []);
      return adminApi.getOrdersByStatus(filterStatus).then((r) => r.data?.orders || r.data || []);
    },
    // Safety net: auto-refresh even if the socket drops a broadcast (Render can
    // silently drop idle websockets), so orders never require a manual refresh.
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });

  // Play the new-order sound when a genuinely new order appears (works whether
  // the update came from the socket or the polling safety net).
  const seenTopOrderId = useRef<string | null>(null);
  useEffect(() => {
    const topId = orders?.[0]?._id || null;
    if (!topId) return;
    if (seenTopOrderId.current === null) {
      seenTopOrderId.current = topId; // first load — don't chime
      return;
    }
    if (topId !== seenTopOrderId.current) {
      seenTopOrderId.current = topId;
      chimeNewOrder(topId);
    }
  }, [orders]);

  // Real-time updates for Admin
  useEffect(() => {
    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    };

    socket.on("adminOrderUpdated", handleUpdate);
    socket.on("adminRefundUpdated", handleUpdate);
    socket.on("newOrder", handleUpdate);
    socket.on("connect", handleUpdate); // catch up after a reconnect

    return () => {
      socket.off("adminOrderUpdated", handleUpdate);
      socket.off("adminRefundUpdated", handleUpdate);
      socket.off("newOrder", handleUpdate);
      socket.off("connect", handleUpdate);
    };
  }, [queryClient]);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => adminApi.updateOrderStatus(id, { status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ["admin-orders", filterStatus] });
      const previousOrders = queryClient.getQueryData(["admin-orders", filterStatus]);
      queryClient.setQueryData(["admin-orders", filterStatus], (old: any) => {
        if (!old) return old;
        return old.map((order: any) =>
          order._id === id ? { ...order, orderStatus: status, status } : order
        );
      });
      // Also update selectedOrder optimistically if it's the one being modified
      if (selectedOrder?._id === id) {
        setSelectedOrder({ ...selectedOrder, orderStatus: status, status });
      }
      return { previousOrders };
    },
    onError: (err, variables, context: any) => {
      if (context?.previousOrders) {
        queryClient.setQueryData(["admin-orders", filterStatus], context.previousOrders);
      }
      toast.error("Failed to update status");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    },
    onSuccess: () => {
      toast.success("Order status updated");
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => adminApi.updateOrderStatus(id, { status: "CANCELLED" }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["admin-orders", filterStatus] });
      const previousOrders = queryClient.getQueryData(["admin-orders", filterStatus]);
      queryClient.setQueryData(["admin-orders", filterStatus], (old: any) => {
        if (!old) return old;
        return old.map((order: any) =>
          order._id === id ? { ...order, orderStatus: "CANCELLED", status: "CANCELLED" } : order
        );
      });
      if (selectedOrder?._id === id) {
        setSelectedOrder({ ...selectedOrder, orderStatus: "CANCELLED", status: "CANCELLED" });
      }
      return { previousOrders };
    },
    onError: (err, variables, context: any) => {
      if (context?.previousOrders) {
        queryClient.setQueryData(["admin-orders", filterStatus], context.previousOrders);
      }
      toast.error("Failed to cancel order");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    },
    onSuccess: () => {
      toast.success("Order cancelled");
    },
  });

  const paymentStatusMutation = useMutation({
    mutationFn: ({ id, paymentStatus }: { id: string; paymentStatus: string }) => adminApi.updatePaymentStatus(id, { paymentStatus }),
    onMutate: async ({ id, paymentStatus }) => {
      await queryClient.cancelQueries({ queryKey: ["admin-orders", filterStatus] });
      const previousOrders = queryClient.getQueryData(["admin-orders", filterStatus]);
      queryClient.setQueryData(["admin-orders", filterStatus], (old: any) => {
        if (!old) return old;
        return old.map((order: any) =>
          order._id === id ? { ...order, paymentStatus } : order
        );
      });
      if (selectedOrder?._id === id) {
        setSelectedOrder({ ...selectedOrder, paymentStatus });
      }
      return { previousOrders };
    },
    onError: (err, variables, context: any) => {
      if (context?.previousOrders) {
        queryClient.setQueryData(["admin-orders", filterStatus], context.previousOrders);
      }
      toast.error("Failed to update payment status");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    },
    onSuccess: () => {
      toast.success("Payment status updated");
    },
  });

  const refundMutation = useMutation({
    mutationFn: (id: string) => adminApi.processRefund(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["admin-orders", filterStatus] });
      const previousOrders = queryClient.getQueryData(["admin-orders", filterStatus]);
      queryClient.setQueryData(["admin-orders", filterStatus], (old: any) => {
        if (!old) return old;
        return old.map((order: any) =>
          order._id === id ? { ...order, refundStatus: "PROCESSED", refundProcessedAt: new Date().toISOString() } : order
        );
      });
      if (selectedOrder?._id === id) {
        setSelectedOrder({ ...selectedOrder, refundStatus: "PROCESSED", refundProcessedAt: new Date().toISOString() });
      }
      return { previousOrders };
    },
    onError: (err, variables, context: any) => {
      if (context?.previousOrders) {
        queryClient.setQueryData(["admin-orders", filterStatus], context.previousOrders);
      }
      toast.error("Failed to process refund");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    },
    onSuccess: () => {
      toast.success("Refund processed successfully!");
    },
  });

  const prepTimeMutation = useMutation({
    mutationFn: ({ id, time }: { id: string; time: number }) => adminApi.updatePreparationTime(id, { preparationTime: time }),
    onMutate: async ({ id, time }) => {
      await queryClient.cancelQueries({ queryKey: ["admin-orders", filterStatus] });
      const previousOrders = queryClient.getQueryData(["admin-orders", filterStatus]);
      queryClient.setQueryData(["admin-orders", filterStatus], (old: any) => {
        if (!old) return old;
        return old.map((order: any) => {
          if (order._id === id) {
            const newStatus = (order.orderStatus === "ACCEPTED" || order.status === "ACCEPTED") ? "PREPARING" : (order.orderStatus || order.status);
            return { ...order, preparationTime: time, orderStatus: newStatus, status: newStatus };
          }
          return order;
        });
      });
      if (selectedOrder?._id === id) {
        const newStatus = (selectedOrder.orderStatus === "ACCEPTED" || selectedOrder.status === "ACCEPTED") ? "PREPARING" : (selectedOrder.orderStatus || selectedOrder.status);
        setSelectedOrder({ ...selectedOrder, preparationTime: time, orderStatus: newStatus, status: newStatus });
      }
      return { previousOrders };
    },
    onError: (err, variables, context: any) => {
      if (context?.previousOrders) {
        queryClient.setQueryData(["admin-orders", filterStatus], context.previousOrders);
      }
      toast.error("Failed to update preparation time");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    },
    onSuccess: (res) => {
      toast.success("Preparation time updated");
    },
  });

  const baseList = mode === "REFUNDS"
    ? orders.filter((o: any) => (o.orderStatus === 'CANCELLED' || o.status === 'CANCELLED') && o.paymentMethod === 'ONLINE' && o.paymentStatus === 'PAID')
    : orders;

  const filtered = baseList
    .filter((o: any) => {
      if (mode === "ORDERS" && filterStatus !== "ALL") {
        if ((o.status || o.orderStatus) !== filterStatus) return false;
      }
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        o._id?.toLowerCase().includes(q) ||
        o.customId?.toLowerCase().includes(q) ||
        o.customer?.name?.toLowerCase().includes(q) ||
        o.user?.name?.toLowerCase().includes(q) ||
        o.customer?.email?.toLowerCase().includes(q) ||
        o.user?.email?.toLowerCase().includes(q) ||
        o.customer?.mobile?.includes(q) ||
        o.deliveryAddress?.mobile?.includes(q)
      );
    })
    .filter((o: any) => {
      if (!startDate && !endDate) return true;
      const d = new Date(o.createdAt);
      if (startDate) {
        const s = new Date(startDate);
        s.setHours(0, 0, 0, 0);
        if (d < s) return false;
      }
      if (endDate) {
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        if (d > e) return false;
      }
      return true;
    })
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const downloadCSV = () => {
    if (!filtered.length) return toast.error("No data to export for current filters");
    const headers = ["Order ID", "Customer", "Mobile", "Items", "Total Amount", "Status", "Payment Method", "Payment Status", "Razorpay Txn", "Razorpay Order ID", "Date"];
    const rows = filtered.map((o: any) => [
      o.customId || o._id,
      o.customer?.name || o.user?.name || "Guest",
      o.customer?.mobile || o.deliveryAddress?.mobile || "",
      o.items?.map((i: any) => `${i.name || i.product?.name} x${i.quantity}`).join("; "),
      o.finalAmount || o.totalAmount,
      o.status || o.orderStatus,
      o.paymentMethod || "COD",
      o.paymentStatus || "PENDING",
      o.razorpayPaymentId || "",
      o.razorpayOrderId || "",
      new Date(o.createdAt).toLocaleDateString(),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r: any) => r.map((c: any) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${mode}_report_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const downloadPDF = async () => {
    if (!filtered.length) return toast.error("No data to export for current filters");

    toast.info("Generating PDF, please wait...");
    const doc = new jsPDF("landscape");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Add Watermark
    try {
      if (restaurant?.logo) {
        const base64Logo = await getBase64ImageFromUrl(restaurant.logo);
        if (base64Logo) {
          doc.setGState(new (doc as any).GState({ opacity: 0.1 }));
          doc.addImage(base64Logo, 'PNG', (pageWidth - 200) / 2, (pageHeight - 200) / 2, 200, 200);
          doc.setGState(new (doc as any).GState({ opacity: 1 }));
        }
      } else {
        doc.setGState(new (doc as any).GState({ opacity: 0.05 }));
        doc.setFontSize(50);
        doc.setTextColor(150);
        doc.text(restaurant?.name || "HALDIA CLOUD KITCHEN & RESTAURANT", pageWidth / 2, pageHeight / 2, { align: "center", angle: 45 as any });
        doc.setGState(new (doc as any).GState({ opacity: 1 }));
      }
    } catch (err) {
      console.warn("Watermark error", err);
    }

    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    const dateRangeStr = startDate && endDate ? ` (${startDate} to ${endDate})` : "";
    doc.text(`Order Report - ${mode === "REFUNDS" ? "Refunds" : filterStatus}${dateRangeStr}`, 14, 20);

    const titlePrefix = restaurant?.name ? `${restaurant.name.replace(/\s+/g, "_")}_` : "";

    autoTable(doc, {
      startY: 30,
      headStyles: { fillColor: [249, 115, 22], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [255, 247, 237] },
      head: [["Order ID", "Customer", "Items", "Amount", "Status", "Payment Details", "Date"]],
      body: filtered.map((o: any) => {
        let paymentDetails = `Method: ${o.paymentMethod === 'ONLINE' ? 'ONLINE' : 'COD'}`;
        if (o.razorpayPaymentId) paymentDetails += `\nTxn: ${o.razorpayPaymentId}`;
        if (o.razorpayOrderId) paymentDetails += `\nOrder: ${o.razorpayOrderId}`;

        const itemsList = o.items?.map((i: any) => `${i.name || i.product?.name || i.menuItem?.name || "Item"} x${i.quantity}`).join("\n") || "No items";

        return [
          o.customId || o._id.slice(-6).toUpperCase(),
          `${o.customer?.name || o.user?.name || "Guest"}\n${o.customer?.mobile || o.deliveryAddress?.mobile || ""}`,
          itemsList,
          `Rs. ${o.finalAmount || o.totalAmount}`,
          o.status || o.orderStatus,
          paymentDetails,
          new Date(o.createdAt).toLocaleDateString(),
        ];
      }),
    });
    doc.save(`${titlePrefix}${mode}_report.pdf`);
  };

  return (
    <TooltipProvider>
      <div>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">Order Management</h2>
            <p className="text-sm text-muted-foreground">Track and manage all customer orders</p>
          </div>
          <div className="flex gap-2">
            <button onClick={downloadCSV} className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold transition-colors hover:bg-accent">
              Export CSV
            </button>
            <button onClick={downloadPDF} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition-colors hover:brightness-110">
              Export PDF
            </button>
          </div>
        </div>

        {/* Top-Level Tabs (Orders vs Refunds) */}
        <div className="mb-6 flex space-x-2 border-b border-border pb-2">
          <button
            onClick={() => setMode("ORDERS")}
            className={`px-4 py-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${mode === "ORDERS" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <ShoppingBag className="h-4 w-4" /> Live Orders
          </button>
          <button
            onClick={() => setMode("REFUNDS")}
            className={`px-4 py-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${mode === "REFUNDS" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <ArrowLeftRight className="h-4 w-4" /> Refund Management
            {orders.filter((o: any) => (o.orderStatus === 'CANCELLED' || o.status === 'CANCELLED') && o.paymentMethod === 'ONLINE' && o.paymentStatus === 'PAID' && o.refundStatus === 'PENDING').length > 0 && (
              <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] text-white">
                {orders.filter((o: any) => (o.orderStatus === 'CANCELLED' || o.status === 'CANCELLED') && o.paymentMethod === 'ONLINE' && o.paymentStatus === 'PAID' && o.refundStatus === 'PENDING').length}
              </span>
            )}
          </button>
        </div>

        {/* Filters and Search - Applicable to both modes */}
        <div className="mb-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ID, name, email, mobile…"
              className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-4 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 border border-border rounded-xl px-3 py-2 bg-background shadow-sm">
            <span className="text-xs font-semibold text-muted-foreground">From:</span>
            <input type="date" className="text-sm bg-transparent outline-none text-foreground" value={startDate} onChange={e => setStartDate(e.target.value)} />
            <span className="text-xs font-semibold text-muted-foreground ml-2">To:</span>
            <input type="date" className="text-sm bg-transparent outline-none text-foreground" value={endDate} onChange={e => setEndDate(e.target.value)} />
            {(startDate || endDate) && (
              <button title="Clear dates" onClick={() => { setStartDate(""); setEndDate(""); }} className="text-muted-foreground hover:text-foreground ml-1">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {mode === "ORDERS" && (
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        {mode === "ORDERS" && (
          <>
            {/* Stats row */}
            <div className="mb-4 flex flex-wrap gap-2">
              {
                ["PLACED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"].map((s) => {
                  const count = orders.filter((o: any) => o.status?.toUpperCase() === s).length;
                  return (
                    <button
                      key={s}
                      onClick={() => setFilterStatus(filterStatus === s ? "ALL" : s)}
                      className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${filterStatus === s ? "bg-primary text-primary-foreground" : STATUS_COLORS[s] || "bg-muted text-muted-foreground"
                        }`}
                    >
                      {s.replace(/_/g, " ")} ({count})
                    </button>
                  );
                })
              }
            </div >
          </>
        )}

        {/* Main Content Area */}
        {
          isLoading ? (
            <div className="space-y-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
          ) : mode === "REFUNDS" ? (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              {filtered.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <ArrowLeftRight className="mx-auto h-12 w-12 opacity-30" />
                  <p className="mt-4 text-sm font-semibold">No pending or processed refunds found.</p>
                </div>
              ) : (
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-4 py-3 text-left font-bold text-muted-foreground">Order ID</th>
                      <th className="px-4 py-3 text-left font-bold text-muted-foreground">Customer</th>
                      <th className="px-4 py-3 text-left font-bold text-muted-foreground">Gateway / Txn</th>
                      <th className="px-4 py-3 text-left font-bold text-muted-foreground">Refund Amount</th>
                      <th className="px-4 py-3 text-center font-bold text-muted-foreground">Refund Status</th>
                      <th className="px-4 py-3 text-center font-bold text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered
                      .map((order: any) => (
                        <tr key={order._id} className="border-b border-border last:border-0 hover:bg-accent/30">
                          <td className="px-4 py-3 font-bold">{order.customId || `#${order._id?.slice(-6).toUpperCase()}`}</td>
                          <td className="px-4 py-3">
                            <p className="font-medium">{order.customer?.name || order.user?.name || "Guest"}</p>
                            <p className="text-xs text-muted-foreground">{order.customer?.mobile || order.deliveryAddress?.mobile || "No phone"}</p>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {order.razorpayPaymentId ? `Razorpay: ${order.razorpayPaymentId}` : "Unknown"}
                          </td>
                          <td className="px-4 py-3 font-bold text-red-600">₹{Number(order.finalAmount || order.totalAmount || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-center">
                            {order.refundStatus === 'PROCESSED' ? (
                              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">✅ PROCESSED</span>
                            ) : (
                              <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-700">⏳ PENDING</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => setSelectedOrder(order)} className="rounded-lg p-1.5 border border-border hover:bg-accent">
                                <Eye className="h-4 w-4 text-muted-foreground" />
                              </button>
                              {order.refundStatus !== 'PROCESSED' && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <button className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-orange-600">
                                      Mark Processed
                                    </button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Process Refund manually?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Before marking this as Processed, ensure you have refunded ₹{Number(order.finalAmount || order.totalAmount || 0).toFixed(2)} from your Razorpay Dashboard for Order <strong>{order.customId}</strong>.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Wait, let me check</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => refundMutation.mutate(order._id)}
                                        className="bg-green-600 text-white hover:bg-green-700"
                                      >
                                        Yes, Mark as Processed
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-12 text-center">
              <Package className="mx-auto h-12 w-12 text-muted-foreground/30" />
              <p className="mt-4 text-sm font-semibold text-muted-foreground">No orders found</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left font-bold text-muted-foreground">Order</th>
                    <th className="px-4 py-3 text-left font-bold text-muted-foreground">Customer</th>
                    <th className="px-4 py-3 text-left font-bold text-muted-foreground">Items</th>
                    <th className="px-4 py-3 text-left font-bold text-muted-foreground">Amount</th>
                    <th className="px-4 py-3 text-left font-bold text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-center font-bold text-muted-foreground">Prep Time</th>
                    <th className="px-4 py-3 text-center font-bold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((order: any) => {
                    const statusKey = (order.status || order.orderStatus || "PLACED").toUpperCase();
                    const statusClass = STATUS_COLORS[statusKey] || "bg-muted text-muted-foreground";
                    const paymentStatusClass = PAYMENT_STATUS_COLORS[order.paymentStatus?.toUpperCase()] || "";
                    const customerMobile = order.customer?.mobile || order.deliveryAddress?.mobile || "";

                    return (
                      <motion.tr key={order._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b border-border last:border-0 hover:bg-accent/30">
                        <td className="px-4 py-3">
                          <p className="font-bold text-foreground">{order.customId || `#${order._id?.slice(-6).toUpperCase()}`}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{order.customer?.name || order.user?.name || "Guest User"}</p>
                          <p className="text-xs text-muted-foreground">{order.customer?.mobile || customerMobile || order.customer?.email || order.user?.email || ""}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-default text-xs text-muted-foreground">{order.items?.length || 0} items</span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-xs text-xs">
                              {getItemsSummary(order.items)}
                            </TooltipContent>
                          </Tooltip>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-foreground">₹{Number(order.finalAmount || order.totalAmount || 0).toFixed(2)}</p>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground">{order.paymentMethod || "—"}</span>
                            {order.paymentStatus && (
                              <span className={`rounded-full px-1.5 py-0 text-[9px] font-bold ${paymentStatusClass}`}>
                                {order.paymentStatus}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Select
                            value={statusKey}
                            onValueChange={(v) => statusMutation.mutate({ id: order._id, status: v })}
                          >
                            <SelectTrigger className={`h-8 w-40 rounded-full border-0 text-xs font-bold ${statusClass}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-3 text-center text-xs min-w-[130px]">
                          {["ACCEPTED", "PREPARING"].includes(statusKey) ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <input
                                type="number"
                                min="1"
                                defaultValue={order.preparationTime || ""}
                                id={`prep-time-inline-${order._id}`}
                                className="w-14 rounded-md border border-orange-200 bg-orange-50 px-2 py-1.5 text-center font-semibold text-orange-900 focus:border-orange-400 focus:outline-none dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-100"
                                placeholder="Mins"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const val = (document.getElementById(`prep-time-inline-${order._id}`) as HTMLInputElement)?.value;
                                  if (!val || Number(val) <= 0) return toast.error("Enter valid time");
                                  prepTimeMutation.mutate({ id: order._id, time: Number(val) });
                                }}
                                disabled={prepTimeMutation.isPending}
                                className="rounded-md bg-orange-500 px-2 py-1.5 font-bold text-white hover:bg-orange-600 disabled:opacity-50"
                              >
                                Set
                              </button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground/50 border border-dashed border-border px-3 py-1 rounded-md bg-muted/20">N/A</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => setSelectedOrder(order)} className="rounded-lg p-1.5 hover:bg-accent">
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            </button>
                            {statusKey !== "DELIVERED" && statusKey !== "CANCELLED" && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <button className="rounded-lg p-1.5 hover:bg-destructive/10">
                                    <X className="h-4 w-4 text-destructive" />
                                  </button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Cancel Order?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will cancel order {order.customId || `#${order._id?.slice(-6).toUpperCase()}`}. This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Keep Order</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => cancelMutation.mutate(order._id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Cancel Order
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        }

        {/* Order Detail Dialog — Rich Invoice View */}
        <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
          <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="text-lg">
                  {selectedOrder?.customId || `Order #${selectedOrder?._id?.slice(-6).toUpperCase()}`}
                </DialogTitle>
                {selectedOrder && (
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_COLORS[(selectedOrder.status || selectedOrder.orderStatus || "PLACED").toUpperCase()] || ""}`}>
                      {(selectedOrder.status || selectedOrder.orderStatus || "PLACED").replace(/_/g, " ")}
                    </span>
                    {selectedOrder.paymentStatus && (
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${PAYMENT_STATUS_COLORS[selectedOrder.paymentStatus?.toUpperCase()] || ""}`}>
                        {selectedOrder.paymentStatus}
                      </span>
                    )}
                  </div>
                )}
              </div>
              {selectedOrder && (
                <p className="text-xs text-muted-foreground">{formatDate(selectedOrder.createdAt)}</p>
              )}
            </DialogHeader>

            {selectedOrder && (selectedOrder.status === "CANCELLED" || selectedOrder.orderStatus === "CANCELLED") && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-200">
                <p className="font-bold flex items-center gap-2">
                  <XCircle className="h-4 w-4" /> Cancellation Reason
                </p>
                <p className="mt-1 ml-6 text-red-700/90 dark:text-red-300/90">
                  {selectedOrder.cancellationReason || "No reason provided."}
                </p>
              </div>
            )}

            {selectedOrder && (["ACCEPTED", "PREPARING"].includes(selectedOrder.status) || ["ACCEPTED", "PREPARING"].includes(selectedOrder.orderStatus)) && (
              <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm dark:border-orange-900/30 dark:bg-orange-950/20">
                <div>
                  <p className="font-bold flex items-center gap-2 text-orange-800 dark:text-orange-200">
                    <ChefHat className="h-4 w-4" /> Preparation Time
                  </p>
                  <p className="mt-1 text-orange-700/90 dark:text-orange-300/90 text-xs">
                    Set the estimated preparation time. If the order is Accepted, it will automatically move to Preparing.
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-2 sm:mt-0">
                  <input
                    type="number"
                    min="1"
                    placeholder="Mins"
                    className="w-20 rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm font-semibold text-orange-900 focus:border-orange-400 focus:outline-none dark:border-orange-800 dark:bg-orange-900/50 dark:text-orange-100"
                    defaultValue={selectedOrder.preparationTime || ""}
                    id={`prep-time-input`}
                  />
                  <button
                    onClick={() => {
                      const val = (document.getElementById(`prep-time-input`) as HTMLInputElement)?.value;
                      if (!val || Number(val) <= 0) return toast.error("Enter a valid time in minutes");
                      prepTimeMutation.mutate({ id: selectedOrder._id, time: Number(val) });
                    }}
                    disabled={prepTimeMutation.isPending}
                    className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-orange-600 disabled:opacity-50 whitespace-nowrap"
                  >
                    Set Time
                  </button>
                </div>
              </div>
            )}

            {selectedOrder && (
              <div className="space-y-5 text-sm">
                {/* Customer & Payment Grid */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Customer Info */}
                  <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Customer</p>
                    <p className="font-semibold text-foreground">{selectedOrder.customer?.name || selectedOrder.user?.name || "Guest User"}</p>
                    {(selectedOrder.customer?.email || selectedOrder.user?.email) && <p className="text-muted-foreground">{selectedOrder.customer?.email || selectedOrder.user?.email}</p>}
                    {(selectedOrder.customer?.mobile || selectedOrder.deliveryAddress?.mobile) && (
                      <p className="text-muted-foreground">📞 {selectedOrder.customer?.mobile || selectedOrder.deliveryAddress?.mobile}</p>
                    )}

                    {/* Display Total Order Count */}
                    {selectedOrder.customerOrderCount !== undefined && (
                      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-blue-100/50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        <span>🏆 Placed {selectedOrder.customerOrderCount} {selectedOrder.customerOrderCount === 1 ? 'order' : 'orders'} in total</span>
                      </div>
                    )}
                  </div>

                  {/* Payment Info */}
                  <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Payment</p>
                    <p className="font-semibold text-foreground">{selectedOrder.paymentMethod || "—"}</p>
                    {selectedOrder.razorpayPaymentId && (
                      <p className="text-xs text-muted-foreground break-all">Txn: {selectedOrder.razorpayPaymentId}</p>
                    )}
                    {selectedOrder.razorpayOrderId && (
                      <p className="text-xs text-muted-foreground break-all">Razorpay: {selectedOrder.razorpayOrderId}</p>
                    )}

                    {/* Granular Payment Metrics */}
                    {selectedOrder.paymentDetails && Object.keys(selectedOrder.paymentDetails).length > 1 && (
                      <div className="mt-2 rounded-lg bg-white/50 p-3 text-xs dark:bg-black/20 border border-border/50">
                        <p className="font-bold text-muted-foreground mb-1 uppercase text-[10px]">Payment Source</p>
                        {selectedOrder.paymentDetails.method === 'upi' && selectedOrder.paymentDetails.upiId && (
                          <div className="flex items-center gap-2"><span className="font-medium">UPI VPA:</span> <span className="font-bold text-blue-600 dark:text-blue-400">{selectedOrder.paymentDetails.upiId}</span></div>
                        )}
                        {selectedOrder.paymentDetails.method === 'card' && (
                          <div className="flex flex-col gap-0.5"><span className="font-medium">Card Network: {selectedOrder.paymentDetails.cardNetwork || 'Unknown'}</span> <span className="font-mono text-muted-foreground">**** **** **** {selectedOrder.paymentDetails.cardLast4 || 'XXXX'}</span></div>
                        )}
                        {selectedOrder.paymentDetails.method === 'wallet' && selectedOrder.paymentDetails.wallet && (
                          <div className="flex items-center gap-2"><span className="font-medium">Wallet:</span> <span className="capitalize">{selectedOrder.paymentDetails.wallet}</span></div>
                        )}
                        {selectedOrder.paymentDetails.method === 'netbanking' && selectedOrder.paymentDetails.bank && (
                          <div className="flex items-center gap-2"><span className="font-medium">Bank:</span> <span>{selectedOrder.paymentDetails.bank}</span></div>
                        )}
                      </div>
                    )}
                    <p className="text-xl font-extrabold text-green-600">₹{selectedOrder.finalAmount || selectedOrder.totalAmount || 0}</p>

                    {/* Payment Status Control */}
                    <div className="border-t border-border pt-3 space-y-1.5">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Payment Status</p>
                      <Select
                        value={(selectedOrder.paymentStatus || "PENDING").toUpperCase()}
                        onValueChange={(v) => paymentStatusMutation.mutate({ id: selectedOrder._id, paymentStatus: v })}
                      >
                        <SelectTrigger className={`h-8 w-full rounded-full border-0 text-xs font-bold ${PAYMENT_STATUS_COLORS[(selectedOrder.paymentStatus || "PENDING").toUpperCase()] || "bg-muted text-muted-foreground"}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PENDING">PENDING</SelectItem>
                          <SelectItem value="PAID">PAID</SelectItem>
                          <SelectItem value="FAILED">FAILED</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Refund Status Display */}
                    {selectedOrder.refundStatus && selectedOrder.refundStatus !== 'NO_REFUND' && (
                      <div className="border-t border-border pt-3 space-y-1.5 mt-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <CheckCircle className="h-3.5 w-3.5" /> Refund Status
                        </p>
                        <div className={`rounded-xl border p-3 ${selectedOrder.refundStatus === 'PROCESSED' ? 'bg-green-50/50 border-green-200 dark:bg-green-950/20 dark:border-green-900/40 text-green-700 dark:text-green-300' : 'bg-yellow-50/50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-900/40 text-yellow-700 dark:text-yellow-300'}`}>
                          <p className="font-bold text-sm">
                            {selectedOrder.refundStatus === 'PROCESSED' ? '✅ Refund Processed' : '⏳ Refund Pending'}
                          </p>
                          {selectedOrder.refundProcessedAt && (
                            <p className="text-xs mt-1 font-medium opacity-80">
                              On: {formatDate(selectedOrder.refundProcessedAt)}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-muted/30 p-4 relative">
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Delivery Address</p>
                    {(() => {
                      const addr = selectedOrder.deliveryAddress;
                      // Prioritize coordinates for accuracy
                      const coords = selectedOrder.deliveryCoordinates || addr?.coordinates || (addr?.lat && addr?.lng ? { lat: addr.lat, lng: addr.lng } : null);
                      const lat = coords?.lat || coords?.latitude;
                      const lng = coords?.lng || coords?.longitude;

                      // Fallback to address string
                      const addressString = typeof addr === "object"
                        ? [addr.addressLine1, addr.addressLine2, addr.city, addr.state, addr.postalCode].filter(Boolean).join(", ")
                        : (selectedOrder.address || addr);

                      const mapUrl = (lat && lng)
                        ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
                        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressString)}`;

                      return (
                        <div className="flex gap-2">
                          {/* QR Code Button */}
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[10px] font-bold text-gray-700 shadow-sm transition-colors hover:bg-gray-100 hover:text-black border border-gray-200">
                                <QrCode className="h-3 w-3" />
                                Show QR
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-4">
                              <div className="flex flex-col items-center gap-2">
                                <p className="text-xs font-bold text-center text-muted-foreground mb-2">Scan for Navigation 📍</p>
                                <div className="bg-white p-2 rounded-lg shadow-sm border border-border">
                                  <QRCode
                                    value={mapUrl}
                                    size={128}
                                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                    viewBox={`0 0 256 256`}
                                  />
                                </div>
                                <p className="text-[10px] text-muted-foreground text-center mt-1">Opens Google Maps</p>
                              </div>
                            </PopoverContent>
                          </Popover>

                          {/* Maps Link */}
                          <a
                            href={mapUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[10px] font-bold text-blue-600 shadow-sm transition-colors hover:bg-blue-50 hover:text-blue-700 border border-blue-100"
                          >
                            <MapPin className="h-3 w-3" />
                            Open Map
                          </a>
                        </div>
                      );
                    })()}
                  </div>
                  <p className="text-foreground">
                    {typeof selectedOrder.deliveryAddress === "object" && selectedOrder.deliveryAddress
                      ? [
                        selectedOrder.deliveryAddress.label && `(${selectedOrder.deliveryAddress.label})`,
                        selectedOrder.deliveryAddress.addressLine1 || selectedOrder.deliveryAddress.houseNo,
                        selectedOrder.deliveryAddress.addressLine2 || selectedOrder.deliveryAddress.street,
                        selectedOrder.deliveryAddress.landmark,
                        selectedOrder.deliveryAddress.city,
                        selectedOrder.deliveryAddress.state,
                        selectedOrder.deliveryAddress.postalCode || selectedOrder.deliveryAddress.zip,
                      ].filter(Boolean).join(", ")
                      : (selectedOrder.address || selectedOrder.deliveryAddress)}
                  </p>

                  {/* Delivery Instructions */}
                  {selectedOrder.deliveryInstruction && (
                    <div className="mt-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/30 p-2.5">
                      <p className="text-xs font-bold text-yellow-800 dark:text-yellow-500 uppercase flex items-center gap-1.5">
                        📝 Special Instructions
                      </p>
                      <p className="text-sm mt-1 text-yellow-900 dark:text-yellow-200/90 font-medium">
                        "{selectedOrder.deliveryInstruction}"
                      </p>
                    </div>
                  )}
                </div>

                {/* Items Table */}
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Items Ordered</p>
                  <div className="overflow-hidden rounded-xl border border-border">
                    <table className="w-full min-w-[500px] text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="px-4 py-2.5 text-left font-bold text-muted-foreground">Item</th>
                          <th className="px-4 py-2.5 text-center font-bold text-muted-foreground">Qty</th>
                          <th className="px-4 py-2.5 text-right font-bold text-muted-foreground">Price</th>
                          <th className="px-4 py-2.5 text-right font-bold text-muted-foreground">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedOrder.items || []).map((item: any, idx: number) => (
                          <tr key={idx} className="border-b border-border last:border-0">
                            <td className="px-4 py-2.5 text-foreground">
                              {item.name || item.product?.name || item.menuItem?.name || "Item"}
                              {item.variant && <span className="ml-1 text-xs text-muted-foreground">({item.variant})</span>}
                            </td>
                            <td className="px-4 py-2.5 text-center">{item.quantity}</td>
                            <td className="px-4 py-2.5 text-right">₹{Number(item.price || 0).toFixed(2)}</td>
                            <td className="px-4 py-2.5 text-right font-semibold">₹{Number((item.price || 0) * item.quantity).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Bill Summary */}
                <div className="rounded-xl bg-muted/50 p-4 space-y-1.5">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>₹{Number(selectedOrder.totalAmount || 0).toFixed(2)}</span></div>
                  {selectedOrder.discountApplied > 0 && (
                    <div className="flex justify-between text-green-600"><span>Discount</span><span>-₹{Number(selectedOrder.discountApplied).toFixed(2)}</span></div>
                  )}
                  {selectedOrder.deliveryFee > 0 && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Delivery Fee</span><span>₹{selectedOrder.deliveryFee}</span></div>
                  )}
                  {(selectedOrder.taxAmount > 0 || selectedOrder.cgstTotal > 0 || selectedOrder.sgstTotal > 0 || selectedOrder.igstTotal > 0) && (
                    <div className="flex flex-col gap-1 text-muted-foreground border-t border-border/50 pt-2 mt-2">
                      <div className="flex justify-between">
                        <span>Tax</span>
                        <span>₹{Number(selectedOrder.taxAmount || ((selectedOrder.cgstTotal || 0) + (selectedOrder.sgstTotal || 0) + (selectedOrder.igstTotal || 0))).toFixed(2)}</span>
                      </div>
                      {(selectedOrder.cgstTotal > 0 || selectedOrder.sgstTotal > 0) && (
                        <div className="ml-2 flex flex-col gap-0.5 text-xs text-muted-foreground/80 border-l-2 border-border pl-2">
                          {selectedOrder.cgstTotal > 0 && (
                            <div className="flex justify-between">
                              <span>CGST</span>
                              <span>₹{selectedOrder.cgstTotal}</span>
                            </div>
                          )}
                          {selectedOrder.sgstTotal > 0 && (
                            <div className="flex justify-between">
                              <span>SGST</span>
                              <span>₹{selectedOrder.sgstTotal}</span>
                            </div>
                          )}
                        </div>
                      )}
                      {selectedOrder.igstTotal > 0 && (
                        <div className="ml-2 text-xs text-muted-foreground/80 border-l-2 border-border pl-2 flex justify-between">
                          <span>IGST</span>
                          <span>₹{selectedOrder.igstTotal}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
                    <span>Total</span><span>₹{Number(selectedOrder.finalAmount || selectedOrder.totalAmount || 0).toFixed(2)}</span>
                  </div>
                </div>

                {/* Coupon */}
                {selectedOrder.couponCode && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Tag className="h-3.5 w-3.5" /> Coupon applied: <span className="font-bold text-foreground">{selectedOrder.couponCode}</span>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div >
    </TooltipProvider >
  );
};

export default AdminOrders;
