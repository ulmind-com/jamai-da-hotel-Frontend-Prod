import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { restaurantApi, uploadApi } from "@/api/axios";
import { useRestaurantStore } from "@/store/useRestaurantStore";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Loader2, Store, MapPin, Navigation, Save, Radio,
  CheckCircle2, XCircle, Map, RefreshCw, Crosshair,
} from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default marker icons in bundlers
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

/* ─── Inline Map Picker ─────────────────────────────────────────────────── */
interface MapPickerProps {
  initialLat?: number;
  initialLng?: number;
  onLocationSaved: (lat: number, lng: number, address: string) => void;
}

const MapPicker = ({ initialLat, initialLng, onLocationSaved }: MapPickerProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [pickedLat, setPickedLat] = useState<number | null>(initialLat ?? null);
  const [pickedLng, setPickedLng] = useState<number | null>(initialLng ?? null);
  const [resolvedAddress, setResolvedAddress] = useState<string>("");
  const [geocoding, setGeocoding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  const reverseGeocode = async (lat: number, lng: number) => {
    setGeocoding(true);
    setPickedLat(lat);
    setPickedLng(lng);
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
      );
      const data = await r.json();
      const addr = data.address || {};
      const parts = [
        addr.road,
        addr.suburb || addr.neighbourhood,
        addr.city || addr.town || addr.village,
        addr.state,
      ].filter(Boolean);
      setResolvedAddress(parts.join(", ") || data.display_name?.split(",").slice(0, 3).join(", ") || "");
    } catch {
      setResolvedAddress("");
    } finally {
      setGeocoding(false);
    }
  };

  useEffect(() => {
    if (!mapRef.current) return;
    if (leafletMapRef.current) return; // already initialized

    const defaultLat = initialLat ?? 22.5726;
    const defaultLng = initialLng ?? 88.3639;

    const map = L.map(mapRef.current, {
      center: [defaultLat, defaultLng],
      zoom: 15,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const marker = L.marker([defaultLat, defaultLng], { draggable: true }).addTo(map);

    marker.on("dragend", () => {
      const { lat, lng } = marker.getLatLng();
      reverseGeocode(lat, lng);
    });

    map.on("click", (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      reverseGeocode(lat, lng);
    });

    leafletMapRef.current = map;
    markerRef.current = marker;

    if (initialLat && initialLng) {
      reverseGeocode(initialLat, initialLng);
    }

    setTimeout(() => map.invalidateSize(), 200);

    return () => {
      map.remove();
      leafletMapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  const handleGeolocate = () => {
    if (!leafletMapRef.current || !markerRef.current) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        leafletMapRef.current!.setView([latitude, longitude], 16);
        markerRef.current!.setLatLng([latitude, longitude]);
        reverseGeocode(latitude, longitude);
        setLocating(false);
      },
      () => {
        toast.error("Could not get your location");
        setLocating(false);
      },
      { timeout: 8000 }
    );
  };

  const handleSave = async () => {
    if (pickedLat === null || pickedLng === null) return;
    setSaving(true);
    try {
      await restaurantApi.setLocation({ lat: pickedLat, lng: pickedLng, address: resolvedAddress });
      onLocationSaved(pickedLat, pickedLng, resolvedAddress);
      toast.success("📍 Restaurant location saved!");
    } catch {
      toast.error("Failed to save location");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Map */}
      <div className="relative overflow-hidden rounded-2xl border border-border shadow-inner" style={{ height: 320 }}>
        <div ref={mapRef} className="h-full w-full" />

        {/* Geolocate button overlay */}
        <button
          onClick={handleGeolocate}
          disabled={locating}
          className="absolute bottom-3 right-3 z-[1000] flex items-center gap-1.5 rounded-xl bg-card px-3 py-2 text-xs font-bold text-foreground shadow-lg border border-border transition-colors hover:bg-accent"
        >
          {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crosshair className="h-3.5 w-3.5 text-primary" />}
          My Location
        </button>
      </div>

      {/* Resolved address preview */}
      <div className="flex items-start gap-3 rounded-xl bg-muted/50 px-4 py-3">
        <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
        <div className="flex-1 min-w-0">
          {geocoding ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="text-sm">Resolving address…</span>
            </div>
          ) : resolvedAddress ? (
            <p className="text-sm font-medium text-foreground leading-snug">{resolvedAddress}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Click or drag the pin to pick a location</p>
          )}
          {pickedLat !== null && pickedLng !== null && (
            <p className="mt-0.5 text-[10px] font-mono text-muted-foreground">
              {pickedLat.toFixed(6)}, {pickedLng.toFixed(6)}
            </p>
          )}
        </div>
      </div>

      {/* Save button */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleSave}
        disabled={pickedLat === null || saving || geocoding}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md transition-all hover:brightness-110 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        {saving ? "Saving Location…" : "Save GPS Location"}
      </motion.button>
    </div>
  );
};

/* ─── Main Component ────────────────────────────────────────────────────── */
const RestaurantSettings = () => {
  const queryClient = useQueryClient();
  const setRestaurant = useRestaurantStore((s) => s.setRestaurant);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: restaurant, isLoading } = useQuery({
    queryKey: ["restaurant"],
    queryFn: () => restaurantApi.get().then((r) => r.data),
  });

  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [form, setForm] = useState({
    name: "", address: "", deliveryRadius: "", freeDeliveryRadius: "", chargePerKm: "", gstIn: "", fssaiLicense: "", mobile: "",
    openingTime: "10:00", closingTime: "22:00", isCodEnabled: true, codStartTime: "00:00", codEndTime: "00:00"
  });
  const [dialCode, setDialCode] = useState("+91");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (restaurant) {
      const storedMobile = restaurant.mobile || "";
      // Parse dial code from stored mobile (e.g. "+91 98765..." → dialCode="+91")
      const match = storedMobile.match(/^(\+\d{1,4})\s*/);
      if (match) setDialCode(match[1]);
      setForm({
        name: restaurant.name || "",
        address: restaurant.address || "",
        deliveryRadius: String(restaurant.deliveryRadius || ""),
        freeDeliveryRadius: String(restaurant.freeDeliveryRadius ?? 2),
        chargePerKm: String(restaurant.chargePerKm ?? 10),
        gstIn: restaurant.gstIn || "",
        fssaiLicense: restaurant.fssaiLicense || "",
        mobile: storedMobile,
        openingTime: restaurant.openingTime || "10:00",
        closingTime: restaurant.closingTime || "22:00",
        isCodEnabled: restaurant.isCodEnabled ?? true,
        codStartTime: restaurant.codStartTime || "00:00",
        codEndTime: restaurant.codEndTime || "00:00"
      });
      if (restaurant.logo) setLogoPreview(restaurant.logo);
    }
  }, [restaurant]);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleToggle = async (isOpen: boolean) => {
    setToggling(true);
    try {
      const res = await restaurantApi.update({ isOpen });
      setRestaurant(res.data);
      queryClient.invalidateQueries({ queryKey: ["restaurant"] });
      toast.success(isOpen ? "Restaurant is now OPEN 🟢" : "Restaurant is now CLOSED 🔴");
    } catch {
      toast.error("Failed to update status");
    } finally {
      setToggling(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let logoURL = restaurant?.logo;
      if (logoFile) {
        const uploadRes = await uploadApi.uploadImage(logoFile);
        logoURL = uploadRes.data.url;
      }

      const res = await restaurantApi.update({
        name: form.name,
        address: form.address,
        deliveryRadius: Number(form.deliveryRadius) || undefined,
        freeDeliveryRadius: Number(form.freeDeliveryRadius),
        chargePerKm: Number(form.chargePerKm),
        gstIn: form.gstIn,
        fssaiLicense: form.fssaiLicense,
        mobile: form.mobile || undefined,
        logo: logoURL,
        openingTime: form.openingTime,
        closingTime: form.closingTime,
        isCodEnabled: form.isCodEnabled,
        codStartTime: form.codStartTime,
        codEndTime: form.codEndTime
      });
      setRestaurant(res.data);
      queryClient.invalidateQueries({ queryKey: ["restaurant"] });
      toast.success("Settings saved ✅");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleLocationSaved = (lat: number, lng: number, address: string) => {
    if (address) setForm((f) => ({ ...f, address }));
    queryClient.invalidateQueries({ queryKey: ["restaurant"] });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    );
  }

  const isOpen = restaurant?.isOpen ?? false;
  const hasLocation = restaurant?.location?.lat && restaurant?.location?.lng;

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Page header */}
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground">Restaurant Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">Manage your restaurant's status, details, and location</p>
      </div>

      {/* ── Status Toggle Card ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative overflow-hidden rounded-2xl border p-6 shadow-sm transition-colors ${isOpen
          ? "border-green-500/30 bg-green-500/5"
          : "border-destructive/20 bg-destructive/5"
          }`}
      >
        {/* Subtle glow */}
        <div className={`pointer-events-none absolute inset-0 rounded-2xl opacity-20 ${isOpen ? "bg-gradient-to-br from-green-400/30 to-transparent" : "bg-gradient-to-br from-red-400/20 to-transparent"
          }`} />

        <div className="relative flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl shadow-inner ${isOpen ? "bg-green-500/15" : "bg-destructive/10"
              }`}>
              <Store className={`h-7 w-7 ${isOpen ? "text-green-600" : "text-destructive"}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                {isOpen
                  ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                  : <XCircle className="h-4 w-4 text-destructive" />
                }
                <p className={`text-lg font-extrabold ${isOpen ? "text-green-700 dark:text-green-400" : "text-destructive"}`}>
                  {isOpen ? "Restaurant is LIVE" : "Restaurant is OFFLINE"}
                </p>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {isOpen ? "Customers can place orders right now" : "Customers cannot place orders"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {toggling && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Switch
              checked={isOpen}
              onCheckedChange={handleToggle}
              disabled={toggling}
              className="h-7 w-12 data-[state=checked]:bg-green-500"
            />
          </div>
        </div>
      </motion.div>

      {/* ── Details + GPS side by side ──────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">

        {/* Left — Details Form */}
        <motion.form
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          onSubmit={handleSave}
          className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5"
        >
          <div className="flex items-center gap-2 mb-1">
            <Store className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Restaurant Details</h3>
          </div>

          <div className="space-y-4">
            {/* Logo Upload */}
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Restaurant Logo</Label>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`mt-1.5 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-colors ${dragOver
                  ? "border-primary bg-primary/5"
                  : logoPreview
                    ? "border-border bg-accent/30"
                    : "border-border hover:border-primary/50 hover:bg-accent/20"
                  }`}
              >
                {logoPreview ? (
                  <div className="relative w-full">
                    <img
                      src={logoPreview}
                      alt="Logo Preview"
                      className="mx-auto h-24 w-24 rounded-full object-cover border border-border shadow-sm"
                    />
                    <p className="mt-2 text-center text-xs text-muted-foreground">Click or drag to replace</p>
                  </div>
                ) : (
                  <>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent">
                      <Store className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="mt-2 text-sm font-medium text-foreground">Drop logo here or click</p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Restaurant Name
              </Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="My Amazing Restaurant"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Address
              </Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="123 Food Street, City"
                className="mt-1.5"
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border p-4 bg-muted/30">
              <div>
                <Label className="text-sm font-bold uppercase tracking-wider text-foreground">
                  Enable Cash on Delivery
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">Allow users to place orders using COD globally.</p>
              </div>
              <Switch
                checked={form.isCodEnabled}
                onCheckedChange={(checked) => setForm({ ...form, isCodEnabled: checked })}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Opening Time
                </Label>
                <Input
                  type="time"
                  value={form.openingTime}
                  onChange={(e) => setForm({ ...form, openingTime: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Closing Time
                </Label>
                <Input
                  type="time"
                  value={form.closingTime}
                  onChange={(e) => setForm({ ...form, closingTime: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  COD Offline From
                </Label>
                <Input
                  type="time"
                  value={form.codStartTime}
                  onChange={(e) => setForm({ ...form, codStartTime: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  COD Offline To
                </Label>
                <Input
                  type="time"
                  value={form.codEndTime}
                  onChange={(e) => setForm({ ...form, codEndTime: e.target.value })}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Free Radius (km)
                </Label>
                <Input
                  type="number"
                  value={form.freeDeliveryRadius}
                  onChange={(e) => setForm({ ...form, freeDeliveryRadius: e.target.value })}
                  placeholder="2"
                  className="mt-1.5"
                  min={0}
                />
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Charge / Extra Km (₹)
                </Label>
                <Input
                  type="number"
                  value={form.chargePerKm}
                  onChange={(e) => setForm({ ...form, chargePerKm: e.target.value })}
                  placeholder="10"
                  className="mt-1.5"
                  min={0}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Mobile Number
              </Label>
              <div className="mt-1.5 flex overflow-hidden rounded-lg border border-input bg-background ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                {/* Country code selector */}
                <select
                  value={dialCode}
                  onChange={(e) => {
                    setDialCode(e.target.value);
                    // Update combined mobile value
                    const num = form.mobile.replace(/^\+\d+\s*/, "");
                    setForm({ ...form, mobile: e.target.value + " " + num });
                  }}
                  className="flex-shrink-0 border-r border-input bg-muted px-2 py-2 text-sm font-medium text-foreground outline-none cursor-pointer hover:bg-accent transition-colors"
                >
                  <option value="+91">🇮🇳 +91</option>
                  <option value="+1">🇺🇸 +1</option>
                  <option value="+44">🇬🇧 +44</option>
                  <option value="+971">🇦🇪 +971</option>
                  <option value="+61">🇦🇺 +61</option>
                  <option value="+65">🇸🇬 +65</option>
                  <option value="+60">🇲🇾 +60</option>
                  <option value="+880">🇧🇩 +880</option>
                  <option value="+92">🇵🇰 +92</option>
                  <option value="+94">🇱🇰 +94</option>
                  <option value="+977">🇳🇵 +977</option>
                  <option value="+49">🇩🇪 +49</option>
                  <option value="+33">🇫🇷 +33</option>
                  <option value="+81">🇯🇵 +81</option>
                  <option value="+86">🇨🇳 +86</option>
                </select>
                {/* Number input */}
                <input
                  type="tel"
                  value={form.mobile.replace(/^[+\d]+\s*/, "")}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^\d\s\-]/g, "");
                    setForm({ ...form, mobile: dialCode + " " + digits });
                  }}
                  placeholder="98765 43210"
                  className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  GSTIN
                </Label>
                <Input
                  value={form.gstIn}
                  onChange={(e) => setForm({ ...form, gstIn: e.target.value })}
                  placeholder="29ABCDE1234F1Z5"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  FSSAI License
                </Label>
                <Input
                  value={form.fssaiLicense}
                  onChange={(e) => setForm({ ...form, fssaiLicense: e.target.value })}
                  placeholder="10012345678901"
                  className="mt-1.5"
                />
              </div>
            </div>
          </div>

          <motion.button
            type="submit"
            disabled={saving}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-lg transition-all hover:brightness-110 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? (logoFile ? "Uploading..." : "Saving…") : "Save Changes"}
          </motion.button>
        </motion.form>

        {/* Right — GPS Location Picker */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden"
        >
          {/* Header — clickable to expand/collapse */}
          <button
            type="button"
            onClick={() => setShowMap((v) => !v)}
            className="flex w-full items-center justify-between px-6 py-5 hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${hasLocation ? "bg-primary/10" : "bg-muted"}`}>
                <Map className={`h-5 w-5 ${hasLocation ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-foreground">GPS Location</p>
                {hasLocation ? (
                  <p className="text-xs text-muted-foreground font-mono">
                    {restaurant.location.lat.toFixed(5)}, {restaurant.location.lng.toFixed(5)}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">No location set — click to pick on map</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasLocation && (
                <span className="rounded-full bg-green-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-green-600">
                  Set
                </span>
              )}
              <motion.div animate={{ rotate: showMap ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <Navigation className="h-4 w-4 text-muted-foreground rotate-90" />
              </motion.div>
            </div>
          </button>

          {/* Collapsible map section */}
          <AnimatePresence>
            {showMap && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="border-t border-border px-6 pb-6 pt-5">
                  <p className="mb-4 text-xs text-muted-foreground">
                    Click anywhere on the map or drag the pin to set your restaurant's GPS location.
                    This is used for delivery radius calculations.
                  </p>
                  <MapPicker
                    initialLat={restaurant?.location?.lat}
                    initialLng={restaurant?.location?.lng}
                    onLocationSaved={handleLocationSaved}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

      </div>{/* end grid */}

    </div>
  );
};

export default RestaurantSettings;
