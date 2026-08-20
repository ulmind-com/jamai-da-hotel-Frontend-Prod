import { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { authApi } from "@/api/axios";
import { useAuthStore } from "@/store/useAuthStore";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Eye, EyeOff, Lock, CheckCircle2, AlertTriangle } from "lucide-react";

const inputClass =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20";

// Defined at module scope so it isn't recreated on every render
// (recreating it remounts the inputs and drops focus on each keystroke).
const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted px-4">
    <motion.div
      initial={{ scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-2xl sm:p-10"
    >
      {children}
    </motion.div>
  </div>
);

const ResetPasswordPage = () => {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();
  const { openAuthModal } = useAuthStore();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword({ token, password });
      setDone(true);
      toast.success("Password reset successfully 🎉");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "This reset link is invalid or has expired.");
    } finally {
      setLoading(false);
    }
  };

  // Missing / invalid token
  if (!token) {
    return (
      <Card>
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Invalid reset link</h1>
          <p className="text-sm text-muted-foreground">
            This link is missing or malformed. Please request a new password reset.
          </p>
          <Link to="/" className="inline-block w-full rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground shadow-lg transition-all hover:brightness-110">
            Go home
          </Link>
        </div>
      </Card>
    );
  }

  // Success state
  if (done) {
    return (
      <Card>
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Password updated</h1>
          <p className="text-sm text-muted-foreground">
            Your password has been reset. You can now sign in with your new password.
          </p>
          <button
            onClick={() => {
              navigate("/");
              openAuthModal("login");
            }}
            className="w-full rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground shadow-lg transition-all hover:brightness-110"
          >
            Sign in
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Lock className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Set a new password</h1>
        <p className="mt-1 text-sm text-muted-foreground">Choose a strong password for your account.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">New Password</label>
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClass} pr-10`}
              placeholder="At least 6 characters"
            />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Confirm Password</label>
          <input
            type={show ? "text" : "password"}
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputClass}
            placeholder="Re-enter password"
          />
        </div>
        <motion.button
          type="submit"
          disabled={loading}
          whileTap={{ scale: 0.97 }}
          className="w-full rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground shadow-lg transition-all hover:brightness-110 disabled:opacity-50"
        >
          {loading ? "Please wait..." : "Reset Password"}
        </motion.button>
      </form>
    </Card>
  );
};

export default ResetPasswordPage;
