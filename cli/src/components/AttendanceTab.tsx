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

  const [selectedDay, setSelectedDay] = useState<number | null>(null);

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

  const handleSelectDay = (day: number) => {
    setSelectedDay((prev) => (prev === day ? null : day));
  };

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Attendance</Text>

        <Pressable style={styles.refreshButton} onPress={onRefresh}>
          <MaterialCommunityIcons name="refresh" size={14} color="#000000" />
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      <Text style={styles.monthLabel}>{monthLabel}</Text>

      <View style={styles.calendarStage}>
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
                style={[
                  styles.dayCell,
                  getAttendanceStyle(day),
                  day === selectedDay && styles.dayCellSelected,
                ]}
                onPress={() => handleSelectDay(day)}
              >
                <Text
                  style={[styles.dayText, day === selectedDay && styles.dayTextSelected]}
                >
                  {day}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {selectedDay && (
          <View pointerEvents="box-none" style={styles.detailOverlay}>
            {(() => {
              const cell = matrixDays[selectedDay] || {};
              const status = cell.status ? cell.status.replace(/_/g, ' ') : 'No record';
              return (
                <View style={styles.detailCard}>
                  <View style={styles.detailHeader}>
                    <View style={styles.detailIntro}>
                      <Text style={styles.detailLabel}>Day {selectedDay}</Text>
                      <Text style={styles.detailTitle}>{employeeName}</Text>
                    </View>
                    <View style={styles.detailActions}>
                      <View style={styles.statusBadge}>
                        <Text style={styles.statusBadgeText}>{status}</Text>
                      </View>
                      <Pressable style={styles.detailClose} onPress={() => setSelectedDay(null)}>
                        <MaterialCommunityIcons name="close" size={16} color="#64748b" />
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.detailBody}>
                    {cell.checkInAt || cell.checkOutAt ? (
                      <View style={styles.detailMetrics}>
                        {cell.checkInAt ? (
                          <View style={styles.detailMetricCard}>
                            <MaterialCommunityIcons name="login-variant" size={16} color="#2563eb" />
                            <Text style={styles.detailMetricLabel}>Check-in</Text>
                            <Text style={styles.detailMetricValue}>{formatTime(cell.checkInAt)}</Text>
                          </View>
                        ) : null}
                        {cell.checkOutAt ? (
                          <View style={styles.detailMetricCard}>
                            <MaterialCommunityIcons name="logout-variant" size={16} color="#0f766e" />
                            <Text style={styles.detailMetricLabel}>Check-out</Text>
                            <Text style={styles.detailMetricValue}>{formatTime(cell.checkOutAt)}</Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}

                    {cell.leaveType && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailKey}>Leave Type</Text>
                        <Text style={styles.detailValue}>{cell.leaveType}</Text>
                      </View>
                    )}
                    {cell.holidayName && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailKey}>Holiday</Text>
                        <Text style={styles.detailValue}>{cell.holidayName}</Text>
                      </View>
                    )}
                    {!cell.checkInAt && !cell.checkOutAt && !cell.leaveType && !cell.holidayName ? (
                      <View style={styles.detailEmpty}>
                        <MaterialCommunityIcons name="calendar-blank-outline" size={16} color="#94a3b8" />
                        <Text style={styles.detailEmptyText}>No attendance details for this date</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })()}
          </View>
        )}
      </View>

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

  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },

  refreshText: {
    fontSize: 12,
    color: '#01040c',
    fontWeight: '600',
  },

  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    backgroundColor: '#ffffff',
  },
  calendarStage: {
    position: 'relative',
    marginTop: 2,
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
  dayCellSelected: {
    borderWidth: 2,
    borderColor: '#2563eb',
    backgroundColor: '#dbeafe',
  },
  dayTextSelected: {
    color: '#0f172a',
    fontWeight: '700',
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

  detailCard: {
    width: '88%',
    maxWidth: 320,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    padding: 14,
    shadowColor: '#0f172a',
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
    gap: 12,
  },
  detailOverlay: {
    position: 'absolute',
    top: 82,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  detailIntro: {
    flex: 1,
    minWidth: 0,
  },
  detailActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    fontSize: 11,
    color: '#2563eb',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    fontWeight: '700',
  },
  detailTitle: {
    marginTop: 2,
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 20,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    maxWidth: 120,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4338ca',
    textTransform: 'capitalize',
  },
  detailClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  detailBody: {
    gap: 10,
  },
  detailMetrics: {
    flexDirection: 'row',
    gap: 10,
  },
  detailMetricCard: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    gap: 4,
  },
  detailMetricLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  detailMetricValue: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '700',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  detailKey: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  detailEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  detailEmptyText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
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
