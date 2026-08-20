import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userApi } from "@/api/axios";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Plus, Trash2, Home, Briefcase, Loader2, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { useLocationStore } from "@/store/useLocationStore";

interface AddressManagerProps {
  selectedAddressId: string | null;
  onSelect: (id: string, fullAddress: string, addressObj?: any) => void;
}

const TYPE_ICON: Record<string, any> = {
  HOME: Home,
  WORK: Briefcase,
  OTHER: MapPin,
};

const TYPE_COLOR: Record<string, string> = {
  HOME: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  WORK: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  OTHER: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
};

/** Builds a human-readable full address string from any address shape */
function formatFull(addr: any): string {
  // Support both old schema (houseNo/street/zip) and new (addressLine1/addressLine2/postalCode)
  const line1 = addr.addressLine1 || [addr.houseNo, addr.street].filter(Boolean).join(", ");
  const line2 = addr.addressLine2 || "";
  const city = addr.city || "";
  const state = addr.state || "";
  const pin = addr.postalCode || addr.zip || "";
  return [line1, line2, city, state, pin].filter(Boolean).join(", ");
}

function getLabel(addr: any): string {
  // New schema uses type (HOME/WORK/OTHER), old uses label (Home/Work/Other)
  if (addr.type) return addr.type;
  if (addr.label) return addr.label.toUpperCase();
  return "OTHER";
}

const AddressManager = ({ selectedAddressId, onSelect }: AddressManagerProps) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { setSelectedAddress } = useLocationStore();

  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ["user-addresses"],
    queryFn: () => userApi.getAddresses().then((r) => r.data?.addresses || r.data || []),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => userApi.deleteAddress(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-addresses"] });
      toast.success("Address removed");
    },
    onError: () => toast.error("Failed to remove address"),
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-foreground">Delivery Address</h3>
        <button
          onClick={() => navigate("/addresses?from=checkout")}
          className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/20"
        >
          <Plus className="h-3.5 w-3.5" />
          Add New
        </button>
      </div>

      {/* Address List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : addresses.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-accent">
            <MapPin className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="font-semibold text-foreground">No saved addresses</p>
          <p className="mt-1 text-sm text-muted-foreground">Add a delivery address to continue</p>
          <button
            onClick={() => navigate("/addresses?from=checkout")}
            className="mt-4 flex items-center gap-1.5 mx-auto rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            Add Address
          </button>
        </div>
      ) : (
        <AnimatePresence>
          {addresses.map((addr: any) => {
            const typeKey = getLabel(addr);
            const Icon = TYPE_ICON[typeKey] || MapPin;
            const addrId = addr._id || addr.id;
            const isSelected = selectedAddressId === addrId;
            const fullAddress = formatFull(addr);

            return (
              <motion.div
                key={addr._id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                onClick={() => {
                  console.log("AddressManager Selected:", addr._id || addr.id);
                  // Update the persisted store so Addresses page stays in sync
                  setSelectedAddress(addr);
                  // PER USER REQUEST: Persist selection to backend so it survives logout
                  userApi.selectAddress({ addressId: addr._id || addr.id });
                  onSelect(addr._id || addr.id, fullAddress, addr);
                }}
                className={`relative cursor-pointer rounded-2xl border-2 p-4 transition-all ${isSelected
                  ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                  : "border-border bg-card hover:border-primary/40 hover:shadow-sm"
                  }`}
              >
                <div className="flex items-start gap-3">
                  {/* Radio indicator */}
                  <div className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"
                    }`}>
                    {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                  </div>

                  {/* Type icon */}
                  <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${TYPE_COLOR[typeKey] || TYPE_COLOR.OTHER}`}>
                    <Icon className="h-5 w-5" />
                  </div>

                  {/* Address details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-black uppercase tracking-wider text-primary">
                        {typeKey === "HOME" ? "Home" : typeKey === "WORK" ? "Work" : "Other"}
                      </span>
                      {isSelected && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                          Selected
                        </span>
                      )}
                    </div>

                    {/* Line 1 */}
                    {(addr.addressLine1 || addr.houseNo) && (
                      <p className="font-semibold text-foreground leading-snug">
                        {addr.addressLine1 || [addr.houseNo, addr.street].filter(Boolean).join(", ")}
                      </p>
                    )}

                    {/* Line 2 */}
                    {(addr.addressLine2 || addr.street) && addr.addressLine1 && (
                      <p className="text-sm text-muted-foreground">
                        {addr.addressLine2}
                      </p>
                    )}

                    {/* City, State, PIN */}
                    <p className="text-sm text-muted-foreground">
                      {[addr.city, addr.state, addr.postalCode || addr.zip].filter(Boolean).join(", ")}
                    </p>

                    {/* Mobile */}
                    {addr.mobile && (
                      <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <span>📞</span>
                        <span>{addr.mobile}</span>
                      </p>
                    )}
                  </div>

                  {/* Delete */}
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(addr._id); }}
                    disabled={deleteMutation.isPending}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    {deleteMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      )}
    </div>
  );
};

export default AddressManager;
