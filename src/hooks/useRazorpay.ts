import { useState } from "react";
import { paymentApi } from "@/api/axios";
import { toast } from "sonner";

const RAZORPAY_KEY = "rzp_test_SGtvYHFtIRGg0G";

const loadRazorpayScript = (): Promise<boolean> =>
  new Promise((resolve) => {
    if ((window as any).Razorpay) { resolve(true); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

interface PayNowOptions {
  items: Array<{ product: string; quantity: number; variant?: string; price: number }>;
  deliveryAddress: any;
  deliveryFee?: number;
  finalAmount: number;
  userName?: string;
  userEmail?: string;
  onSuccess: (paymentDetails: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void;
  onFailure?: () => void;
}

export const useRazorpay = () => {
  const [loading, setLoading] = useState(false);

  const payNow = async ({ items, deliveryAddress, deliveryFee, finalAmount, userName, userEmail, onSuccess, onFailure }: PayNowOptions) => {
    setLoading(true);
    try {
      // Step 1: Create Razorpay order (NO DB order yet)
      const payRes = await paymentApi.createOrder({
        amount: Math.round(finalAmount),
        items,
        deliveryAddress,
        deliveryFee,
      });
      const razorpayOrderId = payRes.data.razorpayOrderId || payRes.data.id || payRes.data.orderId;
      const amountInPaise = payRes.data.amount || Math.round(finalAmount * 100);

      // Step 2: Load Razorpay script
      const loaded = await loadRazorpayScript();
      if (!loaded) { toast.error("Failed to load payment gateway"); setLoading(false); onFailure?.(); return; }

      // Step 3: Open Razorpay checkout modal
      const options = {
        key: RAZORPAY_KEY,
        amount: amountInPaise,
        currency: "INR",
        name: "Food Delivery App",
        description: "Food Order Payment",
        order_id: razorpayOrderId,
        handler: (response: any) => {
          setLoading(false);
          onSuccess({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
        },
        modal: {
          ondismiss: () => { setLoading(false); onFailure?.(); },
        },
        prefill: { name: userName || "", email: userEmail || "" },
        theme: { color: "#FC8019" },
      };

      new (window as any).Razorpay(options).open();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Payment initialization failed");
      setLoading(false);
      onFailure?.();
    }
  };

  return { payNow, loading };
};
