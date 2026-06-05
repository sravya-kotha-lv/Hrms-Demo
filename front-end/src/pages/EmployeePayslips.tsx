import { useEffect, useMemo, useRef, useState } from "react";
import { getApiWithToken } from "@/services/apiWrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Download, Printer } from "lucide-react";
import { buildMonthOptions, formatCurrency, type PayslipData } from "@/components/payroll/payrollShared";

type EmployeePayslipRun = {
  runId: string;
  runCode?: string;
  month: string;
  status?: string;
  employeeExternalId?: string;
};

const EmployeePayslips = () => {
  const defaultMonths = useMemo(() => buildMonthOptions(), []);
  const [monthOptions, setMonthOptions] = useState<string[]>(defaultMonths);
  const [month, setMonth] = useState(defaultMonths[0] || "");
  const [loading, setLoading] = useState(false);
  const [payslipData, setPayslipData] = useState<PayslipData | null>(null);
  const [monthsLoaded, setMonthsLoaded] = useState(false);
  const [runByMonth, setRunByMonth] = useState<Record<string, EmployeePayslipRun>>({});
  const requestSeqRef = useRef(0);

  const loadPayslip = async (selectedMonth: string) => {
    if (!selectedMonth) return;
    const run = runByMonth[selectedMonth];
    if (!run?.runId) {
      setPayslipData(null);
      toast.error(`Payslip not available for ${selectedMonth}`);
      return;
    }

    const requestSeq = ++requestSeqRef.current;
    setLoading(true);
    try {
      const res = await getApiWithToken(`/payroll/payslips/my/runs/${run.runId}`);
      if (requestSeq !== requestSeqRef.current) return;
      if (res?.success) {
        setPayslipData((res.data as PayslipData) || null);
      } else {
        setPayslipData(null);
        toast.error(res?.message || "Payslip not available for selected month");
      }
    } finally {
      if (requestSeq === requestSeqRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const initMonths = async () => {
      try {
        const res = await getApiWithToken("/payroll/payslips/my/runs");
        const availableRuns = res?.success && Array.isArray(res?.data) ? res.data.filter(Boolean) : [];
        const nextRunMap: Record<string, EmployeePayslipRun> = {};
        const nextMonths: string[] = [];

        for (const row of availableRuns as EmployeePayslipRun[]) {
          const normalizedMonth = String(row?.month || "").trim();
          const normalizedRunId = String(row?.runId || "").trim();
          if (!normalizedMonth || !normalizedRunId) continue;
          if (!nextRunMap[normalizedMonth]) {
            nextRunMap[normalizedMonth] = row;
            nextMonths.push(normalizedMonth);
          }
        }

        if (nextMonths.length) {
          setRunByMonth(nextRunMap);
          setMonthOptions(nextMonths);
          setMonth(nextMonths[0]);
          return;
        }
        setMonthOptions(defaultMonths);
        setMonth(defaultMonths[0] || "");
      } finally {
        setMonthsLoaded(true);
      }
    };
    initMonths();
  }, [defaultMonths]);

  useEffect(() => {
    if (!monthsLoaded) return;
    if (!month) return;
    loadPayslip(month);
  }, [month, monthsLoaded, runByMonth]);

  const payslip = payslipData?.payslipJson;
  const fileMonth = payslip?.payMonth || month;
  const activeRun = runByMonth[fileMonth] || null;

  const downloadJson = () => {
    if (!payslipData) return;
    const blob = new Blob([JSON.stringify(payslipData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `payslip-${fileMonth}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const printPayslip = () => {
    if (!payslip) return;
    const content = `
      <html>
        <head>
          <title>Payslip ${fileMonth}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            h1 { margin: 0 0 8px; }
            .meta { margin-bottom: 16px; color: #4b5563; }
            table { width: 100%; border-collapse: collapse; margin: 12px 0; }
            th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; font-size: 12px; }
            th { background: #f3f4f6; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          </style>
        </head>
        <body>
          <h1>${payslip.company?.name || "Company"} - Payslip</h1>
          <div class="meta">Month: ${payslip.payMonth || "-"} | Employee: ${payslip.employee?.name || "-"} (${payslip.employee?.employeeCode || "-"})</div>
          <div class="grid">
            <div><strong>Gross:</strong> ${formatCurrency(Number(payslip.totals?.grossEarnings || 0))}</div>
            <div><strong>Net:</strong> ${formatCurrency(Number(payslip.totals?.netPay || 0))}</div>
            <div><strong>Deductions:</strong> ${formatCurrency(Number(payslip.totals?.totalDeductions || 0))}</div>
            <div><strong>Taxable:</strong> ${formatCurrency(Number(payslip.totals?.taxableIncome || 0))}</div>
          </div>
          <h3>Earnings</h3>
          <table><thead><tr><th>Code</th><th>Name</th><th>Amount</th></tr></thead><tbody>
            ${(payslip.earnings || []).map((row: any) => `<tr><td>${row.code || "-"}</td><td>${row.name || "-"}</td><td>${formatCurrency(Number(row.amount || 0))}</td></tr>`).join("")}
          </tbody></table>
          <h3>Deductions</h3>
          <table><thead><tr><th>Code</th><th>Name</th><th>Amount</th></tr></thead><tbody>
            ${(payslip.deductions || []).map((row: any) => `<tr><td>${row.code || "-"}</td><td>${row.name || "-"}</td><td>${formatCurrency(Number(row.amount || 0))}</td></tr>`).join("")}
          </tbody></table>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1024,height=768");
    if (!printWindow) {
      toast.error("Unable to open print window");
      return;
    }
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">My Payslips</h1>
          <p className="text-sm text-muted-foreground">Month-wise salary slip from finalized payroll runs.</p>
        </div>
        <div className="w-[180px]">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger>
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((option) => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <Card><CardContent className="p-6"><Skeleton className="h-40 w-full" /></CardContent></Card>
      ) : !payslip ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">No payslip available for {month}.</CardContent></Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>{payslip.employee?.name || "Employee"} - {payslip.payMonth}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {activeRun?.runCode ? `Payroll Run: ${activeRun.runCode}` : "Payroll run linked to this month"}
                {activeRun?.status ? ` · ${activeRun.status}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={printPayslip}><Printer className="h-4 w-4 mr-2" />Print / Save PDF</Button>
              <Button size="sm" onClick={downloadJson}><Download className="h-4 w-4 mr-2" />Download</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Gross Earnings</p><p className="font-semibold">{formatCurrency(Number(payslip.totals?.grossEarnings || 0))}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Total Deductions</p><p className="font-semibold">{formatCurrency(Number(payslip.totals?.totalDeductions || 0))}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Taxable Income</p><p className="font-semibold">{formatCurrency(Number(payslip.totals?.taxableIncome || 0))}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Net Pay</p><p className="font-semibold text-green-600">{formatCurrency(Number(payslip.totals?.netPay || 0))}</p></div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-base">Earnings</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {(payslip.earnings || []).map((item: any) => (
                    <div key={`${item.code}-${item.name}`} className="flex items-center justify-between text-sm">
                      <span>{item.name || item.code || "-"}</span>
                      <span className="font-medium">{formatCurrency(Number(item.amount || 0))}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Deductions</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {(payslip.deductions || []).map((item: any) => (
                    <div key={`${item.code}-${item.name}`} className="flex items-center justify-between text-sm">
                      <span>{item.name || item.code || "-"}</span>
                      <span className="font-medium">{formatCurrency(Number(item.amount || 0))}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default EmployeePayslips;
