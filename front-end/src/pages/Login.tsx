import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import { postApiWithoutToken } from "../services/apiWrapper";
const Login = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Basic validation
    if (!email || !password) {
      setError("Email and password are required");
      return;
    }

    try {
      const response: any = await postApiWithoutToken("/users/login", {email, password});

      console.log(response,"res");
      
      if (response.code === 200) {
        localStorage.setItem("userRoles", JSON.stringify(response.data));
        toast.success("Logged in successfully!");

        setTimeout(() => {
          const redirectPath = localStorage.getItem("postLoginRedirect");
          const activeRole = response.data.activeRole;

          // if (redirectPath) {
          //   localStorage.removeItem("postLoginRedirect");
          //   navigate(redirectPath);
          //   return;
          // }

          if (["super_admin"].includes(activeRole?.slug)) {
            navigate('/')
            return;
          }
          // navigate(`/${activeRole.homePage}`, { replace: true });
        }, 1200);
      } else {
        toast.warning(response.message || "Login failed");
      }
    } catch (error) {
      toast.error("An error occurred during login. Please try again.");
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
