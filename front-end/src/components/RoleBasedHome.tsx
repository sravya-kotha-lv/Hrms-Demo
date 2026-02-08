import { Navigate } from "react-router-dom";
import { hasAnyPermission } from "@/utils/auth";

const RoleBasedHome = () => {
  const token = sessionStorage.getItem("token");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const isAdmin = hasAnyPermission([
    "EMP_VIEW",
    "ROLE_VIEW",
    "PERMISSION_VIEW",
    "LEAVE_VIEW_ALL",
    "TIMESHEET_VIEW_ALL",
    "ORG_VIEW"
  ]);

  return <Navigate to={isAdmin ? "/dashboard" : "/employee-dashboard"} replace />;
};

export default RoleBasedHome;
