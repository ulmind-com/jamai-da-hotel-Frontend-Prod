import {
  User,
  MapPin,
  ChevronDown,
  LayoutDashboard,
  UtensilsCrossed,
  Package,
  Navigation,
  ShoppingCart,
  Film,
} from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useLocationStore } from "@/store/useLocationStore";
import { useCartStore } from "@/store/useCartStore";
import { Link, useNavigate } from "react-router-dom";
import { useRestaurantStore } from "@/store/useRestaurantStore";
import { ThemeToggle } from "./ThemeToggle";
import { resolveImageURL } from "@/lib/image-utils";

const Navbar = () => {
  const { user, openAuthModal, isAuthenticated, isAdmin } = useAuthStore();
  const { selectedAddress } = useLocationStore();
  const { items, toggleCart } = useCartStore();
  const restaurant = useRestaurantStore((s) => s.restaurant);
  const navigate = useNavigate();

  const isCustomer = isAuthenticated() && !isAdmin();
  const isAdminUser = isAuthenticated() && isAdmin();
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);

  console.log("Navbar Debug:", {
    isAuthenticated: isAuthenticated(),
    isAdmin: isAdmin(),
    userRole: user?.role,
    selectedAddressId: selectedAddress?._id || selectedAddress?.id
  });

  // ── Location display text ──────────────────────────────────────────────────
  const locationLabel = selectedAddress
    ? selectedAddress.type === "HOME"
      ? "Home"
      : selectedAddress.type === "WORK"
        ? "Work"
        : selectedAddress.addressLine1?.split(",")[0]?.trim() || "My Location"
    : "Add Address";

  const locationSub = selectedAddress
    ? [selectedAddress.city, selectedAddress.state].filter(Boolean).join(", ")
    : "Tap to set delivery location";

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-sm">
      <div className="mx-auto flex h-16 max-w-screen-xl items-center gap-3 px-4 sm:px-6">

        {/* ── LEFT: Location widget (customer) OR Logo (admin/guest) ─────── */}
        {isCustomer ? (
          /* Location Widget — full left side for customers */
          <button
            onClick={() => navigate("/addresses")}
            className="group flex min-w-0 items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-accent"
          >
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20 transition-all group-hover:bg-primary/20">
              {selectedAddress ? (
                <MapPin className="h-4.5 w-4.5 text-primary" style={{ height: "1.1rem", width: "1.1rem" }} />
              ) : (
                <Navigation className="h-4 w-4 text-primary" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-0.5">
                <span className="max-w-[160px] truncate text-sm font-bold text-foreground sm:max-w-[220px]">
                  {locationLabel}
                </span>
                <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground transition-transform group-hover:translate-y-0.5" />
              </div>
              <p className="max-w-[160px] truncate text-xs text-muted-foreground sm:max-w-[220px]">
                {locationSub}
              </p>
            </div>
          </button>
        ) : (
          /* Logo — for admin & guests */
          <Link to="/" className="flex items-center gap-2.5 min-w-0">
            {restaurant?.logo ? (
              <img
                src={resolveImageURL(restaurant.logo)}
                alt={restaurant.name || "Restaurant Logo"}
                className="h-9 w-9 flex-shrink-0 rounded-xl object-cover shadow-md"
              />
            ) : (
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary shadow-md">
                <UtensilsCrossed className="h-5 w-5 text-primary-foreground" />
              </div>
            )}
            <span className="truncate text-lg font-extrabold tracking-tight text-foreground">
              {restaurant?.name || "Haldia Cloud Kitchen & Restaurant"}
            </span>
          </Link>
        )}

        {/* ── SPACER ────────────────────────────────────────────────────────── */}
        <div className="flex-1" />

        {/* ── RIGHT: Actions ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 sm:gap-2">

          {/* Theme Toggle */}
          <ThemeToggle />

          {isAuthenticated() ? (
            <>
              {isAdminUser ? (
                /* Admin links */
                <>
                  <NavLink to="/admin" icon={<LayoutDashboard className="h-4 w-4" />} label="Dashboard" />
                  <NavLink to="/" icon={<UtensilsCrossed className="h-4 w-4" />} label="Menu" />
                  <NavLink to="/vlogs" icon={<Film className="h-4 w-4" />} label="Vlogs" />
                </>
              ) : (
                /* Customer links */
                <>
                  <NavLink to="/my-orders" icon={<Package className="h-4 w-4" />} label="Orders" />
                  <NavLink to="/vlogs" icon={<Film className="h-4 w-4" />} label="Vlogs" />
                  {/* Cart button — desktop only (mobile uses CartBar) */}
                  <button
                    onClick={toggleCart}
                    className="relative hidden md:flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    <span className="hidden sm:inline">Cart</span>
                    {totalItems > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-4.5 w-4.5 min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-black text-primary-foreground shadow" style={{ height: '18px', minWidth: '18px' }}>
                        {totalItems > 9 ? "9+" : totalItems}
                      </span>
                    )}
                  </button>
                </>
              )}

              {/* Profile */}
              <Link
                to="/profile"
                className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {user?.name?.charAt(0)?.toUpperCase() || <User className="h-3.5 w-3.5" />}
                </div>
                <span className="hidden sm:inline">{user?.name?.split(" ")[0] || "Account"}</span>
              </Link>
            </>
          ) : (
            /* Guest */
            <>
              <button
                onClick={() => openAuthModal("login")}
                className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
              >
                <User className="h-4 w-4" />
                <span>Sign In</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

/* ── Small helper for nav links ─────────────────────────────────────────────── */
function NavLink({
  to,
  icon,
  label,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

export default Navbar;
