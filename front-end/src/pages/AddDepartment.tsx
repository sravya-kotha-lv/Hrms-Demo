import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getApiWithToken, postApiWithToken, putApiWithToken } from "@/services/apiWrapper";


const AddDepartment = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    managerId: "",
    status: "active",
  });

  // 🔹 GET Department by ID (for edit)
      const { data } = useQuery({
      queryKey: ["department", id],
      queryFn: async () => {
        const res = await getApiWithToken(`/departments/${id}`);
        return res.data;
      },
      enabled: !!id,
    });


  // Populate form when editing
  useEffect(() => {
    if (data) {
      setFormData({
        name: data.name,
        code: data.code,
        managerId: data.managerId,
        status: data.status,
      });
    }
  }, [data]);

  // 🔹 Create / Update Mutation
  const mutation = useMutation({
  mutationFn: async () => {
    if (isEdit) {
      return await putApiWithToken(`/departments/${id}`, formData);
    } else {
      return await postApiWithToken(`/departments`, formData);
    }
  },
  onSuccess: () => {
    navigate("/departments");
  },
});


  const handleSubmit = (e: any) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <MainLayout
      title={isEdit ? "Edit Department" : "Add Department"}
      breadcrumb={[
        { label: "Home", href: "/" },
        { label: "Departments", href: "/departments" },
        { label: isEdit ? "Edit" : "Add" },
      ]}
    >
      <div className="bg-white rounded-xl shadow-sm p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">

          <Input
            placeholder="Department Name"
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value })
            }
            required
          />

          <Input
            placeholder="Department Code (HR, IT)"
            value={formData.code}
            onChange={(e) =>
              setFormData({ ...formData, code: e.target.value })
            }
            required
          />

          <Input
            placeholder="Manager ID"
            value={formData.managerId}
            onChange={(e) =>
              setFormData({ ...formData, managerId: e.target.value })
            }
          />

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
              onClick={() => navigate("/departments")}
            >
              Cancel
            </Button>

            <Button type="submit" disabled={mutation.isPending}>
              {isEdit ? "Update Department" : "Create Department"}
            </Button>
          </div>

        </form>
      </div>
    </MainLayout>
  );
};

export default AddDepartment;
