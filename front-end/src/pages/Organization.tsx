import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { DataTable, Column } from "@/components/ui/DataTable";
import {
  getApiWithToken,
  postApiWithToken,
  deleteApiWithToken,
  putApiWithToken,
} from "@/services/apiWrapper";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Trash2, Plus, FilePenLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PermissionGate from "@/components/PermissionGate";

interface Organization {
  _id?: string;
  name: string;
  code: string;
  timezone: string;
  currency: string;
  status: "active" | "inactive";
}

const emptyOrg: Organization = {
  name: "",
  code: "",
  timezone: "Asia/Kolkata",
  currency: "INR",
  status: "active",
};

const OrganizationPage = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [open, setOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState<Organization>(emptyOrg);

  const fetchOrganizations = async () => {
    const response = await getApiWithToken("/organizations");
    console.log(response,"response");
    
    setOrganizations(response?.data || []);
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

  // 🗑 Delete
  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this organization?")) return;

    const res = await deleteApiWithToken(`/organizations/${id}`);
    if (res?.success) {
      toast.success("Organization deleted");
      fetchOrganizations();
    } else {
      toast.error(res?.message || "Delete failed");
    }
  };

  // 💾 Submit (ADD or EDIT)
  const handleSubmit = async () => {
    // common fields
    const basePayload = {
      name: form.name,
      timezone: form.timezone,
      currency: form.currency,
      status: form.status,
    };

    let res;

    if (isEdit && form._id) {
      // ❌ DO NOT SEND code while updating
      res = await putApiWithToken(
        `/organizations/${form._id}`,
        basePayload
      );
    } else {
      // ✅ SEND code only while creating
      res = await postApiWithToken("/organizations", {
        ...basePayload,
        code: form.code,
      });
    }

    if (res?.success) {
      toast.success(
        isEdit ? "Organization updated" : "Organization created"
      );
      setOpen(false);
      setForm(emptyOrg);
      fetchOrganizations();
    } else {
      toast.error(res?.message || "Operation failed");
    }
  };

  const columns: Column<Organization>[] = [
    { header: "Name", accessor: "name", sortable: true },
    { header: "Code", accessor: "code", sortable: true },
    { header: "Timezone", accessor: "timezone" },
    { header: "Currency", accessor: "currency" },
    {
      header: "Status",
      accessor: "status",
      render: (org) => (
        <Badge className="capitalize">
          {org.status || "active"}
        </Badge>
      ),
    },
    {
      header: "Actions",
      accessor: "_id",
      render: (org) => {
        const isInactive = org.status === "inactive";

        return (
          <PermissionGate permissions={["ORG_MANAGE"]} fallback={<div className="text-muted-foreground text-sm">-</div>}>
          <div className="flex items-center gap-4">
            {/* ✏️ Edit */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <FilePenLine
                    className={`
          w-4 h-4 transition-all duration-200
          ${isInactive
                        ? "text-gray-400 cursor-not-allowed"
                        : `
                cursor-pointer
                text-blue-600
                hover:text-blue-700
                hover:scale-110
                hover:-translate-y-0.5
              `
                      }
        `}
                    onClick={() => {
                      if (isInactive) return;
                      setIsEdit(true);
                      setForm(org);
                      setOpen(true);
                    }}
                  />
                </TooltipTrigger>

                <TooltipContent>
                  {isInactive
                    ? "Inactive organizations cannot be edited"
                    : "Edit organization"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>


            {/* 🗑 Delete */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={`
          group
          ${isInactive
                        ? "text-gray-400 cursor-not-allowed"
                        : "text-red-500 hover:text-red-600 cursor-pointer"
                      }
        `}
                    onClick={() => {
                      if (isInactive) return;
                      handleDelete(org._id!);
                    }}
                  >
                    <Trash2
                      className={`
            w-4 h-4 transition-transform duration-200
            ${isInactive
                          ? ""
                          : "group-hover:-rotate-12 group-hover:scale-110"
                        }
          `}
                    />
                  </div>
                </TooltipTrigger>

                <TooltipContent>
                  {isInactive
                    ? "Inactive organizations cannot be deleted"
                    : "Delete organization"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          </PermissionGate>
        );
      },
    }
  ];

  return (
    <MainLayout
      title="Organization"
      breadcrumb={[{ label: "Home", href: "/" }, { label: "Organization" }]}
    >
      {/* ➕ Add Organization */}
      {/* <div className="flex justify-end mb-4">
        <Button
          onClick={() => {
            setIsEdit(false);
            setForm(emptyOrg);
            setOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Organization
        </Button>
      </div> */}

      <DataTable
        columns={columns}
        data={organizations}
        rowKey="_id"
        searchKey="name"
        selectable
      />

      {/* 📝 Add/Edit Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Edit Organization" : "Add Organization"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              placeholder="Organization Name"
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value })
              }
            />
            <Input
              placeholder="Code"
              value={form.code}
              disabled={isEdit} // 🔒 locked in edit mode
              className={isEdit ? "cursor-not-allowed opacity-70" : ""}
              onChange={(e) =>
                setForm({ ...form, code: e.target.value })
              }
            />
            <Select
              value={form.timezone}
              onValueChange={(value: string) =>
                setForm({ ...form, timezone: value })
              }>
              <SelectTrigger>
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Asia/Kolkata">
                  Asia/Kolkata (India)
                </SelectItem>
                <SelectItem value="America/New_York">
                  America/New_York (USA)
                </SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={form.currency}
              onValueChange={(value: "INR" | "USD") =>
                setForm({ ...form, currency: value })
              }>
              <SelectTrigger>
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INR">INR – Indian Rupee</SelectItem>
                <SelectItem value="USD">USD – US Dollar</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={form.status}
              onValueChange={(value: "active" | "inactive") =>
                setForm({ ...form, status: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSubmit} className="w-full">
              {isEdit ? "Update Organization" : "Create Organization"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default OrganizationPage;
