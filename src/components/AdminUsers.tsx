import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { userApi } from "@/api/axios";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import LoadMore from "@/components/LoadMore";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Trash2, Users, AlertTriangle, Phone, Mail, MapPin, Eye, X, UserPlus, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { resolveImageURL } from "@/lib/image-utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const AdminUsers = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [viewUser, setViewUser] = useState<any>(null);
  const [addOpen, setAddOpen] = useState(false);

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const {
    items: users,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteList<any>(["admin-users", debouncedSearch], (p) =>
    userApi.getAll({ ...p, search: debouncedSearch || undefined })
  );

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { role?: string; isActive?: boolean; isCodDisabled?: boolean } }) =>
      userApi.updateUser(id, data),
    onError: () => toast.error("Failed to update user"),
    // Refetch the (infinite) list after the change — safe with paginated cache
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => userApi.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("User deleted");
      setDeleteTarget(null);
    },
    onError: () => toast.error("Failed to delete user"),
  });

  // Search is applied server-side (debouncedSearch is part of the query key)
  const filtered = Array.isArray(users) ? users : [];

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">User Management</h2>
          <p className="text-sm text-muted-foreground">Manage roles, status, and access for all users</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:w-72"
            />
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow transition hover:brightness-110"
          >
            <UserPlus className="h-4 w-4" /> Add Staff
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-5 py-3.5 font-bold text-muted-foreground">User</th>
                <th className="px-5 py-3.5 font-bold text-muted-foreground">Role</th>
                <th className="px-5 py-3.5 font-bold text-muted-foreground">Status</th>
                <th className="px-5 py-3.5 font-bold text-muted-foreground">Mobile</th>
                <th className="px-5 py-3.5 font-bold text-muted-foreground">Joined</th>
                <th className="px-5 py-3.5 font-bold text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td className="px-5 py-4"><Skeleton className="h-10 w-48" /></td>
                    <td className="px-5 py-4"><Skeleton className="h-8 w-28" /></td>
                    <td className="px-5 py-4"><Skeleton className="h-6 w-12" /></td>
                    <td className="px-5 py-4"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-5 py-4"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-5 py-4"><Skeleton className="h-8 w-16" /></td>
                  </tr>
                ))
                : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center">
                      <Users className="mx-auto h-10 w-10 text-muted-foreground/30" />
                      <p className="mt-2 text-sm font-semibold text-muted-foreground">No users found</p>
                    </td>
                  </tr>
                ) : (
                  <AnimatePresence>
                    {filtered.map((user: any) => {
                      const initials = (user.name || "U")
                        .split(" ")
                        .map((w: string) => w[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2);

                      return (
                        <motion.tr
                          key={user._id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0, height: 0 }}
                          className="border-b border-border transition-colors hover:bg-muted/30"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              {user.profileImage ? (
                                <img
                                  src={resolveImageURL(user.profileImage)}
                                  alt={user.name}
                                  className="h-10 w-10 shrink-0 rounded-full object-cover"
                                />
                              ) : (
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-primary/40 text-sm font-bold text-primary-foreground">
                                  {initials}
                                </div>
                              )}
                              <div>
                                <p className="font-semibold text-foreground">{user.name}</p>
                                <p className="text-xs text-muted-foreground">{user.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <Select
                              value={user.role}
                              onValueChange={(val) =>
                                updateMutation.mutate({ id: user._id, data: { role: val } })
                              }
                            >
                              <SelectTrigger className="h-8 w-32 text-xs font-semibold">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Customer">Customer</SelectItem>
                                <SelectItem value="Waiter">Waiter</SelectItem>
                                <SelectItem value="Manager">Manager</SelectItem>
                                <SelectItem value="Admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex flex-col gap-3">
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={user.isActive !== false}
                                  onCheckedChange={(checked) =>
                                    updateMutation.mutate({ id: user._id, data: { isActive: checked } })
                                  }
                                />
                                <span className={`text-xs font-bold ${user.isActive !== false ? "text-swiggy-success" : "text-destructive"}`}>
                                  {user.isActive !== false ? "Active" : "Inactive"}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={!user.isCodDisabled}
                                  onCheckedChange={(checked) =>
                                    updateMutation.mutate({ id: user._id, data: { isCodDisabled: !checked } })
                                  }
                                />
                                <span className={`text-xs font-bold ${!user.isCodDisabled ? "text-foreground" : "text-destructive"}`}>
                                  COD Access {user.isCodDisabled ? "(Banned)" : ""}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-xs text-muted-foreground">
                            {user.mobile || "—"}
                          </td>
                          <td className="px-5 py-4 text-xs text-muted-foreground">
                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setViewUser(user)}
                                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                                title="View details"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setDeleteTarget({ id: user._id, name: user.name })}
                                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                )}
            </tbody>
          </table>
        </div>
        <LoadMore hasMore={!!hasNextPage} isFetching={isFetchingNextPage} onLoad={fetchNextPage} />
      </div>

      {/* User Detail Modal */}
      <Dialog open={!!viewUser} onOpenChange={() => setViewUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
          </DialogHeader>
          {viewUser && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {viewUser.profileImage ? (
                  <img
                    src={resolveImageURL(viewUser.profileImage)}
                    alt={viewUser.name}
                    className="h-16 w-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-primary/40 text-xl font-bold text-primary-foreground">
                    {(viewUser.name || "U").split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)}
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-bold text-foreground">{viewUser.name}</h3>
                  <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                    {viewUser.role}
                  </span>
                </div>
              </div>

              <div className="space-y-3 rounded-xl bg-muted/50 p-4">
                <DetailRow icon={<Mail className="h-4 w-4" />} label="Email" value={viewUser.email} />
                <DetailRow icon={<Phone className="h-4 w-4" />} label="Mobile" value={viewUser.mobile || "—"} />
                <DetailRow
                  label="Status"
                  value={viewUser.isActive !== false ? "Active" : "Inactive"}
                  valueClass={viewUser.isActive !== false ? "text-swiggy-success" : "text-destructive"}
                />
                <DetailRow label="User ID" value={viewUser._id} mono />
                <DetailRow label="Created" value={viewUser.createdAt ? new Date(viewUser.createdAt).toLocaleString() : "—"} />
                <DetailRow label="Updated" value={viewUser.updatedAt ? new Date(viewUser.updatedAt).toLocaleString() : "—"} />
                {viewUser.savedAddresses?.length > 0 && (
                  <DetailRow
                    icon={<MapPin className="h-4 w-4" />}
                    label="Addresses"
                    value={`${viewUser.savedAddresses.length} saved`}
                  />
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete User
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {addOpen && (
        <AddStaffModal
          onClose={() => setAddOpen(false)}
          onSaved={() => { setAddOpen(false); queryClient.invalidateQueries({ queryKey: ["admin-users"] }); }}
        />
      )}
    </div>
  );
};

/* ─── Detail Row ─── */
const DetailRow = ({
  icon,
  label,
  value,
  mono,
  valueClass,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  valueClass?: string;
}) => (
  <div className="flex items-start justify-between gap-2">
    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
      {icon}
      {label}
    </div>
    <p className={`text-right text-xs font-medium text-foreground ${mono ? "font-mono text-[10px]" : ""} ${valueClass || ""}`}>
      {value}
    </p>
  </div>
);

const AddStaffModal = ({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) => {
  const [form, setForm] = useState({ name: "", email: "", mobile: "", password: "", role: "Manager" });
  const [saving, setSaving] = useState(false);
  const inputClass = "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await userApi.createUser(form);
      toast.success(`${form.role} account created`);
      onSaved();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Could not create user");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Add Staff Member</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="mt-2 space-y-3">
          <input required placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
          <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} />
          <input required placeholder="Mobile" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} className={inputClass} />
          <input required type="password" minLength={6} placeholder="Password (min 6)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputClass} />
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inputClass}>
              <option value="Waiter">Waiter (KOT only — take orders, generate KOT)</option>
              <option value="Manager">Manager (full access, some admin-only actions restricted)</option>
              <option value="Admin">Admin (full control)</option>
            </select>
          </div>
          <button type="submit" disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground shadow hover:brightness-110 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Create account
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AdminUsers;
