import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { getApiWithToken, postApiWithToken, putApiWithToken } from "@/services/apiWrapper";
import { toast } from "sonner";

type ComponentDraft = {
  scope: "earning" | "deduction" | "employer_contribution";
  code: string;
  name: string;
  calculationMode: "fixed" | "percentage" | "formula" | "slab";
  taxable: boolean;
  amount: string;
  percentageOf: string;
  formulaTemplate: string;
  formulaExpression: string;
};

type PayrollTemplate = {
  id: string;
  title: string;
  description: string;
  components: ComponentDraft[];
  statutory: {
    enablePf: boolean;
    enableEsi: boolean;
    enablePt: boolean;
    enableLwf: boolean;
    pfWageThreshold: string;
    esiWageThreshold: string;
    stateCode: string;
  };
  attendanceRules: {
    attendanceLockMode: "payroll_cutoff" | "days_window";
    attendanceLockAfterDays: string;
    lopCalculationMethod: "calendar_days" | "working_days";
    defaultWorkingDays: string;
    enableProration: boolean;
  };
};

type TelanganaRuleItem = {
  id: string;
  title: string;
  points: string[];
  status: "auto_default" | "manual_policy" | "legal_update_required";
};

type PayGroupOption = {
  id: string;
  code: string;
  name: string;
  pay_frequency: string;
  salary_pay_day: number;
  is_active: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSettings?: any;
  onActivated?: () => void;
};

const TODAY = new Date().toISOString().slice(0, 10);
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const steps = [
  "Pay Group",
  "Components",
  "Statutory",
  "Attendance Rules",
  "Review & Activate"
];

const defaultComponent = (): ComponentDraft => ({
  scope: "earning",
  code: "",
  name: "",
  calculationMode: "fixed",
  taxable: true,
  amount: "",
  percentageOf: "MONTHLY_GROSS",
  formulaTemplate: "custom",
  formulaExpression: ""
});

const FORMULA_PRESETS = [
  {
    id: "custom",
    label: "Custom Formula",
    expression: "",
    help: "You can write your own formula."
  },
  {
    id: "hra_50_basic",
    label: "HRA = 50% of Basic",
    expression: "BASIC * 0.5",
    help: "Common setup for many Indian payroll structures."
  },
  {
    id: "taxable_allowance_basic_minus_hra",
    label: "Taxable Allowance = Basic - HRA",
    expression: "BASIC - HRA",
    help: "Useful when TA is derived from Basic and HRA."
  }
] as const;

const TELANGANA_DEFAULT_TEMPLATE: PayrollTemplate = {
  id: "telangana_standard_monthly_v1",
  title: "Telangana Standard Payroll Pack",
  description:
    "Preloaded Indian payroll defaults for Telangana. HR can edit every component before saving.",
  components: [
    {
      scope: "earning",
      code: "BASIC",
      name: "Basic Pay",
      calculationMode: "fixed",
      taxable: true,
      amount: "20000",
      percentageOf: "MONTHLY_GROSS",
      formulaTemplate: "custom",
      formulaExpression: ""
    },
    {
      scope: "earning",
      code: "HRA",
      name: "House Rent Allowance",
      calculationMode: "percentage",
      taxable: true,
      amount: "50",
      percentageOf: "BASIC",
      formulaTemplate: "hra_50_basic",
      formulaExpression: "BASIC * 0.5"
    },
    {
      scope: "earning",
      code: "TA",
      name: "Taxable Allowance",
      calculationMode: "formula",
      taxable: true,
      amount: "",
      percentageOf: "MONTHLY_GROSS",
      formulaTemplate: "taxable_allowance_basic_minus_hra",
      formulaExpression: "BASIC - HRA"
    },
    {
      scope: "deduction",
      code: "PF",
      name: "Provident Fund",
      calculationMode: "percentage",
      taxable: false,
      amount: "12",
      percentageOf: "BASIC",
      formulaTemplate: "custom",
      formulaExpression: ""
    },
    {
      scope: "deduction",
      code: "PT",
      name: "Professional Tax",
      calculationMode: "fixed",
      taxable: false,
      amount: "200",
      percentageOf: "MONTHLY_GROSS",
      formulaTemplate: "custom",
      formulaExpression: ""
    }
  ],
  statutory: {
    enablePf: true,
    enableEsi: true,
    enablePt: true,
    enableLwf: false,
    pfWageThreshold: "15000",
    esiWageThreshold: "21000",
    stateCode: "TS"
  },
  attendanceRules: {
    attendanceLockMode: "payroll_cutoff",
    attendanceLockAfterDays: "7",
    lopCalculationMethod: "working_days",
    defaultWorkingDays: "30",
    enableProration: true
  }
};

