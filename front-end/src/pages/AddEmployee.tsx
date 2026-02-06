import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  getApiWithToken,
  postApiWithToken,
  putApiWithToken,
} from "@/services/apiWrapper";

/* ================= TYPES ================= */

interface Option {
  _id: string;
  name: string;
}

const emptyForm = {
  email: "",
  firstName: "",
  lastName: "",
  employeeCode: "",
  departmentId: "",
  designationId: "",
  roleId: "",
  employmentType: "",
  dateOfJoining: "",
};

/* ================= COMPONENT ================= */

const AddEmployee = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [form, setForm] = useState(emptyForm);
  const [departments, setDepartments] = useState<Option[]>([]);
  const [designations, setDesignations] = useState<Option[]>([]);
  const [roles, setRoles] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const employeeCodePrefix =
    (import.meta as any).env?.VITE_EMPLOYEE_CODE_PREFIX || "LV";

  /* ================= FETCH MASTER DATA ================= */

  useEffect(() => {
    fetchDepartments();
    fetchDesignations();
    fetchRoles();
    if (isEdit) {
      fetchEmployee();
    }
  }, []);

  const fetchEmployee = async () => {
    if (!id) return;
    const res = await getApiWithToken(`/employees/${id}`);
    if (res?.success && res?.data) {
      const employee = res.data;
      setForm({
        email: employee.userId?.email || "",
        firstName: employee.firstName || "",
        lastName: employee.lastName || "",
        employeeCode: employee.employeeCode || "",
        departmentId: employee.departmentId?._id || "",
        designationId: employee.designationId?._id || "",
        roleId: employee.roleIds?.[0]?._id || "",
        employmentType: employee.employmentType || "",
        dateOfJoining: employee.dateOfJoining
          ? new Date(employee.dateOfJoining).toISOString().slice(0, 10)
          : "",
      });
    } else {
      toast.error(res?.message || "Failed to load employee");
    }
  };

  const fetchDepartments = async () => {
    const res = await getApiWithToken("/departments");
    console.log(res,"dept");
    
    if (res?.code == 200) setDepartments(res.data || []);
  };

  const fetchDesignations = async () => {
    const res = await getApiWithToken("/designations");
    console.log(res,"Desi");
    if (res?.code == 200) setDesignations(res.data || []);
  };

  const fetchRoles = async () => {
    const res = await getApiWithToken("/roles");
    console.log(res,"Role");
    if (res?.code == 200) setRoles(res.data || []);
  };

  /* ================= SUBMIT ================= */

  const handleSubmit = async () => {
    if (
      !form.email ||
      !form.firstName ||
      !form.lastName ||
      !form.departmentId ||
      !form.designationId ||
      !form.roleId ||
      !form.employmentType ||
      !form.dateOfJoining
    ) {
      toast.error("Please fill all required fields");
      return;
    }

    const payload = {
      email: form.email,
      roleIds: [form.roleId],
      firstName: form.firstName,
      lastName: form.lastName,
      departmentId: form.departmentId,
      designationId: form.designationId,
      employmentType: form.employmentType,
      dateOfJoining: form.dateOfJoining,
    };

    setLoading(true);
    const res = isEdit
      ? await putApiWithToken(`/employees/${id}`, payload)
      : await postApiWithToken("/employees", payload);
    setLoading(false);

    if (res?.success) {
      toast.success(isEdit ? "Employee updated" : "Employee created & onboarding email sent");
      navigate("/employees");
    } else {
      toast.error(res?.message || "Failed to save employee");
    }
  };

  /* ================= UI ================= */

  return (
    <MainLayout
      title={isEdit ? "Edit Employee" : "Add Employee"}
      breadcrumb={[
        { label: "Home", href: "/" },
        { label: "Employees", href: "/employees" },
        { label: isEdit ? "Edit Employee" : "Add Employee" },
      ]}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate("/employees")}
          className="flex items-center gap-2 text-muted-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? "Saving..." : isEdit ? "Update Employee" : "Create Employee"}
        </Button>
      </div>

      {/* Form */}
      <div className="stat-card grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Email *</Label>
          <Input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="employee@email.com"
          />
        </div>

        <div>
          <Label>Employee Code (Auto)</Label>
          <Input
            value={isEdit ? form.employeeCode : `${employeeCodePrefix}-AUTO`}
            disabled
          />
        </div>

        <div>
          <Label>First Name *</Label>
          <Input
            value={form.firstName}
            onChange={(e) =>
              setForm({ ...form, firstName: e.target.value })
            }
          />
        </div>

        <div>
          <Label>Last Name *</Label>
          <Input
            value={form.lastName}
            onChange={(e) =>
              setForm({ ...form, lastName: e.target.value })
            }
          />
        </div>

        <div>
          <Label>Department *</Label>
          <Select
            value={form.departmentId}
            onValueChange={(v) =>
              setForm({ ...form, departmentId: v })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Department" />
            </SelectTrigger>
            <SelectContent>
              {departments.map((d) => (
                <SelectItem key={d._id} value={d._id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Designation *</Label>
          <Select
            value={form.designationId}
            onValueChange={(v) =>
              setForm({ ...form, designationId: v })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Designation" />
            </SelectTrigger>
            <SelectContent>
              {designations.map((d) => (
                <SelectItem key={d._id} value={d._id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Role *</Label>
          <Select
            value={form.roleId}
            onValueChange={(v) => setForm({ ...form, roleId: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Role" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r._id} value={r._id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Employment Type *</Label>
          <Select
            value={form.employmentType}
            onValueChange={(v) =>
              setForm({ ...form, employmentType: v })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full_time">Full Time</SelectItem>
              <SelectItem value="part_time">Part Time</SelectItem>
              <SelectItem value="contract">Contract</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Date of Joining *</Label>
          <Input
            type="date"
            value={form.dateOfJoining}
            onChange={(e) =>
              setForm({ ...form, dateOfJoining: e.target.value })
            }
          />
        </div>
      </div>
    </MainLayout>
  );
};

export default AddEmployee;
