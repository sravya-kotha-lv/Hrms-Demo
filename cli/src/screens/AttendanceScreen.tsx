import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AttendanceTab from '../components/AttendanceTab';
import { AttendanceDay } from '../types/attendance';
import { getApiWithToken } from '../services/api';
import { useAuth } from '../context/AuthContext';

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const formatTime = (value: string | Date) =>
  new Date(value).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

const getMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

const getMonthLabel = (date: Date) =>
  date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

function AttendanceScreen() {
  const { session } = useAuth();
  const token = session?.token || '';
  const profile = session?.profile || session?.loginData || null;
  const profileImage = profile?.profileImage || profile?.profilePhoto || null;
  const insets = useSafeAreaInsets();

  const [referenceDate, setReferenceDate] = useState(() => new Date());
  const [matrixDays, setMatrixDays] = useState<Record<number, AttendanceDay>>({});
  const [daysInMonth, setDaysInMonth] = useState(31);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [holidayList, setHolidayList] = useState<any[]>([]);
  const [holidaysLoading, setHolidaysLoading] = useState(false);

  const employeeName = useMemo(() => {
    const firstName = profile?.firstName || '';
    const lastName = profile?.lastName || '';
    return [firstName, lastName].filter(Boolean).join(' ') || profile?.email || 'Employee';
  }, [profile]);

  const loadAttendance = useCallback(
    async (date: Date, silent = false) => {
      if (!token) return;
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
        setErrorMessage('');
      }
      try {
        const monthKey = getMonthKey(date);
        const response = await getApiWithToken<{
          employees?: Array<{ days?: Record<number, AttendanceDay> }>;
          daysInMonth?: number;
        }>(`/timesheets/attendance/matrix/my?month=${monthKey}`, token);

        if (response?.success) {
          const row = response.data?.employees?.[0];
          setMatrixDays(row?.days || {});
          setDaysInMonth(Number(response.data?.daysInMonth || getDaysInMonth(date)));
          setErrorMessage('');
        } else {
          setMatrixDays({});
          setDaysInMonth(getDaysInMonth(date));
          setErrorMessage(response?.message || 'Unable to load attendance calendar.');
        }
      } catch {
        setMatrixDays({});
        setDaysInMonth(getDaysInMonth(date));
        setErrorMessage('Unable to reach the server.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token]
  );

  const loadHolidays = useCallback(async () => {
    if (!token) return;
    setHolidaysLoading(true);
    try {
      const year = referenceDate.getFullYear();
      const response = await getApiWithToken<any>(`/holidays?year=${year}`, token);
      if (response?.success) {
        const allHolidays = (response.data || [])
          .filter((holiday: any) => {
            if (!holiday?.date) return false;
            const holidayDate = new Date(holiday.date);
            return !Number.isNaN(holidayDate.getTime());
          })
          .sort((a: any, b: any) => {
            const aTime = new Date(a.date).getTime() || 0;
            const bTime = new Date(b.date).getTime() || 0;
            return aTime - bTime;
          });
        setHolidayList(allHolidays);
      } else {
        setHolidayList([]);
      }
    } catch {
      setHolidayList([]);
    } finally {
      setHolidaysLoading(false);
    }
  }, [referenceDate, token]);

  useEffect(() => {
    if (!token) return;
    loadAttendance(referenceDate);
  }, [referenceDate, loadAttendance, token]);
  useEffect(() => {
    if (!token) return;
    loadHolidays();
  }, [loadHolidays, token]);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      loadAttendance(referenceDate);
      loadHolidays();
    }, [token, referenceDate, loadAttendance, loadHolidays])
  );

  const handleRefresh = () => {
    loadAttendance(referenceDate, true);
    loadHolidays();
  };

  const changeMonth = (offset: number) => {
    setReferenceDate((prev) => {
      const next = new Date(prev.getFullYear(), prev.getMonth() + offset, 1);
      return next;
    });
  };

  const monthLabel = useMemo(() => getMonthLabel(referenceDate), [referenceDate]);

  return (
    <LinearGradient
      colors={['#f4f6fb', '#eef2ff']}
      style={[styles.root, { paddingTop: insets.top }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <View style={styles.headerTopRow}>
            <View style={styles.headerTextBlock}>
              <Text style={styles.headerLabel}>My Attendance Calendar</Text>
              <Text style={styles.headerName}>{employeeName}</Text>
            </View>
            <View style={styles.headerAvatarShell}>
              {profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.headerAvatarImage} />
              ) : (
                <View style={styles.headerAvatarFallback}>
                  <Text style={styles.headerAvatarFallbackText}>
                    {String(employeeName || 'E')
                      .split(' ')
                      .filter(Boolean)
                      .slice(0, 2)
                      .map(part => part[0])
                      .join('')
                      .toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.monthControls}>
            <Pressable style={styles.navButton} onPress={() => changeMonth(-1)}>
              <MaterialCommunityIcons name="chevron-left" size={20} color="#1f2937" />
            </Pressable>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <Pressable style={styles.navButton} onPress={() => changeMonth(1)}>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#1f2937" />
            </Pressable>
          </View>
        </View>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        {loading ? (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator size="large" color="#1d4ed8" />
          </View>
        ) : (
          <AttendanceTab
            matrixDays={matrixDays}
            daysInMonth={daysInMonth}
            onRefresh={handleRefresh}
            referenceDate={referenceDate}
            dayNames={dayNames}
            formatTime={formatTime}
            employeeName={employeeName}
            upcomingHolidays={holidayList}
            holidaysLoading={holidaysLoading}
          />
        )}

        {refreshing && !loading && (
          <View style={styles.refreshingRow}>
            <ActivityIndicator size="small" color="#1d4ed8" />
            <Text style={styles.refreshingText}>Refreshing calendar…</Text>
          </View>
        )}

        <View style={styles.spacer} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  headerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  headerLabel: {
    fontSize: 12,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  headerName: {
    marginTop: 6,
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerAvatarShell: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#dbeafe',
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarImage: {
    width: '100%',
    height: '100%',
  },
  headerAvatarFallback: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dbeafe',
  },
  headerAvatarFallbackText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2563eb',
  },
  monthControls: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  loadingWrapper: {
    marginTop: 32,
    alignItems: 'center',
  },
  refreshingRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshingText: {
    fontSize: 11,
    color: '#475569',
  },
  errorText: {
    marginTop: 12,
    fontSize: 12,
    color: '#b91c1c',
  },
  spacer: {
    height: 24,
  },
});

export default AttendanceScreen;
