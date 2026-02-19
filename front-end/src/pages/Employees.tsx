import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  Search,
  Download,
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useNavigate, useSearchParams } from "react-router-dom";
import { deleteApiWithToken, getApiWithToken, putApiWithToken } from "@/services/apiWrapper";
import { toast } from "sonner";
import PermissionGate from "@/components/PermissionGate";
import { useAuth } from "@/context/AuthContext";
import { formatDateInOrgTimeZone } from "@/utils/timezone";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, type Column } from "@/components/ui/DataTable";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis
} from "@/components/ui/pagination";

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

const getLifecycleBadge = (status: string) => {
  const normalizedStatus = status || "confirmed";
  switch (normalizedStatus) {
    case "probation":
      return <Badge className="status-badge status-pending">Probation</Badge>;
    case "confirmed":
      return <Badge className="status-badge status-active">Confirmed</Badge>;
    case "notice":
      return <Badge className="status-badge status-inactive">Notice</Badge>;
    case "terminated":
      return <Badge className="status-badge status-inactive">Terminated</Badge>;
    default:
      return <Badge variant="secondary">{normalizedStatus}</Badge>;
  }
};

const Employees = () => {
  const navigate = useNavigate();
  const { hasAnyPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [designationFilter, setDesignationFilter] = useState("all");
  const [managerFilter, setManagerFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState("all");
  const [orgSearch, setOrgSearch] = useState("");
  const [deptSearch, setDeptSearch] = useState("");
  const [designationSearch, setDesignationSearch] = useState("");
  const [managerSearch, setManagerSearch] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [bulkShiftId, setBulkShiftId] = useState("none");
  const [bulkManagerId, setBulkManagerId] = useState("none");
  const [bulkDepartmentId, setBulkDepartmentId] = useState("none");
  const [bulkDesignationId, setBulkDesignationId] = useState("none");
  const [bulkStatus, setBulkStatus] = useState("none");
  const [bulkLifecycleStatus, setBulkLifecycleStatus] = useState("none");
  const [bulkApplying, setBulkApplying] = useState(false);
  const [bulkPanelOpen, setBulkPanelOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const isSuperAdmin = localStorage.getItem("isSuperAdmin") === "true";
  const canView = hasAnyPermission(["EMP_VIEW"]);
  const canEdit = hasAnyPermission(["EMP_UPDATE"]);
  const canDelete = hasAnyPermission(["EMP_DELETE"]);
  const canAnyAction = canView || canEdit || canDelete;
  const tableColumnCount = 14 + (canAnyAction ? 1 : 0);

  const selectedOrgId = useMemo(
    () => searchParams.get("organizationId") || "",
    [searchParams]
  );

  const filteredOrganizations = useMemo(
    () => organizations.filter((org) => (org.name || "").toLowerCase().includes(orgSearch.toLowerCase())),
    [organizations, orgSearch]
  );
  const filteredDepartments = useMemo(
    () => departments.filter((dept) => (dept.name || "").toLowerCase().includes(deptSearch.toLowerCase())),
    [departments, deptSearch]
  );
  const filteredDesignations = useMemo(
    () =>
      designations.filter((designation) =>
        (designation.name || "").toLowerCase().includes(designationSearch.toLowerCase())
      ),
    [designations, designationSearch]
  );
  const filteredManagers = useMemo(
    () => managers.filter((manager) => (manager.name || "").toLowerCase().includes(managerSearch.toLowerCase())),
    [managers, managerSearch]
  );

  const fetchDepartments = async () => {
    const params = new URLSearchParams();
    if (isSuperAdmin && selectedOrgId) {
      params.set("organizationId", selectedOrgId);
    }
    const query = params.toString();
    const res = await getApiWithToken(`/departments${query ? `?${query}` : ""}`, null, {
      requiredPermissions: ["DEPT_VIEW"]
    });
    if (res?.skipped) return;
    if (res?.success) {
      setDepartments(res.data || []);
    } else {
      toast.error(res?.message || "Failed to load departments");
    }
  };

  const fetchOrganizations = async () => {
    if (!isSuperAdmin) return;
    const res = await getApiWithToken("/organizations", null, {
      requiredPermissions: ["ORG_VIEW"]
    });
    if (res?.skipped) return;
    if (res?.success) {
      setOrganizations(res.data || []);
    }
  };

  const fetchDesignations = async () => {
    const res = await getApiWithToken("/designations", null, {
      requiredPermissions: ["DESIG_VIEW"]
    });
    if (res?.success) {
      setDesignations(res.data || []);
    } else {
      setDesignations([]);
    }
  };

  const fetchShifts = async () => {
    const res = await getApiWithToken("/shifts", null, {
      requiredPermissions: ["SHIFT_VIEW"]
    });
    if (res?.success) {
      setShifts(res.data || []);
    } else {
      setShifts([]);
    }
  };

  const fetchManagers = async () => {
    const params = new URLSearchParams();
    if (isSuperAdmin && selectedOrgId) {
      params.set("organizationId", selectedOrgId);
    }
    const query = params.toString();
    const res = await getApiWithToken(`/employees${query ? `?${query}` : ""}`, null, {
      requiredPermissions: ["EMP_VIEW"]
    });
    if (res?.success) {
      const list = res.data?.items || [];
      setManagers(
        list.map((e: any) => ({
          _id: e._id,
          name: `${e.firstName || ""} ${e.lastName || ""}`.trim()
        }))
      );
    } else {
      setManagers([]);
    }
  };

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      if (!canView) {
        setEmployees([]);
        return;
      }
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (departmentFilter !== "all") {
        params.set("departmentId", departmentFilter);
      }
      if (designationFilter !== "all") {
        params.set("designationId", designationFilter);
      }
      if (managerFilter !== "all") {
        params.set("managerId", managerFilter);
      }
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      if (employmentTypeFilter !== "all") {
        params.set("employmentType", employmentTypeFilter);
      }
      if (isSuperAdmin && selectedOrgId) {
        params.set("organizationId", selectedOrgId);
      }
      params.set("page", String(currentPage));
      params.set("limit", String(pageSize));
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);
      const query = params.toString();
      const res = await getApiWithToken(
        `/employees${query ? `?${query}` : ""}`,
        null,
        { requiredPermissions: ["EMP_VIEW"] }
      );
      if (res?.skipped) return;
      if (res?.success) {
        const nextEmployees = res?.data?.items || [];
        setEmployees(nextEmployees);
        const pagination = res?.data?.pagination;
        setTotalItems(Number(pagination?.total || nextEmployees.length));
        setTotalPages(Math.max(1, Number(pagination?.totalPages || 1)));
        setSelectedEmployeeIds((prev) =>
          prev.filter((id) => nextEmployees.some((emp: any) => emp._id === id))
        );
      } else {
        toast.error(res?.message || "Failed to load employees");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDesignations();
    fetchOrganizations();
    fetchShifts();
  }, []);

  useEffect(() => {
    fetchDepartments();
  }, [selectedOrgId]);

  useEffect(() => {
    fetchManagers();
  }, [selectedOrgId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchQuery,
    departmentFilter,
    designationFilter,
    managerFilter,
    statusFilter,
    employmentTypeFilter,
    selectedOrgId,
    pageSize,
    sortBy,
    sortOrder
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEmployees();
    }, 300);
    return () => clearTimeout(timer);
  }, [
    searchQuery,
    departmentFilter,
    designationFilter,
    managerFilter,
    statusFilter,
    employmentTypeFilter,
    selectedOrgId,
    currentPage,
    pageSize,
    sortBy,
    sortOrder
  ]);

  const handleDelete = (employee: any) => {
    setSelectedEmployee(employee);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedEmployee?._id) return;
    if (!canDelete) {
      toast.error("You do not have permission to delete");
      return;
    }

    const res = await deleteApiWithToken(`/employees/${selectedEmployee._id}`);
    if (res?.success) {
      toast.success("Employee deleted");
      fetchEmployees();
    } else {
      toast.error(res?.message || "Delete failed");
    }

    setDeleteDialogOpen(false);
    setSelectedEmployee(null);
  };

  const allVisibleSelected =
    employees.length > 0 && employees.every((emp) => selectedEmployeeIds.includes(emp._id));

  const toggleSelectAllVisible = (checked: boolean) => {
    if (checked) {
      setSelectedEmployeeIds(employees.map((emp) => emp._id));
    } else {
      setSelectedEmployeeIds([]);
    }
  };

  const toggleSelectOne = (employeeId: string, checked: boolean) => {
    setSelectedEmployeeIds((prev) =>
      checked ? Array.from(new Set([...prev, employeeId])) : prev.filter((id) => id !== employeeId)
    );
  };

  const handleBulkUpdate = async () => {
    if (!selectedEmployeeIds.length) {
      toast.error("Select at least one employee");
      return;
    }

    const payload: any = {
      employeeIds: selectedEmployeeIds
    };

    if (bulkShiftId !== "none") payload.shiftId = bulkShiftId === "clear" ? null : bulkShiftId;
    if (bulkManagerId !== "none") payload.managerId = bulkManagerId === "clear" ? null : bulkManagerId;
    if (bulkDepartmentId !== "none") payload.departmentId = bulkDepartmentId;
    if (bulkDesignationId !== "none") payload.designationId = bulkDesignationId;
    if (bulkStatus !== "none") payload.status = bulkStatus;
    if (bulkLifecycleStatus !== "none") payload.employmentLifecycleStatus = bulkLifecycleStatus;

    if (Object.keys(payload).length === 1) {
      toast.error("Select at least one field to update");
      return;
    }

    setBulkApplying(true);
    const res = await putApiWithToken("/employees/bulk-update", payload);
    setBulkApplying(false);

    if (res?.success) {
      toast.success(`Updated ${res?.data?.updatedCount || selectedEmployeeIds.length} employees`);
      setSelectedEmployeeIds([]);
      setBulkShiftId("none");
      setBulkManagerId("none");
      setBulkDepartmentId("none");
      setBulkDesignationId("none");
      setBulkStatus("none");
      setBulkLifecycleStatus("none");
      fetchEmployees();
    } else {
      toast.error(res?.message || "Bulk update failed");
    }
  };

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(field);
    setSortOrder("asc");
  };

  const renderSortableHead = (label: string, field?: string, className?: string) => {
    const stickyClass = "sticky top-0 z-30 bg-card";
    if (!field) return <TableHead className={`${stickyClass} ${className || ""}`}>{label}</TableHead>;
    return (
      <TableHead
        className={`${stickyClass} cursor-pointer select-none ${className || ""}`}
        onClick={() => toggleSort(field)}
      >
        <div className="flex items-center gap-1">
          <span>{label}</span>
          <ArrowUpDown className={`w-3.5 h-3.5 ${sortBy === field ? "opacity-100" : "opacity-40"}`} />
        </div>
      </TableHead>
    );
  };

  const getPageItems = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

    const items: (number | "ellipsis-left" | "ellipsis-right")[] = [1];
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    if (start > 2) items.push("ellipsis-left");
    for (let page = start; page <= end; page += 1) items.push(page);
    if (end < totalPages - 1) items.push("ellipsis-right");
    items.push(totalPages);
    return items;
  };

  const columns: Column<any>[] = [
    { header: "Employee", accessor: "firstName" },
    { header: "Email", accessor: "userId" },
    { header: "Phone", accessor: "phone" },
    { header: "Department", accessor: "departmentId" },
    { header: "Designation", accessor: "designationId" },
    { header: "Roles", accessor: "roleIds" },
    { header: "Manager", accessor: "managerId" },
    { header: "Shift", accessor: "shiftId" },
    { header: "Employment Type", accessor: "employmentType" },
    { header: "Status", accessor: "status" },
    { header: "Lifecycle", accessor: "employmentLifecycleStatus" },
    { header: "Benefits", accessor: "benefitsEligible" },
    { header: "Profile", accessor: "profileCompleted" },
    { header: "Join Date", accessor: "dateOfJoining" },
    ...(canAnyAction ? [{ header: "Actions", accessor: "_id" as const }] : [])
  ];

  return (
    <MainLayout
      title="Employees"
      breadcrumb={[{ label: "Home", href: "/" }, { label: "Employees" }]}
    >
      {/* Action Bar */}
      <div className="flex flex-col items-start gap-4 mb-6">
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search employees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <PermissionGate permissions={["EMP_CREATE"]}>
            <Button className="gap-2 self-end sm:self-auto" onClick={() => navigate("/employees/add")}>
              <Plus className="w-4 h-4" />
              Add Employee
            </Button>
          </PermissionGate>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full">
          {canEdit && !isSuperAdmin && (
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => setBulkPanelOpen((prev) => !prev)}
            >
              {bulkPanelOpen ? "Hide Bulk Update" : "Show Bulk Update"}
              {bulkPanelOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          )}
          {isSuperAdmin && (
            <Select
              value={selectedOrgId}
              onValueChange={(value) => {
                if (value) {
                  setSearchParams({ organizationId: value });
                } else {
                  setSearchParams({});
                }
              }}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Select Organization" />
              </SelectTrigger>
              <SelectContent>
                <div className="p-2">
                  <Input
                    placeholder="Search organization..."
                    value={orgSearch}
                    onChange={(e) => setOrgSearch(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
                {filteredOrganizations.map((org) => (
                  <SelectItem key={org._id} value={org._id}>
                    {org.name}
                  </SelectItem>
                ))}
                {filteredOrganizations.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">No organizations found</div>
                )}
              </SelectContent>
            </Select>
          )}
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <div className="p-2">
                <Input
                  placeholder="Search department..."
                  value={deptSearch}
                  onChange={(e) => setDeptSearch(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
              <SelectItem value="all">All Departments</SelectItem>
              {filteredDepartments.map((dept) => (
                <SelectItem key={dept._id} value={dept._id}>
                  {dept.name}
                </SelectItem>
              ))}
              {filteredDepartments.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">No departments found</div>
              )}
            </SelectContent>
          </Select>
          <Select value={designationFilter} onValueChange={setDesignationFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Designation" />
            </SelectTrigger>
            <SelectContent>
              <div className="p-2">
                <Input
                  placeholder="Search designation..."
                  value={designationSearch}
                  onChange={(e) => setDesignationSearch(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
              <SelectItem value="all">All Designations</SelectItem>
              {filteredDesignations.map((designation) => (
                <SelectItem key={designation._id} value={designation._id}>
                  {designation.name}
                </SelectItem>
              ))}
              {filteredDesignations.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">No designations found</div>
              )}
            </SelectContent>
          </Select>
          <Select value={managerFilter} onValueChange={setManagerFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Manager" />
            </SelectTrigger>
            <SelectContent>
              <div className="p-2">
                <Input
                  placeholder="Search manager..."
                  value={managerSearch}
                  onChange={(e) => setManagerSearch(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
              <SelectItem value="all">All Managers</SelectItem>
              {filteredManagers.map((manager) => (
                <SelectItem key={manager._id} value={manager._id}>
                  {manager.name}
                </SelectItem>
              ))}
              {filteredManagers.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">No managers found</div>
              )}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="on_leave">On Leave</SelectItem>
              <SelectItem value="resigned">Resigned</SelectItem>
            </SelectContent>
          </Select>
          <Select value={employmentTypeFilter} onValueChange={setEmploymentTypeFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Employment Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="full_time">Full Time</SelectItem>
              <SelectItem value="part_time">Part Time</SelectItem>
              <SelectItem value="contract">Contract</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => {
              setSearchQuery("");
              setDepartmentFilter("all");
              setDesignationFilter("all");
              setManagerFilter("all");
              setStatusFilter("all");
              setEmploymentTypeFilter("all");
              setSortBy("createdAt");
              setSortOrder("desc");
            }}
          >
            Reset
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
      </div>

      {canEdit && (
        <div className="mb-6">
          {/* <div className="bg-card rounded-xl card-shadow p-3">
            <div className="text-sm text-muted-foreground">
              Bulk update selected employees: <span className="font-medium text-foreground">{selectedEmployeeIds.length}</span>
            </div>
          </div> */}

          <AnimatePresence initial={false}>
            {bulkPanelOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="bg-card rounded-xl card-shadow p-4 mt-3 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <Select value={bulkShiftId} onValueChange={setBulkShiftId}>
                      <SelectTrigger><SelectValue placeholder="Assign Shift" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Shift: No Change</SelectItem>
                        <SelectItem value="clear">Shift: Clear</SelectItem>
                        {shifts.map((shift: any) => (
                          <SelectItem key={shift._id} value={shift._id}>
                            {shift.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={bulkManagerId} onValueChange={setBulkManagerId}>
                      <SelectTrigger><SelectValue placeholder="Assign Manager" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Manager: No Change</SelectItem>
                        <SelectItem value="clear">Manager: Clear</SelectItem>
                        {managers.map((manager: any) => (
                          <SelectItem key={manager._id} value={manager._id}>
                            {manager.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={bulkDepartmentId} onValueChange={setBulkDepartmentId}>
                      <SelectTrigger><SelectValue placeholder="Assign Department" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Department: No Change</SelectItem>
                        {departments.map((dept: any) => (
                          <SelectItem key={dept._id} value={dept._id}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={bulkDesignationId} onValueChange={setBulkDesignationId}>
                      <SelectTrigger><SelectValue placeholder="Assign Designation" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Designation: No Change</SelectItem>
                        {designations.map((designation: any) => (
                          <SelectItem key={designation._id} value={designation._id}>
                            {designation.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={bulkStatus} onValueChange={setBulkStatus}>
                      <SelectTrigger><SelectValue placeholder="Update Status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Status: No Change</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="on_leave">On Leave</SelectItem>
                        <SelectItem value="resigned">Resigned</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={bulkLifecycleStatus} onValueChange={setBulkLifecycleStatus}>
                      <SelectTrigger><SelectValue placeholder="Lifecycle Status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Lifecycle: No Change</SelectItem>
                        <SelectItem value="probation">Probation</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="notice">Notice</SelectItem>
                        <SelectItem value="terminated">Terminated</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Button onClick={handleBulkUpdate} disabled={bulkApplying || selectedEmployeeIds.length === 0}>
                      {bulkApplying ? "Applying..." : "Apply Bulk Update"}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Employee Table */}
      <motion.div
        className="bg-card rounded-xl card-shadow overflow-hidden flex flex-col max-h-[72vh] lg:h-[calc(100vh-240px)]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {loading && (
          <div className="sticky top-0 p-6 text-sm text-muted-foreground">Loading employees...</div>
        )}
        {!loading && (
          <div className="min-h-0 flex-1">
          <DataTable
            columns={columns}
            data={employees}
            rowKey="_id"
            hideFooter
            tableClassName="min-w-[1650px]"
            containerClassName="h-full border-0 rounded-none shadow-none bg-transparent"
            viewportClassName="h-full overflow-y-auto overflow-x-auto [&>div]:overflow-visible"
            columnsCountOverride={tableColumnCount}
            renderHeader={() => (
              <TableRow className="table-header sticky top-0 z-30 bg-card">
                <TableHead className="sticky top-0 left-0 z-40 bg-card min-w-[300px]">
                  <div className="flex items-center gap-3">
                    {canEdit && (
                      <Checkbox
                        checked={allVisibleSelected}
                        onCheckedChange={(value) => toggleSelectAllVisible(Boolean(value))}
                      />
                    )}
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 cursor-pointer select-none"
                      onClick={() => toggleSort("firstName")}
                    >
                      <span>Employee</span>
                      <ArrowUpDown className={`w-3.5 h-3.5 ${sortBy === "firstName" ? "opacity-100" : "opacity-40"}`} />
                    </button>
                  </div>
                </TableHead>
                {renderSortableHead("Email")}
                {renderSortableHead("Phone")}
                {renderSortableHead("Department")}
                {renderSortableHead("Designation")}
                {renderSortableHead("Roles")}
                {renderSortableHead("Manager")}
                {renderSortableHead("Shift")}
                {renderSortableHead("Employment Type")}
                {renderSortableHead("Status", "status")}
                {renderSortableHead("Lifecycle", "employmentLifecycleStatus")}
                {renderSortableHead("Benefits")}
                {renderSortableHead("Profile")}
                {renderSortableHead("Join Date", "dateOfJoining")}
                {canAnyAction && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            )}
            renderRow={(employee) => (
              <>
                <TableCell className="sticky left-0 z-10 bg-card">
                  <div className="flex items-center gap-3">
                    {canEdit && (
                      <Checkbox
                        checked={selectedEmployeeIds.includes(employee._id)}
                        onCheckedChange={(value) => toggleSelectOne(employee._id, Boolean(value))}
                      />
                    )}
                    <Avatar>
                      <AvatarImage src={employee.profileImage || ""} />
                      <AvatarFallback>
                        {`${employee.firstName?.[0] || ""}${employee.lastName?.[0] || ""}`}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {employee.firstName} {employee.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground">{employee.employeeCode}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{employee.userId?.email || "-"}</TableCell>
                <TableCell>{employee.phone || "-"}</TableCell>
                <TableCell>{employee.departmentId?.name || "-"}</TableCell>
                <TableCell>{employee.designationId?.name || "-"}</TableCell>
                <TableCell>
                  {Array.isArray(employee.roleIds) && employee.roleIds.length
                    ? employee.roleIds.map((role: any) => role?.name).filter(Boolean).join(", ")
                    : "-"}
                </TableCell>
                <TableCell>
                  {employee.managerId
                    ? `${employee.managerId?.firstName || ""} ${employee.managerId?.lastName || ""}`.trim()
                    : "-"}
                </TableCell>
                <TableCell>{employee.shiftId?.name || "-"}</TableCell>
                <TableCell>{employee.employmentType || "-"}</TableCell>
                <TableCell>{getStatusBadge(employee.status)}</TableCell>
                <TableCell>{getLifecycleBadge(employee.employmentLifecycleStatus)}</TableCell>
                <TableCell>{employee.benefitsEligible ? "Eligible" : "Not Eligible"}</TableCell>
                <TableCell>{employee.profileCompleted ? "Completed" : "Pending"}</TableCell>
                <TableCell>
                  {employee.dateOfJoining
                    ? formatDateInOrgTimeZone(employee.dateOfJoining)
                    : "-"}
                </TableCell>
                {canAnyAction && (
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <PermissionGate permissions={["EMP_VIEW"]}>
                          <DropdownMenuItem onClick={() => navigate(`/employees/${employee._id}`)}>
                            <Eye className="w-4 h-4 mr-2" /> View
                          </DropdownMenuItem>
                        </PermissionGate>
                        <PermissionGate permissions={["EMP_UPDATE"]}>
                          <DropdownMenuItem onClick={() => navigate(`/employees/edit/${employee._id}`)}>
                            <Edit className="w-4 h-4 mr-2" /> Edit
                          </DropdownMenuItem>
                        </PermissionGate>
                        <PermissionGate permissions={["EMP_UPDATE"]}>
                          <DropdownMenuItem
                            onClick={async () => {
                              const res = await putApiWithToken(`/employees/${employee._id}/reopen-profile`, {});
                              if (res?.success) {
                                toast.success("Profile form enabled for employee");
                                fetchEmployees();
                              } else {
                                toast.error(res?.message || "Failed to enable profile form");
                              }
                            }}
                          >
                            <Edit className="w-4 h-4 mr-2" /> Enable Details Form
                          </DropdownMenuItem>
                        </PermissionGate>
                        <PermissionGate permissions={["EMP_DELETE"]}>
                          <DropdownMenuItem onClick={() => handleDelete(employee)}>
                            <Trash2 className="w-4 h-4 mr-2 text-red-500" /> Delete
                          </DropdownMenuItem>
                        </PermissionGate>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </>
            )}
          />
          </div>
        )}
        <div className="sticky bottom-0 z-20 border-t bg-card px-4 py-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground">
                Showing page {currentPage} of {totalPages} ({totalItems} total)
              </p>
              <Select
                value={String(pageSize)}
                onValueChange={(value) => setPageSize(Number(value))}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 rows</SelectItem>
                  <SelectItem value="25">25 rows</SelectItem>
                  <SelectItem value="50">50 rows</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Pagination className="justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage > 1) setCurrentPage((p) => p - 1);
                    }}
                    className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
                {getPageItems().map((item, index) => (
                  <PaginationItem key={`${item}-${index}`}>
                    {typeof item === "number" ? (
                      <PaginationLink
                        href="#"
                        isActive={item === currentPage}
                        onClick={(e) => {
                          e.preventDefault();
                          setCurrentPage(item);
                        }}
                      >
                        {item}
                      </PaginationLink>
                    ) : (
                      <PaginationEllipsis />
                    )}
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage < totalPages) setCurrentPage((p) => p + 1);
                    }}
                    className={currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
                <PaginationItem>
                  <PaginationLink
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setCurrentPage(totalPages);
                    }}
                    className={currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}
                  >
                    Last
                  </PaginationLink>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>
      </motion.div>

      {/* Delete Confirmation */}
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

export default Employees;
