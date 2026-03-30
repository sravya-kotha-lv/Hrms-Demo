import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  CheckCircle,
  XCircle,
  Clock,
  ClipboardCheck,
  Timer,
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
import { useAuth } from "@/context/useAuth";
import { InlineLoader } from "@/components/ui/loaders";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateInOrgTimeZone, formatTimeInOrgTimeZone, toDateKeyInOrgTimeZone } from "@/utils/timezone";

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

type WeeklyEntry = {
  date?: string;
  hours?: number;
  notes?: string;
};

type EmployeeSummary = {
  _id?: string;
  firstName?: string;
  lastName?: string;
  employeeCode?: string;
};

type TeamTimesheet = {
  _id?: string;
  id?: string;
  employeeId?: EmployeeSummary | null;
  weekStart?: string;
  weekEnd?: string;
  status?: string;
  entries?: WeeklyEntry[];
};

const getTimesheetId = (timesheet: TeamTimesheet | null | undefined) =>
  toIdString(timesheet?._id || timesheet?.id);

const normalizeTimesheetRecord = (timesheet: TeamTimesheet | null | undefined) => {
  if (!timesheet) return null;
  return {
    ...timesheet,
    _id: getTimesheetId(timesheet)
  };
};

type AttendanceTodayRecord = {
  checkInAt?: string | null;
  checkOutAt?: string | null;
};

const normalizeEntries = (weekDates: Date[], rawEntries: WeeklyEntry[]) => {
  const byDate = new Map<string, WeeklyEntry>();
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

type AttendanceRequest = {
  _id: string;
  _actionId?: string;
  date: string;
  requestType: "missed_checkout" | "correction";
  requestedCheckInTime?: string | null;
  requestedCheckOutTime?: string | null;
  reason: string;
  status: "pending" | "approved" | "rejected";
  rejectionReason?: string | null;
  employeeId?: { firstName?: string; lastName?: string; employeeCode?: string };
  approvalSteps?: {
    stepNumber: number;
    approverType: "manager" | "role" | "employee";
    approverRoleSlug?: string | null;
    approverEmployeeId?: { firstName?: string; lastName?: string; employeeCode?: string } | null;
    status: "queued" | "pending" | "approved" | "rejected";
    actionBy?: { firstName?: string; lastName?: string; employeeCode?: string } | null;
  }[];
  currentApprovalStep?: number | null;
};

type CheckInPolicy = {
  attendanceIpEnabled: boolean;
  attendanceSelfieRequired: boolean;
  attendanceGeoFenceEnabled: boolean;
  attendanceGeoRadiusMeters: number;
};

const toPersonLabel = (employee: EmployeeSummary | null | undefined) => {
  if (!employee) return "-";
  const name = `${employee.firstName || ""} ${employee.lastName || ""}`.trim();
  return employee.employeeCode ? `${name || "Employee"} (${employee.employeeCode})` : name || "Employee";
};

const approverLabel = (step: AttendanceRequest["approvalSteps"] extends Array<infer T> ? T : never) => {
  if (!step) return "-";
  if (step.approverType === "manager") return "Reporting Manager";
  if (step.approverType === "role") return step.approverRoleSlug ? `Role: ${step.approverRoleSlug}` : "Role";
  return step.approverEmployeeId ? `Employee: ${toPersonLabel(step.approverEmployeeId)}` : "Employee";
};

const approvalProgressLabel = (request: AttendanceRequest) => {
  const steps = Array.isArray(request.approvalSteps) ? request.approvalSteps : [];
  if (!steps.length) return "Single-step";
  const pending = steps.find((s) => s.status === "pending");
  if (request.status === "approved") return `Completed (${steps.length} steps)`;
  if (request.status === "rejected") {
    const rejectedStep = steps.find((s) => s.status === "rejected");
    return rejectedStep ? `Rejected at S${rejectedStep.stepNumber}` : "Rejected";
  }
  if (!pending) return "Pending";
  return `S${pending.stepNumber}/${steps.length} • ${approverLabel(pending)}`;
};

const toIdString = (value: unknown) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.every((item) => Number.isInteger(item))) {
    return value.map((item) => Number(item).toString(16).padStart(2, "0")).join("");
  }
  if (typeof value === "object" && value !== null && "_actionId" in value && typeof (value as { _actionId?: string })._actionId === "string") {
    return (value as { _actionId: string })._actionId;
  }
  if (typeof value === "object" && value !== null && "_id" in value) return toIdString((value as { _id?: unknown })._id);
  if (typeof value === "object" && value !== null && "id" in value) return toIdString((value as { id?: unknown }).id);
  if (typeof value === "object" && value !== null && "$oid" in value && typeof (value as { $oid?: string }).$oid === "string") {
    return (value as { $oid: string }).$oid;
  }
  if (typeof value === "object" && value !== null && "buffer" in value) {
    const buffer = (value as { buffer?: unknown }).buffer;
    if (Array.isArray(buffer)) return toIdString(buffer);
    if (typeof buffer === "object" && buffer !== null) {
      const bytes = Object.values(buffer)
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item >= 0);
      if (bytes.length) return toIdString(bytes);
    }
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    "data" in value &&
    (value as { type?: string }).type === "Buffer"
  ) {
    return toIdString((value as { data?: unknown }).data);
  }
  if (typeof value === "object" && value !== null && "data" in value) {
    const data = (value as { data?: unknown }).data;
    if (Array.isArray(data)) return toIdString(data);
  }
  if (typeof value === "object" && value !== null && "toHexString" in value && typeof (value as { toHexString?: () => string }).toHexString === "function") {
    return (value as { toHexString: () => string }).toHexString();
  }
  if (typeof value === "object" && typeof value.toString === "function" && value.toString !== Object.prototype.toString) {
    const asString = value.toString();
    if (asString && asString !== "[object Object]") return asString;
  }
  return String(value);
};

