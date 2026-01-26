import { useState } from "react";
import { motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { 
  Search, Filter, Download, Plus, MoreHorizontal, 
  Edit, CheckCircle, XCircle, Clock
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

const attendanceData = [
  {
    id: 1,
    employee: {
      name: "Sarah Wilson",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
    },
    date: "2024-01-26",
    checkIn: "09:02 AM",
    checkOut: "06:15 PM",
    totalHours: "9h 13m",
    status: "Present",
  },
  {
    id: 2,
    employee: {
      name: "Michael Chen",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
    },
    date: "2024-01-26",
    checkIn: "09:30 AM",
    checkOut: "06:00 PM",
    totalHours: "8h 30m",
    status: "Late",
  },
  {
    id: 3,
    employee: {
      name: "Emily Rodriguez",
      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop",
    },
    date: "2024-01-26",
    checkIn: "-",
    checkOut: "-",
    totalHours: "-",
    status: "Absent",
  },
  {
    id: 4,
    employee: {
      name: "James Anderson",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop",
    },
    date: "2024-01-26",
    checkIn: "08:45 AM",
    checkOut: "05:30 PM",
    totalHours: "8h 45m",
    status: "Present",
  },
  {
    id: 5,
    employee: {
      name: "Lisa Thompson",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop",
    },
    date: "2024-01-26",
    checkIn: "09:00 AM",
    checkOut: "06:00 PM",
    totalHours: "9h 00m",
    status: "Present",
  },
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case "Present":
      return (
        <Badge className="status-badge status-active gap-1">
          <CheckCircle className="w-3 h-3" /> Present
        </Badge>
      );
    case "Late":
      return (
        <Badge className="status-badge status-pending gap-1">
          <Clock className="w-3 h-3" /> Late
        </Badge>
      );
    case "Absent":
      return (
        <Badge className="status-badge status-rejected gap-1">
          <XCircle className="w-3 h-3" /> Absent
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

const Attendance = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("today");

  return (
    <MainLayout
      title="Attendance"
      breadcrumb={[{ label: "Home", href: "/" }, { label: "Attendance" }]}
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <motion.div
          className="stat-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-sm text-muted-foreground mb-1">Today's Attendance</p>
          <p className="text-3xl font-bold text-primary">92%</p>
          <p className="text-sm text-success mt-1">+2% from yesterday</p>
        </motion.div>
        <motion.div
          className="stat-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <p className="text-sm text-muted-foreground mb-1">Present</p>
          <p className="text-3xl font-bold text-success">228</p>
          <p className="text-sm text-muted-foreground mt-1">employees</p>
        </motion.div>
        <motion.div
          className="stat-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <p className="text-sm text-muted-foreground mb-1">Late</p>
          <p className="text-3xl font-bold text-warning">12</p>
          <p className="text-sm text-muted-foreground mt-1">employees</p>
        </motion.div>
        <motion.div
          className="stat-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <p className="text-sm text-muted-foreground mb-1">Absent</p>
          <p className="text-3xl font-bold text-destructive">8</p>
          <p className="text-sm text-muted-foreground mt-1">employees</p>
        </motion.div>
      </div>

      {/* Action Bar */}
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
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Add Attendance
          </Button>
        </div>
      </div>

      {/* Attendance Table */}
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
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attendanceData.map((record, index) => (
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
                <TableCell className="text-muted-foreground">
                  {new Date(record.date).toLocaleDateString('en-US', { 
                    weekday: 'short',
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </TableCell>
                <TableCell className="font-mono">{record.checkIn}</TableCell>
                <TableCell className="font-mono">{record.checkOut}</TableCell>
                <TableCell className="font-medium">{record.totalHours}</TableCell>
                <TableCell>{getStatusBadge(record.status)}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="p-2 rounded hover:bg-muted transition-colors">
                      <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="gap-2">
                        <Edit className="w-4 h-4" /> Edit
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </motion.tr>
            ))}
          </TableBody>
        </Table>
      </motion.div>
    </MainLayout>
  );
};

export default Attendance;
