import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { posApi } from "@/api/axios";
import { useAuthStore } from "@/store/useAuthStore";
import { downloadReportPdf, reportPdfBase64, reportFilename } from "@/lib/reportPdf";
import { toast } from "sonner";
import {
  BarChart3, Mail, Loader2, Banknote, Smartphone, CreditCard, Store, Globe, Users, Receipt, FileDown,
} from "lucide-react";

const money = (n: number) => `₹${(n || 0).toFixed(2)}`;
const todayStr = () => new Date().toISOString().slice(0, 10);

type Report = {
  offline: {
    totalSales: number; billCount: number; taxCollected: number; discountGiven: number;
    byPayment: Record<string, { count: number; total: number }>;
    byStaff: { name: string; count: number; total: number }[];
    topItems: { name: string; quantity: number; amount: number }[];
    bills: { billNumber: string; tableName: string; total: number; paymentMethod: string; settledBy: string; settledAt: string }[];
  };
  online: { totalSales: number; orderCount: number };
};

const PosReports = () => {
  const { user } = useAuthStore();
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [email, setEmail] = useState(user?.email || "");
  const [sending, setSending] = useState(false);

  const range = { from: `${from}T00:00:00`, to: `${to}T23:59:59` };

  const { data, isFetching, refetch } = useQuery<Report>({
    queryKey: ["pos-report", from, to],
    queryFn: async () => (await posApi.getReport(range)).data,
  });

  const [generating, setGenerating] = useState(false);

  // Generate = build & download a premium PDF of the (fresh) report.
  const generate = async () => {
    setGenerating(true);
    try {
      const res = await refetch();
      const r = res.data;
      if (!r) { toast.error("No report data"); return; }
      downloadReportPdf(r, range.from, range.to);
      toast.success("PDF report downloaded 📄");
    } catch (e: any) {
      toast.error("Could not generate PDF");
    } finally {
      setGenerating(false);
    }
  };

  // Send = email the SAME PDF as an attachment.
  const sendEmail = async () => {
    if (!email) { toast.error("Enter a recipient email"); return; }
    setSending(true);
    try {
      let r = data;
      if (!r) { const res = await refetch(); r = res.data; }
      const pdfBase64 = r ? reportPdfBase64(r, range.from, range.to) : undefined;
      const res = await posApi.emailReport({ ...range, email, pdfBase64, filename: reportFilename(range.from, range.to) });
      toast.success(res.data.message || "Report emailed 📧");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not email report");
    } finally {
      setSending(false);
    }
  };

  const pay = data?.offline.byPayment || {};
  const PAY_META = [
    { key: "CASH", label: "Cash", icon: Banknote },
    { key: "UPI", label: "UPI", icon: Smartphone },
    { key: "CARD", label: "Card", icon: CreditCard },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground"><BarChart3 className="h-6 w-6 text-primary" /> Sales Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">Offline (POS) sales with online reference. Default range is today.</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">From</label>
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">To</label>
          <input type="date" value={to} min={from} max={todayStr()} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
        </div>
        <button onClick={generate} disabled={isFetching || generating} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:brightness-110 disabled:opacity-60">
          {isFetching || generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} Generate PDF
        </button>
        <div className="ml-auto flex items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email report to</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" className="w-56 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          </div>
          <button onClick={sendEmail} disabled={sending} className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-bold hover:bg-muted disabled:opacity-50">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Send
          </button>
        </div>
      </div>

      {isFetching && !data ? (
        <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…</div>
      ) : data ? (
        <>
          {/* Online vs Offline */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary"><Store className="h-4 w-4" /> Offline (POS)</div>
              <p className="mt-2 text-3xl font-black text-foreground">{money(data.offline.totalSales)}</p>
              <p className="text-xs text-muted-foreground">{data.offline.billCount} bills · GST {money(data.offline.taxCollected)} · Disc {money(data.offline.discountGiven)}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Globe className="h-4 w-4" /> Online (App) — reference</div>
              <p className="mt-2 text-3xl font-black text-foreground">{money(data.online.totalSales)}</p>
              <p className="text-xs text-muted-foreground">{data.online.orderCount} orders</p>
            </div>
          </div>

          {/* Payment breakdown */}
          <div className="grid gap-4 sm:grid-cols-3">
            {PAY_META.map((p) => {
              const v = pay[p.key] || { count: 0, total: 0 }; const Icon = p.icon;
              return (
                <div key={p.key} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-semibold text-foreground"><Icon className="h-4 w-4 text-primary" /> {p.label}</span>
                    <span className="text-xs text-muted-foreground">{v.count} bills</span>
                  </div>
                  <p className="mt-1 text-xl font-bold text-foreground">{money(v.total)}</p>
                </div>
              );
            })}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* By staff (audit) */}
            <div className="rounded-2xl border border-border bg-card p-4">
              <h3 className="mb-3 flex items-center gap-2 font-bold text-foreground"><Users className="h-4 w-4 text-primary" /> By Staff (who settled)</h3>
              {data.offline.byStaff.length === 0 ? <p className="text-sm text-muted-foreground">No data.</p> : (
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="pb-1">Staff</th><th className="pb-1 text-right">Bills</th><th className="pb-1 text-right">Amount</th></tr></thead>
                  <tbody>{data.offline.byStaff.map((s) => (<tr key={s.name} className="border-b border-border/50"><td className="py-1.5">{s.name}</td><td className="py-1.5 text-right">{s.count}</td><td className="py-1.5 text-right font-semibold">{money(s.total)}</td></tr>))}</tbody>
                </table>
              )}
            </div>
            {/* Top items */}
            <div className="rounded-2xl border border-border bg-card p-4">
              <h3 className="mb-3 flex items-center gap-2 font-bold text-foreground"><Receipt className="h-4 w-4 text-primary" /> Top Items</h3>
              {data.offline.topItems.length === 0 ? <p className="text-sm text-muted-foreground">No data.</p> : (
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="pb-1">Item</th><th className="pb-1 text-right">Qty</th><th className="pb-1 text-right">Amount</th></tr></thead>
                  <tbody>{data.offline.topItems.map((i) => (<tr key={i.name} className="border-b border-border/50"><td className="py-1.5">{i.name}</td><td className="py-1.5 text-right">{i.quantity}</td><td className="py-1.5 text-right font-semibold">{money(i.amount)}</td></tr>))}</tbody>
                </table>
              )}
            </div>
          </div>

          {/* Bills table */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <h3 className="mb-3 font-bold text-foreground">Settled Bills ({data.offline.bills.length})</h3>
            {data.offline.bills.length === 0 ? <p className="text-sm text-muted-foreground">No settled bills in this range.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="pb-1">Bill</th><th className="pb-1">Table</th><th className="pb-1">Payment</th><th className="pb-1">Settled by</th><th className="pb-1 text-right">Amount</th></tr></thead>
                  <tbody>{data.offline.bills.map((b) => (
                    <tr key={b.billNumber} className="border-b border-border/50">
                      <td className="py-1.5 font-medium">{b.billNumber}</td><td className="py-1.5">{b.tableName}</td>
                      <td className="py-1.5">{b.paymentMethod}</td><td className="py-1.5">{b.settledBy}</td>
                      <td className="py-1.5 text-right font-semibold">{money(b.total)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
};

export default PosReports;
