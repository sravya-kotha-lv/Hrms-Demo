const crypto = require("crypto");
const Employee = require("../employees/employee.model");
const Attendance = require("../timesheets/timesheetAttendance.model");
const Leave = require("../leaves/leave.model");
const LeaveType = require("../leaveTypes/leaveType.model");
const WeekOff = require("../weekOffs/weekOff.model");
const Holiday = require("../holidays/holiday.model");
const OrgSettings = require("../orgSettings/orgSettings.model");
const Organization = require("../organizations/organization.model");
const { getPayrollPgPool } = require("../../config/payrollDb");
const {
  parseMonthRangeInTimeZone,
  toDateKeyInTimeZone,
  addDaysToDateKey,
  getWeekdayForDateKey
} = require("../../utils/timezone");

const DEFAULT_UNPAID_LEAVE_CODES = new Set(["LOP", "LWP", "LWOP", "ULOP", "UNPAID"]);

const toSafeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getOrganizationTimeZone = async (organizationId) => {
  const settings = await OrgSettings.findOne({ organizationId }).select("timezone").lean();
  if (settings?.timezone) return settings.timezone;

  const organization = await Organization.findById(organizationId).select("timezone").lean();
  if (organization?.timezone) return organization.timezone;

  return process.env.PAYROLL_DEFAULT_TIMEZONE || "Asia/Kolkata";
};

const buildDateKeys = (startKey, endKey) => {
  const keys = [];
  let current = startKey;
  while (current <= endKey) {
    keys.push(current);
    current = addDaysToDateKey(current, 1);
  }
  return keys;
};

const buildAttendanceMap = (rows, timeZone) => {
  const map = new Map();
  for (const row of rows) {
    const employeeId = String(row.employeeId);
    const dayKey = toDateKeyInTimeZone(row.date, timeZone);
    map.set(`${employeeId}:${dayKey}`, row);
  }
  return map;
};

const buildHolidayMap = (rows, timeZone) => {
  const map = new Map();
  for (const row of rows) {
    const dayKey = toDateKeyInTimeZone(row.date, timeZone);
    map.set(dayKey, row);
  }
  return map;
};

const buildLeaveIndex = (rows, leaveTypeCodeById, unpaidCodes, timeZone, startKey, endKey) => {
  const map = new Map();

  for (const leave of rows) {
    const leaveTypeCode = String(leaveTypeCodeById.get(String(leave.leaveTypeId)) || "").toUpperCase();
    const isUnpaid = unpaidCodes.has(leaveTypeCode);
    const unit = leave.duration === "half_day" ? 0.5 : 1;
    const isPaid = !isUnpaid;

    let cursor = toDateKeyInTimeZone(leave.fromDate, timeZone);
    const end = toDateKeyInTimeZone(leave.toDate, timeZone);

    while (cursor <= end) {
      if (cursor >= startKey && cursor <= endKey) {
        map.set(`${String(leave.employeeId)}:${cursor}`, {
          leaveId: String(leave._id),
          isPaid,
          units: unit,
          leaveTypeCode
        });
      }
      cursor = addDaysToDateKey(cursor, 1);
    }
  }

  return map;
};

const buildWeekOffResolver = (rows) => {
  const byShift = new Map();
  let fallbackWeekOffs = [];

  for (const row of rows) {
    const days = Array.isArray(row.weekOffDays) ? row.weekOffDays : [];
    const key = row.shiftId ? String(row.shiftId) : "default";
    if (key === "default") {
      fallbackWeekOffs = days;
    }
    byShift.set(key, days);
  }

  return (employeeShiftId) => {
    if (!employeeShiftId) return fallbackWeekOffs;
    return byShift.get(String(employeeShiftId)) || fallbackWeekOffs;
  };
};

const getTenantIdByOrganization = async (client, organizationId) => {
  const result = await client.query(
    `SELECT id FROM payroll_tenants WHERE organization_id = $1`,
    [String(organizationId)]
  );
  return result.rows[0]?.id || null;
};

const getProfileMap = async (client, tenantId, employeeIds) => {
  if (!employeeIds.length) return new Map();
  const result = await client.query(
    `
      SELECT id, employee_external_id
      FROM employee_payroll_profiles
      WHERE tenant_id = $1
        AND employee_external_id = ANY($2::varchar[])
    `,
    [tenantId, employeeIds]
  );
  return new Map(result.rows.map((row) => [row.employee_external_id, row.id]));
};

