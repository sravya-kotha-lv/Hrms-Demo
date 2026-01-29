import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import {
  getApiWithToken,
  postApiWithToken,
  putApiWithToken,
  deleteApiWithToken,
} from "@/services/apiWrapper";
import { DataTable, Column } from "@/components/ui/DataTable";

/* ================= TYPES ================= */

interface Designation {
  _id?: string;
  name: string;
  departmentId: string;
  status: "active" | "inactive";
}

const emptyDesignation: Designation = {
  name: "",
  departmentId: "",
  status: "active",
};

/* ================= COMPONENT ================= */

const Designations = () => {
  const [designations, setDesignations] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState<Designation>(emptyDesignation);

  /* ================= FETCH ================= */

  const fetchDesignations = async () => {
    const res = await getApiWithToken("/designations");
    if (res?.success) {
      setDesignations(res.data || []);
    } else {
      toast.error(res?.message || "Failed to load designations");
    }
  };

  const fetchDepartments = async () => {
    const res = await getApiWithToken("/departments");
    if (res?.success) {
      setDepartments(res.data || []);
    } else {
      toast.error("Failed to load departments");
    }
  };


  useEffect(() => {
    fetchDesignations();
    fetchDepartments();
  }, []);

  /* ================= DELETE ================= */

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this designation?")) return;

    const res = await deleteApiWithToken(`/designations/${id}`);
    if (res?.success) {
      toast.success("Designation deleted");
      fetchDesignations();
    } else {
      toast.error(res?.message || "Delete failed");
    }
  };

  /* ================= SUBMIT ================= */

  const handleSubmit = async () => {
    const payload = {
      name: form.name,
      departmentId: form.departmentId,
      status: form.status,
    };

    let res;

    if (isEdit && form._id) {
      res = await putApiWithToken(`/designations/${form._id}`, payload);
    } else {
      res = await postApiWithToken("/designations", payload);
    }

    if (res?.success) {
      toast.success(isEdit ? "Designation updated" : "Designation created");
      setOpen(false);
      setForm(emptyDesignation);
      fetchDesignations();
    } else {
      toast.error(res?.message || "Operation failed");
    }
  };

  const columns: Column<any>[] = [
    {
      header: "Name",
      accessor: "name",
      sortable: true,
    },
    {
      header: "Department",
      accessor: "departmentId",
      render: (row) => row.department?.name || "-",
    },
    {
      header: "Status",
      accessor: "status",
      render: (row) => (
        <Badge
          variant={row.status === "active" ? "default" : "secondary"}
          className="capitalize"
        >
          {row.status}
        </Badge>
      ),
    },
    {
      header: "Actions",
      accessor: "_id",
      render: (row) => (
        <div className="flex gap-3">
          <Pencil
            className="w-4 h-4 text-blue-600 cursor-pointer hover:scale-110"
            onClick={() => {
              setIsEdit(true);
              setForm({
                _id: row._id,
                name: row.name,
                departmentId: row.departmentId,
                status: row.status,
              });
              setOpen(true);
            }}
          />

          <Trash2
            className="w-4 h-4 text-red-600 cursor-pointer hover:scale-110"
            onClick={() => handleDelete(row._id)}
          />
        </div>
      ),
    },
  ];

  /* ================= UI ================= */

  return (
    <MainLayout
      title="Designations"
      breadcrumb={[{ label: "Home", href: "/" }, { label: "Designations" }]}
    >
      {/* ---------- Action Bar ---------- */}
      <div className="flex justify-end mb-6">
        <Button
          onClick={() => {
            setIsEdit(false);
            setForm(emptyDesignation);
            setOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Designation
        </Button>
      </div>


      {/* ---------- Table ---------- */}
      <DataTable
        columns={columns}
        data={designations}
        rowKey="_id"
        searchKey="name"
      />

      {/* ---------- Modal ---------- */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Edit Designation" : "Add Designation"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              placeholder="Designation Name"
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value })
              }
            />

            {/* Department Dropdown */}
            <Select
              value={form.departmentId}
              onValueChange={(v) =>
                setForm({ ...form, departmentId: v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d._id} value={d._id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status */}
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
              {isEdit ? "Update Designation" : "Create Designation"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Designations;
