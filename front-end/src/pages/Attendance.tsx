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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from "@/components/ui/pagination";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger
} from "@/components/ui/hover-card";
import { getApiWithToken, postApiWithToken, putApiWithToken } from "@/services/apiWrapper";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { formatDateTimeInOrgTimeZone, formatTimeInOrgTimeZone, getOrgTimeZone } from "@/utils/timezone";
import { Skeleton } from "@/components/ui/skeleton";

type DayCell = {
  status: "present" | "half_day_present" | "full_day_present" | "absent" | "pending_checkout";
  checkInAt: string | null;
  checkOutAt: string | null;
  checkInIp?: string | null;
  checkInSelfieProvided?: boolean;
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

type AttendanceSnapshot = {
  checkInAt?: string | null;
  checkOutAt?: string | null;
  checkInIp?: string | null;
  checkInSelfieProvided?: boolean;
  checkInSelfieImage?: string | null;
} | null;

type MatrixPagination = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

const toEmployeeIdString = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record._id === "string") return record._id;
    if (typeof record.employeeId === "string") return record.employeeId;
    if (typeof (record as { toHexString?: unknown }).toHexString === "function") {
      return String((record as { toHexString: () => string }).toHexString());
    }
    if (typeof record.$oid === "string") return record.$oid;
    if (record._id && typeof record._id === "object") {
      const nested = record._id as Record<string, unknown>;
      if (typeof (nested as { toHexString?: unknown }).toHexString === "function") {
        return String((nested as { toHexString: () => string }).toHexString());
      }
      if (typeof nested.$oid === "string") return nested.$oid;
      if (typeof nested.toString === "function") return nested.toString();
    }
  }
  return String(value);
};

const normalizeEmployeeIds = (values: unknown[]): string[] =>
  Array.from(
    new Set(
      values
        .map((value) => toEmployeeIdString(value).trim())
        .filter(Boolean)
    )
  );

const buildUpdatedCell = (cell: DayCell, status: "present" | "absent"): DayCell => ({
  ...cell,
  status,
  checkInAt: status === "present" ? (cell.checkInAt || new Date().toISOString()) : null,
  checkOutAt: status === "present" ? (cell.checkOutAt || new Date().toISOString()) : null,
  isOpenSession: false,
  excludeFromPayroll: false,
  payrollReconciledByLeave: false,
  missedCheckout: false,
  missedCheckoutMarkedAt: null,
  lateByMinutes: 0,
  earlyLoginByMinutes: 0,
  earlyCheckoutByMinutes: 0,
  overtimeMinutes: 0,
  overriddenAt: new Date().toISOString()
});

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
  checkInIp: null,
  checkInSelfieProvided: false,
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

const isPresentLikeStatus = (status?: string | null) =>
  status === "present" || status === "half_day_present" || status === "full_day_present";

const toOrgDateKey = (value: string | number | Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: getOrgTimeZone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(value));
  const read = (type: "year" | "month" | "day") => parts.find((part) => part.type === type)?.value || "00";
  return `${read("year")}-${read("month")}-${read("day")}`;
};

