const ApprovalFlow = require("../modules/approvalFlows/approvalFlow.model");
const Employee = require("../modules/employees/employee.model");
const Role = require("../modules/roles/role.model");
const OrgUser = require("../modules/organizations/org-user.model");

const buildRuntimeSteps = ({ flow, subjectEmployee }) => {
  const steps = [];
  for (const s of flow.steps || []) {
    let approverEmployeeId = null;
    let approverRoleSlug = null;

    if (s.approverType === "manager") {
      if (!subjectEmployee?.managerId) {
        throw new Error("Manager is not assigned for this employee");
      }
      approverEmployeeId = subjectEmployee.managerId;
    } else if (s.approverType === "employee") {
      approverEmployeeId = s.employeeId || null;
    } else if (s.approverType === "role") {
      approverRoleSlug = s.roleSlug || null;
    }

    steps.push({
      stepNumber: s.stepNumber,
      approverType: s.approverType,
      approverEmployeeId,
      approverRoleSlug,
      status: "queued",
      actionBy: null,
      actionAt: null,
      remarks: null
    });
  }

  steps.sort((a, b) => a.stepNumber - b.stepNumber);
  if (steps.length) {
    steps[0].status = "pending";
  }
  return steps;
};

exports.resolveApplicableFlow = async ({
  organizationId,
  moduleKey,
  subjectEmployee,
  totalDays = null
}) => {
  const flows = await ApprovalFlow.find({
    organizationId,
    moduleKey,
    isActive: true
  }).sort({ createdAt: -1 });

  const flow = flows.find((f) => {
    if (totalDays == null) return true;
    const minOk = f.minDays == null || Number(totalDays) >= Number(f.minDays);
    const maxOk = f.maxDays == null || Number(totalDays) <= Number(f.maxDays);
    return minOk && maxOk;
  });

  if (!flow) return null;

  return {
    flowId: flow._id,
    steps: buildRuntimeSteps({ flow, subjectEmployee })
  };
};

exports.getActorApprovalContext = async (req) => {
  const [actorEmployee, actorRole] = await Promise.all([
    Employee.findOne({
      userId: req.user.userId,
      organizationId: req.user.organizationId
    }).select("_id"),
    req.user.activeRoleId
      ? Role.findOne({
          _id: req.user.activeRoleId,
          organizationId: req.user.organizationId
        }).select("slug")
      : null
  ]);

  return {
    actorEmployeeId: actorEmployee?._id || null,
    actorRoleSlug: actorRole?.slug || null
  };
};

exports.canActorApproveStep = (step, actorContext) => {
  if (!step || !actorContext) return false;
  if (step.approverType === "manager" || step.approverType === "employee") {
    if (!step.approverEmployeeId || !actorContext.actorEmployeeId) return false;
    return step.approverEmployeeId.toString() === actorContext.actorEmployeeId.toString();
  }
  if (step.approverType === "role") {
    if (!step.approverRoleSlug || !actorContext.actorRoleSlug) return false;
    return step.approverRoleSlug === actorContext.actorRoleSlug;
  }
  return false;
};

exports.resolveRecipientsForStep = async ({ organizationId, step }) => {
  if (!organizationId || !step) return [];

  if (step.approverType === "employee" || step.approverType === "manager") {
    if (!step.approverEmployeeId) return [];
    const employee = await Employee.findOne({
      _id: step.approverEmployeeId,
      organizationId,
      status: "active"
    }).select("_id userId firstName lastName employeeCode");
    if (!employee?.userId) return [];
    return [{
      employeeId: employee._id,
      userId: employee.userId,
      firstName: employee.firstName,
      lastName: employee.lastName,
      employeeCode: employee.employeeCode || null
    }];
  }

  if (step.approverType === "role") {
    if (!step.approverRoleSlug) return [];
    const role = await Role.findOne({
      organizationId,
      slug: step.approverRoleSlug
    }).select("_id");
    if (!role?._id) return [];

    const orgUsers = await OrgUser.find({
      organizationId,
      roleIds: role._id
    }).select("userId");
    const userIds = [...new Set(orgUsers.map((u) => u.userId?.toString()).filter(Boolean))];
    if (!userIds.length) return [];

    const employees = await Employee.find({
      organizationId,
      status: "active",
      userId: { $in: userIds }
    }).select("_id userId firstName lastName employeeCode");

    return employees
      .filter((e) => e.userId)
      .map((e) => ({
        employeeId: e._id,
        userId: e.userId,
        firstName: e.firstName,
        lastName: e.lastName,
        employeeCode: e.employeeCode || null
      }));
  }

  return [];
};
