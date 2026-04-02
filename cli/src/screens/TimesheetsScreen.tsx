import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { getApiWithToken, postApiWithToken, putApiWithToken } from '../services/api';
import { useAuth } from '../context/AuthContext';

type Entry = { date: string; hours: number; notes?: string };

const toDateInput = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getWeekStart = (value: Date) => {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
};

const buildWeekDates = (weekStart: Date) => {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
};

const formatHeaderRange = (weekDates: Date[]) => {
  if (!weekDates.length) return '';
  const first = weekDates[0];
  const last = weekDates[weekDates.length - 1];
  return `${first.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${last.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
};

const formatDayLabel = (value: string) => {
  const date = new Date(value);
  return {
    weekday: date.toLocaleDateString(undefined, { weekday: 'short' }),
    day: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
  };
};

function TimesheetsScreen() {
  const { session } = useAuth();
  const token = session?.token || '';
  const safeAreaInsets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date()));
  const [timesheetId, setTimesheetId] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);

  const weekStartKey = useMemo(() => toDateInput(weekStart), [weekStart]);
  const weekDates = useMemo(() => buildWeekDates(weekStart), [weekStart]);
  const weekRangeLabel = useMemo(() => formatHeaderRange(weekDates), [weekDates]);
  const totalHours = useMemo(
    () => entries.reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0),
    [entries]
  );

  const loadTimesheet = async () => {
    setLoading(true);
    const res = await getApiWithToken<any>(`/timesheets/weekly/my?weekStart=${weekStartKey}`, token);
    setLoading(false);
    if (!res?.success) {
      setError(res?.message || 'Unable to load timesheet.');
      setEntries(
        weekDates.map((d) => ({ date: toDateInput(d), hours: 0, notes: '' }))
      );
      return;
    }
    const data = res?.data;
    if (data?._id) {
      setTimesheetId(data._id);
      const mapped = weekDates.map((d) => {
        const key = toDateInput(d);
        const existing = (data.entries || []).find((e: any) => toDateInput(new Date(e.date)) === key);
        return {
          date: key,
          hours: Number(existing?.hours || 0),
          notes: existing?.notes || '',
        };
      });
      setEntries(mapped);
    } else {
      setTimesheetId(null);
      setEntries(
        weekDates.map((d) => ({ date: toDateInput(d), hours: 0, notes: '' }))
      );
    }
  };

  useEffect(() => {
    if (token) loadTimesheet();
  }, [token, weekStartKey]);

  const updateEntry = (index: number, patch: Partial<Entry>) => {
    setEntries((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  };

  const saveTimesheet = async (submit: boolean) => {
    setSaving(true);
    setError('');
    const payload = {
      weekStart: weekStartKey,
      entries: entries.map((e) => ({ ...e, hours: Number(e.hours) || 0 })),
    };
    let res: any;
    if (timesheetId) {
      res = submit
        ? await postApiWithToken<any>(`/timesheets/weekly/${timesheetId}/submit`, payload, token)
        : await putApiWithToken<any>(`/timesheets/weekly/${timesheetId}`, payload, token);
    } else {
      const createRes = await postApiWithToken<any>('/timesheets/weekly', payload, token);
      if (!createRes?.success) {
        setSaving(false);
        setError(createRes?.message || 'Unable to create timesheet.');
        return;
      }
      const newId = createRes?.data?._id;
      setTimesheetId(newId || null);
      res = submit
        ? await postApiWithToken<any>(`/timesheets/weekly/${newId}/submit`, payload, token)
        : createRes;
    }
    setSaving(false);
    if (!res?.success) {
      setError(res?.message || 'Unable to save timesheet.');
      return;
    }
    loadTimesheet();
  };

  const shiftWeek = (offset: number) => {
    setWeekStart(prev => {
      const next = new Date(prev);
      next.setDate(next.getDate() + offset * 7);
      return getWeekStart(next);
    });
  };

  return (
    <LinearGradient
      colors={['#f3f5f9', '#f3f5f9', '#eef1f6']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(safeAreaInsets.top, 16) },
        ]}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroTitleWrap}>
              <Text style={styles.heroEyebrow}>Weekly Timesheet</Text>
              <Text style={styles.heroTitle}>Log your week cleanly</Text>
              <Text style={styles.heroSubtitle}>{weekRangeLabel}</Text>
            </View>
            <View style={styles.heroIconBadge}>
              <MaterialCommunityIcons name="clipboard-text-clock-outline" size={20} color="#2563eb" />
            </View>
          </View>

          <View style={styles.weekNavigator}>
            <Pressable style={styles.weekNavButton} onPress={() => shiftWeek(-1)}>
              <MaterialCommunityIcons name="chevron-left" size={18} color="#334155" />
            </Pressable>
            <View style={styles.weekNavigatorCenter}>
              <Text style={styles.weekNavigatorLabel}>Week Starting</Text>
              <Text style={styles.weekNavigatorValue}>{weekStartKey}</Text>
            </View>
            <Pressable style={styles.weekNavButton} onPress={() => shiftWeek(1)}>
              <MaterialCommunityIcons name="chevron-right" size={18} color="#334155" />
            </Pressable>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total Hours</Text>
              <Text style={styles.summaryValue}>{totalHours.toFixed(1)}h</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Status</Text>
              <Text style={styles.summaryValue}>{timesheetId ? 'Draft Ready' : 'New Week'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <Text style={styles.sectionTitle}>Daily Entries</Text>
          <Text style={styles.helperText}>Fill hours and a short work summary for each day.</Text>

          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator color="#2563eb" />
            </View>
          ) : (
            entries.map((entry, idx) => (
              <View key={entry.date} style={styles.entryRow}>
                <View style={styles.entryHeader}>
                  <View>
                    <Text style={styles.entryWeekday}>{formatDayLabel(entry.date).weekday}</Text>
                    <Text style={styles.entryDate}>{formatDayLabel(entry.date).day}</Text>
                  </View>
                  <View style={styles.hoursShell}>
                    <Text style={styles.hoursLabel}>Hours</Text>
                    <TextInput
                      style={styles.hoursInput}
                      keyboardType="decimal-pad"
                      value={String(entry.hours)}
                      onChangeText={(value) => updateEntry(idx, { hours: Number(value) || 0 })}
                    />
                  </View>
                </View>
                <TextInput
                  style={styles.notesInput}
                  placeholder="What did you work on today?"
                  placeholderTextColor="#94a3b8"
                  value={entry.notes || ''}
                  onChangeText={(value) => updateEntry(idx, { notes: value })}
                />
              </View>
            ))
          )}

          <View style={styles.actionRow}>
            <Pressable style={styles.secondaryButton} onPress={() => saveTimesheet(false)} disabled={saving}>
              {saving ? <ActivityIndicator /> : <Text style={styles.secondaryText}>Save Draft</Text>}
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={() => saveTimesheet(true)} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Submit</Text>}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 120, gap: 14 },
  heroCard: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe7ff',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroTitleWrap: {
    flex: 1,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#94a3b8',
  },
  heroTitle: {
    marginTop: 6,
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
  },
  heroSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748b',
  },
  heroIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekNavigator: {
    marginTop: 18,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  weekNavButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekNavigatorCenter: {
    flex: 1,
    alignItems: 'center',
  },
  weekNavigatorLabel: {
    fontSize: 11,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  weekNavigatorValue: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  summaryRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#f8fbff',
    borderWidth: 1,
    borderColor: '#e0ecff',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  summaryValue: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  helperText: { fontSize: 12, color: '#64748b' },
  errorText: { fontSize: 12, color: '#dc2626' },
  loadingState: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  entryRow: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 12,
    gap: 10,
    backgroundColor: '#fcfdff',
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  entryWeekday: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#94a3b8',
  },
  entryDate: { marginTop: 2, fontSize: 15, fontWeight: '800', color: '#0f172a' },
  hoursShell: {
    width: 92,
  },
  hoursLabel: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 4,
    textAlign: 'right',
  },
  hoursInput: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    fontSize: 14,
    backgroundColor: '#ffffff',
    textAlign: 'center',
    fontWeight: '700',
  },
  notesInput: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    fontSize: 13,
    backgroundColor: '#ffffff',
  },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  secondaryButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  secondaryText: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  primaryButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
  },
  primaryText: { fontSize: 13, fontWeight: '800', color: '#fff' },
});

export default TimesheetsScreen;
