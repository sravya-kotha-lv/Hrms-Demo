import { useEffect, useMemo, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { hasAnyPermission } from "@/utils/auth";
import { Switch } from "@/components/ui/switch";

/* ================= TYPES ================= */

interface Option {
  _id: string;
  name: string;
}

type PayGroup = {
  id: string;
  code: string;
  name: string;
  pay_frequency: string;
  is_active: boolean;
  metadata?: Record<string, any>;
};

type PayrollProfile = {
  id: string;
  employee_external_id: string;
  pay_group_id?: string | null;
  payroll_status?: string;
  default_payment_mode?: string;
  tax_regime?: string;
  date_of_joining?: string | null;
};

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
  const [activeTab, setActiveTab] = useState("employee");
  const [payGroups, setPayGroups] = useState<PayGroup[]>([]);
  const [payrollProfileId, setPayrollProfileId] = useState<string>("");
  const [savingSalary, setSavingSalary] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [lookingUpIfsc, setLookingUpIfsc] = useState(false);
  const [lookingUpAccount, setLookingUpAccount] = useState(false);
  const [currentSalaryEffectiveFrom, setCurrentSalaryEffectiveFrom] = useState("");
  const [salaryAutoCalc, setSalaryAutoCalc] = useState(true);
  const [salaryForm, setSalaryForm] = useState({
    payGroupId: "",
    payrollStatus: "active",
    defaultPaymentMode: "bank_transfer",
    taxRegime: "new",
    basicPercentSource: "pay_group",
    employeeBasicPercent: "",
    hraPercentOfBasic: "50",
    epfMode: "percentage",
    epfPercentOfBasic: "12",
    epfFixedAmount: "",
    restrictPfWage: true,
    pfWageCeiling: "15000",
    includeEsi: true,
    annualCtc: "",
    monthlyGross: "",
    basicPay: "",
    variablePay: "0",
    effectiveFrom: new Date().toISOString().slice(0, 10),
    revisionReason: "Initial salary setup"
  });
  const [bankForm, setBankForm] = useState({
    accountHolderName: "",
    bankName: "",
    branchName: "",
    accountNumber: "",
    ifscCode: "",
    accountType: "salary",
    paymentMode: "bank_transfer",
    upiId: "",
    isPrimary: true,
    isVerified: false,
    effectiveFrom: new Date().toISOString().slice(0, 10)
  });
  const canManagePayroll = hasAnyPermission(["PAYROLL_CONFIG_MANAGE"]);
  const employeeCodePrefix =
    (import.meta as any).env?.VITE_EMPLOYEE_CODE_PREFIX || "LV";

  const selectedPayGroup = useMemo(
    () => payGroups.find((row) => row.id === salaryForm.payGroupId) || null,
    [payGroups, salaryForm.payGroupId]
  );

  const payGroupBasicPercent = Number(
    selectedPayGroup?.metadata?.salaryRules?.basicPercent ??
      selectedPayGroup?.metadata?.basicPercent ??
      50
  );
  const effectiveBasicPercent = Number(
    salaryForm.basicPercentSource === "employee"
      ? salaryForm.employeeBasicPercent || payGroupBasicPercent
      : payGroupBasicPercent
  );

  const salaryBreakdown = useMemo(() => {
    const annualCtc = Number(salaryForm.annualCtc || 0);
    const monthlyGross = Number(salaryForm.monthlyGross || 0);
    const monthlyCtc = Number((annualCtc / 12).toFixed(2));
    const basicPay = Number(salaryForm.basicPay || 0);
    const hraPercent = Math.max(0, Number(salaryForm.hraPercentOfBasic || 0));
    const hraAmount = Number((basicPay * (hraPercent / 100)).toFixed(2));
    const fixedAllowance = Number(
      (monthlyGross - basicPay - hraAmount).toFixed(2)
    );
    const epfBase = salaryForm.restrictPfWage
      ? Math.min(basicPay, Number(salaryForm.pfWageCeiling || 15000))
      : basicPay;
    const employerEpf =
      salaryForm.epfMode === "fixed"
        ? Number(salaryForm.epfFixedAmount || 0)
        : Number((epfBase * (Number(salaryForm.epfPercentOfBasic || 12) / 100)).toFixed(2));
    const esiAmount = salaryForm.includeEsi
      ? Number(Math.min((basicPay * 8.33) / 100, 1250).toFixed(2))
      : 0;

    return {
      annualCtc,
      monthlyCtc,
      monthlyGross,
      basicPay,
      hraAmount,
      fixedAllowance,
      employerEpf,
      esiAmount
    };
  }, [
    salaryForm.annualCtc,
    salaryForm.monthlyGross,
    salaryForm.basicPay,
    salaryForm.hraPercentOfBasic,
    salaryForm.epfMode,
    salaryForm.epfPercentOfBasic,
    salaryForm.epfFixedAmount,
    salaryForm.restrictPfWage,
    salaryForm.pfWageCeiling,
    salaryForm.includeEsi
  ]);

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
      fetchPayrollData();
    }
    if (canManagePayroll) {
      fetchPayGroups();
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

  const fetchPayGroups = async () => {
    const res = await getApiWithToken("/payroll/pay-groups", null, {
      requiredPermissions: ["PAYROLL_CONFIG_MANAGE"]
    });
    if (res?.success) {
      const rows = Array.isArray(res.data) ? res.data : [];
      setPayGroups(rows);
      setSalaryForm((prev) => {
        if (prev.payGroupId) return prev;
        return { ...prev, payGroupId: rows[0]?.id || "" };
      });
    }
  };

  const fetchPayrollData = async () => {
    if (!id || !canManagePayroll) return;
    const profileListRes = await getApiWithToken(
      `/payroll/employee-profiles?employeeExternalId=${id}`,
      null,
      { requiredPermissions: ["PAYROLL_CONFIG_MANAGE"] }
    );
    if (!profileListRes?.success || !Array.isArray(profileListRes.data) || !profileListRes.data[0]) {
      return;
    }

    const profile = profileListRes.data[0] as PayrollProfile;
    setPayrollProfileId(profile.id);

    const detailRes = await getApiWithToken(`/payroll/employee-profiles/${profile.id}`, null, {
      requiredPermissions: ["PAYROLL_CONFIG_MANAGE"]
    });

    if (!detailRes?.success || !detailRes?.data) return;
    const detail = detailRes.data;
    const salaryStructures = Array.isArray(detail.salaryStructures) ? detail.salaryStructures : [];
    const bankDetails = Array.isArray(detail.bankDetails) ? detail.bankDetails : [];
    const currentSalary =
      salaryStructures.find((row: any) => row.is_current) || salaryStructures[0] || null;
    const currentBank = bankDetails[0] || null;
    setCurrentSalaryEffectiveFrom((currentSalary?.effective_from || "").slice(0, 10));
    const salaryRules = currentSalary?.metadata?.salaryRules || {};

    setSalaryForm((prev) => ({
      ...prev,
      payGroupId: detail.pay_group_id || prev.payGroupId || "",
      payrollStatus: detail.payroll_status || "active",
      defaultPaymentMode: detail.default_payment_mode || "bank_transfer",
      taxRegime: detail.tax_regime || "new",
      basicPercentSource: salaryRules.basicPercentSource || "pay_group",
      employeeBasicPercent:
        salaryRules.employeeBasicPercent !== undefined && salaryRules.employeeBasicPercent !== null
          ? String(salaryRules.employeeBasicPercent)
          : "",
      hraPercentOfBasic:
        salaryRules.hraPercentOfBasic !== undefined && salaryRules.hraPercentOfBasic !== null
          ? String(salaryRules.hraPercentOfBasic)
          : prev.hraPercentOfBasic,
      epfMode: salaryRules.epfMode || prev.epfMode,
      epfPercentOfBasic:
        salaryRules.epfPercentOfBasic !== undefined && salaryRules.epfPercentOfBasic !== null
          ? String(salaryRules.epfPercentOfBasic)
          : prev.epfPercentOfBasic,
      epfFixedAmount:
        salaryRules.epfFixedAmount !== undefined && salaryRules.epfFixedAmount !== null
          ? String(salaryRules.epfFixedAmount)
          : prev.epfFixedAmount,
      restrictPfWage:
        typeof salaryRules.restrictPfWage === "boolean"
          ? salaryRules.restrictPfWage
          : prev.restrictPfWage,
      pfWageCeiling:
        salaryRules.pfWageCeiling !== undefined && salaryRules.pfWageCeiling !== null
          ? String(salaryRules.pfWageCeiling)
          : prev.pfWageCeiling,
      includeEsi:
        typeof salaryRules.includeEsi === "boolean" ? salaryRules.includeEsi : prev.includeEsi,
      annualCtc: currentSalary?.annual_ctc ? String(currentSalary.annual_ctc) : "",
      monthlyGross: currentSalary?.monthly_gross ? String(currentSalary.monthly_gross) : "",
      basicPay: currentSalary?.basic_pay ? String(currentSalary.basic_pay) : "",
      variablePay:
        currentSalary?.variable_pay !== undefined && currentSalary?.variable_pay !== null
          ? String(currentSalary.variable_pay)
          : "0",
      effectiveFrom:
        (currentSalary?.effective_from || "").slice(0, 10) ||
        detail?.date_of_joining?.slice(0, 10) ||
        prev.effectiveFrom
    }));

    setBankForm((prev) => ({
      ...prev,
      accountHolderName: currentBank?.account_holder_name || "",
      bankName: currentBank?.bank_name || "",
      branchName: currentBank?.branch_name || "",
      accountNumber: currentBank?.account_number || "",
      ifscCode: currentBank?.ifsc_code || "",
      accountType: currentBank?.account_type || prev.accountType,
      paymentMode: currentBank?.payment_mode || detail.default_payment_mode || prev.paymentMode,
      upiId: currentBank?.upi_id || "",
      isPrimary: typeof currentBank?.is_primary === "boolean" ? currentBank.is_primary : true,
      isVerified: typeof currentBank?.is_verified === "boolean" ? currentBank.is_verified : false,
      effectiveFrom:
        (currentBank?.effective_from || "").slice(0, 10) ||
        detail?.date_of_joining?.slice(0, 10) ||
        prev.effectiveFrom
    }));
  };

  useEffect(() => {
    if (!salaryAutoCalc) return;
    const annualCtc = Number(salaryForm.annualCtc || 0);
    if (!annualCtc || annualCtc <= 0) return;
    if (!salaryForm.payGroupId) return;
    const basicPercent = Math.max(1, Math.min(100, Number(effectiveBasicPercent || 50)));
    const hraPercent = Math.max(0, Number(salaryForm.hraPercentOfBasic || 0));
    const monthlyCtc = Number((annualCtc / 12).toFixed(2));
    const basicPay = Number((monthlyCtc * (basicPercent / 100)).toFixed(2));
    const hraAmount = Number((basicPay * (hraPercent / 100)).toFixed(2));
    const epfBase = salaryForm.restrictPfWage
      ? Math.min(basicPay, Number(salaryForm.pfWageCeiling || 15000))
      : basicPay;
    const employerEpf =
      salaryForm.epfMode === "fixed"
        ? Number(salaryForm.epfFixedAmount || 0)
        : Number((epfBase * (Number(salaryForm.epfPercentOfBasic || 12) / 100)).toFixed(2));
    const esiAmount = salaryForm.includeEsi
      ? Number(Math.min((basicPay * 8.33) / 100, 1250).toFixed(2))
      : 0;
    const monthlyGross = Number((monthlyCtc - employerEpf - esiAmount).toFixed(2));
    const variablePay = Number((monthlyGross - basicPay - hraAmount).toFixed(2));

    setSalaryForm((prev) => {
      const next = {
        ...prev,
        monthlyGross: String(monthlyGross),
        basicPay: String(basicPay),
        variablePay: String(variablePay)
      };

      if (
        prev.monthlyGross === next.monthlyGross &&
        prev.basicPay === next.basicPay &&
        prev.variablePay === next.variablePay
      ) {
        return prev;
      }
      return next;
    });
  }, [
    salaryAutoCalc,
    salaryForm.annualCtc,
    salaryForm.payGroupId,
    salaryForm.hraPercentOfBasic,
    salaryForm.epfMode,
    salaryForm.epfPercentOfBasic,
    salaryForm.epfFixedAmount,
    salaryForm.restrictPfWage,
    salaryForm.pfWageCeiling,
    salaryForm.includeEsi,
    effectiveBasicPercent
  ]);

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

  const handleSaveSalary = async () => {
    if (!isEdit || !id) {
      toast.error("Create employee first, then configure salary details");
      return;
    }
    if (!canManagePayroll) {
      toast.error("You do not have payroll configuration permission");
      return;
    }
    if (!salaryForm.payGroupId) {
      toast.error("Select a pay group");
      return;
    }
    if (!salaryForm.annualCtc) {
      toast.error("Annual CTC is required");
      return;
    }
    if (
      currentSalaryEffectiveFrom &&
      salaryForm.effectiveFrom &&
      salaryForm.effectiveFrom < currentSalaryEffectiveFrom
    ) {
      toast.error(
        `Effective From cannot be earlier than current salary start date (${currentSalaryEffectiveFrom})`
      );
      return;
    }

    setSavingSalary(true);
    try {
      let profileId = payrollProfileId;
      if (!profileId) {
        const createProfileRes = await postApiWithToken(
          "/payroll/employee-profiles",
          {
            employeeExternalId: id,
            employeeCode: form.employeeCode || undefined,
            payGroupId: salaryForm.payGroupId,
            payrollStatus: salaryForm.payrollStatus,
            defaultPaymentMode: salaryForm.defaultPaymentMode,
            taxRegime: salaryForm.taxRegime,
            dateOfJoining: form.dateOfJoining || undefined
          },
          null,
          { requiredPermissions: ["PAYROLL_CONFIG_MANAGE"] }
        );

        if (!createProfileRes?.success || !createProfileRes?.data?.id) {
          toast.error(createProfileRes?.message || "Failed to create payroll profile");
          return;
        }
        profileId = createProfileRes.data.id;
        setPayrollProfileId(profileId);
      } else {
        const updateProfileRes = await putApiWithToken(
          `/payroll/employee-profiles/${profileId}`,
          {
            payGroupId: salaryForm.payGroupId,
            payrollStatus: salaryForm.payrollStatus,
            defaultPaymentMode: salaryForm.defaultPaymentMode,
            taxRegime: salaryForm.taxRegime
          },
          null,
          { requiredPermissions: ["PAYROLL_CONFIG_MANAGE"] }
        );
        if (!updateProfileRes?.success) {
          toast.error(updateProfileRes?.message || "Failed to update payroll profile");
          return;
        }
      }

      const saveSalaryRes = await postApiWithToken(
        `/payroll/employee-profiles/${profileId}/salary-structures`,
        {
          structureCode: `SAL-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`,
          structureName: "Standard Structure",
          annualCtc: Number(salaryForm.annualCtc),
          monthlyGross: salaryForm.monthlyGross ? Number(salaryForm.monthlyGross) : null,
          basicPay: salaryForm.basicPay ? Number(salaryForm.basicPay) : null,
          variablePay: salaryForm.variablePay ? Number(salaryForm.variablePay) : 0,
          isCurrent: true,
          revisionReason: salaryForm.revisionReason || "Salary update",
          effectiveFrom: salaryForm.effectiveFrom,
          metadata: {
            salaryRules: {
              basicPercentSource: salaryForm.basicPercentSource,
              payGroupBasicPercent,
              employeeBasicPercent:
                salaryForm.basicPercentSource === "employee"
                  ? Number(salaryForm.employeeBasicPercent || effectiveBasicPercent)
                  : null,
              effectiveBasicPercent,
              hraPercentOfBasic: Number(salaryForm.hraPercentOfBasic || 0),
              epfMode: salaryForm.epfMode,
              epfPercentOfBasic: Number(salaryForm.epfPercentOfBasic || 12),
              epfFixedAmount:
                salaryForm.epfMode === "fixed" ? Number(salaryForm.epfFixedAmount || 0) : null,
              restrictPfWage: salaryForm.restrictPfWage,
              pfWageCeiling: Number(salaryForm.pfWageCeiling || 15000),
              includeEsi: salaryForm.includeEsi
            }
          }
        },
        null,
        { requiredPermissions: ["PAYROLL_CONFIG_MANAGE"] }
      );

      if (!saveSalaryRes?.success) {
        toast.error(saveSalaryRes?.message || "Failed to save salary structure");
        return;
      }

      toast.success("Salary details saved");
      fetchPayrollData();
    } finally {
      setSavingSalary(false);
    }
  };

  const handleSaveBank = async () => {
    if (!isEdit || !id) {
      toast.error("Create employee first, then configure bank details");
      return;
    }
    if (!canManagePayroll) {
      toast.error("You do not have payroll configuration permission");
      return;
    }
    if (!bankForm.effectiveFrom) {
      toast.error("Effective From date is required for bank details");
      return;
    }
    if (bankForm.paymentMode === "bank_transfer") {
      if (
        !bankForm.accountHolderName ||
        !bankForm.bankName ||
        !bankForm.accountNumber ||
        !bankForm.ifscCode
      ) {
        toast.error("For bank transfer, account holder, bank name, account number, and IFSC are required");
        return;
      }
    }
    if (bankForm.paymentMode === "upi" && !bankForm.upiId) {
      toast.error("UPI ID is required when payment mode is UPI");
      return;
    }

    setSavingBank(true);
    try {
      let profileId = payrollProfileId;
      if (!profileId) {
        const createProfileRes = await postApiWithToken(
          "/payroll/employee-profiles",
          {
            employeeExternalId: id,
            employeeCode: form.employeeCode || undefined,
            payGroupId: salaryForm.payGroupId || null,
            payrollStatus: salaryForm.payrollStatus,
            defaultPaymentMode: bankForm.paymentMode,
            taxRegime: salaryForm.taxRegime,
            dateOfJoining: form.dateOfJoining || undefined
          },
          null,
          { requiredPermissions: ["PAYROLL_CONFIG_MANAGE"] }
        );

        if (!createProfileRes?.success || !createProfileRes?.data?.id) {
          toast.error(createProfileRes?.message || "Failed to create payroll profile");
          return;
        }
        profileId = createProfileRes.data.id;
        setPayrollProfileId(profileId);
      }

      const profileUpdateRes = await putApiWithToken(
        `/payroll/employee-profiles/${profileId}`,
        {
          defaultPaymentMode: bankForm.paymentMode
        },
        null,
        { requiredPermissions: ["PAYROLL_CONFIG_MANAGE"] }
      );
      if (!profileUpdateRes?.success) {
        toast.error(profileUpdateRes?.message || "Failed to update payroll profile payment mode");
        return;
      }

      const saveBankRes = await postApiWithToken(
        `/payroll/employee-profiles/${profileId}/bank-details`,
        {
          accountHolderName: bankForm.accountHolderName || null,
          bankName: bankForm.bankName || null,
          branchName: bankForm.branchName || null,
          accountNumber: bankForm.accountNumber || null,
          ifscCode: bankForm.ifscCode || null,
          accountType: bankForm.accountType,
          paymentMode: bankForm.paymentMode,
          upiId: bankForm.upiId || null,
          isPrimary: bankForm.isPrimary,
          isVerified: bankForm.isVerified,
          effectiveFrom: bankForm.effectiveFrom
        },
        null,
        { requiredPermissions: ["PAYROLL_CONFIG_MANAGE"] }
      );

      if (!saveBankRes?.success) {
        toast.error(saveBankRes?.message || "Failed to save bank details");
        return;
      }

      toast.success("Bank details saved");
      fetchPayrollData();
    } finally {
      setSavingBank(false);
    }
  };

  const lookupBankByIfsc = async (ifscInput?: string) => {
    if (!canManagePayroll) return;
    const ifsc = String(ifscInput ?? bankForm.ifscCode ?? "")
      .trim()
      .toUpperCase();
    if (ifsc.length !== 11) return;

    setLookingUpIfsc(true);
    try {
      const res = await getApiWithToken(`/payroll/bank-details/lookup/by-ifsc/${ifsc}`, null, {
        requiredPermissions: ["PAYROLL_CONFIG_MANAGE"]
      });
      if (!res?.success || !res?.data) return;

      const bankName = String(res.data.bankName || "").trim();
      const branchName = String(res.data.branchName || "").trim();
      if (!bankName && !branchName) return;

      setBankForm((prev) => ({
        ...prev,
        ifscCode: ifsc,
        bankName: bankName || prev.bankName,
        branchName: branchName || prev.branchName
      }));
      toast.success("Bank and branch details fetched from IFSC");
    } finally {
      setLookingUpIfsc(false);
    }
  };

  const lookupBankByAccount = async (accountInput?: string) => {
    if (!canManagePayroll) return;
    const accountNumber = String(accountInput ?? bankForm.accountNumber ?? "").trim();
    if (accountNumber.length < 6) return;

    setLookingUpAccount(true);
    try {
      const res = await getApiWithToken(
        `/payroll/bank-details/lookup/by-account?accountNumber=${encodeURIComponent(accountNumber)}`,
        null,
        { requiredPermissions: ["PAYROLL_CONFIG_MANAGE"] }
      );
      if (!res?.success || !res?.data) return;

      const row = res.data;
      setBankForm((prev) => ({
        ...prev,
        accountHolderName: prev.accountHolderName || row.account_holder_name || "",
        bankName: prev.bankName || row.bank_name || "",
        branchName: prev.branchName || row.branch_name || "",
        ifscCode: prev.ifscCode || row.ifsc_code || "",
        accountType: prev.accountType || row.account_type || prev.accountType,
        paymentMode: prev.paymentMode || row.payment_mode || prev.paymentMode
      }));
      toast.success("Existing bank details found for this account number");
    } finally {
      setLookingUpAccount(false);
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

      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4 h-auto rounded-lg border bg-muted/40 p-1">
          <TabsTrigger
            value="employee"
            className="rounded-md px-4 py-2 font-medium text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
          >
            Employee Details
          </TabsTrigger>
          <TabsTrigger
            value="salary"
            className="rounded-md px-4 py-2 font-medium text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
          >
            Salary Details
          </TabsTrigger>
          <TabsTrigger
            value="bank"
            className="rounded-md px-4 py-2 font-medium text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
          >
            Bank Details
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employee">
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
          <Label>
            Email <span className="text-red-600">*</span>
          </Label>
          <Input
            validationType="email"
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
          <Label>
            First Name <span className="text-red-600">*</span>
          </Label>
          <Input
            value={form.firstName}
            validationType="name"
            onChange={(e) =>
              setForm({ ...form, firstName: e.target.value })
            }
          />
        </div>

        <div>
          <Label>
            Last Name <span className="text-red-600">*</span>
          </Label>
          <Input
            value={form.lastName}
            validationType="name"
            onChange={(e) =>
              setForm({ ...form, lastName: e.target.value })
            }
          />
        </div>

        <div>
          <Label>
            Department <span className="text-red-600">*</span>
          </Label>
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
          <Label>
            Designation <span className="text-red-600">*</span>
          </Label>
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
          <Label>Reporting Manager</Label>
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
          <Label>
            Roles <span className="text-red-600">*</span>
          </Label>
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
          <Label>
            Employment Type <span className="text-red-600">*</span>
          </Label>
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
          <Label>
            Date of Joining <span className="text-red-600">*</span>
          </Label>
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
            <Label>
              Employment Lifecycle Status <span className="text-red-600">*</span>
            </Label>
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
          <div className="mt-4 flex justify-end">
            <Button
              onClick={handleSubmit}
              disabled={loading || (!isEdit && (departments.length === 0 || designations.length === 0))}
            >
              {loading
                ? isEdit
                  ? "Updating Employee..."
                  : "Creating Employee..."
                : isEdit
                  ? "Update Employee"
                  : "Create Employee"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="salary">
          <div className="stat-card space-y-4">
            {!isEdit ? (
              <p className="text-sm text-muted-foreground">
                Save employee first. Then open this tab to configure payroll and salary details.
              </p>
            ) : !canManagePayroll ? (
              <p className="text-sm text-muted-foreground">
                You need `PAYROLL_CONFIG_MANAGE` permission to configure salary details.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">Auto Calculate From CTC + Pay Group</p>
                    <p className="text-xs text-muted-foreground">
                      Monthly Gross = CTC/12, Basic = configured % in pay group, Variable = remaining.
                    </p>
                  </div>
                  <Switch checked={salaryAutoCalc} onCheckedChange={setSalaryAutoCalc} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>
                      Pay Group <span className="text-red-600">*</span>
                    </Label>
                    <Select
                      value={salaryForm.payGroupId}
                      onValueChange={(v) => setSalaryForm((prev) => ({ ...prev, payGroupId: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select pay group" />
                      </SelectTrigger>
                      <SelectContent>
                        {payGroups
                          .filter((row) => row.is_active)
                          .map((group) => (
                            <SelectItem key={group.id} value={group.id}>
                              {group.name} ({group.code})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Payroll Status</Label>
                    <Select
                      value={salaryForm.payrollStatus}
                      onValueChange={(v) =>
                        setSalaryForm((prev) => ({ ...prev, payrollStatus: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="on_hold">On Hold</SelectItem>
                        <SelectItem value="exited">Exited</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Payment Mode</Label>
                    <Select
                      value={salaryForm.defaultPaymentMode}
                      onValueChange={(v) =>
                        setSalaryForm((prev) => ({ ...prev, defaultPaymentMode: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Tax Regime</Label>
                    <Select
                      value={salaryForm.taxRegime}
                      onValueChange={(v) =>
                        setSalaryForm((prev) => ({ ...prev, taxRegime: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New Regime</SelectItem>
                        <SelectItem value="old">Old Regime</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>
                      Annual CTC <span className="text-red-600">*</span>
                    </Label>
                    <Input
                      type="number"
                      value={salaryForm.annualCtc}
                      onChange={(e) =>
                        setSalaryForm((prev) => ({ ...prev, annualCtc: e.target.value }))
                      }
                      placeholder="e.g. 720000"
                    />
                  </div>

                  <div>
                    <Label>Basic % Rule Source</Label>
                    <Select
                      value={salaryForm.basicPercentSource}
                      onValueChange={(v) =>
                        setSalaryForm((prev) => ({ ...prev, basicPercentSource: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pay_group">Use Pay Group %</SelectItem>
                        <SelectItem value="employee">Set Employee %</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {salaryForm.basicPercentSource === "employee" && (
                    <div>
                      <Label>Employee Basic % of CTC</Label>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={salaryForm.employeeBasicPercent}
                        onChange={(e) =>
                          setSalaryForm((prev) => ({
                            ...prev,
                            employeeBasicPercent: e.target.value
                          }))
                        }
                        placeholder="e.g. 45"
                      />
                    </div>
                  )}

                  <div>
                    <Label>HRA % of Basic</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={salaryForm.hraPercentOfBasic}
                      onChange={(e) =>
                        setSalaryForm((prev) => ({
                          ...prev,
                          hraPercentOfBasic: e.target.value
                        }))
                      }
                    />
                  </div>

                  <div>
                    <Label>Monthly Gross</Label>
                    <Input
                      type="number"
                      value={salaryForm.monthlyGross}
                      onChange={(e) =>
                        setSalaryForm((prev) => ({ ...prev, monthlyGross: e.target.value }))
                      }
                      placeholder="Optional (auto from CTC if blank)"
                    />
                    {salaryAutoCalc && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Auto-balanced from Annual CTC after EPF/ESI employer contributions.
                      </p>
                    )}
                  </div>

                  <div>
                    <Label>Basic Pay (Monthly)</Label>
                    <Input
                      type="number"
                      value={salaryForm.basicPay}
                      onChange={(e) =>
                        setSalaryForm((prev) => ({ ...prev, basicPay: e.target.value }))
                      }
                      placeholder="Optional (engine fallback if blank)"
                    />
                    {salaryAutoCalc && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Basic uses{" "}
                        {salaryForm.basicPercentSource === "employee" ? "employee override" : "pay group"}:{" "}
                        {Number(effectiveBasicPercent || 0).toFixed(2)}% of monthly gross.
                      </p>
                    )}
                  </div>

                  <div>
                    <Label>Variable Pay (Monthly)</Label>
                    <Input
                      type="number"
                      value={salaryForm.variablePay}
                      onChange={(e) =>
                        setSalaryForm((prev) => ({ ...prev, variablePay: e.target.value }))
                      }
                    />
                  </div>

                  <div className="rounded-md border p-3 md:col-span-2 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">EPF / ESI Settings</p>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={salaryForm.restrictPfWage}
                          onCheckedChange={(checked) =>
                            setSalaryForm((prev) => ({ ...prev, restrictPfWage: checked }))
                          }
                        />
                        <span className="text-xs text-muted-foreground">Restrict PF wage</span>
                      </div>
                    </div>
                    {salaryForm.restrictPfWage && (
                      <div>
                        <Label>PF Wage Ceiling</Label>
                        <Input
                          type="number"
                          value={salaryForm.pfWageCeiling}
                          onChange={(e) =>
                            setSalaryForm((prev) => ({ ...prev, pfWageCeiling: e.target.value }))
                          }
                        />
                      </div>
                    )}
                    <div>
                      <Label>EPF Calculation</Label>
                      <Select
                        value={salaryForm.epfMode}
                        onValueChange={(v) =>
                          setSalaryForm((prev) => ({ ...prev, epfMode: v }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">% of Basic</SelectItem>
                          <SelectItem value="fixed">Fixed Amount</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {salaryForm.epfMode === "percentage" ? (
                      <div>
                        <Label>EPF % of Basic</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={salaryForm.epfPercentOfBasic}
                          onChange={(e) =>
                            setSalaryForm((prev) => ({
                              ...prev,
                              epfPercentOfBasic: e.target.value
                            }))
                          }
                        />
                      </div>
                    ) : (
                      <div>
                        <Label>EPF Fixed Amount</Label>
                        <Input
                          type="number"
                          min={0}
                          value={salaryForm.epfFixedAmount}
                          onChange={(e) =>
                            setSalaryForm((prev) => ({
                              ...prev,
                              epfFixedAmount: e.target.value
                            }))
                          }
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={salaryForm.includeEsi}
                        onCheckedChange={(checked) =>
                          setSalaryForm((prev) => ({ ...prev, includeEsi: checked }))
                        }
                      />
                      <span className="text-xs text-muted-foreground">
                        Enable ESI: 8.33% of Basic (max ₹1250)
                      </span>
                    </div>
                  </div>

                  <div>
                    <Label>
                      Effective From <span className="text-red-600">*</span>
                    </Label>
                    <Input
                      type="date"
                      value={salaryForm.effectiveFrom}
                      onChange={(e) =>
                        setSalaryForm((prev) => ({ ...prev, effectiveFrom: e.target.value }))
                      }
                    />
                  </div>

                  <div>
                    <Label>Revision Reason</Label>
                    <Input
                      value={salaryForm.revisionReason}
                      onChange={(e) =>
                        setSalaryForm((prev) => ({ ...prev, revisionReason: e.target.value }))
                      }
                      placeholder="Initial salary setup"
                    />
                  </div>
                </div>

                <div className="rounded-md border overflow-hidden">
                  <div className="grid grid-cols-4 bg-muted/40 px-4 py-2 text-xs font-semibold">
                    <div>Salary Component</div>
                    <div>Calculation</div>
                    <div className="text-right">Monthly Amount</div>
                    <div className="text-right">Annual Amount</div>
                  </div>
                  <div className="grid grid-cols-4 px-4 py-3 text-sm border-t">
                    <div>Basic Salary</div>
                    <div>{Number(effectiveBasicPercent).toFixed(2)}% of CTC</div>
                    <div className="text-right">{salaryBreakdown.basicPay.toFixed(2)}</div>
                    <div className="text-right">{(salaryBreakdown.basicPay * 12).toFixed(2)}</div>
                  </div>
                  <div className="grid grid-cols-4 px-4 py-3 text-sm border-t">
                    <div>House Rent Allowance</div>
                    <div>{Number(salaryForm.hraPercentOfBasic || 0).toFixed(2)}% of Basic</div>
                    <div className="text-right">{salaryBreakdown.hraAmount.toFixed(2)}</div>
                    <div className="text-right">{(salaryBreakdown.hraAmount * 12).toFixed(2)}</div>
                  </div>
                  <div className="grid grid-cols-4 px-4 py-3 text-sm border-t bg-muted/30">
                    <div>Fixed Allowance</div>
                    <div>Monthly CTC - (Basic + HRA)</div>
                    <div className="text-right">{salaryBreakdown.fixedAllowance.toFixed(2)}</div>
                    <div className="text-right">{(salaryBreakdown.fixedAllowance * 12).toFixed(2)}</div>
                  </div>
                  <div className="grid grid-cols-4 px-4 py-3 text-sm border-t">
                    <div>EPF - Employer Contribution</div>
                    <div>
                      {salaryForm.epfMode === "fixed"
                        ? "Fixed amount"
                        : `${Number(salaryForm.epfPercentOfBasic || 12).toFixed(2)}% of ${
                            salaryForm.restrictPfWage ? "restricted PF wage" : "basic"
                          }`}
                    </div>
                    <div className="text-right">{salaryBreakdown.employerEpf.toFixed(2)}</div>
                    <div className="text-right">{(salaryBreakdown.employerEpf * 12).toFixed(2)}</div>
                  </div>
                  {salaryForm.includeEsi && (
                    <div className="grid grid-cols-4 px-4 py-3 text-sm border-t">
                      <div>ESI Contribution</div>
                      <div>8.33% of Basic (max ₹1250)</div>
                      <div className="text-right">{salaryBreakdown.esiAmount.toFixed(2)}</div>
                      <div className="text-right">{(salaryBreakdown.esiAmount * 12).toFixed(2)}</div>
                    </div>
                  )}
                  <div className="grid grid-cols-4 px-4 py-3 text-sm border-t bg-blue-50 font-medium">
                    <div>Cost to Company</div>
                    <div />
                    <div className="text-right">{salaryBreakdown.monthlyCtc.toFixed(2)}</div>
                    <div className="text-right">{salaryBreakdown.annualCtc.toFixed(2)}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Salary configuration is linked to selected pay group and stored as revisioned salary
                    structure.
                  </p>
                  {selectedPayGroup && (
                    <p className="text-xs text-muted-foreground">
                      Selected Pay Group: {selectedPayGroup.name} ({selectedPayGroup.code})
                    </p>
                  )}
                </div>
                {currentSalaryEffectiveFrom &&
                  salaryForm.effectiveFrom &&
                  salaryForm.effectiveFrom < currentSalaryEffectiveFrom && (
                    <p className="text-xs text-red-600">
                      Effective From cannot be earlier than current salary start date (
                      {currentSalaryEffectiveFrom}).
                    </p>
                  )}
                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveSalary}
                    disabled={
                      savingSalary ||
                      (Boolean(currentSalaryEffectiveFrom) &&
                        Boolean(salaryForm.effectiveFrom) &&
                        salaryForm.effectiveFrom < currentSalaryEffectiveFrom)
                    }
                  >
                    {savingSalary
                      ? payrollProfileId
                        ? "Updating Salary..."
                        : "Saving Salary..."
                      : payrollProfileId
                        ? "Update Salary"
                        : "Save Salary"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="bank">
          <div className="stat-card space-y-4">
            {!isEdit ? (
              <p className="text-sm text-muted-foreground">
                Save employee first. Then open this tab to configure bank details.
              </p>
            ) : !canManagePayroll ? (
              <p className="text-sm text-muted-foreground">
                You need `PAYROLL_CONFIG_MANAGE` permission to configure bank details.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>
                      Payment Mode <span className="text-red-600">*</span>
                    </Label>
                    <Select
                      value={bankForm.paymentMode}
                      onValueChange={(v) => setBankForm((prev) => ({ ...prev, paymentMode: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>
                      Effective From <span className="text-red-600">*</span>
                    </Label>
                    <Input
                      type="date"
                      value={bankForm.effectiveFrom}
                      onChange={(e) =>
                        setBankForm((prev) => ({ ...prev, effectiveFrom: e.target.value }))
                      }
                    />
                  </div>

                  <div>
                    <Label>
                      Account Holder Name
                      {bankForm.paymentMode === "bank_transfer" && (
                        <span className="text-red-600"> *</span>
                      )}
                    </Label>
                    <Input
                      value={bankForm.accountHolderName}
                      onChange={(e) =>
                        setBankForm((prev) => ({ ...prev, accountHolderName: e.target.value }))
                      }
                      placeholder="As per bank account"
                    />
                  </div>

                  <div>
                    <Label>
                      Bank Name
                      {bankForm.paymentMode === "bank_transfer" && (
                        <span className="text-red-600"> *</span>
                      )}
                    </Label>
                    <Input
                      value={bankForm.bankName}
                      onChange={(e) => setBankForm((prev) => ({ ...prev, bankName: e.target.value }))}
                      placeholder="e.g. HDFC Bank"
                    />
                  </div>

                  <div>
                    <Label>Branch Name</Label>
                    <Input
                      value={bankForm.branchName}
                      onChange={(e) =>
                        setBankForm((prev) => ({ ...prev, branchName: e.target.value }))
                      }
                      placeholder="e.g. Madhapur"
                    />
                  </div>

                  <div>
                    <Label>
                      Account Number
                      {bankForm.paymentMode === "bank_transfer" && (
                        <span className="text-red-600"> *</span>
                      )}
                    </Label>
                    <Input
                      value={bankForm.accountNumber}
                      onChange={(e) =>
                        setBankForm((prev) => ({ ...prev, accountNumber: e.target.value }))
                      }
                      onBlur={(e) => lookupBankByAccount(e.target.value)}
                      placeholder="Enter account number"
                    />
                    {lookingUpAccount && (
                      <p className="text-xs text-muted-foreground mt-1">Looking up saved account details...</p>
                    )}
                  </div>

                  <div>
                    <Label>
                      IFSC Code
                      {bankForm.paymentMode === "bank_transfer" && (
                        <span className="text-red-600"> *</span>
                      )}
                    </Label>
                    <Input
                      value={bankForm.ifscCode}
                      onChange={(e) =>
                        setBankForm((prev) => ({
                          ...prev,
                          ifscCode: e.target.value.toUpperCase()
                        }))
                      }
                      onBlur={(e) => lookupBankByIfsc(e.target.value)}
                      placeholder="e.g. HDFC0001234"
                    />
                    {lookingUpIfsc && (
                      <p className="text-xs text-muted-foreground mt-1">Fetching bank and branch from IFSC...</p>
                    )}
                  </div>

                  <div>
                    <Label>Account Type</Label>
                    <Select
                      value={bankForm.accountType}
                      onValueChange={(v) => setBankForm((prev) => ({ ...prev, accountType: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="salary">Salary</SelectItem>
                        <SelectItem value="savings">Savings</SelectItem>
                        <SelectItem value="current">Current</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {bankForm.paymentMode === "upi" && (
                    <div className="md:col-span-2">
                      <Label>
                        UPI ID <span className="text-red-600">*</span>
                      </Label>
                      <Input
                        value={bankForm.upiId}
                        onChange={(e) => setBankForm((prev) => ({ ...prev, upiId: e.target.value }))}
                        placeholder="name@bank"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={bankForm.isPrimary}
                      onCheckedChange={(checked) =>
                        setBankForm((prev) => ({ ...prev, isPrimary: Boolean(checked) }))
                      }
                    />
                    Primary account
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={bankForm.isVerified}
                      onCheckedChange={(checked) =>
                        setBankForm((prev) => ({ ...prev, isVerified: Boolean(checked) }))
                      }
                    />
                    Mark as verified
                  </label>
                </div>

                <p className="text-xs text-muted-foreground">
                  If payment mode is Bank Transfer, account holder, bank name, account number, and
                  IFSC are required for payroll disbursement validation.
                </p>

                <div className="flex justify-end">
                  <Button onClick={handleSaveBank} disabled={savingBank}>
                    {savingBank ? "Saving Bank Details..." : "Save Bank Details"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
};

export default AddEmployee;
