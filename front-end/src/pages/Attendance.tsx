import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  Search,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  Timer
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getApiWithToken } from "@/services/apiWrapper";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const getStatusBadge = (status: string) => {
  switch (status) {
    case "Present":
      return (
        <Badge className="status-badge status-active gap-1">
          <CheckCircle className="w-3 h-3" /> Present
        </Badge>
      );
    case "Working":
      return (
        <Badge className="status-badge status-pending gap-1">
          <Clock className="w-3 h-3" /> Working
        </Badge>
      );
    case "Week Off":
      return (
        <Badge variant="secondary" className="gap-1">
          <Timer className="w-3 h-3" /> Week Off
        </Badge>
      );
    default:
      return (
        <Badge className="status-badge status-rejected gap-1">
          <XCircle className="w-3 h-3" /> Absent
        </Badge>
      );
  }
};

const getRange = (filter: string) => {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (filter === "yesterday") {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1);
  } else if (filter === "this-week") {
    const day = start.getDay();
    const diff = (day + 6) % 7;
    start.setDate(start.getDate() - diff);
  } else if (filter === "this-month") {
    start.setDate(1);
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

const Attendance = () => {
  const { hasAnyPermission } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("today");
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [weekOffDays, setWeekOffDays] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const canView = hasAnyPermission(["TIMESHEET_VIEW_ALL"]);

  const fetchWeekOffs = async () => {
    const res = await getApiWithToken("/week-offs", null, {
      requiredPermissions: ["WEEK_OFF_VIEW"]
    });
    if (res?.skipped) return;
    if (res?.success) {
      setWeekOffDays(res.data?.weekOffDays || []);
    }
  };

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      if (!canView) {
        setAttendanceData([]);
        return;
      }
      const range = getRange(dateFilter);
      const startDate = range.start.toISOString();
      const endDate = range.end.toISOString();
      const res = await getApiWithToken(
        `/timesheets/attendance?startDate=${startDate}&endDate=${endDate}`,
        null,
        { requiredPermissions: ["TIMESHEET_VIEW_ALL"] }
      );
      if (res?.skipped) return;
      if (res?.success) {
        setAttendanceData(res.data || []);
      } else {
        toast.error(res?.message || "Failed to load attendance");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeekOffs();
  }, []);

  useEffect(() => {
    fetchAttendance();
  }, [dateFilter]);

  const filteredAttendance = useMemo(() => {
    return (attendanceData || []).filter((record) => {
      const name = record.employeeId
        ? `${record.employeeId.firstName || ""} ${record.employeeId.lastName || ""}`.trim()
        : "-";
      return name.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [attendanceData, searchQuery]);

  const stats = useMemo(() => {
    let present = 0;
    let working = 0;
    let weekOff = 0;

    attendanceData.forEach((record) => {
      const day = new Date(record.date).getDay();
      const isWeekOff = weekOffDays.includes(day);
      if (isWeekOff) {
        weekOff += 1;
      } else if (record.checkInAt && record.checkOutAt) {
        present += 1;
      } else if (record.checkInAt && !record.checkOutAt) {
        working += 1;
      }
    });

    return { present, working, weekOff };
  }, [attendanceData, weekOffDays]);

  return (
    <MainLayout
      title="Attendance"
      breadcrumb={[{ label: "Home", href: "/" }, { label: "Attendance" }]}
    >
      {!canView && (
        <div className="bg-card rounded-xl card-shadow p-6 text-sm text-muted-foreground">
          You do not have permission to view attendance.
        </div>
      )}
      {canView && (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <motion.div
          className="stat-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-sm text-muted-foreground mb-1">Present</p>
          <p className="text-3xl font-bold text-success">{stats.present}</p>
          <p className="text-sm text-muted-foreground mt-1">employees</p>
        </motion.div>
        <motion.div
          className="stat-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <p className="text-sm text-muted-foreground mb-1">Working</p>
          <p className="text-3xl font-bold text-warning">{stats.working}</p>
          <p className="text-sm text-muted-foreground mt-1">employees</p>
        </motion.div>
        <motion.div
          className="stat-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <p className="text-sm text-muted-foreground mb-1">Week Off</p>
          <p className="text-3xl font-bold text-primary">{stats.weekOff}</p>
          <p className="text-sm text-muted-foreground mt-1">records</p>
        </motion.div>
        <motion.div
          className="stat-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <p className="text-sm text-muted-foreground mb-1">Total Records</p>
          <p className="text-3xl font-bold text-primary">{attendanceData.length}</p>
          <p className="text-sm text-muted-foreground mt-1">this period</p>
        </motion.div>
      </div>
      )}

      {canView && (
        <>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="this-week">This Week</SelectItem>
                  <SelectItem value="this-month">This Month</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" className="gap-2">
                <Download className="w-4 h-4" />
                Export
              </Button>
            </div>
          </div>

          <motion.div
            className="bg-card rounded-xl card-shadow overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Table>
              <TableHeader>
                <TableRow className="table-header">
                  <TableHead>Employee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Check In</TableHead>
                  <TableHead>Check Out</TableHead>
                  <TableHead>Total Hours</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                )}
                {!loading && filteredAttendance.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      No attendance records found.
                    </TableCell>
                  </TableRow>
                )}
                {filteredAttendance.map((record) => {
                  const date = new Date(record.date);
                  const isWeekOff = weekOffDays.includes(date.getDay());
                  const status = isWeekOff
                    ? "Week Off"
                    : record.checkInAt && record.checkOutAt
                      ? "Present"
                      : record.checkInAt
                        ? "Working"
                        : "Absent";

                  const totalHours = record.totalMinutes
                    ? `${Math.floor(record.totalMinutes / 60)}h ${record.totalMinutes % 60}m`
                    : "-";

                  return (
                    <TableRow
                      key={record._id}
                      className={`table-row-hover ${isWeekOff ? "opacity-60" : ""}`}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={record.employeeId?.avatar} alt={record.employeeId?.firstName} />
                            <AvatarFallback>
                              {(record.employeeId?.firstName || "").charAt(0)}
                              {(record.employeeId?.lastName || "").charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">
                            {record.employeeId
                              ? `${record.employeeId.firstName || ""} ${record.employeeId.lastName || ""}`.trim()
                              : "-"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {date.toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="font-mono">
                        {record.checkInAt ? new Date(record.checkInAt).toLocaleTimeString() : "-"}
                      </TableCell>
                      <TableCell className="font-mono">
                        {record.checkOutAt ? new Date(record.checkOutAt).toLocaleTimeString() : "-"}
                      </TableCell>
                      <TableCell className="font-medium">{totalHours}</TableCell>
                      <TableCell>{getStatusBadge(status)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </motion.div>
        </>
      )}
    </MainLayout>
  );
};

export default Attendance;
