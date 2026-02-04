import { MainLayout } from "@/components/layout/MainLayout";
import {
  Users,
  Calendar,
  UserPlus,
  DollarSign,
  Filter,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getApiWithToken, postApiWithToken } from "@/services/apiWrapper";
import { toast } from "sonner";

/* ========================= Dashboard ========================= */

const Dashboard = () => {
  /* ---------- ORG STATE ---------- */
  const [showOrgPopup, setShowOrgPopup] = useState(false);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [showCreateOrg, setShowCreateOrg] = useState(false);

  const [createOrgForm, setCreateOrgForm] = useState({
    name: "",
    code: "",
    timezone: "Asia/Kolkata",
    currency: "INR",
  });

  /* ---------- USER STATE ---------- */
  const [showUserPopup, setShowUserPopup] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [showCreateUser, setShowCreateUser] = useState(false);

  const [createUserForm, setCreateUserForm] = useState({
    email: "",
    password: "",
    roleIds: [] as string[],
  });

  const [roles, setRoles] = useState<any[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);

  /* ================= EFFECT ================= */

  useEffect(() => {
    const isSuperAdmin = localStorage.getItem("isSuperAdmin") === "true";
    if (isSuperAdmin) {
      setShowOrgPopup(true);
      fetchOrganizations();
    }
  }, []);

  /* ================= API ================= */

  const fetchOrganizations = async () => {
    const res = await getApiWithToken("/organizations");
    setOrganizations(res?.data || []);
  };

  const fetchUsers = async () => {
    const res = await getApiWithToken("/users");
    const list = res?.data?.items || [];
    setUsers(list);
    setShowUserPopup(true);
    setShowCreateUser(list.length === 0);
    fetchRoles();
  };

  const fetchRoles = async () => {
    try {
      setRolesLoading(true);
      const res = await getApiWithToken("/roles");
      setRoles(res?.data || []);
    } catch {
      toast.error("Failed to load roles");
    } finally {
      setRolesLoading(false);
    }
  };

  const switchOrganization = async (organizationId: string) => {
    const res = await postApiWithToken("/users/switch-org", { organizationId });

    if (!res?.success) {
      toast.error("Failed to switch organization");
      return;
    }

    localStorage.setItem("selectedOrganization", organizationId);
    setShowOrgPopup(false);
    toast.success("Organization switched");

    fetchUsers();
  };

  const handleCreateOrganization = async () => {
    const payload = {
      ...createOrgForm,
      adminUserId: localStorage.getItem("adminUserId"),
      adminRoleId: localStorage.getItem("adminRoleId"),
    };

    const res = await postApiWithToken("/organizations", payload);

    if (res?.success) {
      toast.success("Organization created");
      fetchOrganizations();
      setShowCreateOrg(false);
    } else {
      toast.error(res?.message || "Create organization failed");
    }
  };

  const handleCreateUser = async () => {
    if (
      !createUserForm.email ||
      !createUserForm.password ||
      createUserForm.roleIds.length === 0
    ) {
      toast.error("All fields are required");
      return;
    }

    const res = await postApiWithToken("/users/org-user", createUserForm);

    if (res?.success) {
      toast.success("User created");
      fetchUsers();
      setShowCreateUser(false);
    } else {
      toast.error(res?.message || "User creation failed");
    }
  };

  /* ================= UI ================= */

  return (
    <MainLayout title="Dashboard" breadcrumb={[{ label: "Home" }, { label: "Dashboard" }]}>
      {/* ================= ORG POPUP ================= */}
      <Dialog open={showOrgPopup}>
        <DialogContent
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Select Organization</DialogTitle>
          </DialogHeader>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowCreateOrg(true)}
          >
            + Create Organization
          </Button>

          <div className="space-y-3 mt-4">
            {organizations.map((org) => (
              <div
                key={org._id}
                className="border rounded px-4 py-3 cursor-pointer hover:bg-muted"
                onClick={() => switchOrganization(org._id)}
              >
                <p className="font-medium">{org.name}</p>
                <p className="text-sm text-muted-foreground">
                  {org.code} • {org.timezone}
                </p>
              </div>
            ))}
          </div>

          {showCreateOrg && (
            <div className="space-y-3 mt-4">
              <Input
                placeholder="Organization Name"
                value={createOrgForm.name}
                onChange={(e) =>
                  setCreateOrgForm({ ...createOrgForm, name: e.target.value })
                }
              />
              <Input
                placeholder="Code"
                value={createOrgForm.code}
                onChange={(e) =>
                  setCreateOrgForm({ ...createOrgForm, code: e.target.value })
                }
              />

              <Select
                value={createOrgForm.timezone}
                onValueChange={(v) =>
                  setCreateOrgForm({ ...createOrgForm, timezone: v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Timezone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Asia/Kolkata">India</SelectItem>
                  <SelectItem value="America/New_York">USA</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={createOrgForm.currency}
                onValueChange={(v) =>
                  setCreateOrgForm({ ...createOrgForm, currency: v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INR">INR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>

              <Button onClick={handleCreateOrganization}>
                Create Organization
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ================= USER POPUP ================= */}
      <Dialog open={showUserPopup}>
        <DialogContent
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Select / Create User</DialogTitle>
          </DialogHeader>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowCreateUser(true)}
          >
            + Create User
          </Button>

          <div className="space-y-3 mt-4">
            {users.map((u) => (
              <div
                key={u._id}
                className="border rounded px-4 py-3 cursor-pointer hover:bg-muted"
                onClick={() => setShowUserPopup(false)}
              >
                <p className="font-medium">{u.email}</p>
                <p className="text-sm text-muted-foreground">
                  {u.roles?.map((r: any) => r.name).join(", ")}
                </p>
              </div>
            ))}
          </div>

          {showCreateUser && (
            <div className="space-y-3 mt-4">
              <Input
                placeholder="Email"
                value={createUserForm.email}
                onChange={(e) =>
                  setCreateUserForm({ ...createUserForm, email: e.target.value })
                }
              />

              <Input
                type="password"
                placeholder="Password"
                value={createUserForm.password}
                onChange={(e) =>
                  setCreateUserForm({ ...createUserForm, password: e.target.value })
                }
              />

              {/* ✅ CORRECT SELECT */}
              <Select
                value={createUserForm.roleIds[0]}
                onValueChange={(value) =>
                  setCreateUserForm({
                    ...createUserForm,
                    roleIds: [value],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      rolesLoading ? "Loading roles..." : "Select Role"
                    }
                  />
                </SelectTrigger>

                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role._id} value={role._id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button onClick={handleCreateUser}>
                Create User
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Dashboard;
