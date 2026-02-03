import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { useNavigate } from "react-router-dom";

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

  /* ================= UI ================= */

  return (
    <MainLayout
      title="Designations"
      breadcrumb={[{ label: "Home", href: "/" }, { label: "Designations" }]}
    >
      {/* ---------- Action Bar ---------- */}
      <div className="flex justify-between items-center mb-6">
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search designation..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

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

      {/* ---------- Table ---------- */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Designation</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {designations?.map((des: any) => (
              <TableRow key={des._id} className="hover:bg-gray-50">
                <TableCell className="font-medium">{des.name}</TableCell>
                <TableCell>{des.departmentId}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      des.status === "active" ? "default" : "secondary"
                    }
                  >
                    {des.status}
                  </Badge>
                </TableCell>
                <TableCell className="flex gap-3">
                  <Pencil
                    className="w-4 h-4 cursor-pointer text-blue-500 hover:text-blue-700"
                    onClick={() => {
                      setIsEdit(true);
                      setForm(des);
                      setOpen(true);
                    }}
                  />

                  <Trash2
                    className="w-4 h-4 cursor-pointer text-red-500 hover:text-red-700"
                    onClick={() => handleDelete(des._id)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </MainLayout>
  );
};

export default Designations;
