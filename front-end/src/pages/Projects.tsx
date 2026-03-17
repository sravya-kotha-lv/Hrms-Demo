import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "@/components/ui/command";
import { Plus, Pencil, Trash2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  deleteApiWithToken,
  getApiWithToken,
  postApiWithToken,
  putApiWithToken
} from "@/services/apiWrapper";
import { useAuth } from "@/context/useAuth";

type ProjectStatus = "active" | "on_hold" | "completed" | "cancelled";
type PaidToValue = string;
type UploadPayload = { fileName: string; mimeType: string; base64Data: string };
type UploadedFileMeta = { fileName?: string; fileUrl?: string; mimeType?: string; uploadedAt?: string };

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
  mouFile?: UploadedFileMeta | null;
  documentationFile?: UploadedFileMeta | null;
  mouUpload?: UploadPayload | null;
  documentationUpload?: UploadPayload | null;
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
  notes: "",
  mouUpload: null,
  documentationUpload: null
};

const PROJECT_FILE_MAX_BYTES = 5 * 1024 * 1024;
const PROJECT_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

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
  const [paidToOpen, setPaidToOpen] = useState(false);

  const pendingAmount = useMemo(() => {
    const discounted = Number(form.discountedAmount || 0);
    const paid = Number(form.paidAmount || 0);
    return Math.max(0, discounted - paid);
  }, [form.discountedAmount, form.paidAmount]);
  const paidToId = useMemo(() => getPaidToId(form.paidTo), [form.paidTo]);
  const paidToLabel = useMemo(() => {
    const selected = employees.find((emp) => emp._id === paidToId);
    if (!selected) return "Select employee *";
    return (
      `${selected.firstName || ""} ${selected.lastName || ""}`.trim() ||
      selected.employeeCode ||
      selected._id
    );
  }, [employees, paidToId]);

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        const base64 = result.includes(",") ? result.split(",")[1] : result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const validateFile = (file: File, label: string) => {
    if (!PROJECT_FILE_TYPES.includes(file.type)) {
      toast.error(`Invalid ${label} format`);
      return false;
    }
    if (file.size > PROJECT_FILE_MAX_BYTES) {
      toast.error(`${label} size should be under 5MB`);
      return false;
    }
    return true;
  };

  const handleAmountChange = (
    field: "actualAmount" | "discountedAmount" | "paidAmount",
    value: string,
    errorKey: "actualAmount" | "discountedAmount" | "paidAmount"
  ) => {
    const trimmed = value.trim();
    // Allow only non-negative numbers with up to 2 decimal places.
    if (!/^\d*(\.\d{0,2})?$/.test(trimmed)) {
      setErrors((prev) => ({ ...prev, [errorKey]: "Enter a valid number (max 2 decimals)" }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      [field]: trimmed === "" ? 0 : Number(trimmed)
    }));
    if (errors[errorKey]) {
      setErrors((prev) => ({ ...prev, [errorKey]: "" }));
    }
  };

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
    if (paidToId === "none") {
      nextErrors.paidTo = "Paid To is required";
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
      paidTo: paidToId,
      status: form.status,
      notes: form.notes || "",
      mouUpload: form.mouUpload || undefined,
      documentationUpload: form.documentationUpload || undefined
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
          <div className="text-xs text-muted-foreground">{row.clientCompany || "-"}</div>
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
          <div>
            MOU:{" "}
            {row.mouFile?.fileUrl ? (
              <a href={row.mouFile.fileUrl} className="text-primary underline" target="_blank" rel="noreferrer">
                View
              </a>
            ) : "-"}
          </div>
          <div>
            Documentation:{" "}
            {row.documentationFile?.fileUrl ? (
              <a href={row.documentationFile.fileUrl} className="text-primary underline" target="_blank" rel="noreferrer">
                View
              </a>
            ) : "-"}
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
                  notes: row.notes || "",
                  mouUpload: null,
                  documentationUpload: null
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto custom-scroll">
          <DialogHeader className="sticky top-0 z-10 bg-background pb-1">
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
              validationType="name"
              value={form.clientName}
              onChange={(e) => {
                setForm({ ...form, clientName: e.target.value });
                if (errors.clientName) setErrors({ ...errors, clientName: "" });
              }}
            />
            {errors.clientName && <p className="text-xs text-red-600">{errors.clientName}</p>}
            <Input
              placeholder="Client Company (optional)"
              value={form.clientCompany}
              onChange={(e) => {
                setForm({ ...form, clientCompany: e.target.value });
                if (errors.clientCompany) setErrors({ ...errors, clientCompany: "" });
              }}
            />
            {errors.clientCompany && <p className="text-xs text-red-600">{errors.clientCompany}</p>}
            <Input
              placeholder="Client Email (optional)"
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
                type="text"
                inputMode="decimal"
                value={form.actualAmount}
                onChange={(e) => handleAmountChange("actualAmount", e.target.value, "actualAmount")}
              />
              {errors.actualAmount && <p className="text-xs text-red-600">{errors.actualAmount}</p>}
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium">Discounted Amount *</p>
              <p className="text-[11px] text-muted-foreground">Final agreed amount after discount</p>
              <Input
                type="text"
                inputMode="decimal"
                value={form.discountedAmount}
                onChange={(e) =>
                  handleAmountChange("discountedAmount", e.target.value, "discountedAmount")
                }
              />
              {errors.discountedAmount && (
                <p className="text-xs text-red-600">{errors.discountedAmount}</p>
              )}
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium">Paid Amount *</p>
              <p className="text-[11px] text-muted-foreground">Amount already received from client</p>
              <Input
                type="text"
                inputMode="decimal"
                value={form.paidAmount}
                onChange={(e) => handleAmountChange("paidAmount", e.target.value, "paidAmount")}
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
              <Popover open={paidToOpen} onOpenChange={setPaidToOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between font-normal">
                    <span className="truncate">{paidToLabel}</span>
                    <ChevronDown className="h-4 w-4 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search employee by name or code" />
                    <CommandList>
                      <CommandEmpty>No employees match your search.</CommandEmpty>
                      <CommandGroup>
                        {employees.map((emp) => {
                          const label =
                            `${emp.firstName || ""} ${emp.lastName || ""}`.trim() ||
                            emp.employeeCode ||
                            emp._id;
                          return (
                            <CommandItem
                              key={emp._id}
                              value={`${label} ${emp.employeeCode || ""}`}
                              onSelect={() => {
                                setForm({ ...form, paidTo: emp._id });
                                if (errors.paidTo) setErrors({ ...errors, paidTo: "" });
                                setPaidToOpen(false);
                              }}
                            >
                              {label}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {employees.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No active employees found.
                </p>
              )}
              {errors.paidTo && <p className="text-xs text-red-600">{errors.paidTo}</p>}
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium">Status</p>
              <p className="text-[11px] text-muted-foreground">
                Current lifecycle status of this project
              </p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-xs font-medium">MOU Upload</p>
              <Input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (!validateFile(file, "MOU")) return;
                  const base64Data = await fileToBase64(file);
                  setForm({
                    ...form,
                    mouUpload: {
                      fileName: file.name,
                      mimeType: file.type,
                      base64Data
                    }
                  });
                }}
              />
              {form.mouUpload?.fileName && (
                <p className="text-xs text-muted-foreground">{form.mouUpload.fileName}</p>
              )}
              {!form.mouUpload?.fileName && form.mouFile?.fileUrl && (
                <a href={form.mouFile.fileUrl} className="text-xs text-primary underline" target="_blank" rel="noreferrer">
                  View current MOU
                </a>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium">Documentation Upload</p>
              <Input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (!validateFile(file, "Documentation")) return;
                  const base64Data = await fileToBase64(file);
                  setForm({
                    ...form,
                    documentationUpload: {
                      fileName: file.name,
                      mimeType: file.type,
                      base64Data
                    }
                  });
                }}
              />
              {form.documentationUpload?.fileName && (
                <p className="text-xs text-muted-foreground">{form.documentationUpload.fileName}</p>
              )}
              {!form.documentationUpload?.fileName && form.documentationFile?.fileUrl && (
                <a
                  href={form.documentationFile.fileUrl}
                  className="text-xs text-primary underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  View current documentation
                </a>
              )}
            </div>
          </div>

          <Button onClick={handleSubmit} className="w-full">
            {isEdit ? "Update Project" : "Create Project"}
          </Button>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Projects;
