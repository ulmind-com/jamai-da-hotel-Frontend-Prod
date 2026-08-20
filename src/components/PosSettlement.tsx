import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { posApi } from "@/api/axios";
import { printBill, BillLike } from "@/lib/posPrint";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAuthStore } from "@/store/useAuthStore";
import { motion } from "framer-motion";
import {
  Wallet, Printer, Loader2, CheckCircle2, Banknote, Smartphone, CreditCard, Receipt, Trash2, Clock,
} from "lucide-react";

type Bill = BillLike & {
  _id: string;
  settledBy?: { name?: string };
  settledAt?: string;
  deleteRequest?: { requestedByName?: string; status?: string; reason?: string };
};

const money = (n: number) => `₹${(n || 0).toFixed(2)}`;
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); };

const PosSettlement = () => {
  const qc = useQueryClient();
  const { isAdmin } = useAuthStore();
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [settling, setSettling] = useState<Bill | null>(null);

  const refreshBills = () => {
    qc.invalidateQueries({ queryKey: ["pos-bills"] });
    qc.invalidateQueries({ queryKey: ["pos-tables"] });
  };

  const requestDelete = async (b: Bill) => {
    const admin = isAdmin();
    if (!confirm(admin ? `Delete ${b.billNumber}? This cannot be undone.` : `Request deletion of ${b.billNumber}? An admin must approve it.`)) return;
    try {
      const res = await posApi.requestBillDelete(b._id);
      toast.success(res.data.message);
      refreshBills();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not process delete");
    }
  };
  const approveDelete = async (b: Bill) => {
    if (!confirm(`Approve deletion of ${b.billNumber}?`)) return;
    try { await posApi.deleteBill(b._id); toast.success("Bill deleted"); refreshBills(); }
    catch (e: any) { toast.error(e?.response?.data?.message || "Could not delete"); }
  };
  const rejectDelete = async (b: Bill) => {
    try { await posApi.rejectBillDelete(b._id); toast.success("Delete request rejected"); refreshBills(); }
    catch (e: any) { toast.error(e?.response?.data?.message || "Could not reject"); }
  };

  const { data: pending = [], isLoading: pLoading } = useQuery<Bill[]>({
    queryKey: ["pos-bills", "settlement_pending"],
    queryFn: async () => (await posApi.getBills({ status: "settlement_pending" })).data,
  });
  const { data: settled = [], isLoading: sLoading } = useQuery<Bill[]>({
    queryKey: ["pos-bills", "settled-today"],
    queryFn: async () => (await posApi.getBills({ status: "settled", from: startOfToday() })).data,
  });

  const list = tab === "pending" ? pending : settled;
  const loading = tab === "pending" ? pLoading : sLoading;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground"><Wallet className="h-6 w-6 text-primary" /> Settlement</h1>
          <p className="mt-1 text-sm text-muted-foreground">Record payment for generated bills. Settling frees the table.</p>
        </div>
        <div className="inline-flex rounded-xl border border-border bg-card p-1 text-sm font-semibold">
          <button onClick={() => setTab("pending")} className={`rounded-lg px-4 py-1.5 ${tab === "pending" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Pending ({pending.length})</button>
          <button onClick={() => setTab("history")} className={`rounded-lg px-4 py-1.5 ${tab === "history" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Settled today ({settled.length})</button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…</div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center">
          <Receipt className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">{tab === "pending" ? "No bills awaiting settlement." : "No bills settled today yet."}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((b) => (
            <motion.div key={b._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">{b.billNumber}</span>
                {b.status === "settled" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] font-semibold text-green-600"><CheckCircle2 className="h-3 w-3" /> {b.paymentMethod}</span>
                ) : (
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600">Pending</span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {b.tableName}{b.sectionName ? ` · ${b.sectionName}` : ""} · {b.createdAt ? new Date(b.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : ""}
                {b.createdBy?.name ? ` · by ${b.createdBy.name}` : ""}
              </p>
              <div className="mt-2 space-y-0.5 border-t border-border pt-2 text-sm">
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{money(b.subtotal)}</span></div>
                {b.taxAmount > 0 && <div className="flex justify-between text-muted-foreground"><span>GST</span><span>{money(b.taxAmount)}</span></div>}
                {b.discountAmount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>- {money(b.discountAmount)}</span></div>}
                <div className="flex justify-between pt-1 text-base font-bold text-foreground"><span>Total</span><span>{money(b.total)}</span></div>
              </div>
              {b.status === "settled" && b.settledBy?.name && (
                <p className="mt-2 text-[11px] text-muted-foreground">Settled by {b.settledBy.name}{b.customerName ? ` · ${b.customerName}` : ""}</p>
              )}
              {b.deleteRequest?.status === "pending" && (
                <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-700">
                  <span className="inline-flex items-center gap-1 font-semibold"><Clock className="h-3 w-3" /> Delete requested{b.deleteRequest.requestedByName ? ` by ${b.deleteRequest.requestedByName}` : ""}</span>
                  {isAdmin() && (
                    <div className="mt-1.5 flex gap-1.5">
                      <button onClick={() => approveDelete(b)} className="rounded bg-red-600 px-2 py-1 font-semibold text-white hover:brightness-110">Approve delete</button>
                      <button onClick={() => rejectDelete(b)} className="rounded border border-border bg-background px-2 py-1 font-semibold">Reject</button>
                    </div>
                  )}
                </div>
              )}
              <div className="mt-3 flex gap-1.5">
                {b.status !== "settled" && (
                  <button onClick={() => setSettling(b)} className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-primary py-1.5 text-xs font-bold text-primary-foreground hover:brightness-110"><Wallet className="h-3.5 w-3.5" /> Settle</button>
                )}
                <button onClick={() => printBill(b)} className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-border py-1.5 text-xs font-semibold hover:bg-muted"><Printer className="h-3.5 w-3.5" /> Print</button>
                {b.deleteRequest?.status !== "pending" && (
                  <button onClick={() => requestDelete(b)} title={isAdmin() ? "Delete bill" : "Request deletion"} className="inline-flex items-center justify-center rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {settling && (
        <SettleModal
          bill={settling}
          onClose={() => setSettling(null)}
          onDone={() => {
            setSettling(null);
            qc.invalidateQueries({ queryKey: ["pos-bills"] });
            qc.invalidateQueries({ queryKey: ["pos-tables"] });
          }}
        />
      )}
    </div>
  );
};

const PAY = [
  { key: "CASH", label: "Cash", icon: Banknote },
  { key: "UPI", label: "UPI", icon: Smartphone },
  { key: "CARD", label: "Card", icon: CreditCard },
] as const;

const SettleModal = ({ bill, onClose, onDone }: { bill: Bill; onClose: () => void; onDone: () => void }) => {
  const [method, setMethod] = useState<"CASH" | "UPI" | "CARD">("CASH");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const settle = async () => {
    setSaving(true);
    try {
      const res = await posApi.settleBill(bill._id, { paymentMethod: method, customerName: name, customerPhone: phone });
      toast.success(`${bill.billNumber} settled · table freed`);
      printBill(res.data);
      onDone();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not settle bill");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>Settle {bill.billNumber}</DialogTitle>
        <div className="mt-2 space-y-4">
          <div className="rounded-xl bg-muted px-4 py-3 text-center">
            <p className="text-xs text-muted-foreground">Amount Payable</p>
            <p className="text-3xl font-black text-foreground">{money(bill.total)}</p>
            <p className="text-[11px] text-muted-foreground">{bill.tableName}</p>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment Method</label>
            <div className="grid grid-cols-3 gap-2">
              {PAY.map((p) => {
                const Icon = p.icon; const active = method === p.key;
                return (
                  <button key={p.key} onClick={() => setMethod(p.key)}
                    className={`flex flex-col items-center gap-1 rounded-xl border py-3 text-xs font-semibold transition ${active ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground hover:bg-muted"}`}>
                    <Icon className="h-5 w-5" /> {p.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name (opt)" className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (opt)" className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" />
          </div>
          <button onClick={settle} disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow hover:brightness-110 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Confirm &amp; Settle
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PosSettlement;
