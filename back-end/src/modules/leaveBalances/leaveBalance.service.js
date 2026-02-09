const LeaveBalance = require("./leaveBalance.model");
const LeaveType = require("../leaveTypes/leaveType.model");
const Organization = require("../organizations/organization.model");
const Employee = require("../employees/employee.model");
const OrgSettings = require("../orgSettings/orgSettings.model");

/**
 * Get leave cycle start year based on org configuration
 */
const getCycleStartYear = (date, startMonth) => {
  return date.getMonth() + 1 < startMonth
    ? date.getFullYear() - 1
    : date.getFullYear();
};

/**
 * Round value to 2 decimals
 */
const roundTwo = (value) => Math.round(value * 100) / 100;
const getCycleStartDate = (date, startMonth) => {
  const d = new Date(date);
  const year = d.getMonth() + 1 < startMonth ? d.getFullYear() - 1 : d.getFullYear();
  return new Date(year, startMonth - 1, 1);
};

const monthsBetween = (from, to) =>
  (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());

const getCycleEndDate = (date, startMonth) => {
  const cycleStart = getCycleStartDate(date, startMonth);
  return new Date(cycleStart.getFullYear() + 1, cycleStart.getMonth(), 0);
};

const getRemainingPeriods = (date, frequency, cycleStartMonth) => {
  const now = new Date(date);
  const cycleEnd = getCycleEndDate(now, cycleStartMonth);

  if (frequency === "monthly") {
    const monthsLeft = monthsBetween(now, cycleEnd) + 1;
    return { remainingPeriods: monthsLeft, totalPeriods: 12 };
  }

  if (frequency === "quarterly") {
    const { periodStart } = getPeriodInfo(now, frequency, cycleStartMonth);
    const monthsLeft = monthsBetween(periodStart, cycleEnd) + 1;
    const remainingPeriods = Math.ceil(monthsLeft / 3);
    return { remainingPeriods, totalPeriods: 4 };
  }

  const monthsLeft = monthsBetween(now, cycleEnd) + 1;
  return { remainingPeriods: monthsLeft, totalPeriods: 12 };
};

const getPeriodInfo = (date, frequency, cycleStartMonth) => {
  const now = new Date(date);
  now.setHours(0, 0, 0, 0);

  if (frequency === "monthly") {
    return { periodStart: new Date(now.getFullYear(), now.getMonth(), 1), periodsPerYear: 12 };
  }

  const cycleStart = getCycleStartDate(now, cycleStartMonth);
  if (frequency === "yearly") {
    return { periodStart: cycleStart, periodsPerYear: 1 };
  }

  const offsetMonths = monthsBetween(cycleStart, now);
  const quarterIndex = Math.floor(offsetMonths / 3);
  const periodStart = new Date(
    cycleStart.getFullYear(),
    cycleStart.getMonth() + quarterIndex * 3,
    1
  );
  return { periodStart, periodsPerYear: 4 };
};

/**
 * Initialize leave balance when employee is created
 */
exports.initializeForEmployee = async (employee, organizationId) => {
  // 1️⃣ fetch organization (for leave cycle)
  const org = await Organization.findById(organizationId);
  if (!org) return;

  const settings = await OrgSettings.findOne({ organizationId });
  const frequency = settings?.leaveCreditFrequency || "monthly";
  // 2️⃣ determine leave cycle year
  const doj = new Date(employee.dateOfJoining);
  const cycleStartYear = getCycleStartYear(
    doj,
    org.leaveCycleStartMonth
  );

  const { periodStart, periodsPerYear } = getPeriodInfo(
    doj,
    frequency,
    org.leaveCycleStartMonth
  );
  const { remainingPeriods, totalPeriods } = getRemainingPeriods(
    doj,
    frequency,
    org.leaveCycleStartMonth
  );

  // 3️⃣ fetch active leave types
  const leaveTypes = await LeaveType.find({
    organizationId,
    status: "active"
  });

  if (!leaveTypes.length) return;

  // 4️⃣ prepare bulk insert
  const bulkOps = leaveTypes.map((lt) => {
    const creditPerPeriod = roundTwo(lt.daysPerYear / periodsPerYear);
    let total = roundTwo(creditPerPeriod * remainingPeriods);

    if (frequency === "yearly") {
      total = roundTwo((lt.daysPerYear / totalPeriods) * remainingPeriods);
    }

    if (frequency === "monthly") {
      const joinDay = doj.getDate();
      if (joinDay > 15) total = roundTwo(total - creditPerPeriod / 2);
    }

    return {
      updateOne: {
        filter: {
          organizationId,
          employeeId: employee._id,
          leaveTypeId: lt._id,
          cycleStartYear
        },
        update: {
          $setOnInsert: {
            total,
            used: 0,
            remaining: total,
            lastCreditedAt: periodStart
          }
        },
        upsert: true
      }
    };
  });

  // 5️⃣ create leave balances
  await LeaveBalance.bulkWrite(bulkOps);
};

/**
 * Initialize leave balance for all employees when a new leave type is created
 */
exports.initializeForNewLeaveType = async (leaveType, organizationId) => {
  const org = await Organization.findById(organizationId);
  if (!org) return;

  const settings = await OrgSettings.findOne({ organizationId });
  const frequency = settings?.leaveCreditFrequency || "monthly";

  const employees = await Employee.find({ organizationId });
  if (!employees.length) return;

  const bulkOps = employees.map((employee) => {
    const doj = new Date(employee.dateOfJoining || new Date());
    const cycleStartYear = getCycleStartYear(doj, org.leaveCycleStartMonth);
    const { periodStart, periodsPerYear } = getPeriodInfo(
      doj,
      frequency,
      org.leaveCycleStartMonth
    );
    const { remainingPeriods, totalPeriods } = getRemainingPeriods(
      doj,
      frequency,
      org.leaveCycleStartMonth
    );

    const creditPerPeriod = roundTwo(leaveType.daysPerYear / periodsPerYear);
    let total = roundTwo(creditPerPeriod * remainingPeriods);
    if (frequency === "yearly") {
      total = roundTwo((leaveType.daysPerYear / totalPeriods) * remainingPeriods);
    }
    if (frequency === "monthly") {
      const joinDay = doj.getDate();
      if (joinDay > 15) total = roundTwo(total - creditPerPeriod / 2);
    }

    return {
      updateOne: {
        filter: {
          organizationId,
          employeeId: employee._id,
          leaveTypeId: leaveType._id,
          cycleStartYear
        },
        update: {
          $setOnInsert: {
            total,
            used: 0,
            remaining: total,
            lastCreditedAt: periodStart
          }
        },
        upsert: true
      }
    };
  });

  await LeaveBalance.bulkWrite(bulkOps);
};


exports.getEmployeeBalance = async (organizationId, id, type = "USER") => {

  let employeeQuery = { organizationId };

  if (type === "EMPLOYEE") {
    // employeeId comes from URL → real ObjectId
    employeeQuery._id = id;
  } else {
    // userId comes from token → STRING is OK
    employeeQuery.userId = id;
  }

  const employee = await Employee.findOne(employeeQuery);

  if (!employee) {
    throw new Error("Employee not found");
  }

  const balances = await LeaveBalance.find({
    organizationId,
    employeeId: employee._id
  }).populate("leaveTypeId", "name code");

  return balances.map((b) => ({
    leaveTypeId: b.leaveTypeId._id,
    leaveType: b.leaveTypeId.name,
    code: b.leaveTypeId.code,
    total: b.total,
    used: b.used,
    remaining: b.remaining
  }));
};
