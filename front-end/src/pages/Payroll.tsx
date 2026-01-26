import { useState } from "react";
import { motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { 
  Search, Download, Eye, DollarSign, TrendingUp, Users, FileText
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const payrollData = [
  {
    id: 1,
    employee: {
      name: "Sarah Wilson",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
      role: "Senior Developer",
    },
    month: "January 2024",
    basicSalary: 8500,
    allowance: 1200,
    bonus: 500,
    deductions: 850,
    netPay: 9350,
    status: "Paid",
  },
  {
    id: 2,
    employee: {
      name: "Michael Chen",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
      role: "UI/UX Designer",
    },
    month: "January 2024",
    basicSalary: 7200,
    allowance: 1000,
    bonus: 300,
    deductions: 720,
    netPay: 7780,
    status: "Paid",
  },
  {
    id: 3,
    employee: {
      name: "Emily Rodriguez",
      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop",
      role: "Marketing Manager",
    },
    month: "January 2024",
    basicSalary: 7800,
    allowance: 1100,
    bonus: 400,
    deductions: 780,
    netPay: 8520,
    status: "Pending",
  },
  {
    id: 4,
    employee: {
      name: "James Anderson",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop",
      role: "Financial Analyst",
    },
    month: "January 2024",
    basicSalary: 6500,
    allowance: 900,
    bonus: 200,
    deductions: 650,
    netPay: 6950,
    status: "Paid",
  },
  {
    id: 5,
    employee: {
      name: "Lisa Thompson",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop",
      role: "HR Specialist",
    },
    month: "January 2024",
    basicSalary: 5800,
    allowance: 800,
    bonus: 150,
    deductions: 580,
    netPay: 6170,
    status: "Pending",
  },
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case "Paid":
      return <Badge className="status-badge status-active">Paid</Badge>;
    case "Pending":
      return <Badge className="status-badge status-pending">Pending</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(amount);
};

const Payroll = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [monthFilter, setMonthFilter] = useState("january-2024");
  const [payslipOpen, setPayslipOpen] = useState(false);
  const [selectedPayroll, setSelectedPayroll] = useState<typeof payrollData[0] | null>(null);

  const totalPayroll = payrollData.reduce((sum, p) => sum + p.netPay, 0);
  const paidCount = payrollData.filter(p => p.status === "Paid").length;
  const pendingCount = payrollData.filter(p => p.status === "Pending").length;

  const openPayslip = (payroll: typeof payrollData[0]) => {
    setSelectedPayroll(payroll);
    setPayslipOpen(true);
  };

  return (
    <MainLayout
      title="Payroll"
      breadcrumb={[{ label: "Home", href: "/" }, { label: "Payroll" }]}
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <motion.div
          className="stat-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">Total Payroll</p>
          </div>
          <p className="text-3xl font-bold text-foreground">{formatCurrency(totalPayroll)}</p>
          <p className="text-sm text-success mt-1">
            <TrendingUp className="w-3 h-3 inline mr-1" />
            +5.2% from last month
          </p>
        </motion.div>
        <motion.div
          className="stat-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-success/10">
              <Users className="w-5 h-5 text-success" />
            </div>
            <p className="text-sm text-muted-foreground">Processed</p>
          </div>
          <p className="text-3xl font-bold text-success">{paidCount}</p>
          <p className="text-sm text-muted-foreground mt-1">employees paid</p>
        </motion.div>
        <motion.div
          className="stat-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-warning/10">
              <FileText className="w-5 h-5 text-warning" />
            </div>
            <p className="text-sm text-muted-foreground">Pending</p>
          </div>
          <p className="text-3xl font-bold text-warning">{pendingCount}</p>
          <p className="text-sm text-muted-foreground mt-1">requires processing</p>
        </motion.div>
        <motion.div
          className="stat-card flex flex-col justify-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Button className="w-full gap-2">
            <DollarSign className="w-4 h-4" />
            Generate Payroll
          </Button>
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
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="january-2024">January 2024</SelectItem>
              <SelectItem value="december-2023">December 2023</SelectItem>
              <SelectItem value="november-2023">November 2023</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Payroll Table */}
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
              <TableHead>Month</TableHead>
              <TableHead className="text-right">Basic Salary</TableHead>
              <TableHead className="text-right">Allowance</TableHead>
              <TableHead className="text-right">Bonus</TableHead>
              <TableHead className="text-right">Deductions</TableHead>
              <TableHead className="text-right">Net Pay</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payrollData.map((record, index) => (
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
                    <div>
                      <p className="font-medium">{record.employee.name}</p>
                      <p className="text-sm text-muted-foreground">{record.employee.role}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{record.month}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(record.basicSalary)}</TableCell>
                <TableCell className="text-right font-mono text-success">+{formatCurrency(record.allowance)}</TableCell>
                <TableCell className="text-right font-mono text-success">+{formatCurrency(record.bonus)}</TableCell>
                <TableCell className="text-right font-mono text-destructive">-{formatCurrency(record.deductions)}</TableCell>
                <TableCell className="text-right font-mono font-bold">{formatCurrency(record.netPay)}</TableCell>
                <TableCell>{getStatusBadge(record.status)}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1"
                    onClick={() => openPayslip(record)}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </TableCell>
              </motion.tr>
            ))}
          </TableBody>
        </Table>
      </motion.div>

      {/* Payslip Modal */}
      <Dialog open={payslipOpen} onOpenChange={setPayslipOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Payslip - {selectedPayroll?.month}</DialogTitle>
          </DialogHeader>
          {selectedPayroll && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={selectedPayroll.employee.avatar} />
                  <AvatarFallback>{selectedPayroll.employee.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{selectedPayroll.employee.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedPayroll.employee.role}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Basic Salary</span>
                  <span className="font-medium">{formatCurrency(selectedPayroll.basicSalary)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Allowance</span>
                  <span className="font-medium text-success">+{formatCurrency(selectedPayroll.allowance)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bonus</span>
                  <span className="font-medium text-success">+{formatCurrency(selectedPayroll.bonus)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Deductions</span>
                  <span className="font-medium text-destructive">-{formatCurrency(selectedPayroll.deductions)}</span>
                </div>
                <div className="flex justify-between pt-3 border-t">
                  <span className="font-semibold">Net Pay</span>
                  <span className="font-bold text-lg">{formatCurrency(selectedPayroll.netPay)}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1 gap-2">
                  <Download className="w-4 h-4" />
                  Download PDF
                </Button>
                {selectedPayroll.status === "Pending" && (
                  <Button className="flex-1">Mark as Paid</Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Payroll;
