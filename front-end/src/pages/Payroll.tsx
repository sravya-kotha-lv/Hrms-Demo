import { useEffect, useMemo, useRef, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { PayrollSetupWizard } from "@/components/payroll/PayrollSetupWizard";
import {
  deleteApiWithToken,
  getApiWithToken,
  postApiWithToken,
  putApiWithToken
} from "@/services/apiWrapper";
import { hasAnyPermission } from "@/utils/auth";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  RefreshCcw,
  Search,
  ShieldCheck
} from "lucide-react";

type PayrollRun = {
  id: string;
  run_code: string;
  run_name: string;
  pay_month: string;
  status: string;
  employee_count: number;
  processed_employee_count: number;
  warning_count: number;
  error_count: number;
  gross_total: number;
  net_pay_total: number;
  updated_at?: string;
};

type PayrollRunEmployee = {
  id: string;
  employee_external_id: string;
  payroll_status: string;
  payable_days: number;
  lop_days: number;
  gross_earnings: number;
  total_deductions: number;
  reimbursement_amount: number;
  employer_contributions: number;
  net_pay: number;
  error_message?: string | null;
  warnings?: string[] | string;
};

type PayslipData = {
  payslipJson?: any;
  pdfPayload?: any;
};

type PayGroup = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  pay_frequency: "monthly" | "semi_monthly" | "weekly";
  cutoff_day?: number | null;
  salary_pay_day: number;
  work_week_days?: number;
  is_active: boolean;
  metadata?: Record<string, any>;
};

type PayGroupForm = {
  code: string;
  name: string;
  description: string;
  payFrequency: "monthly" | "semi_monthly" | "weekly";
  cutoffDay: string;
  salaryPayDay: string;
  workWeekDays: string;
  basicPercent: string;
};

type EmployeeOption = {
  _id: string;
  firstName?: string;
  lastName?: string;
  employeeCode?: string;
};

const emptyPayGroupForm: PayGroupForm = {
  code: "",
  name: "",
  description: "",
  payFrequency: "monthly",
  cutoffDay: "25",
  salaryPayDay: "30",
  workWeekDays: "6",
  basicPercent: "50"
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(Number.isFinite(amount) ? amount : 0);

const toMonthValue = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};

const buildMonthOptions = () => {
  const options: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push(toMonthValue(d));
  }
  return options;
};

const getStatusBadge = (status: string) => {
  const normalized = String(status || "").toLowerCase();
  if (["paid", "locked", "approved", "ready_for_approval"].includes(normalized)) {
    return <Badge className="bg-green-600 text-white">{status}</Badge>;
  }
  if (["validation_failed", "cancelled", "error"].includes(normalized)) {
    return <Badge className="bg-red-600 text-white">{status}</Badge>;
  }
  if (["draft", "validating", "pending", "processed"].includes(normalized)) {
    return <Badge className="bg-amber-600 text-white">{status}</Badge>;
  }
  return <Badge variant="secondary">{status}</Badge>;
};

const normalizeWarnings = (warnings: PayrollRunEmployee["warnings"]) => {
  if (!warnings) return [] as string[];
  if (Array.isArray(warnings)) return warnings;
  if (typeof warnings === "string") {
    try {
      const parsed = JSON.parse(warnings);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return warnings ? [warnings] : [];
    }
  }
  return [] as string[];
};

