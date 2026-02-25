import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

type DocSection = {
  id: string;
  title: string;
  description?: string;
  points?: string[];
  checklist?: string[];
  warnings?: string[];
};

const administratorSections: DocSection[] = [
  {
    id: "administrator-overview",
    title: "Platform Overview",
    points: [
      "Configure organizational master data before daily operations begin.",
      "Use role and permission management to control data access and actions.",
      "Use approval workflows for leave and attendance correction requests."
    ]
  },
  {
    id: "administrator-setup",
    title: "Mandatory Setup Sequence",
    checklist: [
      "Create roles and assign the required permissions",
      "Create departments and designations",
      "Create shifts and assign employees to the correct shift",
      "Configure weekly off policies (default and shift-specific)",
      "Create the holiday calendar",
      "Create leave types",
      "Configure organization settings (sandwich rule, attendance lock)",
      "Define approval workflows"
    ]
  },
  {
    id: "administrator-payroll-quick-start",
    title: "Payroll Quick Start (HR)",
    points: [
      "Open Payroll Setup Wizard and review Telangana default components.",
      "Create or review pay groups before assigning salary details to employees.",
      "Enter annual CTC and pay group in employee salary details; component values auto-calculate.",
      "Override component values only for approved exceptions, then save with reason.",
      "Generate attendance snapshot, create payroll run, validate, submit, approve, and lock."
    ],
    checklist: [
      "Bank details are saved for all payroll employees",
      "PAN/UAN/ESI fields are complete where applicable",
      "Attendance and leave approvals are finalized for the month",
      "No validation errors remain before final approval"
    ]
  },
  {
    id: "administrator-payroll-formulas",
    title: "Payroll Formula Guide (Simple)",
    points: [
      "Basic Salary: usually fixed as a percentage of CTC or gross (company policy).",
      "HRA: usually calculated as a percentage of Basic for non-metro rules.",
      "Gross Salary: sum of all earnings.",
      "Net Salary: Gross minus all deductions.",
      "Use Fixed Amount for stable components, Percentage for ratio-based components, Formula for linked components."
    ],
    warnings: [
      "Statutory thresholds and rates can change. Verify policy values before locking payroll."
    ]
  },
  {
    id: "administrator-attendance",
    title: "Attendance Administration",
    points: [
      "The attendance matrix displays present, absent, leave, holiday, and weekly off statuses.",
      "When approved half-day leave and attendance exist on the same date, matrix shows a combined Present + Leave state (PL).",
      "Pending checkout remains visible as an attendance exception, but approved half-day leave can reconcile payroll exclusion for that date.",
      "An administrator can override attendance records when correction is required.",
      "Attendance requests can be approved or rejected by reporting manager, Human Resources, or administrator roles."
    ]
  },
  {
    id: "administrator-leaves",
    title: "Leave Administration",
    points: [
      "Leave calculation excludes holidays and weekly off days unless sandwich rule conditions apply.",
      "Leave requests support Full Day and Half Day durations.",
      "Half-day leave requires a single date and session selection (First Half or Second Half).",
      "Half-day leave is not allowed on holidays or weekly off days.",
      "Pending leave can reserve leave balance based on your organization policy.",
      "Only reporting manager, Human Resources, or administrator roles can take approval actions on leave requests."
    ]
  },
  {
    id: "administrator-expenses",
    title: "Expense Administration",
    points: [
      "Manage expenses through pending, approved, and rejected states.",
      "Upload receipts through Cloudinary-based file storage.",
      "Use vendor master data and vendor analytics for reporting and governance."
    ]
  },
  {
    id: "administrator-troubleshooting",
    title: "Administrator Troubleshooting",
    checklist: [
      "If access is denied, verify active role and permission mapping",
      "If approvals are not visible, verify pending approvals and workflow configuration",
      "If leave day calculation is incorrect, verify holidays, weekly off policies, and sandwich rule settings",
      "If attendance shows pending checkout with approved half-day leave, check for PL state and reconciliation note in hover details",
      "If receipt upload fails, verify Cloudinary credentials in environment configuration",
      "If payroll shows missing bank details, complete employee bank tab and recompute the run",
      "If payroll run creation shows duplicate month/group, continue using existing run for that pay month"
    ]
  }
];

