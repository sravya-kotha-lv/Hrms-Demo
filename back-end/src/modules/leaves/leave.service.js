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
const {
  isValidTimeZone,
  toDateKeyInTimeZone,
  addDaysToDateKey,
  startOfDayInTimeZone,
  endOfDayInTimeZone,
  getDayInTimeZone
} = require("../../utils/timezone");

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

const toDateKeyInOrgTz = (value, timeZone) =>
  /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))
    ? String(value)
    : toDateKeyInTimeZone(value, timeZone);

const getApplicableLeaveDateKeys = ({
  fromDate,
  toDate,
  weekOffDays,
  holidaySet,
  sandwichRuleEnabled,
  timeZone = "Asia/Kolkata"
}) => {
  const dayMeta = [];
  let cursorKey = toDateKeyInOrgTz(fromDate, timeZone);
  const endKey = toDateKeyInOrgTz(toDate, timeZone);

  while (cursorKey <= endKey) {
    const isWeekOff = weekOffDays.includes(getDayInTimeZone(startOfDayInTimeZone(cursorKey, timeZone), timeZone));
    const isHoliday = holidaySet.has(cursorKey);
    dayMeta.push({
      key: cursorKey,
      excluded: isWeekOff || isHoliday
    });
    cursorKey = addDaysToDateKey(cursorKey, 1);
  }

  if (!sandwichRuleEnabled) {
    return dayMeta.filter((d) => !d.excluded).map((d) => d.key);
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
    .map((d) => d.key);
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

const getOrganizationTimeZone = async (organizationId) => {
  const settings = await OrgSettings.findOne({ organizationId }).select("timezone");
  if (isValidTimeZone(settings?.timezone)) return settings.timezone;

  const organization = await Organization.findById(organizationId).select("timezone");
  if (isValidTimeZone(organization?.timezone)) return organization.timezone;

  return "Asia/Kolkata";
};

const assertLeaveApplyWindow = async ({ organizationId, fromDate, toDate, timeZone = "UTC" }) => {
  const settings = await OrgSettings.findOne({ organizationId })
    .select("attendanceLockEnabled attendanceLockAfterDays attendanceLockMode payrollCutoffDay");

  if (!settings?.attendanceLockEnabled) return;

  const fromDateKey = /^\d{4}-\d{2}-\d{2}$/.test(String(fromDate || ""))
    ? String(fromDate)
    : toDateKeyInTimeZone(fromDate, timeZone);
  const toDateKey = /^\d{4}-\d{2}-\d{2}$/.test(String(toDate || ""))
    ? String(toDate)
    : toDateKeyInTimeZone(toDate, timeZone);

  const today = startOfDayInTimeZone(new Date(), timeZone);
  const todayKey = toDateKeyInTimeZone(today, timeZone);
  const mode = settings.attendanceLockMode || "days_window";

  if (mode === "days_window") {
    const lockAfterDays = Number(settings.attendanceLockAfterDays ?? 7);
    const earliestAllowedKey = addDaysToDateKey(todayKey, -lockAfterDays);
    if (fromDateKey < earliestAllowedKey || toDateKey < earliestAllowedKey) {
      throw new Error(`Attendance is locked for dates older than ${lockAfterDays} days. Leave cannot be applied for locked dates.`);
    }
    return;
  }

  const cutoffDay = Number(settings.payrollCutoffDay ?? 25);
  const currentDay = getDayInTimeZone(today, timeZone);
  const [todayYear, todayMonth] = todayKey.split("-").map(Number);
  const currentMonthFirstKey = `${todayYear}-${String(todayMonth).padStart(2, "0")}-01`;
  const previousMonthYear = todayMonth === 1 ? todayYear - 1 : todayYear;
  const previousMonth = todayMonth === 1 ? 12 : todayMonth - 1;
  const previousMonthFirstKey = `${previousMonthYear}-${String(previousMonth).padStart(2, "0")}-01`;
  // payroll_cutoff rule:
  // - once cutoff + 1 day is crossed, lock dates up to cutoff day of current month.
  // - before that, lock dates up to cutoff day of previous month.
  const periodStartKey = currentDay > cutoffDay
    ? addDaysToDateKey(currentMonthFirstKey, cutoffDay)
    : addDaysToDateKey(previousMonthFirstKey, cutoffDay);

  if (fromDateKey < periodStartKey || toDateKey < periodStartKey) {
    throw new Error(`Attendance is locked before payroll period start ${periodStartKey}. Leave cannot be applied for locked dates.`);
  }
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

  const organizationTimeZone = await getOrganizationTimeZone(req.user.organizationId);
  const fromDateKey = toDateKeyInOrgTz(req.body.fromDate, organizationTimeZone);
  const toDateKey = toDateKeyInOrgTz(req.body.toDate, organizationTimeZone);
  await assertLeaveApplyWindow({
    organizationId: req.user.organizationId,
    fromDate: req.body.fromDate,
    toDate: req.body.toDate,
    timeZone: organizationTimeZone
  });

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

  const rangeStart = startOfDayInTimeZone(fromDateKey, organizationTimeZone);
  const rangeEnd = endOfDayInTimeZone(toDateKey, organizationTimeZone);

  const [holidays, settings] = await Promise.all([
    Holiday.find({
      organizationId: req.user.organizationId,
      date: {
        $gte: rangeStart,
        $lte: rangeEnd
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
  const holidaySet = new Set((holidays || []).map((h) => toDateKeyInTimeZone(h.date, organizationTimeZone)));

  const validLeaveDateKeys = getApplicableLeaveDateKeys({
    fromDate: fromDateKey,
    toDate: toDateKey,
    weekOffDays,
    holidaySet,
    sandwichRuleEnabled,
    timeZone: organizationTimeZone
  });

  if (
    fromDateKey === toDateKey &&
    validLeaveDateKeys.length === 0
  ) {
    const isHoliday = holidaySet.has(fromDateKey);
    const isWeekOff = weekOffDays.includes(getDayInTimeZone(startOfDayInTimeZone(fromDateKey, organizationTimeZone), organizationTimeZone));

    if (isHoliday) {
      throw new Error("Selected date is a holiday");
    }
    if (isWeekOff) {
      throw new Error("Selected date is a week off");
    }
    throw new Error("Selected date is not a working day");
  }

  if (validLeaveDateKeys.length === 0) {
    throw new Error("Leave cannot be applied only on holidays or week offs without any working day");
  }



  // 2. Validate leave type
  const leaveType = await LeaveType.findOne({
    _id: req.body.leaveTypeId,
    organizationId: req.user.organizationId,
    status: "active"
  });
  if (!leaveType) throw new Error("Invalid leave type");

  // 3. Calculate days
  let totalDays = validLeaveDateKeys.length;
  if (duration === "half_day") {
    if (validLeaveDateKeys.length !== 1 || validLeaveDateKeys[0] !== fromDateKey) {
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

  const actorContext = await getActorApprovalContext(req);
  return rows.filter((row) => {
    const steps = Array.isArray(row.approvalSteps) ? row.approvalSteps : [];
    if (!steps.length) return true;
    const currentStep = getCurrentPendingStep(steps);
    if (!currentStep) return false;
    return canActorApproveStep(currentStep, actorContext);
  });
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
