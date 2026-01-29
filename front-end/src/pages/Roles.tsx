import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { getApiWithToken } from "@/services/apiWrapper";
import { Trash2 } from "lucide-react";

// const roleData = [
//   { id: 1, name: "Admin", description: "Full system access", status: "Active" },
//   { id: 2, name: "HR Manager", description: "Manage employees & payroll", status: "Active" },
//   { id: 3, name: "Employee", description: "Limited self access", status: "Active" },
// ];

const Roles = () => {
  const navigate = useNavigate();
   const queryClient = useQueryClient();

    // 🔹 Fetch Roles
  const { data, isLoading, error } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const res = await getApiWithToken(
        "/roles"
      );
      return res.data;
    },
  });

  // 🔹 Delete Role
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await axios.delete(`/roles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
  });

  if (isLoading) {
    return <MainLayout title="Roles">Loading roles...</MainLayout>;
  }

  if (error) {
    return <MainLayout title="Roles">Error loading roles</MainLayout>;
  }

  return (
   <MainLayout
      title="Role Management"
      breadcrumb={[{ label: "Home", href: "/" }, { label: "Roles" }]}
    >
      <div className="flex justify-end mb-6">
        <Button onClick={() => navigate("/roles/add")}>
          + Add Role
        </Button>
      </div>

      <div className="bg-card rounded-xl card-shadow overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.map((role: any) => (
              <TableRow key={role.id}>
                <TableCell className="font-medium">
                  {role.name}
                </TableCell>
                <TableCell>{role.description}</TableCell>
                <TableCell>
                  <Badge
                    variant={role.status === "Active" ? "default" : "secondary"}
                  >
                    {role.status}
                  </Badge>
                </TableCell>
                <TableCell className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      navigate(`/roles/edit/${role.id}`)
                    }
                  >
                    Edit
                  </Button>

                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() =>
                      deleteMutation.mutate(role.id)
                    }
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </MainLayout>
  );
};

export default Roles;
