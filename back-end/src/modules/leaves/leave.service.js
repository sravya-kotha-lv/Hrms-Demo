const Leave = require("./leave.model");
const Employee = require("../employees/employee.model");
const LeaveType = require("../leaveTypes/leaveType.model");
const { audit } = require("../auditLogs/auditLogs.service");
const Holiday = require("../holidays/holiday.model");
const WeekOff = require("../weekOffs/weekOff.model");
const WeekOffService = require("../weekOffs/weekOff.service");
const LeaveBalance =
  require("../leaveBalances/leaveBalance.model");
const Organization =
  require("../organizations/organization.model");
const Role = require("../roles/role.model");
const OrgSettings = require("../orgSettings/orgSettings.model");
const sendMail = require("../../utils/sendMail");
const { createNotificationSafe } = require("../notifications/notification.service");
const {
  resolveApplicableFlow,
  getActorApprovalContext,
  canActorApproveStep,
  resolveRecipientsForStep
} = require("../../utils/approvalFlowEngine");
const { advanceApprovalSteps, getCurrentPendingStep } = require("../../utils/approvalProgress");

const REQUEST_APPROVER_ROLE_SLUGS = new Set([
  "manager",
  "hr",
  "admin",
  "org-admin",
  "superadmin"
]);

const isSameDate = (d1, d2) =>
  new Date(d1).setHours(0, 0, 0, 0) === new Date(d2).setHours(0, 0, 0, 0);

