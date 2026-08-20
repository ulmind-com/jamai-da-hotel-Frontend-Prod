import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { menuApi, adminApi, uploadApi } from "@/api/axios";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Image as ImageIcon, Loader2 } from "lucide-react";

interface AddProductModalProps {
  open: boolean;
  onClose: () => void;
}

const AddProductModal = ({ open, onClose }: AddProductModalProps) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "",
    type: "Veg" as "Veg" | "Non-Veg",
    price: "",
    isAvailable: true,
    hsnCode: "",
    cgst: "",
    sgst: "",
    igst: "",
  });

  const { data: categories, isLoading: catLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: () => menuApi.getCategories().then((r) => r.data),
    enabled: open,
  });

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.category || !form.price) {
      toast.error("Please fill in all required fields");
      return;
    }
    setLoading(true);
    try {
      // Step A: Upload image if selected
      let imageURL = "";
      if (imageFile) {
        const uploadRes = await uploadApi.uploadImage(imageFile);
        imageURL = uploadRes.data.url;
      }

      // Step B: Create product
      const payload = {
        name: form.name,
        description: form.description,
        category: form.category,
        type: form.type,
        variants: [{ name: "Standard", price: Number(form.price) }],
        isAvailable: form.isAvailable,
        imageURL,
        hsnCode: (form as any).hsnCode || "",
        cgst: Number((form as any).cgst || 0),
        sgst: Number((form as any).sgst || 0),
        igst: Number((form as any).igst || 0),
      };
      await adminApi.addMenuItem(payload as any);

      // Step C: Feedback
      toast.success("Product added successfully! 🎉");
      queryClient.invalidateQueries({ queryKey: ["admin-menu"] });
      resetForm();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to add product");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ name: "", description: "", category: "", type: "Veg", price: "", isAvailable: true });
    setImageFile(null);
    setImagePreview(null);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="overflow-hidden border-none bg-transparent p-0 shadow-none sm:max-w-lg">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-card/95 p-8 shadow-2xl backdrop-blur-xl"
        >
          <DialogTitle className="text-xl font-bold text-foreground">Add New Product</DialogTitle>
          <p className="mt-1 text-sm text-muted-foreground">Fill in the details to add a new menu item</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            {/* Image Upload Zone */}
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Product Image</Label>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`mt-1.5 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-colors ${dragOver
                  ? "border-primary bg-primary/5"
                  : imagePreview
                    ? "border-border bg-accent/30"
                    : "border-border hover:border-primary/50 hover:bg-accent/20"
                  }`}
              >
                {imagePreview ? (
                  <div className="relative w-full">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="mx-auto max-h-40 rounded-lg object-cover"
                    />
                    <p className="mt-2 text-center text-xs text-muted-foreground">Click or drag to replace</p>
                  </div>
                ) : (
                  <>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent">
                      <Upload className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="mt-2 text-sm font-medium text-foreground">Drop image here or click to upload</p>
                    <p className="text-xs text-muted-foreground">PNG, JPG up to 5MB</p>
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
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Spicy Paneer Pizza"
                className="mt-1.5"
                required
              />
            </div>

            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Loaded with spicy paneer chunks..."
                className="mt-1.5"
                rows={3}
              />
            </div>

            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category *</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="mt-1.5" disabled={catLoading}>
                  <SelectValue placeholder={catLoading ? "Loading categories..." : "Select category"} />
                </SelectTrigger>
                <SelectContent>
                  {!categories?.length ? (
                    <SelectItem value="__empty" disabled>
                      No categories found. Please create one first.
                    </SelectItem>
                  ) : (
                    categories.map((cat: any) => (
                      <SelectItem key={cat._id} value={cat._id}>
                        {cat.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type *</Label>
              <RadioGroup
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v as "Veg" | "Non-Veg" })}
                className="flex gap-6"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="Veg" id="veg" className="border-swiggy-success text-swiggy-success" />
                  <Label htmlFor="veg" className="flex items-center gap-1.5 text-sm font-medium">
                    <div className="flex h-4 w-4 items-center justify-center rounded-sm border-2 border-swiggy-success">
                      <div className="h-2 w-2 rounded-full bg-swiggy-success" />
                    </div>
                    Veg
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="Non-Veg" id="nonveg" className="border-swiggy-danger text-swiggy-danger" />
                  <Label htmlFor="nonveg" className="flex items-center gap-1.5 text-sm font-medium">
                    <div className="flex h-4 w-4 items-center justify-center rounded-sm border-2 border-swiggy-danger">
                      <div className="h-0 w-0 border-x-[4px] border-b-[7px] border-x-transparent border-b-swiggy-danger" />
                    </div>
                    Non-Veg
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Price (₹) *</Label>
              <Input
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="350"
                className="mt-1.5"
                min={0}
                step="0.01"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">HSN Code</Label>
                <Input
                  value={(form as any).hsnCode}
                  onChange={(e) => setForm({ ...form, hsnCode: e.target.value } as any)}
                  placeholder="996331"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">IGST (%)</Label>
                <Input
                  type="number"
                  value={(form as any).igst}
                  onChange={(e) => setForm({ ...form, igst: e.target.value } as any)}
                  placeholder="0"
                  className="mt-1.5"
                  min={0}
                  step="0.01"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">CGST (%)</Label>
                <Input
                  type="number"
                  value={(form as any).cgst}
                  onChange={(e) => setForm({ ...form, cgst: e.target.value } as any)}
                  placeholder="2.5"
                  className="mt-1.5"
                  min={0}
                  step="0.01"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">SGST (%)</Label>
                <Input
                  type="number"
                  value={(form as any).sgst}
                  onChange={(e) => setForm({ ...form, sgst: e.target.value } as any)}
                  placeholder="2.5"
                  className="mt-1.5"
                  min={0}
                  step="0.01"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <Label className="text-sm font-medium text-foreground">Available</Label>
              <Switch
                checked={form.isAvailable}
                onCheckedChange={(v) => setForm({ ...form, isAvailable: v })}
              />
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.97 }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground shadow-lg transition-all hover:brightness-110 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {imageFile ? "Uploading..." : "Saving..."}
                </>
              ) : (
                "Add Product"
              )}
            </motion.button>
          </form>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

export default AddProductModal;
