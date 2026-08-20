import { useEffect, useRef } from "react";
import { posApi } from "@/api/axios";
import { toast } from "sonner";

const INTERVAL_MS = 100000; // ~100 seconds

type Pending = {
  pendingBills: number;
  pendingTables: number;
  occupiedTables: number;
  dirtyTables: number;
  openKots: number;
};

// Every ~100s, float up a colour-coded reminder for any unfinished POS work:
//   amber = bills awaiting settlement · red = tables still busy · blue = open KOTs
const PendingReminders = () => {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const { data } = (await posApi.getPending()) as { data: Pending };
        if (cancelled || !data) return;

        if (data.pendingBills > 0) {
          toast(`💰 ${data.pendingBills} bill${data.pendingBills > 1 ? "s" : ""} awaiting settlement`, {
            description: "Open Settlement to record payment.",
            duration: 9000,
            style: { background: "#f59e0b", color: "#fff", border: "none", fontWeight: 600 },
          });
        }
        if (data.pendingTables > 0) {
          toast(`🍽️ ${data.pendingTables} table${data.pendingTables > 1 ? "s" : ""} still busy`, {
            description: `${data.occupiedTables} occupied · ${data.dirtyTables} dirty`,
            duration: 9000,
            style: { background: "#ef4444", color: "#fff", border: "none", fontWeight: 600 },
          });
        }
        if (data.openKots > 0) {
          toast(`🍳 ${data.openKots} open KOT${data.openKots > 1 ? "s" : ""} not billed`, {
            description: "Pending kitchen orders in the KOT terminal.",
            duration: 9000,
            style: { background: "#3b82f6", color: "#fff", border: "none", fontWeight: 600 },
          });
        }
      } catch {
        // ignore — reminders are best-effort
      }
    };

    timerRef.current = setInterval(check, INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return null;
};

export default PendingReminders;
