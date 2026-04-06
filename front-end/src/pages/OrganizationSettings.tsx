import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { getApiWithToken, postApiWithToken } from "@/services/apiWrapper";
import { toast } from "sonner";
import PermissionGate from "@/components/PermissionGate";
import { useAuth } from "@/context/useAuth";
import { setOrgTimeZone } from "@/utils/timezone";
import { Clock3, MapPin, Save, ShieldCheck, Sparkles } from "lucide-react";

const TIMEZONE_OPTIONS = [
  "Asia/Kolkata",
  "UTC",
  "Asia/Dubai",
  "Asia/Singapore",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Australia/Sydney"
];

const OrganizationSettings = () => {
  const { hasAnyPermission } = useAuth();
  const [leaveCreditFrequency, setLeaveCreditFrequency] = useState("monthly");
  const [leaveTypeCreditMode, setLeaveTypeCreditMode] = useState("current_month_onwards");
  const [sandwichRuleEnabled, setSandwichRuleEnabled] = useState(false);
  const [attendanceLockEnabled, setAttendanceLockEnabled] = useState(true);
  const [attendanceLockAfterDays, setAttendanceLockAfterDays] = useState(7);
  const [attendanceLockMode, setAttendanceLockMode] = useState("payroll_cutoff");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [maxActiveLoginsPerUser, setMaxActiveLoginsPerUser] = useState(1);
  const [payrollCutoffDay, setPayrollCutoffDay] = useState(25);
  const [minWorkHoursPerDay, setMinWorkHoursPerDay] = useState(8);
  const [minHalfDayHours, setMinHalfDayHours] = useState(4);
  const [attendanceAllowedIp, setAttendanceAllowedIp] = useState("");
  const [attendanceCheckInMode, setAttendanceCheckInMode] = useState<"none" | "ip" | "selfie" | "geofence">("none");
  const [attendanceGeoLatitude, setAttendanceGeoLatitude] = useState("");
  const [attendanceGeoLongitude, setAttendanceGeoLongitude] = useState("");
  const [attendanceGeoRadiusMeters, setAttendanceGeoRadiusMeters] = useState(200);
  const [attendanceDevBypassEnabled, setAttendanceDevBypassEnabled] = useState(false);
  const [probationPeriodDays, setProbationPeriodDays] = useState(90);
  const [noticePeriodDays, setNoticePeriodDays] = useState(30);
  const [employeeIdPrefix, setEmployeeIdPrefix] = useState("");
  const [loading, setLoading] = useState(false);
  const canView = hasAnyPermission(["ORG_SETTINGS_VIEW"]);
  const canManage = hasAnyPermission(["ORG_SETTINGS_MANAGE"]);

  const fetchSettings = async () => {
    const res = await getApiWithToken("/org-settings", null, {
      requiredPermissions: ["ORG_SETTINGS_VIEW"]
    });
    if (res?.skipped) return;
    if (res?.success) {
      setLeaveCreditFrequency(res.data?.leaveCreditFrequency || "monthly");
      setLeaveTypeCreditMode(res.data?.leaveTypeCreditMode || "current_month_onwards");
      setSandwichRuleEnabled(Boolean(res.data?.sandwichRuleEnabled));
      setAttendanceLockEnabled(
        typeof res.data?.attendanceLockEnabled === "boolean" ? res.data.attendanceLockEnabled : true
      );
      setAttendanceLockAfterDays(
        typeof res.data?.attendanceLockAfterDays === "number" ? res.data.attendanceLockAfterDays : 7
      );
      setAttendanceLockMode(res.data?.attendanceLockMode || "payroll_cutoff");
      setTimezone(res.data?.timezone || "Asia/Kolkata");
      setMaxActiveLoginsPerUser(
        typeof res.data?.maxActiveLoginsPerUser === "number" ? res.data.maxActiveLoginsPerUser : 1
      );
      if (res.data?.timezone) {
        setOrgTimeZone(res.data.timezone);
      }
      setPayrollCutoffDay(
        typeof res.data?.payrollCutoffDay === "number" ? res.data.payrollCutoffDay : 25
      );
      setMinWorkHoursPerDay(
        typeof res.data?.minWorkHoursPerDay === "number" ? res.data.minWorkHoursPerDay : 8
      );
      setMinHalfDayHours(
        typeof res.data?.minHalfDayHours === "number" ? res.data.minHalfDayHours : 4
      );
      setAttendanceAllowedIp(String(res.data?.attendanceAllowedIp || ""));
      const resolvedMode =
        res.data?.attendanceIpEnabled
          ? "ip"
          : res.data?.attendanceSelfieRequired
            ? "selfie"
            : res.data?.attendanceGeoFenceEnabled
              ? "geofence"
              : "none";
      setAttendanceCheckInMode(resolvedMode);
      setAttendanceGeoLatitude(
        res.data?.attendanceGeoLatitude === null || res.data?.attendanceGeoLatitude === undefined
          ? ""
          : String(res.data.attendanceGeoLatitude)
      );
      setAttendanceGeoLongitude(
        res.data?.attendanceGeoLongitude === null || res.data?.attendanceGeoLongitude === undefined
          ? ""
          : String(res.data.attendanceGeoLongitude)
      );
      setAttendanceGeoRadiusMeters(
        typeof res.data?.attendanceGeoRadiusMeters === "number" ? res.data.attendanceGeoRadiusMeters : 200
      );
      setAttendanceDevBypassEnabled(Boolean(res.data?.attendanceDevBypassEnabled));
      setProbationPeriodDays(
        typeof res.data?.probationPeriodDays === "number" ? res.data.probationPeriodDays : 90
      );
      setNoticePeriodDays(
        typeof res.data?.noticePeriodDays === "number" ? res.data.noticePeriodDays : 30
      );
      setEmployeeIdPrefix(String(res.data?.employeeIdPrefix || ""));
    } else {
      toast.error(res?.message || "Failed to load settings");
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const saveSettings = async () => {
    try {
      setLoading(true);
      const res = await postApiWithToken("/org-settings", {
        leaveCreditFrequency,
        leaveTypeCreditMode,
        sandwichRuleEnabled,
        attendanceLockEnabled,
        attendanceLockAfterDays: Number(attendanceLockAfterDays),
        attendanceLockMode,
        timezone,
        maxActiveLoginsPerUser: Number(maxActiveLoginsPerUser || 1),
        payrollCutoffDay: Number(payrollCutoffDay),
        minWorkHoursPerDay: Number(minWorkHoursPerDay),
        minHalfDayHours: Number(minHalfDayHours),
        attendanceIpEnabled: attendanceCheckInMode === "ip",
        attendanceAllowedIp,
        attendanceSelfieRequired: attendanceCheckInMode === "selfie",
        attendanceGeoFenceEnabled: attendanceCheckInMode === "geofence",
        attendanceGeoLatitude: attendanceGeoLatitude === "" ? null : Number(attendanceGeoLatitude),
        attendanceGeoLongitude: attendanceGeoLongitude === "" ? null : Number(attendanceGeoLongitude),
        attendanceGeoRadiusMeters: Number(attendanceGeoRadiusMeters),
        attendanceDevBypassEnabled,
        probationPeriodDays: Number(probationPeriodDays),
        noticePeriodDays: Number(noticePeriodDays),
        employeeIdPrefix: employeeIdPrefix.trim().toUpperCase()
      }, null, { requiredPermissions: ["ORG_SETTINGS_MANAGE"] });
      if (res?.skipped) return;
      if (res?.success) {
        if (timezone) {
          setOrgTimeZone(timezone);
        }
        toast.success("Settings saved");
      } else {
        toast.error(res?.message || "Save failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout
      title="Organization Settings"
      breadcrumb={[{ label: "Home", href: "/" }, { label: "Organization" }, { label: "Settings" }]}
    >
      {!canView && (
        <div className="bg-card rounded-xl card-shadow p-6 text-sm text-muted-foreground">
          You do not have permission to view organization settings.
        </div>
      )}
      {canView && (
      <div className="space-y-5 max-w-6xl">
        <div className="relative overflow-hidden rounded-2xl border border-indigo-200/70 bg-gradient-to-r from-indigo-50 via-sky-50 to-cyan-50 p-6 card-shadow">
          <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/80 px-3 py-1 text-xs font-medium text-indigo-700">
                <Sparkles className="h-3.5 w-3.5" />
                Organization Controls
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
                Settings Console
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Configure leave, attendance rules, and check-in policies from one place.
              </p>
            </div>
            <div className="rounded-xl border border-white/70 bg-white/75 px-4 py-3 text-sm text-slate-700 backdrop-blur">
              <p className="font-medium">{canManage ? "Editable mode" : "Read-only mode"}</p>
              <p className="text-xs text-slate-500">
                {canManage
                  ? "You can update and save policy changes."
                  : "You can view settings but cannot update them."}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-card p-5 card-shadow transition-all duration-300 hover:shadow-lg">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
              <h3 className="text-base font-semibold text-slate-900">Leave and Employment Policy</h3>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Credit Frequency</label>
                <Select
                  value={leaveCreditFrequency}
                  onValueChange={setLeaveCreditFrequency}
                  disabled={!canManage}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">New Leave Type Credit</label>
                <Select
                  value={leaveTypeCreditMode}
                  onValueChange={setLeaveTypeCreditMode}
                  disabled={!canManage}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current_month_onwards">Current month onwards</SelectItem>
                    <SelectItem value="full_year">Full leaves for cycle</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Probation Period (Days)</label>
                  <Input
                    type="number"
                    min={0}
                    max={3650}
                    value={probationPeriodDays}
                    onChange={(e) => setProbationPeriodDays(Number(e.target.value))}
                    disabled={!canManage}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Notice Period (Days)</label>
                  <Input
                    type="number"
                    min={0}
                    max={3650}
                    value={noticePeriodDays}
                    onChange={(e) => setNoticePeriodDays(Number(e.target.value))}
                    disabled={!canManage}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Employee ID Prefix</label>
                <Input
                  type="text"
                  maxLength={10}
                  placeholder="Ex: LV"
                  value={employeeIdPrefix}
                  onChange={(e) => setEmployeeIdPrefix(e.target.value.toUpperCase())}
                  disabled={!canManage}
                />
                <p className="text-xs text-muted-foreground">
                  New employee codes use this prefix. If empty, system uses `.env` prefix.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Probation is auto-completed after the configured days. Notice period is used when moving an employee to notice.
              </p>

              <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <Checkbox
                  checked={sandwichRuleEnabled}
                  onCheckedChange={(value) => setSandwichRuleEnabled(Boolean(value))}
                  disabled={!canManage}
                />
                <span>Enable sandwich rule (count week-offs/holidays between leave dates)</span>
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-card p-5 card-shadow transition-all duration-300 hover:shadow-lg">
            <div className="mb-4 flex items-center gap-2">
              <Clock3 className="h-5 w-5 text-cyan-600" />
              <h3 className="text-base font-semibold text-slate-900">Workday and Lock Rules</h3>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Minimum Working Hours Per Day</label>
                  <Input
                    type="number"
                    min={0}
                    max={24}
                    step={0.5}
                    value={minWorkHoursPerDay}
                    onChange={(e) => setMinWorkHoursPerDay(Number(e.target.value))}
                    disabled={!canManage}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Minimum Half Day Hours</label>
                  <Input
                    type="number"
                    min={0}
                    max={24}
                    step={0.5}
                    value={minHalfDayHours}
                    onChange={(e) => setMinHalfDayHours(Number(e.target.value))}
                    disabled={!canManage}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Hours below half-day threshold are treated as invalid on timesheet submission.
              </p>

              <div className="space-y-2">
                <label className="text-sm font-medium">Organization Timezone</label>
                <Select
                  value={timezone}
                  onValueChange={setTimezone}
                  disabled={!canManage}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONE_OPTIONS.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Attendance boundaries use this timezone. Timestamps remain stored in UTC.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Max Active Logins Per User</label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={maxActiveLoginsPerUser}
                  onChange={(e) => setMaxActiveLoginsPerUser(Number(e.target.value))}
                  disabled={!canManage}
                />
                <p className="text-xs text-muted-foreground">
                  Limits how many devices a user can stay logged into at the same time for this organization.
                </p>
              </div>

              <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <Checkbox
                  checked={attendanceLockEnabled}
                  onCheckedChange={(value) => setAttendanceLockEnabled(Boolean(value))}
                  disabled={!canManage}
                />
                <span>Lock attendance edits for older days</span>
              </label>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-medium">Lock Mode</label>
                  <Select
                    value={attendanceLockMode}
                    onValueChange={setAttendanceLockMode}
                    disabled={!canManage || !attendanceLockEnabled}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Lock mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="days_window">By days window</SelectItem>
                      <SelectItem value="payroll_cutoff">By payroll cutoff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Editable Window (Days)</label>
                  <Input
                    type="number"
                    min={0}
                    max={365}
                    value={attendanceLockAfterDays}
                    onChange={(e) => setAttendanceLockAfterDays(Number(e.target.value))}
                    disabled={!canManage || !attendanceLockEnabled || attendanceLockMode !== "days_window"}
                    placeholder="Ex: 7"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Payroll Cutoff Day</label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={payrollCutoffDay}
                    onChange={(e) => setPayrollCutoffDay(Number(e.target.value))}
                    disabled={!canManage || !attendanceLockEnabled || attendanceLockMode !== "payroll_cutoff"}
                    placeholder="Ex: 25"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                In payroll cutoff mode, editable attendance starts from cutoff+1 day of the current cycle.
              </p>
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-card p-5 card-shadow transition-all duration-300 hover:shadow-lg">
          <div className="mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-emerald-600" />
            <h3 className="text-base font-semibold text-slate-900">Check-In Restrictions</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Restriction Mode</label>
              <Select
                value={attendanceCheckInMode}
                onValueChange={(value: "none" | "ip" | "selfie" | "geofence") => setAttendanceCheckInMode(value)}
                disabled={!canManage}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select check-in restriction mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No restriction</SelectItem>
                  <SelectItem value="ip">Office IP only</SelectItem>
                  <SelectItem value="selfie">Selfie required</SelectItem>
                  <SelectItem value="geofence">Office geofence only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 lg:col-span-2">
              <label className="text-sm font-medium">Office IPs (comma/newline separated)</label>
              <Input
                type="text"
                placeholder="Ex: 103.12.11.20, 27.6.72.42"
                value={attendanceAllowedIp}
                onChange={(e) => setAttendanceAllowedIp(e.target.value)}
                disabled={!canManage || attendanceCheckInMode !== "ip"}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Latitude</label>
              <Input
                type="number"
                step="0.000001"
                placeholder="Office latitude"
                value={attendanceGeoLatitude}
                onChange={(e) => setAttendanceGeoLatitude(e.target.value)}
                disabled={!canManage || attendanceCheckInMode !== "geofence"}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Longitude</label>
              <Input
                type="number"
                step="0.000001"
                placeholder="Office longitude"
                value={attendanceGeoLongitude}
                onChange={(e) => setAttendanceGeoLongitude(e.target.value)}
                disabled={!canManage || attendanceCheckInMode !== "geofence"}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Radius (Meters)</label>
              <Input
                type="number"
                min={10}
                max={100000}
                placeholder="Radius"
                value={attendanceGeoRadiusMeters}
                onChange={(e) => setAttendanceGeoRadiusMeters(Number(e.target.value || 200))}
                disabled={!canManage || attendanceCheckInMode !== "geofence"}
              />
            </div>
          </div>

          {/* <label className="mt-4 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <Checkbox
              checked={attendanceDevBypassEnabled}
              onCheckedChange={(value) => setAttendanceDevBypassEnabled(Boolean(value))}
              disabled={!canManage}
            />
            <span>
              Enable local development bypass (skip restriction checks when `NODE_ENV` is not `production`)
            </span>
          </label> */}
        </section>

        <PermissionGate permissions={["ORG_SETTINGS_MANAGE"]}>
          <div className="sticky bottom-4 z-10 flex justify-end">
            <Button onClick={saveSettings} disabled={loading} className="min-w-32 gap-2 rounded-xl shadow-lg">
              <Save className="h-4 w-4" />
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </PermissionGate>
      </div>
      )}
    </MainLayout>
  );
};

export default OrganizationSettings;
