const Leave = require("./leave.model");
const Employee = require("../employees/employee.model");
const LeaveType = require("../leaveTypes/leaveType.model");
const { audit } = require("../auditLogs/auditLogs.service");
const Holiday = require("../holidays/holiday.model");
const WeekOff = require("../weekOffs/weekOff.model");
const LeaveBalance =
  require("../leaveBalances/leaveBalance.model");
const Organization =
  require("../organizations/organization.model");
const Role = require("../roles/role.model");
const OrgSettings = require("../orgSettings/orgSettings.model");


const calculateDays = (from, to) => {
  const diff =
    (new Date(to).setHours(0, 0, 0, 0) -
      new Date(from).setHours(0, 0, 0, 0))
    / (1000 * 60 * 60 * 24);
  return diff + 1;
};

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

exports.applyLeave = async (req) => {

  // 1. Find employee from logged-in user
  const employee = await Employee.findOne({
    userId: req.user.userId,
    organizationId: req.user.organizationId
  });

  const fromDate = new Date(req.body.fromDate);
  const toDate = new Date(req.body.toDate);

  if (fromDate > toDate) {
    throw new Error("From date cannot be greater than to date");
  }

  if (!employee) throw new Error("Employee not found");

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

  const weekOffConfig = await WeekOff.findOne({
    organizationId: req.user.organizationId,
  });

  const sandwichRuleEnabled = Boolean(settings?.sandwichRuleEnabled);
  const weekOffDays = weekOffConfig?.weekOffDays || [];
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
  // const totalDays = calculateDays(req.body.fromDate, req.body.toDate);
  const totalDays = validLeaveDates.length;

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
  try {
    leave = await Leave.create({
      organizationId: req.user.organizationId,
      employeeId: employee._id,
      leaveTypeId: req.body.leaveTypeId,
      fromDate: req.body.fromDate,
      toDate: req.body.toDate,
      totalDays,
      status: "pending",
      reason: req.body.reason
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

  return leave;
};

exports.getApplyContext = async (req) => {
  const employee = await Employee.findOne({
    userId: req.user.userId,
    organizationId: req.user.organizationId
  });
  if (!employee) throw new Error("Employee not found");

  const [weekOffConfig, holidays, leaveTypes, balances, myLeaves, settings] = await Promise.all([
    WeekOff.findOne({ organizationId: req.user.organizationId }),
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
    OrgSettings.findOne({ organizationId: req.user.organizationId }).select("sandwichRuleEnabled")
  ]);

  return {
    weekOffDays: weekOffConfig?.weekOffDays || [],
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
    .sort({ createdAt: -1 });
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
        const isReport = reportIds.some(
          (id) => id.toString() === leave.employeeId.toString()
        );
        if (!isReport) {
          throw new Error("Access denied");
        }
      }
    }
  }

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

  if (req.body.status === "approved") {
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

  } else if (req.body.status === "rejected") {
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
  } else {
    throw new Error("Invalid leave action");
  }
  leave.status = req.body.status;
  leave.actionBy = actor?._id;
  leave.actionAt = new Date();

  await leave.save();
  return leave;
};
