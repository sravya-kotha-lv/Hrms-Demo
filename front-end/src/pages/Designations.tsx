<<<<<<< Updated upstream
import { useEffect, useState } from "react";
=======
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
>>>>>>> Stashed changes
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
<<<<<<< Updated upstream
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
=======
>>>>>>> Stashed changes
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
<<<<<<< Updated upstream
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
=======
import { Search, Plus, Edit, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getApiWithToken, deleteApiWithToken } from "@/services/apiWrapper";

const Designations = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  // ✅ GET API
  const { data, isLoading, error } = useQuery({
    queryKey: ["designations"],
    queryFn: async () => {
      const res = await getApiWithToken("/designations");
      return res.data;
    },
  });

  // ✅ DELETE API
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await deleteApiWithToken(`/designations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["designations"] });
    },
  });

  if (isLoading) {
    return <MainLayout title="Designations">Loading...</MainLayout>;
  }

  if (error) {
    return <MainLayout title="Designations">Error loading data</MainLayout>;
  }

  const filteredData = data?.filter((des: any) =>
    des.name.toLowerCase().includes(search.toLowerCase())
  );
>>>>>>> Stashed changes

  return (
    <MainLayout
      title="Designations"
      breadcrumb={[{ label: "Home", href: "/" }, { label: "Designations" }]}
    >
<<<<<<< Updated upstream
      {/* ---------- Action Bar ---------- */}
      <div className="flex justify-end mb-6">
        <Button
          onClick={() => {
            setIsEdit(false);
            setForm(emptyDesignation);
            setOpen(true);
          }}
        >
=======
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

        <Button onClick={() => navigate("/designations/add")}>
>>>>>>> Stashed changes
          <Plus className="w-4 h-4 mr-2" />
          Add Designation
        </Button>
      </div>

<<<<<<< Updated upstream

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
=======
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Designation</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Role Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredData?.map((des: any) => (
              <TableRow key={des.id} className="hover:bg-gray-50">
                <TableCell className="font-medium">{des.name}</TableCell>
                <TableCell>{des.department}</TableCell>
                <TableCell>{des.role}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      des.status === "Active" ? "default" : "secondary"
                    }
                  >
                    {des.status}
                  </Badge>
                </TableCell>
                <TableCell className="flex gap-3">
                  <Edit
                    className="w-4 h-4 cursor-pointer text-blue-500 hover:text-blue-700"
                    onClick={() =>
                      navigate(`/designations/edit/${des.id}`)
                    }
                  />

                  <Trash2
                    className="w-4 h-4 cursor-pointer text-red-500 hover:text-red-700"
                    onClick={() => {
                      if (
                        window.confirm(
                          "Are you sure you want to delete this designation?"
                        )
                      ) {
                        deleteMutation.mutate(des.id);
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

export default Designations;
