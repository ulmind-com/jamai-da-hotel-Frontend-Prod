import { toast } from "sonner";

type BillItem = {
  name: string;
  variant?: string;
  price: number;
  quantity: number;
  lineTotal?: number;
};

export type BillLike = {
  billNumber: string;
  tableName?: string;
  sectionName?: string;
  kotNumbers?: string[];
  items: BillItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  discountType?: string;
  discountValue?: number;
  total: number;
  status?: string;
  paymentMethod?: string | null;
  customerName?: string;
  customerPhone?: string;
  createdAt?: string;
  createdBy?: { name?: string };
  settledBy?: { name?: string };
};

const money = (n: number) => `Rs.${(n || 0).toFixed(2)}`;

// Restaurant-style receipt (WITH prices). Used for both the generated bill
// and the final settled invoice.
export const printBill = (bill: BillLike) => {
  const rows = bill.items
    .map((it) => {
      const line = it.lineTotal ?? it.price * it.quantity;
      const label = `${it.name}${it.variant && it.variant !== "Standard" ? ` (${it.variant})` : ""}`;
      return `<tr>
        <td class="n">${label}<br/><small>${it.quantity} × ${money(it.price)}</small></td>
        <td class="a">${money(line)}</td>
      </tr>`;
    })
    .join("");

  const settled = bill.status === "settled";
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${bill.billNumber}</title>
  <style>
    * { font-family: 'Courier New', monospace; box-sizing: border-box; }
    body { width: 300px; margin: 0 auto; padding: 10px; color:#000; }
    h2 { text-align:center; margin:2px 0; font-size:18px; }
    .muted { text-align:center; font-size:11px; margin:1px 0; }
    hr { border:none; border-top:1px dashed #000; margin:8px 0; }
    table { width:100%; border-collapse:collapse; }
    td { padding:3px 0; font-size:13px; vertical-align:top; }
    td.a { text-align:right; white-space:nowrap; }
    small { font-size:11px; color:#333; }
    .tot td { font-size:13px; }
    .tot td.a { text-align:right; }
    .grand td { font-size:16px; font-weight:bold; border-top:1px solid #000; padding-top:6px; }
    .tag { text-align:center; font-weight:bold; margin-top:6px; }
  </style></head><body>
    <h2>Haldia Cloud Kitchen</h2>
    <div class="muted">& Restaurant</div>
    <div class="muted">${settled ? "TAX INVOICE" : "BILL — PENDING SETTLEMENT"}</div>
    <hr/>
    <div class="muted" style="text-align:left">
      Bill: <b>${bill.billNumber}</b><br/>
      Table: ${bill.tableName || "-"}${bill.sectionName ? " · " + bill.sectionName : ""}<br/>
      ${bill.kotNumbers?.length ? "KOT: " + bill.kotNumbers.join(", ") + "<br/>" : ""}
      ${bill.createdAt ? new Date(bill.createdAt).toLocaleString("en-IN") + "<br/>" : ""}
      ${bill.createdBy?.name ? "Billed by: " + bill.createdBy.name + "<br/>" : ""}
      ${bill.customerName ? "Customer: " + bill.customerName + "<br/>" : ""}
      ${bill.customerPhone ? "Phone: " + bill.customerPhone + "<br/>" : ""}
    </div>
    <hr/>
    <table>${rows}</table>
    <hr/>
    <table class="tot">
      <tr><td>Subtotal</td><td class="a">${money(bill.subtotal)}</td></tr>
      ${bill.taxAmount ? `<tr><td>GST</td><td class="a">${money(bill.taxAmount)}</td></tr>` : ""}
      ${bill.discountAmount ? `<tr><td>Discount${bill.discountType === "PERCENTAGE" ? ` (${bill.discountValue}%)` : ""}</td><td class="a">- ${money(bill.discountAmount)}</td></tr>` : ""}
      <tr class="grand"><td>TOTAL</td><td class="a">${money(bill.total)}</td></tr>
    </table>
    ${settled ? `<div class="tag">PAID · ${bill.paymentMethod}</div>` : `<div class="tag">** NOT YET SETTLED **</div>`}
    <div class="muted" style="margin-top:8px">Thank you! Visit again 🙏</div>
    <script>window.onload=function(){window.print();setTimeout(function(){window.close();},300);}</script>
  </body></html>`;

  const w = window.open("", "_blank", "width=360,height=640");
  if (!w) { toast.error("Please allow pop-ups to print the bill"); return; }
  w.document.write(html);
  w.document.close();
};
