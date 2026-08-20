import { useState, useEffect } from "react";
import { userApi } from "@/api/axios";
import { useAuthStore } from "@/store/useAuthStore";
import { X, Home, Briefcase, MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const ADDRESS_TYPES = [
    { value: "HOME", label: "Home", icon: Home },
    { value: "WORK", label: "Work", icon: Briefcase },
    { value: "OTHER", label: "Other", icon: MapPin },
] as const;

interface AddressFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    editAddress?: any; // If provided, we're editing
}

export function AddressFormModal({ isOpen, onClose, onSuccess, editAddress }: AddressFormModalProps) {
    const { user } = useAuthStore();
    const [form, setForm] = useState({
        type: "HOME" as "HOME" | "WORK" | "OTHER",
        addressLine1: "",
        addressLine2: "",
        city: "",
        state: "",
        postalCode: "",
        mobile: "",
        coordinates: null as any,
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (editAddress) {
            setForm({
                type: editAddress.type || "HOME",
                addressLine1: editAddress.addressLine1 || "",
                addressLine2: editAddress.addressLine2 || "",
                city: editAddress.city || "",
                state: editAddress.state || "",
                postalCode: editAddress.postalCode || "",
                mobile: editAddress.mobile || user?.mobile || "",
                coordinates: editAddress.coordinates || null,
            });
        } else {
            setForm({ type: "HOME", addressLine1: "", addressLine2: "", city: "", state: "", postalCode: "", mobile: user?.mobile || "", coordinates: null });
        }
        if (isOpen) {
            // Also try to actively fetch profile if local store is missing mobile
            if (!editAddress?.mobile && !user?.mobile) {
                userApi.getProfile().then(res => {
                    const profileMobile = res.data?.user?.mobile || res.data?.mobile;
                    if (profileMobile) {
                        setForm(f => ({ ...f, mobile: profileMobile }));
                    }
                }).catch(() => { });
            }
        }
    }, [editAddress, isOpen, user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.addressLine1 || !form.city || !form.state) {
            toast.error("Please fill in required fields");
            return;
        }
        setSaving(true);
        try {
            if (editAddress?._id) {
                await userApi.updateAddress(editAddress._id, form);
                toast.success("Address updated!");
            } else {
                await userApi.addAddress(form);
                toast.success("Address added!");
            }
            onSuccess();
            onClose();
        } catch {
            toast.error("Failed to save address");
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.5 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] bg-black"
                        onClick={onClose}
                    />
                    <div className="fixed inset-0 z-[201] flex items-end justify-center sm:items-center p-0 sm:p-4 pointer-events-none">
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 30, stiffness: 300 }}
                            className="pointer-events-auto w-full sm:max-w-[500px] rounded-t-3xl bg-background shadow-2xl sm:rounded-2xl flex flex-col relative"
                            style={{ maxHeight: "90vh" }}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between border-b border-border px-6 py-4">
                                <h2 className="text-lg font-bold text-foreground">
                                    {editAddress ? "Edit Address" : "Add New Address"}
                                </h2>
                                <button
                                    onClick={onClose}
                                    className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent"
                                >
                                    <X className="h-5 w-5 text-muted-foreground" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="overflow-y-auto px-6 pb-8 pt-5" style={{ maxHeight: "80vh" }}>
                                {/* Address Type */}
                                <div className="mb-5">
                                    <label className="mb-2 block text-sm font-semibold text-foreground">Save as</label>
                                    <div className="flex gap-3">
                                        {ADDRESS_TYPES.map(({ value, label, icon: Icon }) => (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() => setForm((f) => ({ ...f, type: value }))}
                                                className={`flex flex-1 flex-col items-center gap-1.5 rounded-xl border-2 py-3 transition-all ${form.type === value
                                                    ? "border-primary bg-primary/5 text-primary"
                                                    : "border-border text-muted-foreground hover:border-primary/40"
                                                    }`}
                                            >
                                                <Icon className="h-5 w-5" />
                                                <span className="text-xs font-semibold">{label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Fields Area - Compact Grid on Desktop */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-4 gap-y-0">
                                    {[
                                        { key: "addressLine1", label: "House / Flat / Block No. *", placeholder: "House no, Flat, Block", fullWidth: true },
                                        { key: "addressLine2", label: "Apartment / Road / Area", placeholder: "Area, Colony, Street", fullWidth: true },
                                        { key: "city", label: "City *", placeholder: "City" },
                                        { key: "state", label: "State *", placeholder: "State" },
                                        { key: "postalCode", label: "Postal Code", placeholder: "PIN Code" },
                                        { key: "mobile", label: "Mobile Number", placeholder: "10-digit mobile" },
                                    ].map(({ key, label, placeholder, fullWidth }: any) => (
                                        <div key={key} className={`mb-4 ${fullWidth ? 'sm:col-span-2' : ''}`}>
                                            <label className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>
                                            <input
                                                type={key === "mobile" ? "tel" : "text"}
                                                placeholder={placeholder}
                                                value={(form as any)[key]}
                                                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                                                className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                            />
                                        </div>
                                    ))}
                                </div>

                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 text-base font-bold text-primary-foreground shadow-lg transition-transform active:scale-95 disabled:opacity-60"
                                >
                                    {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                                    {editAddress ? "Update Address" : "Save Address"}
                                </button>
                            </form>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
