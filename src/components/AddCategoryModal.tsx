import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { categoryApi, uploadApi } from "@/api/axios";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Loader2 } from "lucide-react";

interface AddCategoryModalProps {
  open: boolean;
  onClose: () => void;
}

const AddCategoryModal = ({ open, onClose }: AddCategoryModalProps) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
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
    if (!name.trim()) {
      toast.error("Please enter a category name");
      return;
    }
    setLoading(true);
    try {
      let imageURL = "";
      if (imageFile) {
        const res = await uploadApi.uploadImage(imageFile);
        imageURL = res.data.url;
      }
      await categoryApi.create({ name: name.trim(), imageURL });
      toast.success("Category added! 🎉");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setName("");
      setImageFile(null);
      setImagePreview(null);
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to create category");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="overflow-hidden border-none bg-transparent p-0 shadow-none sm:max-w-md">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="rounded-2xl border border-border bg-card/95 p-8 shadow-2xl backdrop-blur-xl"
        >
          <DialogTitle className="text-xl font-bold text-foreground">Add New Category</DialogTitle>
          <p className="mt-1 text-sm text-muted-foreground">Upload an image and give it a name</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            {/* Circular image dropzone */}
            <div className="flex justify-center">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex h-32 w-32 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed transition-colors ${
                  dragOver
                    ? "border-primary bg-primary/5"
                    : imagePreview
                    ? "border-primary"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <Upload className="h-6 w-6" />
                    <span className="text-[10px] font-medium">Upload</span>
                  </div>
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
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Biryani, Rolls, Pizza"
                className="mt-1.5"
                required
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
                  Uploading...
                </>
              ) : (
                "Create Category"
              )}
            </motion.button>
          </form>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

export default AddCategoryModal;
