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
import { setPermissions } from "@/utils/auth";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

/* ========================= Dashboard ========================= */

const Dashboard = () => {
  const navigate = useNavigate();
  const today = new Date();
  const monthValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const yearValue = today.getFullYear();

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
  const [orgSettings, setOrgSettings] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  /* ================= EFFECT ================= */

  useEffect(() => {
    const isSuperAdmin = localStorage.getItem("isSuperAdmin") === "true";
    if (isSuperAdmin) return;
    fetchOrganizations();
    loadDashboardData();
    const timer = window.setInterval(() => loadDashboardData(), 60000);
    return () => window.clearInterval(timer);
  }, []);

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
    const now = new Date();
    const dayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const start7 = new Date(now);
    start7.setDate(now.getDate() - 6);
    const start7Iso = `${start7.getFullYear()}-${String(start7.getMonth() + 1).padStart(2, "0")}-${String(start7.getDate()).padStart(2, "0")}`;

    const [employeesRes, attendanceRes, attendance7Res, matrixRes, leavesRes, weeklyRes, holidayRes, weekOffRes, settingsRes, notifRes] = await Promise.all([
      getApiWithToken("/employees?page=1&limit=500", null, { requiredPermissions: ["EMP_VIEW"] }),
      getApiWithToken(`/timesheets/attendance?startDate=${dayIso}&endDate=${dayIso}`, null, { requiredPermissions: ["TIMESHEET_VIEW_ALL"] }),
      getApiWithToken(`/timesheets/attendance?startDate=${start7Iso}&endDate=${dayIso}`, null, { requiredPermissions: ["TIMESHEET_VIEW_ALL"] }),
      getApiWithToken(`/timesheets/attendance/matrix?month=${monthValue}`, null, { requiredPermissions: ["ATTENDANCE_VIEW_ALL"] }),
      getApiWithToken("/leaves", null, { requiredPermissions: ["LEAVE_VIEW_ALL"] }),
      getApiWithToken("/timesheets/weekly", null, { requiredPermissions: ["TIMESHEET_VIEW_ALL"] }),
      getApiWithToken(`/holidays?year=${yearValue}`, null, { requiredPermissions: ["HOLIDAY_VIEW"] }),
      getApiWithToken("/week-offs", null, { requiredPermissions: ["WEEK_OFF_VIEW"] }),
      getApiWithToken("/org-settings", null, { requiredPermissions: ["ORG_SETTINGS_VIEW"] }),
      getApiWithToken("/notifications/my?limit=6", null, { requiredPermissions: ["NOTIFICATION_VIEW_SELF"] }),
    ]);

    setEmployeeList(employeesRes?.success ? (employeesRes.data?.items || []) : []);
    setAttendanceToday(attendanceRes?.success ? (attendanceRes.data || []) : []);
    setAttendanceLast7(attendance7Res?.success ? (attendance7Res.data || []) : []);
    setAttendanceMatrix(matrixRes?.success ? (matrixRes.data?.employees || []) : []);
    setLeaveList(leavesRes?.success ? (leavesRes.data || []) : []);
    setWeeklyList(weeklyRes?.success ? (weeklyRes.data || []) : []);
    setHolidays(holidayRes?.success ? (holidayRes.data || []) : []);
    setWeekOffDays(weekOffRes?.success ? (weekOffRes.data?.weekOffDays || []) : []);
    setOrgSettings(settingsRes?.success ? (settingsRes.data || null) : null);
    setNotifications(notifRes?.success ? (notifRes.data?.items || []) : []);
    setDashboardLoading(false);
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
    const totalEmployees = employeeList.length;
    const presentToday = attendanceToday.filter((a) => a.checkInAt || a.checkOutAt).length;
    const checkedInOnly = attendanceToday.filter((a) => a.checkInAt && !a.checkOutAt).length;
    const lateArrivals = attendanceToday.filter((a) => Number(a.lateByMinutes || 0) > 0).length;
    const onLeaveToday = leaveList.filter((l) => {
      const from = new Date(l.fromDate);
      const to = new Date(l.toDate);
      const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      return l.status === "approved" && t >= new Date(from.getFullYear(), from.getMonth(), from.getDate()) && t <= new Date(to.getFullYear(), to.getMonth(), to.getDate());
    }).length;
    return {
      totalEmployees,
      presentToday,
      checkedInOnly,
      lateArrivals,
      onLeaveToday
    };
  }, [employeeList, attendanceToday, leaveList]);

  const monthDaySummary = useMemo(() => {
    const day = today.getDate();
    let present = 0;
    let absent = 0;
    let onLeave = 0;
    let weekOff = 0;
    let holiday = 0;
    let overridden = 0;

    attendanceMatrix.forEach((row: any) => {
      const cell = row?.days?.[day];
      if (!cell) return;
      if (cell.overriddenBy || cell.overriddenAt) overridden += 1;
      if (cell.holidayName) {
        holiday += 1;
      } else if (cell.isWeekOff) {
        weekOff += 1;
      } else if (cell.isOnLeave) {
        onLeave += 1;
      } else if (cell.status === "present") {
        present += 1;
      } else {
        absent += 1;
      }
    });

    return { present, absent, onLeave, weekOff, holiday, overridden };
  }, [attendanceMatrix]);

  const pendingApprovals = useMemo(() => {
    const pendingLeaves = leaveList.filter((l) => l.status === "pending");
    const submittedTimesheets = weeklyList.filter((w) => w.status === "submitted");
    return {
      pendingLeaves,
      submittedTimesheets
    };
  }, [leaveList, weeklyList]);

  const departmentAnalytics = useMemo(() => {
    const day = today.getDate();
    const byEmployeeId = new Map(attendanceMatrix.map((r: any) => [String(r.employeeId), r]));
    const grouped: Record<string, { employees: number; present: number; onLeave: number; absent: number }> = {};

    employeeList.forEach((emp: any) => {
      const dept = emp.departmentId?.name || "Unassigned";
      if (!grouped[dept]) {
        grouped[dept] = { employees: 0, present: 0, onLeave: 0, absent: 0 };
      }
      grouped[dept].employees += 1;
      const row = byEmployeeId.get(String(emp._id));
      const cell = row?.days?.[day];
      if (!cell) return;
      if (cell.isOnLeave) grouped[dept].onLeave += 1;
      else if (cell.status === "present") grouped[dept].present += 1;
      else grouped[dept].absent += 1;
    });

    return Object.entries(grouped)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.employees - a.employees)
      .slice(0, 6);
  }, [employeeList, attendanceMatrix]);

  const attendanceTrend = useMemo(() => {
    const totalEmployees = employeeList.length;
    const now = new Date();
    const points = Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (6 - idx));
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return {
        key,
        label: d.toLocaleDateString(undefined, { weekday: "short" }),
        present: 0,
        absent: totalEmployees
      };
    });

    const pointMap = new Map(points.map((p) => [p.key, p]));
    const uniqueDayEmployee = new Set<string>();

    (attendanceLast7 || []).forEach((row: any) => {
      const d = new Date(row.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const point = pointMap.get(key);
      if (!point) return;
      const employeeKey = `${key}-${String(row.employeeId?._id || row.employeeId || "")}`;
      if (uniqueDayEmployee.has(employeeKey)) return;
      uniqueDayEmployee.add(employeeKey);

      if (row.checkInAt || row.checkOutAt) {
        point.present += 1;
      }
    });

    points.forEach((p) => {
      p.absent = Math.max(0, totalEmployees - p.present);
    });
    return points;
  }, [attendanceLast7, employeeList]);

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
                value={createOrgForm.name}
                onChange={(e) =>
                  setCreateOrgForm({ ...createOrgForm, name: e.target.value })
                }
              />
              <Input
                placeholder="Code"
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
                value={createUserForm.firstName}
                onChange={(e) =>
                  setCreateUserForm({ ...createUserForm, firstName: e.target.value })
                }
              />

              <Input
                placeholder="Last Name"
                value={createUserForm.lastName}
                onChange={(e) =>
                  setCreateUserForm({ ...createUserForm, lastName: e.target.value })
                }
              />

              <Input
                placeholder="Email"
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Users className="w-4 h-4" /> Total Employees
          </div>
          <div className="text-2xl font-semibold">{kpis.totalEmployees}</div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <UserCheck className="w-4 h-4" /> Present Today
          </div>
          <div className="text-2xl font-semibold">{kpis.presentToday}</div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <ClipboardCheck className="w-4 h-4" /> On Leave Today
          </div>
          <div className="text-2xl font-semibold">{kpis.onLeaveToday}</div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <AlertCircle className="w-4 h-4" /> Late Arrivals
          </div>
          <div className="text-2xl font-semibold">{kpis.lateArrivals}</div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <FileClock className="w-4 h-4" /> Missed Checkout
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
              const absentPct = Math.max(0, 100 - presentPct);
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
                <span className="text-muted-foreground">{new Date(h.date).toLocaleDateString()}</span>
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
          <Button className="mt-3" size="sm" variant="outline" onClick={() => navigate("/organization/settings")}>
            Open Org Settings
          </Button>
        </div>

      </div>
    </MainLayout>
  );
};

export default Dashboard;