const Attendance = () => {
  const { hasAnyPermission, profile } = useAuth();
  const canViewAll = hasAnyPermission(["ATTENDANCE_VIEW_ALL"]);
  const canViewSelf = hasAnyPermission(["ATTENDANCE_VIEW_SELF"]);
  const canView = canViewAll || canViewSelf;
  const canEdit = hasAnyPermission(["ATTENDANCE_MANAGE"]);
  const canViewSelfieData = ["hr", "org-admin"].includes(profile?.activeRole?.slug || "");

  const [month, setMonth] = useState(currentMonth());
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [daysInMonth, setDaysInMonth] = useState(31);
  const [loading, setLoading] = useState(false);
  const [visibleRowCount, setVisibleRowCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [pagination, setPagination] = useState<MatrixPagination | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [open, setOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRow | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<"present" | "absent">("present");
  const [saving, setSaving] = useState(false);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [bulkDate, setBulkDate] = useState("");
  const [bulkStatus, setBulkStatus] = useState<"present" | "absent">("present");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [showBulkControls, setShowBulkControls] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState<AttendanceHistoryItem[]>([]);
  const [selectedAttendanceSnapshot, setSelectedAttendanceSnapshot] = useState<AttendanceSnapshot>(null);

  const fetchMatrix = async () => {
    if (!canView) {
      setRows([]);
      return;
    }
    try {
      setLoading(true);
      const endpoint = canViewAll
        ? `/timesheets/attendance/matrix?month=${month}&page=${currentPage}&limit=${pageSize}&search=${encodeURIComponent(searchTerm.trim())}`
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

      const nextRows = (res.data?.employees || []).map((employee: EmployeeRow & { employeeId: unknown }) => ({
        ...employee,
        employeeId: toEmployeeIdString(employee.employeeId)
      }));

      setRows(nextRows);
      setDaysInMonth(res.data?.daysInMonth || 31);
      setPagination(res.data?.pagination || null);
      setSelectedEmployeeIds((prev) => {
        const validIds = new Set(nextRows.map((e: EmployeeRow) => e.employeeId));
        return prev.filter((id) => validIds.has(id));
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatrix();
  }, [month, canViewAll, canViewSelf, currentPage, pageSize, searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [month, pageSize, searchTerm]);

  const filteredRows = useMemo(() => rows || [], [rows]);

  const filteredRowIds = useMemo(
    () => filteredRows.map((row) => toEmployeeIdString(row.employeeId)).join("|"),
    [filteredRows]
  );

  useEffect(() => {
    if (loading) {
      setVisibleRowCount(0);
      return;
    }
    if (filteredRows.length === 0) {
      setVisibleRowCount(0);
      return;
    }

    let cancelled = false;
    let frameId: number | null = null;
    let count = 0;

    const reveal = () => {
      if (cancelled) return;
      count += 1;
      setVisibleRowCount(count);
      if (count < filteredRows.length) {
        frameId = window.requestAnimationFrame(reveal);
      }
    };

    frameId = window.requestAnimationFrame(reveal);

    return () => {
      cancelled = true;
      if (frameId !== null) window.cancelAnimationFrame(frameId);
    };
  }, [loading, filteredRows.length, filteredRowIds, search, month]);

  const visibleRows = useMemo(
    () => filteredRows.slice(0, Math.min(visibleRowCount, filteredRows.length)),
    [filteredRows, visibleRowCount]
  );

  const isFutureDay = (day: number) => {
    const dateKey = `${month}-${String(day).padStart(2, "0")}`;
    const todayKey = toOrgDateKey(new Date());
    return dateKey > todayKey;
  };

  const openCellDetails = async (row: EmployeeRow, day: number) => {
    const cell = row.days?.[day] || emptyCell;
    if (isFutureDay(day) || cell.isWeekOff) return;
    setSelectedEmployee(row);
    setSelectedDay(day);
    const cellStatus = row.days?.[day]?.status || "absent";
    setSelectedStatus(cellStatus === "absent" ? "absent" : "present");
    setOpen(true);
    setHistory([]);
    setSelectedAttendanceSnapshot(null);
    try {
      setHistoryLoading(true);
      const date = `${month}-${String(day).padStart(2, "0")}`;
      const employeeId = toEmployeeIdString(row.employeeId);
      const endpoint = canViewAll
        ? `/timesheets/attendance/matrix/history?employeeId=${employeeId}&date=${date}`
        : `/timesheets/attendance/matrix/history/my?date=${date}`;
      const requiredPermissions = canViewAll
        ? ["ATTENDANCE_VIEW_ALL"]
        : ["ATTENDANCE_VIEW_SELF"];
      const res = await getApiWithToken(endpoint, null, { requiredPermissions });
      if (res?.success) {
        setHistory(res.data?.history || []);
        setSelectedAttendanceSnapshot(res.data?.attendance || null);
      }
    } finally {
      setHistoryLoading(false);
    }
  };

  const saveOverride = async () => {
    if (!selectedEmployee || !selectedDay) return;
    const date = `${month}-${String(selectedDay).padStart(2, "0")}`;
    const employeeId = toEmployeeIdString(selectedEmployee.employeeId);

    try {
      setSaving(true);
      const res = await putApiWithToken(
        `/timesheets/attendance/matrix/${employeeId}`,
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
      setRows((prev) =>
        prev.map((row) => {
          if (toEmployeeIdString(row.employeeId) !== employeeId) return row;
          const currentCell = row.days?.[selectedDay] || emptyCell;
          return {
            ...row,
            days: {
              ...row.days,
              [selectedDay]: buildUpdatedCell(currentCell, selectedStatus)
            }
          };
        })
      );
      setSelectedEmployee((prev) => (
        prev && toEmployeeIdString(prev.employeeId) === employeeId
          ? {
              ...prev,
              days: {
                ...prev.days,
                [selectedDay]: buildUpdatedCell(prev.days?.[selectedDay] || emptyCell, selectedStatus)
              }
            }
          : prev
      ));
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const formatHoverInfo = (cell: DayCell) => {
    const parts: string[] = [];
    const hasAttendance = isPresentLikeStatus(cell.status) || cell.status === "pending_checkout";
    const isLeaveOnlyDay = Boolean(cell.isOnLeave) && !hasAttendance;
    const hideTimings = isLeaveOnlyDay || Boolean(cell.holidayName);
    if (cell.status === "pending_checkout") {
      parts.push("Status: Pending checkout");
    } else if (cell.status === "half_day_present") {
      parts.push("Status: Half day present");
    } else if (cell.status === "full_day_present") {
      parts.push("Status: Full day present");
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
    if (!hideTimings && cell.checkInAt) parts.push(`Check-in: ${formatTimeInOrgTimeZone(cell.checkInAt)}`);
    if (!hideTimings && cell.checkOutAt) parts.push(`Check-out: ${formatTimeInOrgTimeZone(cell.checkOutAt)}`);
    if (!hideTimings && canViewSelfieData && (cell.checkInAt || cell.checkOutAt)) {
      parts.push(`Selfie: ${cell.checkInSelfieProvided ? "Yes" : "No"}`);
    }
    if (!hideTimings && canViewSelfieData && cell.checkInIp) {
      parts.push(`IP: ${cell.checkInIp}`);
    }
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

  const getCellUi = (cell: DayCell, isFuture = false) => {
    const isFullDayPresent = cell.status === "full_day_present";
    const isHalfDayPresent = cell.status === "half_day_present";
    const isPresent = isPresentLikeStatus(cell.status);
    const isPendingCheckout = cell.status === "pending_checkout";
    const isLeave = cell.isOnLeave;
    const isPartialLeaveWithAttendance = isLeave && (isPresent || isPendingCheckout);
    const isWeekOff = cell.isWeekOff;
    const isHoliday = Boolean(cell.holidayName);

    if (isPartialLeaveWithAttendance) {
      return {
        label: "Present + Leave",
        shortLabel: "PL",
        className: "bg-indigo-100 text-indigo-700 border-indigo-300"
      };
    }
    if (isHoliday) {
      return {
        label: "Holiday",
        shortLabel: "H",
        className: "bg-amber-100 text-amber-700 border-amber-300"
      };
    }
    if (isWeekOff) {
      return {
        label: "Week Off",
        shortLabel: "W",
        className: "bg-sky-100 text-sky-700 border-sky-300"
      };
    }
    if (isFuture) {
      return {
        label: "Not Marked",
        shortLabel: "-",
        className: "bg-slate-100 text-slate-500 border-slate-200"
      };
    }
    if (isLeave) {
      return {
        label: "Leave",
        shortLabel: "L",
        className: "bg-violet-100 text-violet-700 border-violet-300"
      };
    }
    if (isPendingCheckout) {
      return {
        label: "Pending Checkout",
        shortLabel: "PC",
        className: "bg-orange-100 text-orange-700 border-orange-300"
      };
    }
    if (isFullDayPresent) {
      return {
        label: "Full Day Present",
        shortLabel: "P",
        className: "bg-emerald-100 text-emerald-700 border-emerald-300"
      };
    }
    if (isHalfDayPresent) {
      return {
        label: "Half Day Present",
        shortLabel: "HP",
        className: "bg-lime-100 text-lime-700 border-lime-300"
      };
    }
    if (isPresent) {
      return {
        label: "Present",
        shortLabel: "P",
        className: "bg-emerald-100 text-emerald-700 border-emerald-300"
      };
    }
    return {
      label: "Absent",
      shortLabel: "A",
      className: "bg-rose-100 text-rose-700 border-rose-300"
    };
  };

  const getEmployeeTotals = (row: EmployeeRow) => {
    let presentDays = 0;
    let pendingCheckoutDays = 0;
    let absentDays = 0;
    let onLeaveDays = 0;
    let weekOffDays = 0;
    let holidayDays = 0;
    let payrollExcludedDays = 0;
    let selfieDays = 0;
    for (let day = 1; day <= daysInMonth; day += 1) {
      if (isFutureDay(day)) {
        continue;
      }
      const cell = row.days?.[day] || emptyCell;
      if (cell.checkInSelfieProvided) {
        selfieDays += 1;
      }
      if (cell.status === "pending_checkout") {
        pendingCheckoutDays += 1;
        if (cell.excludeFromPayroll) {
          payrollExcludedDays += 1;
        }
        continue;
      }
      if (cell.status === "half_day_present") {
        presentDays += 0.5;
        absentDays += 0.5;
        continue;
      }
      if (cell.status === "full_day_present" || cell.status === "present") {
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
      selfieDays,
      payrollExcludedDays,
      totalDays:
        presentDays
        + pendingCheckoutDays
        + absentDays
        + onLeaveDays
        + weekOffDays
        + holidayDays
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
    if (canViewSelfieData) {
      header.splice(8, 0, "Selfie");
    }
    const lines = [header.join(",")];
    filteredRows.forEach((row) => {
      const t = getEmployeeTotals(row);
      const name = `${row.firstName || ""} ${row.lastName || ""}`.trim();
      const rowData = [
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
      ];
      if (canViewSelfieData) {
        rowData.splice(8, 0, t.selfieDays);
      }
      lines.push(rowData.join(","));
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
    const normalizedEmployeeId = toEmployeeIdString(employeeId).trim();
    if (!normalizedEmployeeId) return;

    setSelectedEmployeeIds((prev) => {
      const next = normalizeEmployeeIds(prev);
      return next.includes(normalizedEmployeeId)
        ? next.filter((id) => id !== normalizedEmployeeId)
        : [...next, normalizedEmployeeId];
    });
  };

  const toggleSelectAllFiltered = () => {
    const filteredIds = normalizeEmployeeIds(filteredRows.map((r) => r.employeeId));
    const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedEmployeeIds.includes(id));
    if (allSelected) {
      setSelectedEmployeeIds((prev) => normalizeEmployeeIds(prev).filter((id) => !filteredIds.includes(id)));
    } else {
      setSelectedEmployeeIds((prev) => normalizeEmployeeIds([...prev, ...filteredIds]));
    }
  };

  const runBulkUpdate = async () => {
    if (!canEdit) return;
    const employeeIds = normalizeEmployeeIds(selectedEmployeeIds);
    if (!bulkDate || employeeIds.length === 0) {
      toast.error("Select employees and date for bulk update");
      return;
    }
    try {
      setBulkSaving(true);
      const res = await postApiWithToken(
        "/timesheets/attendance/matrix/bulk",
        {
          employeeIds,
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
      setSelectedEmployeeIds([]);
      fetchMatrix();
    } finally {
      setBulkSaving(false);
    }
  };

  const isEmployeeOnlyView = canViewSelf && !canViewAll;
  const selfRow = isEmployeeOnlyView ? (rows?.[0] || null) : null;
  const monthStart = new Date(`${month}-01T00:00:00`);
  const firstDayOffset = Number.isNaN(monthStart.getTime()) ? 0 : monthStart.getDay();
  const calendarSlots = Array.from(
    { length: firstDayOffset + daysInMonth },
    (_, idx) => (idx < firstDayOffset ? null : idx - firstDayOffset + 1)
  );
  const weekDayHeaders = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const summaryColumnCount = canViewSelfieData ? 8 : 7;

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
          <div className="text-xs text-muted-foreground">
            Tip: Hover any day cell to view check-in/out, shift, late/early, leave, holiday and override details.
                <p className="text-sm text-slate-600 text-right">
                  {canEdit ? "Click any day cell to override attendance." : "Read-only view."}
                </p>
          </div>

          {isEmployeeOnlyView ? (
            <>
              <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-blue-50 p-4 sm:p-5 mb-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-500">My Attendance Calendar</p>
                    <h3 className="text-lg font-semibold tracking-tight text-slate-900">
                      {selfRow ? `${selfRow.firstName || ""} ${selfRow.lastName || ""}`.trim() : "Attendance"}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Input
                      type="month"
                      value={month}
                      onChange={(e) => setMonth(e.target.value)}
                      className="w-full sm:w-44 bg-white/80"
                    />
                    <Button variant="outline" onClick={fetchMatrix}>
                      Refresh
                    </Button>
                  </div>
                </div>
              </div>

              {loading && (
                <div className="bg-card rounded-xl border p-5 space-y-3">
                  <Skeleton className="h-8 w-48 rounded-md" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <Skeleton className="h-20 w-full rounded-xl" />
                    <Skeleton className="h-20 w-full rounded-xl" />
                    <Skeleton className="h-20 w-full rounded-xl" />
                    <Skeleton className="h-20 w-full rounded-xl" />
                  </div>
                  <Skeleton className="h-72 w-full rounded-xl" />
                </div>
              )}

              {!loading && !selfRow && (
                <div className="bg-card rounded-xl border p-8 text-sm text-muted-foreground">
                  No attendance data found.
                </div>
              )}

              {!loading && selfRow && (
                <>
                  <div className="rounded-2xl border border-slate-200 bg-white card-shadow p-3 sm:p-4">
                    <div className="grid grid-cols-7 gap-2 mb-2">
                      {weekDayHeaders.map((day) => (
                        <div key={day} className="text-[11px] sm:text-xs text-center font-medium text-slate-500 py-1">
                          {day}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-2">
                      {calendarSlots.map((day, idx) => {
                        if (!day) {
                          return <div key={`blank-${idx}`} className="h-[86px] sm:h-[96px] rounded-xl bg-slate-50/60 border border-slate-100" />;
                        }
                        const isFuture = isFutureDay(day);
                        const cell = selfRow.days?.[day] || emptyCell;
                        const cellUi = getCellUi(cell, isFuture);
                        const hasAttendance = isPresentLikeStatus(cell.status) || cell.status === "pending_checkout";
                        const isLeaveOnlyDay = Boolean(cell.isOnLeave) && !hasAttendance;
                        const hideTimings = isLeaveOnlyDay || Boolean(cell.holidayName);
                        return (
                          <HoverCard key={day} openDelay={120} closeDelay={80}>
                            <HoverCardTrigger asChild>
                              <button
                                type="button"
                                onClick={() => !isFuture && openCellDetails(selfRow, day)}
                                className={`h-[86px] sm:h-[96px] w-full rounded-xl border p-2 text-left transition-all duration-200 ${cellUi.className} ${isFuture ? "opacity-60 cursor-default" : "hover:-translate-y-0.5 hover:shadow-sm"}`}
                                disabled={isFuture}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] sm:text-xs font-semibold">{String(day).padStart(2, "0")}</span>
                                  <span className="text-[10px] sm:text-[11px] font-semibold">{cellUi.shortLabel}</span>
                                </div>
                                <div className="mt-2 text-[10px] sm:text-[11px] leading-4 opacity-90">
                                  {hideTimings ? (
                                    <p>
                                      {cell.holidayName
                                        ? `Holiday: ${cell.holidayName}`
                                        : `Leave: ${cell.leaveType || "Approved leave"}`}
                                    </p>
                                  ) : (
                                    <>
                                      <p>{cell.checkInAt ? `In ${formatTimeInOrgTimeZone(cell.checkInAt)}` : "No check-in"}</p>
                                      <p>{cell.checkOutAt ? `Out ${formatTimeInOrgTimeZone(cell.checkOutAt)}` : "No check-out"}</p>
                                    </>
                                  )}
                                </div>
                              </button>
                            </HoverCardTrigger>
                            <HoverCardContent className="w-72">
                              <div className="space-y-1.5">
                                <p className="text-sm font-semibold">{month}-{String(day).padStart(2, "0")} • {cellUi.label}</p>
                                {!hideTimings && (
                                  <>
                                    <p className="text-xs text-muted-foreground">
                                      Check-in: {cell.checkInAt ? formatTimeInOrgTimeZone(cell.checkInAt) : "Not recorded"}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      Check-out: {cell.checkOutAt ? formatTimeInOrgTimeZone(cell.checkOutAt) : "Not recorded"}
                                    </p>
                                    {canViewSelfieData && (
                                      <>
                                        <p className="text-xs text-muted-foreground">
                                          Selfie: {cell.checkInSelfieProvided ? "Yes" : "No"}
                                        </p>
                                        {cell.checkInIp && (
                                          <p className="text-xs text-muted-foreground">
                                            Check-in IP: {cell.checkInIp}
                                          </p>
                                        )}
                                      </>
                                    )}
                                  </>
                                )}
                                {(cell.shiftName || cell.shiftCode) && (
                                  <p className="text-xs text-muted-foreground">
                                    Shift: {cell.shiftName || "Shift"}{cell.shiftCode ? ` (${cell.shiftCode})` : ""}
                                  </p>
                                )}
                                {cell.shiftStartTime && cell.shiftEndTime && (
                                  <p className="text-xs text-muted-foreground">
                                    Shift Time: {cell.shiftStartTime} - {cell.shiftEndTime}
                                  </p>
                                )}
                                {cell.holidayName && (
                                  <p className="text-xs text-amber-700">Holiday: {cell.holidayName}</p>
                                )}
                                {cell.isOnLeave && (
                                  <p className="text-xs text-violet-700">
                                    Leave: {cell.leaveType || "Approved leave"}
                                  </p>
                                )}
                                {(cell.lateByMinutes || 0) > 0 && (
                                  <p className="text-xs text-rose-700">Late by {cell.lateByMinutes} min</p>
                                )}
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-sky-50 p-4 sm:p-5 mb-4 shadow-sm">
                <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
                  <div className="w-full xl:w-auto">
                    {canEdit && (
                      <Button
                        variant="outline"
                        className="bg-white/90"
                        onClick={() => setShowBulkControls((prev) => !prev)}
                      >
                        {showBulkControls ? "Hide Bulk Update" : "Show Bulk Update"}
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 w-full xl:w-auto xl:ml-auto">
                    <Input
                      type="month"
                      value={month}
                      onChange={(e) => setMonth(e.target.value)}
                      className="w-full sm:w-44 bg-white/90"
                    />
                    <Input
                      placeholder="Search employee..."
                      value={search}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSearch(value);
                        setSearchTerm(value);
                      }}
                      className="w-full sm:w-72 bg-white/90"
                    />
                    <Button variant="outline" className="bg-white/90" onClick={fetchMatrix}>
                      Refresh
                    </Button>
                    <Button variant="outline" className="bg-white/90" onClick={downloadCsv}>
                      Export CSV
                    </Button>
                  </div>
                </div>

                {canEdit && (
                  <div
                    className={`mt-4 overflow-hidden transition-all duration-500 ease-out ${
                      showBulkControls ? "max-h-40 opacity-100 translate-y-0" : "max-h-0 opacity-0 -translate-y-1"
                    }`}
                  >
                    {showBulkControls && (
                      <div className="flex flex-wrap items-end justify-start gap-2 sm:gap-3">
                      <>
                        <Button variant="outline" className="bg-white/90" onClick={toggleSelectAllFiltered}>
                          Select/Unselect Filtered ({selectedEmployeeIds.length})
                        </Button>
                        <Input
                          type="date"
                          value={bulkDate}
                          onChange={(e) => setBulkDate(e.target.value)}
                          className="w-full sm:w-48 bg-white/90"
                        />
                        <Select value={bulkStatus} onValueChange={(v) => setBulkStatus(v as "present" | "absent")}>
                          <SelectTrigger className="w-full sm:w-40 bg-white/90">
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
                      </>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white/95 shadow-sm overflow-hidden">
                <div className="max-h-[72vh] overflow-auto">
                  <table className="w-full border-collapse min-w-[1100px]">
                  <thead>
                    <tr className="border-b border-slate-200">
                      {canEdit && (
                        <th className="sticky left-0 top-0 bg-white/95 backdrop-blur text-left p-3 min-w-[48px] z-30 text-slate-600">
                          Sel
                        </th>
                      )}
                      <th className={`sticky ${canEdit ? "left-[48px]" : "left-0"} top-0 bg-white/95 backdrop-blur text-left p-3 min-w-[220px] z-30 text-slate-700`}>
                        Employee
                      </th>
                      {Array.from({ length: daysInMonth }).map((_, idx) => (
                        <th key={idx + 1} className="sticky top-0 bg-white/95 backdrop-blur z-20 text-center p-2 text-sm text-slate-500 min-w-[42px]">
                          {idx + 1}
                        </th>
                      ))}
                      <th className="sticky top-0 bg-white/95 backdrop-blur z-20 text-center p-2 text-sm text-slate-500 min-w-[90px]">
                        Present
                      </th>
                      <th className="sticky top-0 bg-white/95 backdrop-blur z-20 text-center p-2 text-sm text-slate-500 min-w-[120px]">
                        Pending Checkout
                      </th>
                      <th className="sticky top-0 bg-white/95 backdrop-blur z-20 text-center p-2 text-sm text-slate-500 min-w-[90px]">
                        Absent
                      </th>
                      <th className="sticky top-0 bg-white/95 backdrop-blur z-20 text-center p-2 text-sm text-slate-500 min-w-[90px]">
                        On Leave
                      </th>
                      <th className="sticky top-0 bg-white/95 backdrop-blur z-20 text-center p-2 text-sm text-slate-500 min-w-[90px]">
                        Week Off
                      </th>
                      <th className="sticky top-0 bg-white/95 backdrop-blur z-20 text-center p-2 text-sm text-slate-500 min-w-[90px]">
                        Holiday
                      </th>
                      {canViewSelfieData && (
                        <th className="sticky top-0 bg-white/95 backdrop-blur z-20 text-center p-2 text-sm text-slate-500 min-w-[90px]">
                          Selfie
                        </th>
                      )}
                      <th className="sticky top-0 bg-white/95 backdrop-blur z-20 text-center p-2 text-sm text-slate-500 min-w-[90px]">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr>
                        <td colSpan={daysInMonth + summaryColumnCount + (canEdit ? 1 : 0)} className="p-3">
                          <div className="space-y-2">
                            {Array.from({ length: 6 }).map((_, idx) => (
                              <Skeleton key={`attendance-row-skeleton-${idx}`} className="h-10 w-full rounded-md" />
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                    {!loading && filteredRows.length === 0 && (
                      <tr>
                        <td colSpan={daysInMonth + summaryColumnCount + (canEdit ? 1 : 0)} className="p-4 text-muted-foreground">
                          No employees found.
                        </td>
                      </tr>
                    )}
                    {!loading && visibleRows.map((row) => (
                      <tr key={row.employeeId} className="border-b border-slate-100 hover:bg-slate-50/55 transition-colors">
                        {canEdit && (
                          <td className="sticky left-0 bg-white p-2 z-20 text-center">
                            <input
                              type="checkbox"
                              checked={selectedEmployeeIds.includes(row.employeeId)}
                              onChange={() => toggleEmployeeSelection(row.employeeId)}
                            />
                          </td>
                        )}
                        <td className={`sticky ${canEdit ? "left-[48px]" : "left-0"} bg-white p-3 z-10`}>
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
                          const cellUi = getCellUi(cell, isFuture);

                          return (
                            <td key={day} className="p-1">
                              <button
                                type="button"
                                onClick={() => !isNonInteractive && openCellDetails(row, day)}
                                disabled={isNonInteractive}
                                title={formatHoverInfo(cell)}
                                className={`w-full h-8 rounded-md text-xs font-semibold border transition-all duration-200 ${cellUi.className} ${
                                  isNonInteractive ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:opacity-95 hover:-translate-y-[1px] hover:shadow-sm"
                                }`}
                              >
                                {cellUi.shortLabel}
                              </button>
                            </td>
                          );
                        })}
                        {(() => {
                          const totals = getEmployeeTotals(row);
                          return (
                            <>
                              <td className="text-center text-sm font-medium text-emerald-700">
                                {totals.presentDays.toFixed(1)}
                              </td>
                              <td className="text-center text-sm font-medium text-orange-700">
                                {totals.pendingCheckoutDays}
                              </td>
                              <td className="text-center text-sm font-medium text-rose-700">
                                {totals.absentDays.toFixed(1)}
                              </td>
                              <td className="text-center text-sm font-medium text-violet-700">
                                {totals.onLeaveDays}
                              </td>
                              <td className="text-center text-sm font-medium text-sky-700">
                                {totals.weekOffDays}
                              </td>
                              <td className="text-center text-sm font-medium text-amber-700">
                                {totals.holidayDays}
                              </td>
                              {canViewSelfieData && (
                                <td className="text-center text-sm font-medium text-slate-700">
                                  {totals.selfieDays}
                                </td>
                              )}
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

              {canViewAll && pagination && (
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>
                      Showing {rows.length === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1}
                      {" - "}
                      {(pagination.page - 1) * pagination.limit + rows.length}
                      {" of "}
                      {pagination.total}
                    </span>
                    <Select
                      value={String(pageSize)}
                      onValueChange={(value) => setPageSize(Number(value))}
                    >
                      <SelectTrigger className="h-8 w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="25">25 rows</SelectItem>
                        <SelectItem value="50">50 rows</SelectItem>
                        <SelectItem value="100">100 rows</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Pagination className="justify-end">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (pagination.page > 1) setCurrentPage((prev) => prev - 1);
                          }}
                          className={pagination.page <= 1 ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationLink href="#" isActive>
                          {pagination.page}/{Math.max(1, pagination.totalPages)}
                        </PaginationLink>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (pagination.page < pagination.totalPages) setCurrentPage((prev) => prev + 1);
                          }}
                          className={pagination.page >= pagination.totalPages ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 text-xs mt-3">
                <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1">
                  <span className="inline-block h-2.5 w-2.5 rounded bg-emerald-500" />
                  Full Day Present
                </div>
                <div className="flex items-center gap-2 rounded-full border border-lime-200 bg-lime-50 px-3 py-1">
                  <span className="inline-block h-2.5 w-2.5 rounded bg-lime-500" />
                  Half Day Present
                </div>
                <div className="flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1">
                  <span className="inline-block h-2.5 w-2.5 rounded bg-orange-500" />
                  Pending Checkout
                </div>
                <div className="flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1">
                  <span className="inline-block h-2.5 w-2.5 rounded bg-rose-500" />
                  Absent
                </div>
                <div className="flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1">
                  <span className="inline-block h-2.5 w-2.5 rounded bg-sky-500" />
                  Week Off
                </div>
                <div className="flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1">
                  <span className="inline-block h-2.5 w-2.5 rounded bg-violet-500" />
                  Approved Leave
                </div>
                <div className="flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1">
                  <span className="inline-block h-2.5 w-2.5 rounded bg-indigo-500" />
                  Present + Leave
                </div>
                <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1">
                  <span className="inline-block h-2.5 w-2.5 rounded bg-amber-500" />
                  Holiday
                </div>
              </div>
            </>
          )}
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{canEdit ? "Update Attendance" : "Attendance Details"}</DialogTitle>
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
              {canViewSelfieData && selectedAttendanceSnapshot && (
                <div className="mb-2 pb-2 border-b">
                  <p className="text-xs text-muted-foreground">
                    Selfie captured: {selectedAttendanceSnapshot.checkInSelfieProvided ? "Yes" : "No"}
                  </p>
                  {selectedAttendanceSnapshot.checkInIp && (
                    <p className="text-xs text-muted-foreground">
                      Check-in IP: {selectedAttendanceSnapshot.checkInIp}
                    </p>
                  )}
                  {selectedAttendanceSnapshot.checkInSelfieImage && (
                    <div className="mt-2">
                      <p className="text-xs text-muted-foreground mb-1">Selfie proof:</p>
                      <img
                        src={selectedAttendanceSnapshot.checkInSelfieImage}
                        alt="Selfie proof"
                        className="max-h-44 rounded border object-contain bg-slate-50"
                      />
                    </div>
                  )}
                </div>
              )}
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
