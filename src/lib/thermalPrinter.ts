// ── Bluetooth thermal printer (ESC/POS, 58mm) ───────────────────────────────
// Drives a BLE receipt printer (HOIN / generic 58mm) straight from the browser
// via Web Bluetooth. Works on Chrome/Edge — Android and desktop. Safari/iOS has
// no Web Bluetooth, so callers should fall back to browser printing there.

const LINE_WIDTH = 32; // characters per line on 58mm paper at Font A

// Cheap BLE printers expose one of a handful of vendor services. We ask for all
// of them up front (optionalServices) and use whichever the device actually has.
const PRINTER_SERVICES: { service: string; characteristics: string[] }[] = [
  { service: "000018f0-0000-1000-8000-00805f9b34fb", characteristics: ["00002af1-0000-1000-8000-00805f9b34fb"] },
  { service: "0000ff00-0000-1000-8000-00805f9b34fb", characteristics: ["0000ff02-0000-1000-8000-00805f9b34fb"] },
  { service: "0000ffe0-0000-1000-8000-00805f9b34fb", characteristics: ["0000ffe1-0000-1000-8000-00805f9b34fb"] },
  { service: "0000ae30-0000-1000-8000-00805f9b34fb", characteristics: ["0000ae01-0000-1000-8000-00805f9b34fb"] },
  { service: "6e400001-b5a3-f393-e0a9-e50e24dcca9e", characteristics: ["6e400002-b5a3-f393-e0a9-e50e24dcca9e"] },
];

const ALL_SERVICES = PRINTER_SERVICES.map((p) => p.service);
const DEVICE_NAME_KEY = "pos.printer.name";

let device: any = null;
let characteristic: any = null;

export const isBluetoothSupported = () =>
  typeof navigator !== "undefined" && !!(navigator as any).bluetooth;

export const isPrinterConnected = () => !!characteristic && !!device?.gatt?.connected;

export const getSavedPrinterName = () =>
  (typeof localStorage !== "undefined" && localStorage.getItem(DEVICE_NAME_KEY)) || "";

// Walk the device's services and grab the first writable characteristic.
const resolveCharacteristic = async (server: any) => {
  for (const entry of PRINTER_SERVICES) {
    try {
      const service = await server.getPrimaryService(entry.service);
      for (const uuid of entry.characteristics) {
        try {
          const char = await service.getCharacteristic(uuid);
          if (char.properties.write || char.properties.writeWithoutResponse) return char;
        } catch {
          /* characteristic not on this service — keep looking */
        }
      }
      // Vendor firmware sometimes renumbers the characteristic; take any writable one.
      const chars = await service.getCharacteristics();
      const writable = chars.find(
        (c: any) => c.properties.write || c.properties.writeWithoutResponse
      );
      if (writable) return writable;
    } catch {
      /* service not on this device — try the next */
    }
  }
  return null;
};

// Opens the browser's device picker and connects. Must be called from a user
// gesture (click), otherwise Chrome rejects the request.
export const connectPrinter = async (): Promise<string> => {
  if (!isBluetoothSupported()) {
    throw new Error(
      "This browser can't talk to Bluetooth printers. Use Chrome on Android or a laptop."
    );
  }

  device = await (navigator as any).bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: ALL_SERVICES,
  });

  device.addEventListener("gattserverdisconnected", () => {
    characteristic = null;
  });

  const server = await device.gatt.connect();
  characteristic = await resolveCharacteristic(server);

  if (!characteristic) {
    try { device.gatt.disconnect(); } catch { /* already gone */ }
    device = null;
    throw new Error(
      "Connected, but this device doesn't look like a Bluetooth (BLE) printer."
    );
  }

  const name = device.name || "Printer";
  localStorage.setItem(DEVICE_NAME_KEY, name);
  return name;
};

export const disconnectPrinter = () => {
  try { device?.gatt?.disconnect(); } catch { /* already gone */ }
  device = null;
  characteristic = null;
  localStorage.removeItem(DEVICE_NAME_KEY);
};

// Re-open the link to the printer we already paired with this session.
const ensureConnected = async () => {
  if (isPrinterConnected()) return;
  if (!device) throw new Error("No printer connected. Tap 'Connect Printer' first.");
  const server = await device.gatt.connect();
  characteristic = await resolveCharacteristic(server);
  if (!characteristic) throw new Error("Lost the printer's print channel. Reconnect it.");
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// BLE caps a single write at the negotiated MTU, so long receipts go out in
// small chunks with a breather between them (these printers drop data if flooded).
const writeChunked = async (bytes: Uint8Array) => {
  const CHUNK = 100;
  const useNoResponse = !!characteristic.properties?.writeWithoutResponse;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const chunk = bytes.slice(i, i + CHUNK);
    if (useNoResponse) await characteristic.writeValueWithoutResponse(chunk);
    else await characteristic.writeValue(chunk);
    await sleep(20);
  }
};

