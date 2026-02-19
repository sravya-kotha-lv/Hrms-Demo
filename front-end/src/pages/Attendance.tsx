import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { getApiWithToken, postApiWithToken, putApiWithToken } from "@/services/apiWrapper";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { formatDateTimeInOrgTimeZone, formatTimeInOrgTimeZone } from "@/utils/timezone";

type DayCell = {
  status: "present" | "absent" | "pending_checkout";
  checkInAt: string | null;
  checkOutAt: string | null;
  isOpenSession?: boolean;
  excludeFromPayroll?: boolean;
  payrollReconciledByLeave?: boolean;
  missedCheckout?: boolean;
  missedCheckoutMarkedAt?: string | null;
  overriddenBy: string | null;
  overriddenAt: string | null;
  shiftName?: string | null;
  shiftCode?: string | null;
  shiftStartTime?: string | null;
  shiftEndTime?: string | null;
  lateByMinutes?: number;
  earlyLoginByMinutes?: number;
  earlyCheckoutByMinutes?: number;
  overtimeMinutes?: number;
  isOnLeave: boolean;
  leaveType: string | null;
  leaveDuration?: "full_day" | "half_day" | null;
  leaveHalfDaySession?: "first_half" | "second_half" | null;
  leaveUnits?: number;
  isWeekOff: boolean;
  holidayName: string | null;
};

type EmployeeRow = {
  employeeId: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
  days: Record<number, DayCell>;
};

type AttendanceHistoryItem = {
  action: string;
  createdAt: string;
  actor: string;
};

const currentMonth = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = `${now.getMonth() + 1}`.padStart(2, "0");
  return `${y}-${m}`;
};

const emptyCell: DayCell = {
  status: "absent",
  checkInAt: null,
  checkOutAt: null,
  isOpenSession: false,
  excludeFromPayroll: false,
  payrollReconciledByLeave: false,
  missedCheckout: false,
  missedCheckoutMarkedAt: null,
  overriddenBy: null,
  overriddenAt: null,
  isWeekOff: false,
  holidayName: null,
  isOnLeave: false,
  leaveType: "",
  leaveDuration: null,
  leaveHalfDaySession: null,
  leaveUnits: 0
};