const employeeSections: DocSection[] = [
  {
    id: "employee-overview",
    title: "Employee Quick Start",
    points: [
      "Complete your profile before using core features.",
      "Use the dashboard for attendance summary, leave summary, and notifications.",
      "Use the side navigation menu for Attendance, Timesheets, Leave, Holidays, and Documentation."
    ]
  },
  {
    id: "employee-attendance",
    title: "Attendance Guide",
    points: [
      "Record check-in at shift start and record check-out at shift end.",
      "Late arrival and early activity indicators are calculated from shift timing and grace minutes.",
      "If check-out is missed, submit an attendance correction request.",
      "The Attendance page can show PL when attendance and approved half-day leave exist on the same date."
    ],
    warnings: [
      "Employees cannot directly override attendance records."
    ]
  },
  {
    id: "employee-leave",
    title: "Leave Guide",
    points: [
      "Select leave type, duration, and date range when submitting a leave request.",
      "For half-day leave, choose the session (First Half or Second Half).",
      "Holidays and weekly off days are excluded unless sandwich rule includes in-between non-working days.",
      "Pending and approved leaves are visible in the leave calendar with distinct status colors."
    ],
    warnings: [
      "Employees cannot approve their own leave requests."
    ]
  },
  {
    id: "employee-timesheet",
    title: "Timesheet Guide",
    points: [
      "Submit weekly timesheet entries for approval.",
      "Timesheets can be edited while in draft or rejected status.",
      "Recall is available based on your permission set and timesheet status."
    ]
  },
  {
    id: "employee-support",
    title: "Issue Resolution Guidance",
    checklist: [
      "For profile or access issues, contact Human Resources or an administrator",
      "For leave delays, verify request status and approval chain",
      "For half-day leave errors, verify selected date is a working day and from/to date are the same",
      "For attendance mismatches, submit an attendance correction request with detailed reason",
      "For restricted menu access, confirm active role in the top navigation bar"
    ]
  }
];

const renderSection = (section: DocSection) => (
  <div key={section.id} className="bg-card rounded-xl card-shadow p-6">
    <h3 className="text-xl font-semibold mb-2">{section.title}</h3>

    {section.description && (
      <p className="text-sm text-muted-foreground mb-3">{section.description}</p>
    )}

    {section.points && section.points.length > 0 && (
      <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1 mb-3">
        {section.points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    )}

    {section.checklist && section.checklist.length > 0 && (
      <div className="mb-3">
        <p className="text-sm font-medium mb-2">Checklist</p>
        <ul className="list-decimal pl-5 text-sm text-muted-foreground space-y-1">
          {section.checklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    )}

    {section.warnings && section.warnings.length > 0 && (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 text-sm space-y-1">
        {section.warnings.map((warn) => (
          <p key={warn}>{warn}</p>
        ))}
      </div>
    )}
  </div>
);

const Documentation = () => {
  const { profile } = useAuth();
  const isEmployeeRole = profile?.activeRole?.slug === "employee";

  const [guideMode, setGuideMode] = useState<"administrator" | "employee">(
    isEmployeeRole ? "employee" : "administrator"
  );

  const sections = useMemo(
    () => (guideMode === "administrator" ? administratorSections : employeeSections),
    [guideMode]
  );

  const [selectedId, setSelectedId] = useState(sections[0]?.id || "");
  const selected = sections.find((s) => s.id === selectedId) || sections[0];

  return (
    <MainLayout
      title="Documentation"
      breadcrumb={[{ label: "Home", href: "/" }, { label: "Documentation" }]}
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <aside className="lg:col-span-4 xl:col-span-3">
          <div className="bg-card rounded-xl card-shadow p-4 lg:sticky lg:top-20">
            <div className="flex items-center gap-2 mb-4">
              <Button
                size="sm"
                variant={guideMode === "administrator" ? "default" : "outline"}
                onClick={() => {
                  setGuideMode("administrator");
                  setSelectedId(administratorSections[0].id);
                }}
                disabled={isEmployeeRole}
              >
                Administrator Guide
              </Button>
              <Button
                size="sm"
                variant={guideMode === "employee" ? "default" : "outline"}
                onClick={() => {
                  setGuideMode("employee");
                  setSelectedId(employeeSections[0].id);
                }}
              >
                Employee Guide
              </Button>
            </div>

            {isEmployeeRole && (
              <Badge variant="secondary" className="mb-3">
                Employee view
              </Badge>
            )}

            <h3 className="text-base font-semibold mb-3">Sections</h3>
            <div className="space-y-1 max-h-[65vh] overflow-auto pr-1">
              {sections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setSelectedId(section.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                    selectedId === section.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  )}
                >
                  {section.title}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="lg:col-span-8 xl:col-span-9 space-y-5">
          {selected && renderSection(selected)}
        </section>
      </div>
    </MainLayout>
  );
};

export default Documentation;
