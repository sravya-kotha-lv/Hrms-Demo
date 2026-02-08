import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getApiWithToken, postApiWithToken } from "@/services/apiWrapper";
import { toast } from "sonner";
import PermissionGate from "@/components/PermissionGate";
import { hasPermission } from "@/utils/auth";

const OrganizationSettings = () => {
  const [leaveCreditFrequency, setLeaveCreditFrequency] = useState("monthly");
  const [loading, setLoading] = useState(false);
  const canManage = hasPermission("ORG_SETTINGS_MANAGE");

  const fetchSettings = async () => {
    const res = await getApiWithToken("/org-settings");
    if (res?.success) {
      setLeaveCreditFrequency(res.data?.leaveCreditFrequency || "monthly");
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
      const res = await postApiWithToken("/org-settings", { leaveCreditFrequency });
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

        <PermissionGate permissions={["ORG_SETTINGS_MANAGE"]}>
          <Button onClick={saveSettings} disabled={loading}>Save</Button>
        </PermissionGate>
      </div>
    </MainLayout>
  );
};

export default OrganizationSettings;
