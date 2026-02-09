import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import { getApiWithToken, postApiWithoutToken } from "@/services/apiWrapper";
import { useAuth } from "@/context/AuthContext";
const Login = () => {
  const navigate = useNavigate();
  const { setProfile, setPermissions, loadProfile } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();
  setError("");

  if (!email || !password) {
    setError("Email and password are required");
    return;
  }

  try {
    const response: any = await postApiWithoutToken(
      "/users/login",
      { email, password }
    );

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
        const permRes = await getApiWithToken("/users/me/permissions");
        if (permRes?.success) {
          setPermissions(permRes.data || []);
        } else {
          setPermissions([]);
        }
      } catch {
        setPermissions([]);
      }

      await loadProfile();

      toast.success("Logged in successfully!");

      setTimeout(() => {
        if (isSuperAdmin) {
          localStorage.setItem("isSuperAdmin", "true");
          localStorage.setItem("adminUserId", response.data.userId);
          localStorage.setItem("adminRoleId", response.data.roles[0]._id);
          navigate("/dashboard", { replace: true });
        } else {
          navigate("/", { replace: true });
        }
      }, 800);
    } else {
      toast.warning(response.message || "Login failed");
    }
  } catch (err) {
    toast.error("Login failed");
  }
};
  
  return (
    <div className="h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow w-96">
        <h2 className="text-2xl font-bold mb-6 text-center">HRMS Login</h2>

        {error && (
          <p className="mb-4 text-sm text-red-600 text-center">{error}</p>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <button
          onClick={handleLogin}
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
