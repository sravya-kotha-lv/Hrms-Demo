import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiWithToken, deleteApiWithToken } from "@/services/apiWrapper";


const Departments = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");


  // 🔹 GET Departments
  const { data, isLoading, error } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const res = await getApiWithToken(
        "/departments"
      );
      return res.data;
    },
  });

  const filteredData = data?.filter((dept) =>
  dept.name.toLowerCase().includes(search.toLowerCase())
);

  // 🔹 DELETE Department
  const deleteMutation = useMutation({
  mutationFn: async (id) => {
    await deleteApiWithToken(`/departments/${id}`);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["departments"] });
  },
});

  if (isLoading) {
    return <MainLayout title="Departments">Loading...</MainLayout>;
  }

  if (error) {
    return <MainLayout title="Departments">Error loading data</MainLayout>;
  }

  return (
    <MainLayout
      title="Departments"
      breadcrumb={[{ label: "Home", href: "/" }, { label: "Departments" }]}
    >
      {/* Action Bar */}
      <div className="flex justify-between items-center mb-6">
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search department..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Button onClick={() => navigate("/departments/add")}>
          <Plus className="w-4 h-4 mr-2" />
          Add Department
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Department</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Head</TableHead>
              <TableHead>Employees</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredData?.map((dept) => (
              <TableRow key={dept.id} className="hover:bg-gray-50">
                <TableCell className="font-medium">
                  {dept.name}
                </TableCell>
                <TableCell>{dept.code}</TableCell>
                <TableCell>{dept.head}</TableCell>
                <TableCell>{dept.employees}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      dept.status === "Active"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {dept.status}
                  </Badge>
                </TableCell>
                <TableCell className="flex gap-3">
                  <Edit
                    className="w-4 h-4 cursor-pointer text-blue-500 hover:text-blue-700"
                    onClick={() => navigate(`/departments/edit/${dept.id}`)}
                  />

                  <Trash2
                    className="w-4 h-4 cursor-pointer text-red-500 hover:text-red-700"
                    onClick={() => {
                      if (window.confirm("Are you sure you want to delete this department?")) {
                        deleteMutation.mutate(dept.id);
                      }
                    }}
                  />
                </TableCell>

              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </MainLayout>
  );
};

export default Departments;
