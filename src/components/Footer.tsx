import { UtensilsCrossed, MapPin, Heart } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useRestaurantStore } from "@/store/useRestaurantStore";
import { resolveImageURL } from "@/lib/image-utils";

const Footer = () => {
    const restaurant = useRestaurantStore((s) => s.restaurant);
    const location = useLocation();

    // Only show footer on the home page
    if (location.pathname !== "/") return null;

    const year = new Date().getFullYear();

    return (
        <footer className="border-t border-border bg-card mt-auto">
            <div className="mx-auto max-w-screen-xl px-4 sm:px-6 py-10">
                {/* Top row */}
                <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">

                    {/* Brand */}
                    <div className="flex flex-col gap-3 max-w-xs">
                        <div className="flex items-center gap-2.5">
                            {restaurant?.logo ? (
                                <img
                                    src={resolveImageURL(restaurant.logo)}
                                    alt={restaurant.name || "Restaurant Logo"}
                                    className="h-9 w-9 flex-shrink-0 rounded-xl object-cover shadow-md"
                                />
                            ) : (
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-md">
                                    <UtensilsCrossed className="h-5 w-5 text-primary-foreground" />
                                </div>
                            )}
                            <span
                                className="text-xl font-extrabold tracking-tight text-foreground"
                                style={{ fontFamily: "'Playfair Display', serif" }}
                            >
                                {restaurant?.name ?? "Haldia Cloud Kitchen & Restaurant"}
                            </span>
                        </div>
                        {restaurant?.address && (
                            <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
                                <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
                                <span>{restaurant.address}</span>
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Fresh food, delivered fast. Order your favourites and enjoy every bite.
                        </p>
                    </div>

                    {/* Quick links */}
                    <div className="flex flex-col gap-2">
                        <p
                            className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
                            style={{ fontFamily: "'Inter', sans-serif" }}
                        >
                            Quick Links
                        </p>
                        <nav className="flex flex-col gap-1.5">
                            {[
                                { label: "Menu", to: "/" },
                                { label: "My Orders", to: "/my-orders" },
                                { label: "My Addresses", to: "/addresses" },
                                { label: "Profile", to: "/profile" },
                            ].map(({ label, to }) => (
                                <Link
                                    key={to}
                                    to={to}
                                    className="text-sm text-muted-foreground transition-colors hover:text-primary"
                                >
                                    {label}
                                </Link>
                            ))}
                        </nav>
                    </div>
                </div>

                {/* Divider */}
                <div className="my-8 border-t border-border" />

                {/* Bottom row */}
                <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
                    <p className="text-xs text-muted-foreground">
                        © {year} {restaurant?.name ?? "Haldia Cloud Kitchen & Restaurant"}. All rights reserved.
                    </p>

                    {/* ULMiND credit */}
                    <a
                        href="https://www.ulmind.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"
                    >
                        <span>Developed with</span>
                        <Heart className="h-3 w-3 fill-primary text-primary transition-transform group-hover:scale-125" />
                        <span>by</span>
                        <span
                            className="font-bold text-foreground group-hover:text-primary transition-colors"
                            style={{ fontFamily: "'Inter', sans-serif", letterSpacing: "0.05em" }}
                        >
                            ULMiND
                        </span>
                    </a>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
