import { MainLayout } from "@/components/layout/MainLayout";
import { motion } from "framer-motion";
import { CalendarCheck, Timer, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const EmployeeDashboard = () => {
  const navigate = useNavigate();

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
          <div className="text-2xl font-semibold">This Week</div>
          <p className="text-sm text-muted-foreground mt-1">Track your daily hours</p>
          <Button className="mt-4" onClick={() => navigate("/timesheets")}>View Timesheet</Button>
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
          <div className="text-2xl font-semibold">Check In</div>
          <p className="text-sm text-muted-foreground mt-1">Mark your day status</p>
          <Button className="mt-4" variant="outline" onClick={() => navigate("/timesheets")}>Go to Check In</Button>
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
          <div className="text-2xl font-semibold">Requests</div>
          <p className="text-sm text-muted-foreground mt-1">Apply or track status</p>
          <Button className="mt-4" variant="outline" onClick={() => navigate("/leave")}>Open Leave</Button>
        </motion.div>
      </div>
    </MainLayout>
  );
};

export default EmployeeDashboard;
