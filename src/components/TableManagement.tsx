import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { posApi } from "@/api/axios";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import {
  Plus, Pencil, Trash2, LayoutGrid, Users, Utensils, X, Loader2, CheckCircle2,
} from "lucide-react";

type Section = { _id: string; name: string; description?: string; tableCount?: number };
type TableT = {
  _id: string;
  name: string;
  capacity?: number;
  status: "available" | "occupied" | "dirty";
  category: { _id: string; name: string } | string;
};

const inputClass =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20";
const labelClass = "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground";
const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow transition-all hover:brightness-110 disabled:opacity-50";
const btnGhost =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-muted";

const STATUS_META: Record<TableT["status"], { label: string; cls: string; dot: string }> = {
  available: { label: "Available", cls: "bg-green-500/10 text-green-600 border-green-500/30", dot: "bg-green-500" },
  occupied: { label: "Occupied", cls: "bg-red-500/10 text-red-600 border-red-500/30", dot: "bg-red-500" },
  dirty: { label: "Dirty", cls: "bg-amber-500/10 text-amber-600 border-amber-500/30", dot: "bg-amber-500" },
};

const TableManagement = () => {
  const qc = useQueryClient();
  const [sectionModal, setSectionModal] = useState<{ open: boolean; edit?: Section }>({ open: false });
  const [tableModal, setTableModal] = useState<{ open: boolean; edit?: TableT; sectionId?: string }>({ open: false });

  const { data: sections = [], isLoading: sLoading } = useQuery<Section[]>({
    queryKey: ["pos-sections"],
    queryFn: async () => (await posApi.getSections()).data,
  });
  const { data: tables = [], isLoading: tLoading } = useQuery<TableT[]>({
    queryKey: ["pos-tables"],
    queryFn: async () => (await posApi.getTables()).data,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["pos-sections"] });
    qc.invalidateQueries({ queryKey: ["pos-tables"] });
  };

  const err = (e: any, f: string) => toast.error(e?.response?.data?.message || f);

  const delSection = useMutation({
    mutationFn: (id: string) => posApi.deleteSection(id),
    onSuccess: () => { toast.success("Section deleted"); refresh(); },
    onError: (e) => err(e, "Could not delete section"),
  });
  const delTable = useMutation({
    mutationFn: (id: string) => posApi.deleteTable(id),
    onSuccess: () => { toast.success("Table deleted"); refresh(); },
    onError: (e) => err(e, "Could not delete table"),
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TableT["status"] }) => posApi.setTableStatus(id, status),
    onSuccess: () => { toast.success("Table status updated"); refresh(); },
    onError: (e) => err(e, "Could not update status"),
  });

  const tablesOf = (sectionId: string) =>
    tables.filter((t) => (typeof t.category === "string" ? t.category : t.category?._id) === sectionId);

  const loading = sLoading || tLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <LayoutGrid className="h-6 w-6 text-primary" /> Table Management
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Organise sections and dining tables for POS.</p>
        </div>
        <button className={btnPrimary} onClick={() => setSectionModal({ open: true })}>
          <Plus className="h-4 w-4" /> Add Section
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : sections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center">
          <LayoutGrid className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">No sections yet. Add your first section (e.g. “Ground Floor”).</p>
        </div>
      ) : (
        <div className="space-y-5">
          {sections.map((section) => {
            const secTables = tablesOf(section._id);
            return (
              <div key={section._id} className="rounded-2xl border border-border bg-card p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">{section.name}</h2>
                    {section.description && <p className="text-xs text-muted-foreground">{section.description}</p>}
                    <p className="mt-0.5 text-xs text-muted-foreground">{secTables.length} table(s)</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className={btnGhost} onClick={() => setTableModal({ open: true, sectionId: section._id })}>
                      <Plus className="h-3.5 w-3.5" /> Table
                    </button>
                    <button className={btnGhost} onClick={() => setSectionModal({ open: true, edit: section })}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      className={btnGhost + " text-red-600 hover:bg-red-500/10"}
                      onClick={() => { if (confirm(`Delete section “${section.name}”?`)) delSection.mutate(section._id); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {secTables.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tables in this section yet.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {secTables.map((t) => {
                      const meta = STATUS_META[t.status];
                      return (
                        <motion.div
                          key={t._id}
                          initial={{ opacity: 0, scale: 0.97 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="rounded-xl border border-border bg-background p-3"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-1.5 font-bold text-foreground">
                              <Utensils className="h-4 w-4 text-primary" /> {t.name}
                            </div>
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.cls}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} /> {meta.label}
                            </span>
                          </div>
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <Users className="h-3 w-3" /> {t.capacity ?? 4} seats
                          </p>
                          <div className="mt-3 flex items-center gap-1.5">
                            {t.status === "dirty" && (
                              <button
                                className="inline-flex items-center gap-1 rounded-lg bg-green-500/10 px-2 py-1 text-[11px] font-semibold text-green-600 hover:bg-green-500/20"
                                onClick={() => setStatus.mutate({ id: t._id, status: "available" })}
                              >
                                <CheckCircle2 className="h-3 w-3" /> Mark clean
                              </button>
                            )}
                            <button
                              className="rounded-lg border border-border px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-muted disabled:opacity-40"
                              disabled={t.status === "occupied"}
                              title={t.status === "occupied" ? "Table is in use" : "Edit"}
                              onClick={() => setTableModal({ open: true, edit: t })}
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              className="rounded-lg border border-border px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-500/10 disabled:opacity-40"
                              disabled={t.status === "occupied"}
                              title={t.status === "occupied" ? "Table is in use" : "Delete"}
                              onClick={() => { if (confirm(`Delete table “${t.name}”?`)) delTable.mutate(t._id); }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {sectionModal.open && (
        <SectionModal
          edit={sectionModal.edit}
          onClose={() => setSectionModal({ open: false })}
          onSaved={() => { setSectionModal({ open: false }); refresh(); }}
        />
      )}
      {tableModal.open && (
        <TableModal
          edit={tableModal.edit}
          sectionId={tableModal.sectionId}
          sections={sections}
          onClose={() => setTableModal({ open: false })}
          onSaved={() => { setTableModal({ open: false }); refresh(); }}
        />
      )}
    </div>
  );
};

// ── Section create/edit modal ──
const SectionModal = ({ edit, onClose, onSaved }: { edit?: Section; onClose: () => void; onSaved: () => void }) => {
  const [name, setName] = useState(edit?.name || "");
  const [description, setDescription] = useState(edit?.description || "");
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (edit) await posApi.updateSection(edit._id, { name, description });
      else await posApi.createSection({ name, description });
      toast.success(edit ? "Section updated" : "Section created");
      onSaved();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not save section");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>{edit ? "Edit Section" : "Add Section"}</DialogTitle>
        <form onSubmit={save} className="mt-2 space-y-4">
          <div>
            <label className={labelClass}>Section Name</label>
            <input autoFocus required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="e.g. Ground Floor" />
          </div>
          <div>
            <label className={labelClass}>Description (optional)</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} placeholder="e.g. Near entrance" />
          </div>
          <button type="submit" disabled={saving} className={btnPrimary + " w-full"}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : edit ? "Save changes" : "Create section"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// ── Table create/edit modal ──
const TableModal = ({
  edit, sectionId, sections, onClose, onSaved,
}: { edit?: TableT; sectionId?: string; sections: Section[]; onClose: () => void; onSaved: () => void }) => {
  const initialCat = edit ? (typeof edit.category === "string" ? edit.category : edit.category?._id) : sectionId || sections[0]?._id || "";
  const [name, setName] = useState(edit?.name || "");
  const [category, setCategory] = useState(initialCat);
  const [capacity, setCapacity] = useState(String(edit?.capacity ?? 4));
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) { toast.error("Please select a section"); return; }
    setSaving(true);
    try {
      const payload = { name, category, capacity: Number(capacity) || 4 };
      if (edit) await posApi.updateTable(edit._id, payload);
      else await posApi.createTable(payload);
      toast.success(edit ? "Table updated" : "Table created");
      onSaved();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not save table");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>{edit ? "Edit Table" : "Add Table"}</DialogTitle>
        <form onSubmit={save} className="mt-2 space-y-4">
          <div>
            <label className={labelClass}>Table Name / Number</label>
            <input autoFocus required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="e.g. T1" />
          </div>
          <div>
            <label className={labelClass}>Section</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
              {sections.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Seats</label>
            <input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} className={inputClass} />
          </div>
          <button type="submit" disabled={saving} className={btnPrimary + " w-full"}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : edit ? "Save changes" : "Create table"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TableManagement;
