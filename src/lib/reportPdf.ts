import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type ReportData = {
  offline: {
    totalSales: number; billCount: number; taxCollected: number; discountGiven: number;
    byPayment: Record<string, { count: number; total: number }>;
    byStaff: { name: string; count: number; total: number }[];
    topItems: { name: string; quantity: number; amount: number }[];
    bills: { billNumber: string; tableName: string; total: number; paymentMethod: string; settledBy: string; settledAt: string }[];
  };
  online: { totalSales: number; orderCount: number };
};

const ORANGE: [number, number, number] = [255, 87, 34];
const DARK: [number, number, number] = [33, 37, 41];
const GREY: [number, number, number] = [120, 120, 120];
const LIGHT: [number, number, number] = [245, 245, 245];

const rs = (n: number) => "Rs. " + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const fmtDT = (d: string) => (d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

// Build a premium, professional sales-report PDF for a date range.
export const buildReportPdf = (r: ReportData, fromStr: string, toStr: string): jsPDF => {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 40;

  // ── Header band ──
  doc.setFillColor(...ORANGE);
  doc.rect(0, 0, W, 90, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Haldia Cloud Kitchen & Restaurant", M, 40);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("Sales Report", M, 60);
  doc.setFontSize(10);
  doc.text(`${fmtDate(fromStr)}  —  ${fmtDate(toStr)}`, M, 76);
  doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, W - M, 76, { align: "right" });

  // ── KPI cards ──
  const cardY = 108, cardH = 66, gap = 12;
  const cardW = (W - M * 2 - gap * 2) / 3;
  const combined = r.offline.totalSales + r.online.totalSales;
  const cards: { label: string; value: string; sub: string; accent?: boolean }[] = [
    { label: "OFFLINE (POS)", value: rs(r.offline.totalSales), sub: `${r.offline.billCount} settled bills`, accent: true },
    { label: "ONLINE (APP)", value: rs(r.online.totalSales), sub: `${r.online.orderCount} orders` },
    { label: "COMBINED", value: rs(combined), sub: "total sales" },
  ];
  cards.forEach((c, i) => {
    const x = M + i * (cardW + gap);
    if (c.accent) { doc.setFillColor(255, 243, 237); doc.setDrawColor(...ORANGE); }
    else { doc.setFillColor(...LIGHT); doc.setDrawColor(225, 225, 225); }
    doc.roundedRect(x, cardY, cardW, cardH, 6, 6, "FD");
    doc.setFontSize(8);
    doc.setTextColor(...GREY);
    doc.setFont("helvetica", "bold");
    doc.text(c.label, x + 12, cardY + 18);
    doc.setFontSize(16);
    doc.setTextColor(...(c.accent ? ORANGE : DARK));
    doc.text(c.value, x + 12, cardY + 40);
    doc.setFontSize(8);
    doc.setTextColor(...GREY);
    doc.setFont("helvetica", "normal");
    doc.text(c.sub, x + 12, cardY + 55);
  });

  let y = cardY + cardH + 18;
  doc.setFontSize(9);
  doc.setTextColor(...GREY);
  doc.text(`GST collected: ${rs(r.offline.taxCollected)}      Discount given: ${rs(r.offline.discountGiven)}`, M, y);
  y += 14;

  const tableOpts = (head: string[][], body: any[][], startY: number) => {
    autoTable(doc, {
      head, body, startY,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 5, textColor: DARK as any },
      headStyles: { fillColor: ORANGE as any, textColor: [255, 255, 255] as any, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [250, 250, 250] as any },
      margin: { left: M, right: M },
    });
    return (doc as any).lastAutoTable.finalY as number;
  };

  // ── Payment breakdown ──
  y = tableOpts(
    [["Payment Method", "Bills", "Amount"]],
    ["CASH", "UPI", "CARD"].map((k) => [k, String(r.offline.byPayment[k]?.count || 0), rs(r.offline.byPayment[k]?.total || 0)]),
    y + 6
  );

  // ── By staff ──
  y = tableOpts(
    [["By Staff (who settled)", "Bills", "Amount"]],
    r.offline.byStaff.length ? r.offline.byStaff.map((s) => [s.name, String(s.count), rs(s.total)]) : [["—", "0", rs(0)]],
    y + 16
  );

  // ── Top items ──
  y = tableOpts(
    [["Top Items", "Qty", "Amount"]],
    r.offline.topItems.length ? r.offline.topItems.map((i) => [i.name, String(i.quantity), rs(i.amount)]) : [["—", "0", rs(0)]],
    y + 16
  );

  // ── Settled bills ──
  tableOpts(
    [["Bill", "Table", "Date & Time", "Payment", "Settled by", "Amount"]],
    r.offline.bills.length
      ? r.offline.bills.map((b) => [b.billNumber, b.tableName, fmtDT(b.settledAt), b.paymentMethod, b.settledBy || "—", rs(b.total)])
      : [["—", "—", "—", "—", "—", rs(0)]],
    y + 16
  );

  // ── Footer (page numbers) ──
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(...GREY);
    doc.text("Haldia Cloud Kitchen POS — Confidential", M, doc.internal.pageSize.getHeight() - 20);
    doc.text(`Page ${p} of ${pages}`, W - M, doc.internal.pageSize.getHeight() - 20, { align: "right" });
  }

  return doc;
};

export const reportFilename = (fromStr: string, toStr: string) =>
  `HCK-Sales-Report_${fromStr.slice(0, 10)}_to_${toStr.slice(0, 10)}.pdf`;

// Download the PDF locally.
export const downloadReportPdf = (r: ReportData, fromStr: string, toStr: string) => {
  buildReportPdf(r, fromStr, toStr).save(reportFilename(fromStr, toStr));
};

// Return the PDF as pure base64 (no data URI prefix) for emailing.
export const reportPdfBase64 = (r: ReportData, fromStr: string, toStr: string): string => {
  const uri = buildReportPdf(r, fromStr, toStr).output("datauristring");
  return uri.split(",")[1];
};
