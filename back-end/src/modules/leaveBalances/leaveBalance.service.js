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
 * Round value to nearest 0.5
 */
const roundHalf = (value) => Math.round(value * 2) / 2;
const getCycleStartDate = (date, startMonth) => {
  const d = new Date(date);
  const year = d.getMonth() + 1 < startMonth ? d.getFullYear() - 1 : d.getFullYear();
  return new Date(year, startMonth - 1, 1);
};

const monthsBetween = (from, to) =>
  (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());

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
  const { periodStart, periodsPerYear } = getPeriodInfo(
    new Date(),
    frequency,
    org.leaveCycleStartMonth
  );

  // 2️⃣ determine leave cycle year
  const doj = new Date(employee.dateOfJoining);
  const cycleStartYear = getCycleStartYear(
    doj,
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
    const creditPerPeriod = roundHalf(lt.daysPerYear / periodsPerYear);
    let total = creditPerPeriod;
    if (frequency === "monthly") {
      const joinDay = doj.getDate();
      if (joinDay > 15) total = roundHalf(creditPerPeriod / 2);
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


const mongoose = require("mongoose");

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
