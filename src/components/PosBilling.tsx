import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { posApi } from "@/api/axios";
import { printBill } from "@/lib/posPrint";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Printer, Receipt, Utensils, Loader2, ChefHat } from "lucide-react";

type TableT = { _id: string; name: string; status: string; category?: { name: string } };
type KotItem = { product: string; name: string; variant: string; price: number; quantity: number };
type Kot = { _id: string; kotNumber: string; table: { _id: string } | string; items: KotItem[] };

const money = (n: number) => `₹${(n || 0).toFixed(2)}`;

const PosBilling = () => {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string>("");
  const [discountType, setDiscountType] = useState<"FLAT" | "PERCENTAGE">("FLAT");
  const [discountValue, setDiscountValue] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: tables = [], isLoading: tLoading } = useQuery<TableT[]>({
    queryKey: ["pos-tables"],
    queryFn: async () => (await posApi.getTables()).data,
  });
  const { data: openKots = [] } = useQuery<Kot[]>({
    queryKey: ["pos-kots"],
    queryFn: async () => (await posApi.getKots({ status: "open" })).data,
  });

  const occupied = tables.filter((t) => t.status === "occupied");

  const tableKots = useMemo(
    () => openKots.filter((k) => (typeof k.table === "string" ? k.table : k.table?._id) === selected),
    [openKots, selected]
  );

  // Aggregate items for preview (subtotal only; GST is computed server-side).
  const items = useMemo(() => {
    const map = new Map<string, KotItem>();
    tableKots.forEach((k) => k.items.forEach((it) => {
      const key = `${it.product}__${it.variant}`;
      if (map.has(key)) map.get(key)!.quantity += it.quantity;
      else map.set(key, { ...it });
    }));
    return Array.from(map.values());
  }, [tableKots]);

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const dv = Number(discountValue) || 0;
  const previewDiscount = discountType === "FLAT" ? Math.min(dv, subtotal) : Math.min((subtotal * dv) / 100, subtotal);

  const selectedTable = tables.find((t) => t._id === selected);

  const generate = async () => {
    if (!selected) { toast.error("Select a table"); return; }
    if (items.length === 0) { toast.error("This table has no open KOT to bill"); return; }
    setSaving(true);
    try {
      const res = await posApi.generateBill({
        tableId: selected,
        discountType: dv > 0 ? discountType : "NONE",
        discountValue: dv,
      });
      toast.success(`Bill ${res.data.billNumber} generated`);
      printBill(res.data);
      setSelected(""); setDiscountValue("");
      qc.invalidateQueries({ queryKey: ["pos-tables"] });
      qc.invalidateQueries({ queryKey: ["pos-kots"] });
      qc.invalidateQueries({ queryKey: ["pos-bills"] });
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not generate bill");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Receipt className="h-6 w-6 text-primary" /> POS Billing
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Bill an occupied table from its KOT. Payment is recorded later in Settlement.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Occupied tables */}
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Occupied Tables</h2>
          {tLoading ? (
            <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…</div>
          ) : occupied.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border py-16 text-center">
              <Utensils className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">No occupied tables. Create a KOT first from the KOT tab.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {occupied.map((t) => {
                const kots = openKots.filter((k) => (typeof k.table === "string" ? k.table : k.table?._id) === t._id);
                const active = selected === t._id;
                return (
                  <button key={t._id} onClick={() => setSelected(t._id)}
                    className={`rounded-xl border p-3 text-left transition-all ${active ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border bg-card hover:border-primary/40"}`}>
                    <div className="flex items-center gap-1.5 font-bold text-foreground"><Utensils className="h-4 w-4 text-primary" /> {t.name}</div>
                    <p className="text-[11px] text-muted-foreground">{t.category?.name}</p>
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-red-600"><ChefHat className="h-3 w-3" /> {kots.length} KOT · {kots.reduce((s, k) => s + k.items.length, 0)} items</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Bill builder */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 flex items-center gap-2 font-bold text-foreground"><Receipt className="h-4 w-4 text-primary" /> Current Bill</h2>
          {!selected ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Select an occupied table to bill.</div>
          ) : (
            <>
              <div className="mb-2 rounded-lg bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
                {selectedTable?.name}{selectedTable?.category?.name ? ` · ${selectedTable.category.name}` : ""}
                {tableKots.length > 0 && <span className="ml-1 font-normal">({tableKots.map((k) => k.kotNumber).join(", ")})</span>}
              </div>
              <div className="max-h-56 space-y-1.5 overflow-y-auto">
                {items.map((it, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate text-foreground">{it.quantity}× {it.name}{it.variant !== "Standard" ? ` (${it.variant})` : ""}</span>
                    <span className="font-semibold text-foreground">{money(it.price * it.quantity)}</span>
                  </div>
                ))}
              </div>

              <div className="mt-3 border-t border-border pt-3">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Discount</label>
                <div className="flex gap-2">
                  <div className="inline-flex rounded-lg border border-border p-0.5">
                    <button onClick={() => setDiscountType("FLAT")} className={`rounded-md px-2.5 py-1 text-xs font-semibold ${discountType === "FLAT" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>₹ Flat</button>
                    <button onClick={() => setDiscountType("PERCENTAGE")} className={`rounded-md px-2.5 py-1 text-xs font-semibold ${discountType === "PERCENTAGE" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>%</button>
                  </div>
                  <input type="number" min={0} value={discountValue} onChange={(e) => setDiscountValue(e.target.value)}
                    placeholder={discountType === "FLAT" ? "Amount (₹)" : "Percent"} className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary" />
                </div>
              </div>

              <div className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{money(subtotal)}</span></div>
                {previewDiscount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>- {money(previewDiscount)}</span></div>}
                <p className="pt-1 text-[11px] text-muted-foreground">GST (if any) is added on the printed bill.</p>
              </div>

              <button onClick={generate} disabled={saving} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow transition-all hover:brightness-110 disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />} Generate &amp; Print Bill
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PosBilling;
