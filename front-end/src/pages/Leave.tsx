import { useState } from "react";
import { motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { 
  Search, Filter, Download, Plus, MoreHorizontal, 
  CheckCircle, XCircle, Clock, Eye, Palmtree, Stethoscope, Briefcase
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const leaveData = [
  {
    id: 1,
    employee: {
      name: "Sarah Wilson",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
    },
    leaveType: "Vacation",
    startDate: "2024-02-01",
    endDate: "2024-02-05",
    days: 5,
    reason: "Family vacation",
    status: "Pending",
  },
  {
    id: 2,
    employee: {
      name: "Michael Chen",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
    },
    leaveType: "Sick Leave",
    startDate: "2024-01-28",
    endDate: "2024-01-29",
    days: 2,
    reason: "Doctor's appointment",
    status: "Approved",
  },
  {
    id: 3,
    employee: {
      name: "Emily Rodriguez",
      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop",
    },
    leaveType: "Business Trip",
    startDate: "2024-02-10",
    endDate: "2024-02-14",
    days: 5,
    reason: "Client meeting in New York",
    status: "Pending",
  },
  {
    id: 4,
    employee: {
      name: "James Anderson",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop",
    },
    leaveType: "Vacation",
    startDate: "2024-01-15",
    endDate: "2024-01-17",
    days: 3,
    reason: "Personal time off",
    status: "Rejected",
  },
  {
    id: 5,
    employee: {
      name: "Lisa Thompson",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop",
    },
    leaveType: "Sick Leave",
    startDate: "2024-01-26",
    endDate: "2024-01-26",
    days: 1,
    reason: "Not feeling well",
    status: "Approved",
  },
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case "Approved":
      return (
        <Badge className="status-badge status-active gap-1">
          <CheckCircle className="w-3 h-3" /> Approved
        </Badge>
      );
    case "Pending":
      return (
        <Badge className="status-badge status-pending gap-1">
          <Clock className="w-3 h-3" /> Pending
        </Badge>
      );
    case "Rejected":
      return (
        <Badge className="status-badge status-rejected gap-1">
          <XCircle className="w-3 h-3" /> Rejected
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
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

const Leave = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<typeof leaveData[0] | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject">("approve");
  const [comment, setComment] = useState("");

  const handleAction = (leave: typeof leaveData[0], action: "approve" | "reject") => {
    setSelectedLeave(leave);
    setActionType(action);
    setActionDialogOpen(true);
  };

  const confirmAction = () => {
    console.log(`${actionType} leave for ${selectedLeave?.employee.name}:`, comment);
    setActionDialogOpen(false);
    setSelectedLeave(null);
    setComment("");
  };

  return (
    <MainLayout
      title="Leave Management"
      breadcrumb={[{ label: "Home", href: "/" }, { label: "Leave" }]}
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <motion.div
          className="stat-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-sm text-muted-foreground mb-1">Pending Requests</p>
          <p className="text-3xl font-bold text-warning">8</p>
          <p className="text-sm text-muted-foreground mt-1">requires action</p>
        </motion.div>
        <motion.div
          className="stat-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <p className="text-sm text-muted-foreground mb-1">Approved</p>
          <p className="text-3xl font-bold text-success">24</p>
          <p className="text-sm text-muted-foreground mt-1">this month</p>
        </motion.div>
        <motion.div
          className="stat-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <p className="text-sm text-muted-foreground mb-1">Rejected</p>
          <p className="text-3xl font-bold text-destructive">3</p>
          <p className="text-sm text-muted-foreground mt-1">this month</p>
        </motion.div>
        <motion.div
          className="stat-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <p className="text-sm text-muted-foreground mb-1">On Leave Today</p>
          <p className="text-3xl font-bold text-primary">5</p>
          <p className="text-sm text-muted-foreground mt-1">employees</p>
        </motion.div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search leave requests..."
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
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Apply Leave
          </Button>
        </div>
      </div>

      {/* Leave Table */}
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
              <TableHead>Date Range</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaveData.map((record, index) => (
              <motion.tr
                key={record.id}
                className="table-row-hover"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + index * 0.05 }}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={record.employee.avatar} alt={record.employee.name} />
                      <AvatarFallback>{record.employee.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{record.employee.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getLeaveTypeIcon(record.leaveType)}
                    <span>{record.leaveType}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(record.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {" - "}
                  {new Date(record.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </TableCell>
                <TableCell className="font-medium">{record.days}</TableCell>
                <TableCell className="max-w-[200px] truncate text-muted-foreground">
                  {record.reason}
                </TableCell>
                <TableCell>{getStatusBadge(record.status)}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="p-2 rounded hover:bg-muted transition-colors">
                      <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="gap-2">
                        <Eye className="w-4 h-4" /> View Details
                      </DropdownMenuItem>
                      {record.status === "Pending" && (
                        <>
                          <DropdownMenuItem 
                            className="gap-2 text-success"
                            onClick={() => handleAction(record, "approve")}
                          >
                            <CheckCircle className="w-4 h-4" /> Approve
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="gap-2 text-destructive"
                            onClick={() => handleAction(record, "reject")}
                          >
                            <XCircle className="w-4 h-4" /> Reject
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </motion.tr>
            ))}
          </TableBody>
        </Table>
      </motion.div>

      {/* Approve/Reject Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" ? "Approve" : "Reject"} Leave Request
            </DialogTitle>
            <DialogDescription>
              {actionType === "approve" 
                ? `Approve ${selectedLeave?.employee.name}'s leave request?`
                : `Reject ${selectedLeave?.employee.name}'s leave request?`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="comment" className="form-label">Comment (Optional)</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment..."
              className="form-input"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant={actionType === "approve" ? "default" : "destructive"} 
              onClick={confirmAction}
            >
              {actionType === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Leave;
