import { useEffect, useState } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import UserProfile from "./pages/UserProfile";
import AdminDashboard from "./pages/AdminDashboard";
import CheckoutPage from "./pages/CheckoutPage";
import MyOrders from "./pages/MyOrders";
import AddressesPage from "./pages/AddressesPage";
import OrderTracking from "./pages/OrderTracking";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import Navbar from "./components/Navbar";
import CartDrawer from "./components/CartDrawer";
import CartBar from "./components/CartBar";
import Footer from "./components/Footer";
import AuthModal from "./components/AuthModal";
import ProtectedRoute from "./components/ProtectedRoute";
import RestaurantClosedBanner from "./components/RestaurantClosedBanner";
import { restaurantApi, userApi } from "./api/axios";
import { useRestaurantStore } from "./store/useRestaurantStore";
import { useCartStore } from "./store/useCartStore";
import { useAuthStore } from "./store/useAuthStore";
import { useLocationStore } from "./store/useLocationStore";
import { socket } from "./api/socket";
import { toast } from "sonner";
import { playChatSound } from "./lib/notification-sound";
import CustomerChatDrawer from "./components/CustomerChatDrawer";
import VlogGallery from "./pages/VlogGallery";

// Dynamically set favicon from a URL
const setFavicon = (url: string) => {
  let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = url;
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
    },
  },
});

const AppContent = () => {
  const restaurant = useRestaurantStore((s) => s.restaurant);
  const setRestaurant = useRestaurantStore((s) => s.setRestaurant);
  const setLoading = useRestaurantStore((s) => s.setLoading);
  const fetchCart = useCartStore((s) => s.fetchCart);
  const { token, setUser, user, isAdmin } = useAuthStore();
  const setSelectedAddress = useLocationStore((s) => s.setSelectedAddress);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    restaurantApi
      .get()
      .then((res) => setRestaurant(res.data))
      .catch(() => setLoading(false));
  }, []);

  // Global chat notification for user (only when NOT admin and logged in)
  useEffect(() => {
    if (!token || isAdmin()) return;

    // Fetch the user's chat session and join the socket room
    // so this global socket actually receives admin reply events
    import("./api/axios").then(({ chatApi }) => {
      chatApi.getOrCreateChat().then((res) => {
        const chatId = res.data._id;
        if (chatId) socket.emit("joinChat", chatId);
      }).catch(() => {/* chat not yet created - ignore */ });
    });

    socket.on("chatMessage", (data: { chatId: string; message: any }) => {
      // Only ring for admin replies
      if (data.message?.sender !== "admin") return;

      playChatSound();

      toast(`💬 Reply from Restaurant`, {
        description: data.message.text || "You got a new message!",
        duration: 7000,
        action: {
          label: "Open Chat",
          onClick: () => setChatOpen(true),
        },
      });
    });

    return () => {
      socket.off("chatMessage");
    };
  }, [token, user?.role]);


  // Dynamically set page title + favicon from restaurant API
  useEffect(() => {
    if (restaurant?.name) {
      document.title = restaurant.name;
    }
    if (restaurant?.logo) {
      setFavicon(restaurant.logo);
    }
  }, [restaurant?.name, restaurant?.logo]);

  const queryClient = useQueryClient();

  useEffect(() => {
    if (token) {
      // Sync cart
      fetchCart();
      // Sync profile
      userApi.getProfile()
        .then((res) => {
          // Fix: Dont overwrite role if missing in profile response (common if profile endpoint doesn't return role)
          const currentRole = useAuthStore.getState().user?.role;
          const incoming = res.data;

          if (!incoming.role && currentRole) {
            incoming.role = currentRole;
          }
          setUser(incoming);
        })
        .catch((err) => console.error("Failed to sync profile:", err));

      // Sync selected address
      userApi.getSelectedAddress()
        .then((res) => {
          const addr = res.data.selectedAddress || res.data;

          if (addr && (addr._id || addr.id)) {
            setSelectedAddress({ ...addr, _id: addr._id || addr.id });
          }
        })
        .catch((err) => console.error("Failed to sync address:", err));
    } else {
      // Logout cleanup: Clear React Query cache to remove stale data from previous user
      queryClient.clear();
      setSelectedAddress(null);
    }
  }, [token]); // fetchCart/setUser/setSelectedAddress are stable Zustand actions — no need in deps

  return (
    <BrowserRouter>
      <Navbar />
      <RestaurantClosedBanner />
      <CartDrawer />
      <CartBar />
      <AuthModal />
      <CustomerChatDrawer isOpen={chatOpen} onClose={() => setChatOpen(false)} />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <UserProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/checkout"
          element={
            <ProtectedRoute>
              <CheckoutPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-orders"
          element={
            <ProtectedRoute>
              <MyOrders />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders/:id"
          element={
            <ProtectedRoute>
              <OrderTracking />
            </ProtectedRoute>
          }
        />
        <Route
          path="/addresses"
          element={
            <ProtectedRoute>
              <AddressesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute staffOnly>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/vlogs" element={<VlogGallery />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Footer />
    </BrowserRouter>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-right" richColors />
        <AppContent />
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
