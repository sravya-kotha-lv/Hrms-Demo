import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, ActivityIndicator } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { postApiWithToken } from '@/services/apiWrapper';

const EMPLOYEES = [
  { id: "1", name: "John Doe" },
  { id: "2", name: "Jane Smith" },
  { id: "3", name: "Mike Wilson" },
  { id: "4", name: "Sarah Lee" },
];

export default function AttendanceModal() {

  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<'Present' | 'Late' | 'Absent'>('Present');
  const [saving, setSaving] = useState(false);

  /* ================= SUBMIT API ================= */

  const submitAttendance = async () => {
    if (!selected) return;

    try {
      setSaving(true);

      const payload = {
        employeeIds: [selected],
        date: new Date().toISOString().slice(0, 10),
        status:
          status === "Present"
            ? "present"
            : status === "Late"
            ? "pending_checkout"
            : "absent"
      };

      const res = await postApiWithToken(
        "/timesheets/attendance/matrix/bulk",
        payload
      );

      if (res?.success) {
        router.back();
      } else {
        console.log(res?.message);
      }

    } catch (e) {
      console.log(e);
    } finally {
      setSaving(false);
    }
  };

  /* ================= UI ================= */

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.closeButton}>
          <MaterialIcons name="close" size={24} color="#6b7280" />
        </Pressable>
        <ThemedText type="title">Mark Attendance</ThemedText>
        <ThemedText style={styles.subtitle}>Record daily attendance</ThemedText>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* STATUS */}
        <ThemedText style={styles.sectionTitle}>Select Status</ThemedText>
        <View style={styles.statusRow}>
          {(['Present', 'Late', 'Absent'] as const).map((s) => (
            <Pressable
              key={s}
              style={[
                styles.statusChip,
                status === s && s === 'Present' && styles.chipPresent,
                status === s && s === 'Late' && styles.chipLate,
                status === s && s === 'Absent' && styles.chipAbsent,
              ]}
              onPress={() => setStatus(s)}
            >
              <MaterialIcons
                name={s === 'Present' ? 'check-circle' : s === 'Late' ? 'schedule' : 'cancel'}
                size={20}
                color={status === s ? '#fff' : '#6b7280'}
              />
              <ThemedText style={[styles.chipText, status === s && styles.chipTextActive]}>
                {s}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {/* EMPLOYEES */}
        <ThemedText style={styles.sectionTitle}>Select Employee</ThemedText>

        {EMPLOYEES.map((emp) => (
          <Pressable
            key={emp.id}
            style={[styles.employeeRow, selected === emp.id && styles.employeeRowSelected]}
            onPress={() => setSelected(emp.id)}
          >
            <View style={styles.avatar}>
              <ThemedText style={styles.avatarText}>{emp.name.charAt(0)}</ThemedText>
            </View>

            <ThemedText style={styles.employeeName}>{emp.name}</ThemedText>

            {selected === emp.id && (
              <MaterialIcons name="check-circle" size={24} color="#16a34a" />
            )}
          </Pressable>
        ))}

        {/* SUBMIT */}
        <Pressable
          style={({ pressed }) => [styles.submitButton, pressed && styles.buttonPressed]}
          onPress={submitAttendance}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialIcons name="check-circle" size={22} color="#fff" />
              <ThemedText style={styles.submitText}>Mark Attendance</ThemedText>
            </>
          )}
        </Pressable>

      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 24,
    zIndex: 10,
  },
  subtitle: { fontSize: 16, marginTop: 4, opacity: 0.7 },
  content: { flex: 1, padding: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  statusRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statusChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    gap: 6,
  },
  chipPresent: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  chipLate: { backgroundColor: '#eab308', borderColor: '#eab308' },
  chipAbsent: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  chipText: { fontSize: 14, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  employeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  employeeRowSelected: { borderColor: '#16a34a', backgroundColor: 'rgba(22, 163, 74, 0.08)' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  employeeName: { flex: 1, fontSize: 16, fontWeight: '500' },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16a34a',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  buttonPressed: { opacity: 0.9 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
