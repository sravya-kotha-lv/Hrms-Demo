import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteApiWithToken,
  getApiWithToken,
  postApiWithToken,
  putApiWithToken
} from "@/services/apiWrapper";
import { useAuth } from "@/context/AuthContext";

type ProjectStatus = "active" | "on_hold" | "completed" | "cancelled";
type PaidToValue = string;

interface EmployeeOption {
  _id: string;
  firstName?: string;
  lastName?: string;
  employeeCode?: string;
}

interface PaidToEmployee {
  _id?: string;
  firstName?: string;
  lastName?: string;
  employeeCode?: string;
}

interface Project {
  _id?: string;
  projectName: string;
  logoUrl?: string;
  clientName: string;
  clientCompany: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  actualAmount: number;
  discountedAmount: number;
  paidAmount: number;
  paidTo: PaidToValue | PaidToEmployee | null;
  pendingAmount?: number;
  status: ProjectStatus;
  notes?: string;
}

const emptyProject: Project = {
  projectName: "",
  logoUrl: "",
  clientName: "",
  clientCompany: "",
  clientEmail: "",
  clientPhone: "",
  clientAddress: "",
  actualAmount: 0,
  discountedAmount: 0,
  paidAmount: 0,
  paidTo: "none",
  pendingAmount: 0,
  status: "active",
  notes: ""
};

const formatINR = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    Number(value || 0)
  );

const getPaidToId = (value: Project["paidTo"]) => {
  if (!value) return "none";
  if (typeof value === "string") return value || "none";
  return value._id || "none";
};

