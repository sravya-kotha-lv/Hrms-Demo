import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { motion } from "framer-motion";
import {
  CalendarCheck,
  Timer,
  ClipboardCheck,
  Users,
  CheckCircle,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { getApiWithToken } from "@/services/apiWrapper";
import PermissionGate from "@/components/PermissionGate";

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

const EmployeeDashboard = () => {
  const navigate = useNavigate();
  const [weeklyStatus, setWeeklyStatus] = useState<string | null>(null);
  const [weeklyHours, setWeeklyHours] = useState<number>(0);
  const [leaveCount, setLeaveCount] = useState<number>(0);
  const [onlineList, setOnlineList] = useState<any[]>([]);

  const weekStart = useMemo(() => getWeekStart(new Date()), []);

  useEffect(() => {
    const loadMyWeekly = async () => {
      const res = await getApiWithToken(
        `/timesheets/weekly/my?weekStart=${toDateInput(weekStart)}`,
        null,
        { requiredPermissions: ["TIMESHEET_VIEW_SELF"] }
      );
      if (res?.skipped) return;
      if (res?.success && res?.data) {
        setWeeklyStatus(res.data.status || "draft");
        const total = (res.data.entries || []).reduce(
          (sum: number, e: any) => sum + (Number(e.hours) || 0),
          0
        );
        setWeeklyHours(total);
      } else {
        setWeeklyStatus(null);
        setWeeklyHours(0);
      }
    };

    const loadMyLeaves = async () => {
      const res = await getApiWithToken("/leaves/my", null, {
        requiredPermissions: ["LEAVE_VIEW_SELF"]
      });
      if (res?.skipped) return;
      if (res?.success) {
        setLeaveCount((res.data || []).length);
      } else {
        setLeaveCount(0);
      }
    };

    const loadOnline = async () => {
      const res = await getApiWithToken("/timesheets/online", null, {
        requiredPermissions: ["TIMESHEET_VIEW_ONLINE"]
      });
      if (res?.skipped) return;
      if (res?.success) {
        setOnlineList(res.data || []);
      } else {
        setOnlineList([]);
      }
    };

    loadMyWeekly();
    loadMyLeaves();
    loadOnline();
  }, [weekStart]);

  return (
    <MainLayout title="My Dashboard" breadcrumb={[{ label: "Home" }, { label: "My Dashboard" }]}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          className="stat-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Timer className="w-4 h-4" />
            Timesheet
          </div>
          <div className="text-2xl font-semibold">
            {weeklyHours ? `${weeklyHours}h` : "This Week"}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {weeklyStatus ? `Status: ${weeklyStatus}` : "Track your daily hours"}
          </p>
          <PermissionGate permissions={["TIMESHEET_VIEW_SELF"]}>
            <Button className="mt-4" onClick={() => navigate("/timesheets")}>View Timesheet</Button>
          </PermissionGate>
        </motion.div>

        <motion.div
          className="stat-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <CalendarCheck className="w-4 h-4" />
            Attendance
          </div>
          <div className="text-2xl font-semibold">Check In / Out</div>
          <p className="text-sm text-muted-foreground mt-1">Mark your day status</p>
          <Button className="mt-4" variant="outline" onClick={() => navigate("/timesheets")}>Go to Attendance</Button>
        </motion.div>

        <motion.div
          className="stat-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <ClipboardCheck className="w-4 h-4" />
            Leave
          </div>
          <div className="text-2xl font-semibold">{leaveCount}</div>
          <p className="text-sm text-muted-foreground mt-1">My leave requests</p>
          <Button className="mt-4" variant="outline" onClick={() => navigate("/leave")}>Open Leave</Button>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        <PermissionGate permissions={["TIMESHEET_VIEW_SELF"]}>
          <motion.div
            className="stat-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <Clock className="w-4 h-4" />
              Timesheet Actions
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => navigate("/timesheets")}>Submit / Recall</Button>
              <Button variant="outline" onClick={() => navigate("/timesheets")}>View Timesheet</Button>
            </div>
          </motion.div>
        </PermissionGate>

        <PermissionGate permissions={["TIMESHEET_VIEW_ONLINE"]}>
          <motion.div
            className="stat-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <Users className="w-4 h-4" />
              Who is Online
            </div>
            <div className="space-y-2">
              {onlineList.length === 0 && (
                <p className="text-sm text-muted-foreground">No one online</p>
              )}
              {onlineList.slice(0, 6).map((item: any) => (
                <div key={item._id} className="flex items-center justify-between text-sm">
                  <span>
                    {item.employeeId?.firstName || ""} {item.employeeId?.lastName || ""}
                  </span>
                  <CheckCircle className="w-4 h-4 text-green-500" />
                </div>
              ))}
            </div>
          </motion.div>
        </PermissionGate>
      </div>
    </MainLayout>
  );
};

export default EmployeeDashboard;