const TELANGANA_RULES: TelanganaRuleItem[] = [
  {
    id: "min_wage",
    title: "Minimum Wage Rule",
    points: [
      "Basic + DA must be >= Telangana notified minimum wage by skill/zone.",
      "Minimum wage values must be updated on every new Telangana notification."
    ],
    status: "legal_update_required"
  },
  {
    id: "salary_structure",
    title: "Salary Structure Rules",
    points: [
      "Basic typically 40%-50% of gross.",
      "HRA (Telangana non-metro) default 40% of Basic.",
      "Gross = sum of earnings. Net = Gross - deductions."
    ],
    status: "auto_default"
  },
  {
    id: "epf",
    title: "EPF Rules",
    points: [
      "PF eligibility based on Basic and policy (wage ceiling ₹15,000).",
      "Employee 12% and Employer 12% on PF wages.",
      "Employer split: EPS 8.33% (max ₹1250), remaining to EPF."
    ],
    status: "manual_policy"
  },
  {
    id: "esi",
    title: "ESI Rules",
    points: [
      "Eligible when Gross <= ₹21,000/month.",
      "Employee 0.75%, Employer 3.25%.",
      "Continue till contribution period closure if crossed mid-cycle."
    ],
    status: "manual_policy"
  },
  {
    id: "pt",
    title: "Professional Tax (Telangana)",
    points: [
      "Slabs: <=15000:0, 15001-20000:150, >20000:200 (monthly).",
      "Deduct monthly and remit by employer."
    ],
    status: "auto_default"
  },
  {
    id: "tds",
    title: "Income Tax (TDS)",
    points: [
      "Annual tax split over 12 months.",
      "Old/New regime selectable.",
      "Apply 4% cess and recalculate on mid-year revisions."
    ],
    status: "manual_policy"
  },
  {
    id: "bonus_gratuity",
    title: "Bonus and Gratuity",
    points: [
      "Bonus: eligibility <= ₹21,000 salary, 8.33%-20% annual Basic.",
      "Gratuity: payable after 5 years. Formula: (Last Basic * 15 * Service Years)/26."
    ],
    status: "manual_policy"
  },
  {
    id: "hours_leave_maternity_lwf",
    title: "Hours, Leave, Maternity, LWF",
    points: [
      "Working hours: 9/day, 48/week, overtime at 2x.",
      "Leave accrual and encashment as state/company policy.",
      "Maternity: 26 weeks (eligible employees).",
      "LWF as notified (annual/bi-annual), employer + employee contribution."
    ],
    status: "manual_policy"
  }
];

const getRuleStatusLabel = (status: TelanganaRuleItem["status"]) => {
  if (status === "auto_default") return "Auto Default";
  if (status === "legal_update_required") return "Legal Update Needed";
  return "Manual Policy";
};

const getRuleStatusClass = (status: TelanganaRuleItem["status"]) => {
  if (status === "auto_default") return "bg-green-100 text-green-700";
  if (status === "legal_update_required") return "bg-amber-100 text-amber-700";
  return "bg-blue-100 text-blue-700";
};

