import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { AttendanceDay } from '../types/attendance';

type UpcomingHoliday = {
  _id?: string;
  name?: string;
  date?: string;
};

type AttendanceTabProps = {
  matrixDays: Record<number, AttendanceDay>;
  daysInMonth: number;
  onRefresh: () => void;
  referenceDate: Date;
  dayNames: string[];
  formatTime: (value: string | Date) => string;
  employeeName: string;
  upcomingHolidays?: UpcomingHoliday[];
  holidaysLoading?: boolean;
};

const isPresentLikeStatus = (status?: string | null) =>
  status === 'present' ||
  status === 'half_day_present' ||
  status === 'full_day_present';

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

      {upcomingHolidays.length > 0 && (
        <View style={styles.holidayBanner}>
          <Text style={styles.holidayBannerText}>
            Upcoming holidays: {upcomingHolidays.map((h) => h.name || 'Holiday').join(', ')}
          </Text>
        </View>
      )}

    </View>
  );
};

const styles = StyleSheet.create({

  container: {
    marginTop: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
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
    backgroundColor: '#eef2ff',
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
  },

  emptyCell: {
    width: '13%',
    height: 48,
  },

  dayCell: {
    width: '13%',
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
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
  backgroundColor: '#fde68a', // light yellow for holidays
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
    backgroundColor: '#f1f5f9',
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
  holidayBanner: {
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    backgroundColor: '#eef2ff',
  },
  holidayBannerText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1d4ed8',
  },
});

export default AttendanceTab;
