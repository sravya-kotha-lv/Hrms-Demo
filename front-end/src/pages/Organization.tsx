import { useState } from "react";
import { motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { Search, Plus, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {getApiWithToken, postApiWithToken} from "@/lib/api";
import axios from "axios";
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
import { useNavigate } from "react-router-dom";


const Organization = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();

const { data, isLoading, error } = useQuery({
  queryKey: ["organizations"],
  queryFn: async () => {
    const res = await getApiWithToken(
      "/organizations"
    );
    console.log("🚀 ~ file: Organization.tsx:36 ~ queryFn: ~ res:", res)
    return res.data;
  },
});
 const deleteMutation = useMutation({
  mutationFn: async (id: number) => {
    await axios.delete(
      `http://localhost:8000/api/organizations/${id}`
    );
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["organizations"] });
  },
});
 if (isLoading) {
  return <MainLayout title="Organization">Loading...</MainLayout>;
}

if (error) {
  return <MainLayout title="Organization">Error loading data</MainLayout>;
}



  return (
    <MainLayout
      title="Organization"
      breadcrumb={[{ label: "Home", href: "/" }, { label: "Organization" }]}
    >
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <motion.div className="stat-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <p className="text-sm text-muted-foreground">Total Organizations</p>
          <p className="text-3xl font-bold text-primary">12</p>
        </motion.div>
        <motion.div className="stat-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <p className="text-sm text-muted-foreground">Active</p>
          <p className="text-3xl font-bold text-success">10</p>
        </motion.div>
        <motion.div className="stat-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <p className="text-sm text-muted-foreground">Inactive</p>
          <p className="text-3xl font-bold text-destructive">2</p>
        </motion.div>
      </div>

      {/* Action Bar */}
      <div className="flex justify-between items-center mb-6">
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search organization..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          className="gap-2"
          onClick={() => navigate("/organization/add")}
        >
          <Plus className="w-4 h-4" />
          Add Organization
        </Button>
      </div>

      {/* Table */}
      <motion.div
        className="bg-card rounded-xl card-shadow overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <Table>
          <TableHeader>
            <TableRow className="table-header">
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.map((org: any) => (

              <TableRow key={org.id} className="table-row-hover">
                <TableCell className="font-medium">{org.name}</TableCell>
                <TableCell>{org.email}</TableCell>
                <TableCell>{org.phone}</TableCell>
                <TableCell>{org.location}</TableCell>
                <TableCell>
                  <Badge
                    variant={org.status === "Active" ? "default" : "secondary"}
                  >
                    {org.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger>
                      <MoreHorizontal className="w-4 h-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => navigate(`/organization/edit/${org.id}`)}
                        className="gap-2"
                      >
                        <Edit className="w-4 h-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => deleteMutation.mutate(org.id)}
                        className="gap-2 text-destructive"
                        >
                        <Trash2 className="w-4 h-4" /> Delete
                        </DropdownMenuItem>

                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </motion.div>
    </MainLayout>
  );
};

export default Organization;