const getAttendanceRequestId = (request: AttendanceRequest | string | null | undefined) =>
  typeof request === "string" ? request : toIdString(request?._actionId || request?._id);

const normalizeAttendanceRequestRecord = (
  request: (AttendanceRequest & { id?: string }) | null | undefined
): AttendanceRequest | null => {
  if (!request) return null;
  const requestId = toIdString(request?._actionId || request?._id || request?.id);
  return {
    ...request,
    _id: requestId,
    _actionId: requestId
  };
};

const mergeTimesheetPages = (existing: TeamTimesheet[], incoming: TeamTimesheet[]) => {
  const merged = new Map<string, TeamTimesheet>();
  existing.forEach((item) => {
    const itemId = toIdString(item?._id || item?.id);
    if (itemId) merged.set(itemId, item);
  });
  incoming.forEach((item) => {
    const itemId = toIdString(item?._id || item?.id);
    if (itemId) merged.set(itemId, item);
  });
  return Array.from(merged.values());
};

const captureSelfieFromCamera = async (): Promise<string | null> => {
  if (!navigator.mediaDevices?.getUserMedia) return null;

  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.zIndex = "9999";
    overlay.style.background = "rgba(0,0,0,0.8)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";

    const card = document.createElement("div");
    card.style.background = "#fff";
    card.style.padding = "12px";
    card.style.borderRadius = "12px";
    card.style.width = "min(92vw, 420px)";
    card.style.display = "flex";
    card.style.flexDirection = "column";
    card.style.gap = "10px";

    const title = document.createElement("div");
    title.textContent = "Take Selfie for Check-In";
    title.style.fontWeight = "600";

    const video = document.createElement("video");
    video.autoplay = true;
    video.playsInline = true;
    video.srcObject = stream;
    video.style.width = "100%";
    video.style.borderRadius = "8px";

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "8px";
    actions.style.justifyContent = "flex-end";

    const cancel = document.createElement("button");
    cancel.textContent = "Cancel";
    cancel.style.padding = "8px 10px";

    const capture = document.createElement("button");
    capture.textContent = "Capture";
    capture.style.padding = "8px 10px";

    const cleanup = () => {
      stream.getTracks().forEach((t) => t.stop());
      overlay.remove();
    };

    cancel.onclick = () => {
      cleanup();
      resolve(null);
    };

    capture.onclick = () => {
      const maxSide = 480;
      const canvas = document.createElement("canvas");
      const vw = video.videoWidth || 640;
      const vh = video.videoHeight || 480;
      const scale = Math.min(1, maxSide / Math.max(vw, vh));
      canvas.width = Math.max(1, Math.round(vw * scale));
      canvas.height = Math.max(1, Math.round(vh * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        cleanup();
        resolve(null);
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = canvas.toDataURL("image/jpeg", 0.7);
      cleanup();
      resolve(image);
    };

    actions.append(cancel, capture);
    card.append(title, video, actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
  });
};

const Timesheets = () => {
  const { profile } = useAuth();
  const [selectedDate] = useState(() => toDateKeyInOrgTimeZone(new Date()));
  const [weekStartDate, setWeekStartDate] = useState(getWeekStart(new Date()));
  const [attendanceToday, setAttendanceToday] = useState<AttendanceTodayRecord | null>(null);
  const [timesheet, setTimesheet] = useState<TeamTimesheet | null>(null);
  const [entries, setEntries] = useState<WeeklyEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"all" | "my">("my");
  const [weeklyList, setWeeklyList] = useState<TeamTimesheet[]>([]);
  const [teamCurrentPage, setTeamCurrentPage] = useState(1);
  const [teamTotalPages, setTeamTotalPages] = useState(1);
  const [teamTotalItems, setTeamTotalItems] = useState(0);
  const [teamPageSize] = useState(15);
  const [teamLoadingMore, setTeamLoadingMore] = useState(false);
  const [onlineList, setOnlineList] = useState<TeamTimesheet[]>([]);
  const [onLeaveList, setOnLeaveList] = useState<TeamTimesheet[]>([]);
  const [myLeaveDates, setMyLeaveDates] = useState<string[]>([]);
  const [weekOffDays, setWeekOffDays] = useState<number[]>([]);
  const [minWorkHoursPerDay, setMinWorkHoursPerDay] = useState(8);
  const [minHalfDayHours, setMinHalfDayHours] = useState(4);
  const [weekLoading, setWeekLoading] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"approve" | "reject">("approve");
  const [selectedTimesheet, setSelectedTimesheet] = useState<TeamTimesheet | null>(null);
  const [comment, setComment] = useState("");
  const [showOnlineCard, setShowOnlineCard] = useState(true);
  const [showOnLeaveCard, setShowOnLeaveCard] = useState(true);
  const [showTeamTimesheets, setShowTeamTimesheets] = useState(true);
  const [attendanceRequestOpen, setAttendanceRequestOpen] = useState(false);
  const [attendanceRequestLoading, setAttendanceRequestLoading] = useState(false);
  const [attendanceRequestForm, setAttendanceRequestForm] = useState({
    date: toDateKeyInOrgTimeZone(new Date()),
    requestType: "missed_checkout" as "missed_checkout" | "correction",
    requestedCheckInTime: "",
    requestedCheckOutTime: "",
    reason: ""
  });
  const [myAttendanceRequests, setMyAttendanceRequests] = useState<AttendanceRequest[]>([]);
  const [pendingAttendanceRequests, setPendingAttendanceRequests] = useState<AttendanceRequest[]>([]);
  const [checkInPolicy, setCheckInPolicy] = useState<CheckInPolicy>({
    attendanceIpEnabled: false,
    attendanceSelfieRequired: false,
    attendanceGeoFenceEnabled: false,
    attendanceGeoRadiusMeters: 200
  });
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const teamTableViewportRef = useRef<HTMLDivElement | null>(null);
  const teamLoadingMoreRef = useRef(false);
  const currentEmployeeId = toIdString(profile?.employeeId);
  const currentRoleSlug = profile?.activeRole?.slug || "";
  const canCheckIn = hasPermission("TIMESHEET_CHECKIN_SELF");
  const canCheckOut = hasPermission("TIMESHEET_CHECKOUT_SELF");
  const canSubmit = hasPermission("TIMESHEET_SUBMIT_SELF");
  const canEdit = hasPermission("TIMESHEET_EDIT_SELF");
  const canCreate = hasPermission("TIMESHEET_CREATE_SELF");
  const canAction = hasPermission("TIMESHEET_ACTION");
  const canRecall = hasPermission("TIMESHEET_RECALL_SELF");
  const canViewOnline = hasPermission("TIMESHEET_VIEW_ONLINE");
  const canViewAll = hasPermission("TIMESHEET_VIEW_ALL");

  const canCurrentActorActionAttendanceRequest = (request: AttendanceRequest) => {
    const steps = Array.isArray(request.approvalSteps) ? request.approvalSteps : [];
    if (!steps.length) return true;
    const pending = steps.find((s) => s.status === "pending");
    if (!pending) return false;
    if (pending.approverType === "role") {
      return Boolean(pending.approverRoleSlug && pending.approverRoleSlug === currentRoleSlug);
    }
    const stepEmployeeId = toIdString(pending.approverEmployeeId);
    return Boolean(stepEmployeeId && currentEmployeeId && stepEmployeeId === currentEmployeeId);
  };

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

  const loadTeamTimesheets = useCallback(async (pageToLoad = 1) => {
    if (pageToLoad > 1) {
      setTeamLoadingMore(true);
    }
    const resAll = await getApiWithToken(`/timesheets/weekly?page=${pageToLoad}&limit=${teamPageSize}`, null, {
      requiredPermissions: ["TIMESHEET_VIEW_ALL"]
    });
    if (resAll?.skipped) return;
    if (resAll?.success) {
      const payload = resAll.data;
      const nextItems = (Array.isArray(payload) ? payload : (payload?.items || [])).map((item: TeamTimesheet) => ({
        ...item,
        _id: getTimesheetId(item)
      }));
      const pagination = Array.isArray(payload)
        ? { page: 1, totalPages: 1, total: nextItems.length }
        : payload?.pagination;
      setWeeklyList((prev) => (pageToLoad > 1 ? mergeTimesheetPages(prev, nextItems) : nextItems));
      setTeamCurrentPage(Number(pagination?.page || pageToLoad));
      setTeamTotalPages(Math.max(1, Number(pagination?.totalPages || 1)));
      setTeamTotalItems(Number(pagination?.total || nextItems.length));
      setViewMode("all");
    } else {
      setWeeklyList([]);
      setTeamCurrentPage(1);
      setTeamTotalPages(1);
      setTeamTotalItems(0);
    }
    teamLoadingMoreRef.current = false;
    setTeamLoadingMore(false);
  }, [teamPageSize]);

  const loadAttendanceToday = useCallback(async () => {
    const res = await getApiWithToken(
      `/timesheets/attendance/my?date=${selectedDate}`,
      null,
      { requiredPermissions: ["TIMESHEET_VIEW_SELF", "TIMESHEET_CHECKIN_SELF", "TIMESHEET_CHECKOUT_SELF"] }
    );
    if (res?.skipped) return;
    if (res?.success) {
      const record = (res.data || [])[0];
      setAttendanceToday(record || null);
    }
  }, [selectedDate]);

  const loadWeekly = useCallback(async () => {
    setWeekLoading(true);
    setTimesheet(null);
    setEntries(normalizeEntries(weekDates, []));
    if (hasPermission("TIMESHEET_VIEW_ALL")) {
      await loadTeamTimesheets(1);
    } else {
      setWeeklyList([]);
      setTeamCurrentPage(1);
      setTeamTotalPages(1);
      setTeamTotalItems(0);
      setViewMode("my");
    }

    const weekStartIso = toDateInput(weekStart);
    const resWeek = await getApiWithToken(
      `/timesheets/weekly/my?weekStart=${weekStartIso}`,
      null,
      { requiredPermissions: ["TIMESHEET_VIEW_SELF"] }
    );
    if (resWeek?.skipped) {
      setWeekLoading(false);
      return;
    }
    if (resWeek?.success && resWeek.data) {
      const normalizedTimesheet = normalizeTimesheetRecord(resWeek.data);
      setTimesheet(normalizedTimesheet);
      setEntries(normalizeEntries(weekDates, normalizedTimesheet?.entries || []));
    } else {
      setTimesheet(null);
      setEntries(normalizeEntries(weekDates, []));
    }
    setWeekLoading(false);
  }, [loadTeamTimesheets, weekDates, weekStart]);

  const loadOnline = useCallback(async () => {
    const res = await getApiWithToken("/timesheets/online", null, {
      requiredPermissions: ["TIMESHEET_VIEW_ONLINE"]
    });
    if (res?.skipped) return;
    if (res?.success) {
      setOnlineList(res.data || []);
    }
  }, []);

  const loadOnLeave = useCallback(async () => {
    const res = await getApiWithToken("/timesheets/on-leave", null, {
      requiredPermissions: ["TIMESHEET_VIEW_ALL"]
    });
    if (res?.skipped) return;
    if (res?.success) {
      setOnLeaveList(res.data || []);
    }
  }, []);

  const loadMyLeavesForWeek = useCallback(async () => {
    const start = toDateInput(weekStart);
    const end = toDateInput(weekDates[6]);
    const res = await getApiWithToken(
      `/leaves/my-range?startDate=${start}&endDate=${end}`,
      null,
      { requiredPermissions: ["LEAVE_VIEW_SELF"] }
    );
    if (res?.skipped) return;
    if (res?.success) {
      const dates: string[] = [];
      (res.data || []).forEach((leave: { fromDate?: string; toDate?: string }) => {
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
  }, [weekDates, weekStart]);

  const loadWeekOffs = useCallback(async () => {
    const res = await getApiWithToken("/week-offs", null, {
      requiredPermissions: ["WEEK_OFF_VIEW"]
    });
    if (res?.skipped) return;
    if (res?.success) {
      setWeekOffDays(res.data?.weekOffDays || []);
    }
  }, []);

  const loadOrgSettings = useCallback(async () => {
    const res = await getApiWithToken("/org-settings", null, {
      requiredPermissions: ["ORG_SETTINGS_VIEW"]
    });
    if (res?.skipped) return;
    if (res?.success) {
      setMinWorkHoursPerDay(
        typeof res.data?.minWorkHoursPerDay === "number" ? res.data.minWorkHoursPerDay : 8
      );
      setMinHalfDayHours(
        typeof res.data?.minHalfDayHours === "number" ? res.data.minHalfDayHours : 4
      );
    }
  }, []);

  const loadMyAttendanceRequests = useCallback(async () => {
    const res = await getApiWithToken("/timesheets/attendance/requests/my", null, {
      requiredPermissions: ["TIMESHEET_VIEW_SELF"]
    });
    if (res?.skipped) return;
    if (res?.success) {
      setMyAttendanceRequests(
        (res.data || [])
          .map((request: AttendanceRequest & { id?: string }) => normalizeAttendanceRequestRecord(request))
          .filter(Boolean) as AttendanceRequest[]
      );
    }
  }, []);

  const loadPendingAttendanceRequests = useCallback(async () => {
    const res = await getApiWithToken("/timesheets/attendance/requests?status=pending", null, {
      requiredPermissions: ["ATTENDANCE_MANAGE"]
    });
    if (res?.skipped) return;
    if (res?.success) {
      setPendingAttendanceRequests(
        (res.data || [])
          .map((request: AttendanceRequest & { id?: string }) => normalizeAttendanceRequestRecord(request))
          .filter(Boolean) as AttendanceRequest[]
      );
    }
  }, []);

  const loadCheckInPolicy = useCallback(async () => {
    const res = await getApiWithToken("/timesheets/checkin-policy", null, {
      requiredPermissions: ["TIMESHEET_CHECKIN_SELF"]
    });
    if (res?.skipped) return;
    if (res?.success && res?.data) {
      setCheckInPolicy({
        attendanceIpEnabled: Boolean(res.data.attendanceIpEnabled),
        attendanceSelfieRequired: Boolean(res.data.attendanceSelfieRequired),
        attendanceGeoFenceEnabled: Boolean(res.data.attendanceGeoFenceEnabled),
        attendanceGeoRadiusMeters: Number(res.data.attendanceGeoRadiusMeters || 200)
      });
    }
  }, []);

  useEffect(() => {
    loadAttendanceToday();
    loadWeekly();
    loadOnline();
    loadOnLeave();
    loadWeekOffs();
    loadOrgSettings();
    loadMyLeavesForWeek();
    loadMyAttendanceRequests();
    loadPendingAttendanceRequests();
    loadCheckInPolicy();
  }, [
    loadAttendanceToday,
    loadWeekly,
    loadOnline,
    loadOnLeave,
    loadWeekOffs,
    loadOrgSettings,
    loadMyLeavesForWeek,
    loadMyAttendanceRequests,
    loadPendingAttendanceRequests,
    loadCheckInPolicy
  ]);

  const hasMoreTeamTimesheets = teamCurrentPage < teamTotalPages;

  useEffect(() => {
    if (teamCurrentPage <= 1 || !canViewAll) return;
    loadTeamTimesheets(teamCurrentPage);
  }, [canViewAll, loadTeamTimesheets, teamCurrentPage]);

  const handleTeamTimesheetsScroll = () => {
    const viewport = teamTableViewportRef.current;
    if (!viewport || weekLoading || teamLoadingMore || teamLoadingMoreRef.current || !hasMoreTeamTimesheets || viewMode !== "all" || !showTeamTimesheets) {
      return;
    }
    const { scrollTop, scrollHeight, clientHeight } = viewport;
    if (scrollTop <= 0 || scrollHeight <= clientHeight) return;
    const progress = (scrollTop + clientHeight) / scrollHeight;
    if (progress < 0.5) return;
    teamLoadingMoreRef.current = true;
    setTeamCurrentPage((prev) => {
      if (prev >= teamTotalPages) {
        teamLoadingMoreRef.current = false;
        return prev;
      }
      return prev + 1;
    });
  };

  const submitAttendanceRequest = async () => {
    if (!attendanceRequestForm.reason.trim()) {
      toast.error("Reason is required");
      return;
    }
    if (
      attendanceRequestForm.requestType === "missed_checkout" &&
      !attendanceRequestForm.requestedCheckOutTime
    ) {
      toast.error("Requested checkout time is required");
      return;
    }
    if (
      attendanceRequestForm.requestType === "correction" &&
      !attendanceRequestForm.requestedCheckInTime &&
      !attendanceRequestForm.requestedCheckOutTime
    ) {
      toast.error("Provide check-in or check-out time");
      return;
    }
    setAttendanceRequestLoading(true);
    const res = await postApiWithToken(
      "/timesheets/attendance/requests/my",
      attendanceRequestForm,
      null,
      { requiredPermissions: ["TIMESHEET_VIEW_SELF"] }
    );
    setAttendanceRequestLoading(false);
    if (res?.skipped) return;
    if (res?.success) {
      toast.success("Attendance request raised");
      setAttendanceRequestOpen(false);
      setAttendanceRequestForm({
        date: toDateInput(new Date()),
        requestType: "missed_checkout",
        requestedCheckInTime: "",
        requestedCheckOutTime: "",
        reason: ""
      });
      loadMyAttendanceRequests();
      loadPendingAttendanceRequests();
    } else {
      toast.error(res?.message || "Failed to raise attendance request");
    }
  };

  const openAttendanceRequestDialog = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    setAttendanceRequestForm({
      date: toDateInput(yesterday),
      requestType: "missed_checkout",
      requestedCheckInTime: "",
      requestedCheckOutTime: "",
      reason: ""
    });
    setAttendanceRequestOpen(true);
  };

  const actionAttendanceRequest = async (requestRow: AttendanceRequest | string, status: "approved" | "rejected") => {
    const requestId = getAttendanceRequestId(requestRow);
    if (!requestId || requestId === "[object Object]") {
      toast.error("Invalid attendance request id");
      return;
    }
    const request = pendingAttendanceRequests.find((r) => getAttendanceRequestId(r) === requestId);
    if (request && !canCurrentActorActionAttendanceRequest(request)) {
      toast.error("You are not the current approver for this request");
      return;
    }
    let rejectionReason = "";
    if (status === "rejected") {
      rejectionReason = window.prompt("Enter rejection reason") || "";
      if (!rejectionReason.trim()) return;
    }
    const res = await putApiWithToken(
      `/timesheets/attendance/requests/${encodeURIComponent(requestId)}/action`,
      { status, rejectionReason },
      null,
      { requiredPermissions: ["ATTENDANCE_MANAGE"] }
    );
    if (res?.skipped) return;
    if (res?.success) {
      toast.success(`Attendance request ${status}`);
      loadAttendanceToday();
      loadWeekly();
      loadPendingAttendanceRequests();
      loadMyAttendanceRequests();
    } else {
      toast.error(res?.message || "Failed to action request");
    }
  };

  const handleCheckIn = async () => {
    if (checkinLoading) return;
    const payload: Record<string, unknown> = {};

    if (checkInPolicy.attendanceGeoFenceEnabled) {
      if (!navigator.geolocation) {
        toast.error("Location is not supported on this browser");
        return;
      }
      const geo = await new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          }),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });
      if (!geo) {
        toast.error("Location permission is required for check-in");
        return;
      }
      payload.latitude = geo.latitude;
      payload.longitude = geo.longitude;
    }

    if (checkInPolicy.attendanceSelfieRequired) {
      let selfieImage: string | null = null;
      try {
        selfieImage = await captureSelfieFromCamera();
      } catch {
        selfieImage = null;
      }
      if (!selfieImage) {
        toast.error("Selfie capture is required for check-in");
        return;
      }
      payload.selfieImage = selfieImage;
    }

    setCheckinLoading(true);
    const res = await postApiWithToken(
      "/timesheets/check-in",
      payload,
      null,
      { requiredPermissions: ["TIMESHEET_CHECKIN_SELF"] }
    );
    setCheckinLoading(false);
    if (res?.skipped) return;
    if (res?.success) {
      toast.success("Checked in");
      loadAttendanceToday();
      loadOnline();
    } else {
      toast.error(res?.message || "Check-in failed");
    }
  };

  const handleCheckOut = async () => {
    if (checkoutLoading) return;
    setCheckoutLoading(true);
    const res = await postApiWithToken(
      "/timesheets/check-out",
      {},
      null,
      { requiredPermissions: ["TIMESHEET_CHECKOUT_SELF"] }
    );
    setCheckoutLoading(false);
    if (res?.skipped) return;
    if (res?.success) {
      toast.success("Checked out");
      loadAttendanceToday();
      loadOnline();
    } else {
      toast.error(res?.message || "Check-out failed");
    }
  };

  const handleEntryChange = (index: number, field: keyof WeeklyEntry, value: string | number) => {
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
    const res = await postApiWithToken(
      "/timesheets/weekly",
      payload,
      null,
      { requiredPermissions: ["TIMESHEET_CREATE_SELF"] }
    );
    setSaving(false);
    if (res?.skipped) return;
    if (res?.success) {
      toast.success("Timesheet created");
      setTimesheet(normalizeTimesheetRecord(res.data));
      loadWeekly();
    } else {
      toast.error(res?.message || "Create failed");
    }
  };

  const saveDraft = async () => {
    const timesheetId = getTimesheetId(timesheet);
    if (!timesheetId || timesheetId === "[object Object]") {
      toast.error("Invalid timesheet id");
      return;
    }
    setSaving(true);
    const payload = {
      weekStart: weekStartKey,
      entries: entries.map((entry) => ({
        date: entry.date,
        hours: Number(entry.hours) || 0,
        notes: entry.notes || ""
      }))
    };
    
    const res = await putApiWithToken(
      `/timesheets/weekly/${timesheetId}`,
      payload,
      null,
      { requiredPermissions: ["TIMESHEET_EDIT_SELF"] }
    );
    setSaving(false);
    if (res?.skipped) return;
    if (res?.success) {
      toast.success("Timesheet updated");
      setTimesheet(normalizeTimesheetRecord(res.data));
      loadWeekly();
    } else {
      toast.error(res?.message || "Update failed");
    }
  };

  const submitTimesheet = async () => {
    const timesheetId = getTimesheetId(timesheet);
    if (!timesheetId || timesheetId === "[object Object]") {
      toast.error("Invalid timesheet id");
      return;
    }
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
      `/timesheets/weekly/${timesheetId}/submit`,
      payload,
      null,
      { requiredPermissions: ["TIMESHEET_SUBMIT_SELF"] }
    );
    setSaving(false);
    if (res?.skipped) return;
    if (res?.success) {
      toast.success("Timesheet submitted");
      setTimesheet(normalizeTimesheetRecord(res.data));
      loadWeekly();
    } else {
      toast.error(res?.message || "Submit failed");
    }
  };

  const recallTimesheet = async () => {
    const timesheetId = getTimesheetId(timesheet);
    if (!timesheetId || timesheetId === "[object Object]") {
      toast.error("Invalid timesheet id");
      return;
    }
    setSaving(true);
    const res = await postApiWithToken(
      `/timesheets/weekly/${timesheetId}/recall`,
      {},
      null,
      { requiredPermissions: ["TIMESHEET_RECALL_SELF"] }
    );
    setSaving(false);
    if (res?.skipped) return;
    if (res?.success) {
      toast.success("Timesheet recalled");
      setTimesheet(normalizeTimesheetRecord(res.data));
      loadWeekly();
    } else {
      toast.error(res?.message || "Recall failed");
    }
  };

  const openActionDialog = (ts: TeamTimesheet, type: "approve" | "reject") => {
    setSelectedTimesheet({
      ...ts,
      _id: getTimesheetId(ts)
    });
    setActionType(type);
    setComment("");
    setActionDialogOpen(true);
  };

  const submitAction = async () => {
    const selectedTimesheetId = getTimesheetId(selectedTimesheet);
    if (!selectedTimesheetId || selectedTimesheetId === "[object Object]") {
      toast.error("Invalid timesheet id");
      return;
    }
    const payload: { status: "approved" | "rejected"; rejectionReason?: string } = { status: actionType === "approve" ? "approved" : "rejected" };
    if (payload.status === "rejected") payload.rejectionReason = comment;

    const res = await putApiWithToken(
      `/timesheets/weekly/${selectedTimesheetId}/action`,
      payload,
      null,
      { requiredPermissions: ["TIMESHEET_ACTION"] }
    );
    if (res?.skipped) return;
    if (res?.success) {
      toast.success(`Timesheet ${payload.status}`);
      setActionDialogOpen(false);
      loadWeekly();
    } else {
      toast.error(res?.message || "Action failed");
    }
  };

  const hasCheckedInToday = Boolean(attendanceToday?.checkInAt);
  const isCheckedIn = hasCheckedInToday && !attendanceToday?.checkOutAt;
  const isCheckedOut = hasCheckedInToday && Boolean(attendanceToday?.checkOutAt);

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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
              ? formatTimeInOrgTimeZone(attendanceToday.checkInAt)
              : "-"}
          </div>
          {isCheckedIn && (
            <div className="text-xs text-orange-700 mt-2">
              Pending checkout. This session stays excluded from payroll until checkout is completed.
            </div>
          )}
          {isCheckedOut && (
            <div className="text-xs text-emerald-700 mt-2">
              Check-in is allowed only once today. You can update the checkout time again if needed.
            </div>
          )}
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
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Button onClick={handleCheckIn} disabled={!canCheckIn || hasCheckedInToday || checkinLoading}>
          Check In
        </Button>
        <Button variant="outline" onClick={handleCheckOut} disabled={!canCheckOut || !hasCheckedInToday || checkoutLoading}>
          Check Out
        </Button>
        <Button
          variant="outline"
          onClick={openAttendanceRequestDialog}
          disabled={!hasPermission("TIMESHEET_VIEW_SELF")}
        >
          Raise Attendance Request
        </Button>
        <div className="ml-auto text-xs text-muted-foreground">
          Today: {toDateInput(new Date())}
        </div>
      </div>
      {isCheckedOut && (
        <div className="mb-6 text-xs text-emerald-700">
          Check-in is disabled because only one check-in is allowed per day. You can still update checkout time again today.
        </div>
      )}

      <motion.div
        className="bg-card rounded-xl card-shadow overflow-hidden mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22 }}
      >
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-lg font-semibold">My Attendance Requests</h3>
          <p className="text-sm text-muted-foreground">Raise request when missed checkout/check-in correction is needed.</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="table-header">
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Requested Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Approval</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {myAttendanceRequests.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">No attendance requests</TableCell>
              </TableRow>
            )}
            {myAttendanceRequests.map((r) => (
              <TableRow key={r._actionId || toIdString(r._id)} className="table-row-hover">
                <TableCell>{formatDateInOrgTimeZone(r.date)}</TableCell>
                <TableCell className="capitalize">{r.requestType.replace("_", " ")}</TableCell>
                <TableCell>{r.requestedCheckInTime || "-"} / {r.requestedCheckOutTime || "-"}</TableCell>
                <TableCell>{getStatusBadge(r.status)}</TableCell>
                <TableCell className="max-w-[260px] truncate text-xs text-muted-foreground" title={approvalProgressLabel(r)}>
                  {approvalProgressLabel(r)}
                </TableCell>
                <TableCell className="max-w-[260px] truncate" title={r.reason}>{r.reason}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </motion.div>

      {canAction && (
        <motion.div
          className="bg-card rounded-xl card-shadow overflow-hidden mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.23 }}
        >
          <div className="px-6 py-4 border-b border-border">
            <h3 className="text-lg font-semibold">Pending Attendance Requests</h3>
            <p className="text-sm text-muted-foreground">Approve/reject employee attendance regularization requests.</p>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="table-header">
                <TableHead>Employee</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Requested Time</TableHead>
                <TableHead>Approval</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingAttendanceRequests.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground">No pending requests</TableCell>
                </TableRow>
              )}
              {pendingAttendanceRequests.map((r) => (
                <TableRow key={r._actionId || r._id} className="table-row-hover">
                  <TableCell>
                    {r.employeeId
                      ? `${r.employeeId.firstName || ""} ${r.employeeId.lastName || ""}`.trim()
                      : "-"}
                  </TableCell>
                  <TableCell>{formatDateInOrgTimeZone(r.date)}</TableCell>
                  <TableCell className="capitalize">{r.requestType.replace("_", " ")}</TableCell>
                  <TableCell>{r.requestedCheckInTime || "-"} / {r.requestedCheckOutTime || "-"}</TableCell>
                  <TableCell className="max-w-[240px] truncate text-xs text-muted-foreground" title={approvalProgressLabel(r)}>
                    {approvalProgressLabel(r)}
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate" title={r.reason}>{r.reason}</TableCell>
                  <TableCell>
                    {canCurrentActorActionAttendanceRequest(r) ? (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => actionAttendanceRequest(r, "approved")}>
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => actionAttendanceRequest(r, "rejected")}>
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not your step</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </motion.div>
      )}

      {canViewOnline && (
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
                  <TableRow key={toIdString(item._id || item.id || item.employeeId)} className="table-row-hover">
                    <TableCell>
                      {item.employeeId
                        ? `${item.employeeId.firstName || ""} ${item.employeeId.lastName || ""}`.trim()
                        : "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.checkInAt ? formatTimeInOrgTimeZone(item.checkInAt) : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </motion.div>
      )}

      {canViewAll && (
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
                  <TableRow key={toIdString(item._id || item.id || item.employeeId)} className="table-row-hover">
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
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-border bg-muted/20">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold mr-2">Weekly Timesheet</h3>
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
            <div className="ml-1 sm:ml-3 px-2.5 py-1 rounded-md bg-primary/10 text-primary text-sm font-semibold">
              Worked hours: {weekTotalHours} / {minWeeklyHours}
            </div>
            <div className="text-xs text-muted-foreground">
              ({toDateInput(weekStart)} - {toDateInput(weekDates[6])})
            </div>
          </div>
          <div className="flex items-center gap-3">
            {timesheet?._id ? getStatusBadge(timesheet.status) : <Badge>Draft</Badge>}
            <div className="text-xs text-muted-foreground">
            {timesheet?.status === "submitted" && "Waiting for approval"}
            {timesheet?.status === "approved" && "Approved"}
            {timesheet?.status === "rejected" && "Rejected - update and resubmit"}
            </div>
          </div>
        </div>
        {weekLoading && (
          <div className="px-6 py-3 space-y-2">
            <Skeleton className="h-8 w-56 rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
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
                          {formatDateInOrgTimeZone(date, {
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
            <>
              <div
                ref={teamTableViewportRef}
                onScroll={handleTeamTimesheetsScroll}
                className="h-[420px] overflow-y-auto overflow-x-auto"
              >
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
                  {weeklyList.map((item) => {
                    const weeklyRowId = toIdString(item._id || item.id || item.employeeId);
                    return (
                    <TableRow key={weeklyRowId} className="table-row-hover">
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
                          {(item.entries || []).map((entry: WeeklyEntry, idx: number) => {
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

                            const label = formatDateInOrgTimeZone(entry.date, {
                              weekday: "short"
                            });

                            return (
                              <span
                                key={`${weeklyRowId}-${idx}`}
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
                    );
                  })}
                </TableBody>
              </Table>
              </div>
              <div className="border-t border-border px-6 py-3 text-sm text-muted-foreground">
                {weekLoading && weeklyList.length > 0
                  ? "Loading more timesheets..."
                  : teamLoadingMore
                    ? "Loading more timesheets..."
                    : hasMoreTeamTimesheets
                    ? `Showing ${weeklyList.length} of ${teamTotalItems} team timesheets. Scroll down to load more.`
                    : `Showing ${weeklyList.length} team timesheets.`}
              </div>
            </>
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

      <Dialog open={attendanceRequestOpen} onOpenChange={setAttendanceRequestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Raise Attendance Request</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              type="date"
              value={attendanceRequestForm.date}
              onChange={(e) => setAttendanceRequestForm((prev) => ({ ...prev, date: e.target.value }))}
            />
            <select
              className="form-input"
              value={attendanceRequestForm.requestType}
              onChange={(e) =>
                setAttendanceRequestForm((prev) => ({
                  ...prev,
                  requestType: e.target.value as "missed_checkout" | "correction",
                  requestedCheckInTime:
                    e.target.value === "missed_checkout" ? "" : prev.requestedCheckInTime
                }))
              }
            >
              <option value="missed_checkout">Missed Checkout</option>
              <option value="correction">Correction</option>
            </select>
            <Input
              type="time"
              value={attendanceRequestForm.requestedCheckInTime}
              onChange={(e) =>
                setAttendanceRequestForm((prev) => ({ ...prev, requestedCheckInTime: e.target.value }))
              }
              placeholder="Requested check-in time"
              disabled={attendanceRequestForm.requestType === "missed_checkout"}
            />
            <Input
              type="time"
              value={attendanceRequestForm.requestedCheckOutTime}
              onChange={(e) =>
                setAttendanceRequestForm((prev) => ({ ...prev, requestedCheckOutTime: e.target.value }))
              }
              placeholder="Requested check-out time"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {attendanceRequestForm.requestType === "missed_checkout"
              ? "Provide the missing check-out time. Check-in time is taken from existing attendance."
              : "Provide one or both times to request correction."}
          </p>
          <Textarea
            className="mt-3"
            placeholder="Reason"
            value={attendanceRequestForm.reason}
            onChange={(e) => setAttendanceRequestForm((prev) => ({ ...prev, reason: e.target.value }))}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttendanceRequestOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitAttendanceRequest} disabled={attendanceRequestLoading}>
              {attendanceRequestLoading ? <InlineLoader label="Submitting..." className="text-white" /> : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Timesheets;
