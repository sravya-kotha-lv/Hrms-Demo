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
import { getApiWithToken, putApiWithToken } from "@/services/apiWrapper";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

type DayCell = {
  status: "present" | "absent";
  checkInAt: string | null;
  checkOutAt: string | null;
  overriddenBy: string | null;
  overriddenAt: string | null;
  isOnLeave: boolean;
  leaveType: string | null;
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
  overriddenBy: null,
  overriddenAt: null,
  isWeekOff: false,
  holidayName: null,
  isOnLeave: false,
  leaveType: ""
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

  const openOverride = (row: EmployeeRow, day: number) => {
    if (!canEdit) return;
    setSelectedEmployee(row);
    setSelectedDay(day);
    setSelectedStatus((row.days?.[day]?.status || "absent") as "present" | "absent");
    setOpen(true);
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
    if (cell.isWeekOff) parts.push("Week Off");
    if (cell.holidayName) parts.push(`Holiday: ${cell.holidayName}`);
    if (cell.checkInAt) parts.push(`Check-in: ${new Date(cell.checkInAt).toLocaleTimeString()}`);
    if (cell.checkOutAt) parts.push(`Check-out: ${new Date(cell.checkOutAt).toLocaleTimeString()}`);
    if (cell.isOnLeave) parts.push(`Approved Leave: ${cell.leaveType || "Leave"}`);
    if (cell.overriddenBy) parts.push(`Overridden by: ${cell.overriddenBy}`);
    if (cell.overriddenAt) parts.push(`Overridden at: ${new Date(cell.overriddenAt).toLocaleString()}`);
    return parts.join(" | ") || "No details";
  };

  const getEmployeeTotals = (row: EmployeeRow) => {
    let presentDays = 0;
    let absentDays = 0;
    let onLeaveDays = 0;
    let weekOffDays = 0;
    for (let day = 1; day <= daysInMonth; day += 1) {
      const cell = row.days?.[day] || emptyCell;
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
      if (!cell.holidayName) {
        absentDays += 1;
      }
    }
    return {
      presentDays,
      absentDays,
      onLeaveDays,
      weekOffDays,
      totalDays: daysInMonth
    };
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
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <Input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-44"
              />
              <Input
                placeholder="Search employee..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64"
              />
              <Button variant="outline" onClick={fetchMatrix}>
                Refresh
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              {canEdit
                ? "Click any day cell to override attendance."
                : "Read-only view."}
            </div>
          </div>

          <div className="bg-card rounded-xl card-shadow overflow-auto">
            <table className="w-full border-collapse min-w-[1100px]">
              <thead>
                <tr className="border-b">
                  <th className="sticky left-0 bg-card text-left p-3 min-w-[220px] z-10">
                    Employee
                  </th>
                  {Array.from({ length: daysInMonth }).map((_, idx) => (
                    <th key={idx + 1} className="text-center p-2 text-sm text-muted-foreground min-w-[42px]">
                      {idx + 1}
                    </th>
                  ))}
                  <th className="text-center p-2 text-sm text-muted-foreground min-w-[90px]">
                    Present
                  </th>
                  <th className="text-center p-2 text-sm text-muted-foreground min-w-[90px]">
                    Absent
                  </th>
                  <th className="text-center p-2 text-sm text-muted-foreground min-w-[90px]">
                    On Leave
                  </th>
                  <th className="text-center p-2 text-sm text-muted-foreground min-w-[90px]">
                    Week Off
                  </th>
                  <th className="text-center p-2 text-sm text-muted-foreground min-w-[90px]">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={daysInMonth + 6} className="p-4 text-muted-foreground">
                      Loading attendance...
                    </td>
                  </tr>
                )}
                {!loading && filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={daysInMonth + 6} className="p-4 text-muted-foreground">
                      No employees found.
                    </td>
                  </tr>
                )}
                {!loading && filteredRows.map((row) => (
                  <tr key={row.employeeId} className="border-b">
                    <td className="sticky left-0 bg-card p-3 z-10">
                      <div className="font-medium">
                        {`${row.firstName || ""} ${row.lastName || ""}`.trim() || "-"}
                      </div>
                      <div className="text-xs text-muted-foreground">{row.employeeCode || "-"}</div>
                    </td>
                    {Array.from({ length: daysInMonth }).map((_, idx) => {
                      const day = idx + 1;
                      const cell = row.days?.[day] || emptyCell;
                      const isPresent = cell.status === "present";
                      const isLeave = cell.isOnLeave;
                      const isWeekOff = cell.isWeekOff;
                      const isHoliday = Boolean(cell.holidayName);
                      let colorClass = "";
                      if (isLeave) {
                        colorClass = "bg-violet-100 text-violet-700 border-violet-300";
                      } else if (isHoliday) {
                        colorClass = "bg-amber-100 text-amber-700 border-amber-300";
                      } else if (isWeekOff) {
                        colorClass = "bg-sky-100 text-sky-700 border-sky-300";
                      } else if (isPresent) {
                        colorClass = "bg-emerald-100 text-emerald-700 border-emerald-300";
                      } else {
                        colorClass = "bg-rose-100 text-rose-700 border-rose-300";
                      }

                      return (
                        <td key={day} className="p-1">
                          <button
                            type="button"
                            onClick={() => openOverride(row, day)}
                            disabled={!canEdit}
                            title={formatHoverInfo(cell)}
                            className={`w-full h-8 rounded text-xs font-medium border ${colorClass} ${
                              canEdit ? "cursor-pointer hover:opacity-90" : "cursor-default"
                            }`}
                          >
                            {isLeave ? "L" : isHoliday ? "H" : isWeekOff ? "W" : isPresent ? "P" : "A"}
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

          <div className="flex items-center gap-4 text-xs mt-3">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded bg-emerald-100 border border-emerald-300" />
              Present
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveOverride} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Attendance;