// ── ESC/POS byte builder ────────────────────────────────────────────────────
// Printers default to the CP437 code page, so anything outside ASCII prints as
// garbage. Rupee signs become "Rs." and other non-ASCII is dropped.
const toAscii = (text: string) =>
  text
    .replace(/₹/g, "Rs.")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E\n]/g, "");

class EscPos {
  private parts: number[] = [];

  private push(...bytes: number[]) { this.parts.push(...bytes); return this; }

  init() { return this.push(0x1b, 0x40); }
  align(mode: "left" | "center" | "right") {
    return this.push(0x1b, 0x61, mode === "center" ? 1 : mode === "right" ? 2 : 0);
  }
  bold(on: boolean) { return this.push(0x1b, 0x45, on ? 1 : 0); }
  /** 0 = normal, 1 = double height, 2 = double width + height */
  size(scale: 0 | 1 | 2) {
    const n = scale === 2 ? 0x11 : scale === 1 ? 0x01 : 0x00;
    return this.push(0x1d, 0x21, n);
  }
  text(value: string) {
    const encoded = new TextEncoder().encode(toAscii(value));
    return this.push(...Array.from(encoded));
  }
  line(value = "") { return this.text(value + "\n"); }
  divider(char = "-") { return this.line(char.repeat(LINE_WIDTH)); }

  /** Left-aligned label with a right-aligned amount, padded to the paper width. */
  row(left: string, right: string) {
    const l = toAscii(left);
    const r = toAscii(right);
    const space = Math.max(1, LINE_WIDTH - l.length - r.length);
    if (l.length + r.length + 1 > LINE_WIDTH) {
      // Too long for one line — wrap the label above the amount.
      return this.line(l).line(r.padStart(LINE_WIDTH));
    }
    return this.line(l + " ".repeat(space) + r);
  }

  feed(lines = 3) { return this.push(0x1b, 0x64, lines); }
  cut() { return this.push(0x1d, 0x56, 0x00); }

  build() { return new Uint8Array(this.parts); }
}

// ── Receipt ─────────────────────────────────────────────────────────────────
export type ReceiptItem = { name: string; quantity: number; price: number };

export type ReceiptData = {
  restaurantName: string;
  address?: string;
  phone?: string;
  gstIn?: string;
  billNumber: string;
  dateTime: string;
  customerName?: string;
  customerPhone?: string;
  paymentMethod: string;
  items: ReceiptItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  discountLabel?: string;
  total: number;
};

const money = (n: number) => (n || 0).toFixed(2);

export const buildReceipt = (data: ReceiptData): Uint8Array => {
  const p = new EscPos();

  p.init().align("center").bold(true).size(1);
  p.line(data.restaurantName);
  p.size(0).bold(false);
  if (data.address) p.line(data.address);
  if (data.phone) p.line("Ph: " + data.phone);
  if (data.gstIn) p.line("GSTIN: " + data.gstIn);

  p.align("left").divider();
  p.line("Bill : " + data.billNumber);
  p.line("Date : " + data.dateTime);
  p.line("Cust : " + (data.customerName || "Walk-in"));
  if (data.customerPhone) p.line("Phone: " + data.customerPhone);
  p.line("Pay  : " + data.paymentMethod);
  p.divider();

  p.row("ITEM", "AMOUNT");
  p.divider();
  for (const item of data.items) {
    p.line(item.name);
    p.row(`  ${item.quantity} x ${money(item.price)}`, money(item.quantity * item.price));
  }
  p.divider();

  p.row("Subtotal", money(data.subtotal));
  if (data.taxAmount > 0) p.row("GST", money(data.taxAmount));
  if (data.discountAmount > 0) p.row(`Discount${data.discountLabel ? ` (${data.discountLabel})` : ""}`, "-" + money(data.discountAmount));
  p.divider("=");
  p.bold(true).size(1);
  p.row("TOTAL", "Rs." + money(data.total));
  p.size(0).bold(false);
  p.divider("=");

  p.align("center");
  p.line("Thank you! Visit again");
  p.feed(3).cut();

  return p.build();
};

/** Connect (if needed) and send a receipt to the paired Bluetooth printer. */
export const printReceipt = async (data: ReceiptData) => {
  await ensureConnected();
  await writeChunked(buildReceipt(data));
};
