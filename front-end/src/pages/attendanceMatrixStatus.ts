export type AttendanceMatrixCellStatus =
  | "present"
  | "half_day_present"
  | "full_day_present"
  | "absent"
  | "pending_checkout";

export type AttendanceMatrixDisplayStatus =
  | "Holiday"
  | "Week Off"
  | "Leave"
  | "Future"
  | "Pending Checkout"
  | "Present"
  | "Half Day"
  | "Absent + Leave"
  | "Absent";

type AttendanceDisplayInput = {
  isHoliday: boolean;
  isWeekOff: boolean;
  isOnLeave?: boolean;
  leaveType: string | null;
  leaveDuration?: "full_day" | "half_day" | null;
  attendanceStatus: AttendanceMatrixCellStatus;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  isFuture?: boolean;
  snapshotGenerated?: boolean;
};

export const hasAttendanceActivity = (day: {
  attendanceStatus?: AttendanceMatrixCellStatus | null;
  checkInAt?: string | null;
  checkOutAt?: string | null;
}) =>
  Boolean(
    day.checkInAt
      || day.checkOutAt
      || day.attendanceStatus === "present"
      || day.attendanceStatus === "half_day_present"
      || day.attendanceStatus === "full_day_present"
      || day.attendanceStatus === "pending_checkout"
  );

export const isThresholdQualifiedAttendance = (status?: AttendanceMatrixCellStatus | null) =>
  status === "present" || status === "half_day_present" || status === "full_day_present";

export const getAttendanceDisplayStatus = ({
  isHoliday,
  isWeekOff,
  isOnLeave = false,
  leaveType,
  leaveDuration = null,
  attendanceStatus,
  checkInAt = null,
  checkOutAt = null,
  isFuture = false,
  snapshotGenerated = false
}: AttendanceDisplayInput): AttendanceMatrixDisplayStatus => {
  if (isHoliday) return "Holiday";
  if (isWeekOff) return "Week Off";
  if (isFuture) return "Future";

  if (attendanceStatus === "pending_checkout" && snapshotGenerated) return "Absent";
  if (attendanceStatus === "pending_checkout") return "Pending Checkout";

  if (isOnLeave && leaveDuration === "full_day" && leaveType) return "Leave";
  if (attendanceStatus === "full_day_present" || attendanceStatus === "present") return "Present";
  if (attendanceStatus === "half_day_present") return "Half Day";
  if (isOnLeave && leaveDuration === "half_day" && leaveType) return "Absent + Leave";
  if (leaveType && leaveDuration !== "half_day") return "Leave";
  return "Absent";
};
