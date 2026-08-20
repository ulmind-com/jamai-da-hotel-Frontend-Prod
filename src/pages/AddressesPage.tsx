import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userApi } from "@/api/axios";
import { useLocationStore, SavedAddress } from "@/store/useLocationStore";
import { LocationPickerModal } from "@/components/LocationPickerModal";
import { AddressFormModal } from "@/components/AddressFormModal";
import { useNavigate, useLocation } from "react-router-dom";
import {
    MapPin, Plus, Navigation, Trash2, Pencil, Home, Briefcase,
    ChevronLeft, CheckCircle2, Loader2
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const TYPE_ICONS: Record<string, any> = {
    HOME: Home,
    WORK: Briefcase,
    OTHER: MapPin,
};

const TYPE_COLORS: Record<string, string> = {
    HOME: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    WORK: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
    OTHER: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
};

export default function AddressesPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const { selectedAddress, setSelectedAddress } = useLocationStore();

    // Detect if we came from checkout — redirect back after selecting
    const fromCheckout = new URLSearchParams(location.search).get("from") === "checkout";

    const [showMapPicker, setShowMapPicker] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editAddress, setEditAddress] = useState<any>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const { data: addresses = [], isLoading } = useQuery<SavedAddress[]>({
        queryKey: ["user-addresses"],
        queryFn: async () => {
            const res = await userApi.getAddresses();
            return res.data;
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => userApi.deleteAddress(id),
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: ["user-addresses"] });
            if (selectedAddress?._id === id) setSelectedAddress(null);
            toast.success("Address deleted");
            setDeletingId(null);
        },
        onError: () => {
            toast.error("Failed to delete address");
            setDeletingId(null);
        },
    });

    const handleUseCurrentLocation = () => {
        if (!navigator.geolocation) {
            toast.error("Geolocation is not supported by your browser");
            return;
        }
        setShowMapPicker(true);
    };

    const handleSelectAddress = async (addr: SavedAddress) => {
        try {
            await userApi.selectAddress({ addressId: addr._id });
            setSelectedAddress(addr);
            toast.success("Delivery location updated!");
            if (fromCheckout) {
                navigate("/checkout");
            } else {
                navigate(-1);
            }
        } catch (error) {
            toast.error("Failed to update delivery location");
        }
    };

    const handleEdit = (addr: SavedAddress) => {
        setEditAddress(addr);
        setShowForm(true);
    };

    const handleDelete = (id: string) => {
        setDeletingId(id);
        deleteMutation.mutate(id);
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
                <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent transition-colors"
                    >
                        <ChevronLeft className="h-5 w-5 text-foreground" />
                    </button>
                    <div>
                        <h1 className="text-xl font-extrabold text-foreground">Manage Addresses</h1>
                        <p className="text-xs text-muted-foreground">Select or add your delivery location</p>
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
                {/* Use Current Location Button */}
                <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleUseCurrentLocation}
                    className="flex w-full items-center gap-4 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-4 text-left transition-all hover:border-primary hover:bg-primary/10"
                >
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Navigation className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <p className="font-bold text-primary">Add New Address</p>
                        <p className="text-sm text-muted-foreground">Pick your delivery location on the map</p>
                    </div>
                </motion.button>


                {/* Saved Addresses */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : addresses.length > 0 ? (
                    <div>
                        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                            Saved Addresses
                        </h2>
                        <div className="space-y-3">
                            <AnimatePresence>
                                {addresses.map((addr) => {
                                    const Icon = TYPE_ICONS[addr.type] || MapPin;
                                    const addrId = addr._id || addr.id;
                                    const selectedId = selectedAddress?._id || selectedAddress?.id;
                                    const isSelected = selectedId === addrId;
                                    const isDeleting = deletingId === addr._id;

                                    return (
                                        <motion.div
                                            key={addr._id}
                                            layout
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            className={`relative rounded-xl border px-3 py-3 transition-all ${isSelected
                                                ? "border-primary bg-primary/5 shadow-sm"
                                                : "border-border hover:border-primary/30"
                                                }`}
                                        >
                                            {/* Selected indicator */}
                                            {isSelected && (
                                                <div className="absolute right-3 top-3">
                                                    <CheckCircle2 className="h-4 w-4 text-primary" />
                                                </div>
                                            )}

                                            <button
                                                onClick={() => handleSelectAddress(addr)}
                                                className="flex w-full items-start gap-3 text-left"
                                            >
                                                {/* Type Icon */}
                                                <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${TYPE_COLORS[addr.type] || TYPE_COLORS.OTHER}`}>
                                                    <Icon className="h-4 w-4" />
                                                </div>

                                                {/* Address Details */}
                                                <div className="flex-1 pr-6 pt-0.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                                                            {addr.type}
                                                        </span>
                                                    </div>
                                                    <p className="mt-1 text-[13px] font-bold text-foreground leading-tight">
                                                        {addr.addressLine1}
                                                    </p>
                                                    {addr.addressLine2 && (
                                                        <p className="text-xs text-muted-foreground mt-0.5">{addr.addressLine2}</p>
                                                    )}
                                                    <p className="text-xs text-muted-foreground mt-0.5 max-w-[90%]">
                                                        {[addr.city, addr.state, addr.postalCode].filter(Boolean).join(", ")}
                                                    </p>
                                                    {addr.mobile && (
                                                        <p className="mt-1.5 text-xs text-foreground font-medium flex items-center gap-1">
                                                            <span className="text-muted-foreground">📞</span> {addr.mobile}
                                                        </p>
                                                    )}
                                                </div>
                                            </button>

                                            {/* Edit / Delete Actions */}
                                            <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                                                <button
                                                    onClick={() => handleEdit(addr)}
                                                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                    Edit
                                                </button>
                                                <div className="h-4 w-px bg-border" />
                                                <button
                                                    onClick={() => handleDelete(addr._id)}
                                                    disabled={isDeleting}
                                                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm font-medium text-swiggy-danger transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                                                >
                                                    {isDeleting ? (
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    )}
                                                    Delete
                                                </button>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-accent">
                            <MapPin className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground">No saved addresses</h3>
                        <p className="mt-1 text-sm text-muted-foreground">Add your first delivery address to get started</p>
                    </div>
                )}
            </div>

            {/* Modals */}
            <LocationPickerModal
                isOpen={showMapPicker}
                onClose={() => setShowMapPicker(false)}
                saveAddress={false}
                onConfirm={(address) => {
                    // Format the map response so the manual form can cleanly use it
                    setEditAddress({
                        addressLine1: "", // Leave blank for the user to type House No/Flat No
                        addressLine2: address.addressLine1 || "", // The map's primary string
                        city: address.city || "",
                        state: address.state || "",
                        postalCode: address.postalCode || "",
                        coordinates: address.coordinates,
                    });
                    setShowMapPicker(false);
                    setShowForm(true);
                }}
            />
            <AddressFormModal
                isOpen={showForm}
                onClose={() => { setShowForm(false); setEditAddress(null); }}
                onSuccess={async () => {
                    await queryClient.invalidateQueries({ queryKey: ["user-addresses"] });
                    // If we came from checkout and it's a new address flow, auto-return
                    if (fromCheckout && !editAddress?._id) {
                        navigate("/checkout");
                    }
                }}
                editAddress={editAddress}
            />
        </div>
    );
}
