import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  CheckCircle,
  XCircle,
  Clock,
  CalendarDays,
  ClipboardCheck,
  Timer,
  Users,
  ChevronLeft,
  ChevronRight,
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { getApiWithToken, postApiWithToken, putApiWithToken } from "@/services/apiWrapper";
import { toast } from "sonner";
import { hasPermission } from "@/utils/auth";

const toDateInput = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getWeekStart = (value: Date) => {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = (day + 6) % 7; // Monday start
  d.setDate(d.getDate() - diff);
  return d;
};

const buildWeekDates = (weekStart: Date) => {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
};

const normalizeEntries = (weekDates: Date[], rawEntries: any[]) => {
  const byDate = new Map<string, any>();
  (rawEntries || []).forEach((entry) => {
    const key = toDateInput(new Date(entry.date));
    if (!byDate.has(key)) {
      byDate.set(key, {
        date: key,
        hours: Number(entry.hours || 0),
        notes: entry.notes || ""
      });
    }
  });

  return weekDates.map((date) => {
    const key = toDateInput(date);
    return (
      byDate.get(key) || {
        date: key,
        hours: 0,
        notes: ""
      }
    );
  });
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "approved":
      return (
        <Badge className="status-badge status-active gap-1">
          <CheckCircle className="w-3 h-3" /> Approved
        </Badge>
      );
    case "submitted":
      return (
        <Badge className="status-badge status-pending gap-1">
          <Clock className="w-3 h-3" /> Submitted
        </Badge>
      );
    case "rejected":
      return (
        <Badge className="status-badge status-rejected gap-1">
          <XCircle className="w-3 h-3" /> Rejected
        </Badge>
      );
    default:
      return <Badge variant="secondary">Draft</Badge>;
  }
};

