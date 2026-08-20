import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuthStore } from "@/store/useAuthStore";
import { authApi } from "@/api/axios";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, ArrowLeft, Mail, ShieldCheck, CheckCircle2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PhoneInputWithFlag } from "@/components/ui/PhoneInputWithFlag";

type View = "login" | "signup" | "forgot";

const inputClass =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20";

const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground";

const AuthModal = () => {
  const { isAuthModalOpen, closeAuthModal, authMode, setToken, setUser } = useAuthStore();
  const navigate = useNavigate();

  const [view, setView] = useState<View>("login");
  const [signupStep, setSignupStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [signupToken, setSignupToken] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");

  const [resendIn, setResendIn] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset the whole flow whenever the modal opens (respecting the requested mode).
  useEffect(() => {
    if (isAuthModalOpen) {
      setView(authMode === "register" ? "signup" : "login");
      setSignupStep(1);
      setForgotSent(false);
      setOtp("");
      setSignupToken("");
      setName("");
      setMobile("");
      setPassword("");
      setShowPassword(false);
      setLoading(false);
    }
  }, [isAuthModalOpen, authMode]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startResendCooldown = () => {
    setResendIn(30);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendIn((s) => {
        if (s <= 1 && timerRef.current) {
          clearInterval(timerRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const errMsg = (e: any, fallback: string) =>
    e?.response?.data?.message || e?.response?.data?.errors?.[0]?.msg || fallback;

  const finishLogin = (data: any) => {
    const userData = data.user || data;
    setToken(data.token);
    setUser(userData);
    closeAuthModal();
    const role = userData.role;
    if (["admin", "Admin", "manager", "Manager", "waiter", "Waiter"].includes(role)) navigate("/admin");
    else navigate("/");
  };

  // ── Handlers ──────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authApi.login({ email: email.trim().toLowerCase(), password });
      toast.success("Welcome back! 🎉");
      finishLogin(res.data);
    } catch (err: any) {
      // No response = network/cache problem (e.g. stale bundle hitting a dead
      // backend), NOT a wrong-password error — say so clearly.
      if (!err?.response) toast.error("Can't reach the server. Clear the app cache and retry.");
      else toast.error(errMsg(err, "Invalid email or password"));
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.sendOtp({ email: email.trim() });
      toast.success("Verification code sent to your email 📩");
      setOtp("");
      setSignupStep(2);
      startResendCooldown();
    } catch (err) {
      toast.error(errMsg(err, "Could not send code. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendIn > 0 || loading) return;
    setLoading(true);
    try {
      await authApi.sendOtp({ email: email.trim() });
      toast.success("A new code is on its way 📩");
      setOtp("");
      startResendCooldown();
    } catch (err) {
      toast.error(errMsg(err, "Could not resend code."));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (code?: string) => {
    const value = (code ?? otp).trim();
    if (value.length !== 6) return;
    setLoading(true);
    try {
      const res = await authApi.verifyOtp({ email: email.trim(), otp: value });
      setSignupToken(res.data.signupToken);
      toast.success("Email verified ✅");
      setSignupStep(3);
    } catch (err) {
      toast.error(errMsg(err, "Invalid code. Please try again."));
      setOtp("");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const cleanMobile = mobile.replace(/[^0-9]/g, "");
      const res = await authApi.register({
        name: name.trim(),
        email: email.trim(),
        password,
        mobile: cleanMobile,
        signupToken,
      });
      toast.success("Account created! Welcome aboard 🎉");
      finishLogin(res.data);
    } catch (err) {
      toast.error(errMsg(err, "Could not create account."));
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.forgotPassword({ email: email.trim() });
      setForgotSent(true);
    } catch (err) {
      toast.error(errMsg(err, "Something went wrong. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  // ── Sub-views ─────────────────────────────────────────────
  const heading = () => {
    if (view === "login") return { title: "Welcome back", sub: "Sign in to access your orders and cart" };
    if (view === "forgot") return { title: "Forgot password", sub: "We'll email you a secure reset link" };
    if (signupStep === 1) return { title: "Create account", sub: "Enter your email to get started" };
    if (signupStep === 2) return { title: "Verify your email", sub: `Enter the 6-digit code sent to ${email}` };
    return { title: "Almost there", sub: "Just a few details to finish up" };
  };

  const stepDots = view === "signup" && (
    <div className="mb-6 flex items-center gap-2">
      {[1, 2, 3].map((s) => (
        <div
          key={s}
          className={`h-1.5 rounded-full transition-all ${
            s <= signupStep ? "w-8 bg-primary" : "w-4 bg-border"
          }`}
        />
      ))}
    </div>
  );

  const h = heading();

  return (
    <Dialog open={isAuthModalOpen} onOpenChange={closeAuthModal}>
      <DialogContent className="overflow-hidden border-none bg-transparent p-0 shadow-none sm:max-w-4xl">
        <DialogTitle className="sr-only">{h.title}</DialogTitle>
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative grid overflow-hidden rounded-3xl border border-border bg-card shadow-2xl md:grid-cols-2"
        >
          {/* Brand panel */}
          <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-primary via-orange-500 to-amber-500 p-10 text-white md:flex">
            <div
              className="pointer-events-none absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.4) 0, transparent 40%), radial-gradient(circle at 80% 60%, rgba(255,255,255,0.3) 0, transparent 35%)",
              }}
            />
            <div className="relative">
              <h1 className="text-3xl font-black leading-tight">Haldia Cloud Kitchen</h1>
              <p className="mt-1 text-sm font-medium text-white/80">& Restaurant</p>
            </div>
            <div className="relative space-y-4">
              <p className="text-2xl font-bold leading-snug">
                Crafted with passion,
                <br /> served with love.
              </p>
              <ul className="space-y-2 text-sm text-white/90">
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Fresh, home-style meals</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Live order tracking</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Secure & speedy checkout</li>
              </ul>
            </div>
          </div>

          {/* Form panel */}
          <div className="relative p-8 sm:p-10">
            <button
              onClick={closeAuthModal}
              className="absolute right-5 top-5 text-muted-foreground transition hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Back button for sub-steps */}
            {((view === "signup" && signupStep > 1) || view === "forgot") && (
              <button
                onClick={() => {
                  if (view === "forgot") setView("login");
                  else setSignupStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s));
                }}
                className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
            )}

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground">{h.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{h.sub}</p>
            </div>

            {stepDots}

            <AnimatePresence mode="wait">
              <motion.div
                key={`${view}-${signupStep}-${forgotSent}`}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18 }}
              >
                {/* ── LOGIN ── */}
                {view === "login" && (
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <label className={labelClass}>Email</label>
                      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="you@email.com" />
                    </div>
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <label className={labelClass + " mb-0"}>Password</label>
                        <button type="button" onClick={() => { setForgotSent(false); setView("forgot"); }} className="text-xs font-semibold text-primary hover:underline">
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <input type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputClass} pr-10`} placeholder="••••••••" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <SubmitButton loading={loading} label="Sign In" />
                    <SwitchLine text="Don't have an account?" action="Sign Up" onClick={() => setView("signup")} />
                  </form>
                )}

                {/* ── SIGNUP STEP 1: email ── */}
                {view === "signup" && signupStep === 1 && (
                  <form onSubmit={handleSendOtp} className="space-y-4">
                    <div>
                      <label className={labelClass}>Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputClass} pl-10`} placeholder="you@email.com" />
                      </div>
                    </div>
                    <SubmitButton loading={loading} label="Send verification code" />
                    <SwitchLine text="Already have an account?" action="Sign In" onClick={() => setView("login")} />
                  </form>
                )}

                {/* ── SIGNUP STEP 2: OTP ── */}
                {view === "signup" && signupStep === 2 && (
                  <div className="space-y-5">
                    <div className="flex justify-center">
                      <InputOTP
                        maxLength={6}
                        value={otp}
                        onChange={(v) => {
                          setOtp(v);
                          if (v.length === 6) handleVerifyOtp(v);
                        }}
                        disabled={loading}
                      >
                        <InputOTPGroup>
                          {[0, 1, 2, 3, 4, 5].map((i) => (
                            <InputOTPSlot key={i} index={i} className="h-12 w-11 text-lg" />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    <button
                      onClick={() => handleVerifyOtp()}
                      disabled={loading || otp.length !== 6}
                      className="w-full rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground shadow-lg transition-all hover:brightness-110 disabled:opacity-50"
                    >
                      {loading ? "Verifying..." : "Verify"}
                    </button>
                    <p className="text-center text-sm text-muted-foreground">
                      Didn't get it?{" "}
                      <button onClick={handleResendOtp} disabled={resendIn > 0 || loading} className="font-semibold text-primary hover:underline disabled:text-muted-foreground disabled:no-underline">
                        {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
                      </button>
                    </p>
                  </div>
                )}

                {/* ── SIGNUP STEP 3: details ── */}
                {view === "signup" && signupStep === 3 && (
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
                      <ShieldCheck className="h-4 w-4" /> {email} verified
                    </div>
                    <div>
                      <label className={labelClass}>Full Name</label>
                      <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="John Doe" />
                    </div>
                    <div>
                      <label className={labelClass}>Mobile Number</label>
                      <PhoneInputWithFlag value={mobile} onChange={(v) => setMobile(v || "")} placeholder="98765 43210" />
                    </div>
                    <div>
                      <label className={labelClass}>Password</label>
                      <div className="relative">
                        <input type={showPassword ? "text" : "password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputClass} pr-10`} placeholder="At least 6 characters" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <SubmitButton loading={loading} label="Create Account" />
                  </form>
                )}

                {/* ── FORGOT PASSWORD ── */}
                {view === "forgot" && !forgotSent && (
                  <form onSubmit={handleForgot} className="space-y-4">
                    <div>
                      <label className={labelClass}>Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputClass} pl-10`} placeholder="you@email.com" />
                      </div>
                    </div>
                    <SubmitButton loading={loading} label="Send reset link" />
                  </form>
                )}

                {view === "forgot" && forgotSent && (
                  <div className="space-y-4 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                      <Mail className="h-7 w-7 text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      If an account exists for <span className="font-semibold text-foreground">{email}</span>, we've sent a password reset link. Please check your inbox (and spam folder).
                    </p>
                    <button onClick={() => setView("login")} className="w-full rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground shadow-lg transition-all hover:brightness-110">
                      Back to sign in
                    </button>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

const SubmitButton = ({ loading, label }: { loading: boolean; label: string }) => (
  <motion.button
    type="submit"
    disabled={loading}
    whileTap={{ scale: 0.97 }}
    className="w-full rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground shadow-lg transition-all hover:brightness-110 disabled:opacity-50"
  >
    {loading ? "Please wait..." : label}
  </motion.button>
);

const SwitchLine = ({ text, action, onClick }: { text: string; action: string; onClick: () => void }) => (
  <p className="text-center text-sm text-muted-foreground">
    {text}{" "}
    <button type="button" onClick={onClick} className="font-semibold text-primary hover:underline">
      {action}
    </button>
  </p>
);

export default AuthModal;
