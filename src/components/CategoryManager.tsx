import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { menuApi } from "@/api/axios";
import { Plus } from "lucide-react";
import { motion } from "framer-motion";
import { SkeletonCategory } from "@/components/Skeletons";
import AddCategoryModal from "@/components/AddCategoryModal";
import EditCategoryModal from "@/components/EditCategoryModal";
import { categoryApi } from "@/api/axios";
import { toast } from "sonner";
import { MoreVertical, Edit2, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useQueryClient } from "@tanstack/react-query";

const CategoryManager = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: categories, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: () => menuApi.getCategories().then((r) => r.data),
  });

  const handleDelete = async (id: string) => {
    try {
      await categoryApi.delete(id);
      toast.success("Category deleted");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to delete category");
    }
  };

  return (
    <section className="container mx-auto px-4 py-8">
      <h2 className="mb-5 text-lg font-bold text-foreground">Manage Categories</h2>

      <div className="flex flex-wrap gap-5">
        {/* Add card */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setModalOpen(true)}
          className="flex h-28 w-28 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 text-primary transition-colors hover:border-primary hover:bg-primary/10"
        >
          <Plus className="h-7 w-7" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Add</span>
        </motion.button>

        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => <SkeletonCategory key={i} />)
          : categories?.map((cat: any) => (
            <div key={cat._id} className="group relative flex w-28 flex-col items-center gap-2">
              {/* Action Menu (Hover) */}
              <div className="absolute top-0 right-0 z-10 opacity-0 transition-opacity group-hover:opacity-100">
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="flex h-6 w-6 items-center justify-center rounded-full bg-background shadow-md border border-border hover:bg-accent hover:text-foreground text-muted-foreground transition-colors">
                      <MoreVertical className="h-3.5 w-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-32 p-1" align="start">
                    <button
                      onClick={() => {
                        setSelectedCategory(cat);
                        setEditModalOpen(true);
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold hover:bg-accent text-foreground transition-colors"
                    >
                      <Edit2 className="h-3.5 w-3.5" /> Edit
                    </button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold hover:bg-destructive/10 text-destructive transition-colors">
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="max-w-xs">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Category?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete {cat.name}? This will affect products linked to this category.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(cat._id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="h-20 w-20 overflow-hidden rounded-full border-2 border-border shadow-sm group-hover:ring-2 ring-primary/20 transition-all">
                {cat.image || cat.imageURL ? (
                  <img
                    src={cat.image || cat.imageURL}
                    alt={cat.name}
                    className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-accent text-2xl group-hover:scale-110 transition-transform duration-300">
                    🍽️
                  </div>
                )}
              </div>
              <span className="max-w-full text-center truncate px-1 text-xs font-semibold text-foreground">
                {cat.name}
              </span>
            </div>
          ))}
      </div>

      <AddCategoryModal open={modalOpen} onClose={() => setModalOpen(false)} />
      {selectedCategory && (
        <EditCategoryModal
          open={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setTimeout(() => setSelectedCategory(null), 300);
          }}
          category={selectedCategory}
        />
      )}
    </section>
  );
};

export default CategoryManager;
