import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataTable, Column } from "@/components/ui/DataTable";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteApiWithToken,
  getApiWithToken,
  postApiWithToken,
  putApiWithToken,
} from "@/services/apiWrapper";

/* ================= TYPES ================= */

interface Department {
  _id?: string;
  name: string;
  code: string;
  managerId?: string;
  status: "active" | "inactive";
}

const emptyDept: Department = {
  name: "",
  code: "",
  managerId: "",
  status: "active",
};

/* ================= COMPONENT ================= */

const Departments = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [open, setOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState<Department>(emptyDept);

  /* ================= FETCH ================= */

  const fetchDepartments = async () => {
    const response = await getApiWithToken("/departments");

    if (response?.code === 200) {
      setDepartments(response.data || []);
    } else {
      toast.error(response?.message || "Failed to load departments");
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  /* ================= DELETE ================= */

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this department?")) return;

    const res = await deleteApiWithToken(`/departments/${id}`);

    if (res?.code === 200) {
      toast.success("Department deleted");
      fetchDepartments();
    } else {
      toast.error(res?.message || "Delete failed");
    }
  };

  /* ================= SUBMIT ================= */

  const handleSubmit = async () => {
    const payload = {
      name: form.name,
      managerId: form.managerId,
      status: form.status,
    };

    let res;

    if (isEdit && form._id) {
      // ❌ Do NOT send code on update
      res = await putApiWithToken(`/departments/${form._id}`, payload);
    } else {
      // ✅ Send code only while creating
      res = await postApiWithToken("/departments", {
        ...payload,
        code: form.code,
      });
    }

    if (res?.success) {
      toast.success(isEdit ? "Department updated" : "Department created");
      setOpen(false);
      setForm(emptyDept);
      fetchDepartments();
    } else {
      toast.error(res?.message || "Operation failed");
    }
  };

  /* ================= DATATABLE COLUMNS ================= */

  const columns: Column<Department>[] = [
    {
      header: "Name",
      accessor: "name",
      sortable: true,
    },
    {
      header: "Code",
      accessor: "code",
      sortable: true,
    },
    {
      header: "Status",
      accessor: "status",
      render: (dept) => (
        <Badge
          variant={dept.status === "active" ? "default" : "secondary"}
          className="capitalize"
        >
          {dept.status}
        </Badge>
      ),
    },
    {
      header: "Actions",
      accessor: "_id",
      render: (dept) => (
        <div className="flex gap-3">
          <Pencil
            className="w-4 h-4 text-blue-600 cursor-pointer hover:scale-110"
            onClick={() => {
              setIsEdit(true);
              setForm(dept);
              setOpen(true);
            }}
          />
          <Trash2
            className="w-4 h-4 text-red-600 cursor-pointer hover:scale-110"
            onClick={() => handleDelete(dept._id!)}
          />
        </div>
      ),
    },
  ];

  /* ================= UI ================= */

  return (
    <MainLayout
      title="Departments"
      breadcrumb={[{ label: "Home", href: "/" }, { label: "Departments" }]}
    >
      {/* Action Bar */}
      <div className="flex justify-end mb-6">
        <Button
          onClick={() => {
            setIsEdit(false);
            setForm(emptyDept);
            setOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Department
        </Button>
      </div>

      {/* DataTable */}
      <DataTable
        columns={columns}
        data={departments}
        rowKey="_id"
        searchKey="name"
      />

      {/* Add / Edit Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Edit Department" : "Add Department"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              placeholder="Department Name"
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value })
              }
            />

            {!isEdit && (
              <Input
                placeholder="Department Code"
                value={form.code}
                onChange={(e) =>
                  setForm({ ...form, code: e.target.value })
                }
              />
            )}

            <Input
              placeholder="Manager ID (optional)"
              value={form.managerId}
              onChange={(e) =>
                setForm({ ...form, managerId: e.target.value })
              }
            />

            <Select
              value={form.status}
              onValueChange={(v: "active" | "inactive") =>
                setForm({ ...form, status: v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={handleSubmit} className="w-full">
              {isEdit ? "Update Department" : "Create Department"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Departments;
