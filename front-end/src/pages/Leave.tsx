import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  Search,
  Download,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Palmtree,
  Stethoscope,
  Briefcase
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
  TableRow
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { getApiWithToken, postApiWithToken, putApiWithToken } from "@/services/apiWrapper";
import { toast } from "sonner";
import PermissionGate from "@/components/PermissionGate";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";

const getStatusBadge = (status: string) => {
  switch (status) {
    case "approved":
      return (
        <Badge className="status-badge status-active gap-1">
          <CheckCircle className="w-3 h-3" /> Approved
        </Badge>
      );
    case "pending":
      return (
        <Badge className="status-badge status-pending gap-1">
          <Clock className="w-3 h-3" /> Pending
        </Badge>
      );
    case "rejected":
      return (
        <Badge className="status-badge status-rejected gap-1">
          <XCircle className="w-3 h-3" /> Rejected
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status || "-"}</Badge>;
  }
};

const getLeaveTypeIcon = (type: string) => {
  switch (type) {
    case "Vacation":
      return <Palmtree className="w-4 h-4 text-green-600" />;
    case "Sick Leave":
      return <Stethoscope className="w-4 h-4 text-red-600" />;
    case "Business Trip":
      return <Briefcase className="w-4 h-4 text-blue-600" />;
    default:
      return null;
  }
};

const toActorName = (employee: any) => {
  if (!employee) return "-";
  const full = `${employee.firstName || ""} ${employee.lastName || ""}`.trim();
  return employee.employeeCode ? `${full || "Employee"} (${employee.employeeCode})` : full || "Employee";
};

const getStepApproverLabel = (step: any) => {
  if (!step) return "-";
  if (step.approverType === "manager") return "Reporting Manager";
  if (step.approverType === "role") return step.approverRoleSlug ? `Role: ${step.approverRoleSlug}` : "Role";
  return step.approverEmployeeId ? `Employee: ${toActorName(step.approverEmployeeId)}` : "Employee";
};

const getApprovalProgressLabel = (record: any) => {
  const steps = Array.isArray(record?.approvalSteps) ? record.approvalSteps : [];
  if (!steps.length) return "Single-step";
  const pending = steps.find((s: any) => s.status === "pending");
  if (record?.status === "approved") return `Completed (${steps.length} steps)`;
  if (record?.status === "rejected") {
    const rejectedStep = steps.find((s: any) => s.status === "rejected");
    return rejectedStep ? `Rejected at S${rejectedStep.stepNumber}` : "Rejected";
  }
  if (!pending) return "Pending";
  return `S${pending.stepNumber}/${steps.length} • ${getStepApproverLabel(pending)}`;
};

const toIdString = (value: any) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value._id) return String(value._id);
  return String(value);
};

