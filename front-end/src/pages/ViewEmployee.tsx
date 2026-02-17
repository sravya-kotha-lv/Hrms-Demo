import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Edit, Trash2 } from "lucide-react";
import { deleteApiWithToken, getApiWithToken } from "@/services/apiWrapper";
import { toast } from "sonner";
import { formatDateInOrgTimeZone } from "@/utils/timezone";

const getStatusBadge = (status: string) => {
  switch (status) {
    case "active":
      return <Badge className="status-badge status-active">Active</Badge>;
    case "on_leave":
      return <Badge className="status-badge status-pending">On Leave</Badge>;
    case "resigned":
      return <Badge className="status-badge status-inactive">Resigned</Badge>;
    default:
      return <Badge variant="secondary">{status || "-"}</Badge>;
  }
};

const formatDate = (value?: string) =>
  value ? formatDateInOrgTimeZone(value) : "-";

const formatAddress = (address: any) => {
  if (!address) return "-";
  const parts = [
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.country,
    address.zip,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "-";
};

const ViewEmployee = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [employee, setEmployee] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const fetchEmployee = async () => {
    if (!id) return;
    setLoading(true);
    const res = await getApiWithToken(`/employees/${id}`);
    setLoading(false);

    if (res?.success) {
      setEmployee(res?.data);
    } else {
      toast.error(res?.message || "Failed to load employee");
    }
  };

  useEffect(() => {
    fetchEmployee();
  }, [id]);

  const confirmDelete = async () => {
    if (!employee?._id) return;
    const res = await deleteApiWithToken(`/employees/${employee._id}`);
    if (res?.success) {
      toast.success("Employee deleted");
      navigate("/employees");
    } else {
      toast.error(res?.message || "Delete failed");
    }
    setDeleteDialogOpen(false);
  };

  return (
    <MainLayout
      title="Employee Details"
      breadcrumb={[
        { label: "Home", href: "/" },
        { label: "Employees", href: "/employees" },
        { label: "View Employee" },
      ]}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <button
          onClick={() => navigate("/employees")}
          className="flex items-center gap-2 text-muted-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/employees/edit/${employee?._id}`)}
            disabled={!employee}
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <Button
            variant="destructive"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={!employee}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {loading && (
        <div className="bg-card rounded-xl card-shadow p-6 text-center">
          Loading...
        </div>
      )}

      {!loading && employee && (
        <>
          <div className="bg-card rounded-xl card-shadow p-6 mb-6 flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14">
                <AvatarImage src="" />
                <AvatarFallback>
                  {`${employee.firstName?.[0] || ""}${employee.lastName?.[0] || ""}`}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-lg font-semibold">
                  {employee.firstName} {employee.lastName}
                </p>
                <p className="text-sm text-muted-foreground">
                  {employee.employeeCode || "-"}
                </p>
              </div>
            </div>
            <div>{getStatusBadge(employee.status)}</div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="stat-card space-y-3">
              <h3 className="text-base font-semibold">Work Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p>{employee.userId?.email || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p>{employee.phone || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Department</p>
                  <p>{employee.departmentId?.name || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Designation</p>
                  <p>{employee.designationId?.name || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Role</p>
                  <p>
                    {employee.roleIds?.length
                      ? employee.roleIds
                          .map((role: any) => role?.name || role)
                          .join(", ")
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Manager</p>
                  <p>
                    {employee.managerId
                      ? `${employee.managerId?.firstName || ""} ${employee.managerId?.lastName || ""}`.trim()
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Employment Type</p>
                  <p>{employee.employmentType || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Join Date</p>
                  <p>{formatDate(employee.dateOfJoining)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p>{employee.status || "-"}</p>
                </div>
              </div>
            </div>

            <div className="stat-card space-y-3">
              <h3 className="text-base font-semibold">Personal Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Date of Birth</p>
                  <p>{formatDate(employee.dob)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Gender</p>
                  <p>{employee.gender || "-"}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-muted-foreground">Address</p>
                  <p>{formatAddress(employee.address)}</p>
                </div>
              </div>
            </div>

            <div className="stat-card space-y-3 lg:col-span-2">
              <h3 className="text-base font-semibold">Emergency Contacts</h3>
              {employee.emergencyContacts?.length ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {employee.emergencyContacts.map((contact: any, index: number) => (
                    <div key={`${contact.phone}-${index}`} className="border rounded-lg p-3">
                      <p className="font-medium">{contact.name}</p>
                      <p className="text-muted-foreground">{contact.relation}</p>
                      <p>{contact.phone}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No emergency contacts</p>
              )}
            </div>
          </div>
        </>
      )}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Employee</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this employee? This action cannot be undone.
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

export default ViewEmployee;
