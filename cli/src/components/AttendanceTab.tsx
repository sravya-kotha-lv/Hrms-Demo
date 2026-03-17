import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { AttendanceDay } from '../types/attendance';

type AttendanceTabProps = {
  matrixDays: Record<number, AttendanceDay>;
  daysInMonth: number;
  onRefresh: () => void;
  referenceDate: Date;
  dayNames: string[];
  formatTime: (value: string | Date) => string;
  employeeName: string;
  upcomingHolidays?: any[];
  holidaysLoading?: boolean;
};

const isPresentLikeStatus = (status?: string | null) =>
  status === 'present' ||
  status === 'half_day_present' ||
  status === 'full_day_present';

const formatHolidayDate = (value?: string) => {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const AttendanceTab = ({
  matrixDays,
  daysInMonth,
  onRefresh,
  referenceDate,
  dayNames,
  formatTime,
  employeeName,
  upcomingHolidays = [],
  holidaysLoading = false,
}: AttendanceTabProps) => {

  const [showCellModal, setShowCellModal] = useState(false);
  const [selectedDayForModal, setSelectedDayForModal] = useState<number | null>(null);

  const monthDate = useMemo(
    () => new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1),
    [referenceDate]
  );

  const firstDayOffset = useMemo(() => monthDate.getDay(), [monthDate]);

  const monthCells = useMemo(() => {
    const cells: (number | null)[] = [];

    for (let idx = 0; idx < firstDayOffset + daysInMonth; idx++) {
      if (idx < firstDayOffset) {
        cells.push(null);
      } else {
        cells.push(idx - firstDayOffset + 1);
      }
    }

    while (cells.length % 7 !== 0) {
      cells.push(null);
    }

    return cells;
  }, [daysInMonth, firstDayOffset]);

  const monthLabel = useMemo(
    () =>
      monthDate.toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      }),
    [monthDate]
  );

  const getAttendanceStyle = (day: number) => {
    const cell = matrixDays[day];

    if (!cell) return styles.calendarNeutral;

    if (cell.isWeekOff) return styles.calendarWeekOff;

    if (cell.holidayName) return styles.calendarHoliday;

    if (cell.isOnLeave) return styles.calendarLeave;

    if (isPresentLikeStatus(cell.status)) return styles.calendarPresent;

    if (cell.status === 'absent') return styles.calendarAbsent;

    return styles.calendarNeutral;
  };

  const openCellModal = (day: number) => {
    setSelectedDayForModal(day);
    setShowCellModal(true);
  };

  const closeCellModal = () => setShowCellModal(false);

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Attendance</Text>

        <Pressable style={styles.refreshChip} onPress={onRefresh}>
          <MaterialCommunityIcons name="refresh" size={14} color="#2563eb" />
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      <Text style={styles.monthLabel}>{monthLabel}</Text>

      {/* Week names */}
      <View style={styles.weekRow}>
        {dayNames.map((day) => (
          <Text key={day} style={styles.weekText}>
            {day}
          </Text>
        ))}
      </View>

      {/* Calendar Grid */}
      <View style={styles.grid}>
        {monthCells.map((day, idx) => {

          if (!day) {
            return <View key={`empty-${idx}`} style={styles.emptyCell} />;
          }

          return (
            <Pressable
              key={`day-${day}`}
              style={[styles.dayCell, getAttendanceStyle(day)]}
              onPress={() => openCellModal(day)}
            >
              <Text style={styles.dayText}>{day}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Modal */}
      {showCellModal && selectedDayForModal && (
        <>
          <Pressable style={styles.modalBackdrop} onPress={closeCellModal} />

          <View style={styles.modal}>
            <View style={styles.modalContent}>

              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {employeeName} - Day {selectedDayForModal}
                </Text>

                <Pressable onPress={closeCellModal}>
                  <MaterialCommunityIcons name="close" size={20} color="#64748b" />
                </Pressable>
              </View>

              {(() => {

                const cell = matrixDays[selectedDayForModal] || {};

                return (
                  <View style={{ gap: 6 }}>
                    <Text>Status: {cell.status || 'No record'}</Text>

                    {cell.checkInAt && (
                      <Text>Check-in: {formatTime(cell.checkInAt)}</Text>
                    )}

                    {cell.checkOutAt && (
                      <Text>Check-out: {formatTime(cell.checkOutAt)}</Text>
                    )}

                    {cell.leaveType && (
                      <Text>Leave Type: {cell.leaveType}</Text>
                    )}

                    {cell.holidayName && (
                      <Text>Holiday: {cell.holidayName}</Text>
                    )}
                  </View>
                );
              })()}

            </View>
          </View>
        </>
      )}

      <View style={styles.holidaysSection}>
        <View style={styles.holidaysHeader}>
          <Text style={styles.holidaysTitle}>Holiday List</Text>
          <MaterialCommunityIcons name="calendar-star" size={16} color="#2563eb" />
        </View>

        {holidaysLoading ? (
          <Text style={styles.holidaysEmptyText}>Loading holidays...</Text>
        ) : upcomingHolidays.length === 0 ? (
          <Text style={styles.holidaysEmptyText}>No holidays found.</Text>
        ) : (
          upcomingHolidays.map((holiday: any) => (
            <View
              key={holiday?._id || `${holiday?.name || 'holiday'}-${holiday?.date || ''}`}
              style={styles.holidayRow}
            >
              <View style={styles.holidayBadge}>
                <MaterialCommunityIcons name="calendar-blank" size={14} color="#2563eb" />
              </View>
              <View style={styles.holidayInfo}>
                <Text style={styles.holidayName}>{holiday?.name || 'Holiday'}</Text>
                <Text style={styles.holidayMeta}>{formatHolidayDate(holiday?.date)}</Text>
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({

  container: {
    marginTop: 16,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },

  monthLabel: {
    marginTop: 4,
    color: '#64748b',
    fontSize: 13,
  },

  refreshChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: '#dbeafe',
  },

  refreshText: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '600',
  },

  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    backgroundColor: '#ffffff',
  },

  weekText: {
    width: '14%',
    textAlign: 'center',
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
  },

  emptyCell: {
    width: '13%',
    height: 48,
    backgroundColor: '#ffffff',
  },

  dayCell: {
    width: '13%',
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  dayText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },

  /* LIGHT COLORS */

  calendarPresent: {
    backgroundColor: '#9ee6b7',
  },
calendarHoliday: {
  backgroundColor: '#efd980', // light yellow for holidays
},
  calendarLeave: {
    backgroundColor: '#37e273',
  },

  calendarWeekOff: {
    backgroundColor: '#a2c3eb',
  },

  calendarAbsent: {
    backgroundColor: '#fee2e2',
  },

  calendarNeutral: {
    backgroundColor: '#ffffff',
  },

  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },

  modal: {
    position: 'absolute',
    top: '30%',
    left: 20,
    right: 20,
  },

  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  holidaysSection: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 14,
    gap: 10,
  },
  holidaysHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  holidaysTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  holidaysEmptyText: {
    fontSize: 12,
    color: '#64748b',
  },
  holidayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  holidayBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  holidayInfo: {
    flex: 1,
  },
  holidayName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  holidayMeta: {
    marginTop: 2,
    fontSize: 11,
    color: '#64748b',
  },
});

export default AttendanceTab;
