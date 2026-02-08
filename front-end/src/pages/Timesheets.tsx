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
  Users
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

const toDateInput = (value: Date) => value.toISOString().slice(0, 10);

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
  const [selectedDate, setSelectedDate] = useState(toDateInput(new Date()));
  const [attendanceToday, setAttendanceToday] = useState<any | null>(null);
  const [timesheet, setTimesheet] = useState<any | null>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"all" | "my">("my");
  const [weeklyList, setWeeklyList] = useState<any[]>([]);
  const [onlineList, setOnlineList] = useState<any[]>([]);
  const [weekOffDays, setWeekOffDays] = useState<number[]>([]);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"approve" | "reject">("approve");
  const [selectedTimesheet, setSelectedTimesheet] = useState<any | null>(null);
  const [comment, setComment] = useState("");

  const weekStart = useMemo(() => getWeekStart(new Date(selectedDate)), [selectedDate]);
  const weekDates = useMemo(() => buildWeekDates(weekStart), [weekStart]);

  const loadAttendanceToday = async () => {
    const res = await getApiWithToken(`/timesheets/attendance/my?date=${selectedDate}`);
    if (res?.success) {
      const record = (res.data || [])[0];
      setAttendanceToday(record || null);
    }
  };

  const loadWeekly = async () => {
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
      setEntries(resWeek.data.entries || []);
    } else {
      setTimesheet(null);
      setEntries(
        weekDates.map((date) => ({
          date: toDateInput(date),
          hours: 0,
          notes: ""
        }))
      );
    }
  };

  const loadOnline = async () => {
    const res = await getApiWithToken("/timesheets/online");
    if (res?.success) {
      setOnlineList(res.data || []);
    }
  };

  const loadWeekOffs = async () => {
    const res = await getApiWithToken("/week-offs");
    if (res?.success) {
      setWeekOffDays(res.data?.weekOffDays || []);
    }
  };

  useEffect(() => {
    loadAttendanceToday();
  }, [selectedDate]);

  useEffect(() => {
    loadWeekly();
    loadOnline();
    loadWeekOffs();
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
    const res = await postApiWithToken(`/timesheets/weekly/${timesheet._id}/submit`, {});
    setSaving(false);
    if (res?.success) {
      toast.success("Timesheet submitted");
      setTimesheet(res.data);
      loadWeekly();
    } else {
      toast.error(res?.message || "Submit failed");
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

  const timesheetLocked =
    timesheet?.status && ["submitted", "approved"].includes(timesheet.status);

  return (
    <MainLayout
      title="Timesheets"
      breadcrumb={[{ label: "Home", href: "/" }, { label: "Timesheets" }]}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
        </motion.div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Button onClick={handleCheckIn} disabled={!canCheckIn || isCheckedIn || isCheckedOut}>
          Check In
        </Button>
        <Button variant="outline" onClick={handleCheckOut} disabled={!canCheckOut || !isCheckedIn}>
          Check Out
        </Button>
        <div className="flex items-center gap-2 ml-auto">
          <CalendarDays className="w-4 h-4 text-muted-foreground" />
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-44"
          />
        </div>
      </div>

      {viewMode === "all" && (
        <motion.div
          className="bg-card rounded-xl card-shadow overflow-hidden mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <div className="px-6 py-4 border-b border-border">
            <h3 className="text-lg font-semibold">Online Employees</h3>
            <p className="text-sm text-muted-foreground">Checked in and currently working</p>
          </div>
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
        </motion.div>
      )}

      <motion.div
        className="bg-card rounded-xl card-shadow overflow-hidden mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
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
        <Table>
          <TableHeader>
            <TableRow className="table-header">
              <TableHead>Date</TableHead>
              <TableHead className="w-28">Hours</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {weekDates.map((date, index) => {
              const isWeekOff = weekOffDays.includes(date.getDay());
              return (
              <TableRow key={date.toISOString()} className="table-row-hover">
                <TableCell className="text-muted-foreground">
                  {date.toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric"
                  })}
                  {isWeekOff && (
                    <span className="ml-2 text-xs text-muted-foreground">(Week Off)</span>
                  )}
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={0}
                    max={24}
                    step={0.5}
                    value={entries[index]?.hours ?? 0}
                    onChange={(e) => handleEntryChange(index, "hours", e.target.value)}
                    disabled={timesheetLocked || isWeekOff || !canEdit}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={entries[index]?.notes ?? ""}
                    onChange={(e) => handleEntryChange(index, "notes", e.target.value)}
                    placeholder={isWeekOff ? "Week off" : "Work summary"}
                    disabled={timesheetLocked || isWeekOff || !canEdit}
                  />
                </TableCell>
              </TableRow>
            )})}
          </TableBody>
        </Table>
        <div className="flex flex-wrap items-center justify-end gap-3 px-6 py-4 border-t border-border">
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
            <Button onClick={submitTimesheet} disabled={saving}>
              Submit Timesheet
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
          <div className="px-6 py-4 border-b border-border">
            <h3 className="text-lg font-semibold">Team Timesheets</h3>
            <p className="text-sm text-muted-foreground">Approve or reject weekly submissions</p>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="table-header">
                <TableHead>Employee</TableHead>
                <TableHead>Week</TableHead>
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
