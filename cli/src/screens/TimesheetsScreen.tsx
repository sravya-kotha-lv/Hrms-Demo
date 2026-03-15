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
import { useNavigation } from '@react-navigation/native';
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

function TimesheetsScreen() {
  const navigation = useNavigation<any>();
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
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.headerButton}>
            <MaterialCommunityIcons name="chevron-left" size={22} color="#0f172a" />
          </Pressable>
          <Text style={styles.headerTitle}>Weekly Timesheet</Text>
          <View style={styles.headerButton} />
        </View>

        <View style={styles.card}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <Text style={styles.helperText}>Week starting {weekStartKey}</Text>

          {loading ? (
            <ActivityIndicator />
          ) : (
            entries.map((entry, idx) => (
              <View key={entry.date} style={styles.entryRow}>
                <Text style={styles.entryDate}>{entry.date}</Text>
                <TextInput
                  style={styles.hoursInput}
                  keyboardType="decimal-pad"
                  value={String(entry.hours)}
                  onChangeText={(value) => updateEntry(idx, { hours: Number(value) || 0 })}
                />
                <TextInput
                  style={styles.notesInput}
                  placeholder="Notes"
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  helperText: { fontSize: 12, color: '#64748b' },
  errorText: { fontSize: 12, color: '#dc2626' },
  entryRow: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  entryDate: { fontSize: 12, fontWeight: '700', color: '#0f172a' },
  hoursInput: {
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 8,
    fontSize: 12,
  },
  notesInput: {
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 8,
    fontSize: 12,
  },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  secondaryButton: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  secondaryText: { fontSize: 12, fontWeight: '600', color: '#0f172a' },
  primaryButton: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
  },
  primaryText: { fontSize: 12, fontWeight: '700', color: '#fff' },
});

export default TimesheetsScreen;
