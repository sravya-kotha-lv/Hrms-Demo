import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getApiWithToken, postApiWithToken } from "@/services/apiWrapper";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/context/AuthContext";
import PermissionGate from "@/components/PermissionGate";

const DAYS = [
  { label: "Sunday", value: 0 },
  { label: "Monday", value: 1 },
  { label: "Tuesday", value: 2 },
  { label: "Wednesday", value: 3 },
  { label: "Thursday", value: 4 },
  { label: "Friday", value: 5 },
  { label: "Saturday", value: 6 },
];

const WeekOffs = () => {
  const [weekOffDays, setWeekOffDays] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const { hasAnyPermission } = useAuth();
  const canView = hasAnyPermission(["WEEK_OFF_VIEW"]);
  const canManage = hasAnyPermission(["WEEK_OFF_MANAGE"]);

  const fetchConfig = async () => {
    const res = await getApiWithToken("/week-offs", null, {
      requiredPermissions: ["WEEK_OFF_VIEW"]
    });
    if (res?.skipped) return;
    if (res?.success) {
      setWeekOffDays(res?.data?.weekOffDays || []);
    } else {
      toast.error(res?.message || "Failed to load week off config");
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const toggleDay = (value: number) => {
    setWeekOffDays((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value].sort((a, b) => a - b)
    );
  };

  const saveConfig = async () => {
    if (weekOffDays.length === 0) {
      toast.error("Select at least one day");
      return;
    }
    try {
      setLoading(true);
      const res = await postApiWithToken("/week-offs", { weekOffDays }, null, {
        requiredPermissions: ["WEEK_OFF_MANAGE"]
      });
      if (res?.skipped) return;
      if (res?.success) {
        toast.success("Week off configuration saved");
      } else {
        toast.error(res?.message || "Save failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout
      title="Week Off Configuration"
      breadcrumb={[{ label: "Home", href: "/" }, { label: "Week Offs" }]}
    >
      {!canView && (
        <div className="bg-card rounded-xl card-shadow p-6 text-sm text-muted-foreground">
          You do not have permission to view week offs.
        </div>
      )}
      {canView && (
        <div className="bg-card rounded-xl card-shadow p-6 max-w-3xl">
        <p className="text-sm text-muted-foreground mb-4">
          Select the weekly off days for your organization.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {DAYS.map((day) => (
            <label key={day.value} className="flex items-center gap-3">
              <Checkbox
                checked={weekOffDays.includes(day.value)}
                onCheckedChange={() => toggleDay(day.value)}
                disabled={!canManage}
              />
              <span>{day.label}</span>
            </label>
          ))}
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={fetchConfig}>
            Refresh
          </Button>
          <PermissionGate permissions={["WEEK_OFF_MANAGE"]}>
            <Button onClick={saveConfig} disabled={loading}>
              Save
            </Button>
          </PermissionGate>
        </div>
      </div>
      )}
    </MainLayout>
  );
};

export default WeekOffs;
