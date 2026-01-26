import { useState } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  to: string;
  collapsed: boolean;
}

const NavItem = ({ icon, label, to, collapsed }: NavItemProps) => {
  const location = useLocation();
  const isActive = location.pathname === to || location.pathname.startsWith(to + "/");

  return (
    <NavLink to={to}>
      <motion.div
        className={cn(
          "nav-item",
          isActive && "nav-item-active"
        )}
        whileHover={{ x: 4 }}
        transition={{ duration: 0.2 }}
      >
        <span className="w-5 h-5 flex-shrink-0">{icon}</span>
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              className="whitespace-nowrap overflow-hidden"
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    </NavLink>
  );
};

const menuItems = [
  { icon: <Home size={20} />, label: "Home", to: "/" },
  { icon: <LayoutDashboard size={20} />, label: "Dashboard", to: "/dashboard" },
  { icon: <Users size={20} />, label: "Employees", to: "/employees" },
  { icon: <Calendar size={20} />, label: "Attendance", to: "/attendance" },
  { icon: <FolderKanban size={20} />, label: "Leave", to: "/leave" },
  { icon: <DollarSign size={20} />, label: "Payroll", to: "/payroll" },
  { icon: <TrendingUp size={20} />, label: "Performance", to: "/performance" },
  { icon: <FileText size={20} />, label: "Reports", to: "/reports" },
  { icon: <Inbox size={20} />, label: "Inbox", to: "/inbox" },
  { icon: <Building2 size={20} />, label: "Organization", to: "/organization" },
];

const bottomItems = [
  { icon: <HelpCircle size={20} />, label: "Support", to: "/support" },
  { icon: <Settings size={20} />, label: "Settings", to: "/settings" },
];

export const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();   // 👈 add this

  const handleLogout = () => {
    localStorage.clear();           // remove token/user
    sessionStorage.clear();
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
      <nav className="flex-1 py-4 px-3 overflow-y-auto">
        <div className="space-y-1">
          {menuItems.map((item) => (
            <NavItem key={item.to} {...item} collapsed={collapsed} />
          ))}
        </div>
      </nav>

      {/* Bottom Section */}
      <div className="border-t border-white/10 py-4 px-3">
        <div className="space-y-1">
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

        </div>

        {/* User Profile */}
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-2">
            <Avatar className="w-10 h-10 border-2 border-white/30">
              <AvatarImage src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop" />
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
                  <p className="text-white font-medium text-sm truncate">John Doe</p>
                  <p className="text-white/60 text-xs truncate">HR Manager</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.aside>
  );
};
