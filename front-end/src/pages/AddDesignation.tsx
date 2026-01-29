import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate, useParams } from "react-router-dom";

const departments = ["Human Resources", "IT", "Finance"];
const roles = ["Admin", "Manager", "Employee"];

const AddDesignation = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState({
    name: "",
    department: "",
    role: "",
    status: "Active",
  });

  const handleSubmit = (e: any) => {
    e.preventDefault();
    console.log(formData);
    navigate("/designations");
  };

  return (
    <MainLayout
      title={isEdit ? "Edit Designation" : "Add Designation"}
      breadcrumb={[
        { label: "Home", href: "/" },
        { label: "Designations", href: "/designations" },
        { label: isEdit ? "Edit" : "Add" },
      ]}
    >
      <div className="bg-white rounded-xl shadow-sm p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">

          <Input
            placeholder="Designation Name"
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value })
            }
            required
          />

          {/* Department Dropdown */}
          <Select
            value={formData.department}
            onValueChange={(value) =>
              setFormData({ ...formData, department: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Department" />
            </SelectTrigger>
            <SelectContent>
              {departments.map((dept) => (
                <SelectItem key={dept} value={dept}>
                  {dept}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Role Dropdown */}
          <Select
            value={formData.role}
            onValueChange={(value) =>
              setFormData({ ...formData, role: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Role Type" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role} value={role}>
                  {role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Dropdown */}
          <Select
            value={formData.status}
            onValueChange={(value) =>
              setFormData({ ...formData, status: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/designations")}
            >
              Cancel
            </Button>
            <Button type="submit">
              {isEdit ? "Update Designation" : "Create Designation"}
            </Button>
          </div>

        </form>
      </div>
    </MainLayout>
  );
};

export default AddDesignation;
