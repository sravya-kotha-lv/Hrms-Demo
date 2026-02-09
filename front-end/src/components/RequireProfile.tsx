import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getApiWithToken } from "@/services/apiWrapper";
import { hasAnyPermission } from "@/utils/auth";

interface RequireProfileProps {
  children: JSX.Element;
}

const RequireProfile = ({ children }: RequireProfileProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      const isSuperAdmin = localStorage.getItem("isSuperAdmin") === "true";
      if (isSuperAdmin) {
        setLoading(false);
        return;
      }

      let isManager = false;
      try {
        const profileRaw = localStorage.getItem("userProfile");
        const profile = profileRaw ? JSON.parse(profileRaw) : null;
        const roles = profile?.roles || [];
        isManager = roles.some((r: any) => r?.slug === "manager");
      } catch {
        isManager = false;
      }

      const isAdminByRole = hasAnyPermission([
        "EMP_VIEW",
        "ROLE_VIEW",
        "PERMISSION_VIEW",
        "LEAVE_VIEW_ALL",
        "TIMESHEET_VIEW_ALL",
        "ORG_VIEW"
      ]);

      try {
        const res = await getApiWithToken("/employees/me");
        if (res?.success && res?.data) {
          if (res.data.profileCompleted === false) {
            if (location.pathname !== "/complete-profile") {
              navigate("/complete-profile", { replace: true });
              return;
            }
          }
        } else if ((!isAdminByRole || isManager) && location.pathname !== "/complete-profile") {
          navigate("/complete-profile", { replace: true });
          return;
        }
      } catch {
        if ((!isAdminByRole || isManager) && location.pathname !== "/complete-profile") {
          navigate("/complete-profile", { replace: true });
          return;
        }
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [location.pathname, navigate]);

  if (loading) return null;

  return children;
};

export default RequireProfile;
