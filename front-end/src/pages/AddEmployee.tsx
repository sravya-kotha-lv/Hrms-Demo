import { useState } from "react";
import { motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const AddEmployee = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    gender: "",
    dateOfBirth: "",
    address: "",
    emergencyContact: "",
    department: "",
    role: "",
    manager: "",
    employmentType: "",
    joinDate: "",
    status: "Active",
    basicSalary: "",
    allowance: "",
    bonus: "",
    deductions: "",
    bankName: "",
    accountNumber: "",
    routingNumber: "",
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Validation
    if (!formData.firstName || !formData.lastName || !formData.email) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: "Employee has been added successfully.",
    });
    navigate("/employees");
  };

  return (
    <MainLayout
      title="Add Employee"
      breadcrumb={[
        { label: "Home", href: "/" },
        { label: "Employees", href: "/employees" },
        { label: "Add Employee" },
      ]}
    >
      <form onSubmit={handleSubmit}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            type="button"
            onClick={() => navigate("/employees")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Employees
          </button>
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" onClick={() => navigate("/employees")}>
              Cancel
            </Button>
            <Button type="submit">Save Employee</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Photo Upload */}
          <motion.div
            className="stat-card flex flex-col items-center justify-center py-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center mb-4 border-4 border-dashed border-border">
              <User className="w-16 h-16 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-foreground mb-2">Profile Photo</h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Upload a profile photo for the employee
            </p>
            <Button variant="outline" className="gap-2">
              <Upload className="w-4 h-4" />
              Upload Photo
            </Button>
          </motion.div>

          {/* Right Column - Form Sections */}
          <div className="lg:col-span-2 space-y-6">
            {/* Personal Information */}
            <motion.div
              className="stat-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <h3 className="text-lg font-semibold mb-4">Personal Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName" className="form-label">First Name *</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => handleChange("firstName", e.target.value)}
                    className="form-input"
                    placeholder="Enter first name"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName" className="form-label">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => handleChange("lastName", e.target.value)}
                    className="form-input"
                    placeholder="Enter last name"
                  />
                </div>
                <div>
                  <Label htmlFor="gender" className="form-label">Gender</Label>
                  <Select value={formData.gender} onValueChange={(v) => handleChange("gender", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="dateOfBirth" className="form-label">Date of Birth</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => handleChange("dateOfBirth", e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>
            </motion.div>

            {/* Contact Information */}
            <motion.div
              className="stat-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h3 className="text-lg font-semibold mb-4">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email" className="form-label">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    className="form-input"
                    placeholder="Enter email address"
                  />
                </div>
                <div>
                  <Label htmlFor="phone" className="form-label">Phone Number *</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    className="form-input"
                    placeholder="Enter phone number"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="address" className="form-label">Address</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => handleChange("address", e.target.value)}
                    className="form-input min-h-[80px]"
                    placeholder="Enter full address"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="emergencyContact" className="form-label">Emergency Contact</Label>
                  <Input
                    id="emergencyContact"
                    value={formData.emergencyContact}
                    onChange={(e) => handleChange("emergencyContact", e.target.value)}
                    className="form-input"
                    placeholder="Name and phone number"
                  />
                </div>
              </div>
            </motion.div>

            {/* Job Information */}
            <motion.div
              className="stat-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h3 className="text-lg font-semibold mb-4">Job Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="department" className="form-label">Department</Label>
                  <Select value={formData.department} onValueChange={(v) => handleChange("department", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="engineering">Engineering</SelectItem>
                      <SelectItem value="design">Design</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                      <SelectItem value="finance">Finance</SelectItem>
                      <SelectItem value="hr">HR</SelectItem>
                      <SelectItem value="sales">Sales</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="role" className="form-label">Role</Label>
                  <Input
                    id="role"
                    value={formData.role}
                    onChange={(e) => handleChange("role", e.target.value)}
                    className="form-input"
                    placeholder="Enter role/position"
                  />
                </div>
                <div>
                  <Label htmlFor="manager" className="form-label">Manager</Label>
                  <Select value={formData.manager} onValueChange={(v) => handleChange("manager", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select manager" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="john-doe">John Doe</SelectItem>
                      <SelectItem value="jane-smith">Jane Smith</SelectItem>
                      <SelectItem value="mike-johnson">Mike Johnson</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="employmentType" className="form-label">Employment Type</Label>
                  <Select value={formData.employmentType} onValueChange={(v) => handleChange("employmentType", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full-time">Full-time</SelectItem>
                      <SelectItem value="part-time">Part-time</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="intern">Intern</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="joinDate" className="form-label">Join Date</Label>
                  <Input
                    id="joinDate"
                    type="date"
                    value={formData.joinDate}
                    onChange={(e) => handleChange("joinDate", e.target.value)}
                    className="form-input"
                  />
                </div>
                <div>
                  <Label htmlFor="status" className="form-label">Status</Label>
                  <Select value={formData.status} onValueChange={(v) => handleChange("status", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                      <SelectItem value="On Leave">On Leave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </motion.div>

            {/* Salary Information */}
            <motion.div
              className="stat-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <h3 className="text-lg font-semibold mb-4">Salary Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="basicSalary" className="form-label">Basic Salary</Label>
                  <Input
                    id="basicSalary"
                    type="number"
                    value={formData.basicSalary}
                    onChange={(e) => handleChange("basicSalary", e.target.value)}
                    className="form-input"
                    placeholder="Enter amount"
                  />
                </div>
                <div>
                  <Label htmlFor="allowance" className="form-label">Allowance</Label>
                  <Input
                    id="allowance"
                    type="number"
                    value={formData.allowance}
                    onChange={(e) => handleChange("allowance", e.target.value)}
                    className="form-input"
                    placeholder="Enter amount"
                  />
                </div>
                <div>
                  <Label htmlFor="bonus" className="form-label">Bonus</Label>
                  <Input
                    id="bonus"
                    type="number"
                    value={formData.bonus}
                    onChange={(e) => handleChange("bonus", e.target.value)}
                    className="form-input"
                    placeholder="Enter amount"
                  />
                </div>
                <div>
                  <Label htmlFor="deductions" className="form-label">Deductions</Label>
                  <Input
                    id="deductions"
                    type="number"
                    value={formData.deductions}
                    onChange={(e) => handleChange("deductions", e.target.value)}
                    className="form-input"
                    placeholder="Enter amount"
                  />
                </div>
              </div>
            </motion.div>

            {/* Bank Details */}
            <motion.div
              className="stat-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <h3 className="text-lg font-semibold mb-4">Bank Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="bankName" className="form-label">Bank Name</Label>
                  <Input
                    id="bankName"
                    value={formData.bankName}
                    onChange={(e) => handleChange("bankName", e.target.value)}
                    className="form-input"
                    placeholder="Enter bank name"
                  />
                </div>
                <div>
                  <Label htmlFor="accountNumber" className="form-label">Account Number</Label>
                  <Input
                    id="accountNumber"
                    value={formData.accountNumber}
                    onChange={(e) => handleChange("accountNumber", e.target.value)}
                    className="form-input"
                    placeholder="Enter account number"
                  />
                </div>
                <div>
                  <Label htmlFor="routingNumber" className="form-label">Routing Number</Label>
                  <Input
                    id="routingNumber"
                    value={formData.routingNumber}
                    onChange={(e) => handleChange("routingNumber", e.target.value)}
                    className="form-input"
                    placeholder="Enter routing number"
                  />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </form>
    </MainLayout>
  );
};

export default AddEmployee;
