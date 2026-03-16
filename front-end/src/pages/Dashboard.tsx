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
import { useEffect, useMemo, useState } from "react";
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
import { useAuth } from "@/context/AuthContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";

/* ========================= Dashboard ========================= */

const isPresentLikeStatus = (status?: string | null) =>
  status === "present" || status === "half_day_present" || status === "full_day_present";

const getEmployeeId = (value: any) =>
  String(value?._id || value?.employeeId?._id || value?.employeeId || value || "");

const hasAttendanceActivity = (row: any) => Boolean(row?.checkInAt || row?.checkOutAt);

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
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [showCreateOrg, setShowCreateOrg] = useState(false);

  const [createOrgForm, setCreateOrgForm] = useState({
    name: "",
    code: "",
    timezone: "Asia/Kolkata",
    currency: "INR",
  });

  /* ---------- USER STATE ---------- */
  const [showUserPopup, setShowUserPopup] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
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

  const [roles, setRoles] = useState<any[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);

  /* ---------- DASHBOARD DATA ---------- */
  const [employeeList, setEmployeeList] = useState<any[]>([]);
  const [attendanceToday, setAttendanceToday] = useState<any[]>([]);
  const [attendanceLast7, setAttendanceLast7] = useState<any[]>([]);
  const [attendanceMatrix, setAttendanceMatrix] = useState<any[]>([]);
  const [leaveList, setLeaveList] = useState<any[]>([]);
  const [weeklyList, setWeeklyList] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [weekOffDays, setWeekOffDays] = useState<number[]>([]);
  const [todayStatusList, setTodayStatusList] = useState<any[]>([]);
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [orgSettings, setOrgSettings] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedKpiKey, setSelectedKpiKey] = useState<
    "total" | "present" | "absent" | "leave" | "late" | "missed" | null
  >(null);

  /* ================= EFFECT ================= */

  useEffect(() => {
    if (!isSuperAdmin && permissions.length === 0) return;
    loadDashboardData();
  }, [isSuperAdmin, permissions]);

  useEffect(() => {
    if (!showOrgPopup) return;
    fetchOrganizations();
  }, [showOrgPopup]);

  /* ================= API ================= */

  const fetchOrganizations = async () => {
    const res = await getApiWithToken("/organizations");
    setOrganizations(res?.data || []);
  };

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
        list.map((e: any) => ({
          _id: e._id,
          name: `${e.firstName || ""} ${e.lastName || ""}`.trim()
        }))
      );
    }
  };

  const loadDashboardData = async () => {
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
  };

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
      presentToday: todayStatusList.filter((item: any) => item.present).length,
      absentToday: todayStatusList.filter((item: any) => item.absent).length,
      checkedInOnly: todayStatusList.filter((item: any) => item.pendingCheckout).length,
      lateArrivals: todayStatusList.filter((item: any) => item.present && Number(item.lateByMinutes || 0) > 0).length,
      onLeaveToday: todayStatusList.filter((item: any) => item.isOnLeave).length
    };
  }, [dashboardStats, employeeList.length, todayStatusList]);

  const kpiHelpText = {
    total: "Total active employees only. Resigned and terminated employees are excluded.",
    present: "Employees who checked in or checked out today.",
    leave: "Employees with approved leave that includes today.",
    absent: "Employees marked absent today, excluding holiday, week off, and approved leave.",
    late: "Employees who checked in late based on shift start and grace rules.",
    missed: "Employees who checked in today but have not checked out yet."
  };

  const kpiEmployeeDetails = useMemo(() => {
    const employeeById = new Map(
      employeeList.map((emp: any) => [String(emp._id), emp])
    );
    const todayStatusByEmployeeId = new Map(
      (todayStatusList || []).map((item: any) => [String(item.employeeId), item])
    );

    const toDisplayRow = (employee: any, extra: Record<string, any> = {}) => ({
      id: String(employee?._id || employee?.employeeId || `${employee?.firstName || ""}-${employee?.lastName || ""}`),
      name: `${employee?.firstName || ""} ${employee?.lastName || ""}`.trim() || "-",
      employeeCode: employee?.employeeCode || "-",
      department: employee?.departmentId?.name || "Unassigned",
      designation: employee?.designationId?.name || "-",
      ...extra
    });

    const uniqueByEmployeeId = (rows: any[]) => {
      const map = new Map<string, any>();
      rows.forEach((row) => {
        const id = String(row.id || "");
        if (!id) return;
        if (!map.has(id)) map.set(id, row);
      });
      return Array.from(map.values());
    };

    const totalRows = employeeList.map((emp: any) => toDisplayRow(emp));

    const presentRows = uniqueByEmployeeId(
      employeeList
        .filter((employee: any) => {
          const employeeId = String(employee?._id || "");
          const status = todayStatusByEmployeeId.get(employeeId);
          if (!status || status.holidayName || status.isWeekOff || status.isOnLeave) return false;
          return Boolean(status.present);
        })
        .map((employee: any) => {
          const employeeId = String(employee?._id || "");
          const status = todayStatusByEmployeeId.get(employeeId);
          return toDisplayRow(employee || {}, {
            id: employeeId,
            checkInAt: status?.checkInAt ? formatTimeInOrgTimeZone(status.checkInAt, { hour: "2-digit", minute: "2-digit" }) : "-",
            checkOutAt: status?.checkOutAt ? formatTimeInOrgTimeZone(status.checkOutAt, { hour: "2-digit", minute: "2-digit" }) : "-"
          });
        })
    );

    const leaveRows = uniqueByEmployeeId(
      (leaveList || [])
        .filter((l: any) => {
          const fromKey = toOrgDateKey(l.fromDate);
          const toKey = toOrgDateKey(l.toDate);
          return l.status === "approved" && todayKey >= fromKey && todayKey <= toKey;
        })
        .map((l: any) => {
          const base = employeeById.get(String(l.employeeId?._id || l.employeeId)) || l.employeeId;
          return toDisplayRow(base, {
            id: String(base?._id || l.employeeId?._id || l.employeeId),
            leaveType: l.leaveTypeId?.name || "-"
          });
        })
    );

    const absentRows = uniqueByEmployeeId(
      employeeList
        .filter((employee: any) => {
          const status = todayStatusByEmployeeId.get(String(employee?._id || ""));
          return Boolean(status?.absent);
        })
        .map((employee: any) => {
          const employeeId = String(employee?._id || "");
          return toDisplayRow(employee || {}, {
            id: employeeId,
            absentReason: "Absent"
          });
        })
    );

    const lateRows = uniqueByEmployeeId(
      employeeList
        .filter((employee: any) => {
          const employeeId = String(employee?._id || "");
          const status = todayStatusByEmployeeId.get(employeeId);
          if (!status || status.holidayName || status.isWeekOff || status.isOnLeave) return false;
          return Boolean(status.present) && Number(status.lateByMinutes || 0) > 0;
        })
        .map((employee: any) => {
          const employeeId = String(employee?._id || "");
          const status = todayStatusByEmployeeId.get(employeeId);
          return toDisplayRow(employee || {}, {
            id: employeeId,
            lateByMinutes: Number(status?.lateByMinutes || 0)
          });
        })
    );

    const missedRows = uniqueByEmployeeId(
      employeeList
        .filter((employee: any) => {
          const employeeId = String(employee?._id || "");
          const status = todayStatusByEmployeeId.get(employeeId);
          return Boolean(status?.pendingCheckout);
        })
        .map((employee: any) => {
          const employeeId = String(employee?._id || "");
          const status = todayStatusByEmployeeId.get(employeeId);
          return toDisplayRow(employee || {}, {
            id: employeeId,
            checkInAt: status?.checkInAt ? formatTimeInOrgTimeZone(status.checkInAt, { hour: "2-digit", minute: "2-digit" }) : "-"
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
  }, [employeeList, leaveList, todayKey, todayStatusList]);

  const openKpiDialog = (key: "total" | "present" | "absent" | "leave" | "late" | "missed") => {
    setSelectedKpiKey(key);
    setDetailsDialogOpen(true);
  };

  const monthDaySummary = useMemo(() => {
    if (dashboardStats?.monthDaySummary) return dashboardStats.monthDaySummary;
    return {
      present: todayStatusList.filter((item: any) => item.present && !item.pendingCheckout).length,
      pendingCheckout: todayStatusList.filter((item: any) => item.pendingCheckout).length,
      absent: todayStatusList.filter((item: any) => item.absent).length,
      onLeave: todayStatusList.filter((item: any) => item.isOnLeave).length,
      weekOff: todayStatusList.filter((item: any) => item.isWeekOff).length,
      holiday: todayStatusList.filter((item: any) => Boolean(item.holidayName)).length,
      overridden: todayStatusList.filter((item: any) => item.overriddenBy || item.overriddenAt).length
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
    employeeList.forEach((employee: any) => {
      const dept = employee.departmentId?.name || "Unassigned";
      if (!grouped[dept]) grouped[dept] = { name: dept, employees: 0, present: 0, onLeave: 0, absent: 0 };
      grouped[dept].employees += 1;
      const status = todayStatusList.find((item: any) => item.employeeId === String(employee._id));
      if (!status) return;
      if (status.isOnLeave) grouped[dept].onLeave += 1;
      else if (status.present) grouped[dept].present += 1;
      else if (status.absent) grouped[dept].absent += 1;
    });
    return Object.values(grouped).sort((a, b) => b.employees - a.employees).slice(0, 6);
  }, [dashboardStats, employeeList, todayStatusList]);

  const attendanceTrend = useMemo(() => {
    const points = dashboardStats?.attendanceTrend || [];
    return points.map((point: any) => ({
      ...point,
      label: point.label || formatDateInOrgTimeZone(new Date(`${point.key}T00:00:00`), { weekday: "short" })
    }));
  }, [dashboardStats]);

  const compliance = useMemo(() => {
    const submitted = weeklyList.filter((w) => w.status === "submitted").length;
    const approved = weeklyList.filter((w) => w.status === "approved").length;
    const rejected = weeklyList.filter((w) => w.status === "rejected").length;
    const draft = weeklyList.filter((w) => w.status === "draft").length;
    return { submitted, approved, rejected, draft, total: weeklyList.length };
  }, [weeklyList]);

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
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const end = new Date(start);
    end.setDate(start.getDate() + 30);
    return holidays
      .filter((h: any) => {
        const d = new Date(h.date);
        return d >= start && d <= end;
      })
      .slice(0, 6);
  }, [holidays]);

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
            <DialogTitle>
              {selectedKpiKey ? kpiEmployeeDetails[selectedKpiKey].title : "Employee Details"}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[420px] overflow-auto space-y-2">
            {(selectedKpiKey ? kpiEmployeeDetails[selectedKpiKey].rows : []).length === 0 && (
              <p className="text-sm text-muted-foreground">No employees found.</p>
            )}
            {(selectedKpiKey ? kpiEmployeeDetails[selectedKpiKey].rows : []).map((row: any) => (
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
                  </p>
                )}
              </div>
            ))}
          </div>
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
                  {u.roles?.map((r: any) => r.name).join(", ")}
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
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
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
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-6">
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
      </div>

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
            {notifications.map((n: any) => (
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
            {upcomingHolidays.map((h: any) => (
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
    </MainLayout>
  );
};

export default Dashboard;
