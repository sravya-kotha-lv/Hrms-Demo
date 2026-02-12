import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Bell, Settings, ChevronDown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { getApiWithToken, switchRole } from "@/services/apiWrapper";
import { clearAuth, setToken, updateActiveRoleInProfile } from "@/utils/auth";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface TopNavbarProps {
  title?: string;
  breadcrumb?: { label: string; href?: string }[];
}

export const TopNavbar = ({ title, breadcrumb }: TopNavbarProps) => {
  const navigate = useNavigate();
  const { profile, setProfile, setPermissions } = useAuth();
  const roles = useMemo(() => profile?.roles || [], [profile]);
  const activeRole = useMemo(() => profile?.activeRole || roles?.[0] || null, [profile, roles]);

  const handleSwitchRole = async (role: any) => {
    if (!role?._id) return;
    if (activeRole?._id === role._id) {
      toast.message("Role already active");
      return;
    }

    try {
      const res: any = await switchRole(role._id);
      if (!res?.success) {
        toast.error(res?.message || "Failed to switch role");
        return;
      }

      const newToken = res?.data?.token;
      if (newToken) {
        setToken(newToken);
      }

      const newActive = res?.data?.activeRole || role;
      updateActiveRoleInProfile(newActive);
      setProfile({ ...(profile || {}), activeRole: newActive });

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

      toast.success("Role switched");
      navigate("/", { replace: true });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to switch role");
    }
  };

  const handleLogout = () => {
    clearAuth();
    navigate("/login", { replace: true });
  };

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-40">
      {/* Left Section */}
      <div className="flex items-center gap-4">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav className="breadcrumb">
            {breadcrumb.map((item, index) => (
              <span key={index} className="flex items-center gap-2">
                {index > 0 && <span>/</span>}
                {item.href ? (
                  <a href={item.href} className="hover:text-primary transition-colors">
                    {item.label}
                  </a>
                ) : (
                  <span className="text-foreground font-medium">{item.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        {title && <h1 className="page-header">{title}</h1>}
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            className="pl-10 bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger className="relative p-2 rounded-lg hover:bg-muted transition-colors">
            <Bell className="w-5 h-5 text-muted-foreground" />
            <Badge className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0 text-xs bg-destructive">
              3
            </Badge>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
              <span className="font-medium">New leave request</span>
              <span className="text-xs text-muted-foreground">Sarah Wilson requested vacation leave</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
              <span className="font-medium">Payroll processed</span>
              <span className="text-xs text-muted-foreground">January payroll has been completed</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
              <span className="font-medium">New employee joined</span>
              <span className="text-xs text-muted-foreground">Mike Johnson joined the Engineering team</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Settings */}
        <button className="p-2 rounded-lg hover:bg-muted transition-colors">
          <Settings className="w-5 h-5 text-muted-foreground" />
        </button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 pl-4 border-l border-border">
            <Avatar className="w-9 h-9">
              <AvatarImage src={profile?.profileImage || undefined} />
              <AvatarFallback>
               {profile?.firstName && profile?.lastName
              ? `${profile.firstName[0]}${profile.lastName[0]}`
              : profile?.firstName?.[0] ||
                profile?.lastName?.[0] ||
                profile?.email?.[0] ||
                "U"}
              </AvatarFallback>
            </Avatar>
            <div className="text-left hidden lg:block">
              <p className="text-sm font-medium">
                {profile?.firstName || profile?.lastName
                  ? `${profile?.firstName || ""} ${profile?.lastName || ""}`.trim()
                  : profile?.email || "User"}
              </p>
              <p className="text-xs text-muted-foreground">
                {activeRole?.name || "Role"}
              </p>
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href="/profile">Profile</a>
            </DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuItem>Billing</DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                Switch role
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-56">
                {roles?.length ? (
                  roles.map((role: any) => (
                    <DropdownMenuItem
                      key={role._id}
                      onClick={() => handleSwitchRole(role)}
                    >
                      {role?.name || role?.slug || "Role"}
                      {activeRole?._id === role._id ? " (active)" : ""}
                    </DropdownMenuItem>
                  ))
                ) : (
                  <DropdownMenuItem disabled>No roles</DropdownMenuItem>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={handleLogout}>
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