export const PayrollSetupWizard = ({
  open,
  onOpenChange,
  initialSettings,
  onActivated
}: Props) => {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [payGroup, setPayGroup] = useState({
    defaultPayGroupId: String(
      initialSettings?.default_pay_group_id || initialSettings?.defaultPayGroupId || ""
    ),
    payFrequency: "monthly",
    salaryPayDay: "30",
    attendanceCutoffDay: String(initialSettings?.attendance_lock_after_days || 25)
  });

  const [components, setComponents] = useState<ComponentDraft[]>([defaultComponent()]);
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);
  const [showRulesPanel, setShowRulesPanel] = useState(false);
  const [availablePayGroups, setAvailablePayGroups] = useState<PayGroupOption[]>([]);
  const [loadingPayGroups, setLoadingPayGroups] = useState(false);

  const [statutory, setStatutory] = useState({
    enablePf: true,
    enableEsi: true,
    enablePt: true,
    enableLwf: false,
    pfWageThreshold: "15000",
    esiWageThreshold: "21000",
    stateCode: "TS"
  });

  const [attendanceRules, setAttendanceRules] = useState({
    attendanceLockMode: (initialSettings?.attendance_lock_mode || "payroll_cutoff") as
      | "payroll_cutoff"
      | "days_window",
    attendanceLockAfterDays: String(initialSettings?.attendance_lock_after_days || 7),
    lopCalculationMethod: (initialSettings?.lop_calculation_method || "calendar_days") as
      | "calendar_days"
      | "working_days",
    defaultWorkingDays: String(initialSettings?.default_working_days || 30),
    enableProration:
      typeof initialSettings?.enable_proration === "boolean"
        ? initialSettings.enable_proration
        : true
  });

  const activeComponentCount = useMemo(
    () => components.filter((c) => c.code.trim() && c.name.trim()).length,
    [components]
  );
  const isPayGroupIdValid = UUID_REGEX.test(payGroup.defaultPayGroupId.trim());
  const componentCodeOptions = useMemo(() => {
    const codes = components
      .map((c) => c.code.trim().toUpperCase())
      .filter(Boolean);
    return [...new Set(["MONTHLY_GROSS", ...codes])];
  }, [components]);

  useEffect(() => {
    if (!open) return;
    let active = true;

    const loadPayGroups = async () => {
      setLoadingPayGroups(true);
      try {
        const res = await getApiWithToken("/payroll/pay-groups", null, {
          requiredPermissions: ["PAYROLL_CONFIG_MANAGE"]
        });
        if (!active) return;

        if (res?.success) {
          const rows = Array.isArray(res.data) ? res.data : [];
          setAvailablePayGroups(rows);
          setPayGroup((prev) => {
            if (prev.defaultPayGroupId.trim()) return prev;
            if (!rows[0]?.id) return prev;
            return {
              ...prev,
              defaultPayGroupId: String(rows[0].id)
            };
          });
          return;
        }

        if (!res?.skipped) {
          toast.error(res?.message || "Failed to load pay groups");
        }
      } finally {
        if (active) setLoadingPayGroups(false);
      }
    };

    loadPayGroups();
    return () => {
      active = false;
    };
  }, [open]);

  const canNext = () => {
    if (step === 0) return Boolean(payGroup.defaultPayGroupId.trim()) && isPayGroupIdValid;
    if (step === 1) return activeComponentCount > 0;
    if (step === 2) return Boolean(statutory.stateCode.trim());
    if (step === 3) return Boolean(attendanceRules.defaultWorkingDays);
    return true;
  };

  const addComponent = () => setComponents((prev) => [...prev, defaultComponent()]);
  const removeComponent = (index: number) =>
    setComponents((prev) => prev.filter((_, i) => i !== index));

  const updateComponent = (index: number, patch: Partial<ComponentDraft>) =>
    setComponents((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item))
    );
  const applyFormulaTemplate = (index: number, templateId: string) => {
    const preset = FORMULA_PRESETS.find((item) => item.id === templateId);
    updateComponent(index, {
      formulaTemplate: templateId,
      formulaExpression: preset?.expression || ""
    });
  };
  const loadTemplateForEdit = (template: PayrollTemplate) => {
    setComponents(template.components.map((component) => ({ ...component })));
    setStatutory(template.statutory);
    setAttendanceRules(template.attendanceRules);
    toast.success("Telangana defaults loaded. Review and edit before activate.");
  };

  const activateSetup = async () => {
    setSaving(true);
    try {
      const settingsPayload = {
        defaultPayGroupId: payGroup.defaultPayGroupId.trim(),
        countryCode: "IN",
        stateCode: statutory.stateCode.trim().toUpperCase(),
        attendanceLockMode: attendanceRules.attendanceLockMode,
        attendanceLockAfterDays: Number(attendanceRules.attendanceLockAfterDays || 7),
        lopCalculationMethod: attendanceRules.lopCalculationMethod,
        defaultWorkingDays: Number(attendanceRules.defaultWorkingDays || 30),
        enableProration: attendanceRules.enableProration,
        metadata: {
          wizardVersion: "v1",
          payGroup: {
            payFrequency: payGroup.payFrequency,
            salaryPayDay: Number(payGroup.salaryPayDay || 30),
            attendanceCutoffDay: Number(payGroup.attendanceCutoffDay || 25)
          },
          statutory
        }
      };

      const settingsRes = await putApiWithToken("/payroll/settings", settingsPayload);
      if (!settingsRes?.success) {
        toast.error(settingsRes?.message || "Failed to save payroll settings");
        return;
      }

      const componentRows = components.filter((c) => c.code.trim() && c.name.trim());
      let successCount = 0;
      let failedCount = 0;

      for (const component of componentRows) {
        const componentPayload = {
          scope: component.scope,
          code: component.code.trim().toUpperCase(),
          name: component.name.trim(),
          calculationMode: component.calculationMode,
          taxable: component.taxable,
          effectiveFrom: TODAY,
          metadata:
            component.calculationMode === "percentage"
              ? {
                  base: component.percentageOf || "MONTHLY_GROSS",
                  percentage: Number(component.amount || 0)
                }
              : component.calculationMode === "formula"
                ? {
                    expression: component.formulaExpression || "0"
                  }
                : {
                    monthlyAmount: Number(component.amount || 0)
                  }
        };
        const res = await postApiWithToken("/payroll/salary-components", componentPayload);
        if (res?.success) {
          successCount += 1;
        } else {
          failedCount += 1;
        }
      }

      if (failedCount > 0) {
        toast.warning(
          `Setup saved. ${successCount} components added, ${failedCount} failed (likely duplicates).`
        );
      } else {
        toast.success("Payroll setup activated successfully");
      }

      onActivated?.();
      onOpenChange(false);
      setStep(0);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Payroll Setup Wizard</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-4">
          {steps.map((label, index) => (
            <div
              key={label}
              className={`rounded-md border px-3 py-2 text-sm ${
                index === step ? "bg-primary text-primary-foreground" : "bg-background"
              }`}
            >
              <span className="font-medium">{index + 1}.</span> {label}
            </div>
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Default Pay Group</label>
              <Select
                value={payGroup.defaultPayGroupId || undefined}
                onValueChange={(value) =>
                  setPayGroup((prev) => ({ ...prev, defaultPayGroupId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      loadingPayGroups
                        ? "Loading pay groups..."
                        : availablePayGroups.length > 0
                          ? "Select pay group"
                          : "No pay groups found"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availablePayGroups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name} ({group.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Choose by name. We store the UUID internally for payroll settings.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">Or Paste Pay Group UUID (Advanced)</label>
              <Input
                value={payGroup.defaultPayGroupId}
                onChange={(e) =>
                  setPayGroup((prev) => ({ ...prev, defaultPayGroupId: e.target.value }))
                }
                placeholder="Paste pay group UUID"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use this only if you already have an exact UUID.
              </p>
              {!!payGroup.defaultPayGroupId.trim() && !isPayGroupIdValid && (
                <p className="text-xs text-red-600 mt-1">
                  Use Pay Group UUID only. Example: `8f2c3a2e-11ab-4c89-9d00-1a2b3c4d5e6f`.
                  Name like `Luvetha` will not work here.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium">Pay Cycle</label>
                <Select
                  value={payGroup.payFrequency}
                  onValueChange={(value) =>
                    setPayGroup((prev) => ({ ...prev, payFrequency: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="semi_monthly">Twice a month</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Keep monthly for most Indian companies.
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Salary Pay Day</label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={payGroup.salaryPayDay}
                  onChange={(e) =>
                    setPayGroup((prev) => ({ ...prev, salaryPayDay: e.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Example: 30 means salary processed on 30th.
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Attendance Cutoff Day</label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={payGroup.attendanceCutoffDay}
                  onChange={(e) =>
                    setPayGroup((prev) => ({ ...prev, attendanceCutoffDay: e.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Example: 25 means attendance till 25th is considered.
                </p>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Add salary components in simple words. Example: Basic, HRA, PF, TDS.
            </p>
            <div className="border rounded-lg p-3 space-y-2">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Telangana Payroll Rules Checklist</p>
                  <p className="text-xs text-muted-foreground">
                    Review legal and policy rules before loading defaults.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRulesPanel((prev) => !prev)}
                >
                  {showRulesPanel ? "Hide Rules" : "View Rules"}
                </Button>
              </div>
              {showRulesPanel && (
                <div className="space-y-2">
                  {TELANGANA_RULES.map((rule) => (
                    <div key={rule.id} className="border rounded-md p-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium">{rule.title}</p>
                        <span
                          className={`text-[10px] px-2 py-1 rounded ${getRuleStatusClass(rule.status)}`}
                        >
                          {getRuleStatusLabel(rule.status)}
                        </span>
                      </div>
                      <div className="mt-1 space-y-1">
                        {rule.points.map((point) => (
                          <p key={point} className="text-xs text-muted-foreground">
                            • {point}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="border rounded-lg p-3 space-y-3 bg-muted/20">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{TELANGANA_DEFAULT_TEMPLATE.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {TELANGANA_DEFAULT_TEMPLATE.description}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTemplatePreview((prev) => !prev)}
                  >
                    {showTemplatePreview ? "Hide Preview" : "Preview Defaults"}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => loadTemplateForEdit(TELANGANA_DEFAULT_TEMPLATE)}
                  >
                    Load & Edit
                  </Button>
                </div>
              </div>
              {showTemplatePreview && (
                <div className="space-y-2 border rounded p-3 bg-background">
                  <p className="text-xs font-medium">Default Components (Preview)</p>
                  {TELANGANA_DEFAULT_TEMPLATE.components.map((component) => (
                    <div
                      key={`${component.scope}-${component.code}`}
                      className="text-xs border rounded px-2 py-1"
                    >
                      <span className="font-medium">{component.code}</span> - {component.name} |{" "}
                      {component.calculationMode === "percentage"
                        ? `${component.amount}% of ${component.percentageOf}`
                        : component.calculationMode === "formula"
                          ? component.formulaExpression
                          : `Amount ${component.amount}`}
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    Note: These are starter defaults for Telangana. HR can edit all values after loading.
                  </p>
                </div>
              )}
            </div>
            {components.map((component, index) => (
              <div
                key={`${index}-${component.scope}`}
                className="border rounded-lg p-3 space-y-3 transition-colors hover:border-primary/60 hover:bg-primary/5"
              >
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                  <Select
                    value={component.scope}
                    onValueChange={(value) =>
                      updateComponent(index, { scope: value as ComponentDraft["scope"] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="earning">Earning</SelectItem>
                      <SelectItem value="deduction">Deduction</SelectItem>
                      <SelectItem value="employer_contribution">Employer Contribution</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Code (BASIC)"
                    value={component.code}
                    onChange={(e) => updateComponent(index, { code: e.target.value })}
                  />
                  <Input
                    placeholder="Name (Basic Pay)"
                    value={component.name}
                    onChange={(e) => updateComponent(index, { name: e.target.value })}
                  />
                  <Select
                    value={component.calculationMode}
                    onValueChange={(value) =>
                      updateComponent(index, {
                        calculationMode: value as ComponentDraft["calculationMode"]
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="formula">Formula</SelectItem>
                      <SelectItem value="slab">Slab</SelectItem>
                    </SelectContent>
                  </Select>
                  {component.calculationMode === "formula" ? (
                    <Input value="Use formula setup below" readOnly />
                  ) : (
                    <Input
                      type="number"
                      placeholder={
                        component.calculationMode === "percentage"
                          ? "Percentage (e.g. 50)"
                          : "Monthly amount"
                      }
                      value={component.amount}
                      onChange={(e) => updateComponent(index, { amount: e.target.value })}
                    />
                  )}
                </div>
                {component.calculationMode === "percentage" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium">Based On Component</label>
                      <Select
                        value={component.percentageOf}
                        onValueChange={(value) => updateComponent(index, { percentageOf: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {componentCodeOptions.map((code) => (
                            <SelectItem key={code} value={code}>
                              {code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Example: HRA as 50% of BASIC.
                      </p>
                    </div>
                  </div>
                )}
                {component.calculationMode === "formula" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium">Formula Preset</label>
                      <Select
                        value={component.formulaTemplate}
                        onValueChange={(value) => applyFormulaTemplate(index, value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FORMULA_PRESETS.map((preset) => (
                            <SelectItem key={preset.id} value={preset.id}>
                              {preset.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        {
                          FORMULA_PRESETS.find((preset) => preset.id === component.formulaTemplate)
                            ?.help
                        }
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-medium">Formula Expression</label>
                      <Input
                        placeholder="BASIC - HRA"
                        value={component.formulaExpression}
                        onChange={(e) =>
                          updateComponent(index, {
                            formulaTemplate: "custom",
                            formulaExpression: e.target.value
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Available examples: BASIC, HRA, MONTHLY_GROSS.
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={component.taxable}
                      onCheckedChange={(checked) => updateComponent(index, { taxable: checked })}
                    />
                    <p className="text-sm">Taxable component</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeComponent(index)}
                    disabled={components.length === 1}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" onClick={addComponent}>
              Add Another Component
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              These switches help fresh HR teams understand statutory setup quickly.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center justify-between border rounded p-3">
                <div>
                  <p className="font-medium text-sm">PF Enabled</p>
                  <p className="text-xs text-muted-foreground">Provident Fund deduction</p>
                </div>
                <Switch
                  checked={statutory.enablePf}
                  onCheckedChange={(checked) => setStatutory((prev) => ({ ...prev, enablePf: checked }))}
                />
              </div>
              <div className="flex items-center justify-between border rounded p-3">
                <div>
                  <p className="font-medium text-sm">ESI Enabled</p>
                  <p className="text-xs text-muted-foreground">Employee State Insurance</p>
                </div>
                <Switch
                  checked={statutory.enableEsi}
                  onCheckedChange={(checked) =>
                    setStatutory((prev) => ({ ...prev, enableEsi: checked }))
                  }
                />
              </div>
              <div className="flex items-center justify-between border rounded p-3">
                <div>
                  <p className="font-medium text-sm">Professional Tax Enabled</p>
                  <p className="text-xs text-muted-foreground">State-wise PT deduction</p>
                </div>
                <Switch
                  checked={statutory.enablePt}
                  onCheckedChange={(checked) => setStatutory((prev) => ({ ...prev, enablePt: checked }))}
                />
              </div>
              <div className="flex items-center justify-between border rounded p-3">
                <div>
                  <p className="font-medium text-sm">LWF Enabled</p>
                  <p className="text-xs text-muted-foreground">Labour Welfare Fund</p>
                </div>
                <Switch
                  checked={statutory.enableLwf}
                  onCheckedChange={(checked) =>
                    setStatutory((prev) => ({ ...prev, enableLwf: checked }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium">PF Wage Threshold</label>
                <Input
                  type="number"
                  value={statutory.pfWageThreshold}
                  onChange={(e) =>
                    setStatutory((prev) => ({ ...prev, pfWageThreshold: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">ESI Wage Threshold</label>
                <Input
                  type="number"
                  value={statutory.esiWageThreshold}
                  onChange={(e) =>
                    setStatutory((prev) => ({ ...prev, esiWageThreshold: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">State Code</label>
                <Input
                  value={statutory.stateCode}
                  onChange={(e) => setStatutory((prev) => ({ ...prev, stateCode: e.target.value }))}
                  placeholder="TS"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Telangana: use TS
                </p>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Attendance Lock Mode</label>
                <Select
                  value={attendanceRules.attendanceLockMode}
                  onValueChange={(value) =>
                    setAttendanceRules((prev) => ({
                      ...prev,
                      attendanceLockMode: value as "payroll_cutoff" | "days_window"
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="payroll_cutoff">Lock by Payroll Cutoff</SelectItem>
                    <SelectItem value="days_window">Lock by Days Window</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Use cutoff mode for cleaner payroll control.
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Lock After Days</label>
                <Input
                  type="number"
                  min={0}
                  max={60}
                  value={attendanceRules.attendanceLockAfterDays}
                  onChange={(e) =>
                    setAttendanceRules((prev) => ({
                      ...prev,
                      attendanceLockAfterDays: e.target.value
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Example: 7 means old attendance edits stop after 7 days.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">LOP Calculation</label>
                <Select
                  value={attendanceRules.lopCalculationMethod}
                  onValueChange={(value) =>
                    setAttendanceRules((prev) => ({
                      ...prev,
                      lopCalculationMethod: value as "calendar_days" | "working_days"
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="calendar_days">Calendar Days</SelectItem>
                    <SelectItem value="working_days">Working Days</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Most HR teams use working days.
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Default Working Days</label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={attendanceRules.defaultWorkingDays}
                  onChange={(e) =>
                    setAttendanceRules((prev) => ({
                      ...prev,
                      defaultWorkingDays: e.target.value
                    }))
                  }
                />
              </div>
            </div>

            <div className="flex items-center justify-between border rounded p-3">
              <div>
                <p className="font-medium text-sm">Enable Salary Proration</p>
                <p className="text-xs text-muted-foreground">
                  Salary adjusts automatically based on payable days.
                </p>
              </div>
              <Switch
                checked={attendanceRules.enableProration}
                onCheckedChange={(checked) =>
                  setAttendanceRules((prev) => ({ ...prev, enableProration: checked }))
                }
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="rounded border p-3">
              <p className="font-medium mb-2">Pay Group</p>
              <p className="text-sm text-muted-foreground">
                Pay Group ID: <span className="font-mono text-foreground">{payGroup.defaultPayGroupId}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Cycle: {payGroup.payFrequency}, Salary Day: {payGroup.salaryPayDay}, Cutoff Day:{" "}
                {payGroup.attendanceCutoffDay}
              </p>
            </div>
            <div className="rounded border p-3">
              <p className="font-medium mb-2">Components</p>
              <p className="text-sm text-muted-foreground">
                {activeComponentCount} components will be created.
              </p>
              <div className="mt-2 space-y-1">
                {components
                  .filter((c) => c.code.trim() && c.name.trim())
                  .map((c, i) => (
                    <p key={`${c.code}-${i}`} className="text-xs text-muted-foreground">
                      {c.code.toUpperCase()} - {c.calculationMode === "percentage"
                        ? `${c.amount || 0}% of ${c.percentageOf || "MONTHLY_GROSS"}`
                        : c.calculationMode === "formula"
                          ? c.formulaExpression || "Formula not set"
                          : `Amount ${c.amount || 0}`}
                    </p>
                  ))}
              </div>
            </div>
            <div className="rounded border p-3">
              <p className="font-medium mb-2">Statutory</p>
              <p className="text-sm text-muted-foreground">
                PF: {statutory.enablePf ? "On" : "Off"}, ESI: {statutory.enableEsi ? "On" : "Off"},
                PT: {statutory.enablePt ? "On" : "Off"}, State: {statutory.stateCode}
              </p>
            </div>
            <div className="rounded border p-3">
              <p className="font-medium mb-2">Attendance Rules</p>
              <p className="text-sm text-muted-foreground">
                Lock Mode: {attendanceRules.attendanceLockMode}, LOP:{" "}
                {attendanceRules.lopCalculationMethod}, Working Days:{" "}
                {attendanceRules.defaultWorkingDays}
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={() => setStep((prev) => Math.max(0, prev - 1))}
            disabled={step === 0 || saving}
          >
            Back
          </Button>
          {step < steps.length - 1 ? (
            <Button onClick={() => canNext() && setStep((prev) => Math.min(steps.length - 1, prev + 1))} disabled={!canNext()}>
              Next
            </Button>
          ) : (
            <Button onClick={activateSetup} disabled={saving}>
              {saving ? "Activating..." : "Activate Payroll Setup"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PayrollSetupWizard;