const Leave = () => {
  const { hasAnyPermission, profile } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<any | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject">("approve");
  const [comment, setComment] = useState("");
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"all" | "my">("all");
  const [applyOpen, setApplyOpen] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [applyForm, setApplyForm] = useState({
    leaveTypeId: "",
    fromDate: "",
    toDate: "",
    reason: ""
  });
  const canViewAll = hasAnyPermission(["LEAVE_VIEW_ALL"]);
  const canViewSelf = hasAnyPermission(["LEAVE_VIEW_SELF"]);
  const canViewAny = canViewAll || canViewSelf;
  const canApply = hasAnyPermission(["LEAVE_APPLY"]);
  const canAction = hasAnyPermission(["LEAVE_ACTION"]);
  const currentEmployeeId = toIdString(profile?.employeeId);
  const currentRoleSlug = profile?.activeRole?.slug || "";

  const canCurrentActorActionLeave = (leave: any) => {
    const steps = Array.isArray(leave?.approvalSteps) ? leave.approvalSteps : [];
    if (!steps.length) return true;
    const pendingStep = steps.find((s: any) => s.status === "pending");
    if (!pendingStep) return false;

    if (pendingStep.approverType === "role") {
      return Boolean(pendingStep.approverRoleSlug && currentRoleSlug === pendingStep.approverRoleSlug);
    }
    const stepEmployeeId = toIdString(pendingStep.approverEmployeeId);
    return Boolean(stepEmployeeId && currentEmployeeId && stepEmployeeId === currentEmployeeId);
  };

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      if (!canViewAny) {
        setLeaves([]);
        setViewMode("my");
        return;
      }

      let res = await getApiWithToken("/leaves", null, {
        requiredPermissions: ["LEAVE_VIEW_ALL"]
      });
      if (res?.skipped) {
        res = null;
      } else if (res?.success) {
        setLeaves(res?.data || []);
        setViewMode("all");
        return;
      }

      // fallback to my leaves (for employee role)
      res = await getApiWithToken("/leaves/my", null, {
        requiredPermissions: ["LEAVE_VIEW_SELF"]
      });
      if (res?.skipped) {
        setLeaves([]);
        setViewMode("my");
        return;
      }
      if (res?.success) {
        setLeaves(res?.data || []);
        setViewMode("my");
      } else {
        toast.error(res?.message || "Failed to load leaves");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  const fetchLeaveTypes = async () => {
    let res = await getApiWithToken("/employees/leave-types");
    if (!res?.success) {
      res = await getApiWithToken("/leave-types", null, {
        requiredPermissions: ["LEAVE_TYPE_VIEW"]
      });
    }
    if (res?.success) {
      setLeaveTypes(res?.data || []);
    }
  };

  useEffect(() => {
    fetchLeaveTypes();
  }, []);

  const submitApply = async () => {
    if (!applyForm.leaveTypeId || !applyForm.fromDate || !applyForm.toDate) {
      toast.error("Leave type and dates are required");
      return;
    }

    const res = await postApiWithToken(
      "/leaves/apply",
      applyForm,
      null,
      { requiredPermissions: ["LEAVE_APPLY"] }
    );
    if (res?.skipped) return;
    if (res?.success) {
      toast.success("Leave applied");
      setApplyOpen(false);
      setApplyForm({
        leaveTypeId: "",
        fromDate: "",
        toDate: "",
        reason: ""
      });
      fetchLeaves();
    } else {
      toast.error(res?.message || "Apply failed");
    }
  };

  const filteredLeaves = useMemo(() => {
    return (leaves || []).filter((leave) => {
      const employeeName = leave.employeeId
        ? `${leave.employeeId.firstName || ""} ${leave.employeeId.lastName || ""}`.trim()
        : "You";
      const typeName = leave.leaveTypeId?.name || "";
      const matchesSearch =
        employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        typeName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || leave.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [leaves, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const pending = leaves.filter((l) => l.status === "pending").length;
    const approved = leaves.filter((l) => l.status === "approved").length;
    const rejected = leaves.filter((l) => l.status === "rejected").length;

    const today = new Date();
    const onLeaveToday = leaves.filter((l) => {
      if (l.status !== "approved") return false;
      const from = new Date(l.fromDate);
      const to = new Date(l.toDate);
      return today >= from && today <= to;
    }).length;

    return { pending, approved, rejected, onLeaveToday };
  }, [leaves]);

  const handleAction = (leave: any, action: "approve" | "reject") => {
    if (!canCurrentActorActionLeave(leave)) {
      toast.error("You are not the current approver for this request");
      return;
    }
    setSelectedLeave(leave);
    setActionType(action);
    setActionDialogOpen(true);
  };

  const handleView = (leave: any) => {
    setSelectedLeave(leave);
    setViewDialogOpen(true);
  };

  const confirmAction = async () => {
    if (!selectedLeave) return;
    if (!canAction) {
      toast.error("You do not have permission to take action");
      return;
    }

    const payload: any = {
      status: actionType === "approve" ? "approved" : "rejected",
    };
    if (actionType === "reject") {
      payload.rejectionReason = comment || "Rejected";
    }

    const res = await putApiWithToken(
      `/leaves/${selectedLeave._id}/action`,
      payload,
      null,
      { requiredPermissions: ["LEAVE_ACTION"] }
    );
    if (res?.skipped) return;
    if (res?.success) {
      toast.success(`Leave ${payload.status}`);
      setActionDialogOpen(false);
      setSelectedLeave(null);
      setComment("");
      fetchLeaves();
    } else {
      toast.error(res?.message || "Action failed");
    }
  };

  return (
    <MainLayout
      title="Leave Management"
      breadcrumb={[{ label: "Home", href: "/" }, { label: "Leave" }]}
    >
      {!canViewAny && !canApply && (
        <div className="bg-card rounded-xl card-shadow p-6 text-sm text-muted-foreground">
          You do not have permission to view or apply leave.
        </div>
      )}
      {/* Stats Cards */}
      {canViewAny && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <motion.div
          className="stat-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-sm text-muted-foreground mb-1">Pending Requests</p>
          <p className="text-3xl font-bold text-warning">{stats.pending}</p>
          <p className="text-sm text-muted-foreground mt-1">requires action</p>
        </motion.div>
        <motion.div
          className="stat-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <p className="text-sm text-muted-foreground mb-1">Approved</p>
          <p className="text-3xl font-bold text-success">{stats.approved}</p>
          <p className="text-sm text-muted-foreground mt-1">total</p>
        </motion.div>
        <motion.div
          className="stat-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <p className="text-sm text-muted-foreground mb-1">Rejected</p>
          <p className="text-3xl font-bold text-destructive">{stats.rejected}</p>
          <p className="text-sm text-muted-foreground mt-1">total</p>
        </motion.div>
        <motion.div
          className="stat-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <p className="text-sm text-muted-foreground mb-1">On Leave Today</p>
          <p className="text-3xl font-bold text-primary">{stats.onLeaveToday}</p>
          <p className="text-sm text-muted-foreground mt-1">employees</p>
        </motion.div>
        </div>
      )}

      {/* Action Bar */}
      {canViewAny && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search leaves..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          {/* <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button> */}
          <Button variant="outline" className="gap-2" onClick={fetchLeaves}>
            Refresh
          </Button>
          <PermissionGate permissions={["LEAVE_APPLY"]}>
            <Button className="gap-2" onClick={() => navigate("/leave/apply")}>
              Apply Leave
            </Button>
          </PermissionGate>
        </div>
        </div>
      )}

      {/* Leave Table */}
      {canViewAny && (
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
              <TableHead>Leave Type</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Approval</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10">
                  Loading...
                </TableCell>
              </TableRow>
            )}
            {!loading && filteredLeaves.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10">
                  No leave requests found
                </TableCell>
              </TableRow>
            )}
            {filteredLeaves.map((leave) => {
              const employeeName = leave.employeeId
                ? `${leave.employeeId.firstName || ""} ${leave.employeeId.lastName || ""}`.trim()
                : "You";
              return (
                <TableRow key={leave._id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src="" />
                        <AvatarFallback>
                          {(employeeName || "U")
                            .split(" ")
                            .map((n: string) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{employeeName}</p>
                        <p className="text-sm text-muted-foreground">
                          {leave.employeeId?.employeeCode || "SELF"}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getLeaveTypeIcon(leave.leaveTypeId?.name)}
                      {leave.leaveTypeId?.name || "-"}
                    </div>
                  </TableCell>
                  <TableCell>
                    {leave.fromDate ? new Date(leave.fromDate).toLocaleDateString() : "-"}
                  </TableCell>
                  <TableCell>
                    {leave.toDate ? new Date(leave.toDate).toLocaleDateString() : "-"}
                  </TableCell>
                  <TableCell>{leave.totalDays ?? "-"}</TableCell>
                  <TableCell>{getStatusBadge(leave.status)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[280px]">
                    {getApprovalProgressLabel(leave)}
                  </TableCell>
                  <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleView(leave)}>
                            <Eye className="w-4 h-4 mr-2" /> View
                          </DropdownMenuItem>
                          {canAction && viewMode === "all" && leave.status === "pending" && canCurrentActorActionLeave(leave) && (
                            <>
                              <DropdownMenuItem onClick={() => handleAction(leave, "approve")}>
                                <CheckCircle className="w-4 h-4 mr-2 text-green-600" /> Approve
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAction(leave, "reject")}>
                                <XCircle className="w-4 h-4 mr-2 text-red-600" /> Reject
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </motion.div>
      )}

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" ? "Approve Leave" : "Reject Leave"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "approve"
                ? "Confirm approval for this leave request."
                : "Provide a reason for rejection."}
            </DialogDescription>
          </DialogHeader>

          {actionType === "reject" && (
            <div className="space-y-2">
              <Label>Rejection Reason</Label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Enter reason"
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmAction}>
              {actionType === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave Details</DialogTitle>
          </DialogHeader>
          {selectedLeave && (
            <div className="space-y-2 text-sm">
              <p><span className="font-medium">Employee:</span> {selectedLeave.employeeId
                ? `${selectedLeave.employeeId.firstName || ""} ${selectedLeave.employeeId.lastName || ""}`.trim()
                : "You"}</p>
              <p><span className="font-medium">Leave Type:</span> {selectedLeave.leaveTypeId?.name || "-"}</p>
              <p><span className="font-medium">From:</span> {selectedLeave.fromDate ? new Date(selectedLeave.fromDate).toLocaleDateString() : "-"}</p>
              <p><span className="font-medium">To:</span> {selectedLeave.toDate ? new Date(selectedLeave.toDate).toLocaleDateString() : "-"}</p>
              <p><span className="font-medium">Days:</span> {selectedLeave.totalDays ?? "-"}</p>
              <p><span className="font-medium">Status:</span> {selectedLeave.status || "-"}</p>
              <p><span className="font-medium">Approval:</span> {getApprovalProgressLabel(selectedLeave)}</p>
              <p><span className="font-medium">Reason:</span> {selectedLeave.reason || "-"}</p>
              {selectedLeave.rejectionReason && (
                <p><span className="font-medium">Rejection Reason:</span> {selectedLeave.rejectionReason}</p>
              )}
              {Array.isArray(selectedLeave.approvalSteps) && selectedLeave.approvalSteps.length > 0 && (
                <div className="pt-2">
                  <p className="font-medium mb-1">Approval Steps</p>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {[...selectedLeave.approvalSteps]
                      .sort((a: any, b: any) => Number(a.stepNumber) - Number(b.stepNumber))
                      .map((step: any) => (
                        <div key={`leave-step-${selectedLeave._id}-${step.stepNumber}`}>
                          {`S${step.stepNumber} • ${getStepApproverLabel(step)} • ${step.status}${step.actionBy ? ` • by ${toActorName(step.actionBy)}` : ""}`}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply Leave Dialog */}
      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Leave</DialogTitle>
            <DialogDescription>Submit a new leave request.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Leave Type</Label>
              <Select
                value={applyForm.leaveTypeId}
                onValueChange={(value) =>
                  setApplyForm({ ...applyForm, leaveTypeId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes.map((lt) => (
                    <SelectItem key={lt._id} value={lt._id}>
                      {lt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>From Date</Label>
                <Input
                  type="date"
                  value={applyForm.fromDate}
                  onChange={(e) =>
                    setApplyForm({ ...applyForm, fromDate: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>To Date</Label>
                <Input
                  type="date"
                  value={applyForm.toDate}
                  onChange={(e) =>
                    setApplyForm({ ...applyForm, toDate: e.target.value })
                  }
                />
              </div>
            </div>

            <div>
              <Label>Reason</Label>
              <Textarea
                value={applyForm.reason}
                onChange={(e) =>
                  setApplyForm({ ...applyForm, reason: e.target.value })
                }
                placeholder="Optional reason"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitApply}>Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Leave;
