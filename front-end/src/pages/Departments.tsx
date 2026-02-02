<<<<<<< Updated upstream
import { useEffect, useState } from "react";
=======
import { useState } from "react";
>>>>>>> Stashed changes
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
<<<<<<< Updated upstream
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
  getApiWithToken,
  postApiWithToken,
  putApiWithToken,
  deleteApiWithToken,
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
=======
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiWithToken, deleteApiWithToken } from "@/services/apiWrapper";


const Departments = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");


  // 🔹 GET Departments
  const { data, isLoading, error } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const res = await getApiWithToken(
        "/departments"
      );
      return res.data;
    },
  });

  const filteredData = data?.filter((dept) =>
  dept.name.toLowerCase().includes(search.toLowerCase())
);

  // 🔹 DELETE Department
  const deleteMutation = useMutation({
  mutationFn: async (id) => {
    await deleteApiWithToken(`/departments/${id}`);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["departments"] });
  },
});

  if (isLoading) {
    return <MainLayout title="Departments">Loading...</MainLayout>;
  }

  if (error) {
    return <MainLayout title="Departments">Error loading data</MainLayout>;
  }
>>>>>>> Stashed changes

  return (
    <MainLayout
      title="Departments"
      breadcrumb={[{ label: "Home", href: "/" }, { label: "Departments" }]}
    >
      {/* Action Bar */}
<<<<<<< Updated upstream
      <div className="flex justify-end mb-6">
        <Button
          onClick={() => {
            setIsEdit(false);
            setForm(emptyDept);
            setOpen(true);
          }}
        >
=======
      <div className="flex justify-between items-center mb-6">
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search department..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Button onClick={() => navigate("/departments/add")}>
>>>>>>> Stashed changes
          <Plus className="w-4 h-4 mr-2" />
          Add Department
        </Button>
      </div>

<<<<<<< Updated upstream
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
=======
      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Department</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Head</TableHead>
              <TableHead>Employees</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredData?.map((dept) => (
              <TableRow key={dept.id} className="hover:bg-gray-50">
                <TableCell className="font-medium">
                  {dept.name}
                </TableCell>
                <TableCell>{dept.code}</TableCell>
                <TableCell>{dept.head}</TableCell>
                <TableCell>{dept.employees}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      dept.status === "Active"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {dept.status}
                  </Badge>
                </TableCell>
                <TableCell className="flex gap-3">
                  <Edit
                    className="w-4 h-4 cursor-pointer text-blue-500 hover:text-blue-700"
                    onClick={() => navigate(`/departments/edit/${dept.id}`)}
                  />

                  <Trash2
                    className="w-4 h-4 cursor-pointer text-red-500 hover:text-red-700"
                    onClick={() => {
                      if (window.confirm("Are you sure you want to delete this department?")) {
                        deleteMutation.mutate(dept.id);
                      }
                    }}
                  />
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

export default Departments;
