import { MainLayout } from "@/components/layout/MainLayout";
import {
  Users,
  CalendarDays,
  UserPlus,
  FileClock,
  ClipboardCheck,
  AlertCircle,
  Building2,
  Bell,
  ShieldCheck,
  BarChart3,
  UserCheck,
  CircleCheck,
  UserX,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getApiWithToken, postApiWithToken } from "@/services/apiWrapper";
import { toast } from "sonner";
import { formatDateInOrgTimeZone, formatTimeInOrgTimeZone, getOrgTimeZone, setOrgTimeZone } from "@/utils/timezone";
import { setPermissions } from "@/utils/auth";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/useAuth";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Label, LabelList, Pie, PieChart, XAxis, YAxis } from "recharts";

/* ========================= Dashboard ========================= */

type NamedEntity = {
  _id?: string;
  name?: string;
};

type EmployeeRecord = {
  _id?: string;
  employeeId?: string | { _id?: string };
  employeeCode?: string;
  firstName?: string;
  lastName?: string;
  dateOfJoining?: string;
  status?: string;
  departmentId?: NamedEntity | null;
  designationId?: NamedEntity | null;
};

type AttendanceActivityRow = {
  employeeId?: string;
  checkInAt?: string | null;
  checkOutAt?: string | null;
};

type LeaveRecord = {
  status?: string;
  fromDate?: string;
  toDate?: string;
  createdAt?: string;
  employeeId?: string | EmployeeRecord;
  leaveTypeId?: NamedEntity | null;
};

type TimesheetRecord = {
  status?: string;
  weekStart?: string;
  createdAt?: string;
  submittedAt?: string;
};

type HolidayRecord = {
  _id?: string;
  date?: string;
  name?: string;
};

type NotificationRecord = {
  _id?: string;
  title?: string;
  message?: string;
  createdAt?: string;
};

type TodayStatusRecord = {
  employeeId?: string;
  present?: boolean;
  absent?: boolean;
  pendingCheckout?: boolean;
  isOnLeave?: boolean;
  isWeekOff?: boolean;
  holidayName?: string | null;
  overriddenBy?: string | null;
  overriddenAt?: string | null;
  lateByMinutes?: number;
  checkInAt?: string | null;
  checkOutAt?: string | null;
};

type DashboardStats = {
  kpis?: {
    totalEmployees: number;
    presentToday: number;
    absentToday: number;
    checkedInOnly: number;
    lateArrivals: number;
    onLeaveToday: number;
  };
  monthDaySummary?: {
    present: number;
    pendingCheckout: number;
    absent: number;
    onLeave: number;
    weekOff: number;
    holiday: number;
    overridden: number;
  };
  departmentAnalytics?: { name: string; employees: number; present: number; onLeave: number; absent: number }[];
  attendanceTrend?: { key: string; label?: string; present?: number; absent?: number; excluded?: number }[];
  attendanceTrendMonthly?: { key: string; label?: string; present?: number; absent?: number; excluded?: number }[];
};

type OrgSettingsRecord = {
  timezone?: string;
  sandwichRuleEnabled?: boolean;
  attendanceLockEnabled?: boolean;
  leaveTypeCreditMode?: string;
};

type OrganizationRecord = {
  _id?: string;
  name?: string;
  code?: string;
  timezone?: string;
};

type UserRecord = {
  _id?: string;
  email?: string;
  roles?: { name?: string }[];
};

type KpiDisplayRow = {
  id: string;
  name: string;
  employeeCode: string;
  department: string;
  designation: string;
  checkInAt?: string;
  checkOutAt?: string;
  shiftEndTime?: string;
  lateByMinutes?: number;
  leaveType?: string;
  absentReason?: string;
};

type DoughnutSlice = {
  key: string;
  label: string;
  value: number;
  color: string;
  shadowColor: string;
};

type TrendPoint = {
  key: string;
  label: string;
  [key: string]: string | number;
};

type GraphTrendKey =
  | "attendance"
  | "leaves"
  | "approvals"
  | "timesheets"
  | "lifecycle"
  | "holidays"
  | "notifications"
  | "exceptions";

type GraphSeries = {
  key: string;
  label: string;
  color: string;
};

type GraphDefinition = {
  key: GraphTrendKey;
  title: string;
  description: string;
  weekly: TrendPoint[];
  monthly: TrendPoint[];
  series: GraphSeries[];
  type?: "area" | "bar";
};

const isPresentLikeStatus = (status?: string | null) =>
  status === "present" || status === "half_day_present" || status === "full_day_present";

const getEmployeeId = (value: string | EmployeeRecord | { employeeId?: string | { _id?: string } } | null | undefined) =>
  String(value?._id || value?.employeeId?._id || value?.employeeId || value || "");

const hasAttendanceActivity = (row: AttendanceActivityRow | null | undefined) => Boolean(row?.checkInAt || row?.checkOutAt);

const toOrgDateKey = (value: string | number | Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: getOrgTimeZone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(value));
  const read = (type: "year" | "month" | "day") => parts.find((p) => p.type === type)?.value || "00";
  return `${read("year")}-${read("month")}-${read("day")}`;
};

const shiftDateKey = (dateKey: string, deltaDays: number) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const utc = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  utc.setUTCDate(utc.getUTCDate() + deltaDays);
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const buildRecentDateKeys = (endKey: string, days: number) =>
  Array.from({ length: days }).map((_, index) => shiftDateKey(endKey, index - (days - 1)));

const formatTrendLabel = (dateKey: string, mode: "weekly" | "monthly") =>
  formatDateInOrgTimeZone(new Date(`${dateKey}T12:00:00Z`), mode === "weekly"
    ? { weekday: "short" }
    : { month: "short", day: "numeric" });

const parseTimeToMinutes = (value?: string | null) => {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
};

const getCurrentOrgMinutes = () => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: getOrgTimeZone(),
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date());
  const read = (type: "hour" | "minute") => Number(parts.find((p) => p.type === type)?.value || "0");
  return read("hour") * 60 + read("minute");
};

