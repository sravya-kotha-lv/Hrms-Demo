import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, ChevronDown, Info } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  getApiWithToken,
  postApiWithToken,
  putApiWithToken,
} from "@/services/apiWrapper";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/* ================= TYPES ================= */

interface Option {
  _id: string;
  name: string;
}

const emptyForm = {
  email: "",
  firstName: "",
  lastName: "",
  employeeCode: "",
  departmentId: "",
  designationId: "",
  managerId: "",
  shiftId: "",
  roleIds: [] as string[],
  employmentType: "",
  dateOfJoining: "",
  employmentLifecycleStatus: "confirmed",
};

/* ================= COMPONENT ================= */

const AddEmployee = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [form, setForm] = useState(emptyForm);
  const [departments, setDepartments] = useState<Option[]>([]);
  const [designations, setDesignations] = useState<Option[]>([]);
  const [roles, setRoles] = useState<Option[]>([]);
  const [managers, setManagers] = useState<Option[]>([]);
  const [shifts, setShifts] = useState<Option[]>([]);
  const [orgProbationDays, setOrgProbationDays] = useState(90);
  const [orgNoticeDays, setOrgNoticeDays] = useState(30);
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [originalLifecycleStatus, setOriginalLifecycleStatus] = useState("confirmed");
  const [loading, setLoading] = useState(false);
  const employeeCodePrefix =
    (import.meta as any).env?.VITE_EMPLOYEE_CODE_PREFIX || "LV";

  /* ================= FETCH MASTER DATA ================= */

  useEffect(() => {
    fetchDepartments();
    fetchDesignations();
    fetchRoles();
    fetchManagers();
    fetchShifts();
    fetchOrgSettings();
    if (isEdit) {
      fetchEmployee();
    }
  }, []);

  const fetchEmployee = async () => {
    if (!id) return;
    const res = await getApiWithToken(`/employees/${id}`);
    if (res?.success && res?.data) {
      const employee = res.data;
      setForm({
        email: employee.userId?.email || "",
        firstName: employee.firstName || "",
        lastName: employee.lastName || "",
        employeeCode: employee.employeeCode || "",
        departmentId: employee.departmentId?._id || "",
        designationId: employee.designationId?._id || "",
        managerId: employee.managerId?._id || "",
        shiftId: employee.shiftId?._id || "",
        roleIds: (employee.roleIds || []).map((r: any) => r?._id).filter(Boolean),
        employmentType: employee.employmentType || "",
        dateOfJoining: employee.dateOfJoining
          ? new Date(employee.dateOfJoining).toISOString().slice(0, 10)
          : "",
        employmentLifecycleStatus:
          employee.employmentLifecycleStatus ||
          (employee.status === "resigned" ? "notice" : "confirmed"),
      });
      setOriginalLifecycleStatus(
        employee.employmentLifecycleStatus ||
        (employee.status === "resigned" ? "notice" : "confirmed")
      );
      setProfileImageUrl(employee.profileImage || "");
    } else {
      toast.error(res?.message || "Failed to load employee");
    }
  };

  const fetchDepartments = async () => {
    const res = await getApiWithToken("/departments");
    if (res?.code == 200) setDepartments(res.data || []);
  };

  const fetchDesignations = async () => {
    const res = await getApiWithToken("/designations");
    if (res?.code == 200) setDesignations(res.data || []);
  };

  const fetchRoles = async () => {
    const res = await getApiWithToken("/roles");
    if (res?.code == 200) setRoles(res.data || []);
  };

  const fetchManagers = async () => {
    const res = await getApiWithToken("/employees");
    if (res?.success) {
      const list = res.data?.items || [];
      setManagers(
        list.map((e: any) => ({
          _id: e._id,
          name: `${e.firstName || ""} ${e.lastName || ""}`.trim()
        }))
      );
    }
  };

  const fetchShifts = async () => {
    const res = await getApiWithToken("/shifts", null, { requiredPermissions: ["SHIFT_VIEW"] });
    if (res?.success) {
      setShifts((res.data || []).map((s: any) => ({ _id: s._id, name: `${s.name} (${s.startTime}-${s.endTime})` })));
    } else {
      setShifts([]);
    }
  };

  const fetchOrgSettings = async () => {
    const res = await getApiWithToken("/org-settings");
    if (res?.success && res?.data) {
      setOrgProbationDays(
        typeof res.data.probationPeriodDays === "number" ? res.data.probationPeriodDays : 90
      );
      setOrgNoticeDays(
        typeof res.data.noticePeriodDays === "number" ? res.data.noticePeriodDays : 30
      );
    }
  };

  /* ================= SUBMIT ================= */

  const getLifecycleAction = (status: string) => {
    if (status === "confirmed") return "confirm";
    if (status === "notice") return "terminate_with_notice";
    if (status === "terminated") return "terminate_without_notice";
    return "";
  };

  const handleSubmit = async () => {
    if (
      !form.email ||
      !form.firstName ||
      !form.lastName ||
      !form.departmentId ||
      !form.designationId ||
      !form.roleIds?.length ||
      !form.employmentType ||
      !form.dateOfJoining
    ) {
      toast.error("Please fill all required fields");
      return;
    }

    const payload = {
      email: form.email,
      roleIds: form.roleIds,
      firstName: form.firstName,
      lastName: form.lastName,
      departmentId: form.departmentId,
      designationId: form.designationId,
      managerId: form.managerId || undefined,
      shiftId: form.shiftId || undefined,
      employmentType: form.employmentType,
      dateOfJoining: form.dateOfJoining,
      ...(isEdit && form.employmentLifecycleStatus === "probation"
        ? { employmentLifecycleStatus: "probation" }
        : {}),
    };

    setLoading(true);
    const res = isEdit
      ? await putApiWithToken(`/employees/${id}`, payload)
      : await postApiWithToken("/employees", payload);

    if (
      isEdit &&
      res?.success &&
      form.employmentLifecycleStatus !== originalLifecycleStatus
    ) {
      const action = getLifecycleAction(form.employmentLifecycleStatus);
      if (action) {
        const lifecycleRes = await putApiWithToken(
          `/employees/${id}/lifecycle-action`,
          { action }
        );
        if (!lifecycleRes?.success) {
          setLoading(false);
          toast.error(lifecycleRes?.message || "Employee updated but lifecycle action failed");
          return;
        }
      }
    }
    setLoading(false);

    if (res?.success) {
      toast.success(isEdit ? "Employee updated" : "Employee created & onboarding email sent");
      navigate("/employees");
    } else {
      toast.error(res?.message || "Failed to save employee");
    }
  };

  /* ================= UI ================= */

  return (
    <MainLayout
      title={isEdit ? "Edit Employee" : "Add Employee"}
      breadcrumb={[
        { label: "Home", href: "/" },
        { label: "Employees", href: "/employees" },
        { label: isEdit ? "Edit Employee" : "Add Employee" },
      ]}
    >
      {!isEdit && (departments.length === 0 || designations.length === 0) && (
        <div className="mb-6 bg-card rounded-xl card-shadow p-4">
          <p className="text-sm text-muted-foreground mb-3">
            Please add {departments.length === 0 ? "a department" : "a designation"} before creating an employee.
          </p>
          <div className="flex gap-2">
            {departments.length === 0 && (
              <Button type="button" onClick={() => navigate("/departments")}>
                Add Department
              </Button>
            )}
            {designations.length === 0 && (
              <Button type="button" variant="outline" onClick={() => navigate("/designations")}>
                Add Designation
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate("/employees")}
          className="flex items-center gap-2 text-muted-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <Button
          onClick={handleSubmit}
          disabled={loading || (!isEdit && (departments.length === 0 || designations.length === 0))}
        >
          {loading ? "Saving..." : isEdit ? "Update Employee" : "Create Employee"}
        </Button>
      </div>

      {/* Form */}
      <div className="stat-card grid grid-cols-1 md:grid-cols-2 gap-4">
        {isEdit && (
          <div className="md:col-span-2 flex items-center gap-3 rounded-md border bg-muted/40 px-3 py-2">
            <Avatar className="h-12 w-12">
              <AvatarImage src={profileImageUrl || ""} />
              <AvatarFallback>
                {`${form.firstName?.[0] || ""}${form.lastName?.[0] || ""}`}
              </AvatarFallback>
            </Avatar>
            <div className="text-sm">
              <p className="font-medium">Profile Photo</p>
              <p className="text-muted-foreground">
                {profileImageUrl ? "Current profile image is shown." : "No profile image uploaded yet."}
              </p>
            </div>
          </div>
        )}

        <div className="md:col-span-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Organization policy: probation {orgProbationDays} days, notice {orgNoticeDays} days.
          {!isEdit ? " New employees start in probation automatically." : ""}
        </div>

        <div>
          <Label>Email *</Label>
          <Input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="employee@email.com"
          />
        </div>

        <div>
          <Label>Employee Code (Auto)</Label>
          <Input
            value={isEdit ? form.employeeCode : `${employeeCodePrefix}-AUTO`}
            disabled
          />
        </div>

        <div>
          <Label>First Name *</Label>
          <Input
            value={form.firstName}
            onChange={(e) =>
              setForm({ ...form, firstName: e.target.value })
            }
          />
        </div>

        <div>
          <Label>Last Name *</Label>
          <Input
            value={form.lastName}
            onChange={(e) =>
              setForm({ ...form, lastName: e.target.value })
            }
          />
        </div>

        <div>
          <Label>Department *</Label>
          <Select
            value={form.departmentId}
            onValueChange={(v) => {
              if (v === "__create__") {
                navigate("/departments");
                return;
              }
              setForm({ ...form, departmentId: v });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__create__">+ Create Department</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d._id} value={d._id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Designation *</Label>
          <Select
            value={form.designationId}
            onValueChange={(v) => {
              if (v === "__create__") {
                navigate("/designations");
                return;
              }
              setForm({ ...form, designationId: v });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Designation" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__create__">+ Create Designation</SelectItem>
              {designations.map((d) => (
                <SelectItem key={d._id} value={d._id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Reporting Manager *</Label>
          <Select
            value={form.managerId}
            onValueChange={(v) =>
              setForm({ ...form, managerId: v === "none" ? "" : v })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Manager" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {managers.map((m) => (
                <SelectItem key={m._id} value={m._id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <div className="flex items-center gap-1 mb-1">
            <Label>Shift</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                Assign employee shift for late/early login calculations. If none selected, default 09:00-18:00 is used.
              </TooltipContent>
            </Tooltip>
          </div>
          <Select
            value={form.shiftId}
            onValueChange={(v) => {
              if (v === "__create__") {
                navigate("/shifts");
                return;
              }
              setForm({ ...form, shiftId: v === "none" ? "" : v });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Shift" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None (General 09:00-18:00)</SelectItem>
              <SelectItem value="__create__">+ Create Shift</SelectItem>
              {shifts.map((s) => (
                <SelectItem key={s._id} value={s._id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Roles *</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                className="mt-2 w-full justify-between"
              >
                {form.roleIds.length === 0
                  ? "Select roles"
                  : form.roleIds.length <= 2
                    ? roles
                        .filter((r) => form.roleIds.includes(r._id))
                        .map((r) => r.name)
                        .join(", ")
                    : `${form.roleIds.length} roles selected`}
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[320px]" align="start">
              <Command>
                <CommandInput placeholder="Search roles..." />
                <CommandList>
                  <CommandEmpty>No roles found.</CommandEmpty>
                  <CommandGroup>
                    {roles.map((r) => {
                      const checked = form.roleIds.includes(r._id);
                      return (
                        <CommandItem
                          key={r._id}
                          onSelect={() => {
                            setForm((prev) => ({
                              ...prev,
                              roleIds: checked
                                ? (prev.roleIds || []).filter((id) => id !== r._id)
                                : Array.from(new Set([...(prev.roleIds || []), r._id])),
                            }));
                          }}
                        >
                          <Checkbox checked={checked} className="mr-2" />
                          <span>{r.name}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div>
          <Label>Employment Type *</Label>
          <Select
            value={form.employmentType}
            onValueChange={(v) =>
              setForm({ ...form, employmentType: v })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full_time">Full Time</SelectItem>
              <SelectItem value="part_time">Part Time</SelectItem>
              <SelectItem value="contract">Contract</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Date of Joining *</Label>
          <Input
            type="date"
            value={form.dateOfJoining}
            onChange={(e) =>
              setForm({ ...form, dateOfJoining: e.target.value })
            }
          />
        </div>

        {isEdit && (
          <div className="md:col-span-2 space-y-3">
            <Label>Employment Lifecycle Status *</Label>
            <Select
              value={form.employmentLifecycleStatus}
              onValueChange={(v) =>
                setForm({ ...form, employmentLifecycleStatus: v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select lifecycle status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="probation">Probation</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="notice">Notice</SelectItem>
                <SelectItem value="terminated">Terminated</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={form.employmentLifecycleStatus === "confirmed" ? "default" : "outline"}
                onClick={() =>
                  setForm({ ...form, employmentLifecycleStatus: "confirmed" })
                }
              >
                Confirm
              </Button>
              <Button
                type="button"
                size="sm"
                variant={form.employmentLifecycleStatus === "notice" ? "default" : "outline"}
                onClick={() =>
                  setForm({ ...form, employmentLifecycleStatus: "notice" })
                }
              >
                Terminate with Notice
              </Button>
              <Button
                type="button"
                size="sm"
                variant={form.employmentLifecycleStatus === "terminated" ? "destructive" : "outline"}
                onClick={() =>
                  setForm({ ...form, employmentLifecycleStatus: "terminated" })
                }
              >
                Terminate without Notice
              </Button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default AddEmployee;
