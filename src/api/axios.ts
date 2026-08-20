import axios from "axios";
import { toast } from "sonner";
import { API_URL } from "@/lib/config";

const API_BASE_URL = `${API_URL}/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor – attach Bearer token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor – global error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    if (status === 401) {
      // Only log out on a real session/token failure — NOT on a role
      // authorization error (e.g. a Manager/Waiter hitting an admin-only route),
      // otherwise restricted roles get kicked out of the panel.
      const msg = (error.response?.data?.message || "").toLowerCase();
      const isSessionError = /no token|token failed|jwt|expired|not authorized, /.test(msg);
      if (isSessionError) {
        localStorage.removeItem("auth_token");
        toast.error("Session Expired. Please login again.");
        window.location.href = "/";
      }
      // Authorization errors fall through silently (the caller can handle them).
    } else if (status === 500) {
      toast.error("Something went wrong. Please try again.");
    }
    return Promise.reject(error);
  }
);

export default api;

// ─── Auth ───────────────────────────────────
export const authApi = {
  login: (data: { email: string; password: string }) => api.post("/auth/login", data),
  register: (data: { name: string; email: string; password: string; mobile: string; signupToken: string; address?: object }) =>
    api.post("/auth/register", data),
  // OTP-verified signup
  sendOtp: (data: { email: string }) => api.post("/auth/send-otp", data),
  verifyOtp: (data: { email: string; otp: string }) => api.post("/auth/verify-otp", data),
  // Forgot / reset password
  forgotPassword: (data: { email: string }) => api.post("/auth/forgot-password", data),
  resetPassword: (data: { token: string; password: string }) => api.post("/auth/reset-password", data),
};

// ─── User ───────────────────────────────────
export const userApi = {
  getProfile: () => api.get("/users/profile"),
  updateProfile: (data: { name?: string; mobile?: string; address?: string; profileImage?: string }) => api.put("/users/profile", data),
  getAll: (params?: any) => api.get("/users", { params }),
  createUser: (data: { name: string; email: string; password: string; mobile: string; role: string }) =>
    api.post("/users", data),
  updateUser: (id: string, data: { role?: string; isActive?: boolean; isCodDisabled?: boolean }) => api.put(`/users/${id}`, data),
  deleteUser: (id: string) => api.delete(`/users/${id}`),
  getAddresses: () => api.get("/users/addresses"),
  addAddress: (data: any) => api.post("/users/addresses", data),
  updateAddress: (id: string, data: any) => api.put(`/users/addresses/${id}`, data),
  deleteAddress: (id: string) => api.delete(`/users/addresses/${id}`),
  reverseGeocode: (lat: number, lng: number) =>
    api.get("/users/addresses/reverse-geocode", { params: { lat, lng } }),
  selectAddress: (data: { addressId?: string; address?: any }) => api.put("/users/addresses/select", data),
  getSelectedAddress: () => api.get("/users/addresses/select"),
};

// ─── Restaurant ─────────────────────────────
export const restaurantApi = {
  get: () => api.get("/restaurant"),
  update: (data: { isOpen?: boolean; openingTime?: string; closingTime?: string; isCodEnabled?: boolean; codStartTime?: string; codEndTime?: string; name?: string; address?: string; deliveryRadius?: number; freeDeliveryRadius?: number; chargePerKm?: number; mobile?: string; logo?: string; gstIn?: string; fssaiLicense?: string }) =>
    api.put("/restaurant", data),
  setLocation: (data: { lat: number; lng: number; address?: string }) =>
    api.put("/restaurant/location", data),
  getVideos: () => api.get("/restaurant/videos"),
  addVideo: (data: { url: string }) => api.post("/restaurant/videos", data),
  deleteVideo: (index: number) => api.delete(`/restaurant/videos/${index}`),
};

// ─── Menu & Categories ──────────────────────
export const menuApi = {
  getCategories: () => api.get("/categories"),
  getMenu: (params?: { category?: string; type?: string; search?: string }) =>
    api.get("/menu", { params }),
  getCategoryById: (id: string) => api.get(`/categories/${id}`),
  getProductById: (id: string) => api.get(`/menu/${id}`),
  getAdminMenu: () => api.get("/menu/admin"),
  applyDiscount: (id: string, data: { percentage: number; duration: { hours: number; minutes: number } }) =>
    api.post(`/menu/${id}/discount`, data),
  removeDiscount: (id: string) => api.delete(`/menu/${id}/discount`),
};

// ─── Category Admin ─────────────────────────
export const categoryApi = {
  create: (data: { name: string; imageURL: string }) => api.post("/categories", data),
  update: (id: string, data: { name?: string; imageURL?: string }) => api.put(`/categories/${id}`, data),
  delete: (id: string) => api.delete(`/categories/${id}`),
};

// ─── Cart (Server-Side) ─────────────────────
export const cartApi = {
  get: () => api.get("/cart"),
  getBill: (lat?: number, lng?: number) => api.get("/cart/bill" + (lat && lng ? `?lat=${lat}&lng=${lng}` : '')),
  add: (data: { productId: string; quantity: number }) => api.post("/cart", data),
  updateQty: (itemId: string, data: { quantity: number }) => api.put(`/cart/${itemId}`, data),
  removeItem: (itemId: string) => api.delete(`/cart/${itemId}`),
  clear: () => api.delete("/cart"),
  applyCoupon: (data: { code: string }) => api.post("/cart/coupon", data),
  removeCoupon: () => api.delete("/cart/coupon"),
  getRecommendations: () => api.get("/cart/recommendations"),
};

// ─── Orders ─────────────────────────────────
export const orderApi = {
  calcFee: (data: { lat: number; lng: number }) => api.post("/orders/calc-fee", data),
  placeOrder: (data: {
    items: Array<{ product: string; quantity: number; variant?: string; price: number }>;
    totalAmount: number;
    deliveryAddress?: string;
    address?: string;
    deliveryInstruction?: string;
    deliveryCoordinates?: { lat: number; lng: number };
    deliveryFee?: number;
    paymentMethod: "COD" | "ONLINE";
    discountApplied?: number;
    finalAmount?: number;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
  }) => api.post("/orders", data),
  getMyOrders: () => api.get("/orders/my-orders"),
  getOrderById: (id: string) => api.get(`/orders/${id}`),
  cancelOrder: (id: string, reason?: string) => api.post(`/orders/${id}/cancel`, { reason }),
};

// ─── Coupons ────────────────────────────────
export const couponApi = {
  validate: (data: { code: string; orderTotal: number }) => api.post("/coupons/validate", data),
  getAll: () => api.get("/coupons"),
  create: (data: {
    code: string;
    name?: string;
    description?: string;
    discountType: "PERCENTAGE" | "FLAT";
    discountAmount: number;
    discountPercent: number;
    minOrderValue?: number;
    usageLimit?: number;
    validFrom?: string;
    validUntil?: string;
  }) => api.post("/coupons", data),
  update: (id: string, data: {
    code?: string;
    name?: string;
    description?: string;
    isActive?: boolean;
    validFrom?: string;
    validUntil?: string;
  }) => api.put(`/coupons/${id}`, data),
  delete: (id: string) => api.delete(`/coupons/${id}`),
};

// ─── Reviews ────────────────────────────────
// ─── Reviews ────────────────────────────────
export const reviewApi = {
  add: (data: { orderId: string; rating: number; comment: string }) => api.post("/reviews", data),
  getStats: () => api.get("/reviews/stats"),
  getAdminReviews: (params?: any) => api.get("/reviews/admin", { params }),
  getMyReviews: () => api.get("/reviews/my-reviews"),
};

// ─── Payments ───────────────────────────────
export const paymentApi = {
  createOrder: (data: { amount: number; items?: any[]; deliveryAddress?: any; deliveryFee?: number }) =>
    api.post("/orders/payment/create", data),
};

// ─── Upload ─────────────────────────────────
export const uploadApi = {
  uploadImage: (file: File) => {
    const formData = new FormData();
    formData.append("image", file);
    return api.post("/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  uploadMultipleImages: async (files: File[]) => {
    const uploadPromises = files.map((file) => uploadApi.uploadImage(file));
    const responses = await Promise.all(uploadPromises);
    return responses.map((res) => res.data.url as string);
  },
  uploadVideo: (file: File, onProgress?: (pct: number) => void) => {
    const formData = new FormData();
    formData.append("video", file);
    return api.post("/upload/video", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (e.total && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    });
  },
};

// ─── Admin ──────────────────────────────────
export const adminApi = {
  getDashboard: (params?: { startDate?: string; endDate?: string }) => api.get("/admin/dashboard", { params }),
  getOrders: (params?: any) => api.get("/admin/orders", { params }),
  getOrdersByStatus: (status: string) => api.get(`/admin/orders/${status}`),
  getAnalytics: (params?: { startDate?: string; endDate?: string }) => api.get("/admin/analytics", { params }),
  getMapAnalytics: (params?: { startDate?: string; endDate?: string }) => api.get("/admin/analytics/map", { params }),
  updateOrderStatus: (id: string, data: { status: string }) => api.put(`/admin/orders/${id}/status`, data),
  cancelOrder: (id: string) => api.put(`/admin/orders/${id}/status`, { status: "CANCELLED" }),
  updatePaymentStatus: (id: string, data: { paymentStatus: string }) => api.put(`/admin/orders/${id}/payment-status`, data),
  updatePreparationTime: (id: string, data: { preparationTime: number }) => api.put(`/admin/orders/${id}/preparation-time`, data),
  processRefund: (id: string) => api.put(`/admin/orders/${id}/refund`),
  addMenuItem: (data: any) => api.post("/menu", data),
  updateMenuItem: (id: string, data: any) => api.put(`/menu/${id}`, data),
  deleteMenuItem: (id: string) => api.delete(`/menu/${id}`),

  // POS (Offline Billing)
  createPOSOrder: (data: { items: any[]; customerName?: string; customerMobile?: string; paymentMethod: string }) =>
    api.post("/admin/pos/create", data),
  getPOSOrders: (params?: any) => api.get("/admin/pos/orders", { params }),
};

// ─── Chat ────────────────────────────────────
export const chatApi = {
  // User endpoints
  getOrCreateChat: () => api.get("/chat"),
  createNewChat: () => api.post("/chat/create"),
  sendMessage: (data: { text: string; images?: string[] }) => api.post("/chat/message", data),
  markRead: () => api.put("/chat/read"),

  // Admin endpoints
  getAllChats: () => api.get("/chat/admin/all"),
  getChatById: (chatId: string) => api.get(`/chat/admin/${chatId}`),
  adminReply: (chatId: string, data: { text: string; images?: string[] }) => api.post(`/chat/admin/${chatId}/message`, data),
  closeChat: (chatId: string) => api.put(`/chat/admin/${chatId}/close`),
  deleteChat: (chatId: string) => api.delete(`/chat/admin/${chatId}`),
};

// ─── Vlogs / Gallery ────────────────────────────────────
export const vlogApi = {
  // Public
  getPublicVlogs: () => api.get("/vlogs"),
  incrementView: (id: string) => api.put(`/vlogs/${id}/view`),
  // Admin
  getAdminVlogs: (params?: any) => api.get("/vlogs/admin", { params }),
  createVlog: (data: any) => api.post("/vlogs", data),
  updateVlog: (id: string, data: any) => api.put(`/vlogs/${id}`, data),
  deleteVlog: (id: string) => api.delete(`/vlogs/${id}`),
};

// ─── POS: Tables & Sections ─────────────────────────────
export const posApi = {
  // Sections (table categories)
  getSections: () => api.get("/pos/table-categories"),
  createSection: (data: { name: string; description?: string; sortOrder?: number }) =>
    api.post("/pos/table-categories", data),
  updateSection: (id: string, data: { name?: string; description?: string; sortOrder?: number }) =>
    api.put(`/pos/table-categories/${id}`, data),
  deleteSection: (id: string) => api.delete(`/pos/table-categories/${id}`),

  // Tables
  getTables: (params?: { category?: string; status?: string }) => api.get("/pos/tables", { params }),
  createTable: (data: { name: string; category: string; capacity?: number }) =>
    api.post("/pos/tables", data),
  updateTable: (id: string, data: { name?: string; category?: string; capacity?: number }) =>
    api.put(`/pos/tables/${id}`, data),
  deleteTable: (id: string) => api.delete(`/pos/tables/${id}`),
  setTableStatus: (id: string, status: "available" | "occupied" | "dirty") =>
    api.put(`/pos/tables/${id}/status`, { status }),

  // KOT (Kitchen Order Tickets)
  getKots: (params?: { status?: string; table?: string }) => api.get("/pos/kots", { params }),
  getKot: (id: string) => api.get(`/pos/kots/${id}`),
  createKot: (data: { tableId: string; items: { product: string; variant?: string; quantity: number }[]; notes?: string }) =>
    api.post("/pos/kots", data),
  updateKot: (id: string, data: { items: { product: string; variant?: string; quantity: number }[]; notes?: string }) =>
    api.put(`/pos/kots/${id}`, data),
  deleteKot: (id: string) => api.delete(`/pos/kots/${id}`),

  // Bills (generate + settlement)
  generateBill: (data: { tableId: string; kotIds?: string[]; discountType?: "NONE" | "FLAT" | "PERCENTAGE"; discountValue?: number }) =>
    api.post("/pos/bills", data),
  getBills: (params?: { status?: string; from?: string; to?: string }) => api.get("/pos/bills", { params }),
  getBill: (id: string) => api.get(`/pos/bills/${id}`),
  settleBill: (id: string, data: { paymentMethod: "CASH" | "UPI" | "CARD"; customerName?: string; customerPhone?: string }) =>
    api.put(`/pos/bills/${id}/settle`, data),
  requestBillDelete: (id: string, reason?: string) => api.post(`/pos/bills/${id}/request-delete`, { reason }),
  deleteBill: (id: string) => api.delete(`/pos/bills/${id}`),
  rejectBillDelete: (id: string) => api.put(`/pos/bills/${id}/reject-delete`),

  // Reports & dashboard
  getReport: (params: { from?: string; to?: string }) => api.get("/pos/report", { params }),
  getPosDashboard: (params?: { from?: string; to?: string }) => api.get("/pos/dashboard", { params }),
  getPending: () => api.get("/pos/pending"),
  emailReport: (data: { from?: string; to?: string; email?: string; pdfBase64?: string; filename?: string }) => api.post("/pos/report/email", data),
};
