<<<<<<< Updated upstream
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
              <Pencil
                className="w-4 h-4 text-blue-600 cursor-pointer hover:scale-110"
                onClick={() => {
                  setIsEdit(true);
                  setForm(role);
                  setOpen(true);
                }}
              />
              <Trash2
                className="w-4 h-4 text-red-600 cursor-pointer hover:scale-110"
                onClick={() => handleDelete(role)}
              />
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
=======
import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { getApiWithToken } from "@/services/apiWrapper";
import { Trash2 } from "lucide-react";

// const roleData = [
//   { id: 1, name: "Admin", description: "Full system access", status: "Active" },
//   { id: 2, name: "HR Manager", description: "Manage employees & payroll", status: "Active" },
//   { id: 3, name: "Employee", description: "Limited self access", status: "Active" },
// ];

const Roles = () => {
  const navigate = useNavigate();
   const queryClient = useQueryClient();

    // 🔹 Fetch Roles
  const { data, isLoading, error } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const res = await getApiWithToken(
        "/roles"
      );
      return res.data;
    },
  });

  // 🔹 Delete Role
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await axios.delete(`/roles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
  });

  if (isLoading) {
    return <MainLayout title="Roles">Loading roles...</MainLayout>;
  }

  if (error) {
    return <MainLayout title="Roles">Error loading roles</MainLayout>;
  }

  return (
   <MainLayout
      title="Role Management"
      breadcrumb={[{ label: "Home", href: "/" }, { label: "Roles" }]}
    >
      <div className="flex justify-end mb-6">
        <Button onClick={() => navigate("/roles/add")}>
          + Add Role
        </Button>
      </div>

      <div className="bg-card rounded-xl card-shadow overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.map((role: any) => (
              <TableRow key={role.id}>
                <TableCell className="font-medium">
                  {role.name}
                </TableCell>
                <TableCell>{role.description}</TableCell>
                <TableCell>
                  <Badge
                    variant={role.status === "Active" ? "default" : "secondary"}
                  >
                    {role.status}
                  </Badge>
                </TableCell>
                <TableCell className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      navigate(`/roles/edit/${role.id}`)
                    }
                  >
                    Edit
                  </Button>

                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() =>
                      deleteMutation.mutate(role.id)
                    }
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
>>>>>>> Stashed changes
    </MainLayout>
  );
};

export default Roles;