const dateKey = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getApplicableLeaveDates = ({
  fromDate,
  toDate,
  weekOffDays,
  holidaySet,
  sandwichRuleEnabled
}) => {
  const dayMeta = [];
  let cursor = new Date(fromDate);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(toDate);
  end.setHours(0, 0, 0, 0);

  while (cursor <= end) {
    const key = dateKey(cursor);
    const isWeekOff = weekOffDays.includes(cursor.getDay());
    const isHoliday = holidaySet.has(key);
    dayMeta.push({
      date: new Date(cursor),
      excluded: isWeekOff || isHoliday
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  if (!sandwichRuleEnabled) {
    return dayMeta.filter((d) => !d.excluded).map((d) => d.date);
  }

  const firstWorkingIdx = dayMeta.findIndex((d) => !d.excluded);
  const lastWorkingIdx = dayMeta.length - 1 - [...dayMeta].reverse().findIndex((d) => !d.excluded);

  if (firstWorkingIdx === -1 || lastWorkingIdx === -1) {
    return [];
  }

  return dayMeta
    .filter((d, index) => {
      if (!d.excluded) return true;
      return index > firstWorkingIdx && index < lastWorkingIdx;
    })
    .map((d) => d.date);
};

const sendNotification = async ({ toEmail, toName, subject, message }) => {
  if (!toEmail) return;
  try {
    await sendMail("notification", toName || "User", subject, message, toEmail);
  } catch (_) {
    // non-blocking notification
  }
};

const notifyApprovalStepAssignees = async ({
  organizationId,
  step,
  actorEmployeeId = null,
  title,
  message,
  type,
  meta = {}
}) => {
  if (!step) return;
  const recipients = await resolveRecipientsForStep({ organizationId, step });
  for (const recipient of recipients) {
    await createNotificationSafe({
      organizationId,
      recipientUserId: recipient.userId,
      recipientEmployeeId: recipient.employeeId,
      actorEmployeeId,
      type,
      title,
      message,
      meta
    });
  }
};

const getActorRoleSlug = async (req) => {
  if (!req.user.activeRoleId) return "";
  const role = await Role.findOne({
    _id: req.user.activeRoleId,
    organizationId: req.user.organizationId
  }).select("slug");
  return role?.slug || "";
};

const assertRequestApproverAccess = async (req, targetEmployeeId) => {
  const actorRoleSlug = await getActorRoleSlug(req);
  if (!REQUEST_APPROVER_ROLE_SLUGS.has(actorRoleSlug)) {
    throw new Error("Only reporting manager, HR, or admin can action requests");
  }

  if (actorRoleSlug === "manager") {
    const managerEmployee = await Employee.findOne({
      userId: req.user.userId,
      organizationId: req.user.organizationId
    }).select("_id");

    if (!managerEmployee) {
      throw new Error("Access denied");
    }

    const isReport = await Employee.exists({
      organizationId: req.user.organizationId,
      _id: targetEmployeeId,
      managerId: managerEmployee._id
    });
    if (!isReport) {
      throw new Error("Access denied");
    }
  }
};

exports.applyLeave = async (req) => {

  // 1. Find employee from logged-in user
  const employee = await Employee.findOne({
    userId: req.user.userId,
    organizationId: req.user.organizationId
  });

  const fromDate = new Date(req.body.fromDate);
  const toDate = new Date(req.body.toDate);
  const duration = req.body.duration || "full_day";
  const halfDaySession = duration === "half_day" ? req.body.halfDaySession : null;

  if (fromDate > toDate) {
    throw new Error("From date cannot be greater than to date");
  }
  if (duration === "half_day" && fromDate.getTime() !== toDate.getTime()) {
    throw new Error("Half-day leave must be applied for a single date");
  }

  if (!employee) throw new Error("Employee not found");
  const lifecycleStatus = employee.employmentLifecycleStatus || "confirmed";
  if (lifecycleStatus !== "confirmed") {
    throw new Error("Only confirmed employees can apply leave");
  }

  /* 🔒 STEP 4A: CHECK OVERLAPPING LEAVES */
  const overlappingLeave = await Leave.findOne({
    employeeId: employee._id,
    status: { $in: ["pending", "approved"] },
    $or: [
      {
        fromDate: { $lte: req.body.toDate },
        toDate: { $gte: req.body.fromDate }
      }
    ]
  });

  if (overlappingLeave) {
    throw new Error("You already have a leave applied for these dates");
  }

  const [holidays, settings] = await Promise.all([
    Holiday.find({
      organizationId: req.user.organizationId,
      date: {
        $gte: new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate()),
        $lte: new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59, 999)
      },
      status: "active"
    }),
    OrgSettings.findOne({ organizationId: req.user.organizationId }).select("sandwichRuleEnabled")
  ]);

  const sandwichRuleEnabled = Boolean(settings?.sandwichRuleEnabled);
  const weekOffDays = await WeekOffService.resolveWeekOffDays({
    organizationId: req.user.organizationId,
    shiftId: employee.shiftId
  });
  const holidaySet = new Set((holidays || []).map((h) => dateKey(h.date)));

  const validLeaveDates = getApplicableLeaveDates({
    fromDate,
    toDate,
    weekOffDays,
    holidaySet,
    sandwichRuleEnabled
  });

  if (
    fromDate.getTime() === toDate.getTime() &&
    validLeaveDates.length === 0
  ) {
    throw new Error("Selected date is a holiday or week off");
  }

  if (validLeaveDates.length === 0) {
    throw new Error("Selected dates fall on holidays or week offs");
  }



  // 2. Validate leave type
  const leaveType = await LeaveType.findOne({
    _id: req.body.leaveTypeId,
    organizationId: req.user.organizationId,
    status: "active"
  });
  if (!leaveType) throw new Error("Invalid leave type");

  // 3. Calculate days
  let totalDays = validLeaveDates.length;
  if (duration === "half_day") {
    if (validLeaveDates.length !== 1 || !isSameDate(validLeaveDates[0], fromDate)) {
      throw new Error("Half-day leave is not allowed on holidays or week offs");
    }
    totalDays = 0.5;
  }

  const org = await Organization.findById(req.user.organizationId);

  const cycleStartYear =
    fromDate.getMonth() + 1 < org.leaveCycleStartMonth
      ? fromDate.getFullYear() - 1
      : fromDate.getFullYear();

  const balance = await LeaveBalance.findOneAndUpdate(
    {
      organizationId: req.user.organizationId,
      employeeId: employee._id,
      leaveTypeId: req.body.leaveTypeId,
      cycleStartYear,
      remaining: { $gte: totalDays }
    },
    {
      $inc: {
        pending: totalDays,
        remaining: -totalDays
      }
    },
    { new: true }
  );

  if (!balance) {
    throw new Error("Insufficient leave balance");
  }


  // 4. Create leave
  let leave;
  const flowConfig = await resolveApplicableFlow({
    organizationId: req.user.organizationId,
    moduleKey: "leave",
    subjectEmployee: employee,
    totalDays
  });
  const initialPendingStep = (flowConfig?.steps || []).find((s) => s.status === "pending");
  try {
    leave = await Leave.create({
      organizationId: req.user.organizationId,
      employeeId: employee._id,
      leaveTypeId: req.body.leaveTypeId,
      fromDate: req.body.fromDate,
      toDate: req.body.toDate,
      duration,
      halfDaySession,
      totalDays,
      status: "pending",
      reason: req.body.reason,
      approvalFlowId: flowConfig?.flowId || null,
      approvalSteps: flowConfig?.steps || [],
      currentApprovalStep: initialPendingStep?.stepNumber || null
    });
  } catch (err) {
    await LeaveBalance.updateOne(
      {
        organizationId: req.user.organizationId,
        employeeId: employee._id,
        leaveTypeId: req.body.leaveTypeId,
        cycleStartYear
      },
      {
        $inc: {
          pending: -totalDays,
          remaining: totalDays
        }
      }
    );
    throw err;
  }

  // 5. Audit
  await audit({
    req,
    module: "leaves",
    action: "APPLY",
    entityId: leave._id,
    after: leave.toObject()
  });

  const pendingStep = getCurrentPendingStep(leave.approvalSteps || []);
  if (pendingStep) {
    const employeeName = `${employee.firstName || ""} ${employee.lastName || ""}`.trim();
    await notifyApprovalStepAssignees({
      organizationId: req.user.organizationId,
      step: pendingStep,
      actorEmployeeId: employee._id,
      type: "leave_pending_approval",
      title: "Leave approval pending",
      message: `${employeeName} applied leave from ${new Date(req.body.fromDate).toDateString()} to ${new Date(req.body.toDate).toDateString()}.`,
      meta: {
        leaveId: leave._id,
        status: leave.status,
        currentApprovalStep: leave.currentApprovalStep
      }
    });
  } else {
    const manager = employee.managerId
      ? await Employee.findById(employee.managerId).populate("userId", "email")
      : null;
    if (manager?.userId?.email) {
      const employeeName = `${employee.firstName || ""} ${employee.lastName || ""}`.trim();
      await sendNotification({
        toEmail: manager.userId.email,
        toName: manager.firstName,
        subject: "New Leave Request",
        message: `${employeeName} applied leave from ${req.body.fromDate} to ${req.body.toDate}.`
      });
    }
  }

  return leave;
};

exports.getApplyContext = async (req) => {
  const employee = await Employee.findOne({
    userId: req.user.userId,
    organizationId: req.user.organizationId
  });
  if (!employee) throw new Error("Employee not found");
  const lifecycleStatus = employee.employmentLifecycleStatus || "confirmed";
  if (lifecycleStatus !== "confirmed") {
    throw new Error("Only confirmed employees can apply leave");
  }

  const [holidays, leaveTypes, balances, myLeaves, settings, weekOffConfigs] = await Promise.all([
    Holiday.find({
      organizationId: req.user.organizationId,
      status: "active",
      date: {
        $gte: new Date(new Date().getFullYear(), 0, 1),
        $lte: new Date(new Date().getFullYear() + 1, 11, 31, 23, 59, 59, 999)
      }
    }).sort({ date: 1 }),
    LeaveType.find({
      organizationId: req.user.organizationId,
      status: "active"
    }).select("_id name code"),
    LeaveBalance.find({
      organizationId: req.user.organizationId,
      employeeId: employee._id
    })
      .populate("leaveTypeId", "name code")
      .sort({ cycleStartYear: -1 }),
    Leave.find({
      organizationId: req.user.organizationId,
      employeeId: employee._id,
      status: { $in: ["pending", "approved"] }
    })
      .populate("leaveTypeId", "name code")
      .sort({ createdAt: -1 }),
    OrgSettings.findOne({ organizationId: req.user.organizationId }).select("sandwichRuleEnabled"),
    WeekOff.find({ organizationId: req.user.organizationId })
      .populate("shiftId", "name code status")
      .select("weekOffDays shiftId")
  ]);

  const defaultWeekOffDays = weekOffConfigs.find((cfg) => !cfg.shiftId)?.weekOffDays || [];
  const shiftWeekOffDays =
    weekOffConfigs.find((cfg) => cfg.shiftId && String(cfg.shiftId._id || cfg.shiftId) === String(employee.shiftId))?.weekOffDays ||
    defaultWeekOffDays;

  return {
    weekOffDays: shiftWeekOffDays,
    weekOffConfig: {
      defaultWeekOffDays,
      employeeShiftId: employee.shiftId || null,
      employeeWeekOffDays: shiftWeekOffDays,
      shiftConfigs: weekOffConfigs
        .filter((cfg) => cfg.shiftId)
        .map((cfg) => ({
          shiftId: cfg.shiftId?._id || cfg.shiftId,
          shiftName: cfg.shiftId?.name || "",
          shiftCode: cfg.shiftId?.code || "",
          weekOffDays: cfg.weekOffDays || []
        }))
    },
    sandwichRuleEnabled: Boolean(settings?.sandwichRuleEnabled),
    holidays: holidays.map((h) => ({ _id: h._id, name: h.name, date: h.date })),
    leaveTypes,
    balances: balances.map((b) => ({
      leaveTypeId: b.leaveTypeId?._id || b.leaveTypeId,
      leaveType: b.leaveTypeId?.name || "",
      code: b.leaveTypeId?.code || "",
      cycleStartYear: b.cycleStartYear,
      total: b.total,
      used: b.used,
      pending: b.pending || 0,
      remaining: b.remaining
    })),
    myLeaves: myLeaves.map((l) => ({
      _id: l._id,
      leaveTypeId: l.leaveTypeId?._id || l.leaveTypeId,
      leaveType: l.leaveTypeId?.name || "",
      fromDate: l.fromDate,
      toDate: l.toDate,
      duration: l.duration || "full_day",
      halfDaySession: l.halfDaySession || null,
      status: l.status,
      totalDays: l.totalDays
    }))
  };
};

exports.getMyLeavesRange = async (req) => {
  const employee = await Employee.findOne({
    userId: req.user.userId,
    organizationId: req.user.organizationId
  });

  if (!employee) throw new Error("Employee not found");

  const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
  const endDate = req.query.endDate ? new Date(req.query.endDate) : null;

  const query = {
    organizationId: req.user.organizationId,
    employeeId: employee._id,
    status: "approved"
  };

  if (startDate && endDate) {
    query.fromDate = { $lte: endDate };
    query.toDate = { $gte: startDate };
  }

  return Leave.find(query)
    .populate("leaveTypeId", "name code")
    .sort({ fromDate: 1 });
};

exports.getMyLeaves = async (req) => {
  const employee = await Employee.findOne({
    userId: req.user.userId,
    organizationId: req.user.organizationId
  });

  return Leave.find({ employeeId: employee._id })
    .populate("leaveTypeId", "name code")
    .populate("approvalSteps.approverEmployeeId", "firstName lastName employeeCode")
    .populate("approvalSteps.actionBy", "firstName lastName employeeCode")
    .sort({ createdAt: -1 });
};

exports.getAllLeaves = async (req) => {
  const query = { organizationId: req.user.organizationId };

  if (req.user.activeRoleId) {
    const role = await Role.findOne({
      _id: req.user.activeRoleId,
      organizationId: req.user.organizationId
    }).select("slug");

    if (role?.slug === "manager") {
      const managerEmployee = await Employee.findOne({
        userId: req.user.userId,
        organizationId: req.user.organizationId
      }).select("_id");

      if (managerEmployee) {
        const reportIds = await Employee.find({
          organizationId: req.user.organizationId,
          managerId: managerEmployee._id
        }).distinct("_id");
        query.employeeId = { $in: reportIds };
      }
    }
  }

  return Leave.find(query)
    .populate("employeeId", "firstName lastName employeeCode")
    .populate("leaveTypeId", "name code")
    .populate("approvalSteps.approverEmployeeId", "firstName lastName employeeCode")
    .populate("approvalSteps.actionBy", "firstName lastName employeeCode")
    .sort({ createdAt: -1 });
};

exports.getMyPendingApprovals = async (req) => {
  const actorRoleSlug = await getActorRoleSlug(req);
  if (!REQUEST_APPROVER_ROLE_SLUGS.has(actorRoleSlug)) {
    return [];
  }

  const query = {
    organizationId: req.user.organizationId,
    status: "pending"
  };

  if (actorRoleSlug === "manager") {
    const managerEmployee = await Employee.findOne({
      userId: req.user.userId,
      organizationId: req.user.organizationId
    }).select("_id");

    if (!managerEmployee) {
      return [];
    }

    const reportIds = await Employee.find({
      organizationId: req.user.organizationId,
      managerId: managerEmployee._id
    }).distinct("_id");
    query.employeeId = { $in: reportIds };
  }

  const rows = await Leave.find(query)
    .populate("employeeId", "firstName lastName employeeCode")
    .populate("leaveTypeId", "name code")
    .populate("approvalSteps.approverEmployeeId", "firstName lastName employeeCode")
    .populate("approvalSteps.actionBy", "firstName lastName employeeCode")
    .sort({ createdAt: -1 });

  return rows;
};

exports.actionLeave = async (req) => {
  const leave = await Leave.findById(req.params.id);
  if (!leave) throw new Error("Leave not found");

  // 🔒 store previous status (VERY IMPORTANT)
  const previousStatus = leave.status;

  const actor = await Employee.findOne({
    userId: req.user.userId,
    organizationId: req.user.organizationId
  });

  await assertRequestApproverAccess(req, leave.employeeId);

  const org = await Organization.findById(leave.organizationId);
  const cycleStartYear =
    new Date(leave.fromDate).getMonth() + 1 < org.leaveCycleStartMonth
      ? new Date(leave.fromDate).getFullYear() - 1
      : new Date(leave.fromDate).getFullYear();

  const balance = await LeaveBalance.findOne({
    organizationId: leave.organizationId,
    employeeId: leave.employeeId,
    leaveTypeId: leave.leaveTypeId,
    cycleStartYear
  });

  const actorContext = await getActorApprovalContext(req);
  let finalStatusToApply = req.body.status;
  let isIntermediateApproval = false;

  if (["approved", "rejected"].includes(req.body.status) && Array.isArray(leave.approvalSteps) && leave.approvalSteps.length) {
    const currentStep = getCurrentPendingStep(leave.approvalSteps || []);
    if (!currentStep) {
      throw new Error("No pending approval step found");
    }

    const allowedByFlow = canActorApproveStep(currentStep, actorContext);
    if (allowedByFlow) {
      const progress = advanceApprovalSteps({
        steps: leave.approvalSteps || [],
        action: req.body.status,
        actionBy: actor?._id || null,
        remarks: req.body.status === "rejected" ? req.body.rejectionReason || "" : null
      });
      leave.approvalSteps = progress.steps;
      leave.currentApprovalStep = progress.currentApprovalStep;
      finalStatusToApply = progress.finalStatus;
      isIntermediateApproval = progress.isIntermediateApproval;
    } else {
      // Privileged override: reporting manager/HR/admin can finalize request even if flow step mismatches.
      const overrideStatus = req.body.status === "approved" ? "approved" : "rejected";
      const actionAt = new Date();
      leave.approvalSteps = (leave.approvalSteps || []).map((step) => {
        if (step.status === "approved" || step.status === "rejected") return step;
        return {
          ...step,
          status: overrideStatus,
          actionBy: actor?._id || null,
          actionAt,
          remarks: req.body.status === "rejected" ? req.body.rejectionReason || "" : "Approved by authorized approver"
        };
      });
      leave.currentApprovalStep = null;
      finalStatusToApply = req.body.status;
      isIntermediateApproval = false;
    }
  }

  if (finalStatusToApply === "approved" && !isIntermediateApproval) {
    if (leave.status === "approved") {
      throw new Error("Leave already approved");
    }
    if (!balance) {
      throw new Error("Leave balance not found");
    }

    if (previousStatus === "pending") {
      if ((balance.pending || 0) >= leave.totalDays) {
        balance.pending -= leave.totalDays;
        balance.used += leave.totalDays;
      } else {
        // Backward compatibility: old pending leaves created before reservation logic
        if (balance.remaining < leave.totalDays) {
          throw new Error("Insufficient leave balance to approve");
        }
        balance.used += leave.totalDays;
        balance.remaining -= leave.totalDays;
      }
    } else if (previousStatus === "rejected" || previousStatus === "cancelled") {
      if (balance.remaining < leave.totalDays) {
        throw new Error("Insufficient leave balance to approve");
      }
      balance.used += leave.totalDays;
      balance.remaining -= leave.totalDays;
    }

    await balance.save();

  } else if (finalStatusToApply === "rejected") {
    if (balance && previousStatus === "pending") {
      if ((balance.pending || 0) >= leave.totalDays) {
        balance.pending -= leave.totalDays;
        balance.remaining += leave.totalDays;
        await balance.save();
      }
    } else if (balance && previousStatus === "approved") {
      balance.used = Math.max(0, balance.used - leave.totalDays);
      balance.remaining += leave.totalDays;
      await balance.save();
    }
    leave.rejectionReason = req.body.rejectionReason;
  } else if (isIntermediateApproval) {
    // Approval progressed to next step; keep leave in pending state.
    finalStatusToApply = "pending";
  } else {
    throw new Error("Invalid leave action");
  }
  leave.status = finalStatusToApply;
  leave.actionBy = actor?._id;
  leave.actionAt = new Date();

  await leave.save();

  if (isIntermediateApproval) {
    const leaveEmployee = await Employee.findById(leave.employeeId).select("firstName lastName");
    const pendingStep = getCurrentPendingStep(leave.approvalSteps || []);
    await notifyApprovalStepAssignees({
      organizationId: leave.organizationId,
      step: pendingStep,
      actorEmployeeId: actor?._id || null,
      type: "leave_pending_approval",
      title: "Leave approval pending",
      message: `${leaveEmployee?.firstName || "Employee"} ${leaveEmployee?.lastName || ""}`.trim()
        + ` leave is waiting for your approval.`,
      meta: {
        leaveId: leave._id,
        status: leave.status,
        currentApprovalStep: leave.currentApprovalStep
      }
    });
  }

  if (!isIntermediateApproval) {
    const leaveEmployee = await Employee.findById(leave.employeeId).populate("userId", "email");
    if (leaveEmployee?.userId?.email) {
      await sendNotification({
        toEmail: leaveEmployee.userId.email,
        toName: leaveEmployee.firstName,
        subject: `Leave ${leave.status}`,
        message: `Your leave request from ${new Date(leave.fromDate).toDateString()} to ${new Date(leave.toDate).toDateString()} is ${leave.status}.`
      });
    }
    if (leaveEmployee?.userId?._id) {
      const actorName = actor
        ? `${actor.firstName || ""} ${actor.lastName || ""}`.trim() || "Manager"
        : "Manager";
      await createNotificationSafe({
        organizationId: leave.organizationId,
        recipientUserId: leaveEmployee.userId._id,
        recipientEmployeeId: leaveEmployee._id,
        actorEmployeeId: actor?._id || null,
        type: "leave_action",
        title: `Leave ${leave.status}`,
        message: `${actorName} marked your leave (${new Date(leave.fromDate).toDateString()} to ${new Date(leave.toDate).toDateString()}) as ${leave.status}.`,
        meta: {
          leaveId: leave._id,
          status: leave.status
        }
      });
    }
  }

  return leave;
};
