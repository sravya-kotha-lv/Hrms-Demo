import { useEffect, useState } from "react";
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
import { getApiWithToken, postApiWithToken, putApiWithToken } from "@/services/apiWrapper";
import { toast } from "sonner";

const AddDesignation = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState({
    name: "",
    departmentId: "",
    status: "active",
  });

  const [departments, setDepartments] = useState<any[]>([]);

  const fetchDepartments = async () => {
    const res = await getApiWithToken("/departments");
    if (res?.success) {
      setDepartments(res.data || []);
    } else {
      toast.error(res?.message || "Failed to load departments");
    }
  };

  const fetchDesignationById = async (designationId: string) => {
    const res = await getApiWithToken("/designations");
    if (res?.success) {
      const found = (res.data || []).find((d: any) => d._id === designationId);
      if (found) {
        setFormData({
          name: found.name || "",
          departmentId: found.departmentId || found.department?._id || "",
          status: found.status || "active",
        });
      }
    } else {
      toast.error(res?.message || "Failed to load designation");
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    if (isEdit && id) {
      fetchDesignationById(id);
    }
  }, [isEdit, id]);

  const handleSubmit = async (e: any) => {
    e.preventDefault();

    if (!formData.name || !formData.departmentId) {
      toast.error("Name and department are required");
      return;
    }

    let res;
    if (isEdit && id) {
      res = await putApiWithToken(`/designations/${id}`, {
        name: formData.name,
        departmentId: formData.departmentId,
        status: formData.status,
      });
    } else {
      res = await postApiWithToken("/designations", {
        name: formData.name,
        departmentId: formData.departmentId,
        status: formData.status,
      });
    }

    if (res?.success) {
      toast.success(isEdit ? "Designation updated" : "Designation created");
      navigate("/designations");
    } else {
      toast.error(res?.message || "Operation failed");
    }
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
            value={formData.departmentId}
            onValueChange={(value) =>
              setFormData({ ...formData, departmentId: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Department" />
            </SelectTrigger>
            <SelectContent>
              {departments.map((dept) => (
                <SelectItem key={dept._id} value={dept._id}>
                  {dept.name}
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
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
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
