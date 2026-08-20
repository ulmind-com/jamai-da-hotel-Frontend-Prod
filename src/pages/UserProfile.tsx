import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userApi, uploadApi } from "@/api/axios";
import { useAuthStore } from "@/store/useAuthStore";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { LogOut, Mail, Phone, Shield, Calendar, Edit2, Save, X, Pencil, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { resolveImageURL } from "@/lib/image-utils";
import { PhoneInputWithFlag } from "@/components/ui/PhoneInputWithFlag";

const UserProfile = () => {
  const { user: authUser, logout, setUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", mobile: "", address: "" });
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: profileData, isLoading } = useQuery({
    queryKey: ["user-profile"],
    queryFn: () => userApi.getProfile().then((r) => r.data),
  });

  const profile = (profileData as any)?.user || profileData;
  const recentOrders = (profileData as any)?.recentOrders || [];

  const profileName = profile?.name || authUser?.name || "";
  const profileMobile = profile?.mobile || authUser?.mobile || "";
  const profileAddress = profile?.address || authUser?.address || "";
  const profileImage = profile?.profileImage || authUser?.profileImage || "";

  const updateMutation = useMutation({
    mutationFn: (data: { name?: string; mobile?: string; address?: string; profileImage?: string }) =>
      userApi.updateProfile(data),
    onSuccess: (res) => {
      const updated = res.data?.user || res.data;
      if (updated) setUser({ ...authUser!, ...updated });
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      toast.success("Profile updated!");
      setEditing(false);
    },
    onError: () => toast.error("Failed to update profile"),
  });

  const handleSave = () => {
    const cleanMobile = form.mobile.replace(/[^0-9]/g, "");
    updateMutation.mutate({ name: form.name, mobile: cleanMobile, address: form.address });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const res = await uploadApi.uploadImage(file);
      const imageUrl = res.data?.url || res.data?.imageURL || res.data?.image;
      if (imageUrl) {
        await userApi.updateProfile({ profileImage: imageUrl });
        setUser({ ...authUser!, profileImage: imageUrl });
        queryClient.invalidateQueries({ queryKey: ["user-profile"] });
        toast.success("Profile image updated!");
      }
    } catch {
      toast.error("Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  const initials = (profile?.name || authUser?.name || "U")
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).getFullYear()
    : new Date().getFullYear();

  const roleBadge = (profile?.role || authUser?.role || "Customer").toString();

  const navigate = useNavigate();

  return (
    <div className="container mx-auto max-w-5xl px-4 py-4 md:py-8 min-h-[calc(100vh-4rem)] overflow-x-hidden">
      {/* Back to Home */}
      <button
        onClick={() => navigate("/")}
        className="mb-4 flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary md:mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Home
      </button>

      <div className="grid gap-4 md:grid-cols-[280px_1fr] md:gap-6">
        {/* Left — Identity Card */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="md:sticky md:top-24 h-fit space-y-4 md:space-y-5"
        >
          <div className="rounded-2xl border border-border bg-card p-4 text-center shadow-sm sm:p-6">
            {/* Avatar with pen icon */}
            <div className="relative mx-auto w-fit">
              {isLoading ? (
                <Skeleton className="h-24 w-24 rounded-full" />
              ) : profileImage ? (
                <img
                  src={resolveImageURL(profileImage)}
                  alt={profileName}
                  className="h-24 w-24 rounded-full object-cover shadow-lg"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-3xl font-black text-primary-foreground shadow-lg">
                  {initials}
                </div>
              )}
              {/* Pen icon overlay */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-md transition-transform hover:scale-110"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
            </div>

            {isLoading ? (
              <div className="mt-4 space-y-2 w-full flex flex-col items-center">
                <Skeleton className="h-5 w-3/4 max-w-[200px]" />
                <Skeleton className="h-4 w-1/2 max-w-[150px]" />
              </div>
            ) : (
              <>
                <h2 className="mt-4 text-lg font-bold text-foreground">{profile?.name || authUser?.name}</h2>
                <p className="text-sm text-muted-foreground break-all">{profile?.email || authUser?.email}</p>
                <span className="mt-2 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
                  <Shield className="mr-1 inline h-3 w-3" />
                  {roleBadge}
                </span>
              </>
            )}

            {uploadingImage && (
              <p className="mt-2 text-xs font-medium text-primary animate-pulse">Uploading…</p>
            )}

            <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              Member since {memberSince}
            </div>
          </div>

          <button
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm font-bold text-destructive transition-colors hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </motion.div>

        {/* Right — Personal Information */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">Personal Information</h3>
              {!editing ? (
                <button
                  onClick={() => {
                    setForm({
                      name: profile?.name || authUser?.name || "",
                      mobile: profile?.mobile || authUser?.mobile || "",
                      address: profile?.address || authUser?.address || "",
                    });
                    setEditing(true);
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/20"
                >
                  <Edit2 className="h-3.5 w-3.5" /> Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
                  >
                    <Save className="h-3.5 w-3.5" /> Save
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-bold text-muted-foreground"
                  >
                    <X className="h-3.5 w-3.5" /> Cancel
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <ProfileField
                icon={<Mail className="h-4 w-4 text-muted-foreground" />}
                label="Email"
                value={profile?.email || authUser?.email || ""}
                readOnly
                className="break-all"
              />
              <ProfileField
                icon={<span className="text-sm font-bold text-muted-foreground">N</span>}
                label="Full Name"
                value={editing ? form.name : profileName}
                editing={editing}
                onChange={(v) => setForm((p) => ({ ...p, name: v }))}
              />
              <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Mobile</p>
                  {editing ? (
                    <PhoneInputWithFlag
                      value={form.mobile}
                      onChange={(v) => setForm((p) => ({ ...p, mobile: v || "" }))}
                      className="mt-1 border-0 bg-transparent px-0 py-0 focus-within:ring-0"
                    />
                  ) : (
                    <p className="truncate text-sm font-medium text-foreground">{profileMobile || "—"}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

/* ─── Reusable Field ─── */
const ProfileField = ({
  icon,
  label,
  value,
  editing,
  readOnly,
  onChange,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  editing?: boolean;
  readOnly?: boolean;
  onChange?: (v: string) => void;
  className?: string;
}) => (
  <div className="flex items-start gap-3 rounded-xl bg-muted/50 p-3">
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background">{icon}</div>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      {editing && !readOnly ? (
        <input
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full border-b border-primary bg-transparent text-sm font-medium text-foreground outline-none"
        />
      ) : (
        <p className={`text-sm font-medium text-foreground ${className || "truncate"}`}>{value || "—"}</p>
      )}
    </div>
    {readOnly && (
      <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Read-only</span>
    )}
  </div>
);

export default UserProfile;
