import { useState } from "react";
import { motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { 
  Search, Filter, Download, Plus, MoreHorizontal, 
  Edit, Trash2, Eye, Mail, Phone 
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import { useNavigate } from "react-router-dom";

const employees = [
  {
    id: "EMP001",
    name: "Sarah Wilson",
    email: "sarah.wilson@company.com",
    phone: "+1 (555) 123-4567",
    department: "Engineering",
    role: "Senior Developer",
    status: "Active",
    joinDate: "2022-03-15",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
  },
  {
    id: "EMP002",
    name: "Michael Chen",
    email: "michael.chen@company.com",
    phone: "+1 (555) 234-5678",
    department: "Design",
    role: "UI/UX Designer",
    status: "Active",
    joinDate: "2021-08-22",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
  },
  {
    id: "EMP003",
    name: "Emily Rodriguez",
    email: "emily.rodriguez@company.com",
    phone: "+1 (555) 345-6789",
    department: "Marketing",
    role: "Marketing Manager",
    status: "On Leave",
    joinDate: "2020-11-10",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop",
  },
  {
    id: "EMP004",
    name: "James Anderson",
    email: "james.anderson@company.com",
    phone: "+1 (555) 456-7890",
    department: "Finance",
    role: "Financial Analyst",
    status: "Active",
    joinDate: "2023-01-05",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop",
  },
  {
    id: "EMP005",
    name: "Lisa Thompson",
    email: "lisa.thompson@company.com",
    phone: "+1 (555) 567-8901",
    department: "HR",
    role: "HR Specialist",
    status: "Active",
    joinDate: "2022-06-18",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop",
  },
  {
    id: "EMP006",
    name: "David Kim",
    email: "david.kim@company.com",
    phone: "+1 (555) 678-9012",
    department: "Engineering",
    role: "DevOps Engineer",
    status: "Inactive",
    joinDate: "2021-04-12",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop",
  },
  {
    id: "EMP007",
    name: "Amanda Foster",
    email: "amanda.foster@company.com",
    phone: "+1 (555) 789-0123",
    department: "Sales",
    role: "Sales Representative",
    status: "Active",
    joinDate: "2023-02-28",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop",
  },
  {
    id: "EMP008",
    name: "Robert Martinez",
    email: "robert.martinez@company.com",
    phone: "+1 (555) 890-1234",
    department: "Engineering",
    role: "Backend Developer",
    status: "Active",
    joinDate: "2022-09-01",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop",
  },
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case "Active":
      return <Badge className="status-badge status-active">Active</Badge>;
    case "Inactive":
      return <Badge className="status-badge status-inactive">Inactive</Badge>;
    case "On Leave":
      return <Badge className="status-badge status-pending">On Leave</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

const Employees = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<typeof employees[0] | null>(null);

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDepartment = departmentFilter === "all" || emp.department === departmentFilter;
    return matchesSearch && matchesDepartment;
  });

  const handleDelete = (employee: typeof employees[0]) => {
    setSelectedEmployee(employee);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    // Handle delete logic here
    console.log("Deleting employee:", selectedEmployee?.id);
    setDeleteDialogOpen(false);
    setSelectedEmployee(null);
  };

  return (
    <MainLayout
      title="Employees"
      breadcrumb={[{ label: "Home", href: "/" }, { label: "Employees" }]}
    >
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
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              <SelectItem value="Engineering">Engineering</SelectItem>
              <SelectItem value="Design">Design</SelectItem>
              <SelectItem value="Marketing">Marketing</SelectItem>
              <SelectItem value="Finance">Finance</SelectItem>
              <SelectItem value="HR">HR</SelectItem>
              <SelectItem value="Sales">Sales</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
          <Button className="gap-2" onClick={() => navigate("/employees/add")}>
            <Plus className="w-4 h-4" />
            Add Employee
          </Button>
        </div>
      </div>

      {/* Employee Table */}
      <motion.div
        className="bg-card rounded-xl card-shadow overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Table>
          <TableHeader>
            <TableRow className="table-header">
              <TableHead className="w-12">
                <input type="checkbox" className="rounded border-input" />
              </TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Employee ID</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Join Date</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEmployees.map((employee, index) => (
              <motion.tr
                key={employee.id}
                className="table-row-hover"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <TableCell>
                  <input type="checkbox" className="rounded border-input" />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={employee.avatar} alt={employee.name} />
                      <AvatarFallback>{employee.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground">{employee.name}</p>
                      <p className="text-sm text-muted-foreground">{employee.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-sm">{employee.id}</TableCell>
                <TableCell>{employee.department}</TableCell>
                <TableCell>{employee.role}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <a href={`mailto:${employee.email}`} className="p-1.5 rounded hover:bg-muted transition-colors">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                    </a>
                    <a href={`tel:${employee.phone}`} className="p-1.5 rounded hover:bg-muted transition-colors">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                    </a>
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(employee.status)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(employee.joinDate).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="p-2 rounded hover:bg-muted transition-colors">
                      <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="gap-2">
                        <Eye className="w-4 h-4" /> View
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2" onClick={() => navigate(`/employees/edit/${employee.id}`)}>
                        <Edit className="w-4 h-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2 text-destructive" onClick={() => handleDelete(employee)}>
                        <Trash2 className="w-4 h-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </motion.tr>
            ))}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border">
          <p className="text-sm text-muted-foreground">
            Showing {filteredEmployees.length} of {employees.length} employees
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled>Previous</Button>
            <Button variant="outline" size="sm" className="bg-primary text-primary-foreground">1</Button>
            <Button variant="outline" size="sm">2</Button>
            <Button variant="outline" size="sm">3</Button>
            <Button variant="outline" size="sm">Next</Button>
          </div>
        </div>
      </motion.div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Employee</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <span className="font-medium">{selectedEmployee?.name}</span>? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Employees;