const Payroll = () => {
  const location = useLocation();
  const monthOptions = useMemo(() => buildMonthOptions(), []);
  const [monthFilter, setMonthFilter] = useState(monthOptions[0]);
  const [searchQuery, setSearchQuery] = useState("");

  const [settings, setSettings] = useState<any>(null);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const [runDetail, setRunDetail] = useState<any>(null);
  const [runPreview, setRunPreview] = useState<any>(null);

  const [loadingRuns, setLoadingRuns] = useState(false);
  const [loadingRunDetail, setLoadingRunDetail] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string>("");

  const [payslipOpen, setPayslipOpen] = useState(false);
  const [payslipData, setPayslipData] = useState<PayslipData | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [payGroups, setPayGroups] = useState<PayGroup[]>([]);
  const [payGroupDialogOpen, setPayGroupDialogOpen] = useState(false);
  const [payGroupForm, setPayGroupForm] = useState<PayGroupForm>(emptyPayGroupForm);
  const [editingPayGroupId, setEditingPayGroupId] = useState<string>("");
  const [payGroupSaving, setPayGroupSaving] = useState(false);
  const [employeeNameMap, setEmployeeNameMap] = useState<Record<string, string>>({});
  const employeeBreakdownRef = useRef<HTMLDivElement | null>(null);
  const [createRunDialogOpen, setCreateRunDialogOpen] = useState(false);
  const [eligibleEmployees, setEligibleEmployees] = useState<EmployeeOption[]>([]);
  const [employeePickerSearch, setEmployeePickerSearch] = useState("");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [loadingEmployeePicker, setLoadingEmployeePicker] = useState(false);

  const canManageConfig = hasAnyPermission(["PAYROLL_CONFIG_MANAGE"]);
  const canCreateRun = hasAnyPermission(["PAYROLL_RUN_CREATE"]);
  const canApproveRun = hasAnyPermission(["PAYROLL_RUN_APPROVE"]);
  const canLockRun = hasAnyPermission(["PAYROLL_RUN_LOCK"]);
  const canViewReports = hasAnyPermission(["PAYROLL_REPORT_VIEW"]);
  const canViewPayslip = hasAnyPermission(["PAYROLL_PAYSLIP_VIEW"]);

  const loadSettings = async () => {
    const res = await getApiWithToken("/payroll/settings");
    if (res?.success) {
      setSettings(res.data || null);
    }
  };

  const loadPayGroups = async () => {
    if (!canManageConfig) return;
    const res = await getApiWithToken("/payroll/pay-groups?includeInactive=true", null, {
      requiredPermissions: ["PAYROLL_CONFIG_MANAGE"]
    });
    if (res?.success) {
      setPayGroups(Array.isArray(res.data) ? res.data : []);
    } else if (!res?.skipped) {
      toast.error(res?.message || "Failed to load pay groups");
    }
  };

  const loadRuns = async (month: string) => {
    setLoadingRuns(true);
    try {
      const res = await getApiWithToken(`/payroll/runs?payMonth=${month}`);
      if (res?.success) {
        const data = Array.isArray(res.data) ? res.data : [];
        setRuns(data);
        if (!data.find((r: PayrollRun) => r.id === selectedRunId)) {
          setSelectedRunId(data[0]?.id || "");
        }
      } else {
        setRuns([]);
        toast.error(res?.message || "Failed to load payroll runs");
      }
    } finally {
      setLoadingRuns(false);
    }
  };

  const loadRunDetail = async (runId: string) => {
    if (!runId) {
      setRunDetail(null);
      setRunPreview(null);
      return;
    }
    setLoadingRunDetail(true);
    try {
      const [detailRes, previewRes] = await Promise.all([
        getApiWithToken(`/payroll/runs/${runId}`),
        postApiWithToken(`/payroll/runs/${runId}/preview`, {
          includeComponents: true,
          includeEmployees: true,
          limitEmployees: 300
        })
      ]);

      if (detailRes?.success) {
        setRunDetail(detailRes.data || null);
      } else {
        setRunDetail(null);
        toast.error(detailRes?.message || "Failed to load run detail");
      }

      if (previewRes?.success) {
        setRunPreview(previewRes.data || null);
      } else {
        setRunPreview(null);
      }
    } finally {
      setLoadingRunDetail(false);
    }
  };

  useEffect(() => {
    loadSettings();
    loadPayGroups();
  }, []);

  useEffect(() => {
    loadRuns(monthFilter);
  }, [monthFilter]);

  useEffect(() => {
    if (selectedRunId) {
      loadRunDetail(selectedRunId);
    } else {
      setRunDetail(null);
      setRunPreview(null);
    }
  }, [selectedRunId]);

  useEffect(() => {
    const runRows: PayrollRunEmployee[] = Array.isArray(runDetail?.employees)
      ? runDetail.employees
      : [];
    if (!runRows.length) return;

    let active = true;
    const loadEmployeeNames = async () => {
      const res = await getApiWithToken("/employees?page=1&limit=500");
      if (!active || !res?.success) return;

      const items = Array.isArray(res?.data?.items) ? res.data.items : [];
      if (!items.length) return;

      const nextMap: Record<string, string> = {};
      for (const emp of items) {
        const id = String(emp?._id || "").trim();
        if (!id) continue;
        const fullName = `${emp?.firstName || ""} ${emp?.lastName || ""}`.trim();
        if (!fullName) continue;
        nextMap[id] = fullName;
      }

      if (!Object.keys(nextMap).length) return;
      setEmployeeNameMap((prev) => ({ ...prev, ...nextMap }));
    };

    loadEmployeeNames();
    return () => {
      active = false;
    };
  }, [runDetail?.employees]);

  useEffect(() => {
    if (location.pathname !== "/payroll/employee-breakdown") return;
    const timer = setTimeout(() => {
      employeeBreakdownRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    return () => clearTimeout(timer);
  }, [location.pathname, runDetail?.employees]);

  const selectedRun = useMemo(
    () => runs.find((r) => r.id === selectedRunId) || null,
    [runs, selectedRunId]
  );

  const runEmployees = useMemo(() => {
    const rows: PayrollRunEmployee[] = Array.isArray(runDetail?.employees)
      ? runDetail.employees
      : [];

    if (!searchQuery.trim()) return rows;
    const query = searchQuery.toLowerCase();
    return rows.filter((row) =>
      [
        row.employee_external_id,
        employeeNameMap[row.employee_external_id] || "",
        String(row.payroll_status || "")
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [runDetail?.employees, searchQuery, employeeNameMap]);

  const getEmployeeLabel = (employeeId: string) => {
    const name = employeeNameMap[employeeId];
    if (!name) return employeeId;
    return `${name} (${employeeId})`;
  };

  const dashboard = useMemo(() => {
    const totalRuns = runs.length;
    const lockedOrPaid = runs.filter((r) => ["locked", "paid"].includes(String(r.status))).length;
    const failed = runs.filter((r) => String(r.status) === "validation_failed").length;
    const netTotal = runs.reduce((sum, r) => sum + Number(r.net_pay_total || 0), 0);
    return { totalRuns, lockedOrPaid, failed, netTotal };
  }, [runs]);

  const filteredEligibleEmployees = useMemo(() => {
    const query = employeePickerSearch.trim().toLowerCase();
    if (!query) return eligibleEmployees;
    return eligibleEmployees.filter((emp) => {
      const fullName = `${emp.firstName || ""} ${emp.lastName || ""}`.trim().toLowerCase();
      return [fullName, emp.employeeCode || "", emp._id].join(" ").toLowerCase().includes(query);
    });
  }, [eligibleEmployees, employeePickerSearch]);

  const executeAction = async (label: string, fn: () => Promise<any>, onSuccess?: () => void) => {
    setLoadingAction(label);
    try {
      const res = await fn();
      if (res?.success) {
        toast.success(res.message || `${label} success`);
        await loadRuns(monthFilter);
        if (selectedRunId) await loadRunDetail(selectedRunId);
        onSuccess?.();
      } else {
        toast.error(res?.message || `${label} failed`);
      }
    } finally {
      setLoadingAction("");
    }
  };

  const onGenerateSnapshot = () =>
    executeAction("Generate snapshot", () =>
      postApiWithToken("/payroll/attendance-snapshots/generate", {
        month: monthFilter,
        forceRebuild: true
      })
    );

  const onCreateRun = async (employeeIds: string[] = []) => {
    const payGroupId = settings?.default_pay_group_id || settings?.defaultPayGroupId;
    if (!payGroupId) {
      toast.error("Default pay group is not configured in payroll settings");
      return;
    }

    await executeAction(
      "Create run",
      () =>
        postApiWithToken("/payroll/runs", {
          payGroupId,
          payMonth: monthFilter,
          runType: "regular",
          ...(employeeIds.length ? { employeeIds } : {})
        }),
      async () => {
        const res = await getApiWithToken(`/payroll/runs?payMonth=${monthFilter}`);
        if (res?.success && Array.isArray(res.data) && res.data[0]?.id) {
          setSelectedRunId(res.data[0].id);
        }
        setCreateRunDialogOpen(false);
        setSelectedEmployeeIds([]);
        setEmployeePickerSearch("");
      }
    );
  };

  const openCreateRunDialog = async () => {
    setCreateRunDialogOpen(true);
    setLoadingEmployeePicker(true);
    try {
      const res = await getApiWithToken("/employees?page=1&limit=500");
      if (!res?.success) {
        toast.error(res?.message || "Failed to load employees for run selection");
        return;
      }
      const items = Array.isArray(res?.data?.items) ? res.data.items : [];
      setEligibleEmployees(items);
    } finally {
      setLoadingEmployeePicker(false);
    }
  };

  const toggleSelectedEmployee = (employeeId: string) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(employeeId) ? prev.filter((id) => id !== employeeId) : [...prev, employeeId]
    );
  };

  const onRunAction = (path: string, body: any = {}) => {
    if (!selectedRunId) return;
    return executeAction(path, () => postApiWithToken(`/payroll/runs/${selectedRunId}/${path}`, body));
  };

  const onReject = async () => {
    const reason = window.prompt("Enter rejection reason");
    if (!reason || reason.trim().length < 3) {
      toast.error("Reason should be at least 3 characters");
      return;
    }
    await onRunAction("reject", { reason: reason.trim() });
  };

  const onReopen = async () => {
    const reason = window.prompt("Enter reopen reason");
    if (!reason || reason.trim().length < 3) {
      toast.error("Reason should be at least 3 characters");
      return;
    }
    await onRunAction("reopen", { reason: reason.trim() });
  };

  const onViewPayslip = async (employeeExternalId: string) => {
    if (!selectedRunId) return;
    const res = await getApiWithToken(`/payroll/runs/${selectedRunId}/payslips/${employeeExternalId}`);
    if (res?.success) {
      setPayslipData(res.data || null);
      setPayslipOpen(true);
    } else {
      toast.error(res?.message || "Failed to fetch payslip");
    }
  };

  const onExportBankTransfer = async () => {
    if (!selectedRunId) return;
    const res = await getApiWithToken(
      `/payroll/reports/bank-transfer-export?runId=${selectedRunId}&exportFormat=csv`
    );
    if (!res?.success) {
      toast.error(res?.message || "Failed to export bank transfer report");
      return;
    }

    const csv = res?.data?.csv;
    if (!csv) {
      toast.error("CSV data not available");
      return;
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bank-transfer-${selectedRun?.pay_month || monthFilter}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const validationRows = runEmployees.filter(
    (row) => String(row.payroll_status) === "error" || !!row.error_message
  );

  const openCreatePayGroup = () => {
    setEditingPayGroupId("");
    setPayGroupForm(emptyPayGroupForm);
    setPayGroupDialogOpen(true);
  };

  const openEditPayGroup = (group: PayGroup) => {
    const basicPercent =
      group?.metadata?.salaryRules?.basicPercent ??
      group?.metadata?.basicPercent ??
      50;
    setEditingPayGroupId(group.id);
    setPayGroupForm({
      code: group.code || "",
      name: group.name || "",
      description: group.description || "",
      payFrequency: group.pay_frequency || "monthly",
      cutoffDay: group.cutoff_day ? String(group.cutoff_day) : "",
      salaryPayDay: String(group.salary_pay_day || 30),
      workWeekDays: String(group.work_week_days || 6),
      basicPercent: String(basicPercent)
    });
    setPayGroupDialogOpen(true);
  };

  const savePayGroup = async () => {
    if (!payGroupForm.code.trim() || !payGroupForm.name.trim()) {
      toast.error("Code and Name are required");
      return;
    }

    const payload = {
      code: payGroupForm.code.trim().toUpperCase(),
      name: payGroupForm.name.trim(),
      description: payGroupForm.description.trim() || null,
      payFrequency: payGroupForm.payFrequency,
      cutoffDay: payGroupForm.cutoffDay ? Number(payGroupForm.cutoffDay) : null,
      salaryPayDay: Number(payGroupForm.salaryPayDay || 30),
      workWeekDays: Number(payGroupForm.workWeekDays || 6),
      metadata: {
        salaryRules: {
          basicPercent: Number(payGroupForm.basicPercent || 50)
        }
      }
    };

    setPayGroupSaving(true);
    try {
      const res = editingPayGroupId
        ? await putApiWithToken(`/payroll/pay-groups/${editingPayGroupId}`, payload, null, {
            requiredPermissions: ["PAYROLL_CONFIG_MANAGE"]
          })
        : await postApiWithToken("/payroll/pay-groups", payload, null, {
            requiredPermissions: ["PAYROLL_CONFIG_MANAGE"]
          });

      if (!res?.success) {
        toast.error(res?.message || "Failed to save pay group");
        return;
      }

      toast.success(editingPayGroupId ? "Pay group updated" : "Pay group created");
      setPayGroupDialogOpen(false);
      await loadPayGroups();
    } finally {
      setPayGroupSaving(false);
    }
  };

  const archivePayGroup = async (group: PayGroup) => {
    const confirmed = window.confirm(`Archive pay group "${group.name}"?`);
    if (!confirmed) return;

    const res = await deleteApiWithToken(`/payroll/pay-groups/${group.id}`);
    if (!res?.success) {
      toast.error(res?.message || "Failed to archive pay group");
      return;
    }
    toast.success("Pay group archived");
    await loadPayGroups();
  };

  return (
    <MainLayout title="Payroll" breadcrumb={[{ label: "Home", href: "/" }, { label: "Payroll" }]}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <p className="text-sm text-muted-foreground mb-1">Total Net Payroll ({monthFilter})</p>
          <p className="text-2xl font-bold">{formatCurrency(dashboard.netTotal)}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground mb-1">Payroll Runs</p>
          <p className="text-2xl font-bold">{dashboard.totalRuns}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground mb-1">Locked/Paid Runs</p>
          <p className="text-2xl font-bold text-green-600">{dashboard.lockedOrPaid}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground mb-1">Validation Failed</p>
          <p className="text-2xl font-bold text-red-600">{dashboard.failed}</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((month) => (
                <SelectItem key={month} value={month}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => loadRuns(monthFilter)}
            disabled={loadingRuns}
            className="gap-2"
          >
            <RefreshCcw className="w-4 h-4" /> Refresh
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setWizardOpen(true)} disabled={!canManageConfig}>
            Setup Wizard
          </Button>
          <Button onClick={onGenerateSnapshot} disabled={!canCreateRun || !!loadingAction}>
            Generate Snapshot
          </Button>
          <Button onClick={openCreateRunDialog} disabled={!canCreateRun || !!loadingAction}>
            Create Run
          </Button>
          <Button
            variant="outline"
            onClick={onExportBankTransfer}
            disabled={!canViewReports || !selectedRunId}
            className="gap-2"
          >
            <Download className="w-4 h-4" /> Bank Export
          </Button>
        </div>
      </div>

      {canManageConfig && (
        <div className="bg-card rounded-xl card-shadow overflow-hidden mb-6">
          <div className="p-4 border-b flex items-center justify-between gap-2">
            <div>
              <p className="font-semibold">Pay Groups</p>
              <p className="text-sm text-muted-foreground">
                Manage payroll cycles used by settings and payroll runs.
              </p>
            </div>
            <Button size="sm" onClick={openCreatePayGroup}>
              Add Pay Group
            </Button>
          </div>
          <div className="p-4" ref={employeeBreakdownRef}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead className="text-right">Basic %</TableHead>
                  <TableHead className="text-right">Cutoff</TableHead>
                  <TableHead className="text-right">Pay Day</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payGroups.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell className="font-medium">{group.code}</TableCell>
                    <TableCell>{group.name}</TableCell>
                    <TableCell>{group.pay_frequency}</TableCell>
                    <TableCell className="text-right">
                      {group?.metadata?.salaryRules?.basicPercent ??
                        group?.metadata?.basicPercent ??
                        50}
                    </TableCell>
                    <TableCell className="text-right">{group.cutoff_day || "-"}</TableCell>
                    <TableCell className="text-right">{group.salary_pay_day}</TableCell>
                    <TableCell>
                      {group.is_active ? (
                        <Badge className="bg-green-600 text-white">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Archived</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={() => openEditPayGroup(group)}>
                        Edit
                      </Button>
                      {group.is_active && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => archivePayGroup(group)}
                        >
                          Archive
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!payGroups.length && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No pay groups found. Click "Add Pay Group" to create one.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="bg-card rounded-xl card-shadow overflow-hidden xl:col-span-1">
          <div className="p-4 border-b font-semibold">Run List</div>
          <div className="max-h-[520px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow
                    key={run.id}
                    className={`cursor-pointer ${selectedRunId === run.id ? "bg-muted/40" : ""}`}
                    onClick={() => setSelectedRunId(run.id)}
                  >
                    <TableCell>
                      <p className="font-medium">{run.run_code}</p>
                      <p className="text-xs text-muted-foreground">{run.run_name}</p>
                      <p className="text-xs text-muted-foreground">Emp: {run.employee_count || 0}</p>
                    </TableCell>
                    <TableCell>{getStatusBadge(run.status)}</TableCell>
                  </TableRow>
                ))}
                {!runs.length && !loadingRuns && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground">
                      No payroll runs found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="bg-card rounded-xl card-shadow overflow-hidden xl:col-span-2">
          <div className="p-4 border-b flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Run Detail</p>
              {selectedRun ? (
                <p className="text-sm text-muted-foreground">
                  {selectedRun.run_code} | {selectedRun.pay_month} | {selectedRun.status}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Select a run</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRunAction("compute")}
                disabled={!selectedRunId || !canCreateRun || !!loadingAction}
              >
                Compute
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRunAction("recompute", { forceRecompute: true })}
                disabled={!selectedRunId || !canCreateRun || !!loadingAction}
              >
                Recompute
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRunAction("validate")}
                disabled={!selectedRunId || !canCreateRun || !!loadingAction}
              >
                Validate
              </Button>
              <Button
                size="sm"
                onClick={() => onRunAction("submit", { remarks: "Submitted from payroll UI" })}
                disabled={!selectedRunId || !canCreateRun || !!loadingAction}
              >
                Submit
              </Button>
              <Button
                size="sm"
                onClick={() => onRunAction("approve", { remarks: "Approved from payroll UI" })}
                disabled={!selectedRunId || !canApproveRun || !!loadingAction}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={onReject}
                disabled={!selectedRunId || !canApproveRun || !!loadingAction}
              >
                Reject
              </Button>
              <Button
                size="sm"
                onClick={() => onRunAction("lock", { remarks: "Locked from payroll UI" })}
                disabled={!selectedRunId || !canLockRun || !!loadingAction}
              >
                Lock
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onReopen}
                disabled={!selectedRunId || !canLockRun || !!loadingAction}
              >
                Reopen
              </Button>
            </div>
          </div>

          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3 border-b">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Gross</p>
              <p className="font-semibold">{formatCurrency(Number(runDetail?.gross_total || runPreview?.gross_total || 0))}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Deductions</p>
              <p className="font-semibold">
                {formatCurrency(Number(runDetail?.deduction_total || runPreview?.deduction_total || 0))}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Net Pay</p>
              <p className="font-semibold text-green-600">
                {formatCurrency(Number(runDetail?.net_pay_total || runPreview?.net_pay_total || 0))}
              </p>
            </div>
          </div>

          <div className="p-4 border-b">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <p className="font-medium">Validation Errors ({validationRows.length})</p>
            </div>
            {!validationRows.length ? (
              <p className="text-sm text-muted-foreground">No validation errors in selected run.</p>
            ) : (
              <div className="space-y-2 max-h-36 overflow-auto">
                {validationRows.slice(0, 8).map((row) => (
                  <div key={row.id} className="text-sm rounded border p-2 bg-red-50 text-red-700">
                    <span className="font-medium">{getEmployeeLabel(row.employee_external_id)}:</span>{" "}
                    {row.error_message}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <p className="font-medium">Employee Breakdown</p>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search employee/status"
                />
              </div>
            </div>

            <div className="max-h-[420px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Payable Days</TableHead>
                    <TableHead className="text-right">LOP</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead>Issues</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runEmployees.map((row) => {
                    const warnings = normalizeWarnings(row.warnings);
                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          <p className="font-medium">
                            {employeeNameMap[row.employee_external_id] || "Employee"}
                          </p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {row.employee_external_id}
                          </p>
                        </TableCell>
                        <TableCell>{getStatusBadge(row.payroll_status)}</TableCell>
                        <TableCell className="text-right">{Number(row.payable_days || 0).toFixed(2)}</TableCell>
                        <TableCell className="text-right text-red-600">{Number(row.lop_days || 0).toFixed(2)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(row.gross_earnings || 0))}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(Number(row.net_pay || 0))}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {row.error_message ? (
                              <Badge className="bg-red-600 text-white gap-1">
                                <AlertTriangle className="w-3 h-3" /> Error
                              </Badge>
                            ) : warnings.length ? (
                              <Badge className="bg-amber-600 text-white gap-1">
                                <Clock3 className="w-3 h-3" /> {warnings.length} warning
                              </Badge>
                            ) : (
                              <Badge className="bg-green-600 text-white gap-1">
                                <CheckCircle2 className="w-3 h-3" /> OK
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onViewPayslip(row.employee_external_id)}
                            disabled={!canViewPayslip}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {!runEmployees.length && !loadingRunDetail && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        No employee rows for selected run
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={payslipOpen} onOpenChange={setPayslipOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" /> Payslip Preview
            </DialogTitle>
          </DialogHeader>

          {!payslipData ? (
            <p className="text-muted-foreground">No payslip data</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="border rounded p-3">
                  <p className="text-xs text-muted-foreground">Employee</p>
                  <p className="font-medium">{payslipData?.payslipJson?.employee?.name || "-"}</p>
                  <p className="text-xs text-muted-foreground">
                    {payslipData?.payslipJson?.employee?.employeeCode || "-"}
                  </p>
                </div>
                <div className="border rounded p-3">
                  <p className="text-xs text-muted-foreground">Month</p>
                  <p className="font-medium">{payslipData?.payslipJson?.payMonth || "-"}</p>
                </div>
                <div className="border rounded p-3">
                  <p className="text-xs text-muted-foreground">Net Pay</p>
                  <p className="font-semibold text-green-600">
                    {formatCurrency(Number(payslipData?.payslipJson?.totals?.netPay || 0))}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="font-medium mb-2">Earnings</p>
                  <div className="space-y-1">
                    {(payslipData?.payslipJson?.earnings || []).map((item: any) => (
                      <div key={`earn-${item.code}`} className="flex justify-between text-sm border-b py-1">
                        <span>{item.name}</span>
                        <span>{formatCurrency(Number(item.amount || 0))}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="font-medium mb-2">Deductions</p>
                  <div className="space-y-1">
                    {(payslipData?.payslipJson?.deductions || []).map((item: any) => (
                      <div key={`ded-${item.code}`} className="flex justify-between text-sm border-b py-1">
                        <span>{item.name}</span>
                        <span className="text-red-600">{formatCurrency(Number(item.amount || 0))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <PayrollSetupWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        initialSettings={settings}
        onActivated={() => {
          loadSettings();
          loadRuns(monthFilter);
          loadPayGroups();
        }}
      />

      <Dialog open={createRunDialogOpen} onOpenChange={setCreateRunDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Payroll Run (Selected Employees)</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Choose only required employees. If none selected, run will include all eligible
              employees in the pay group.
            </p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9"
                value={employeePickerSearch}
                onChange={(e) => setEmployeePickerSearch(e.target.value)}
                placeholder="Search name / employee code / id"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Selected: {selectedEmployeeIds.length}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedEmployeeIds(filteredEligibleEmployees.map((emp) => emp._id))}
                  disabled={!filteredEligibleEmployees.length}
                >
                  Select All (Filtered)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedEmployeeIds([])}
                  disabled={!selectedEmployeeIds.length}
                >
                  Clear
                </Button>
              </div>
            </div>
            <div className="max-h-72 overflow-auto rounded-lg border">
              {loadingEmployeePicker ? (
                <p className="p-3 text-sm text-muted-foreground">Loading employees...</p>
              ) : (
                <div className="divide-y">
                  {filteredEligibleEmployees.map((emp) => {
                    const fullName = `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || "Employee";
                    const checked = selectedEmployeeIds.includes(emp._id);
                    return (
                      <label
                        key={emp._id}
                        className="flex cursor-pointer items-center justify-between gap-3 p-3 hover:bg-muted/40"
                      >
                        <div>
                          <p className="font-medium">{fullName}</p>
                          <p className="text-xs text-muted-foreground">
                            {emp.employeeCode || "-"} | {emp._id}
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelectedEmployee(emp._id)}
                        />
                      </label>
                    );
                  })}
                  {!filteredEligibleEmployees.length && (
                    <p className="p-3 text-sm text-muted-foreground">No employees found</p>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateRunDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => onCreateRun(selectedEmployeeIds)}
                disabled={!!loadingAction || loadingEmployeePicker}
              >
                {loadingAction === "Create run"
                  ? "Creating..."
                  : selectedEmployeeIds.length
                    ? `Create Run for ${selectedEmployeeIds.length} Employee(s)`
                    : "Create Run for All"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={payGroupDialogOpen} onOpenChange={setPayGroupDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingPayGroupId ? "Edit Pay Group" : "Add Pay Group"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Code</label>
              <Input
                value={payGroupForm.code}
                onChange={(e) =>
                  setPayGroupForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))
                }
                placeholder="TS-MONTHLY"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={payGroupForm.name}
                onChange={(e) => setPayGroupForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Telangana Monthly"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium">Description</label>
              <Input
                value={payGroupForm.description}
                onChange={(e) =>
                  setPayGroupForm((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Monthly cycle for Telangana payroll"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Pay Frequency</label>
              <Select
                value={payGroupForm.payFrequency}
                onValueChange={(value) =>
                  setPayGroupForm((prev) => ({
                    ...prev,
                    payFrequency: value as PayGroupForm["payFrequency"]
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="semi_monthly">Semi Monthly</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Cutoff Day</label>
              <Input
                type="number"
                min={1}
                max={31}
                value={payGroupForm.cutoffDay}
                onChange={(e) =>
                  setPayGroupForm((prev) => ({ ...prev, cutoffDay: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium">Salary Pay Day</label>
              <Input
                type="number"
                min={1}
                max={31}
                value={payGroupForm.salaryPayDay}
                onChange={(e) =>
                  setPayGroupForm((prev) => ({ ...prev, salaryPayDay: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium">Working Days/Week</label>
              <Input
                type="number"
                min={1}
                max={7}
                value={payGroupForm.workWeekDays}
                onChange={(e) =>
                  setPayGroupForm((prev) => ({ ...prev, workWeekDays: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium">Basic % of Monthly Gross</label>
              <Input
                type="number"
                min={1}
                max={100}
                value={payGroupForm.basicPercent}
                onChange={(e) =>
                  setPayGroupForm((prev) => ({ ...prev, basicPercent: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setPayGroupDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={savePayGroup} disabled={payGroupSaving}>
              {editingPayGroupId ? "Update" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Payroll;
