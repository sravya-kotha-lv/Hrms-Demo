import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  LayoutDashboard,
  Users,
  Inbox,
  FolderKanban,
  Building2,
  HelpCircle,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Calendar,
  DollarSign,
  TrendingUp,
  FileText,
  UserCircle,
  Shield,
  Building,
  Briefcase,
  CalendarDays,
  CalendarOff,
  ClipboardCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/context/AuthContext";
import { clearAuth } from "@/utils/auth";

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  to: string;
  collapsed: boolean;
   children?: {
    icon: React.ReactNode;
    label: string;
    to: string;
    permissions?: string[];
  }[];
  permissions?: string[];
}

interface MenuItem {
  icon: React.ReactNode;
  label: string;
  to: string;
  permissions?: string[];
  children?: {
    icon: React.ReactNode;
    label: string;
    to: string;
    permissions?: string[];
  }[];
}


const NavItem = ({ icon, label, to, collapsed ,children}: NavItemProps) => {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const hasChildren = children && children.length > 0;
  const isActive = location.pathname === to || location.pathname.startsWith(to + "/");

  // Auto-open menu when route matches, so refresh keeps highlight/expanded state
  useEffect(() => {
    if (hasChildren && isActive) {
      setOpen(true);
    }
  }, [hasChildren, isActive]);

  return (
   <div>
      <div
        className={cn(
          "nav-item flex items-center justify-between cursor-pointer",
          isActive && "nav-item-active"
        )}
        onClick={() => hasChildren && setOpen(!open)}
      >
        <NavLink
          to={hasChildren ? "#" : to}
          className="flex items-center gap-3 w-full"
        >
          <span className="w-5 h-5">{icon}</span>
          {!collapsed && <span>{label}</span>}
        </NavLink>

        {!collapsed && hasChildren && (
          <ChevronRight
            size={16}
            className={`transition-transform ${
              open ? "rotate-90" : ""
            }`}
          />
        )}
      </div>

      {/* CHILDREN */}
      {!collapsed && open && hasChildren && (
        <div className="ml-8 mt-1 space-y-1">
          {children.map((child) => (
            <NavLink key={child.to} to={child.to}>
              <div
                className={cn(
                  "nav-item text-sm",
                  location.pathname === child.to &&
                    "nav-item-active"
                )}
              >
                {child.icon}
                <span>{child.label}</span>
              </div>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
};

const menuItems = (dashboardPath: string): MenuItem[] => [
  // { icon: <Home size={20} />, label: "Home", to: "/" },
  { icon: <LayoutDashboard size={20} />, label: "Dashboard", to: dashboardPath },
  {
    icon: <Users size={20} />,
    label: "Employees",
    to:"/employees",
    permissions: ["EMP_VIEW"],
    children: [
      { icon: <Users size={18} />, label: "Employee", to: "/employees", permissions: ["EMP_VIEW"] },
      { icon: <Briefcase size={18} />, label: "Attendance", to: "/attendance", permissions: ["ATTENDANCE_VIEW_ALL", "ATTENDANCE_VIEW_SELF"] },
      { icon: <ClipboardCheck size={18} />, label: "Timesheets", to: "/timesheets", permissions: ["TIMESHEET_VIEW_SELF", "TIMESHEET_VIEW_ALL"] },
      { icon: <Briefcase size={18} />, label: "Leave", to: "/leave", permissions: ["LEAVE_VIEW_SELF", "LEAVE_VIEW_ALL", "LEAVE_APPLY"] },
      { icon: <ClipboardCheck size={18} />, label: "Approvals", to: "/approvals", permissions: ["LEAVE_ACTION", "ATTENDANCE_MANAGE"] },
      { icon: <CalendarDays size={20} />, label: "Holidays", to: "/holidays", permissions: ["HOLIDAY_VIEW"] },
    ],
  },
   {
    icon: <Building size={20} />,
    label: "Organization",
    to: "/organization",
    permissions: ["ORG_VIEW", "ROLE_VIEW", "PERMISSION_VIEW", "DEPT_VIEW", "DESIG_VIEW", "LEAVE_TYPE_VIEW"],
    children: [
      { icon: <Briefcase size={18} />, label: "Roles", to: "/roles", permissions: ["ROLE_VIEW"] },
      { icon: <Shield size={18} />, label: "Departments", to: "/departments", permissions: ["DEPT_VIEW"] },
      { icon: <Briefcase size={18} />, label: "Designations", to: "/designations", permissions: ["DESIG_VIEW"] },
      { icon: <ClipboardCheck size={18} />, label: "Leave Types", to: "/leave-types", permissions: ["LEAVE_TYPE_VIEW"] },
      { icon: <ClipboardCheck size={18} />, label: "Approval Flows", to: "/approval-flows", permissions: ["APPROVAL_FLOW_VIEW"] },
      { icon: <CalendarDays size={18} />, label: "Shifts", to: "/shifts", permissions: ["SHIFT_VIEW"] },
      { icon: <Settings size={18} />, label: "Settings", to: "/organization/settings", permissions: ["ORG_SETTINGS_VIEW"] },
      { icon: <Building2 size={18} />, label: "payroll", to: "/payroll" },
      { icon: <Shield size={18} />, label: "Permissions", to: "/permissions", permissions: ["PERMISSION_VIEW"] },
    ],
  },
  { icon: <CalendarOff size={20} />, label: "Week Offs", to: "/week-offs", permissions: ["WEEK_OFF_VIEW"] },
  // { icon: <DollarSign size={20} />, label: "Payroll", to: "/payroll" },
  // { icon: <TrendingUp size={20} />, label: "Performance", to: "/performance" },
  { icon: <FileText size={20} />, label: "Documentation", to: "/documentation", permissions: ["EMP_CREATE", "EMP_UPDATE"] },
  // { icon: <Inbox size={20} />, label: "Inbox", to: "/inbox" },
  // { icon: <Building2 size={20} />, label: "Organization", to: "/organization" },
  // { icon: <Shield size={20} />, label: "Roles", to: "/roles" },
  // { icon: <Shield size={20} />, label: "Permissions", to: "/permissions" },
 
];

// const bottomItems = [
//   { icon: <HelpCircle size={20} />, label: "Support", to: "/support" },
//   { icon: <Settings size={20} />, label: "Settings", to: "/settings" },
// ];

export const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();   // 👈 add this
  const { profile, hasAnyPermission, isSuperAdmin } = useAuth();

  const isEmployeeRole = profile?.activeRole?.slug === "employee";
  const dashboardPath = isEmployeeRole
    ? "/employee-dashboard"
    : hasAnyPermission([
        "EMP_VIEW",
        "ROLE_VIEW",
        "PERMISSION_VIEW",
        "LEAVE_VIEW_ALL",
        "TIMESHEET_VIEW_ALL",
        "ORG_VIEW"
      ])
      ? "/dashboard"
      : "/employee-dashboard";

  const effectiveDashboardPath = isSuperAdmin ? "/superadmin" : dashboardPath;
  const allowedPathsForEmployee = new Set([
    "/",
    "/employee-dashboard",
    "/attendance",
    "/leave",
    "/timesheets",
    "/holidays"
  ]);

  const filteredMenuItems: MenuItem[] = menuItems(effectiveDashboardPath)
    .map((item) => {
      if (item.children) {
        const filteredChildren = item.children.filter((child) => {
          if (isEmployeeRole) {
            return allowedPathsForEmployee.has(child.to);
          }
          return !child.permissions || hasAnyPermission(child.permissions);
        });
        if (filteredChildren.length === 0) return null;
        return {
          ...item,
          permissions: isEmployeeRole ? undefined : item.permissions,
          children: filteredChildren
        };
      }
      if (isEmployeeRole && !allowedPathsForEmployee.has(item.to)) {
        return null;
      }
      return isEmployeeRole
        ? { ...item, permissions: undefined }
        : item;
    })
    .filter(
      (item): item is MenuItem =>
        Boolean(item) &&
        (!item.permissions || hasAnyPermission(item.permissions))
    );

  const handleLogout = () => {
    clearAuth();
    navigate("/login", { replace: true });
  };

  return (
    <motion.aside
      className="sidebar-gradient h-screen fixed left-0 top-0 z-50 flex flex-col"
      initial={false}
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      {/* Logo Section */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* <img src="/logo.png" alt="Logo" className="w-6 h-6" /> */}
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
              
              <UserCircle className="w-6 h-6 text-primary" />
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-white font-bold text-xl"
                >
                  HRMS
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto scroll-smooth custom-scroll">
        <div className="space-y-1">
          {filteredMenuItems.map((item) => (
            <NavItem key={item.to} {...item} collapsed={collapsed} />
          ))}
        </div>
      </nav>
       
      {/* Bottom Section */}
      <div className="border-t border-white/10 py-4 px-3">
        {/* <div className="space-y-1">
          {bottomItems.map((item) => (
            <NavItem key={item.to} {...item} collapsed={collapsed} />
          ))}
          <motion.button
      onClick={handleLogout}   // 👈 add this
      className="nav-item w-full text-white/80 hover:text-white"
      whileHover={{ x: 4 }}
      transition={{ duration: 0.2 }}
    >
      <LogOut size={20} />
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            Logout
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>

        </div> */}

        {/* User Profile */}
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-2">
            <Avatar className="w-10 h-10 border-2 border-white/30">
              <AvatarImage src={profile?.profileImage || undefined} />
              <AvatarFallback className="bg-white/20 text-white">JD</AvatarFallback>
            </Avatar>
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="overflow-hidden"
                >
                  <p className="text-white font-medium text-sm truncate">
                    {profile?.firstName || profile?.lastName
                      ? `${profile?.firstName || ""} ${profile?.lastName || ""}`.trim()
                      : profile?.email || "User"}
                  </p>
                  <p className="text-white/60 text-xs truncate">
                    {profile?.activeRole?.name || "Role"}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.aside>
  );
};