const Attendance = () => {
  const { hasAnyPermission } = useAuth();
  const canViewAll = hasAnyPermission(["ATTENDANCE_VIEW_ALL"]);
  const canViewSelf = hasAnyPermission(["ATTENDANCE_VIEW_SELF"]);
  const canView = canViewAll || canViewSelf;
  const canEdit = hasAnyPermission(["ATTENDANCE_MANAGE"]);

  const [month, setMonth] = useState(currentMonth());
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [daysInMonth, setDaysInMonth] = useState(31);
  const [loading, setLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRow | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<"present" | "absent">("present");
  const [saving, setSaving] = useState(false);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [bulkDate, setBulkDate] = useState("");
  const [bulkStatus, setBulkStatus] = useState<"present" | "absent">("present");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState<AttendanceHistoryItem[]>([]);

  const fetchMatrix = async () => {
    if (!canView) {
      setRows([]);
      return;
    }
    try {
      setLoading(true);
      const endpoint = canViewAll
        ? `/timesheets/attendance/matrix?month=${month}`
        : `/timesheets/attendance/matrix/my?month=${month}`;
      const permission = canViewAll ? ["ATTENDANCE_VIEW_ALL"] : ["ATTENDANCE_VIEW_SELF"];

      const res = await getApiWithToken(endpoint, null, {
        requiredPermissions: permission
      });
      if (res?.skipped) return;
      if (!res?.success) {
        toast.error(res?.message || "Failed to load attendance");
        return;
      }

      setRows(res.data?.employees || []);
      setDaysInMonth(res.data?.daysInMonth || 31);
      setSelectedEmployeeIds((prev) => {
        const validIds = new Set((res.data?.employees || []).map((e: EmployeeRow) => e.employeeId));
        return prev.filter((id) => validIds.has(id));
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatrix();
  }, [month, canViewAll, canViewSelf]);

  const filteredRows = useMemo(() => {
    return (rows || []).filter((r) => {
      const name = `${r.firstName || ""} ${r.lastName || ""}`.trim().toLowerCase();
      const code = (r.employeeCode || "").toLowerCase();
      const q = search.toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  }, [rows, search]);

  const isFutureDay = (day: number) => {
    const date = new Date(`${month}-${String(day).padStart(2, "0")}T00:00:00`);
    if (Number.isNaN(date.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date.getTime() > today.getTime();
  };

  const openCellDetails = async (row: EmployeeRow, day: number) => {
    const cell = row.days?.[day] || emptyCell;
    if (isFutureDay(day) || cell.isWeekOff) return;
    setSelectedEmployee(row);
    setSelectedDay(day);
    const cellStatus = row.days?.[day]?.status || "absent";
    setSelectedStatus(cellStatus === "pending_checkout" ? "present" : (cellStatus as "present" | "absent"));
    setOpen(true);
    setHistory([]);
    try {
      setHistoryLoading(true);
      const date = `${month}-${String(day).padStart(2, "0")}`;
      const endpoint = canViewAll
        ? `/timesheets/attendance/matrix/history?employeeId=${row.employeeId}&date=${date}`
        : `/timesheets/attendance/matrix/history/my?date=${date}`;
      const requiredPermissions = canViewAll
        ? ["ATTENDANCE_VIEW_ALL"]
        : ["ATTENDANCE_VIEW_SELF"];
      const res = await getApiWithToken(endpoint, null, { requiredPermissions });
      if (res?.success) {
        setHistory(res.data?.history || []);
      }
    } finally {
      setHistoryLoading(false);
    }
  };

  const saveOverride = async () => {
    if (!selectedEmployee || !selectedDay) return;
    const date = `${month}-${String(selectedDay).padStart(2, "0")}`;

    try {
      setSaving(true);
      const res = await putApiWithToken(
        `/timesheets/attendance/matrix/${selectedEmployee.employeeId}`,
        { date, status: selectedStatus },
        null,
        { requiredPermissions: ["ATTENDANCE_MANAGE"] }
      );
      if (res?.skipped) return;
      if (!res?.success) {
        toast.error(res?.message || "Failed to update attendance");
        return;
      }

      toast.success("Attendance updated");
      setOpen(false);
      fetchMatrix();
    } finally {
      setSaving(false);
    }
  };

  const formatHoverInfo = (cell: DayCell) => {
    const parts: string[] = [];
    if (cell.status === "pending_checkout") {
      parts.push("Status: Pending checkout");
    }
    if (cell.excludeFromPayroll) {
      parts.push("Excluded from payroll until checkout is completed");
    }
    if (cell.payrollReconciledByLeave) {
      parts.push("Payroll inclusion reconciled by approved half-day leave");
    }
    if (cell.missedCheckout) {
      parts.push("Missed checkout flagged");
    }
    if (cell.missedCheckoutMarkedAt) {
      parts.push(`Missed checkout marked at: ${formatDateTimeInOrgTimeZone(cell.missedCheckoutMarkedAt)}`);
    }
    if (cell.isWeekOff) parts.push("Week Off");
    if (cell.holidayName) parts.push(`Holiday: ${cell.holidayName}`);
    if (cell.checkInAt) parts.push(`Check-in: ${formatTimeInOrgTimeZone(cell.checkInAt)}`);
    if (cell.checkOutAt) parts.push(`Check-out: ${formatTimeInOrgTimeZone(cell.checkOutAt)}`);
    if (cell.shiftName || cell.shiftCode) {
      parts.push(`Shift: ${cell.shiftName || ""}${cell.shiftCode ? ` (${cell.shiftCode})` : ""}`);
    }
    if (cell.shiftStartTime && cell.shiftEndTime) {
      parts.push(`Shift Time: ${cell.shiftStartTime} - ${cell.shiftEndTime}`);
    }
    if ((cell.lateByMinutes || 0) > 0) parts.push(`Late by: ${cell.lateByMinutes} min`);
    if ((cell.earlyLoginByMinutes || 0) > 0) parts.push(`Early login by: ${cell.earlyLoginByMinutes} min`);
    if ((cell.earlyCheckoutByMinutes || 0) > 0) parts.push(`Early checkout by: ${cell.earlyCheckoutByMinutes} min`);
    if ((cell.overtimeMinutes || 0) > 0) parts.push(`Overtime: ${cell.overtimeMinutes} min`);
    if (cell.isOnLeave) {
      const sessionLabel = cell.leaveHalfDaySession === "second_half" ? "Second Half" : "First Half";
      const leaveLabel = cell.leaveDuration === "half_day"
        ? `${cell.leaveType || "Leave"} (${sessionLabel})`
        : (cell.leaveType || "Leave");
      parts.push(`Approved Leave: ${leaveLabel}`);
    }
    if (cell.overriddenBy) parts.push(`Overridden by: ${cell.overriddenBy}`);
    if (cell.overriddenAt) parts.push(`Overridden at: ${formatDateTimeInOrgTimeZone(cell.overriddenAt)}`);
    return parts.join(" | ") || "No details";
  };

  const getEmployeeTotals = (row: EmployeeRow) => {
    let presentDays = 0;
    let pendingCheckoutDays = 0;
    let absentDays = 0;
    let onLeaveDays = 0;
    let weekOffDays = 0;
    let holidayDays = 0;
    let payrollExcludedDays = 0;
    for (let day = 1; day <= daysInMonth; day += 1) {
      const cell = row.days?.[day] || emptyCell;
      if (cell.status === "pending_checkout") {
        pendingCheckoutDays += 1;
        if (cell.excludeFromPayroll) {
          payrollExcludedDays += 1;
        }
        continue;
      }
      if (cell.status === "present") {
        presentDays += 1;
        continue;
      }
      if (cell.isOnLeave) {
        onLeaveDays += 1;
        continue;
      }
      if (cell.isWeekOff) {
        weekOffDays += 1;
        continue;
      }
      if (cell.holidayName) {
        holidayDays += 1;
        continue;
      }
      absentDays += 1;
    }
    return {
      presentDays,
      pendingCheckoutDays,
      absentDays,
      onLeaveDays,
      weekOffDays,
      holidayDays,
      payrollExcludedDays,
      totalDays: daysInMonth
    };
  };

  const downloadCsv = () => {
    const header = [
      "Employee Code",
      "Employee Name",
      "Present",
      "Pending Checkout",
      "Absent",
      "On Leave",
      "Week Off",
      "Holiday",
      "Excluded From Payroll",
      "Total Days"
    ];
    const lines = [header.join(",")];
    filteredRows.forEach((row) => {
      const t = getEmployeeTotals(row);
      const name = `${row.firstName || ""} ${row.lastName || ""}`.trim();
      lines.push([
        row.employeeCode || "",
        `"${name.replace(/"/g, '""')}"`,
        t.presentDays,
        t.pendingCheckoutDays,
        t.absentDays,
        t.onLeaveDays,
        t.weekOffDays,
        t.holidayDays,
        t.payrollExcludedDays,
        t.totalDays
      ].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleEmployeeSelection = (employeeId: string) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(employeeId)
        ? prev.filter((id) => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const toggleSelectAllFiltered = () => {
    const filteredIds = filteredRows.map((r) => r.employeeId);
    const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedEmployeeIds.includes(id));
    if (allSelected) {
      setSelectedEmployeeIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      setSelectedEmployeeIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const runBulkUpdate = async () => {
    if (!canEdit) return;
    if (!bulkDate || selectedEmployeeIds.length === 0) {
      toast.error("Select employees and date for bulk update");
      return;
    }
    try {
      setBulkSaving(true);
      const res = await postApiWithToken(
        "/timesheets/attendance/matrix/bulk",
        {
          employeeIds: selectedEmployeeIds,
          date: bulkDate,
          status: bulkStatus
        },
        null,
        { requiredPermissions: ["ATTENDANCE_MANAGE"] }
      );
      if (res?.skipped) return;
      if (!res?.success) {
        toast.error(res?.message || "Bulk update failed");
        return;
      }
      toast.success(`Attendance updated for ${res.data?.updatedCount || 0} employees`);
      fetchMatrix();
    } finally {
      setBulkSaving(false);
    }
  };

  return (
    <MainLayout
      title="Attendance"
      breadcrumb={[{ label: "Home", href: "/" }, { label: "Attendance" }]}
    >
      {!canView && (
        <div className="bg-card rounded-xl card-shadow p-6 text-sm text-muted-foreground">
          You do not have permission to view attendance.
        </div>
      )}

      {canView && (
        <>
          <div className="text-xs text-muted-foreground mb-2">
            Tip: Hover any day cell to view check-in/out, shift, late/early, leave, holiday and override details.
          </div>
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 mb-4">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto">
              <Input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full sm:w-44"
              />
              <Input
                placeholder="Search employee..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:w-64"
              />
              <Button variant="outline" onClick={fetchMatrix}>
                Refresh
              </Button>
              <Button variant="outline" onClick={downloadCsv}>
                Export CSV
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              {canEdit
                ? "Click any day cell to override attendance."
                : "Read-only view."}
            </div>
          </div>

          {canEdit && (
            <div className="flex flex-wrap items-end gap-2 sm:gap-3 mb-4">
              <Button variant="outline" onClick={toggleSelectAllFiltered}>
                Select/Unselect Filtered ({selectedEmployeeIds.length})
              </Button>
              <Input
                type="date"
                value={bulkDate}
                onChange={(e) => setBulkDate(e.target.value)}
                className="w-full sm:w-48"
              />
              <Select value={bulkStatus} onValueChange={(v) => setBulkStatus(v as "present" | "absent")}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={runBulkUpdate} disabled={bulkSaving}>
                {bulkSaving ? "Updating..." : "Bulk Update"}
              </Button>
            </div>
          )}

          <div className="bg-card rounded-xl card-shadow overflow-hidden">
            <div className="max-h-[72vh] overflow-auto">
              <table className="w-full border-collapse min-w-[1100px]">
              <thead>
                <tr className="border-b">
                  {canEdit && (
                    <th className="sticky left-0 top-0 bg-card text-left p-3 min-w-[48px] z-30">
                      Sel
                    </th>
                  )}
                  <th className={`sticky ${canEdit ? "left-[48px]" : "left-0"} top-0 bg-card text-left p-3 min-w-[220px] z-30`}>
                    Employee
                  </th>
                  {Array.from({ length: daysInMonth }).map((_, idx) => (
                    <th key={idx + 1} className="sticky top-0 bg-card z-20 text-center p-2 text-sm text-muted-foreground min-w-[42px]">
                      {idx + 1}
                    </th>
                  ))}
                  <th className="sticky top-0 bg-card z-20 text-center p-2 text-sm text-muted-foreground min-w-[90px]">
                    Present
                  </th>
                  <th className="sticky top-0 bg-card z-20 text-center p-2 text-sm text-muted-foreground min-w-[120px]">
                    Pending Checkout
                  </th>
                  <th className="sticky top-0 bg-card z-20 text-center p-2 text-sm text-muted-foreground min-w-[90px]">
                    Absent
                  </th>
                  <th className="sticky top-0 bg-card z-20 text-center p-2 text-sm text-muted-foreground min-w-[90px]">
                    On Leave
                  </th>
                  <th className="sticky top-0 bg-card z-20 text-center p-2 text-sm text-muted-foreground min-w-[90px]">
                    Week Off
                  </th>
                  <th className="sticky top-0 bg-card z-20 text-center p-2 text-sm text-muted-foreground min-w-[90px]">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={daysInMonth + 7 + (canEdit ? 1 : 0)} className="p-4 text-muted-foreground">
                      Loading attendance...
                    </td>
                  </tr>
                )}
                {!loading && filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={daysInMonth + 7 + (canEdit ? 1 : 0)} className="p-4 text-muted-foreground">
                      No employees found.
                    </td>
                  </tr>
                )}
                {!loading && filteredRows.map((row) => (
                  <tr key={row.employeeId} className="border-b">
                    {canEdit && (
                      <td className="sticky left-0 bg-card p-2 z-20 text-center">
                        <input
                          type="checkbox"
                          checked={selectedEmployeeIds.includes(row.employeeId)}
                          onChange={() => toggleEmployeeSelection(row.employeeId)}
                        />
                      </td>
                    )}
                    <td className={`sticky ${canEdit ? "left-[48px]" : "left-0"} bg-card p-3 z-10`}>
                      <div className="font-medium">
                        {`${row.firstName || ""} ${row.lastName || ""}`.trim() || "-"}
                      </div>
                      <div className="text-xs text-muted-foreground">{row.employeeCode || "-"}</div>
                    </td>
                    {Array.from({ length: daysInMonth }).map((_, idx) => {
                      const day = idx + 1;
                      const isFuture = isFutureDay(day);
                      const cell = row.days?.[day] || emptyCell;
                      const isNonInteractive = isFuture || cell.isWeekOff;
                      const isPresent = cell.status === "present";
                      const isPendingCheckout = cell.status === "pending_checkout";
                      const isLeave = cell.isOnLeave;
                      const isPartialLeaveWithAttendance = isLeave && (isPresent || isPendingCheckout);
                      const isWeekOff = cell.isWeekOff;
                      const isHoliday = Boolean(cell.holidayName);
                      let colorClass = "";
                      if (isPartialLeaveWithAttendance) {
                        colorClass = "bg-indigo-100 text-indigo-700 border-indigo-300";
                      } else if (isLeave) {
                        colorClass = "bg-violet-100 text-violet-700 border-violet-300";
                      } else if (isHoliday) {
                        colorClass = "bg-amber-100 text-amber-700 border-amber-300";
                      } else if (isWeekOff) {
                        colorClass = "bg-sky-100 text-sky-700 border-sky-300";
                      } else if (isPendingCheckout) {
                        colorClass = "bg-orange-100 text-orange-700 border-orange-300";
                      } else if (isPresent) {
                        colorClass = "bg-emerald-100 text-emerald-700 border-emerald-300";
                      } else {
                        colorClass = "bg-rose-100 text-rose-700 border-rose-300";
                      }

                      return (
                        <td key={day} className="p-1">
                          <button
                            type="button"
                            onClick={() => !isNonInteractive && openCellDetails(row, day)}
                            disabled={isNonInteractive}
                            title={formatHoverInfo(cell)}
                            className={`w-full h-8 rounded text-xs font-medium border ${colorClass} ${
                              isNonInteractive ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:opacity-90"
                            }`}
                          >
                            {isPartialLeaveWithAttendance ? "PL" : isLeave ? "L" : isHoliday ? "H" : isWeekOff ? "W" : isPendingCheckout ? "PC" : isPresent ? "P" : "A"}
                          </button>
                        </td>
                      );
                    })}
                    {(() => {
                      const totals = getEmployeeTotals(row);
                      return (
                        <>
                          <td className="text-center text-sm font-medium text-emerald-700">
                            {totals.presentDays}
                          </td>
                          <td className="text-center text-sm font-medium text-orange-700">
                            {totals.pendingCheckoutDays}
                          </td>
                          <td className="text-center text-sm font-medium text-rose-700">
                            {totals.absentDays}
                          </td>
                          <td className="text-center text-sm font-medium text-violet-700">
                            {totals.onLeaveDays}
                          </td>
                          <td className="text-center text-sm font-medium text-sky-700">
                            {totals.weekOffDays}
                          </td>
                          <td className="text-center text-sm font-medium">
                            {totals.totalDays}
                          </td>
                        </>
                      );
                    })()}
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs mt-3">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded bg-emerald-100 border border-emerald-300" />
              Present
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded bg-orange-100 border border-orange-300" />
              Pending Checkout
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded bg-rose-100 border border-rose-300" />
              Absent
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded bg-sky-100 border border-sky-300" />
              Week Off
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded bg-violet-100 border border-violet-300" />
              Approved Leave
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded bg-indigo-100 border border-indigo-300" />
              Present + Leave
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded bg-amber-100 border border-amber-300" />
              Holiday
            </div>
          </div>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Attendance</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {selectedEmployee
                ? `${selectedEmployee.firstName} ${selectedEmployee.lastName} - ${month}-${String(selectedDay || 1).padStart(2, "0")}`
                : ""}
            </p>
            {canEdit && (
              <Select
                value={selectedStatus}
                onValueChange={(v) => setSelectedStatus(v as "present" | "absent")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                </SelectContent>
              </Select>
            )}
            <div className="rounded-md border p-3 max-h-40 overflow-auto">
              <p className="text-xs font-medium mb-2">Activity Timeline</p>
              {historyLoading && <p className="text-xs text-muted-foreground">Loading...</p>}
              {!historyLoading && history.length === 0 && (
                <p className="text-xs text-muted-foreground">No activity found.</p>
              )}
              {!historyLoading && history.map((h, idx) => (
                <p key={`${h.createdAt}-${idx}`} className="text-xs mb-1">
                  {formatDateTimeInOrgTimeZone(h.createdAt)} - {h.action} by {h.actor}
                </p>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            {canEdit && (
              <Button onClick={saveOverride} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Attendance;
