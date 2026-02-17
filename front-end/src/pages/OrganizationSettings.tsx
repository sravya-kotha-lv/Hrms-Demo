import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { getApiWithToken, postApiWithToken } from "@/services/apiWrapper";
import { toast } from "sonner";
import PermissionGate from "@/components/PermissionGate";
import { useAuth } from "@/context/AuthContext";
import { setOrgTimeZone } from "@/utils/timezone";

const TIMEZONE_OPTIONS = [
  "UTC",
  "Asia/Kolkata",
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
  const [attendanceLockEnabled, setAttendanceLockEnabled] = useState(false);
  const [attendanceLockAfterDays, setAttendanceLockAfterDays] = useState(7);
  const [attendanceLockMode, setAttendanceLockMode] = useState("days_window");
  const [timezone, setTimezone] = useState("UTC");
  const [payrollCutoffDay, setPayrollCutoffDay] = useState(25);
  const [minWorkHoursPerDay, setMinWorkHoursPerDay] = useState(8);
  const [minHalfDayHours, setMinHalfDayHours] = useState(4);
  const [probationPeriodDays, setProbationPeriodDays] = useState(90);
  const [noticePeriodDays, setNoticePeriodDays] = useState(30);
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
      setAttendanceLockEnabled(Boolean(res.data?.attendanceLockEnabled));
      setAttendanceLockAfterDays(
        typeof res.data?.attendanceLockAfterDays === "number" ? res.data.attendanceLockAfterDays : 7
      );
      setAttendanceLockMode(res.data?.attendanceLockMode || "days_window");
      setTimezone(res.data?.timezone || "UTC");
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
      setProbationPeriodDays(
        typeof res.data?.probationPeriodDays === "number" ? res.data.probationPeriodDays : 90
      );
      setNoticePeriodDays(
        typeof res.data?.noticePeriodDays === "number" ? res.data.noticePeriodDays : 30
      );
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
        payrollCutoffDay: Number(payrollCutoffDay),
        minWorkHoursPerDay: Number(minWorkHoursPerDay),
        minHalfDayHours: Number(minHalfDayHours),
        probationPeriodDays: Number(probationPeriodDays),
        noticePeriodDays: Number(noticePeriodDays)
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
      <div className="bg-card rounded-xl card-shadow p-6 max-w-2xl">
        <div className="space-y-2 mb-4">
          <h3 className="text-lg font-semibold">Leave Credit Settings</h3>
          <p className="text-sm text-muted-foreground">
            Choose how leave is credited for employees.
          </p>
        </div>

        <div className="space-y-2 mb-6">
          <label className="text-sm font-medium">Credit Frequency</label>
          <Select
            value={leaveCreditFrequency}
            onValueChange={setLeaveCreditFrequency}
            disabled={!canManage}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select frequency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 mb-6">
          <label className="text-sm font-medium">New Leave Type Credit</label>
          <Select
            value={leaveTypeCreditMode}
            onValueChange={setLeaveTypeCreditMode}
            disabled={!canManage}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current_month_onwards">Current month onwards</SelectItem>
              <SelectItem value="full_year">Full leaves for cycle</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 mb-6">
          <label className="text-sm font-medium">Probation Period (Days)</label>
          <Input
            type="number"
            min={0}
            max={3650}
            value={probationPeriodDays}
            onChange={(e) => setProbationPeriodDays(Number(e.target.value))}
            disabled={!canManage}
            className="w-64"
          />
          <p className="text-xs text-muted-foreground">
            New employees are added in probation and auto-completed after these many days.
          </p>
        </div>

        <div className="space-y-2 mb-6">
          <label className="text-sm font-medium">Notice Period (Days)</label>
          <Input
            type="number"
            min={0}
            max={3650}
            value={noticePeriodDays}
            onChange={(e) => setNoticePeriodDays(Number(e.target.value))}
            disabled={!canManage}
            className="w-64"
          />
          <p className="text-xs text-muted-foreground">
            Used when moving an employee to notice period.
          </p>
        </div>

        <div className="space-y-2 mb-6">
          <label className="text-sm font-medium">Minimum Working Hours Per Day</label>
          <Input
            type="number"
            min={0}
            max={24}
            step={0.5}
            value={minWorkHoursPerDay}
            onChange={(e) => setMinWorkHoursPerDay(Number(e.target.value))}
            disabled={!canManage}
            className="w-64"
          />
        </div>

        <div className="space-y-2 mb-6">
          <label className="text-sm font-medium">Minimum Half Day Hours</label>
          <Input
            type="number"
            min={0}
            max={24}
            step={0.5}
            value={minHalfDayHours}
            onChange={(e) => setMinHalfDayHours(Number(e.target.value))}
            disabled={!canManage}
            className="w-64"
          />
          <p className="text-xs text-muted-foreground">
            Hours below this value will be treated as invalid on timesheet submission.
          </p>
        </div>

        <div className="space-y-2 mb-6">
          <label className="text-sm font-medium">Sandwich Rule</label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={sandwichRuleEnabled}
              onCheckedChange={(value) => setSandwichRuleEnabled(Boolean(value))}
              disabled={!canManage}
            />
            Enable sandwich rule (count week-offs/holidays between leave dates)
          </label>
        </div>

        <div className="space-y-2 mb-6">
          <label className="text-sm font-medium">Organization Timezone</label>
          <Select
            value={timezone}
            onValueChange={setTimezone}
            disabled={!canManage}
          >
            <SelectTrigger className="w-64">
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
            Attendance day boundaries and shift calculations use this timezone. Timestamps are stored in UTC.
          </p>
        </div>

        <div className="space-y-2 mb-6">
          <label className="text-sm font-medium">Attendance Edit Lock</label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={attendanceLockEnabled}
              onCheckedChange={(value) => setAttendanceLockEnabled(Boolean(value))}
              disabled={!canManage}
            />
            Lock attendance edits for older days
          </label>
          <Input
            type="number"
            min={0}
            max={365}
            value={attendanceLockAfterDays}
            onChange={(e) => setAttendanceLockAfterDays(Number(e.target.value))}
            disabled={!canManage || !attendanceLockEnabled || attendanceLockMode !== "days_window"}
            className="w-64"
            placeholder="Editable window (days)"
          />
          <Select
            value={attendanceLockMode}
            onValueChange={setAttendanceLockMode}
            disabled={!canManage || !attendanceLockEnabled}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Lock mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="days_window">By days window</SelectItem>
              <SelectItem value="payroll_cutoff">By payroll cutoff</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="number"
            min={1}
            max={31}
            value={payrollCutoffDay}
            onChange={(e) => setPayrollCutoffDay(Number(e.target.value))}
            disabled={!canManage || !attendanceLockEnabled || attendanceLockMode !== "payroll_cutoff"}
            className="w-64"
            placeholder="Payroll cutoff day"
          />
          <p className="text-xs text-muted-foreground">
            In payroll cutoff mode, editable attendance starts from cutoff+1 day of current cycle.
          </p>
        </div>

        <PermissionGate permissions={["ORG_SETTINGS_MANAGE"]}>
          <Button onClick={saveSettings} disabled={loading}>Save</Button>
        </PermissionGate>
      </div>
      )}
    </MainLayout>
  );
};

export default OrganizationSettings;
