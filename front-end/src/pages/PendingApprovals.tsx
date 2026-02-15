import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { getApiWithToken, putApiWithToken } from "@/services/apiWrapper";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const getStatusBadge = (status: string) => {
  if (status === "approved") return <Badge className="status-badge status-active">Approved</Badge>;
  if (status === "rejected") return <Badge className="status-badge status-rejected">Rejected</Badge>;
  return <Badge className="status-badge status-pending">Pending</Badge>;
};

const PendingApprovals = () => {
  const { hasAnyPermission } = useAuth();
  const canLeaveAction = hasAnyPermission(["LEAVE_ACTION"]);
  const canAttendanceAction = hasAnyPermission(["ATTENDANCE_MANAGE"]);
  const canViewAny = canLeaveAction || canAttendanceAction;

  const [leaveRows, setLeaveRows] = useState<any[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    if (!canViewAny) return;
    setLoading(true);
    try {
      if (canLeaveAction) {
        const leaveRes = await getApiWithToken("/leaves/pending/my-approvals", null, {
          requiredPermissions: ["LEAVE_ACTION"]
        });
        if (leaveRes?.success) {
          setLeaveRows(leaveRes.data || []);
        } else {
          setLeaveRows([]);
        }
      } else {
        setLeaveRows([]);
      }

      if (canAttendanceAction) {
        const attendanceRes = await getApiWithToken("/timesheets/attendance/requests/pending/my-approvals", null, {
          requiredPermissions: ["ATTENDANCE_MANAGE"]
        });
        if (attendanceRes?.success) {
          setAttendanceRows(attendanceRes.data || []);
        } else {
          setAttendanceRows([]);
        }
      } else {
        setAttendanceRows([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const actionLeave = async (id: string, status: "approved" | "rejected") => {
    const rejectionReason = status === "rejected"
      ? (window.prompt("Enter rejection reason") || "").trim()
      : "";
    if (status === "rejected" && !rejectionReason) return;

    const res = await putApiWithToken(
      `/leaves/${id}/action`,
      {
        status,
        rejectionReason
      },
      null,
      { requiredPermissions: ["LEAVE_ACTION"] }
    );
    if (res?.success) {
      toast.success(`Leave ${status}`);
      loadData();
    } else {
      toast.error(res?.message || "Failed to action leave");
    }
  };

  const actionAttendance = async (id: string, status: "approved" | "rejected") => {
    const rejectionReason = status === "rejected"
      ? (window.prompt("Enter rejection reason") || "").trim()
      : "";
    if (status === "rejected" && !rejectionReason) return;

    const res = await putApiWithToken(
      `/timesheets/attendance/requests/${id}/action`,
      {
        status,
        rejectionReason
      },
      null,
      { requiredPermissions: ["ATTENDANCE_MANAGE"] }
    );
    if (res?.success) {
      toast.success(`Attendance request ${status}`);
      loadData();
    } else {
      toast.error(res?.message || "Failed to action attendance request");
    }
  };

  return (
    <MainLayout
      title="Pending Approvals"
      breadcrumb={[{ label: "Home", href: "/" }, { label: "Pending Approvals" }]}
    >
      {!canViewAny && (
        <div className="bg-card rounded-xl card-shadow p-6 text-sm text-muted-foreground">
          You do not have permission to view approvals.
        </div>
      )}

      {canViewAny && (
        <>
          <div className="flex justify-end mb-4">
            <Button variant="outline" onClick={loadData}>Refresh</Button>
          </div>

          {canLeaveAction && (
            <div className="bg-card rounded-xl card-shadow overflow-hidden mb-8">
              <div className="px-6 py-4 border-b border-border">
                <h3 className="text-lg font-semibold">Leave Approvals Assigned To Me</h3>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="table-header">
                    <TableHead>Employee</TableHead>
                    <TableHead>Leave Type</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!loading && leaveRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-muted-foreground">
                        No leave approvals assigned.
                      </TableCell>
                    </TableRow>
                  )}
                  {leaveRows.map((row) => (
                    <TableRow key={row._id} className="table-row-hover">
                      <TableCell>
                        {row.employeeId
                          ? `${row.employeeId.firstName || ""} ${row.employeeId.lastName || ""}`.trim()
                          : "-"}
                      </TableCell>
                      <TableCell>{row.leaveTypeId?.name || "-"}</TableCell>
                      <TableCell>{row.fromDate ? new Date(row.fromDate).toLocaleDateString() : "-"}</TableCell>
                      <TableCell>{row.toDate ? new Date(row.toDate).toLocaleDateString() : "-"}</TableCell>
                      <TableCell>{getStatusBadge(row.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => actionLeave(row._id, "approved")}>Approve</Button>
                          <Button size="sm" variant="outline" onClick={() => actionLeave(row._id, "rejected")}>Reject</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {canAttendanceAction && (
            <div className="bg-card rounded-xl card-shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-border">
                <h3 className="text-lg font-semibold">Attendance Approvals Assigned To Me</h3>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="table-header">
                    <TableHead>Employee</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Requested Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!loading && attendanceRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-muted-foreground">
                        No attendance approvals assigned.
                      </TableCell>
                    </TableRow>
                  )}
                  {attendanceRows.map((row) => (
                    <TableRow key={row._id} className="table-row-hover">
                      <TableCell>
                        {row.employeeId
                          ? `${row.employeeId.firstName || ""} ${row.employeeId.lastName || ""}`.trim()
                          : "-"}
                      </TableCell>
                      <TableCell>{new Date(row.date).toLocaleDateString()}</TableCell>
                      <TableCell className="capitalize">{String(row.requestType || "").replace("_", " ")}</TableCell>
                      <TableCell>{row.requestedCheckInTime || "-"} / {row.requestedCheckOutTime || "-"}</TableCell>
                      <TableCell>{getStatusBadge(row.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => actionAttendance(row._id, "approved")}>Approve</Button>
                          <Button size="sm" variant="outline" onClick={() => actionAttendance(row._id, "rejected")}>Reject</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </MainLayout>
  );
};

export default PendingApprovals;