const upsertSnapshot = async (client, payload) => {
  const query = `
    INSERT INTO payroll_attendance_snapshots (
      tenant_id,
      pay_month,
      organization_external_id,
      employee_external_id,
      employee_payroll_profile_id,
      timezone,
      calendar_days,
      working_days,
      present_days,
      half_days,
      absent_days,
      paid_leave_days,
      unpaid_leave_days,
      week_off_days,
      holiday_days,
      lop_days,
      payable_days,
      overtime_minutes,
      late_by_minutes,
      early_checkout_minutes,
      attendance_minutes,
      min_work_minutes,
      min_half_day_minutes,
      source_hash,
      generation_status,
      generated_at,
      metadata,
      created_by,
      updated_by
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,NOW(),$26,$27,$27
    )
    ON CONFLICT (tenant_id, pay_month, employee_external_id)
    DO UPDATE SET
      employee_payroll_profile_id = EXCLUDED.employee_payroll_profile_id,
      timezone = EXCLUDED.timezone,
      calendar_days = EXCLUDED.calendar_days,
      working_days = EXCLUDED.working_days,
      present_days = EXCLUDED.present_days,
      half_days = EXCLUDED.half_days,
      absent_days = EXCLUDED.absent_days,
      paid_leave_days = EXCLUDED.paid_leave_days,
      unpaid_leave_days = EXCLUDED.unpaid_leave_days,
      week_off_days = EXCLUDED.week_off_days,
      holiday_days = EXCLUDED.holiday_days,
      lop_days = EXCLUDED.lop_days,
      payable_days = EXCLUDED.payable_days,
      overtime_minutes = EXCLUDED.overtime_minutes,
      late_by_minutes = EXCLUDED.late_by_minutes,
      early_checkout_minutes = EXCLUDED.early_checkout_minutes,
      attendance_minutes = EXCLUDED.attendance_minutes,
      min_work_minutes = EXCLUDED.min_work_minutes,
      min_half_day_minutes = EXCLUDED.min_half_day_minutes,
      source_hash = EXCLUDED.source_hash,
      generation_status = EXCLUDED.generation_status,
      generated_at = NOW(),
      metadata = EXCLUDED.metadata,
      updated_by = EXCLUDED.updated_by
    RETURNING id
  `;

  const values = [
    payload.tenantId,
    payload.month,
    payload.organizationExternalId,
    payload.employeeExternalId,
    payload.employeePayrollProfileId || null,
    payload.timezone,
    payload.calendarDays,
    payload.workingDays,
    payload.presentDays,
    payload.halfDays,
    payload.absentDays,
    payload.paidLeaveDays,
    payload.unpaidLeaveDays,
    payload.weekOffDays,
    payload.holidayDays,
    payload.lopDays,
    payload.payableDays,
    payload.overtimeMinutes,
    payload.lateByMinutes,
    payload.earlyCheckoutMinutes,
    payload.attendanceMinutes,
    payload.minWorkMinutes,
    payload.minHalfDayMinutes,
    payload.sourceHash,
    payload.generationStatus,
    JSON.stringify(payload.metadata || {}),
    payload.actorId
  ];

  const result = await client.query(query, values);
  return result.rows[0].id;
};

const insertSnapshotDays = async (client, snapshotId, dayRows, actorId) => {
  if (!dayRows.length) return;

  const columns = [
    "snapshot_id",
    "tenant_id",
    "employee_external_id",
    "day_date",
    "day_key",
    "day_of_week",
    "day_status",
    "payable_units",
    "lop_units",
    "attendance_minutes",
    "overtime_minutes",
    "late_by_minutes",
    "early_checkout_minutes",
    "attendance_id",
    "leave_id",
    "holiday_id",
    "week_off_applied",
    "is_holiday",
    "is_leave",
    "metadata",
    "created_by",
    "updated_by"
  ];

  const values = [];
  const placeholders = [];
  let p = 1;

  for (const row of dayRows) {
    placeholders.push(
      `($${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++})`
    );
    values.push(
      snapshotId,
      row.tenantId,
      row.employeeExternalId,
      row.dayDate,
      row.dayKey,
      row.dayOfWeek,
      row.dayStatus,
      row.payableUnits,
      row.lopUnits,
      row.attendanceMinutes,
      row.overtimeMinutes,
      row.lateByMinutes,
      row.earlyCheckoutMinutes,
      row.attendanceId,
      row.leaveId,
      row.holidayId,
      row.weekOffApplied,
      row.isHoliday,
      row.isLeave,
      JSON.stringify(row.metadata || {}),
      actorId,
      actorId
    );
  }

  await client.query(
    `INSERT INTO payroll_attendance_snapshot_days (${columns.join(",")}) VALUES ${placeholders.join(",")}`,
    values
  );
};

