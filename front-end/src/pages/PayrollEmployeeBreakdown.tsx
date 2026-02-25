import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { getApiWithToken } from "@/services/apiWrapper";
import { Search } from "lucide-react";
import { toast } from "sonner";

type PayrollRun = {
  id: string;
  run_code: string;
  run_name: string;
  pay_month: string;
  status: string;
};

type BreakdownComponent = {
  component_scope: "earning" | "deduction" | "employer_contribution";
  component_code: string;
  component_name: string;
  amount: number;
};

type BreakdownEmployee = {
  id: string;
  employee_external_id: string;
  employee_name?: string | null;
  employee_code?: string | null;
  payroll_status: string;
  net_pay: number;
  error_message?: string | null;
  components: BreakdownComponent[];
};

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

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(Number.isFinite(amount) ? amount : 0);

const statusBadge = (status: string) => {
  const s = String(status || "").toLowerCase();
  if (["error", "validation_failed"].includes(s)) {
    return <Badge className="bg-red-600 text-white">{status}</Badge>;
  }
  if (["pending", "draft", "processed"].includes(s)) {
    return <Badge className="bg-amber-600 text-white">{status}</Badge>;
  }
  return <Badge className="bg-green-600 text-white">{status}</Badge>;
};

const componentBadgeClass = (scope: string) => {
  if (scope === "earning") return "bg-green-100 text-green-800";
  if (scope === "deduction") return "bg-red-100 text-red-800";
  return "bg-blue-100 text-blue-800";
};

const PayrollEmployeeBreakdown = () => {
  const monthOptions = useMemo(() => buildMonthOptions(), []);
  const [monthFilter, setMonthFilter] = useState(monthOptions[0]);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<BreakdownEmployee[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [loadingRows, setLoadingRows] = useState(false);

  const loadRuns = async (month: string) => {
    setLoadingRuns(true);
    try {
      const res = await getApiWithToken(`/payroll/runs?payMonth=${month}`);
      if (!res?.success) {
        setRuns([]);
        setSelectedRunId("");
        toast.error(res?.message || "Failed to load payroll runs");
        return;
      }
      const data = Array.isArray(res.data) ? res.data : [];
      setRuns(data);
      setSelectedRunId(data[0]?.id || "");
    } finally {
      setLoadingRuns(false);
    }
  };

  const loadBreakdown = async (runId: string, query: string) => {
    if (!runId) {
      setRows([]);
      return;
    }
    setLoadingRows(true);
    try {
      const suffix = query.trim() ? `?search=${encodeURIComponent(query.trim())}` : "";
      const res = await getApiWithToken(`/payroll/runs/${runId}/employee-breakdown${suffix}`);
      if (!res?.success) {
        setRows([]);
        toast.error(res?.message || "Failed to load employee breakdown");
        return;
      }
      setRows(Array.isArray(res?.data?.employees) ? res.data.employees : []);
    } finally {
      setLoadingRows(false);
    }
  };

  useEffect(() => {
    loadRuns(monthFilter);
  }, [monthFilter]);

  useEffect(() => {
    loadBreakdown(selectedRunId, search);
  }, [selectedRunId]);

  const onSearch = () => loadBreakdown(selectedRunId, search);

  return (
    <MainLayout
      title="Payroll Employee Breakdown"
      breadcrumb={[
        { label: "Home", href: "/" },
        { label: "Payroll", href: "/payroll" },
        { label: "Employee Breakdown" }
      ]}
    >
      <div className="bg-card rounded-xl card-shadow p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <p className="text-sm font-medium mb-1">Month</p>
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((month) => (
                  <SelectItem key={month} value={month}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-sm font-medium mb-1">Payroll Run</p>
            <Select value={selectedRunId || undefined} onValueChange={setSelectedRunId}>
              <SelectTrigger>
                <SelectValue placeholder={loadingRuns ? "Loading runs..." : "Select run"} />
              </SelectTrigger>
              <SelectContent>
                {runs.map((run) => (
                  <SelectItem key={run.id} value={run.id}>
                    {run.run_code} | {run.run_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-sm font-medium mb-1">Search Employee</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name / code / id / status"
                />
              </div>
              <Button variant="outline" onClick={onSearch}>
                Search
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl card-shadow overflow-hidden">
        <div className="p-4 border-b">
          <p className="font-semibold">Employee List with Salary Components</p>
          <p className="text-sm text-muted-foreground">
            Earnings, deductions, and employer contributions are color coded.
          </p>
        </div>
        <div className="p-4 max-h-[68vh] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Salary Components</TableHead>
                <TableHead className="text-right">Net Pay</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <p className="font-medium">{row.employee_name || "Employee"}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.employee_code || "-"} | {row.employee_external_id}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {statusBadge(row.payroll_status)}
                      {row.error_message && (
                        <p className="text-xs text-red-600">{row.error_message}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {row.components.map((component, index) => (
                        <span
                          key={`${component.component_scope}-${component.component_code}-${index}`}
                          className={`text-xs px-2 py-1 rounded ${componentBadgeClass(
                            component.component_scope
                          )}`}
                          title={`${component.component_name}`}
                        >
                          {component.component_code}: {formatCurrency(Number(component.amount || 0))}
                        </span>
                      ))}
                      {!row.components.length && (
                        <span className="text-xs text-muted-foreground">No components</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(Number(row.net_pay || 0))}
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length && !loadingRows && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No employee breakdown rows found
                  </TableCell>
                </TableRow>
              )}
              {loadingRows && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Loading employee breakdown...
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </MainLayout>
  );
};

export default PayrollEmployeeBreakdown;
