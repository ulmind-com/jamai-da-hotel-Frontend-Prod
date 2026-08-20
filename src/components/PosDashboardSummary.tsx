import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { posApi } from "@/api/axios";
import { Store, Globe, Receipt, Loader2, User, Layers } from "lucide-react";

const money = (n: number) => `₹${(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const todayRange = () => {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  return { from: d.toISOString(), to: new Date().toISOString() };
};

type TopItem = { name: string; quantity: number; amount: number };
type Bill = { ref: string; table: string; when: string; payment: string; by: string; amount: number; source: string };
type Dash = {
  online: { revenue: number; orders: number; topItems: TopItem[] };
  offline: { revenue: number; count: number; topItems: TopItem[]; bills: Bill[] };
  combined: { revenue: number; topItems: TopItem[] };
};

// Consistent online-vs-offline summary + settled-bill feed for the dashboard (today).
const PosDashboardSummary = () => {
  const { data, isLoading } = useQuery<Dash>({
    queryKey: ["pos-dashboard", "today"],
    queryFn: async () => (await posApi.getPosDashboard(todayRange())).data,
  });
  const [itemsView, setItemsView] = useState<"combined" | "online" | "offline">("combined");

  const online = data?.online.revenue || 0;
  const offline = data?.offline.revenue || 0;
  const combined = data?.combined.revenue || 0;
  const bills = data?.offline.bills || [];
  const topItems = data ? data[itemsView].topItems : [];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-foreground">Today · Online vs Offline</h3>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary"><Store className="h-4 w-4" /> Offline (POS)</div>
          <p className="mt-2 text-2xl font-black text-foreground">{money(offline)}</p>
          <p className="text-xs text-muted-foreground">{data?.offline.count || 0} bills/orders</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Globe className="h-4 w-4" /> Online (App)</div>
          <p className="mt-2 text-2xl font-black text-foreground">{money(online)}</p>
          <p className="text-xs text-muted-foreground">{data?.online.orders || 0} paid/delivered</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Layers className="h-4 w-4" /> Combined</div>
          <p className="mt-2 text-2xl font-black text-foreground">{money(combined)}</p>
          <p className="text-xs text-muted-foreground">total revenue today</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top items with channel toggle */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="flex items-center gap-2 font-bold text-foreground"><Receipt className="h-4 w-4 text-primary" /> Top Selling Items</h4>
            <div className="inline-flex rounded-lg border border-border p-0.5 text-xs font-semibold">
              {(["combined", "online", "offline"] as const).map((v) => (
                <button key={v} onClick={() => setItemsView(v)} className={`rounded-md px-2.5 py-1 capitalize ${itemsView === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                  {v === "combined" ? "All" : v}
                </button>
              ))}
            </div>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-8 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…</div>
          ) : topItems.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No items sold in this channel today.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="pb-2">#</th><th className="pb-2">Item</th><th className="pb-2 text-right">Qty</th><th className="pb-2 text-right">Amount</th></tr></thead>
              <tbody>
                {topItems.map((it, i) => (
                  <tr key={it.name} className="border-b border-border/50">
                    <td className="py-2 text-muted-foreground">{i + 1}</td>
                    <td className="py-2 font-medium text-foreground">{it.name}</td>
                    <td className="py-2 text-right">{it.quantity}</td>
                    <td className="py-2 text-right font-semibold">{money(it.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Settled offline bills feed */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <h4 className="mb-3 flex items-center gap-2 font-bold text-foreground"><Receipt className="h-4 w-4 text-primary" /> Offline Bills (today)</h4>
          {isLoading ? (
            <div className="flex justify-center py-8 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…</div>
          ) : bills.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No offline bills today yet.</p>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card"><tr className="border-b border-border text-left text-muted-foreground"><th className="pb-2">Bill</th><th className="pb-2">Table</th><th className="pb-2">Time</th><th className="pb-2">Pay</th><th className="pb-2">By</th><th className="pb-2 text-right">Amt</th></tr></thead>
                <tbody>
                  {bills.map((b, i) => (
                    <tr key={b.ref + i} className="border-b border-border/50">
                      <td className="py-2 font-medium text-foreground">{b.ref}{b.source === "Legacy" ? <span className="ml-1 text-[9px] text-muted-foreground">(old)</span> : ""}</td>
                      <td className="py-2">{b.table}</td>
                      <td className="py-2 text-muted-foreground">{b.when ? new Date(b.when).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                      <td className="py-2"><span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold">{b.payment}</span></td>
                      <td className="py-2"><span className="inline-flex items-center gap-1 text-xs"><User className="h-3 w-3 text-muted-foreground" />{b.by}</span></td>
                      <td className="py-2 text-right font-semibold">{money(b.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PosDashboardSummary;
