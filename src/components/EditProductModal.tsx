import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useState, useRef, useEffect } from "react";
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
import { Upload, Loader2 } from "lucide-react";
import { resolveImageURL } from "@/lib/image-utils";

interface EditProductModalProps {
  open: boolean;
  onClose: () => void;
  item: any | null;
}

const EditProductModal = ({ open, onClose, item }: EditProductModalProps) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
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

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => menuApi.getCategories().then((r) => r.data),
    enabled: open,
  });

  // Pre-fill form when item changes
  useEffect(() => {
    if (item) {
      setForm({
        name: item.name || "",
        description: item.description || "",
        category: typeof item.category === "object" ? item.category?._id : item.category || "",
        type: item.type || "Veg",
        price: String(item.price || item.variants?.[0]?.price || ""),
        isAvailable: item.isAvailable ?? true,
        hsnCode: item.hsnCode || "",
        cgst: String(item.cgst || ""),
        sgst: String(item.sgst || ""),
        igst: String(item.igst || ""),
      });
      setImagePreview(resolveImageURL(item.image || item.imageURL));
      setImageFile(null);
    }
  }, [item]);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    setLoading(true);
    try {
      let imageURL = item.image || item.imageURL || "";
      if (imageFile) {
        const uploadRes = await uploadApi.uploadImage(imageFile);
        imageURL = uploadRes.data.url;
      }
      await adminApi.updateMenuItem(item._id, {
        name: form.name,
        description: form.description,
        category: form.category,
        type: form.type,
        variants: [{ name: "Standard", price: Number(form.price) }],
        isAvailable: form.isAvailable,
        imageURL,
        hsnCode: (form as any).hsnCode,
        cgst: Number((form as any).cgst || 0),
        sgst: Number((form as any).sgst || 0),
        igst: Number((form as any).igst || 0),
      });
      toast.success("Product updated! ✅");
      queryClient.invalidateQueries({ queryKey: ["admin-menu"] });
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="overflow-hidden border-none bg-transparent p-0 shadow-none sm:max-w-lg">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-card/95 p-8 shadow-2xl backdrop-blur-xl"
        >
          <DialogTitle className="text-xl font-bold text-foreground">Edit Product</DialogTitle>
          <p className="mt-1 text-sm text-muted-foreground">Update the details below</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            {/* Image */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-4 transition-colors hover:border-primary/50"
            >
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="mx-auto max-h-32 rounded-lg object-cover" />
              ) : (
                <Upload className="h-8 w-8 text-muted-foreground" />
              )}
              <p className="mt-2 text-xs text-muted-foreground">Click to change image</p>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
            </div>

            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1.5" required />
            </div>

            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1.5" rows={3} />
            </div>

            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category *</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories?.map((cat: any) => (
                    <SelectItem key={cat._id} value={cat._id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</Label>
              <RadioGroup value={form.type} onValueChange={(v) => setForm({ ...form, type: v as any })} className="flex gap-6">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="Veg" id="edit-veg" className="border-swiggy-success text-swiggy-success" />
                  <Label htmlFor="edit-veg" className="text-sm font-medium">Veg</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="Non-Veg" id="edit-nonveg" className="border-swiggy-danger text-swiggy-danger" />
                  <Label htmlFor="edit-nonveg" className="text-sm font-medium">Non-Veg</Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Price (₹) *</Label>
              <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="mt-1.5" min={0} step="0.01" required />
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
              <Switch checked={form.isAvailable} onCheckedChange={(v) => setForm({ ...form, isAvailable: v })} />
            </div>

            <motion.button type="submit" disabled={loading} whileTap={{ scale: 0.97 }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground shadow-lg transition-all hover:brightness-110 disabled:opacity-50">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : "Update Product"}
            </motion.button>
          </form>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

export default EditProductModal;
