import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiWithToken, putApiWithToken } from "@/services/apiWrapper";
import { useAuth } from "@/context/useAuth";
import { toast } from "sonner";
import { formatDateInOrgTimeZone, formatDateKeyInOrgCalendar, toDateKeyInOrgCalendar } from "@/utils/timezone";

const toIdString = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.every((item) => Number.isInteger(item))) {
    return value.map((item) => Number(item).toString(16).padStart(2, "0")).join("");
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record._actionId === "string") return record._actionId;
    if (record._id) return toIdString(record._id);
    if (record.id) return toIdString(record.id);
    if (typeof record.$oid === "string") return record.$oid;
    if (record.buffer) return toIdString(record.buffer);
    if (record.type === "Buffer" && record.data) return toIdString(record.data);
    if (Array.isArray(record.data)) return toIdString(record.data);
    if (typeof (record as { toHexString?: unknown }).toHexString === "function") {
      return String((record as { toHexString: () => string }).toHexString());
    }
    if (typeof record.toString === "function" && record.toString !== Object.prototype.toString) {
      const asString = record.toString();
      if (asString && asString !== "[object Object]") return asString;
    }
  }
  return String(value);
};

const getAttendanceRequestId = (request: any) => toIdString(request?._actionId || request?._id || request?.id || request);

const normalizeAttendanceRequestRecord = (row: any) => {
  const requestId = getAttendanceRequestId(row);
  return {
    ...row,
    date: row?.date ? toDateKeyInOrgCalendar(row.date) : row?.date,
    _id: requestId,
    _actionId: requestId
  };
};

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
  const [refreshing, setRefreshing] = useState(false);

  const loadLeaveApprovals = async () => {
    if (!canLeaveAction) {
      setLeaveRows([]);
      return;
    }
    const leaveRes = await getApiWithToken("/leaves/pending/my-approvals", null, {
      requiredPermissions: ["LEAVE_ACTION"]
    });
    if (leaveRes?.success) {
      setLeaveRows(leaveRes.data || []);
    } else {
      setLeaveRows([]);
    }
  };

  const loadAttendanceApprovals = async () => {
    if (!canAttendanceAction) {
      setAttendanceRows([]);
      return;
    }
    const attendanceRes = await getApiWithToken("/timesheets/attendance/requests/pending/my-approvals", null, {
      requiredPermissions: ["ATTENDANCE_MANAGE"]
    });
    if (attendanceRes?.success) {
      setAttendanceRows(
        (attendanceRes.data || []).map((row: any) => normalizeAttendanceRequestRecord(row))
      );
    } else {
      setAttendanceRows([]);
    }
  };

  const loadData = async () => {
    if (!canViewAny) return;
    setLoading(true);
    try {
      await Promise.allSettled([loadLeaveApprovals(), loadAttendanceApprovals()]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [canLeaveAction, canAttendanceAction, canViewAny]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  };

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

  const actionAttendance = async (requestRow: any, status: "approved" | "rejected") => {
    const id = getAttendanceRequestId(requestRow);
    if (!id || id === "[object Object]") {
      toast.error("Invalid attendance request id");
      return;
    }
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
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleRefresh}
              disabled={loading || refreshing}
            >
              <RefreshCw className={`w-4 h-4 ${loading || refreshing ? "animate-spin" : ""}`} />
              {loading || refreshing ? "Refreshing..." : "Refresh"}
            </Button>
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
                  {loading && Array.from({ length: 4 }).map((_, idx) => (
                    <TableRow key={`leave-approval-skeleton-${idx}`}>
                      {Array.from({ length: 6 }).map((__, colIdx) => (
                        <TableCell key={colIdx}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {!loading && leaveRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-muted-foreground">
                        No leave approvals assigned.
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && leaveRows.map((row) => (
                    <TableRow key={row._id} className="table-row-hover">
                      <TableCell>
                        {row.employeeId
                          ? `${row.employeeId.firstName || ""} ${row.employeeId.lastName || ""}`.trim()
                          : "-"}
                      </TableCell>
                      <TableCell>{row.leaveTypeId?.name || "-"}</TableCell>
                      <TableCell>{row.fromDate ? formatDateInOrgTimeZone(row.fromDate) : "-"}</TableCell>
                      <TableCell>{row.toDate ? formatDateInOrgTimeZone(row.toDate) : "-"}</TableCell>
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
                  {loading && Array.from({ length: 4 }).map((_, idx) => (
                    <TableRow key={`attendance-approval-skeleton-${idx}`}>
                      {Array.from({ length: 6 }).map((__, colIdx) => (
                        <TableCell key={colIdx}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {!loading && attendanceRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-muted-foreground">
                        No attendance approvals assigned.
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && attendanceRows.map((row) => (
                    <TableRow key={row._actionId || row._id || row.id} className="table-row-hover">
                      <TableCell>
                        {row.employeeId
                          ? `${row.employeeId.firstName || ""} ${row.employeeId.lastName || ""}`.trim()
                          : "-"}
                      </TableCell>
                      <TableCell>{formatDateKeyInOrgCalendar(row.date)}</TableCell>
                      <TableCell className="capitalize">{String(row.requestType || "").replace("_", " ")}</TableCell>
                      <TableCell>{row.requestedCheckInTime || "-"} / {row.requestedCheckOutTime || "-"}</TableCell>
                      <TableCell>{getStatusBadge(row.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => actionAttendance(row, "approved")}>Approve</Button>
                          <Button size="sm" variant="outline" onClick={() => actionAttendance(row, "rejected")}>Reject</Button>
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
