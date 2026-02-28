import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { motion } from "framer-motion";
import {
  CalendarCheck,
  Timer,
  ClipboardCheck,
  Users,
  CheckCircle2,
  Clock3,
  Bell,
  CalendarDays,
  AlertCircle,
  LogIn,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { getApiWithToken, postApiWithToken } from "@/services/apiWrapper";
import PermissionGate from "@/components/PermissionGate";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatDateInOrgTimeZone,
  formatDateTimeInOrgTimeZone,
  formatTimeInOrgTimeZone
} from "@/utils/timezone";

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
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
};

const today = new Date();
const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
const currentYear = today.getFullYear();

type AttendanceDay = {
  status: "present" | "half_day_present" | "full_day_present" | "absent" | "pending_checkout";
  checkInAt: string | null;
  checkOutAt: string | null;
  excludeFromPayroll?: boolean;
  missedCheckout?: boolean;
  isOnLeave: boolean;
  leaveType: string | null;
  isWeekOff: boolean;
  holidayName: string | null;
};

type CheckInPolicy = {
  attendanceIpEnabled: boolean;
  attendanceSelfieRequired: boolean;
  attendanceGeoFenceEnabled: boolean;
  attendanceGeoRadiusMeters: number;
};

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const isPresentLikeStatus = (status?: string | null) =>
  status === "present" || status === "half_day_present" || status === "full_day_present";

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

