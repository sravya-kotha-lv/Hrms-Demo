import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getApiWithToken, postApiWithToken } from "@/services/apiWrapper";
import { toast } from "sonner";
import PermissionGate from "@/components/PermissionGate";
import { hasPermission } from "@/utils/auth";

const OrganizationSettings = () => {
  const [leaveCreditFrequency, setLeaveCreditFrequency] = useState("monthly");
  const [minWorkHoursPerDay, setMinWorkHoursPerDay] = useState(8);
  const [minHalfDayHours, setMinHalfDayHours] = useState(4);
  const [loading, setLoading] = useState(false);
  const canManage = hasPermission("ORG_SETTINGS_MANAGE");

  const fetchSettings = async () => {
    const res = await getApiWithToken("/org-settings");
    if (res?.success) {
      setLeaveCreditFrequency(res.data?.leaveCreditFrequency || "monthly");
      setMinWorkHoursPerDay(
        typeof res.data?.minWorkHoursPerDay === "number" ? res.data.minWorkHoursPerDay : 8
      );
      setMinHalfDayHours(
        typeof res.data?.minHalfDayHours === "number" ? res.data.minHalfDayHours : 4
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
        minWorkHoursPerDay: Number(minWorkHoursPerDay),
        minHalfDayHours: Number(minHalfDayHours)
      });
      if (res?.success) {
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

        <PermissionGate permissions={["ORG_SETTINGS_MANAGE"]}>
          <Button onClick={saveSettings} disabled={loading}>Save</Button>
        </PermissionGate>
      </div>
    </MainLayout>
  );
};

export default OrganizationSettings;