const doughnutPalette = {
  present: { color: "#22c55e", shadowColor: "#15803d" },
  absent: { color: "#f97316", shadowColor: "#c2410c" },
  leave: { color: "#3b82f6", shadowColor: "#1d4ed8" },
  missed: { color: "#a855f7", shadowColor: "#7e22ce" },
  weekOff: { color: "#38bdf8", shadowColor: "#0284c7" },
  holiday: { color: "#fb7185", shadowColor: "#e11d48" }
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { isSuperAdmin, permissions } = useAuth();
  const today = new Date();
  const todayKey = toOrgDateKey(today);
  const [todayYearStr, todayMonthStr, todayDayStr] = todayKey.split("-");
  const todayYear = Number(todayYearStr);
  const todayDay = Number(todayDayStr);
  const monthValue = `${todayYearStr}-${todayMonthStr}`;
  const yearValue = todayYear;
  const currentOrgMinutes = useMemo(() => getCurrentOrgMinutes(), []);

  /* ---------- ORG STATE ---------- */
  const [showOrgPopup, setShowOrgPopup] = useState(false);
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [showCreateOrg, setShowCreateOrg] = useState(false);

  const [createOrgForm, setCreateOrgForm] = useState({
    name: "",
    code: "",
    timezone: "Asia/Kolkata",
    currency: "INR",
  });

  /* ---------- USER STATE ---------- */
  const [showUserPopup, setShowUserPopup] = useState(false);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [showCreateUser, setShowCreateUser] = useState(false);

  const [createUserForm, setCreateUserForm] = useState({
    email: "",
    password: "",
    roleIds: [] as string[],
    firstName: "",
    lastName: "",
    departmentId: "",
    designationId: "",
    employmentType: "",
    dateOfJoining: "",
    managerId: ""
  });

  const [roles, setRoles] = useState<NamedEntity[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [departments, setDepartments] = useState<NamedEntity[]>([]);
  const [designations, setDesignations] = useState<NamedEntity[]>([]);
  const [managers, setManagers] = useState<{ _id?: string; name: string }[]>([]);

  /* ---------- DASHBOARD DATA ---------- */
  const [employeeList, setEmployeeList] = useState<EmployeeRecord[]>([]);
  const [attendanceToday, setAttendanceToday] = useState<AttendanceActivityRow[]>([]);
  const [attendanceLast7, setAttendanceLast7] = useState<AttendanceActivityRow[]>([]);
  const [attendanceMatrix, setAttendanceMatrix] = useState<AttendanceActivityRow[]>([]);
  const [leaveList, setLeaveList] = useState<LeaveRecord[]>([]);
  const [weeklyList, setWeeklyList] = useState<TimesheetRecord[]>([]);
  const [holidays, setHolidays] = useState<HolidayRecord[]>([]);
  const [weekOffDays, setWeekOffDays] = useState<number[]>([]);
  const [todayStatusList, setTodayStatusList] = useState<TodayStatusRecord[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [orgSettings, setOrgSettings] = useState<OrgSettingsRecord | null>(null);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardView, setDashboardView] = useState<"data" | "graphical">(() => {
    if (typeof window === "undefined") return "graphical";
    const stored = window.localStorage.getItem("dashboard:view-mode");
    return stored === "data" ? "data" : "graphical";
  });
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedKpiKey, setSelectedKpiKey] = useState<
    "total" | "present" | "absent" | "leave" | "late" | "missed" | null
  >(null);
  const [graphDialogOpen, setGraphDialogOpen] = useState(false);
  const [selectedGraphKey, setSelectedGraphKey] = useState<GraphTrendKey | null>(null);

  /* ================= EFFECT ================= */

  /* ================= API ================= */

  const fetchOrganizations = useCallback(async () => {
    const res = await getApiWithToken("/organizations");
    setOrganizations(res?.data || []);
  }, []);

  const fetchUsers = async () => {
    const res = await getApiWithToken("/users");
    const list = res?.data?.items || [];
    setUsers(list);
    setShowUserPopup(true);
    setShowCreateUser(list.length === 0);
    fetchRoles();
    fetchDepartments();
    fetchDesignations();
    fetchManagers();
  };

  const fetchRoles = async () => {
    try {
      setRolesLoading(true);
      const res = await getApiWithToken("/roles");
      setRoles(res?.data || []);
    } catch {
      toast.error("Failed to load roles");
    } finally {
      setRolesLoading(false);
    }
  };

  const fetchDepartments = async () => {
    const res = await getApiWithToken("/departments");
    if (res?.success) setDepartments(res.data || []);
  };

  const fetchDesignations = async () => {
    const res = await getApiWithToken("/designations");
    if (res?.success) setDesignations(res.data || []);
  };

  const fetchManagers = async () => {
    const res = await getApiWithToken("/employees");
    if (res?.success) {
      const list = res.data?.items || [];
      setManagers(
        list.map((e: EmployeeRecord) => ({
          _id: e._id,
          name: `${e.firstName || ""} ${e.lastName || ""}`.trim()
        }))
      );
    }
  };

  const loadDashboardData = useCallback(async () => {
    setDashboardLoading(true);
    try {
      const summaryRes = await getApiWithToken(
        `/dashboard/summary?month=${monthValue}&year=${yearValue}`
      );

      if (!summaryRes?.success) {
        toast.error(summaryRes?.message || "Failed to load dashboard");
        return;
      }

      const data = summaryRes.data || {};
      if (typeof data?.orgSettings?.timezone === "string" && data.orgSettings.timezone) {
        setOrgTimeZone(data.orgSettings.timezone);
      }
      setEmployeeList(data.employeeList || []);
      setAttendanceToday(data.attendanceToday || []);
      setAttendanceLast7(data.attendanceLast7 || []);
      setAttendanceMatrix(data.attendanceMatrix || []);
      setLeaveList(data.leaveList || []);
      setWeeklyList(data.weeklyList || []);
      setHolidays(data.holidays || []);
      setWeekOffDays(data.weekOffDays || []);
      setTodayStatusList(data.todayStatusList || []);
      setDashboardStats(data.dashboardStats || null);
      setOrgSettings(data.orgSettings || null);
      setNotifications(data.notifications || []);
    } finally {
      setDashboardLoading(false);
    }
  }, [monthValue, yearValue]);

  useEffect(() => {
    if (!isSuperAdmin && permissions.length === 0) return;
    loadDashboardData();
  }, [isSuperAdmin, loadDashboardData, permissions]);

  useEffect(() => {
    if (!showOrgPopup) return;
    fetchOrganizations();
  }, [fetchOrganizations, showOrgPopup]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("dashboard:view-mode", dashboardView);
  }, [dashboardView]);

  const switchOrganization = async (organizationId: string) => {
    const res = await postApiWithToken("/users/switch-org", { organizationId });

    if (!res?.success) {
      toast.error("Failed to switch organization");
      return;
    }

    localStorage.setItem("selectedOrganization", organizationId);
    setShowOrgPopup(false);
    toast.success("Organization switched");

    try {
      const permRes = await getApiWithToken("/users/me/permissions");
      if (permRes?.success) {
        setPermissions(permRes.data || []);
      }
    } catch {
      setPermissions([]);
    }

    fetchUsers();
  };

  const handleCreateOrganization = async () => {
    const payload = {
      ...createOrgForm,
      adminUserId: localStorage.getItem("adminUserId"),
      adminRoleId: localStorage.getItem("adminRoleId"),
    };

    const res = await postApiWithToken("/organizations", payload);

    if (res?.success) {
      toast.success("Organization created");
      fetchOrganizations();
      setShowCreateOrg(false);
    } else {
      toast.error(res?.message || "Create organization failed");
    }
  };

  const handleCreateUser = async () => {
    if (
      !createUserForm.email ||
      !createUserForm.password ||
      createUserForm.roleIds.length === 0 ||
      !createUserForm.firstName ||
      !createUserForm.lastName ||
      !createUserForm.departmentId ||
      !createUserForm.designationId ||
      !createUserForm.employmentType ||
      !createUserForm.dateOfJoining
    ) {
      toast.error("All fields are required");
      return;
    }

    const res = await postApiWithToken("/users/org-user", createUserForm);

    if (res?.success) {
      toast.success("User created");
      fetchUsers();
      setShowCreateUser(false);
      setCreateUserForm({
        email: "",
        password: "",
        roleIds: [],
        firstName: "",
        lastName: "",
        departmentId: "",
        designationId: "",
        employmentType: "",
        dateOfJoining: "",
        managerId: ""
      });
    } else {
      toast.error(res?.message || "User creation failed");
    }
  };

  const kpis = useMemo(() => {
    if (dashboardStats?.kpis) return dashboardStats.kpis;
    return {
      totalEmployees: employeeList.length,
      presentToday: todayStatusList.filter((item) => item.present && !item.pendingCheckout).length,
      absentToday: todayStatusList.filter((item) => item.absent).length,
      checkedInOnly: todayStatusList.filter((item) => item.pendingCheckout).length,
      lateArrivals: todayStatusList.filter((item) => item.present && Number(item.lateByMinutes || 0) > 0).length,
      onLeaveToday: todayStatusList.filter((item) => item.isOnLeave).length
    };
  }, [dashboardStats, employeeList.length, todayStatusList]);

  const kpiHelpText = {
    total: "Total active employees only. Resigned and terminated employees are excluded.",
    present: "Employees who checked in or checked out today.",
    leave: "Employees with approved leave that includes today.",
    absent: "Employees without attendance today, excluding holiday, week off, and approved leave.",
    late: "Employees who checked in late based on shift start and grace rules.",
    missed: "Employees who checked in today but have not checked out yet."
  };

  const kpiEmployeeDetails = useMemo(() => {
    const employeeById = new Map(
      employeeList.map((emp) => [String(emp._id), emp] as const)
    );
    const todayStatusByEmployeeId = new Map(
      (todayStatusList || []).map((item) => [getEmployeeId(item.employeeId as string | EmployeeRecord), item] as const)
    );
    const attendanceTodayByEmployeeId = new Map(
      (attendanceToday || []).map((row) => [getEmployeeId(row.employeeId as string | EmployeeRecord), row] as const)
    );

    const toDisplayRow = (employee: EmployeeRecord, extra: Partial<KpiDisplayRow> = {}): KpiDisplayRow => ({
      id: String(employee?._id || employee?.employeeId || `${employee?.firstName || ""}-${employee?.lastName || ""}`),
      name: `${employee?.firstName || ""} ${employee?.lastName || ""}`.trim() || "-",
      employeeCode: employee?.employeeCode || "-",
      department: employee?.departmentId?.name || "Unassigned",
      designation: employee?.designationId?.name || "-",
      ...extra
    });

    const uniqueByEmployeeId = (rows: KpiDisplayRow[]) => {
      const map = new Map<string, KpiDisplayRow>();
      rows.forEach((row) => {
        const id = String(row.id || "");
        if (!id) return;
        if (!map.has(id)) map.set(id, row);
      });
      return Array.from(map.values());
    };

    const getEmployeeRecord = (employeeId: string) => employeeById.get(String(employeeId)) || {};
    const employeesOnApprovedLeaveToday = new Set(
      (leaveList || [])
        .filter((leave) => {
          const fromKey = toOrgDateKey(leave.fromDate);
          const toKey = toOrgDateKey(leave.toDate);
          return leave.status === "approved" && todayKey >= fromKey && todayKey <= toKey;
        })
        .map((leave) => getEmployeeId(leave.employeeId as string | EmployeeRecord))
        .filter(Boolean)
    );

    const totalRows = employeeList.map((emp) => toDisplayRow(emp));

    const presentRows = uniqueByEmployeeId(
      (attendanceToday || [])
        .filter((row) => {
          const employeeId = getEmployeeId(row.employeeId as string | EmployeeRecord);
          if (!employeeId || !hasAttendanceActivity(row)) return false;
          const status = todayStatusByEmployeeId.get(employeeId);
          if (status) {
            if (status.holidayName || status.isWeekOff || status.isOnLeave || status.pendingCheckout) return false;
            return Boolean(status.present || row.checkInAt || row.checkOutAt);
          }
          if (employeesOnApprovedLeaveToday.has(employeeId)) return false;
          return true;
        })
        .map((attendance) => {
          const employeeId = getEmployeeId(attendance.employeeId as string | EmployeeRecord);
          const status = todayStatusByEmployeeId.get(employeeId);
          
          return toDisplayRow(getEmployeeRecord(employeeId) as EmployeeRecord, {
            id: employeeId,
            checkInAt: status?.checkInAt
              ? formatTimeInOrgTimeZone(status.checkInAt, { hour: "2-digit", minute: "2-digit" })
              : attendance?.checkInAt
                ? formatTimeInOrgTimeZone(attendance.checkInAt, { hour: "2-digit", minute: "2-digit" })
                : "-",
            checkOutAt: status?.checkOutAt
              ? formatTimeInOrgTimeZone(status.checkOutAt, { hour: "2-digit", minute: "2-digit" })
              : attendance?.checkOutAt
                ? formatTimeInOrgTimeZone(attendance.checkOutAt, { hour: "2-digit", minute: "2-digit" })
                : "-"
          });
        })
    );

    const leaveRows = uniqueByEmployeeId(
      (leaveList || [])
        .filter((l) => {
          const fromKey = toOrgDateKey(l.fromDate);
          const toKey = toOrgDateKey(l.toDate);
          return l.status === "approved" && todayKey >= fromKey && todayKey <= toKey;
        })
        .map((l) => {
          const base = employeeById.get(String(l.employeeId?._id || l.employeeId)) || l.employeeId;
          return toDisplayRow((base || {}) as EmployeeRecord, {
            id: String(base?._id || l.employeeId?._id || l.employeeId),
            leaveType: l.leaveTypeId?.name || "-"
          });
        })
    );

    const absentRows = uniqueByEmployeeId(
      (todayStatusList || [])
        .filter((status) => Boolean(status?.absent))
        .map((status) => {
          const employeeId = String(status?.employeeId || "");
          return toDisplayRow(getEmployeeRecord(employeeId) as EmployeeRecord, {
            id: employeeId,
            absentReason: "Absent"
          });
        })
    );

    const lateRows = uniqueByEmployeeId(
      (todayStatusList || [])
        .filter((status) => {
          if (!status || status.holidayName || status.isWeekOff || status.isOnLeave) return false;
          return Boolean(status.present) && Number(status.lateByMinutes || 0) > 0;
        })
        .map((status) => {
          const employeeId = String(status.employeeId || "");
          return toDisplayRow(getEmployeeRecord(employeeId) as EmployeeRecord, {
            id: employeeId,
            lateByMinutes: Number(status.lateByMinutes || 0)
          });
        })
    );

    const missedRows = uniqueByEmployeeId(
      (todayStatusList || [])
        .filter((status) => Boolean(status?.pendingCheckout))
        .map((status) => {
          const employeeId = getEmployeeId(status?.employeeId as string | EmployeeRecord);
          return toDisplayRow(getEmployeeRecord(employeeId) as EmployeeRecord, {
            id: employeeId,
            checkInAt: status?.checkInAt ? formatTimeInOrgTimeZone(status.checkInAt, { hour: "2-digit", minute: "2-digit" }) : "-",
            shiftEndTime: status?.shiftEndTime || "-"
          });
        })
    );

    return {
      total: { title: "Total Employees", rows: totalRows },
      present: { title: "Present Today", rows: presentRows },
      absent: { title: "Absent Today", rows: absentRows },
      leave: { title: "On Leave Today", rows: leaveRows },
      late: { title: "Late Arrivals", rows: lateRows },
      missed: { title: "Missed Checkout", rows: missedRows }
    };
  }, [attendanceToday, employeeList, leaveList, todayKey, todayStatusList]);

  const openKpiDialog = (key: "total" | "present" | "absent" | "leave" | "late" | "missed") => {
    setSelectedKpiKey(key);
    setDetailsDialogOpen(true);
  };

  const openGraphDialog = (key: GraphTrendKey) => {
    navigate(`/dashboard/graph/${key}`, {
      state: { from: "/dashboard" }
    });
  };

  const selectedKpiRows = useMemo(() => {
    if (!selectedKpiKey) return [];

    const configuredRows = kpiEmployeeDetails[selectedKpiKey]?.rows || [];
    if (selectedKpiKey !== "present" || configuredRows.length > 0) return configuredRows;

    const employeeById = new Map(
      employeeList.map((emp) => [String(emp._id), emp] as const)
    );
    const employeesOnApprovedLeaveToday = new Set(
      (leaveList || [])
        .filter((leave) => {
          const fromKey = toOrgDateKey(leave.fromDate);
          const toKey = toOrgDateKey(leave.toDate);
          return leave.status === "approved" && todayKey >= fromKey && todayKey <= toKey;
        })
        .map((leave) => getEmployeeId(leave.employeeId as string | EmployeeRecord))
        .filter(Boolean)
    );
    const todayStatusByEmployeeId = new Map(
      (todayStatusList || []).map((item) => [getEmployeeId(item.employeeId as string | EmployeeRecord), item] as const)
    );

    return Array.from(
      new Map(
        (attendanceToday || [])
          .filter((row) => {
            const employeeId = getEmployeeId(row.employeeId as string | EmployeeRecord);
            if (!employeeId || !hasAttendanceActivity(row)) return false;
            if (employeesOnApprovedLeaveToday.has(employeeId)) return false;
            const status = todayStatusByEmployeeId.get(employeeId);
            if (status?.holidayName || status?.isWeekOff || status?.isOnLeave || status?.pendingCheckout) return false;
            return true;
          })
          .map((row) => {
            const employeeId = getEmployeeId(row.employeeId as string | EmployeeRecord);
            const employee = employeeById.get(employeeId) || {};
            return [employeeId, {
              id: employeeId,
              name: `${employee?.firstName || ""} ${employee?.lastName || ""}`.trim() || "-",
              employeeCode: employee?.employeeCode || "-",
              department: employee?.departmentId?.name || "Unassigned",
              designation: employee?.designationId?.name || "-",
              checkInAt: row.checkInAt ? formatTimeInOrgTimeZone(row.checkInAt, { hour: "2-digit", minute: "2-digit" }) : "-",
              checkOutAt: row.checkOutAt ? formatTimeInOrgTimeZone(row.checkOutAt, { hour: "2-digit", minute: "2-digit" }) : "-"
            }] as const;
          })
      ).values()
    );
  }, [attendanceToday, employeeList, kpiEmployeeDetails, leaveList, selectedKpiKey, todayKey, todayStatusList]);

  const selectedKpiTitle = selectedKpiKey ? kpiEmployeeDetails[selectedKpiKey].title : "Employee Details";

  const monthDaySummary = useMemo(() => {
    if (dashboardStats?.monthDaySummary) return dashboardStats.monthDaySummary;
    return {
      present: todayStatusList.filter((item) => item.present && !item.pendingCheckout).length,
      pendingCheckout: todayStatusList.filter((item) => item.pendingCheckout).length,
      absent: todayStatusList.filter((item) => item.absent).length,
      onLeave: todayStatusList.filter((item) => item.isOnLeave).length,
      weekOff: todayStatusList.filter((item) => item.isWeekOff).length,
      holiday: todayStatusList.filter((item) => Boolean(item.holidayName)).length,
      overridden: todayStatusList.filter((item) => item.overriddenBy || item.overriddenAt).length
    };
  }, [dashboardStats, todayStatusList]);

  const pendingApprovals = useMemo(() => {
    const pendingLeaves = leaveList.filter((l) => l.status === "pending");
    const submittedTimesheets = weeklyList.filter((w) => w.status === "submitted");
    return {
      pendingLeaves,
      submittedTimesheets
    };
  }, [leaveList, weeklyList]);

  const departmentAnalytics = useMemo(() => {
    if (dashboardStats?.departmentAnalytics) return dashboardStats.departmentAnalytics;
    const grouped: Record<string, { name: string; employees: number; present: number; onLeave: number; absent: number }> = {};
    employeeList.forEach((employee) => {
      const dept = employee.departmentId?.name || "Unassigned";
      if (!grouped[dept]) grouped[dept] = { name: dept, employees: 0, present: 0, onLeave: 0, absent: 0 };
      grouped[dept].employees += 1;
      const status = todayStatusList.find((item) => item.employeeId === String(employee._id));
      if (!status) return;
      if (status.isOnLeave) grouped[dept].onLeave += 1;
      else if (status.present) grouped[dept].present += 1;
      else if (status.absent) grouped[dept].absent += 1;
    });
    return Object.values(grouped).sort((a, b) => b.employees - a.employees).slice(0, 6);
  }, [dashboardStats, employeeList, todayStatusList]);

  const attendanceTrend = useMemo(() => {
    const points = dashboardStats?.attendanceTrend || [];
    return points.map((point) => ({
      ...point,
      label: point.label || formatDateInOrgTimeZone(new Date(`${point.key}T00:00:00`), { weekday: "short" })
    }));
  }, [dashboardStats]);

  const attendanceTrendMonthly = useMemo(() => {
    const points = dashboardStats?.attendanceTrendMonthly || [];
    return points.map((point) => ({
      ...point,
      label: point.label || formatTrendLabel(point.key, "monthly")
    }));
  }, [dashboardStats]);

  const compliance = useMemo(() => {
    const submitted = weeklyList.filter((w) => w.status === "submitted").length;
    const approved = weeklyList.filter((w) => w.status === "approved").length;
    const rejected = weeklyList.filter((w) => w.status === "rejected").length;
    const draft = weeklyList.filter((w) => w.status === "draft").length;
    return { submitted, approved, rejected, draft, total: weeklyList.length };
  }, [weeklyList]);

  const workforceComposition = useMemo<DoughnutSlice[]>(() => {
    const slices: DoughnutSlice[] = [
      { key: "present", label: "Present", value: kpis.presentToday, ...doughnutPalette.present },
      { key: "absent", label: "Absent", value: kpis.absentToday, ...doughnutPalette.absent },
      { key: "leave", label: "On Leave", value: kpis.onLeaveToday, ...doughnutPalette.leave },
      { key: "missed", label: "Missed Checkout", value: kpis.checkedInOnly, ...doughnutPalette.missed },
      { key: "weekOff", label: "Week Off", value: monthDaySummary.weekOff, ...doughnutPalette.weekOff },
      { key: "holiday", label: "Holiday", value: monthDaySummary.holiday, ...doughnutPalette.holiday }
    ];
    const withValues = slices.filter((slice) => slice.value > 0);
    return withValues.length ? withValues : slices.slice(0, 1);
  }, [kpis, monthDaySummary.holiday, monthDaySummary.weekOff]);

  const workforceCompositionTotal = useMemo(
    () => workforceComposition.reduce((sum, slice) => sum + slice.value, 0),
    [workforceComposition]
  );

  const departmentChartData = useMemo(
    () =>
      departmentAnalytics.map((department) => ({
        name: department.name,
        fullName: department.name,
        present: department.present,
        absent: department.absent,
        onLeave: department.onLeave
      })),
    [departmentAnalytics]
  );

  const formatDepartmentAxisLabel = (value: string) => {
    const text = String(value || "").trim();
    if (text.length <= 16) return text;
    return `${text.slice(0, 14)}...`;
  };

  const chartConfig = {
    present: { label: "Present", color: doughnutPalette.present.color },
    absent: { label: "Absent", color: doughnutPalette.absent.color },
    leave: { label: "On Leave", color: doughnutPalette.leave.color },
    onLeave: { label: "On Leave", color: doughnutPalette.leave.color },
    missed: { label: "Missed Checkout", color: doughnutPalette.missed.color },
    weekOff: { label: "Week Off", color: doughnutPalette.weekOff.color },
    holiday: { label: "Holiday", color: doughnutPalette.holiday.color }
  };

  const hrLifecycle = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(now.getDate() - 90);

    const newJoiners = employeeList.filter((e) => new Date(e.dateOfJoining) >= thirtyDaysAgo).length;
    const inProbation = employeeList.filter((e) => new Date(e.dateOfJoining) >= ninetyDaysAgo).length;
    const resigned = employeeList.filter((e) => e.status === "resigned").length;
    return { newJoiners, inProbation, resigned };
  }, [employeeList]);

  const upcomingHolidays = useMemo(() => {
    const start = new Date(`${todayKey}T00:00:00`);
    const end = new Date(start);
    end.setDate(start.getDate() + 30);
    return holidays
      .filter((h) => {
        const d = new Date(h.date);
        return d >= start && d <= end;
      })
      .slice(0, 6);
  }, [holidays, todayKey]);

  const graphDefinitions = useMemo<Record<GraphTrendKey, GraphDefinition>>(() => {
    const weeklyKeys = buildRecentDateKeys(todayKey, 7);
    const monthlyKeys = buildRecentDateKeys(todayKey, 30);

    const seedPoints = (dateKeys: string[], series: GraphSeries[], mode: "weekly" | "monthly") =>
      dateKeys.map((key) =>
        series.reduce(
          (acc, item) => ({ ...acc, [item.key]: 0 }),
          { key, label: formatTrendLabel(key, mode) } as TrendPoint
        )
      );

    const addCount = (points: TrendPoint[], key: string, field: string, count = 1) => {
      const point = points.find((item) => item.key === key);
      if (!point) return;
      const current = Number(point[field] || 0);
      point[field] = current + count;
    };

    const leaveSeries: GraphSeries[] = [
      { key: "approved", label: "Approved", color: "#22c55e" },
      { key: "pending", label: "Pending", color: "#f59e0b" },
      { key: "rejected", label: "Rejected", color: "#ef4444" }
    ];
    const leaveWeekly = seedPoints(weeklyKeys, leaveSeries, "weekly");
    const leaveMonthly = seedPoints(monthlyKeys, leaveSeries, "monthly");
    leaveList.forEach((leave) => {
      const dateKey = leave.createdAt ? toOrgDateKey(leave.createdAt) : leave.fromDate ? toOrgDateKey(leave.fromDate) : "";
      const field = String(leave.status || "pending").toLowerCase();
      if (!dateKey || !leaveSeries.some((item) => item.key === field)) return;
      addCount(leaveWeekly, dateKey, field);
      addCount(leaveMonthly, dateKey, field);
    });

    const approvalSeries: GraphSeries[] = [
      { key: "leaveRequests", label: "Leave Requests", color: "#f59e0b" },
      { key: "timesheets", label: "Timesheets", color: "#3b82f6" }
    ];
    const approvalWeekly = seedPoints(weeklyKeys, approvalSeries, "weekly");
    const approvalMonthly = seedPoints(monthlyKeys, approvalSeries, "monthly");
    leaveList
      .filter((leave) => leave.status === "pending")
      .forEach((leave) => {
        const dateKey = leave.createdAt ? toOrgDateKey(leave.createdAt) : leave.fromDate ? toOrgDateKey(leave.fromDate) : "";
        if (!dateKey) return;
        addCount(approvalWeekly, dateKey, "leaveRequests");
        addCount(approvalMonthly, dateKey, "leaveRequests");
      });
    weeklyList
      .filter((timesheet) => timesheet.status === "submitted")
      .forEach((timesheet) => {
        const sourceDate = timesheet.submittedAt || timesheet.createdAt || timesheet.weekStart;
        const dateKey = sourceDate ? toOrgDateKey(sourceDate) : "";
        if (!dateKey) return;
        addCount(approvalWeekly, dateKey, "timesheets");
        addCount(approvalMonthly, dateKey, "timesheets");
      });

    const timesheetSeries: GraphSeries[] = [
      { key: "draft", label: "Draft", color: "#94a3b8" },
      { key: "submitted", label: "Submitted", color: "#3b82f6" },
      { key: "approved", label: "Approved", color: "#22c55e" },
      { key: "rejected", label: "Rejected", color: "#ef4444" }
    ];
    const timesheetWeekly = seedPoints(weeklyKeys, timesheetSeries, "weekly");
    const timesheetMonthly = seedPoints(monthlyKeys, timesheetSeries, "monthly");
    weeklyList.forEach((timesheet) => {
      const field = String(timesheet.status || "draft").toLowerCase();
      const sourceDate = timesheet.submittedAt || timesheet.createdAt || timesheet.weekStart;
      const dateKey = sourceDate ? toOrgDateKey(sourceDate) : "";
      if (!dateKey || !timesheetSeries.some((item) => item.key === field)) return;
      addCount(timesheetWeekly, dateKey, field);
      addCount(timesheetMonthly, dateKey, field);
    });

    const lifecycleSeries: GraphSeries[] = [
      { key: "joiners", label: "Joiners", color: "#14b8a6" },
      { key: "probation", label: "Probation", color: "#8b5cf6" }
    ];
    const lifecycleWeekly = seedPoints(weeklyKeys, lifecycleSeries, "weekly");
    const lifecycleMonthly = seedPoints(monthlyKeys, lifecycleSeries, "monthly");
    employeeList.forEach((employee) => {
      if (!employee.dateOfJoining) return;
      const dateKey = toOrgDateKey(employee.dateOfJoining);
      addCount(lifecycleWeekly, dateKey, "joiners");
      addCount(lifecycleMonthly, dateKey, "joiners");
      const daysSinceJoining = Math.floor((today.getTime() - new Date(employee.dateOfJoining).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceJoining <= 90) {
        addCount(lifecycleWeekly, dateKey, "probation");
        addCount(lifecycleMonthly, dateKey, "probation");
      }
    });

    const holidaySeries: GraphSeries[] = [
      { key: "holidays", label: "Holidays", color: "#0ea5e9" }
    ];
    const holidayWeekly = seedPoints(weeklyKeys, holidaySeries, "weekly");
    const holidayMonthly = seedPoints(monthlyKeys, holidaySeries, "monthly");
    holidays.forEach((holiday) => {
      const dateKey = holiday.date ? toOrgDateKey(holiday.date) : "";
      if (!dateKey) return;
      addCount(holidayWeekly, dateKey, "holidays");
      addCount(holidayMonthly, dateKey, "holidays");
    });

    const notificationSeries: GraphSeries[] = [
      { key: "notifications", label: "Notifications", color: "#6366f1" }
    ];
    const notificationWeekly = seedPoints(weeklyKeys, notificationSeries, "weekly");
    const notificationMonthly = seedPoints(monthlyKeys, notificationSeries, "monthly");
    notifications.forEach((notification) => {
      const dateKey = notification.createdAt ? toOrgDateKey(notification.createdAt) : "";
      if (!dateKey) return;
      addCount(notificationWeekly, dateKey, "notifications");
      addCount(notificationMonthly, dateKey, "notifications");
    });

    const exceptionSeries: GraphSeries[] = [
      { key: "absent", label: "Absent", color: "#f97316" },
      { key: "excluded", label: "Excluded", color: "#cbd5e1" }
    ];
    const exceptionWeekly = attendanceTrend.map((point) => ({
      key: point.key,
      label: String(point.label || formatTrendLabel(point.key, "weekly")),
      absent: Number(point.absent || 0),
      excluded: Number(point.excluded || 0)
    }));
    const exceptionMonthly = attendanceTrendMonthly.map((point) => ({
      key: point.key,
      label: String(point.label || formatTrendLabel(point.key, "monthly")),
      absent: Number(point.absent || 0),
      excluded: Number(point.excluded || 0)
    }));

    return {
      attendance: {
        key: "attendance",
        title: "Attendance Trend",
        description: "Present, absent, and excluded employees across the selected period",
        weekly: attendanceTrend.map((point) => ({
          key: point.key,
          label: String(point.label || formatTrendLabel(point.key, "weekly")),
          present: Number(point.present || 0),
          absent: Number(point.absent || 0),
          excluded: Number(point.excluded || 0)
        })),
        monthly: attendanceTrendMonthly.map((point) => ({
          key: point.key,
          label: String(point.label || formatTrendLabel(point.key, "monthly")),
          present: Number(point.present || 0),
          absent: Number(point.absent || 0),
          excluded: Number(point.excluded || 0)
        })),
        series: [
          { key: "present", label: "Present", color: "#22c55e" },
          { key: "absent", label: "Absent", color: "#f97316" },
          { key: "excluded", label: "Excluded", color: "#cbd5e1" }
        ],
        type: "area"
      },
      leaves: {
        key: "leaves",
        title: "Leave Requests",
        description: "Weekly and monthly leave request flow by status",
        weekly: leaveWeekly,
        monthly: leaveMonthly,
        series: leaveSeries
      },
      approvals: {
        key: "approvals",
        title: "Approval Activity",
        description: "Pending leave requests and submitted timesheets waiting for action",
        weekly: approvalWeekly,
        monthly: approvalMonthly,
        series: approvalSeries
      },
      timesheets: {
        key: "timesheets",
        title: "Timesheet Activity",
        description: "Draft, submitted, approved, and rejected timesheets",
        weekly: timesheetWeekly,
        monthly: timesheetMonthly,
        series: timesheetSeries
      },
      lifecycle: {
        key: "lifecycle",
        title: "Employee Lifecycle",
        description: "New joiners and probation entries over time",
        weekly: lifecycleWeekly,
        monthly: lifecycleMonthly,
        series: lifecycleSeries
      },
      holidays: {
        key: "holidays",
        title: "Holiday Outlook",
        description: "Holiday occurrences across the selected period",
        weekly: holidayWeekly,
        monthly: holidayMonthly,
        series: holidaySeries
      },
      notifications: {
        key: "notifications",
        title: "Notification Activity",
        description: "Notifications issued in the selected period",
        weekly: notificationWeekly,
        monthly: notificationMonthly,
        series: notificationSeries
      },
      exceptions: {
        key: "exceptions",
        title: "Attendance Exceptions",
        description: "Absent and excluded employees across the selected period",
        weekly: exceptionWeekly,
        monthly: exceptionMonthly,
        series: exceptionSeries
      }
    };
  }, [attendanceTrend, attendanceTrendMonthly, employeeList, holidays, leaveList, notifications, today, todayKey, weeklyList]);

  const selectedGraphDefinition = selectedGraphKey ? graphDefinitions[selectedGraphKey] : null;

  /* ================= UI ================= */

  return (
    <MainLayout title="Dashboard" breadcrumb={[{ label: "Home" }, { label: "Dashboard" }]}>
      {/* ================= ORG POPUP ================= */}
      <Dialog open={showOrgPopup}>
        <DialogContent
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Select Organization</DialogTitle>
          </DialogHeader>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowCreateOrg(true)}
          >
            + Create Organization
          </Button>

          <div className="space-y-3 mt-4">
            {organizations.map((org) => (
              <div
                key={org._id}
                className="border rounded px-4 py-3 cursor-pointer hover:bg-muted"
                onClick={() => switchOrganization(org._id)}
              >
                <p className="font-medium">{org.name}</p>
                <p className="text-sm text-muted-foreground">
                  {org.code} • {org.timezone}
                </p>
              </div>
            ))}
          </div>

          {showCreateOrg && (
            <div className="space-y-3 mt-4">
              <Input
                placeholder="Organization Name"
                validationType="name"
                value={createOrgForm.name}
                onChange={(e) =>
                  setCreateOrgForm({ ...createOrgForm, name: e.target.value })
                }
              />
              <Input
                placeholder="Code"
                validationType="code"
                value={createOrgForm.code}
                onChange={(e) =>
                  setCreateOrgForm({ ...createOrgForm, code: e.target.value })
                }
              />

              <Select
                value={createOrgForm.timezone}
                onValueChange={(v) =>
                  setCreateOrgForm({ ...createOrgForm, timezone: v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Timezone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Asia/Kolkata">India</SelectItem>
                  <SelectItem value="America/New_York">USA</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={createOrgForm.currency}
                onValueChange={(v) =>
                  setCreateOrgForm({ ...createOrgForm, currency: v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INR">INR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>

              <Button onClick={handleCreateOrganization}>
                Create Organization
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedKpiTitle}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[420px] overflow-auto space-y-2">
            {selectedKpiRows.length === 0 && (
              <p className="text-sm text-muted-foreground">No employees found.</p>
            )}
            {selectedKpiRows.map((row: KpiDisplayRow) => (
              <div key={row.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.employeeCode} • {row.department} • {row.designation}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDetailsDialogOpen(false);
                      if (selectedKpiKey === "total") {
                        navigate(`/dashboard/employee/${row.id}`, {
                          state: { from: "/dashboard" }
                        });
                        return;
                      }
                      if (selectedKpiKey === "leave") {
                        navigate(`/dashboard/leaves/${row.id}`, {
                          state: { from: "/dashboard" }
                        });
                        return;
                      }
                      if (selectedKpiKey === "present" || selectedKpiKey === "absent" || selectedKpiKey === "late" || selectedKpiKey === "missed") {
                        const mode =
                          selectedKpiKey === "present"
                            ? "present"
                            : selectedKpiKey === "absent"
                              ? "absent"
                              : selectedKpiKey === "late"
                                ? "late"
                                : "missed";
                        navigate(`/dashboard/attendance/${row.id}?mode=${mode}`, {
                          state: { from: "/dashboard" }
                        });
                        return;
                      }
                      navigate(`/employees/${row.id}`);
                    }}
                  >
                    View
                  </Button>
                </div>
                {"lateByMinutes" in row && (
                  <p className="text-xs text-muted-foreground mt-2">Late by {row.lateByMinutes} mins</p>
                )}
        {"leaveType" in row && (
          <p className="text-xs text-muted-foreground mt-2">Leave type: {row.leaveType}</p>
        )}
        {"absentReason" in row && (
          <p className="text-xs text-muted-foreground mt-2">Status: {row.absentReason}</p>
        )}
                {"checkInAt" in row && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Check-in: {row.checkInAt}{" "}
                    {"checkOutAt" in row ? `| Check-out: ${row.checkOutAt}` : ""}
                    {"shiftEndTime" in row && row.shiftEndTime ? `| Shift ends: ${row.shiftEndTime}` : ""}
                  </p>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={graphDialogOpen} onOpenChange={setGraphDialogOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{selectedGraphDefinition?.title || "Trend Details"}</DialogTitle>
          </DialogHeader>
          {selectedGraphDefinition && (
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground">{selectedGraphDefinition.description}</p>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="rounded-xl border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">Weekly Trend</h4>
                    <Badge variant="outline">Last 7 Days</Badge>
                  </div>
                  <ChartContainer
                    config={selectedGraphDefinition.series.reduce((acc, item) => ({
                      ...acc,
                      [item.key]: { label: item.label, color: item.color }
                    }), {})}
                    className="h-[260px] w-full"
                  >
                    {selectedGraphDefinition.type === "area" ? (
                      <AreaChart data={selectedGraphDefinition.weekly}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        {selectedGraphDefinition.series.map((item) => (
                          <Area
                            key={`weekly-${item.key}`}
                            type="monotone"
                            dataKey={item.key}
                            stackId="trend"
                            stroke={item.color}
                            fill={item.color}
                            fillOpacity={0.18}
                          />
                        ))}
                      </AreaChart>
                    ) : (
                      <BarChart data={selectedGraphDefinition.weekly}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        {selectedGraphDefinition.series.map((item) => (
                          <Bar
                            key={`weekly-${item.key}`}
                            dataKey={item.key}
                            fill={item.color}
                            radius={[8, 8, 0, 0]}
                          />
                        ))}
                      </BarChart>
                    )}
                  </ChartContainer>
                </div>

                <div className="rounded-xl border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">Last Month Trend</h4>
                    <Badge variant="outline">Last 30 Days</Badge>
                  </div>
                  <ChartContainer
                    config={selectedGraphDefinition.series.reduce((acc, item) => ({
                      ...acc,
                      [item.key]: { label: item.label, color: item.color }
                    }), {})}
                    className="h-[260px] w-full"
                  >
                    {selectedGraphDefinition.type === "area" ? (
                      <AreaChart data={selectedGraphDefinition.monthly}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        {selectedGraphDefinition.series.map((item) => (
                          <Area
                            key={`monthly-${item.key}`}
                            type="monotone"
                            dataKey={item.key}
                            stackId="trend"
                            stroke={item.color}
                            fill={item.color}
                            fillOpacity={0.18}
                          />
                        ))}
                      </AreaChart>
                    ) : (
                      <BarChart data={selectedGraphDefinition.monthly}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        {selectedGraphDefinition.series.map((item) => (
                          <Bar
                            key={`monthly-${item.key}`}
                            dataKey={item.key}
                            fill={item.color}
                            radius={[8, 8, 0, 0]}
                          />
                        ))}
                      </BarChart>
                    )}
                  </ChartContainer>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ================= USER POPUP ================= */}
      <Dialog open={showUserPopup}>
        <DialogContent
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Select / Create User</DialogTitle>
          </DialogHeader>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowCreateUser(true)}
          >
            + Create User
          </Button>

          <div className="space-y-3 mt-4">
            {users.map((u) => (
              <div
                key={u._id}
                className="border rounded px-4 py-3 cursor-pointer hover:bg-muted"
                onClick={() => setShowUserPopup(false)}
              >
                <p className="font-medium">{u.email}</p>
                <p className="text-sm text-muted-foreground">
                  {u.roles?.map((r) => r.name).join(", ")}
                </p>
              </div>
            ))}
          </div>

          {showCreateUser && (
            <div className="space-y-3 mt-4">
              <Input
                placeholder="First Name"
                validationType="name"
                value={createUserForm.firstName}
                onChange={(e) =>
                  setCreateUserForm({ ...createUserForm, firstName: e.target.value })
                }
              />

              <Input
                placeholder="Last Name"
                validationType="name"
                value={createUserForm.lastName}
                onChange={(e) =>
                  setCreateUserForm({ ...createUserForm, lastName: e.target.value })
                }
              />

              <Input
                placeholder="Email"
                validationType="email"
                value={createUserForm.email}
                onChange={(e) =>
                  setCreateUserForm({ ...createUserForm, email: e.target.value })
                }
              />

              <Input
                type="password"
                placeholder="Password"
                value={createUserForm.password}
                onChange={(e) =>
                  setCreateUserForm({ ...createUserForm, password: e.target.value })
                }
              />

              {/* ✅ CORRECT SELECT */}
              <Select
                value={createUserForm.roleIds[0]}
                onValueChange={(value) =>
                  setCreateUserForm({
                    ...createUserForm,
                    roleIds: [value],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      rolesLoading ? "Loading roles..." : "Select Role"
                    }
                  />
                </SelectTrigger>

                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role._id} value={role._id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={createUserForm.departmentId}
                onValueChange={(value) => {
                  if (value === "__create__") {
                    navigate("/departments");
                    return;
                  }
                  setCreateUserForm({ ...createUserForm, departmentId: value });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__create__">+ Create Department</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept._id} value={dept._id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={createUserForm.designationId}
                onValueChange={(value) => {
                  if (value === "__create__") {
                    navigate("/designations");
                    return;
                  }
                  setCreateUserForm({ ...createUserForm, designationId: value });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Designation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__create__">+ Create Designation</SelectItem>
                  {designations.map((des) => (
                    <SelectItem key={des._id} value={des._id}>
                      {des.name || des.departmentName || des._id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={createUserForm.employmentType}
                onValueChange={(value) =>
                  setCreateUserForm({ ...createUserForm, employmentType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Employment Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_time">Full Time</SelectItem>
                  <SelectItem value="part_time">Part Time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                </SelectContent>
              </Select>

              <Input
                type="date"
                placeholder="Date of Joining"
                value={createUserForm.dateOfJoining}
                onChange={(e) =>
                  setCreateUserForm({ ...createUserForm, dateOfJoining: e.target.value })
                }
              />

              <Select
                value={createUserForm.managerId}
                onValueChange={(value) =>
                  setCreateUserForm({ ...createUserForm, managerId: value === "none" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Reporting Manager (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {managers.map((m) => (
                    <SelectItem key={m._id} value={m._id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button onClick={handleCreateUser}>
                Create User
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="mb-6 flex items-center justify-end">
        <div className="inline-flex rounded-xl border border-border bg-card p-1 shadow-sm">
          <Button
            variant={dashboardView === "data" ? "default" : "ghost"}
            size="sm"
            className="rounded-lg"
            onClick={() => setDashboardView("data")}
          >
            Data Representation
          </Button>
          <Button
            variant={dashboardView === "graphical" ? "default" : "ghost"}
            size="sm"
            className="rounded-lg"
            onClick={() => setDashboardView("graphical")}
          >
            Graphical Representation
          </Button>
        </div>
      </div>

      {dashboardLoading ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={`kpi-skeleton-${idx}`} className="stat-card space-y-3">
                <Skeleton className="h-4 w-28 rounded-sm" />
                <Skeleton className="h-8 w-16 rounded-sm" />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-6">
            {Array.from({ length: 2 }).map((_, idx) => (
              <div key={`trend-skeleton-${idx}`} className="stat-card space-y-3">
                <Skeleton className="h-5 w-44 rounded-sm" />
                {Array.from({ length: 5 }).map((__, rowIdx) => (
                  <div key={`trend-skeleton-row-${idx}-${rowIdx}`} className="space-y-2">
                    <Skeleton className="h-3 w-24 rounded-sm" />
                    <Skeleton className="h-2 w-full rounded-sm" />
                  </div>
                ))}
              </div>
            ))}
          </div>

          {Array.from({ length: 3 }).map((_, sectionIdx) => (
            <div key={`section-skeleton-${sectionIdx}`} className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-6">
              {Array.from({ length: 3 }).map((__, cardIdx) => (
                <div key={`section-skeleton-card-${sectionIdx}-${cardIdx}`} className="stat-card space-y-3">
                  <Skeleton className="h-5 w-40 rounded-sm" />
                  {Array.from({ length: 4 }).map((___, lineIdx) => (
                    <Skeleton key={`line-skeleton-${sectionIdx}-${cardIdx}-${lineIdx}`} className="h-8 w-full rounded-sm" />
                  ))}
                </div>
              ))}
            </div>
          ))}
        </>
      ) : (
      <>
      {dashboardView === "data" && (
      <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
        <div
          className="stat-card cursor-pointer hover:ring-1 hover:ring-primary/20"
          onClick={() => openKpiDialog("total")}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Users className="w-4 h-4" /> Total Employees
          </div>
          <div className="text-2xl font-semibold">{kpis.totalEmployees}</div>
        </div>
        <div
          className="stat-card cursor-pointer hover:ring-1 hover:ring-primary/20"
          onClick={() => openKpiDialog("present")}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <UserCheck className="w-4 h-4" /> Present Today
          </div>
          <div className="text-2xl font-semibold">{kpis.presentToday}</div>
        </div>
        <div
          className="stat-card cursor-pointer hover:ring-1 hover:ring-primary/20"
          onClick={() => openKpiDialog("leave")}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <ClipboardCheck className="w-4 h-4" /> On Leave Today
          </div>
          <div className="text-2xl font-semibold">{kpis.onLeaveToday}</div>
        </div>
        <div
          className="stat-card cursor-pointer hover:ring-1 hover:ring-primary/20"
          onClick={() => openKpiDialog("absent")}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <UserX className="w-4 h-4" /> Absent Today
          </div>
          <div className="text-2xl font-semibold">{kpis.absentToday}</div>
        </div>
        <div
          className="stat-card cursor-pointer hover:ring-1 hover:ring-primary/20"
          onClick={() => openKpiDialog("late")}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <AlertCircle className="w-4 h-4" /> Late Arrivals
          </div>
          <div className="text-2xl font-semibold">{kpis.lateArrivals}</div>
        </div>
        <div
          className="stat-card cursor-pointer hover:ring-1 hover:ring-primary/20"
          onClick={() => openKpiDialog("missed")}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <FileClock className="w-4 h-4" /> Missed Checkout
          </div>
          <div className="text-2xl font-semibold">{kpis.checkedInOnly}</div>
        </div>
      </div>
      </>
      )}

      {/* <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
        <div
          className="stat-card cursor-pointer hover:ring-1 hover:ring-primary/20"
          onClick={() => openKpiDialog("total")}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Users className="w-4 h-4" /> Total Employees
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground/70 hover:text-foreground">
                  <Info className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{kpiHelpText.total}</TooltipContent>
            </Tooltip>
          </div>
          <div className="text-2xl font-semibold">{kpis.totalEmployees}</div>
        </div>
        <div
          className="stat-card cursor-pointer hover:ring-1 hover:ring-primary/20"
          onClick={() => openKpiDialog("present")}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <UserCheck className="w-4 h-4" /> Present Today
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground/70 hover:text-foreground">
                  <Info className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{kpiHelpText.present}</TooltipContent>
            </Tooltip>
          </div>
          <div className="text-2xl font-semibold">{kpis.presentToday}</div>
        </div>
        <div
          className="stat-card cursor-pointer hover:ring-1 hover:ring-primary/20"
          onClick={() => openKpiDialog("leave")}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <ClipboardCheck className="w-4 h-4" /> On Leave Today
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground/70 hover:text-foreground">
                  <Info className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{kpiHelpText.leave}</TooltipContent>
            </Tooltip>
          </div>
          <div className="text-2xl font-semibold">{kpis.onLeaveToday}</div>
        </div>
        <div
          className="stat-card cursor-pointer hover:ring-1 hover:ring-primary/20"
          onClick={() => openKpiDialog("absent")}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <UserX className="w-4 h-4" /> Absent Today
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground/70 hover:text-foreground">
                  <Info className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{kpiHelpText.absent}</TooltipContent>
            </Tooltip>
          </div>
          <div className="text-2xl font-semibold">{kpis.absentToday}</div>
        </div>
        <div
          className="stat-card cursor-pointer hover:ring-1 hover:ring-primary/20"
          onClick={() => openKpiDialog("late")}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <AlertCircle className="w-4 h-4" /> Late Arrivals
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground/70 hover:text-foreground">
                  <Info className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{kpiHelpText.late}</TooltipContent>
            </Tooltip>
          </div>
          <div className="text-2xl font-semibold">{kpis.lateArrivals}</div>
        </div>
        <div
          className="stat-card cursor-pointer hover:ring-1 hover:ring-primary/20"
          onClick={() => openKpiDialog("missed")}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <FileClock className="w-4 h-4" /> Missed Checkout
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground/70 hover:text-foreground">
                  <Info className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{kpiHelpText.missed}</TooltipContent>
            </Tooltip>
          </div>
          <div className="text-2xl font-semibold">{kpis.checkedInOnly}</div>
        </div>
      </div> */}

      {dashboardView === "graphical" && (
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 mt-6">
        <div
          className="stat-card xl:col-span-5 overflow-hidden cursor-pointer hover:ring-1 hover:ring-primary/25"
          onClick={() => openGraphDialog("attendance")}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold">Workforce Distribution</h3>
              <p className="text-sm text-muted-foreground">3D-style snapshot of today&apos;s workforce mix. Click for weekly and monthly attendance trend.</p>
            </div>
            <Badge variant="outline">Today</Badge>
          </div>
          <div className="grid grid-cols-1 2xl:grid-cols-[minmax(260px,320px),minmax(0,1fr)] gap-4 items-start">
            <ChartContainer config={chartConfig} className="h-[280px] w-full min-w-0">
              <PieChart>
                <defs>
                  <filter id="dashboard-pie-shadow" x="-40%" y="-40%" width="180%" height="190%">
                    <feDropShadow dx="0" dy="16" stdDeviation="12" floodColor="#0f172a" floodOpacity="0.16" />
                  </filter>
                  <filter id="dashboard-inner-shadow" x="-40%" y="-40%" width="180%" height="180%">
                    <feOffset dx="0" dy="3" />
                    <feGaussianBlur stdDeviation="6" result="offset-blur" />
                    <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse" />
                    <feFlood floodColor="#0f172a" floodOpacity="0.08" result="color" />
                    <feComposite operator="in" in="color" in2="inverse" result="shadow" />
                    <feComposite operator="over" in="shadow" in2="SourceGraphic" />
                  </filter>
                  <radialGradient id="dashboard-donut-core" cx="50%" cy="40%" r="65%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                    <stop offset="70%" stopColor="#ffffff" stopOpacity="0.96" />
                    <stop offset="100%" stopColor="#e5e7eb" stopOpacity="1" />
                  </radialGradient>
                  <linearGradient id="dashboard-donut-rim" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#cbd5e1" stopOpacity="0.75" />
                  </linearGradient>
                  <linearGradient id="dashboard-donut-shine" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.75" />
                    <stop offset="45%" stopColor="#ffffff" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="key" />} />
                <ellipse cx="50%" cy="65%" rx="94" ry="22" fill="#0f172a" opacity="0.08" />
                <ellipse cx="50%" cy="63.5%" rx="82" ry="14" fill="#ffffff" opacity="0.55" />
                <Pie
                  data={workforceComposition}
                  dataKey="value"
                  nameKey="key"
                  cx="50%"
                  cy="50%"
                  innerRadius={62}
                  outerRadius={106}
                  paddingAngle={3}
                  stroke="rgba(255,255,255,0.95)"
                  strokeWidth={2}
                  filter="url(#dashboard-pie-shadow)"
                >
                  {workforceComposition.map((slice) => (
                    <Cell key={slice.key} fill={slice.color} />
                  ))}
                  <Label
                    position="center"
                    content={({ viewBox }) => {
                      if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) return null;
                      const { cx, cy } = viewBox;
                      return (
                        <g>
                          <text x={cx} y={cy - 8} textAnchor="middle" className="fill-muted-foreground text-[11px] font-semibold tracking-[0.22em] uppercase">
                            Total
                          </text>
                          <text x={cx} y={cy + 22} textAnchor="middle" className="fill-foreground text-[30px] font-bold">
                            {workforceCompositionTotal}
                          </text>
                        </g>
                      );
                    }}
                  />
                  <LabelList
                    dataKey="value"
                    position="outside"
                    formatter={(value: number) => (value > 0 ? value : "")}
                    className="fill-foreground text-xs font-semibold"
                  />
                </Pie>
                <circle cx="50%" cy="50%" r="60" fill="url(#dashboard-donut-core)" filter="url(#dashboard-inner-shadow)" />
                <circle cx="50%" cy="50%" r="62.5" fill="none" stroke="url(#dashboard-donut-rim)" strokeOpacity="0.9" strokeWidth="2.5" />
                <path
                  d="M 148 72 C 172 52, 228 52, 252 72"
                  fill="none"
                  stroke="url(#dashboard-donut-shine)"
                  strokeWidth="16"
                  strokeLinecap="round"
                />
                <ChartLegend
                  verticalAlign="bottom"
                  content={<ChartLegendContent nameKey="key" className="flex-wrap justify-center gap-3 pt-5" />}
                />
              </PieChart>
            </ChartContainer>
            <div className="min-w-0 space-y-3">
              <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-white via-muted/10 to-slate-50 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Total Employees</p>
                    <p className="mt-2 text-3xl font-semibold">{workforceCompositionTotal}</p>
                  </div>
                  <div className="rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
                    Live Mix
                  </div>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">Employees currently represented across today&apos;s status mix.</p>
              </div>
              {workforceComposition.map((slice) => {
                const percentage = workforceCompositionTotal ? Math.round((slice.value / workforceCompositionTotal) * 100) : 0;
                return (
                  <div key={`mix-${slice.key}`} className="rounded-2xl border border-border/60 bg-gradient-to-r from-background to-muted/20 p-3 shadow-sm">
                    <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: slice.color, boxShadow: `0 4px 10px ${slice.shadowColor}55` }} />
                        <span className="truncate font-medium">{slice.label}</span>
                      </div>
                      <span className="text-muted-foreground">{slice.value} employees • {percentage}%</span>
                    </div>
                    <div className="mt-2 h-2.5 rounded-full bg-muted/80">
                      <div
                        className="h-2.5 rounded-full"
                        style={{
                          width: `${percentage}%`,
                          background: `linear-gradient(90deg, ${slice.shadowColor}, ${slice.color})`
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div
          className="stat-card xl:col-span-7 overflow-hidden cursor-pointer hover:ring-1 hover:ring-primary/25"
          onClick={() => openGraphDialog("attendance")}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold">Department Workforce Mix</h3>
              <p className="text-sm text-muted-foreground">Present, absent, and leave counts by department. Click for attendance trends.</p>
            </div>
            <Badge variant="outline">Live Split</Badge>
          </div>
          <ChartContainer config={chartConfig} className="h-[360px] w-full xl:h-[320px]">
            <BarChart data={departmentChartData} barGap={8} barCategoryGap={22}>
              <defs>
                <linearGradient id="dept-present-gradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#15803d" />
                  <stop offset="100%" stopColor="#4ade80" />
                </linearGradient>
                <linearGradient id="dept-absent-gradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#c2410c" />
                  <stop offset="100%" stopColor="#fb923c" />
                </linearGradient>
                <linearGradient id="dept-leave-gradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#1d4ed8" />
                  <stop offset="100%" stopColor="#60a5fa" />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                interval={0}
                height={76}
                angle={-18}
                textAnchor="end"
                tickMargin={10}
                tickFormatter={formatDepartmentAxisLabel}
                className="text-[11px]"
              />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) => String(payload?.[0]?.payload?.fullName || "")}
                  />
                }
              />
              <Bar dataKey="present" stackId="dept" radius={[10, 10, 0, 0]} fill="url(#dept-present-gradient)" />
              <Bar dataKey="onLeave" stackId="dept" radius={[10, 10, 0, 0]} fill="url(#dept-leave-gradient)" />
              <Bar dataKey="absent" stackId="dept" radius={[10, 10, 0, 0]} fill="url(#dept-absent-gradient)" />
              <ChartLegend
                verticalAlign="bottom"
                content={<ChartLegendContent nameKey="dataKey" className="justify-center gap-4 pt-4" />}
              />
            </BarChart>
          </ChartContainer>
        </div>

        <div
          className="stat-card xl:col-span-6 cursor-pointer hover:ring-1 hover:ring-primary/25"
          onClick={() => openGraphDialog("leaves")}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold">Leave Request Flow</h3>
              <p className="text-sm text-muted-foreground">Approved, pending, and rejected leave requests</p>
            </div>
            <Badge variant="outline">Click For Trends</Badge>
          </div>
          <ChartContainer
            config={graphDefinitions.leaves.series.reduce((acc, item) => ({ ...acc, [item.key]: { label: item.label, color: item.color } }), {})}
            className="h-[240px] w-full"
          >
            <BarChart data={graphDefinitions.leaves.weekly}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              {graphDefinitions.leaves.series.map((item) => (
                <Bar key={item.key} dataKey={item.key} fill={item.color} radius={[8, 8, 0, 0]} />
              ))}
            </BarChart>
          </ChartContainer>
        </div>

        <div
          className="stat-card xl:col-span-6 cursor-pointer hover:ring-1 hover:ring-primary/25"
          onClick={() => openGraphDialog("approvals")}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold">Approval Center Activity</h3>
              <p className="text-sm text-muted-foreground">Leave requests and timesheets waiting for action</p>
            </div>
            <Badge variant="outline">Click For Trends</Badge>
          </div>
          <ChartContainer
            config={graphDefinitions.approvals.series.reduce((acc, item) => ({ ...acc, [item.key]: { label: item.label, color: item.color } }), {})}
            className="h-[240px] w-full"
          >
            <BarChart data={graphDefinitions.approvals.weekly}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              {graphDefinitions.approvals.series.map((item) => (
                <Bar key={item.key} dataKey={item.key} fill={item.color} radius={[8, 8, 0, 0]} />
              ))}
            </BarChart>
          </ChartContainer>
        </div>

        <div
          className="stat-card xl:col-span-4 cursor-pointer hover:ring-1 hover:ring-primary/25"
          onClick={() => openGraphDialog("timesheets")}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold">Timesheet Compliance</h3>
              <p className="text-sm text-muted-foreground">Current status split across all weekly timesheets</p>
            </div>
            <Badge variant="outline">Click For Trends</Badge>
          </div>
          <ChartContainer
            config={graphDefinitions.timesheets.series.reduce((acc, item) => ({ ...acc, [item.key]: { label: item.label, color: item.color } }), {})}
            className="h-[220px] w-full"
          >
            <BarChart
              data={[
                {
                  label: "Timesheets",
                  draft: compliance.draft,
                  submitted: compliance.submitted,
                  approved: compliance.approved,
                  rejected: compliance.rejected
                }
              ]}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              {graphDefinitions.timesheets.series.map((item) => (
                <Bar key={item.key} dataKey={item.key} fill={item.color} radius={[8, 8, 0, 0]} />
              ))}
            </BarChart>
          </ChartContainer>
        </div>

        <div
          className="stat-card xl:col-span-4 cursor-pointer hover:ring-1 hover:ring-primary/25"
          onClick={() => openGraphDialog("exceptions")}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold">Attendance Exceptions</h3>
              <p className="text-sm text-muted-foreground">Today&apos;s attendance edge cases and exclusions</p>
            </div>
            <Badge variant="outline">Click For Trends</Badge>
          </div>
          <ChartContainer
            config={{
              absent: { label: "Absent", color: "#f97316" },
              onLeave: { label: "On Leave", color: "#3b82f6" },
              pendingCheckout: { label: "Pending Checkout", color: "#8b5cf6" },
              weekOff: { label: "Week Off", color: "#cbd5e1" }
            }}
            className="h-[220px] w-full"
          >
            <BarChart
              data={[
                {
                  label: "Today",
                  absent: monthDaySummary.absent,
                  onLeave: monthDaySummary.onLeave,
                  pendingCheckout: monthDaySummary.pendingCheckout,
                  weekOff: monthDaySummary.weekOff
                }
              ]}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="absent" fill="#f97316" radius={[8, 8, 0, 0]} />
              <Bar dataKey="onLeave" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              <Bar dataKey="pendingCheckout" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
              <Bar dataKey="weekOff" fill="#cbd5e1" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>

        <div
          className="stat-card xl:col-span-4 cursor-pointer hover:ring-1 hover:ring-primary/25"
          onClick={() => openGraphDialog("notifications")}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold">Notification Activity</h3>
              <p className="text-sm text-muted-foreground">Recent alerts and system messages sent to users</p>
            </div>
            <Badge variant="outline">Click For Trends</Badge>
          </div>
          <ChartContainer
            config={{ notifications: { label: "Notifications", color: "#6366f1" } }}
            className="h-[220px] w-full"
          >
            <AreaChart data={graphDefinitions.notifications.weekly}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area type="monotone" dataKey="notifications" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} />
            </AreaChart>
          </ChartContainer>
        </div>

        <div
          className="stat-card xl:col-span-4 cursor-pointer hover:ring-1 hover:ring-primary/25"
          onClick={() => openGraphDialog("holidays")}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold">Holiday Outlook</h3>
              <p className="text-sm text-muted-foreground">Upcoming holidays and non-working days in the next month</p>
            </div>
            <Badge variant="outline">Click For Trends</Badge>
          </div>
          <ChartContainer
            config={{ holidays: { label: "Holidays", color: "#0ea5e9" } }}
            className="h-[220px] w-full"
          >
            <BarChart data={graphDefinitions.holidays.monthly.filter((point) => Number(point.holidays || 0) > 0)}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="holidays" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>

        <div
          className="stat-card xl:col-span-4 cursor-pointer hover:ring-1 hover:ring-primary/25"
          onClick={() => openGraphDialog("lifecycle")}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold">Employee Lifecycle</h3>
              <p className="text-sm text-muted-foreground">New joiners and probation population over time</p>
            </div>
            <Badge variant="outline">Click For Trends</Badge>
          </div>
          <ChartContainer
            config={graphDefinitions.lifecycle.series.reduce((acc, item) => ({ ...acc, [item.key]: { label: item.label, color: item.color } }), {})}
            className="h-[220px] w-full"
          >
            <AreaChart data={graphDefinitions.lifecycle.monthly}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              {graphDefinitions.lifecycle.series.map((item) => (
                <Area
                  key={item.key}
                  type="monotone"
                  dataKey={item.key}
                  stroke={item.color}
                  fill={item.color}
                  fillOpacity={0.18}
                />
              ))}
            </AreaChart>
          </ChartContainer>
        </div>

        <div className="stat-card xl:col-span-12">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold">Policy Health Snapshot</h3>
              <p className="text-sm text-muted-foreground">Operational settings shown as a visual state overview</p>
            </div>
            <Badge variant="outline">Live Config</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {[
              {
                label: "Sandwich Rule",
                value: orgSettings?.sandwichRuleEnabled ? 100 : 30,
                note: orgSettings?.sandwichRuleEnabled ? "Enabled" : "Disabled",
                color: orgSettings?.sandwichRuleEnabled ? "#22c55e" : "#f59e0b"
              },
              {
                label: "Attendance Lock",
                value: orgSettings?.attendanceLockEnabled ? 100 : 30,
                note: orgSettings?.attendanceLockEnabled ? "Enabled" : "Disabled",
                color: orgSettings?.attendanceLockEnabled ? "#22c55e" : "#f59e0b"
              },
              {
                label: "Leave Credit Mode",
                value: orgSettings?.leaveTypeCreditMode ? 100 : 30,
                note: orgSettings?.leaveTypeCreditMode || "Not set",
                color: orgSettings?.leaveTypeCreditMode ? "#3b82f6" : "#94a3b8"
              },
              {
                label: "Pending Leave Queue",
                value: Math.min(100, pendingApprovals.pendingLeaves.length * 20),
                note: `${pendingApprovals.pendingLeaves.length} pending`,
                color: pendingApprovals.pendingLeaves.length > 0 ? "#ef4444" : "#22c55e"
              }
            ].map((item) => (
              <div key={item.label} className="rounded-xl border p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{item.label}</span>
                  <span className="text-muted-foreground">{item.note}</span>
                </div>
                <div className="mt-3 h-3 rounded-full bg-muted">
                  <div className="h-3 rounded-full" style={{ width: `${item.value}%`, backgroundColor: item.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}

      {/* <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-6">
        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">7-Day Attendance Trend</h3>
            <Badge variant="outline">Present vs Absent</Badge>
          </div>
          <div className="space-y-3">
            {attendanceTrend.map((point) => {
              const presentPct = kpis.totalEmployees ? (point.present / kpis.totalEmployees) * 100 : 0;
              const absentPct = kpis.totalEmployees ? (point.absent / kpis.totalEmployees) * 100 : 0;
              const excludedPct = Math.max(0, 100 - presentPct - absentPct);
              return (
                <div key={point.key}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{point.label}</span>
                    <span className="text-muted-foreground">
                      P {point.present} | A {point.absent}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden bg-muted">
                    <div className="h-full flex">
                      <div className="h-full bg-emerald-500" style={{ width: `${presentPct}%` }} />
                      <div className="h-full bg-orange-400" style={{ width: `${absentPct}%` }} />
                      <div className="h-full bg-slate-300" style={{ width: `${excludedPct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Department Presence Bars</h3>
            <Badge variant="outline">Today</Badge>
          </div>
          <div className="space-y-3">
            {departmentAnalytics.length === 0 && (
              <p className="text-sm text-muted-foreground">No department data</p>
            )}
            {departmentAnalytics.map((d) => {
              const presentPct = d.employees ? Math.round((d.present / d.employees) * 100) : 0;
              return (
                <div key={`bar-${d.name}`}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium">{d.name}</span>
                    <span className="text-muted-foreground">{d.present}/{d.employees} ({presentPct}%)</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: `${presentPct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div> */}

      {dashboardView === "data" && (
      <>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-6">
        <div className="stat-card xl:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Approval Center</h3>
            <Badge variant="outline">Action Required</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border">
              <p className="text-sm text-muted-foreground mb-1">Pending Leave Requests</p>
              <p className="text-xl font-semibold">{pendingApprovals.pendingLeaves.length}</p>
              <Button className="mt-3" size="sm" variant="outline" onClick={() => navigate("/leave")}>
                Open Leave Queue
              </Button>
            </div>
            <div className="p-3 rounded-lg border">
              <p className="text-sm text-muted-foreground mb-1">Submitted Timesheets</p>
              <p className="text-xl font-semibold">{pendingApprovals.submittedTimesheets.length}</p>
              <Button className="mt-3" size="sm" variant="outline" onClick={() => navigate("/timesheets")}>
                Open Timesheet Queue
              </Button>
            </div>
          </div>
          <div className="mt-4 text-sm text-muted-foreground">
            {dashboardLoading ? "Refreshing dashboard data..." : "Last synced from live attendance, leave and timesheet data."}
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold">Latest Notifications</h3>
          </div>
          <div className="space-y-2 max-h-56 overflow-auto custom-scroll pr-1">
            {notifications.length === 0 && <p className="text-sm text-muted-foreground">No notifications</p>}
            {notifications.map((n) => (
              <div key={n._id} className="p-2 rounded-lg border text-sm">
                <p className="font-medium">{n.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{n.message}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-6">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold">Attendance Exceptions</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="p-2 rounded-lg bg-muted/40">Pending Checkout: <span className="font-semibold">{monthDaySummary.pendingCheckout}</span></div>
            <div className="p-2 rounded-lg bg-muted/40">Absent: <span className="font-semibold">{monthDaySummary.absent}</span></div>
            <div className="p-2 rounded-lg bg-muted/40">On Leave: <span className="font-semibold">{monthDaySummary.onLeave}</span></div>
            <div className="p-2 rounded-lg bg-muted/40">Week Off: <span className="font-semibold">{monthDaySummary.weekOff}</span></div>
            <div className="p-2 rounded-lg bg-muted/40">Holiday: <span className="font-semibold">{monthDaySummary.holiday}</span></div>
            <div className="p-2 rounded-lg bg-muted/40">Overridden Today: <span className="font-semibold">{monthDaySummary.overridden}</span></div>
          </div>
          <Button className="mt-3" size="sm" variant="outline" onClick={() => navigate("/attendance")}>
            Open Attendance Matrix
          </Button>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold">Department Snapshot</h3>
          </div>
          <div className="space-y-2">
            {departmentAnalytics.length === 0 && <p className="text-sm text-muted-foreground">No department data</p>}
            {departmentAnalytics.map((d) => (
              <div key={d.name} className="p-2 rounded-lg border text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{d.name}</span>
                  <span className="text-muted-foreground">{d.employees} emp</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Present: {d.present} | Leave: {d.onLeave} | Absent: {d.absent}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold">Timesheet Compliance</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="p-2 rounded-lg bg-muted/40">Submitted: <span className="font-semibold">{compliance.submitted}</span></div>
            <div className="p-2 rounded-lg bg-muted/40">Approved: <span className="font-semibold">{compliance.approved}</span></div>
            <div className="p-2 rounded-lg bg-muted/40">Rejected: <span className="font-semibold">{compliance.rejected}</span></div>
            <div className="p-2 rounded-lg bg-muted/40">Draft: <span className="font-semibold">{compliance.draft}</span></div>
          </div>
          <Button className="mt-3" size="sm" variant="outline" onClick={() => navigate("/timesheets")}>
            Open Timesheets
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-6">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold">Upcoming Holidays</h3>
          </div>
          <div className="space-y-2">
            {upcomingHolidays.length === 0 && <p className="text-sm text-muted-foreground">No upcoming holidays in next 30 days</p>}
            {upcomingHolidays.map((h) => (
              <div key={h._id} className="flex items-center justify-between p-2 rounded-lg border text-sm">
                <span>{h.name}</span>
                <span className="text-muted-foreground">{formatDateInOrgTimeZone(h.date)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {weekOffDays.length === 0 && <span className="text-sm text-muted-foreground">Week offs not configured</span>}
            {weekOffDays.map((d) => (
              <Badge key={d} variant="secondary">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]}</Badge>
            ))}
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-2 mb-3">
            <UserPlus className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold">Employee Lifecycle</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="p-2 rounded-lg bg-muted/40">New Joiners (30d): <span className="font-semibold">{hrLifecycle.newJoiners}</span></div>
            <div className="p-2 rounded-lg bg-muted/40">In Probation (90d): <span className="font-semibold">{hrLifecycle.inProbation}</span></div>
            <div className="p-2 rounded-lg bg-muted/40">Resigned: <span className="font-semibold">{hrLifecycle.resigned}</span></div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-2 mb-3">
            <CircleCheck className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold">Policy Health</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="p-2 rounded-lg bg-muted/40">
              Sandwich Rule: <span className="font-semibold">{orgSettings?.sandwichRuleEnabled ? "Enabled" : "Disabled"}</span>
            </div>
            <div className="p-2 rounded-lg bg-muted/40">
              Attendance Lock: <span className="font-semibold">{orgSettings?.attendanceLockEnabled ? "Enabled" : "Disabled"}</span>
            </div>
            <div className="p-2 rounded-lg bg-muted/40">
              Credit Mode: <span className="font-semibold">{orgSettings?.leaveTypeCreditMode || "-"}</span>
            </div>
            <div className="p-2 rounded-lg bg-muted/40">
              Leave Pending: <span className="font-semibold">{pendingApprovals.pendingLeaves.length}</span>
            </div>
          </div>
          {/* <Button className="mt-3" size="sm" variant="outline" onClick={() => navigate("/organization/settings")}>
            Open Org Settings
          </Button> */}
        </div>

      </div>
      </>
      )}
      </>
      )}
    </MainLayout>
  );
};

export default Dashboard;