const EmployeeDashboard = () => {
  const navigate = useNavigate();

  const [weeklyStatus, setWeeklyStatus] = useState<string | null>(null);
  const [weeklyHours, setWeeklyHours] = useState<number>(0);
  const [weeklyEntries, setWeeklyEntries] = useState<any[]>([]);
  const [onlineList, setOnlineList] = useState<any[]>([]);
  const [onLeaveList, setOnLeaveList] = useState<any[]>([]);
  const [attendanceToday, setAttendanceToday] = useState<any | null>(null);
  const [leaveBalances, setLeaveBalances] = useState<any[]>([]);
  const [myLeaves, setMyLeaves] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [upcomingHolidays, setUpcomingHolidays] = useState<any[]>([]);
  const [weekOffDays, setWeekOffDays] = useState<number[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<{ birthdays: any[]; anniversaries: any[] }>({
    birthdays: [],
    anniversaries: []
  });
  const [matrixDays, setMatrixDays] = useState<Record<number, AttendanceDay>>({});
  const [daysInMonth, setDaysInMonth] = useState<number>(31);
  const [myProfile, setMyProfile] = useState<any>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [onlineDialogOpen, setOnlineDialogOpen] = useState(false);
  const [pendingDialogOpen, setPendingDialogOpen] = useState(false);
  const [weeklyDialogOpen, setWeeklyDialogOpen] = useState(false);
  const [checkInPolicy, setCheckInPolicy] = useState<CheckInPolicy>({
    attendanceIpEnabled: false,
    attendanceSelfieRequired: false,
    attendanceGeoFenceEnabled: false,
    attendanceGeoRadiusMeters: 200
  });

  const weekStart = useMemo(() => getWeekStart(new Date()), []);

  const loadDashboard = async (silent = false) => {
    if (!silent) setDashboardLoading(true);
    const todayIso = toDateInput(new Date());
    const weekStartIso = toDateInput(weekStart);
    const [weeklyRes, attendanceRes, leaveRes, balanceRes, onlineRes, onLeaveRes, notifRes, holidayRes, weekOffRes, matrixRes, profileRes, eventsRes, checkInPolicyRes] =
      await Promise.all([
        getApiWithToken(`/timesheets/weekly/my?weekStart=${weekStartIso}`, null, {
          requiredPermissions: ["TIMESHEET_VIEW_SELF"]
        }),
        getApiWithToken(`/timesheets/attendance/my?date=${todayIso}`, null, {
          requiredPermissions: ["TIMESHEET_VIEW_SELF"]
        }),
        getApiWithToken("/leaves/my", null, {
          requiredPermissions: ["LEAVE_VIEW_SELF"]
        }),
        getApiWithToken("/leave-balances/my", null, {
          requiredPermissions: ["LEAVE_VIEW_SELF"]
        }),
        getApiWithToken("/timesheets/online", null, {
          requiredPermissions: ["TIMESHEET_VIEW_ONLINE"]
        }),
        getApiWithToken("/timesheets/on-leave", null, {
          requiredPermissions: ["TIMESHEET_VIEW_ALL"]
        }),
        getApiWithToken("/notifications/my?limit=6", null, {
          requiredPermissions: ["NOTIFICATION_VIEW_SELF"]
        }),
        getApiWithToken(`/holidays?year=${currentYear}`, null, {
          requiredPermissions: ["HOLIDAY_VIEW", "LEAVE_VIEW_SELF", "LEAVE_APPLY"]
        }),
        getApiWithToken("/week-offs", null, {
          requiredPermissions: ["WEEK_OFF_VIEW"]
        }),
        getApiWithToken(`/timesheets/attendance/matrix/my?month=${currentMonth}`, null, {
          requiredPermissions: ["ATTENDANCE_VIEW_SELF"]
        }),
        getApiWithToken("/employees/me", null, {
          requiredPermissions: ["EMP_SELF_VIEW"]
        }),
        getApiWithToken("/employees/upcoming-events?days=7", null, {
          requiredPermissions: ["EMP_SELF_VIEW", "EMP_VIEW"]
        }),
        getApiWithToken("/timesheets/checkin-policy", null, {
          requiredPermissions: ["TIMESHEET_CHECKIN_SELF"]
        })
      ]);

    if (weeklyRes?.success && weeklyRes?.data) {
      setWeeklyStatus(weeklyRes.data.status || "draft");
      const entries = weeklyRes.data.entries || [];
      setWeeklyEntries(entries);
      const total = entries.reduce(
        (sum: number, e: any) => sum + (Number(e.hours) || 0),
        0
      );
      setWeeklyHours(total);
    } else {
      setWeeklyStatus(null);
      setWeeklyHours(0);
      setWeeklyEntries([]);
    }

    if (attendanceRes?.success) {
      const record = (attendanceRes.data || [])[0];
      setAttendanceToday(record || null);
    } else {
      setAttendanceToday(null);
    }

    setMyLeaves(leaveRes?.success ? (leaveRes.data || []) : []);
    setLeaveBalances(balanceRes?.success ? (balanceRes.data || []) : []);
    setOnlineList(onlineRes?.success ? (onlineRes.data || []) : []);
    setOnLeaveList(onLeaveRes?.success ? (onLeaveRes.data || []) : []);
    setNotifications(notifRes?.success ? (notifRes.data?.items || []) : []);

    if (holidayRes?.success) {
      const now = new Date();
      const upcoming = (holidayRes.data || [])
        .filter((h: any) => new Date(h.date) >= new Date(now.getFullYear(), now.getMonth(), now.getDate()))
        .slice(0, 6);
      setUpcomingHolidays(upcoming);
    } else {
      setUpcomingHolidays([]);
    }

    setWeekOffDays(weekOffRes?.success ? (weekOffRes.data?.weekOffDays || []) : []);
    setUpcomingEvents(
      eventsRes?.success
        ? {
            birthdays: eventsRes.data?.birthdays || [],
            anniversaries: eventsRes.data?.anniversaries || []
          }
        : { birthdays: [], anniversaries: [] }
    );

    if (matrixRes?.success) {
      const row = matrixRes.data?.employees?.[0];
      setMatrixDays(row?.days || {});
      setDaysInMonth(Number(matrixRes.data?.daysInMonth || 31));
    } else {
      setMatrixDays({});
      setDaysInMonth(31);
    }

    setMyProfile(profileRes?.success ? (profileRes.data || null) : null);

    if (checkInPolicyRes?.success && checkInPolicyRes?.data) {
      setCheckInPolicy({
        attendanceIpEnabled: Boolean(checkInPolicyRes.data.attendanceIpEnabled),
        attendanceSelfieRequired: Boolean(checkInPolicyRes.data.attendanceSelfieRequired),
        attendanceGeoFenceEnabled: Boolean(checkInPolicyRes.data.attendanceGeoFenceEnabled),
        attendanceGeoRadiusMeters: Number(checkInPolicyRes.data.attendanceGeoRadiusMeters || 200)
      });
    }
    if (!silent) setDashboardLoading(false);
  };

  useEffect(() => {
    loadDashboard();
    const timer = window.setInterval(() => {
      loadDashboard(true);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [weekStart]);

  const monthlySummary = useMemo(() => {
    let present = 0;
    let pendingCheckout = 0;
    let absent = 0;
    let onLeave = 0;
    let weekOff = 0;
    for (let day = 1; day <= daysInMonth; day += 1) {
      const cell = matrixDays[day];
      if (!cell) continue;
      if (cell.holidayName) continue;
      if (cell.isWeekOff) {
        weekOff += 1;
        continue;
      }
      if (cell.isOnLeave) {
        onLeave += 1;
        continue;
      }
      if (cell.status === "pending_checkout") {
        pendingCheckout += 1;
      } else if (isPresentLikeStatus(cell.status)) {
        present += 1;
      } else {
        absent += 1;
      }
    }
    return { present, pendingCheckout, absent, onLeave, weekOff, total: daysInMonth };
  }, [matrixDays, daysInMonth]);

  const pendingLeaves = useMemo(
    () => (myLeaves || []).filter((l: any) => l.status === "pending").length,
    [myLeaves]
  );
  const pendingLeaveItems = useMemo(
    () => (myLeaves || []).filter((l: any) => l.status === "pending"),
    [myLeaves]
  );

  const pendingTimesheets = useMemo(
    () => (weeklyStatus === "submitted" ? 1 : 0),
    [weeklyStatus]
  );

  const missingProfileFields = useMemo(() => {
    if (!myProfile) return [];
    const missing: string[] = [];
    if (!myProfile.phone) missing.push("Phone");
    if (!myProfile.dob) missing.push("Date of birth");
    if (!myProfile.gender) missing.push("Gender");
    if (!myProfile.address?.line1) missing.push("Address");
    if (!Array.isArray(myProfile.emergencyContacts) || myProfile.emergencyContacts.length === 0) {
      missing.push("Emergency contact");
    }
    return missing;
  }, [myProfile]);

  const totalLeaveRemaining = useMemo(
    () => (leaveBalances || []).reduce((sum: number, b: any) => sum + Number(b.remaining || 0), 0),
    [leaveBalances]
  );

  const weeklyProgress = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayKey = toDateInput(todayStart);
    const sundayStart = new Date(todayStart);
    sundayStart.setDate(todayStart.getDate() - todayStart.getDay());

    let todayLiveHours = 0;
    if (attendanceToday?.checkInAt) {
      const inAt = new Date(attendanceToday.checkInAt);
      const outAt = attendanceToday?.checkOutAt ? new Date(attendanceToday.checkOutAt) : now;
      todayLiveHours = Math.max(0, (outAt.getTime() - inAt.getTime()) / (1000 * 60 * 60));
    }

    const dayRows = Array.from({ length: 7 }, (_, idx) => {
      const dayDate = new Date(sundayStart);
      dayDate.setDate(sundayStart.getDate() + idx);
      dayDate.setHours(0, 0, 0, 0);
      const dayKey = toDateInput(dayDate);

      const dayName = dayNames[dayDate.getDay()];
      const entryForDay = (weeklyEntries || []).find((e: any) => {
        if (!e?.date) return false;
        return toDateInput(new Date(e.date)) === dayKey;
      });
      const timesheetHours = Number(entryForDay?.hours || 0);

      const matrixCell = dayDate.getMonth() === today.getMonth() && dayDate.getFullYear() === today.getFullYear()
        ? matrixDays[dayDate.getDate()]
        : null;

      let attendanceHours = 0;
      if (matrixCell?.checkInAt) {
        const inAt = new Date(matrixCell.checkInAt);
        const outAt = matrixCell?.checkOutAt ? new Date(matrixCell.checkOutAt) : now;
        attendanceHours = Math.max(0, (outAt.getTime() - inAt.getTime()) / (1000 * 60 * 60));
      }

      const completedHours = dayKey === todayKey
        ? Math.max(timesheetHours, attendanceHours, todayLiveHours)
        : Math.max(timesheetHours, attendanceHours);

      return {
        dayName,
        date: dayDate,
        timesheetHours,
        attendanceHours,
        completedHours
      };
    });

    const completedIncludingToday = dayRows
      .filter((d) => toDateInput(new Date(d.date)) <= todayKey)
      .reduce((sum, d) => sum + Number(d.completedHours || 0), 0);

    const completedTimesheetHours = dayRows
      .filter((d) => toDateInput(new Date(d.date)) <= todayKey)
      .reduce((sum, d) => sum + Number(d.timesheetHours || 0), 0);

    const todayTimesheetHours = dayRows.find((d) => toDateInput(new Date(d.date)) === todayKey)?.timesheetHours || 0;

    return {
      completedTimesheetHours,
      todayTimesheetHours,
      todayLiveHours,
      completedIncludingToday,
      dayRows
    };
  }, [weeklyEntries, attendanceToday]);

  const hasCheckedInToday = Boolean(attendanceToday?.checkInAt);
  const isCheckedIn = hasCheckedInToday && !attendanceToday?.checkOutAt;
  const isCheckedOut = hasCheckedInToday && Boolean(attendanceToday?.checkOutAt);

  const checkInTimeText = attendanceToday?.checkInAt
    ? formatTimeInOrgTimeZone(attendanceToday.checkInAt)
    : "-";
  const checkOutTimeText = attendanceToday?.checkOutAt
    ? formatTimeInOrgTimeZone(attendanceToday.checkOutAt)
    : "-";

  const lateFlag = useMemo(() => {
    return Number(attendanceToday?.lateByMinutes || 0) > 0;
  }, [attendanceToday]);

  const handleCheckIn = async () => {
    const payload: Record<string, any> = {};

    if (checkInPolicy.attendanceGeoFenceEnabled) {
      if (!navigator.geolocation) {
        toast.error("Location is not supported on this browser");
        return;
      }
      const geo = await new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) =>
            resolve({
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
    const res = await postApiWithToken("/timesheets/check-in", payload, null, {
      requiredPermissions: ["TIMESHEET_CHECKIN_SELF"]
    });
    setCheckinLoading(false);
    if (!res?.success) {
      toast.error(res?.message || "Check-in failed");
      return;
    }
    toast.success("Checked in");
    loadDashboard();
  };

  const handleCheckOut = async () => {
    setCheckoutLoading(true);
    const res = await postApiWithToken("/timesheets/check-out", {}, null, {
      requiredPermissions: ["TIMESHEET_CHECKOUT_SELF"]
    });
    setCheckoutLoading(false);
    if (!res?.success) {
      toast.error(res?.message || "Check-out failed");
      return;
    }
    toast.success("Checked out");
    loadDashboard();
  };

  const firstDayOffset = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
  const monthCells = Array.from({ length: firstDayOffset + daysInMonth }, (_, idx) => {
    if (idx < firstDayOffset) return null;
    return idx - firstDayOffset + 1;
  });

  return (
    <MainLayout title="My Dashboard" breadcrumb={[{ label: "Home" }, { label: "My Dashboard" }]}>
      {dashboardLoading ? (
        <>
          <div className="rounded-2xl border bg-gradient-to-r from-background to-muted/40 p-5 space-y-3">
            <Skeleton className="h-4 w-36 rounded-sm" />
            <Skeleton className="h-8 w-56 rounded-sm" />
            <Skeleton className="h-4 w-72 rounded-sm" />
            <div className="flex flex-wrap gap-2 pt-1">
              <Skeleton className="h-10 w-28 rounded-sm" />
              <Skeleton className="h-10 w-28 rounded-sm" />
              <Skeleton className="h-10 w-28 rounded-sm" />
              <Skeleton className="h-10 w-28 rounded-sm" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-5">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={`emp-kpi-skeleton-${idx}`} className="stat-card space-y-3">
                <Skeleton className="h-4 w-28 rounded-sm" />
                <Skeleton className="h-8 w-20 rounded-sm" />
                <Skeleton className="h-3 w-40 rounded-sm" />
              </div>
            ))}
          </div>

          <div className="mt-6">
            <div className="grid grid-cols-3 w-full md:w-[480px] gap-2">
              <Skeleton className="h-10 rounded-sm" />
              <Skeleton className="h-10 rounded-sm" />
              <Skeleton className="h-10 rounded-sm" />
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-4">
              <div className="stat-card xl:col-span-2 space-y-3">
                <Skeleton className="h-5 w-44 rounded-sm" />
                {Array.from({ length: 4 }).map((_, idx) => (
                  <Skeleton key={`emp-overview-left-${idx}`} className="h-16 w-full rounded-sm" />
                ))}
              </div>
              <div className="stat-card space-y-3">
                <Skeleton className="h-5 w-32 rounded-sm" />
                <Skeleton className="h-4 w-full rounded-sm" />
                <Skeleton className="h-4 w-4/5 rounded-sm" />
                <Skeleton className="h-10 w-full rounded-sm" />
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
              <div className="stat-card space-y-3">
                <Skeleton className="h-5 w-36 rounded-sm" />
                {Array.from({ length: 3 }).map((_, idx) => (
                  <Skeleton key={`emp-overview-bottom-left-${idx}`} className="h-10 w-full rounded-sm" />
                ))}
              </div>
              <div className="stat-card space-y-3">
                <Skeleton className="h-5 w-40 rounded-sm" />
                {Array.from({ length: 4 }).map((_, idx) => (
                  <Skeleton key={`emp-overview-bottom-right-${idx}`} className="h-8 w-full rounded-sm" />
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
      <>
      <motion.div
        className="rounded-2xl border bg-gradient-to-r from-background to-muted/40 p-5"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <CalendarCheck className="w-4 h-4" />
              Today Status
              {lateFlag && <Badge variant="destructive">Late</Badge>}
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">
              {isCheckedOut ? "Checked Out" : isCheckedIn ? "Pending Checkout" : "Attendance Not Marked"}
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              Check-in: {checkInTimeText} • Check-out: {checkOutTimeText}
            </p>
            {isCheckedIn && (
              <p className="text-xs text-orange-700 mt-1">
                Session is open and excluded from payroll until check-out.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <PermissionGate permissions={["TIMESHEET_CHECKIN_SELF"]}>
              <Button onClick={handleCheckIn} disabled={hasCheckedInToday || checkinLoading}>
                <LogIn className="w-4 h-4 mr-2" /> Check In
              </Button>
            </PermissionGate>
            <PermissionGate permissions={["TIMESHEET_CHECKOUT_SELF"]}>
              <Button variant="outline" onClick={handleCheckOut} disabled={!hasCheckedInToday || checkoutLoading}>
                <LogOut className="w-4 h-4 mr-2" /> Check Out
              </Button>
            </PermissionGate>
            <Button variant="outline" onClick={() => navigate("/leave/apply")}>Apply Leave</Button>
            <Button variant="outline" onClick={() => navigate("/timesheets")}>Timesheet</Button>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-5">
        <motion.div className="stat-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <ClipboardCheck className="w-4 h-4" /> Leave Balance
          </div>
          <div className="text-2xl font-semibold">{totalLeaveRemaining.toFixed(1)}</div>
          <p className="text-sm text-muted-foreground mt-1">Total remaining</p>
        </motion.div>

        <motion.button
          type="button"
          onClick={() => setWeeklyDialogOpen(true)}
          className="stat-card text-left"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Timer className="w-4 h-4" /> Weekly Timesheet
          </div>
          <div className="text-2xl font-semibold">{weeklyProgress.completedIncludingToday.toFixed(1)}h</div>
          <p className="text-sm text-muted-foreground mt-1">
            {weeklyStatus ? `Status: ${weeklyStatus}` : "No weekly sheet"} • click to view
          </p>
        </motion.button>

        <motion.button
          type="button"
          onClick={() => setOnlineDialogOpen(true)}
          className="stat-card text-left"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Users className="w-4 h-4" /> Team
          </div>
          <div className="text-2xl font-semibold">{onlineList.length}</div>
          <p className="text-sm text-muted-foreground mt-1">Online now • click to view</p>
        </motion.button>

        <motion.button
          type="button"
          onClick={() => setPendingDialogOpen(true)}
          className="stat-card text-left"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <AlertCircle className="w-4 h-4" /> Pending Requests
          </div>
          <div className="text-2xl font-semibold">{pendingLeaves + pendingTimesheets}</div>
          <p className="text-sm text-muted-foreground mt-1">Leaves: {pendingLeaves} • Timesheet: {pendingTimesheets} • click to view</p>
        </motion.button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
        <TabsList className="grid grid-cols-3 w-full md:w-[480px]">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="planning">Planning</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <motion.div className="stat-card xl:col-span-2" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Latest Notifications</h3>
                <Bell className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="space-y-2 max-h-64 overflow-auto custom-scroll pr-1">
                {notifications.length === 0 && <p className="text-sm text-muted-foreground">No notifications</p>}
                {notifications.map((n: any) => (
                  <div key={n._id} className="p-3 rounded-lg border bg-background">
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{n.message}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div className="stat-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Profile Completion</h3>
                <Clock3 className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                {myProfile?.profileCompleted ? "Profile marked completed." : "Profile is not completed yet."}
              </p>
              <div className="mt-3 text-sm">
                {missingProfileFields.length === 0 ? (
                  <span className="text-emerald-700">No pending profile tasks.</span>
                ) : (
                  <span className="text-muted-foreground">Pending: {missingProfileFields.join(", ")}</span>
                )}
              </div>
              <div className="flex gap-2 mt-3">
                <Button variant="outline" onClick={() => navigate("/profile")}>Update Profile</Button>
                <Button variant="outline" onClick={() => navigate("/leave")}>My Leaves</Button>
              </div>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <motion.div className="stat-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Team Snapshot</h3>
                <Badge variant="outline">Today</Badge>
              </div>
              <div className="text-sm space-y-2">
                <div className="p-2 rounded-lg bg-muted/40">Online now: <span className="font-semibold">{onlineList.length}</span></div>
                <div className="p-2 rounded-lg bg-muted/40">On leave today: <span className="font-semibold">{onLeaveList.length}</span></div>
              </div>
            </motion.div>

            <motion.div className="stat-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <div className="flex items-center gap-2 mb-3">
                <CalendarDays className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-semibold">Next 7 Days Events</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium mb-1">Birthdays</p>
                  <div className="space-y-1">
                    {(upcomingEvents.birthdays || []).length === 0 && (
                      <p className="text-xs text-muted-foreground">No upcoming birthdays</p>
                    )}
                    {(upcomingEvents.birthdays || []).slice(0, 4).map((e: any) => (
                      <div key={`eb-${e.employeeId}-${e.eventDate}`} className="text-xs p-2 rounded bg-muted/40 flex items-center justify-between">
                        <span>{e.name}</span>
                        <span className="text-muted-foreground">
                          {formatDateInOrgTimeZone(e.eventDate)} ({e.daysAway === 0 ? "Today" : `${e.daysAway}d`})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Anniversaries</p>
                  <div className="space-y-1">
                    {(upcomingEvents.anniversaries || []).length === 0 && (
                      <p className="text-xs text-muted-foreground">No upcoming anniversaries</p>
                    )}
                    {(upcomingEvents.anniversaries || []).slice(0, 4).map((e: any) => (
                      <div key={`ea-${e.employeeId}-${e.eventDate}`} className="text-xs p-2 rounded bg-muted/40 flex items-center justify-between">
                        <span>{e.name}</span>
                        <span className="text-muted-foreground">
                          {formatDateInOrgTimeZone(e.eventDate)} ({e.years}y)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </TabsContent>

        <TabsContent value="attendance" className="mt-4 space-y-4">
          <motion.div className="stat-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Attendance Summary</h3>
              <Button variant="outline" size="sm" onClick={() => navigate("/attendance")}>Open Attendance</Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
              <div className="p-2 rounded-lg bg-muted/40">Present: <span className="font-semibold">{monthlySummary.present}</span></div>
              <div className="p-2 rounded-lg bg-muted/40">Pending: <span className="font-semibold">{monthlySummary.pendingCheckout}</span></div>
              <div className="p-2 rounded-lg bg-muted/40">Absent: <span className="font-semibold">{monthlySummary.absent}</span></div>
              <div className="p-2 rounded-lg bg-muted/40">On Leave: <span className="font-semibold">{monthlySummary.onLeave}</span></div>
              <div className="p-2 rounded-lg bg-muted/40">Week Off: <span className="font-semibold">{monthlySummary.weekOff}</span></div>
            </div>
          </motion.div>

          <motion.div className="stat-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Monthly Attendance Calendar</h3>
              <Badge variant="outline">{formatDateTimeInOrgTimeZone(new Date(), { month: "long", year: "numeric" })}</Badge>
            </div>
            <div className="grid grid-cols-7 gap-2 mb-2">
              {dayNames.map((d) => (
                <div key={d} className="text-xs text-muted-foreground text-center">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {monthCells.map((day, idx) => {
                if (!day) return <div key={`empty-${idx}`} className="h-14 rounded-lg bg-transparent" />;
                const cell = matrixDays[day];
                const isFuture = day > today.getDate();
                const baseClass = "h-14 rounded-lg border text-xs p-2 flex flex-col justify-between";
                let toneClass = "bg-muted/20";
                let label = "";
                if (cell?.holidayName) {
                  toneClass = "bg-rose-100 border-rose-300";
                  label = "Holiday";
                } else if (cell?.isWeekOff) {
                  toneClass = "bg-sky-100 border-sky-300";
                  label = "WO";
                } else if (cell?.isOnLeave) {
                  toneClass = "bg-emerald-100 border-emerald-300";
                  label = "Leave";
                } else if (cell?.status === "pending_checkout") {
                  toneClass = "bg-orange-100 border-orange-300";
                  label = "Pending";
                } else if (isPresentLikeStatus(cell?.status)) {
                  toneClass = "bg-blue-100 border-blue-300";
                  label = "Present";
                } else if (!isFuture) {
                  toneClass = "bg-rose-100 border-rose-300";
                  label = "Absent";
                }
                return (
                  <div key={day} className={`${baseClass} ${toneClass}`}>
                    <span className="font-semibold">{day}</span>
                    <span className="text-[10px] text-muted-foreground">{label}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2 mt-4 text-xs">
              <span className="px-2 py-1 rounded bg-blue-100 border border-blue-300">Present</span>
              <span className="px-2 py-1 rounded bg-orange-100 border border-orange-300">Pending Checkout</span>
              <span className="px-2 py-1 rounded bg-rose-100 border border-rose-300">Absent</span>
              <span className="px-2 py-1 rounded bg-emerald-100 border border-emerald-300">Leave</span>
              <span className="px-2 py-1 rounded bg-sky-100 border border-sky-300">Week Off</span>
              <span className="px-2 py-1 rounded bg-rose-100 border border-rose-300">Holiday</span>
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="planning" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <motion.div className="stat-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center gap-2 mb-3">
                <ClipboardCheck className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-semibold">Leave Balances</h3>
              </div>
              <div className="space-y-2">
                {leaveBalances.length === 0 && <p className="text-sm text-muted-foreground">No balances found</p>}
                {leaveBalances.map((b: any) => (
                  <div key={b.leaveTypeId} className="p-2 rounded-lg border">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{b.leaveType}</span>
                      <span>{Number(b.remaining || 0).toFixed(1)}/{Number(b.total || 0).toFixed(1)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Used: {Number(b.used || 0).toFixed(1)} | Pending: {Number(b.pending || 0).toFixed(1)}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div className="stat-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <div className="flex items-center gap-2 mb-3">
                <CalendarDays className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-semibold">Upcoming Holidays</h3>
              </div>
              <div className="space-y-2">
                {upcomingHolidays.length === 0 && <p className="text-sm text-muted-foreground">No upcoming holidays</p>}
                {upcomingHolidays.map((h: any) => (
                  <div key={h._id} className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/40">
                    <span>{h.name}</span>
                    <span className="text-muted-foreground">{formatDateInOrgTimeZone(h.date)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <p className="text-sm font-medium mb-2">Week Off Days</p>
                <div className="flex flex-wrap gap-2">
                  {weekOffDays.length === 0 && <span className="text-sm text-muted-foreground">Not configured</span>}
                  {weekOffDays.map((d) => (
                    <Badge key={d} variant="secondary">{dayNames[d]}</Badge>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={onlineDialogOpen} onOpenChange={setOnlineDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Online Employees</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-auto custom-scroll pr-1">
            {onlineList.length === 0 && (
              <p className="text-sm text-muted-foreground">No employees are online right now.</p>
            )}
            {onlineList.map((item: any) => (
              <div key={item._id} className="flex items-center justify-between text-sm p-2 rounded-lg border bg-background">
                <span>{item.employeeId?.firstName} {item.employeeId?.lastName}</span>
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={pendingDialogOpen} onOpenChange={setPendingDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pending Requests</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-80 overflow-auto custom-scroll pr-1">
            {pendingLeaveItems.length === 0 && pendingTimesheets === 0 && (
              <p className="text-sm text-muted-foreground">No pending requests.</p>
            )}

            {pendingLeaveItems.map((leave: any) => (
              <div key={leave._id} className="p-2 rounded-lg border bg-background text-sm">
                <p className="font-medium">
                  Leave: {leave.leaveTypeName || leave.leaveTypeId?.name || "Leave Request"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDateInOrgTimeZone(leave.fromDate)}
                  {leave.toDate ? ` to ${formatDateInOrgTimeZone(leave.toDate)}` : ""}
                </p>
              </div>
            ))}

            {pendingTimesheets > 0 && (
              <div className="p-2 rounded-lg border bg-background text-sm">
                <p className="font-medium">Timesheet: Weekly submission pending approval</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Current week timesheet is submitted and waiting for action.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={weeklyDialogOpen} onOpenChange={setWeeklyDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Weekly Hours Progress</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div className="p-2 rounded-lg bg-muted/40">
              Completed till today (including today):{" "}
              <span className="font-semibold">{weeklyProgress.completedIncludingToday.toFixed(1)}h</span>
            </div>
            <div className="p-2 rounded-lg bg-muted/40">
              Weekly timesheet total: <span className="font-semibold">{weeklyHours.toFixed(1)}h</span>
            </div>
            <div className="p-2 rounded-lg bg-muted/40">
              Today logged in timesheet: <span className="font-semibold">{weeklyProgress.todayTimesheetHours.toFixed(1)}h</span>
            </div>
            <div className="p-2 rounded-lg bg-muted/40">
              Today worked (attendance): <span className="font-semibold">{weeklyProgress.todayLiveHours.toFixed(1)}h</span>
            </div>
            <div className="mt-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Sunday to Saturday</p>
              <div className="space-y-1">
                {weeklyProgress.dayRows.map((row: any) => (
                  <div key={row.dayName} className="flex items-center justify-between p-2 rounded-lg border bg-background">
                    <div>
                      <p className="font-medium">{row.dayName}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {row.date ? formatDateInOrgTimeZone(row.date) : "-"}
                      </p>
                    </div>
                    <span className="font-semibold">{Number(row.completedHours || 0).toFixed(1)}h</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </>
      )}
    </MainLayout>
  );
};

export default EmployeeDashboard;
