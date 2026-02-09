import { ReactNode } from "react";
import { hasAnyPermission } from "@/utils/auth";

interface PermissionGateProps {
  permissions: string[];
  children: ReactNode;
  fallback?: ReactNode;
}

const PermissionGate = ({ permissions, children, fallback = null }: PermissionGateProps) => {
  if (!hasAnyPermission(permissions)) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
};

export default PermissionGate;
