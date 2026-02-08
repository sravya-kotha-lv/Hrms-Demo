import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DataTable, Column } from "@/components/ui/DataTable";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import PermissionGate from "@/components/PermissionGate";
import {
  getApiWithToken,
  postApiWithToken,
  putApiWithToken,
  deleteApiWithToken,
} from "@/services/apiWrapper";

/* ================= TYPES ================= */

interface Role {
  _id?: string;
  name: string;
  slug: string;
  permissionIds: string[];
  isSystemRole: boolean;
}

const emptyRole: Role = {
  name: "",
  slug: "",
  permissionIds: [],
  isSystemRole: false,
};

/* ================= COMPONENT ================= */

const Roles = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [open, setOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState<Role>(emptyRole);

  /* ================= FETCH ================= */

  const fetchRoles = async () => {
    const res = await getApiWithToken("/roles");

    if (res?.code === 200) {
      setRoles(res.data || []);
    } else {
      toast.error(res?.message || "Failed to load roles");
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  /* ================= DELETE ================= */

  const handleDelete = async (role: Role) => {
    if (role.isSystemRole) {
      toast.warning("System roles cannot be deleted");
      return;
    }

    if (!window.confirm("Delete this role?")) return;

    const res = await deleteApiWithToken(`/roles/${role._id}`);

    if (res?.code === 200) {
      toast.success("Role deleted");
      fetchRoles();
    } else {
      toast.error(res?.message || "Delete failed");
    }
  };

  /* ================= SUBMIT ================= */

  const handleSubmit = async () => {
    if (!form.name || !form.slug) {
      toast.error("Name and slug are required");
      return;
    }

    let res;

    if (isEdit && form._id) {
      res = await putApiWithToken(`/roles/${form._id}`, {
        name: form.name,
        slug: form.slug,
        permissionIds: form.permissionIds,
      });
    } else {
      res = await postApiWithToken("/roles", {
        name: form.name,
        slug: form.slug,
        permissionIds: form.permissionIds,
      });
    }

    if (res?.code === 200) {
      toast.success(isEdit ? "Role updated" : "Role created");
      setOpen(false);
      setForm(emptyRole);
      fetchRoles();
    } else {
      toast.error(res?.message || "Operation failed");
    }
  };

  /* ================= DATATABLE COLUMNS ================= */

  const columns: Column<Role>[] = [
    {
      header: "Name",
      accessor: "name",
      sortable: true,
    },
    {
      header: "Slug",
      accessor: "slug",
      sortable: true,
    },
    {
      header: "Permissions",
      accessor: "permissionIds",
      render: (role) => role.permissionIds.length,
    },
    {
      header: "Type",
      accessor: "isSystemRole",
      render: (role) => (
        <Badge variant={role.isSystemRole ? "secondary" : "default"}>
          {role.isSystemRole ? "System" : "Custom"}
        </Badge>
      ),
    },
    {
      header: "Actions",
      accessor: "_id",
      render: (role) => (
        <div className="flex gap-3">
          {!role.isSystemRole && (
            <>
              <PermissionGate permissions={["ROLE_UPDATE"]}>
                <Pencil
                  className="w-4 h-4 text-blue-600 cursor-pointer hover:scale-110"
                  onClick={() => {
                    setIsEdit(true);
                    setForm(role);
                    setOpen(true);
                  }}
                />
              </PermissionGate>
              <PermissionGate permissions={["ROLE_DELETE"]}>
                <Trash2
                  className="w-4 h-4 text-red-600 cursor-pointer hover:scale-110"
                  onClick={() => handleDelete(role)}
                />
              </PermissionGate>
            </>
          )}
        </div>
      ),
    },
  ];

  /* ================= UI ================= */

  return (
    <MainLayout
      title="Roles"
      breadcrumb={[{ label: "Home", href: "/" }, { label: "Roles" }]}
    >
      {/* Action Bar */}
      <div className="flex justify-end mb-6">
        <PermissionGate permissions={["ROLE_CREATE"]}>
          <Button
            onClick={() => {
              setIsEdit(false);
              setForm(emptyRole);
              setOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Role
          </Button>
        </PermissionGate>
      </div>

      {/* DataTable */}
      <DataTable
        columns={columns}
        data={roles}
        rowKey="_id"
        searchKey="name"
      />

      {/* Add / Edit Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Edit Role" : "Add Role"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              placeholder="Role Name"
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value })
              }
            />

            <Input
              placeholder="Slug (eg: hr, manager)"
              value={form.slug}
              onChange={(e) =>
                setForm({ ...form, slug: e.target.value })
              }
            />

            <Button onClick={handleSubmit} className="w-full">
              {isEdit ? "Update Role" : "Create Role"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Roles;
