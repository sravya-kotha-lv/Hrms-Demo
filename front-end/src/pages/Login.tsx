import { useNavigate } from "react-router-dom";

const Login = () => {
  const navigate = useNavigate();

  const handleLogin = () => {
    localStorage.setItem("token", "hrm-demo-token");
    navigate("/dashboard");
  };

  return (
    <div className="h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow w-96">
        <h2 className="text-2xl font-bold mb-6 text-center">HRMS Login</h2>
        <button
          onClick={handleLogin}
          className="w-full bg-blue-600 text-white py-2 rounded-lg"
        >
          Login
        </button>
      </div>
    </div>
  );
};

export default Login;
