import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-card rounded-xl card-shadow p-6 mb-5">
    <h3 className="text-lg font-semibold mb-3">{title}</h3>
    <div className="text-sm text-muted-foreground space-y-2">{children}</div>
  </div>
);

const Documentation = () => {
  return (
    <MainLayout
      title="Documentation"
      breadcrumb={[{ label: "Home", href: "/" }, { label: "Documentation" }]}
    >
      <Section title="Purpose">
        <p>
          This page explains what is required before creating an employee, what fields are mandatory,
          and common validation errors.
        </p>
      </Section>

      <Section title="Mandatory Prerequisites (Before Add Employee)">
        <p>These master records must exist in your organization first:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <span className="font-medium text-foreground">At least one Role</span> (used in <code>roleIds</code>)
          </li>
          <li>
            <span className="font-medium text-foreground">At least one Department</span> (used in <code>departmentId</code>)
          </li>
          <li>
            <span className="font-medium text-foreground">At least one Designation</span> (used in <code>designationId</code>)
          </li>
        </ul>
        <p className="pt-2">
          Optional but recommended setup before onboarding at scale:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Shifts (if attendance is shift-based)</li>
          <li>Leave Types and leave settings</li>
          <li>Reporting hierarchy (managers already present)</li>
        </ul>
      </Section>

      <Section title="Mandatory Employee Fields">
        <p>Backend validation requires these fields when creating employee:</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Badge variant="secondary">email</Badge>
          <Badge variant="secondary">roleIds (min 1)</Badge>
          <Badge variant="secondary">firstName</Badge>
          <Badge variant="secondary">lastName</Badge>
          <Badge variant="secondary">departmentId</Badge>
          <Badge variant="secondary">designationId</Badge>
          <Badge variant="secondary">dateOfJoining</Badge>
          <Badge variant="secondary">employmentType</Badge>
        </div>
        <p className="pt-2">Allowed employment types:</p>
        <div className="flex flex-wrap gap-2">
          <Badge>full_time</Badge>
          <Badge>part_time</Badge>
          <Badge>contract</Badge>
        </div>
      </Section>

      <Section title="Optional Employee Fields">
        <ul className="list-disc pl-5 space-y-1">
          <li><code>managerId</code> (recommended for approvals/reporting)</li>
          <li><code>shiftId</code> (recommended for attendance logic)</li>
          <li><code>employeeCode</code> (system auto-generates if not provided in form flow)</li>
        </ul>
      </Section>

      <Section title="What Happens On Create">
        <ol className="list-decimal pl-5 space-y-1">
          <li>User account is created with email/password.</li>
          <li>User is mapped to organization + selected role(s).</li>
          <li>Employee record is created (with auto employee code in current service flow).</li>
          <li>Initial leave balances are initialized.</li>
          <li>Onboarding email is sent with login credentials.</li>
        </ol>
      </Section>

      <Section title="Common Errors and Fixes">
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <span className="font-medium text-foreground">User already exists</span>:
            email is already used. Use another email or update existing employee.
          </li>
          <li>
            <span className="font-medium text-foreground">Validation failed for roleIds/departmentId/designationId</span>:
            selected value is missing/invalid/deleted.
          </li>
          <li>
            <span className="font-medium text-foreground">No active organization selected</span>:
            ensure logged-in context has active org.
          </li>
          <li>
            <span className="font-medium text-foreground">Onboarding email failed</span>:
            verify SMTP env config and sender credentials.
          </li>
        </ul>
      </Section>

      <Section title="Recommended Admin Checklist">
        <ol className="list-decimal pl-5 space-y-1">
          <li>Create Department(s)</li>
          <li>Create Designation(s)</li>
          <li>Create Role(s) and assign permissions</li>
          <li>Configure Shifts and Organization Settings</li>
          <li>Create Leave Types and leave rules</li>
          <li>Add Manager employees first, then team members</li>
        </ol>
      </Section>

      <Section title="Leave Setup Prerequisites">
        <p>Before employees start applying leave, configure the following:</p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>
            <span className="font-medium text-foreground">Leave Types</span>:
            create all leave categories (Casual, Sick, Earned, etc.) with days/year.
          </li>
          <li>
            <span className="font-medium text-foreground">Org Leave Settings</span>:
            configure credit mode (current month onwards/full year) and sandwich rule.
          </li>
          <li>
            <span className="font-medium text-foreground">Week Offs and Holidays</span>:
            maintain correct weekly offs and holiday calendar.
          </li>
          <li>
            <span className="font-medium text-foreground">Approval Flows</span>:
            create module <code>leave</code> flow if multi-step approval is required.
          </li>
        </ol>
        <p className="pt-2">
          Expected result: leave balance reservation on apply, approval workflow visibility, and correct exclusion/inclusion
          of holidays/week-offs based on organization policy.
        </p>
      </Section>

      <Section title="Attendance and Shift Setup Prerequisites">
        <p>Before attendance goes live, configure these in order:</p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>
            <span className="font-medium text-foreground">Shifts</span>:
            create day/night shifts with start/end and grace minutes.
          </li>
          <li>
            <span className="font-medium text-foreground">Assign Shift to Employees</span>:
            map each employee to a shift where applicable.
          </li>
          <li>
            <span className="font-medium text-foreground">Week Offs and Holidays</span>:
            these are needed for attendance matrix highlighting and leave interactions.
          </li>
          <li>
            <span className="font-medium text-foreground">Attendance Lock Policy</span>:
            configure edit-lock window or payroll cutoff mode in organization settings.
          </li>
          <li>
            <span className="font-medium text-foreground">Attendance Request Flow</span>:
            define module <code>attendance_request</code> flow for correction/missed checkout approvals.
          </li>
          <li>
            <span className="font-medium text-foreground">Permissions</span>:
            verify admin/manager/employee permissions for view/manage actions.
          </li>
        </ol>
        <p className="pt-2">
          Recommended operational policy: no auto logout. If checkout is missed, employee should raise attendance request
          and approver acts through Pending Approvals.
        </p>
      </Section>
    </MainLayout>
  );
};

export default Documentation;