const Projects = () => {
  const { hasAnyPermission } = useAuth();
  const canView = hasAnyPermission(["PROJECT_VIEW", "PROJECT_MANAGE"]);
  const canManage = hasAnyPermission(["PROJECT_MANAGE"]);

  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [open, setOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState<Project>(emptyProject);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const pendingAmount = useMemo(() => {
    const discounted = Number(form.discountedAmount || 0);
    const paid = Number(form.paidAmount || 0);
    return Math.max(0, discounted - paid);
  }, [form.discountedAmount, form.paidAmount]);
  const paidToId = useMemo(() => getPaidToId(form.paidTo), [form.paidTo]);

  const fetchProjects = async () => {
    const response = await getApiWithToken("/projects", null, {
      requiredPermissions: ["PROJECT_VIEW", "PROJECT_MANAGE"]
    });
    if (response?.skipped) {
      setProjects([]);
      return;
    }
    if (response?.success) {
      setProjects(response.data || []);
      return;
    }
    toast.error(response?.message || "Failed to load projects");
  };

  const fetchEmployees = async () => {
    const response = await getApiWithToken("/projects/employees", null, {
      requiredPermissions: ["PROJECT_VIEW", "PROJECT_MANAGE"]
    });
    if (response?.success) {
      setEmployees(response.data || []);
      return;
    }
    setEmployees([]);
  };

  useEffect(() => {
    fetchProjects();
    fetchEmployees();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this project?")) return;
    const res = await deleteApiWithToken(`/projects/${id}`);
    if (res?.success) {
      toast.success("Project deleted");
      fetchProjects();
      return;
    }
    toast.error(res?.message || "Delete failed");
  };

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};

    if (!form.projectName.trim()) nextErrors.projectName = "Project name is required";
    if (!form.clientName.trim()) nextErrors.clientName = "Client name is required";
    if (!form.clientCompany.trim()) nextErrors.clientCompany = "Client company is required";
    if (Number(form.actualAmount) < 0) nextErrors.actualAmount = "Actual amount must be 0 or more";
    if (Number(form.discountedAmount) < 0) {
      nextErrors.discountedAmount = "Discounted amount must be 0 or more";
    }
    if (Number(form.paidAmount) < 0) nextErrors.paidAmount = "Paid amount must be 0 or more";
    if (Number(form.discountedAmount) > Number(form.actualAmount)) {
      nextErrors.discountedAmount = "Discounted amount cannot exceed actual amount";
    }
    if (Number(form.paidAmount) > Number(form.discountedAmount)) {
      nextErrors.paidAmount = "Paid amount cannot exceed discounted amount";
    }
    if (Number(form.paidAmount) > 0 && paidToId === "none") {
      nextErrors.paidTo = "Select employee in Paid To when paid amount is greater than 0";
    }
    if (form.clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.clientEmail)) {
      nextErrors.clientEmail = "Enter a valid email";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error("Please fix form validation errors");
      return;
    }

    const payload = {
      projectName: form.projectName,
      logoUrl: form.logoUrl || "",
      clientName: form.clientName,
      clientCompany: form.clientCompany,
      clientEmail: form.clientEmail || "",
      clientPhone: form.clientPhone || "",
      clientAddress: form.clientAddress || "",
      actualAmount: Number(form.actualAmount || 0),
      discountedAmount: Number(form.discountedAmount || 0),
      paidAmount: Number(form.paidAmount || 0),
      paidTo: paidToId !== "none" ? paidToId : null,
      status: form.status,
      notes: form.notes || ""
    };

    const res =
      isEdit && form._id
        ? await putApiWithToken(`/projects/${form._id}`, payload, null, {
            requiredPermissions: ["PROJECT_MANAGE"]
          })
        : await postApiWithToken("/projects", payload, null, {
            requiredPermissions: ["PROJECT_MANAGE"]
          });

    if (res?.skipped) return;
    if (res?.success) {
      toast.success(isEdit ? "Project updated" : "Project created");
      setOpen(false);
      setForm(emptyProject);
      setErrors({});
      fetchProjects();
      return;
    }
    toast.error(res?.message || "Operation failed");
  };

  const columns: Column<Project>[] = [
    { header: "Project", accessor: "projectName", sortable: true },
    {
      header: "Client",
      accessor: "clientName",
      render: (row) => (
        <div>
          <div className="font-medium">{row.clientName}</div>
          <div className="text-xs text-muted-foreground">{row.clientCompany}</div>
        </div>
      )
    },
    {
      header: "Amounts",
      accessor: "actualAmount",
      render: (row) => (
        <div className="text-xs leading-5">
          <div>Actual: {formatINR(row.actualAmount)}</div>
          <div>Discounted: {formatINR(row.discountedAmount)}</div>
          <div>Paid: {formatINR(row.paidAmount)}</div>
          <div className="font-medium">Pending: {formatINR(row.pendingAmount || 0)}</div>
          <div>
            Paid To:{" "}
            {typeof row.paidTo === "object" && row.paidTo
              ? `${(row.paidTo as any).firstName || ""} ${(row.paidTo as any).lastName || ""}`.trim() ||
                (row.paidTo as any).employeeCode ||
                "-"
              : "-"}
          </div>
        </div>
      )
    },
    {
      header: "Status",
      accessor: "status",
      render: (row) => (
        <Badge variant={row.status === "active" ? "default" : "secondary"} className="capitalize">
          {row.status.replace("_", " ")}
        </Badge>
      )
    },
    {
      header: "Actions",
      accessor: "_id",
      render: (row) => (
        <div className="flex gap-3">
          {canManage && (
            <Pencil
              className="w-4 h-4 text-blue-600 cursor-pointer hover:scale-110"
              onClick={() => {
                setIsEdit(true);
                setErrors({});
                setForm({
                  ...row,
                  paidTo:
                    typeof row.paidTo === "object" && row.paidTo
                      ? (row.paidTo as any)._id
                      : (row.paidTo as string) || "none",
                  logoUrl: row.logoUrl || "",
                  clientEmail: row.clientEmail || "",
                  clientPhone: row.clientPhone || "",
                  clientAddress: row.clientAddress || "",
                  notes: row.notes || ""
                });
                setOpen(true);
              }}
            />
          )}
          {canManage && row._id && (
            <Trash2
              className="w-4 h-4 text-red-600 cursor-pointer hover:scale-110"
              onClick={() => handleDelete(row._id!)}
            />
          )}
        </div>
      )
    }
  ];

  const stats = useMemo(() => {
    return projects.reduce(
      (acc, row) => {
        acc.totalProjects += 1;
        acc.totalActual += Number(row.actualAmount || 0);
        acc.totalDiscounted += Number(row.discountedAmount || 0);
        acc.totalPaid += Number(row.paidAmount || 0);
        acc.totalPending += Number(row.pendingAmount || 0);
        if (row.status === "active") acc.active += 1;
        if (row.status === "on_hold") acc.onHold += 1;
        if (row.status === "completed") acc.completed += 1;
        if (row.status === "cancelled") acc.cancelled += 1;
        return acc;
      },
      {
        totalProjects: 0,
        active: 0,
        onHold: 0,
        completed: 0,
        cancelled: 0,
        totalActual: 0,
        totalDiscounted: 0,
        totalPaid: 0,
        totalPending: 0
      }
    );
  }, [projects]);

  return (
    <MainLayout
      title="Business Development"
      breadcrumb={[{ label: "Home", href: "/" }, { label: "Business Development" }]}
    >
      {!canView && (
        <div className="bg-card rounded-xl card-shadow p-6 text-sm text-muted-foreground">
          You do not have permission to view projects.
        </div>
      )}

      {canView && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="stat-card">
            <p className="text-sm text-muted-foreground mb-1">Total Projects</p>
            <p className="text-2xl font-bold">{stats.totalProjects}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground mb-1">Total Discounted</p>
            <p className="text-2xl font-bold">{formatINR(stats.totalDiscounted)}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground mb-1">Total Paid</p>
            <p className="text-2xl font-bold">{formatINR(stats.totalPaid)}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground mb-1">Total Pending</p>
            <p className="text-2xl font-bold">{formatINR(stats.totalPending)}</p>
          </div>
        </div>
      )}

      {canView && (
        <div className="flex justify-end mb-6">
          {canManage && (
            <Button
              onClick={() => {
                setIsEdit(false);
                setForm(emptyProject);
                setErrors({});
                setOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Project
            </Button>
          )}
        </div>
      )}

      {canView && (
        <DataTable
          columns={canManage ? columns : columns.filter((c) => c.header !== "Actions")}
          data={projects}
          rowKey="_id"
          searchKey="projectName"
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit Project" : "Add Project"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              placeholder="Project Name * (e.g. ERP Revamp - Q2)"
              value={form.projectName}
              onChange={(e) => {
                setForm({ ...form, projectName: e.target.value });
                if (errors.projectName) setErrors({ ...errors, projectName: "" });
              }}
            />
            {errors.projectName && <p className="text-xs text-red-600">{errors.projectName}</p>}
            <Input
              placeholder="Logo URL (optional) e.g. https://..."
              value={form.logoUrl}
              onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
            />
            <Input
              placeholder="Client Name * (e.g. Rahul Sharma)"
              value={form.clientName}
              onChange={(e) => {
                setForm({ ...form, clientName: e.target.value });
                if (errors.clientName) setErrors({ ...errors, clientName: "" });
              }}
            />
            {errors.clientName && <p className="text-xs text-red-600">{errors.clientName}</p>}
            <Input
              placeholder="Client Company * (e.g. Acme Pvt Ltd)"
              value={form.clientCompany}
              onChange={(e) => {
                setForm({ ...form, clientCompany: e.target.value });
                if (errors.clientCompany) setErrors({ ...errors, clientCompany: "" });
              }}
            />
            {errors.clientCompany && <p className="text-xs text-red-600">{errors.clientCompany}</p>}
            <Input
              placeholder="Client Email (e.g. client@company.com)"
              value={form.clientEmail}
              onChange={(e) => {
                setForm({ ...form, clientEmail: e.target.value });
                if (errors.clientEmail) setErrors({ ...errors, clientEmail: "" });
              }}
            />
            {errors.clientEmail && <p className="text-xs text-red-600">{errors.clientEmail}</p>}
            <Input
              placeholder="Client Phone (e.g. +91 98765 43210)"
              value={form.clientPhone}
              onChange={(e) => setForm({ ...form, clientPhone: e.target.value })}
            />
            <div className="md:col-span-2 rounded-md border border-dashed p-3">
              <p className="text-sm font-medium">Financial Details</p>
              <p className="text-xs text-muted-foreground">
                Enter all amounts in INR. `Pending Amount` is auto-calculated.
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium">Actual Amount *</p>
              <p className="text-[11px] text-muted-foreground">Original quote before discount</p>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.actualAmount}
                onChange={(e) => {
                  setForm({ ...form, actualAmount: Number(e.target.value || 0) });
                  if (errors.actualAmount) setErrors({ ...errors, actualAmount: "" });
                }}
              />
              {errors.actualAmount && <p className="text-xs text-red-600">{errors.actualAmount}</p>}
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium">Discounted Amount *</p>
              <p className="text-[11px] text-muted-foreground">Final agreed amount after discount</p>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.discountedAmount}
                onChange={(e) => {
                  setForm({ ...form, discountedAmount: Number(e.target.value || 0) });
                  if (errors.discountedAmount) setErrors({ ...errors, discountedAmount: "" });
                }}
              />
              {errors.discountedAmount && (
                <p className="text-xs text-red-600">{errors.discountedAmount}</p>
              )}
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium">Paid Amount *</p>
              <p className="text-[11px] text-muted-foreground">Amount already received from client</p>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.paidAmount}
                onChange={(e) => {
                  setForm({ ...form, paidAmount: Number(e.target.value || 0) });
                  if (errors.paidAmount) setErrors({ ...errors, paidAmount: "" });
                  if (Number(e.target.value || 0) === 0) {
                    setForm((prev) => ({ ...prev, paidAmount: 0, paidTo: "none" }));
                  }
                }}
              />
              {errors.paidAmount && <p className="text-xs text-red-600">{errors.paidAmount}</p>}
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium">Pending Amount</p>
              <p className="text-[11px] text-muted-foreground">Discounted minus paid amount</p>
              <Input value={pendingAmount} disabled />
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium">Paid To</p>
              <p className="text-[11px] text-muted-foreground">
                Employee who collected/received this payment
              </p>
              <Select
                value={paidToId}
                onValueChange={(v: string) => {
                  setForm({ ...form, paidTo: v });
                  if (errors.paidTo) setErrors({ ...errors, paidTo: "" });
                }}
                disabled={Number(form.paidAmount || 0) <= 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not selected</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp._id} value={emp._id}>
                      {`${emp.firstName || ""} ${emp.lastName || ""}`.trim() ||
                        emp.employeeCode ||
                        emp._id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.paidTo && <p className="text-xs text-red-600">{errors.paidTo}</p>}
            </div>

            <Select
              value={form.status}
              onValueChange={(v: ProjectStatus) => setForm({ ...form, status: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Textarea
            placeholder="Client Address (city, state, country)"
            value={form.clientAddress}
            onChange={(e) => setForm({ ...form, clientAddress: e.target.value })}
          />
          <Textarea
            placeholder="Notes (scope, timeline, payment remarks)"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />

          <Button onClick={handleSubmit} className="w-full">
            {isEdit ? "Update Project" : "Create Project"}
          </Button>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Projects;
