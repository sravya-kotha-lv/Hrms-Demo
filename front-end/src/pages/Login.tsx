import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import { getApiWithToken, postApiWithoutToken } from "@/services/apiWrapper";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, Clock3, Users2, CalendarCheck2, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { InlineLoader } from "@/components/ui/loaders";

const slides = [
  {
    title: "One Workspace For Your Entire Team",
    description:
      "Upanaya HRMS unifies employee data, attendance, leaves, approvals, and documentation in one reliable system.",
    metric: "42% faster HR operations"
  },
  {
    title: "Faster Attendance and Shift Operations",
    description:
      "Track check-in and check-out, shifts, week offs, holidays, and corrections with complete visibility.",
    metric: "99.9% attendance traceability"
  },
  {
    title: "Smarter Leave and Approval Controls",
    description:
      "Automate leave balances, approval flows, and role-based actions so requests move quickly and correctly.",
    metric: "3x faster request approvals"
  },
  {
    title: "Reliable Insights For Managers",
    description:
      "Use dashboards, attendance matrix, and timesheet views to monitor performance and team health daily.",
    metric: "Single-view team visibility"
  },
  {
    title: "Built For Scale and Governance",
    description:
      "Permission-aware modules and organization-level controls help run HR operations securely across teams.",
    metric: "Enterprise-ready controls"
  }
];

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setProfile, setPermissions, loadProfile } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const searchParams = new URLSearchParams(location.search);
  const sessionExpired = searchParams.get("reason") === "session_expired";

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % slides.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Email and password are required");
      return;
    }

    try {
      setSubmitting(true);
      const response: any = await postApiWithoutToken("/users/login", { email, password });
      if (response.code === 200) {
        const { roles, activeRole } = response.data;
        const resolvedActiveRole = activeRole || roles?.[0] || null;

        setProfile({
          ...response.data,
          activeRole: resolvedActiveRole
        });

        const isSuperAdmin =
          resolvedActiveRole?.slug === "superadmin" ||
          roles?.some((role: any) => role.slug === "superadmin");

        try {
          const [permRes] = await Promise.all([
            getApiWithToken("/users/me/permissions"),
            loadProfile()
          ]);
          if (permRes?.success) {
            setPermissions(permRes.data || []);
          } else {
            setPermissions([]);
          }
        } catch {
          setPermissions([]);
        }
        toast.success("Logged in successfully!");

        if (isSuperAdmin) {
          localStorage.setItem("isSuperAdmin", "true");
          localStorage.setItem("adminUserId", response.data.userId);
          localStorage.setItem("adminRoleId", response.data.roles[0]._id);
          navigate("/dashboard", { replace: true });
        } else {
          navigate("/", { replace: true });
        }
      } else {
        toast.warning(response.message || "Login failed");
      }
    } catch {
      toast.error("Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-slate-950">
      <section className="hidden lg:flex relative overflow-hidden bg-gradient-to-br from-blue-800 via-blue-700 to-cyan-700 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(255,255,255,0.22),transparent_25%),radial-gradient(circle_at_85%_85%,rgba(125,211,252,0.25),transparent_35%)]" />
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white/20 blur-2xl" />
        <div className="absolute -bottom-28 -right-20 h-96 w-96 rounded-full bg-cyan-200/20 blur-3xl" />

        <div className="relative z-10 w-full p-14 flex flex-col">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-blue-100/90">Upanaya HRMS Platform</p>
            <h1 className="mt-5 text-4xl font-semibold leading-tight max-w-[18ch]">
              Human resources, reimagined for real operations
            </h1>
            <div className="mt-6 grid grid-cols-2 gap-3 max-w-lg">
              <div className="rounded-xl bg-white/10 border border-white/20 p-3">
                <p className="text-xs text-blue-100">Attendance Engine</p>
                <p className="font-semibold mt-1 flex items-center gap-2"><Clock3 className="w-4 h-4" /> Real-time</p>
              </div>
              <div className="rounded-xl bg-white/10 border border-white/20 p-3">
                <p className="text-xs text-blue-100">Access Governance</p>
                <p className="font-semibold mt-1 flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Role-based</p>
              </div>
            </div>
          </div>

          <div className="mt-auto">
            <div className="rounded-2xl border border-white/25 bg-white/10 backdrop-blur p-7 min-h-[250px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={slideIndex}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.35 }}
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-blue-100/85 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5" /> Why teams choose us
                  </p>
                  <p className="text-2xl font-semibold mt-2">{slides[slideIndex].title}</p>
                  <p className="mt-3 text-blue-50/95 leading-relaxed">{slides[slideIndex].description}</p>
                  <div className="mt-4 inline-flex rounded-full border border-cyan-200/35 bg-cyan-100/10 px-3 py-1 text-sm font-medium">
                    {slides[slideIndex].metric}
                  </div>
                </motion.div>
              </AnimatePresence>

              <div className="mt-6 flex items-center gap-2">
                {slides.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSlideIndex(idx)}
                    className={`h-2.5 rounded-full transition-all ${
                      idx === slideIndex ? "w-8 bg-white" : "w-2.5 bg-white/45 hover:bg-white/80"
                    }`}
                    aria-label={`Go to slide ${idx + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center p-5 sm:p-8 bg-slate-100">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl p-6 sm:p-8">
          <div className="mb-6">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-blue-600">Welcome Back</p>
            <h2 className="text-2xl font-semibold mt-2 text-slate-900">Sign in to Upanaya HRMS</h2>
            <p className="text-sm text-slate-500 mt-2">Manage attendance, leaves, approvals, and people operations in one place.</p>
          </div>

          {error && (
            <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </p>
          )}
          {!error && sessionExpired && (
            <p className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              Your session has expired. Please login again.
            </p>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              type="email"
              placeholder="Work email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11"
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11"
            />
            <Button type="submit" className="w-full h-11" disabled={submitting}>
              {submitting ? <InlineLoader label="Signing in..." className="text-white" /> : "Login"}
            </Button>
          </form>

          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border bg-slate-50 py-2 px-1">
              <Users2 className="w-4 h-4 mx-auto text-slate-600" />
              <p className="text-[11px] text-slate-500 mt-1">Employees</p>
            </div>
            <div className="rounded-lg border bg-slate-50 py-2 px-1">
              <CalendarCheck2 className="w-4 h-4 mx-auto text-slate-600" />
              <p className="text-[11px] text-slate-500 mt-1">Attendance</p>
            </div>
            <div className="rounded-lg border bg-slate-50 py-2 px-1">
              <ShieldCheck className="w-4 h-4 mx-auto text-slate-600" />
              <p className="text-[11px] text-slate-500 mt-1">Secure</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Login;