const Timesheets = () => {
  const [selectedDate] = useState(toDateInput(new Date()));
  const [weekStartDate, setWeekStartDate] = useState(getWeekStart(new Date()));
  const [attendanceToday, setAttendanceToday] = useState<any | null>(null);
  const [timesheet, setTimesheet] = useState<any | null>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"all" | "my">("my");
  const [weeklyList, setWeeklyList] = useState<any[]>([]);
  const [onlineList, setOnlineList] = useState<any[]>([]);
  const [onLeaveList, setOnLeaveList] = useState<any[]>([]);
  const [myLeaveDates, setMyLeaveDates] = useState<string[]>([]);
  const [weekOffDays, setWeekOffDays] = useState<number[]>([]);
  const [minWorkHoursPerDay, setMinWorkHoursPerDay] = useState(8);
  const [minHalfDayHours, setMinHalfDayHours] = useState(4);
  const [weekLoading, setWeekLoading] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"approve" | "reject">("approve");
  const [selectedTimesheet, setSelectedTimesheet] = useState<any | null>(null);
  const [comment, setComment] = useState("");
  const [showOnlineCard, setShowOnlineCard] = useState(true);
  const [showOnLeaveCard, setShowOnLeaveCard] = useState(true);
  const [showTeamTimesheets, setShowTeamTimesheets] = useState(true);

  const weekStart = useMemo(() => getWeekStart(weekStartDate), [weekStartDate]);
  const weekDates = useMemo(() => buildWeekDates(weekStart), [weekStart]);
  const isCurrentMonthWeek = useMemo(() => {
    const now = new Date();
    return (
      weekStart.getFullYear() === now.getFullYear() &&
      weekStart.getMonth() === now.getMonth()
    );
  }, [weekStart]);
  const weekStartKey = useMemo(() => toDateInput(weekStart), [weekStart]);
  const timesheetWeekKey = useMemo(() => {
    if (!timesheet?.weekStart) return "";
    return toDateInput(new Date(timesheet.weekStart));
  }, [timesheet?.weekStart]);
  const isWeekSynced = !timesheet?._id || timesheetWeekKey === weekStartKey;
  const weekOffCount = useMemo(
    () => weekDates.filter((date) => weekOffDays.includes(date.getDay())).length,
    [weekDates, weekOffDays]
  );
  const weekTotalHours = useMemo(
    () =>
      entries.reduce((sum, entry, index) => {
        const date = weekDates[index];
        if (date && weekOffDays.includes(date.getDay())) return sum;
        return sum + (Number(entry.hours) || 0);
      }, 0),
    [entries, weekDates, weekOffDays]
  );
  const minWeeklyHours = useMemo(
    () => minWorkHoursPerDay * (7 - weekOffCount),
    [minWorkHoursPerDay, weekOffCount]
  );

  const getDayStatus = (dateValue: string | Date, hoursValue: number) => {
    const day = new Date(dateValue).getDay();
    if (weekOffDays.includes(day)) return { label: "WO", tone: "muted" };
    if (hoursValue >= minWorkHoursPerDay) return { label: "F", tone: "good" };
    if (hoursValue >= minHalfDayHours) return { label: "H", tone: "warn" };
    return { label: "A", tone: "bad" };
  };

  const loadAttendanceToday = async () => {
    const res = await getApiWithToken(`/timesheets/attendance/my?date=${selectedDate}`);
    if (res?.success) {
      const record = (res.data || [])[0];
      setAttendanceToday(record || null);
    }
  };

  const loadWeekly = async () => {
    setWeekLoading(true);
    setTimesheet(null);
    setEntries(normalizeEntries(weekDates, []));
    const resAll = await getApiWithToken("/timesheets/weekly");
    if (resAll?.success) {
      setWeeklyList(resAll.data || []);
      setViewMode("all");
    } else {
      const resMy = await getApiWithToken("/timesheets/weekly/my");
      if (resMy?.success) {
        setWeeklyList(resMy.data || []);
      }
      setViewMode("my");
    }

    const weekStartIso = toDateInput(weekStart);
    const resWeek = await getApiWithToken(`/timesheets/weekly/my?weekStart=${weekStartIso}`);
    if (resWeek?.success && resWeek.data) {
      setTimesheet(resWeek.data);
      setEntries(normalizeEntries(weekDates, resWeek.data.entries || []));
    } else {
      setTimesheet(null);
      setEntries(normalizeEntries(weekDates, []));
    }
    setWeekLoading(false);
  };

  const loadOnline = async () => {
    const res = await getApiWithToken("/timesheets/online");
    if (res?.success) {
      setOnlineList(res.data || []);
    }
  };

  const loadOnLeave = async () => {
    const res = await getApiWithToken("/timesheets/on-leave");
    if (res?.success) {
      setOnLeaveList(res.data || []);
    }
  };

  const loadMyLeavesForWeek = async () => {
    const start = toDateInput(weekStart);
    const end = toDateInput(weekDates[6]);
    const res = await getApiWithToken(`/leaves/my-range?startDate=${start}&endDate=${end}`);
    if (res?.success) {
      const dates: string[] = [];
      (res.data || []).forEach((leave: any) => {
        const from = new Date(leave.fromDate);
        const to = new Date(leave.toDate);
        const current = new Date(from);
        while (current <= to) {
          dates.push(toDateInput(new Date(current)));
          current.setDate(current.getDate() + 1);
        }
      });
      setMyLeaveDates(dates);
    } else {
      setMyLeaveDates([]);
    }
  };

  const loadWeekOffs = async () => {
    const res = await getApiWithToken("/week-offs");
    if (res?.success) {
      setWeekOffDays(res.data?.weekOffDays || []);
    }
  };

  const loadOrgSettings = async () => {
    const res = await getApiWithToken("/org-settings");
    if (res?.success) {
      setMinWorkHoursPerDay(
        typeof res.data?.minWorkHoursPerDay === "number" ? res.data.minWorkHoursPerDay : 8
      );
      setMinHalfDayHours(
        typeof res.data?.minHalfDayHours === "number" ? res.data.minHalfDayHours : 4
      );
    }
  };

  useEffect(() => {
    loadAttendanceToday();
  }, []);

  useEffect(() => {
    loadWeekly();
    loadOnline();
    loadOnLeave();
    loadWeekOffs();
    loadOrgSettings();
    loadMyLeavesForWeek();
  }, [weekStart.getTime()]);

  const handleCheckIn = async () => {
    const res = await postApiWithToken("/timesheets/check-in", {});
    if (res?.success) {
      toast.success("Checked in");
      loadAttendanceToday();
      loadOnline();
    } else {
      toast.error(res?.message || "Check-in failed");
    }
  };

  const handleCheckOut = async () => {
    const res = await postApiWithToken("/timesheets/check-out", {});
    if (res?.success) {
      toast.success("Checked out");
      loadAttendanceToday();
      loadOnline();
    } else {
      toast.error(res?.message || "Check-out failed");
    }
  };

  const handleEntryChange = (index: number, field: string, value: any) => {
    setEntries((prev) =>
      prev.map((entry, idx) =>
        idx === index ? { ...entry, [field]: value } : entry
      )
    );
  };

  const createDraft = async () => {
    setSaving(true);
    const payload = {
      weekStart: toDateInput(weekStart),
      entries: entries.map((entry) => ({
        date: entry.date,
        hours: Number(entry.hours) || 0,
        notes: entry.notes || ""
      }))
    };
    const res = await postApiWithToken("/timesheets/weekly", payload);
    setSaving(false);
    if (res?.success) {
      toast.success("Timesheet created");
      setTimesheet(res.data);
      loadWeekly();
    } else {
      toast.error(res?.message || "Create failed");
    }
  };

  const saveDraft = async () => {
    if (!timesheet?._id) return;
    setSaving(true);
    const payload = {
      weekStart: weekStartKey,
      entries: entries.map((entry) => ({
        date: entry.date,
        hours: Number(entry.hours) || 0,
        notes: entry.notes || ""
      }))
    };
    
    const res = await putApiWithToken(`/timesheets/weekly/${timesheet._id}`, payload);
    setSaving(false);
    if (res?.success) {
      toast.success("Timesheet updated");
      setTimesheet(res.data);
      loadWeekly();
    } else {
      toast.error(res?.message || "Update failed");
    }
  };

  const submitTimesheet = async () => {
    if (!timesheet?._id) return;
    setSaving(true);
    const payload = {
      weekStart: weekStartKey,
      entries: entries.map((entry) => ({
        date: entry.date,
        hours: Number(entry.hours) || 0,
        notes: entry.notes || ""
      }))
    };
    const res = await postApiWithToken(
      `/timesheets/weekly/${timesheet._id}/submit`,
      payload
    );
    setSaving(false);
    if (res?.success) {
      toast.success("Timesheet submitted");
      setTimesheet(res.data);
      loadWeekly();
    } else {
      toast.error(res?.message || "Submit failed");
    }
  };

  const recallTimesheet = async () => {
    if (!timesheet?._id) return;
    setSaving(true);
    const res = await postApiWithToken(`/timesheets/weekly/${timesheet._id}/recall`, {});
    setSaving(false);
    if (res?.success) {
      toast.success("Timesheet recalled");
      setTimesheet(res.data);
      loadWeekly();
    } else {
      toast.error(res?.message || "Recall failed");
    }
  };

  const openActionDialog = (ts: any, type: "approve" | "reject") => {
    setSelectedTimesheet(ts);
    setActionType(type);
    setComment("");
    setActionDialogOpen(true);
  };

  const submitAction = async () => {
    if (!selectedTimesheet?._id) return;
    const payload: any = { status: actionType === "approve" ? "approved" : "rejected" };
    if (payload.status === "rejected") payload.rejectionReason = comment;

    const res = await putApiWithToken(
      `/timesheets/weekly/${selectedTimesheet._id}/action`,
      payload
    );
    if (res?.success) {
      toast.success(`Timesheet ${payload.status}`);
      setActionDialogOpen(false);
      loadWeekly();
    } else {
      toast.error(res?.message || "Action failed");
    }
  };

  const isCheckedIn = attendanceToday?.checkInAt && !attendanceToday?.checkOutAt;
  const isCheckedOut = attendanceToday?.checkInAt && attendanceToday?.checkOutAt;

  const canCheckIn = hasPermission("TIMESHEET_CHECKIN_SELF");
  const canCheckOut = hasPermission("TIMESHEET_CHECKOUT_SELF");
  const canSubmit = hasPermission("TIMESHEET_SUBMIT_SELF");
  const canEdit = hasPermission("TIMESHEET_EDIT_SELF");
  const canCreate = hasPermission("TIMESHEET_CREATE_SELF");
  const canAction = hasPermission("TIMESHEET_ACTION");
  const canRecall = hasPermission("TIMESHEET_RECALL_SELF");

  const timesheetLocked =
    timesheet?.status && ["submitted", "approved"].includes(timesheet.status);

  const shiftWeek = (direction: -1 | 1) => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + direction * 7);
    setWeekStartDate(next);
  };

  return (
    <MainLayout
      title="Timesheets"
      breadcrumb={[{ label: "Home", href: "/" }, { label: "Timesheets" }]}
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <motion.div className="stat-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Timer className="w-4 h-4" />
            Today
          </div>
          <div className="text-2xl font-semibold">
            {isCheckedOut
              ? "Checked Out"
              : isCheckedIn
                ? "Checked In"
                : "Not Checked In"}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            {attendanceToday?.checkInAt
              ? new Date(attendanceToday.checkInAt).toLocaleTimeString()
              : "-"}
          </div>
        </motion.div>

        <motion.div
          className="stat-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Users className="w-4 h-4" />
            Online Now
          </div>
          <div className="text-2xl font-semibold">{onlineList.length}</div>
          <div className="text-sm text-muted-foreground mt-1">
            active employees
          </div>
        </motion.div>

        <motion.div
          className="stat-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <ClipboardCheck className="w-4 h-4" />
            Week Status
          </div>
          <div className="text-2xl font-semibold">
            {timesheet?.status ? timesheet.status : "Draft"}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            {toDateInput(weekStart)} - {toDateInput(weekDates[6])}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Week Total: {weekTotalHours}h · Min: {minWeeklyHours}h
          </div>
        </motion.div>

        <motion.div
          className="stat-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Users className="w-4 h-4" />
            On Leave Today
          </div>
          <div className="text-2xl font-semibold">{onLeaveList.length}</div>
          <div className="text-sm text-muted-foreground mt-1">
            approved leaves
          </div>
        </motion.div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Button onClick={handleCheckIn} disabled={!canCheckIn || isCheckedIn || isCheckedOut}>
          Check In
        </Button>
        <Button variant="outline" onClick={handleCheckOut} disabled={!canCheckOut || !isCheckedIn}>
          Check Out
        </Button>
        <div className="ml-auto text-xs text-muted-foreground">
          Today: {toDateInput(new Date())}
        </div>
      </div>

      {viewMode === "all" && (
        <motion.div
          className="bg-card rounded-xl card-shadow overflow-hidden mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Online Employees</h3>
              <p className="text-sm text-muted-foreground">Checked in and currently working</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowOnlineCard((prev) => !prev)}
              aria-label="Toggle Online Employees"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${showOnlineCard ? "rotate-0" : "-rotate-90"}`} />
            </Button>
          </div>
          {showOnlineCard && (
            <Table>
              <TableHeader>
                <TableRow className="table-header">
                  <TableHead>Employee</TableHead>
                  <TableHead>Check In</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {onlineList.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-muted-foreground">
                      No one is online right now.
                    </TableCell>
                  </TableRow>
                )}
                {onlineList.map((item) => (
                  <TableRow key={item._id} className="table-row-hover">
                    <TableCell>
                      {item.employeeId
                        ? `${item.employeeId.firstName || ""} ${item.employeeId.lastName || ""}`.trim()
                        : "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.checkInAt ? new Date(item.checkInAt).toLocaleTimeString() : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </motion.div>
      )}

      {viewMode === "all" && (
        <motion.div
          className="bg-card rounded-xl card-shadow overflow-hidden mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">On Leave Today</h3>
              <p className="text-sm text-muted-foreground">Approved leaves in effect today</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowOnLeaveCard((prev) => !prev)}
              aria-label="Toggle On Leave"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${showOnLeaveCard ? "rotate-0" : "-rotate-90"}`} />
            </Button>
          </div>
          {showOnLeaveCard && (
            <Table>
              <TableHeader>
                <TableRow className="table-header">
                  <TableHead>Employee</TableHead>
                  <TableHead>Leave Type</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {onLeaveList.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      No one is on leave today.
                    </TableCell>
                  </TableRow>
                )}
                {onLeaveList.map((item) => (
                  <TableRow key={item._id} className="table-row-hover">
                    <TableCell>
                      {item.employeeId
                        ? `${item.employeeId.firstName || ""} ${item.employeeId.lastName || ""}`.trim()
                        : "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.leaveTypeId?.name || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.fromDate ? toDateInput(new Date(item.fromDate)) : "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.toDate ? toDateInput(new Date(item.toDate)) : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </motion.div>
      )}

      <motion.div
        className="bg-card rounded-xl card-shadow overflow-hidden mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-border">
          <div>
            <h3 className="text-lg font-semibold">Weekly Timesheet</h3>
            <p className="text-sm text-muted-foreground">
              {toDateInput(weekStart)} - {toDateInput(weekDates[6])}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {timesheet?._id ? getStatusBadge(timesheet.status) : <Badge>Draft</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => shiftWeek(-1)}
              aria-label="Previous week"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="text-sm font-medium">
              {toDateInput(weekStart)} - {toDateInput(weekDates[6])}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => shiftWeek(1)}
              aria-label="Next week"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <div className="ml-3 px-2.5 py-1 rounded-md bg-primary/10 text-primary text-sm font-semibold">
              Worked hours: {weekTotalHours} / {minWeeklyHours}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {timesheet?.status === "submitted" && "Waiting for approval"}
            {timesheet?.status === "approved" && "Approved"}
            {timesheet?.status === "rejected" && "Rejected - update and resubmit"}
          </div>
        </div>
        {weekLoading && (
          <div className="px-6 py-2 text-xs text-muted-foreground">
            Loading week data...
          </div>
        )}
        {!isWeekSynced && !weekLoading && (
          <div className="px-6 py-2 text-xs text-amber-700 bg-amber-50 border-b border-amber-200">
            Week changed. Please wait for the correct week data to load before submitting.
          </div>
        )}
        {!isCurrentMonthWeek && (
          <div className="px-6 py-2 text-xs text-red-700 bg-red-50 border-b border-red-200">
            You can only submit timesheets for the current month.
          </div>
        )}
        {timesheet?.status === "rejected" && timesheet?.rejectionReason && (
          <div className="px-6 py-2 text-xs text-red-700 bg-red-50 border-b border-red-200">
            Rejection reason: {timesheet.rejectionReason}
          </div>
        )}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="table-header">
                <TableHead className="w-32">Field</TableHead>
                {weekDates.map((date) => {
                  const isWeekOff = weekOffDays.includes(date.getDay());
                  return (
                    <TableHead key={date.toISOString()} className={isWeekOff ? "opacity-60" : ""}>
                      <div className="flex flex-col">
                        <span>
                          {date.toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric"
                          })}
                        </span>
                        {isWeekOff && (
                          <span className="text-xs text-muted-foreground">Week Off</span>
                        )}
                      </div>
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="table-row-hover">
                <TableCell className="font-medium">Hours</TableCell>
                {weekDates.map((date, index) => {
                  const isWeekOff = weekOffDays.includes(date.getDay());
                  const isLeave = myLeaveDates.includes(toDateInput(date));
                  const rawHours = Number(entries[index]?.hours || 0);
                  const isInvalid =
                    rawHours > 0 && rawHours < minHalfDayHours;
                  return (
                    <TableCell key={date.toISOString()}>
                      {isWeekOff ? (
                        <div className="text-xs text-muted-foreground">
                          Week Off
                          <div>Full day: {minWorkHoursPerDay}h</div>
                        </div>
                      ) : isLeave ? (
                        <div className="text-xs text-muted-foreground">
                          On Leave
                        </div>
                      ) : (
                        <>
                          <Input
                            type="number"
                            min={0}
                            max={24}
                            step={0.5}
                            value={entries[index]?.hours ?? 0}
                            onChange={(e) => handleEntryChange(index, "hours", e.target.value)}
                            disabled={timesheetLocked || !canEdit}
                            className={isInvalid ? "border-red-500" : ""}
                          />
                          {isInvalid && (
                            <div className="text-xs text-red-500 mt-1">
                              Min half day: {minHalfDayHours}h
                            </div>
                          )}
                        </>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
              <TableRow className="table-row-hover">
                <TableCell className="font-medium">Notes</TableCell>
                {weekDates.map((date, index) => {
                  const isWeekOff = weekOffDays.includes(date.getDay());
                  const isLeave = myLeaveDates.includes(toDateInput(date));
                  return (
                    <TableCell key={date.toISOString()}>
                      <Input
                        value={entries[index]?.notes ?? ""}
                        onChange={(e) => handleEntryChange(index, "notes", e.target.value)}
                        placeholder={isWeekOff ? "Week off" : "Work summary"}
                        disabled={timesheetLocked || isWeekOff || isLeave || !canEdit}
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <div className="px-6 py-2 text-xs text-muted-foreground">
          Full day: {minWorkHoursPerDay}h · Half day: {minHalfDayHours}h ·
          Minimum weekly hours: {minWeeklyHours}h
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <div className="mr-auto text-xs text-muted-foreground">
            Submitting for week: {toDateInput(weekStart)} - {toDateInput(weekDates[6])}
          </div>
          {!timesheet?._id && canCreate && (
            <Button onClick={createDraft} disabled={saving}>
              Create Draft
            </Button>
          )}
          {timesheet?._id && !timesheetLocked && canEdit && (
            <Button variant="outline" onClick={saveDraft} disabled={saving}>
              Save Draft
            </Button>
          )}
          {timesheet?._id && !timesheetLocked && canSubmit && (
            <Button onClick={submitTimesheet} disabled={saving || !isCurrentMonthWeek}>
              Submit Timesheet
            </Button>
          )}
          {timesheet?._id && timesheet?.status === "approved" && canRecall && (
            <Button variant="outline" onClick={recallTimesheet} disabled={saving}>
              Recall
            </Button>
          )}
        </div>
      </motion.div>

      {viewMode === "all" && canAction && (
        <motion.div
          className="bg-card rounded-xl card-shadow overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Team Timesheets</h3>
              <p className="text-sm text-muted-foreground">Approve or reject weekly submissions</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowTeamTimesheets((prev) => !prev)}
              aria-label="Toggle Team Timesheets"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${showTeamTimesheets ? "rotate-0" : "-rotate-90"}`} />
            </Button>
          </div>
          {showTeamTimesheets && (
            <Table>
              <TableHeader>
                <TableRow className="table-header">
                  <TableHead>Employee</TableHead>
                  <TableHead>Week</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total Hours</TableHead>
                  <TableHead className="w-36">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {weeklyList.map((item) => (
                  <TableRow key={item._id} className="table-row-hover">
                    <TableCell>
                      {item.employeeId
                        ? `${item.employeeId.firstName || ""} ${item.employeeId.lastName || ""}`.trim()
                        : "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {toDateInput(new Date(item.weekStart))} - {toDateInput(new Date(item.weekEnd))}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 text-xs">
                        {(item.entries || []).map((entry: any, idx: number) => {
                          const status = getDayStatus(entry.date, Number(entry.hours || 0));
                          const base =
                            "px-1.5 py-0.5 rounded border text-[10px] leading-4";
                          const tone =
                            status.tone === "good"
                              ? "bg-green-50 text-green-700 border-green-200"
                              : status.tone === "warn"
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : status.tone === "bad"
                                  ? "bg-red-50 text-red-700 border-red-200"
                                  : "bg-muted text-muted-foreground";

                          const label = new Date(entry.date).toLocaleDateString("en-US", {
                            weekday: "short"
                          });

                          return (
                            <span
                              key={`${item._id}-${idx}`}
                              className={`${base} ${tone}`}
                              title={`${label}: ${status.label} (${Number(entry.hours || 0)}h)`}
                            >
                              {label[0]}
                              {status.label}
                            </span>
                          );
                        })}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                    <TableCell>{item.totalHours || 0}</TableCell>
                    <TableCell className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => openActionDialog(item, "approve")}
                        disabled={item.status !== "submitted"}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openActionDialog(item, "reject")}
                        disabled={item.status !== "submitted"}
                      >
                        Reject
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </motion.div>
      )}

      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" ? "Approve Timesheet" : "Reject Timesheet"}
            </DialogTitle>
          </DialogHeader>
          {actionType === "reject" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason</label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add rejection reason"
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitAction}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Timesheets;
