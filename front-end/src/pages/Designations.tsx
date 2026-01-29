import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Search, Plus, Edit, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getApiWithToken, deleteApiWithToken } from "@/services/apiWrapper";

const Designations = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  // ✅ GET API
  const { data, isLoading, error } = useQuery({
    queryKey: ["designations"],
    queryFn: async () => {
      const res = await getApiWithToken("/designations");
      return res.data;
    },
  });

  // ✅ DELETE API
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await deleteApiWithToken(`/designations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["designations"] });
    },
  });

  if (isLoading) {
    return <MainLayout title="Designations">Loading...</MainLayout>;
  }

  if (error) {
    return <MainLayout title="Designations">Error loading data</MainLayout>;
  }

  const filteredData = data?.filter((des: any) =>
    des.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <MainLayout
      title="Designations"
      breadcrumb={[{ label: "Home", href: "/" }, { label: "Designations" }]}
    >
      <div className="flex justify-between items-center mb-6">
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search designation..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Button onClick={() => navigate("/designations/add")}>
          <Plus className="w-4 h-4 mr-2" />
          Add Designation
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Designation</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Role Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredData?.map((des: any) => (
              <TableRow key={des.id} className="hover:bg-gray-50">
                <TableCell className="font-medium">{des.name}</TableCell>
                <TableCell>{des.department}</TableCell>
                <TableCell>{des.role}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      des.status === "Active" ? "default" : "secondary"
                    }
                  >
                    {des.status}
                  </Badge>
                </TableCell>
                <TableCell className="flex gap-3">
                  <Edit
                    className="w-4 h-4 cursor-pointer text-blue-500 hover:text-blue-700"
                    onClick={() =>
                      navigate(`/designations/edit/${des.id}`)
                    }
                  />

                  <Trash2
                    className="w-4 h-4 cursor-pointer text-red-500 hover:text-red-700"
                    onClick={() => {
                      if (
                        window.confirm(
                          "Are you sure you want to delete this designation?"
                        )
                      ) {
                        deleteMutation.mutate(des.id);
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

export default Designations;