exports.generateMonthlyAttendanceSnapshots = async (req) => {
  const organizationId = String(req.user.organizationId);
  const actorId = String(req.user.userId);
  const {
    month,
    employeeIds = [],
    forceRebuild = false,
    includeInactiveEmployees = false,
    unpaidLeaveTypeCodes = []
  } = req.body;

  const pool = await getPayrollPgPool();
  if (!pool) {
    throw { code: 400, message: "Payroll Postgres is not enabled" };
  }

  const unpaidCodes = new Set(
    (unpaidLeaveTypeCodes.length ? unpaidLeaveTypeCodes : [...DEFAULT_UNPAID_LEAVE_CODES]).map(
      (item) => String(item || "").toUpperCase()
    )
  );

  const timeZone = await getOrganizationTimeZone(organizationId);
  const monthRange = parseMonthRangeInTimeZone(month, timeZone);
  const dateKeys = buildDateKeys(monthRange.startKey, monthRange.endKey);

  const employeeQuery = {
    organizationId,
    ...(includeInactiveEmployees ? {} : { status: { $in: ["active", "on_leave"] } })
  };
  if (employeeIds.length) {
    employeeQuery._id = { $in: employeeIds };
  }

  const employees = await Employee.find(employeeQuery)
    .select("_id employeeCode shiftId status")
    .lean();

  if (!employees.length) {
    return {
      month,
      timezone: timeZone,
      generatedCount: 0,
      skippedCount: 0,
      message: "No employees found for snapshot generation"
    };
  }

  const employeeIdList = employees.map((employee) => employee._id);
  const employeeIdStrings = employees.map((employee) => String(employee._id));

  const [attendanceRows, leaveRows, leaveTypes, holidayRows, weekOffRows, orgSettings] =
    await Promise.all([
      Attendance.find({
        organizationId,
        employeeId: { $in: employeeIdList },
        date: { $gte: monthRange.start, $lte: monthRange.end }
      })
        .select(
          "_id employeeId date totalMinutes overtimeMinutes lateByMinutes earlyCheckoutByMinutes"
        )
        .lean(),
      Leave.find({
        organizationId,
        employeeId: { $in: employeeIdList },
        status: "approved",
        fromDate: { $lte: monthRange.end },
        toDate: { $gte: monthRange.start }
      })
        .select("_id employeeId leaveTypeId fromDate toDate duration")
        .lean(),
      LeaveType.find({ organizationId }).select("_id code").lean(),
      Holiday.find({
        organizationId,
        status: "active",
        date: { $gte: monthRange.start, $lte: monthRange.end }
      })
        .select("_id date")
        .lean(),
      WeekOff.find({ organizationId }).select("_id shiftId weekOffDays").lean(),
      OrgSettings.findOne({ organizationId })
        .select("minWorkHoursPerDay minHalfDayHours")
        .lean()
    ]);

  const minWorkMinutes = Math.max(0, Math.round(toSafeNumber(orgSettings?.minWorkHoursPerDay, 8) * 60));
  const minHalfDayMinutes = Math.max(
    0,
    Math.round(toSafeNumber(orgSettings?.minHalfDayHours, 4) * 60)
  );

  const leaveTypeCodeById = new Map(
    leaveTypes.map((item) => [String(item._id), String(item.code || "").toUpperCase()])
  );
  const attendanceMap = buildAttendanceMap(attendanceRows, timeZone);
  const leaveMap = buildLeaveIndex(
    leaveRows,
    leaveTypeCodeById,
    unpaidCodes,
    timeZone,
    monthRange.startKey,
    monthRange.endKey
  );
  const holidayMap = buildHolidayMap(holidayRows, timeZone);
  const resolveWeekOffDays = buildWeekOffResolver(weekOffRows);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const tenantId = await getTenantIdByOrganization(client, organizationId);
    if (!tenantId) {
      throw {
        code: 400,
        message:
          "Payroll tenant not found for this organization. Create payroll_tenants row before generating snapshots."
      };
    }

    if (forceRebuild && employeeIdStrings.length) {
      await client.query(
        `
          DELETE FROM payroll_attendance_snapshots
          WHERE tenant_id = $1
            AND pay_month = $2
            AND employee_external_id = ANY($3::varchar[])
        `,
        [tenantId, month, employeeIdStrings]
      );
    }

    const profileMap = await getProfileMap(client, tenantId, employeeIdStrings);

    let generatedCount = 0;
    for (const employee of employees) {
      const employeeExternalId = String(employee._id);
      const weekOffDays = resolveWeekOffDays(employee.shiftId ? String(employee.shiftId) : null);

      const totals = {
        calendarDays: monthRange.daysInMonth,
        workingDays: 0,
        presentDays: 0,
        halfDays: 0,
        absentDays: 0,
        paidLeaveDays: 0,
        unpaidLeaveDays: 0,
        weekOffDays: 0,
        holidayDays: 0,
        lopDays: 0,
        payableDays: 0,
        overtimeMinutes: 0,
        lateByMinutes: 0,
        earlyCheckoutMinutes: 0,
        attendanceMinutes: 0
      };

      const dayRows = [];

      for (const dayKey of dateKeys) {
        const weekday = getWeekdayForDateKey(dayKey, timeZone);
        const attendance = attendanceMap.get(`${employeeExternalId}:${dayKey}`);
        const leave = leaveMap.get(`${employeeExternalId}:${dayKey}`);
        const holiday = holidayMap.get(dayKey);
        const isHoliday = Boolean(holiday);
        const isWeekOff = weekOffDays.includes(weekday);
        const isWorkingDay = !isHoliday && !isWeekOff;

        if (isWorkingDay) totals.workingDays += 1;

        let dayStatus = "absent";
        let payableUnits = 0;
        let lopUnits = 0;

        const attendanceMinutes = toSafeNumber(attendance?.totalMinutes, 0);
        const overtimeMinutes = toSafeNumber(attendance?.overtimeMinutes, 0);
        const lateByMinutes = toSafeNumber(attendance?.lateByMinutes, 0);
        const earlyCheckoutMinutes = toSafeNumber(attendance?.earlyCheckoutByMinutes, 0);

        totals.attendanceMinutes += attendanceMinutes;
        totals.overtimeMinutes += overtimeMinutes;
        totals.lateByMinutes += lateByMinutes;
        totals.earlyCheckoutMinutes += earlyCheckoutMinutes;

        if (attendance) {
          if (isHoliday) {
            dayStatus = "holiday_worked";
            payableUnits = 1;
            totals.presentDays += 1;
          } else if (isWeekOff) {
            dayStatus = "week_off_worked";
            payableUnits = 1;
            totals.presentDays += 1;
          } else if (attendanceMinutes >= minWorkMinutes) {
            dayStatus = "present";
            payableUnits = 1;
            totals.presentDays += 1;
          } else if (attendanceMinutes >= minHalfDayMinutes) {
            dayStatus = "half_day";
            payableUnits = 0.5;
            lopUnits = 0.5;
            totals.halfDays += 0.5;
            totals.lopDays += 0.5;
          } else {
            dayStatus = "absent";
            lopUnits = 1;
            totals.absentDays += 1;
            totals.lopDays += 1;
          }
        } else if (leave) {
          const leaveUnits = leave.units === 0.5 ? 0.5 : 1;
          if (leave.isPaid) {
            dayStatus = leaveUnits === 0.5 ? "paid_leave_half" : "paid_leave";
            payableUnits = leaveUnits;
            totals.paidLeaveDays += leaveUnits;
            if (leaveUnits === 0.5 && isWorkingDay) {
              lopUnits = 0.5;
              totals.lopDays += 0.5;
            }
          } else {
            dayStatus = leaveUnits === 0.5 ? "unpaid_leave_half" : "unpaid_leave";
            lopUnits = leaveUnits;
            totals.unpaidLeaveDays += leaveUnits;
            totals.lopDays += leaveUnits;
          }
        } else if (isHoliday) {
          dayStatus = "holiday";
          payableUnits = 1;
          totals.holidayDays += 1;
        } else if (isWeekOff) {
          dayStatus = "week_off";
          payableUnits = 1;
          totals.weekOffDays += 1;
        } else {
          dayStatus = "absent";
          lopUnits = 1;
          totals.absentDays += 1;
          totals.lopDays += 1;
        }

        totals.payableDays += payableUnits;

        dayRows.push({
          tenantId,
          employeeExternalId,
          dayDate: dayKey,
          dayKey,
          dayOfWeek: weekday,
          dayStatus,
          payableUnits,
          lopUnits,
          attendanceMinutes,
          overtimeMinutes,
          lateByMinutes,
          earlyCheckoutMinutes,
          attendanceId: attendance ? String(attendance._id) : null,
          leaveId: leave ? String(leave.leaveId) : null,
          holidayId: holiday ? String(holiday._id) : null,
          weekOffApplied: isWeekOff,
          isHoliday,
          isLeave: Boolean(leave),
          metadata: {
            leaveTypeCode: leave?.leaveTypeCode || null
          }
        });
      }

      const sourceHash = crypto
        .createHash("sha256")
        .update(
          JSON.stringify({
            employeeExternalId,
            month,
            totals
          })
        )
        .digest("hex");

      const snapshotId = await upsertSnapshot(client, {
        tenantId,
        month,
        organizationExternalId: organizationId,
        employeeExternalId,
        employeePayrollProfileId: profileMap.get(employeeExternalId) || null,
        timezone: timeZone,
        calendarDays: totals.calendarDays,
        workingDays: totals.workingDays,
        presentDays: Number(totals.presentDays.toFixed(2)),
        halfDays: Number(totals.halfDays.toFixed(2)),
        absentDays: Number(totals.absentDays.toFixed(2)),
        paidLeaveDays: Number(totals.paidLeaveDays.toFixed(2)),
        unpaidLeaveDays: Number(totals.unpaidLeaveDays.toFixed(2)),
        weekOffDays: Number(totals.weekOffDays.toFixed(2)),
        holidayDays: Number(totals.holidayDays.toFixed(2)),
        lopDays: Number(totals.lopDays.toFixed(2)),
        payableDays: Number(totals.payableDays.toFixed(2)),
        overtimeMinutes: Math.round(totals.overtimeMinutes),
        lateByMinutes: Math.round(totals.lateByMinutes),
        earlyCheckoutMinutes: Math.round(totals.earlyCheckoutMinutes),
        attendanceMinutes: Math.round(totals.attendanceMinutes),
        minWorkMinutes,
        minHalfDayMinutes,
        sourceHash,
        generationStatus: forceRebuild ? "recomputed" : "generated",
        metadata: {
          unpaidLeaveTypeCodes: [...unpaidCodes]
        },
        actorId
      });

      await client.query(`DELETE FROM payroll_attendance_snapshot_days WHERE snapshot_id = $1`, [
        snapshotId
      ]);
      await insertSnapshotDays(client, snapshotId, dayRows, actorId);
      generatedCount += 1;
    }

    await client.query("COMMIT");
    return {
      month,
      timezone: timeZone,
      totalEmployees: employees.length,
      generatedCount
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

exports.listMonthlyAttendanceSnapshots = async (req) => {
  const organizationId = String(req.user.organizationId);
  const { month, employeeId } = req.query;
  const pool = await getPayrollPgPool();

  if (!pool) {
    throw { code: 400, message: "Payroll Postgres is not enabled" };
  }

  const client = await pool.connect();
  try {
    const tenantId = await getTenantIdByOrganization(client, organizationId);
    if (!tenantId) {
      throw {
        code: 400,
        message:
          "Payroll tenant not found for this organization. Create payroll_tenants row before fetching snapshots."
      };
    }

    const values = [tenantId, month];
    let filterClause = "";
    if (employeeId) {
      values.push(employeeId);
      filterClause = ` AND s.employee_external_id = $3 `;
    }

    const snapshots = await client.query(
      `
        SELECT
          s.id,
          s.pay_month,
          s.employee_external_id,
          s.calendar_days,
          s.working_days,
          s.present_days,
          s.half_days,
          s.absent_days,
          s.paid_leave_days,
          s.unpaid_leave_days,
          s.week_off_days,
          s.holiday_days,
          s.lop_days,
          s.payable_days,
          s.overtime_minutes,
          s.late_by_minutes,
          s.early_checkout_minutes,
          s.attendance_minutes,
          s.generation_status,
          s.generated_at
        FROM payroll_attendance_snapshots s
        WHERE s.tenant_id = $1
          AND s.pay_month = $2
          ${filterClause}
        ORDER BY s.employee_external_id ASC
      `,
      values
    );

    return {
      month,
      count: snapshots.rows.length,
      snapshots: snapshots.rows
    };
  } finally {
    client.release();
  }
};

exports.__test__ = {
  toSafeNumber,
  buildDateKeys,
  buildAttendanceMap,
  buildHolidayMap,
  buildLeaveIndex,
  buildWeekOffResolver
};
