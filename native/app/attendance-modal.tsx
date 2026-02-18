import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

const EMPLOYEES = ['John Doe', 'Jane Smith', 'Mike Wilson', 'Sarah Lee'];

export default function AttendanceModal() {
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<'Present' | 'Late' | 'Absent'>('Present');

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

        <ThemedText style={styles.sectionTitle}>Select Employee</ThemedText>
        {EMPLOYEES.map((emp) => (
          <Pressable
            key={emp}
            style={[styles.employeeRow, selected === emp && styles.employeeRowSelected]}
            onPress={() => setSelected(emp)}
          >
            <View style={styles.avatar}>
              <ThemedText style={styles.avatarText}>{emp.charAt(0)}</ThemedText>
            </View>
            <ThemedText style={styles.employeeName}>{emp}</ThemedText>
            {selected === emp && (
              <MaterialIcons name="check-circle" size={24} color="#16a34a" />
            )}
          </Pressable>
        ))}

        <Pressable
          style={({ pressed }) => [styles.submitButton, pressed && styles.buttonPressed]}
          onPress={() => router.back()}
        >
          <MaterialIcons name="check-circle" size={22} color="#fff" />
          <ThemedText style={styles.submitText}>Mark Attendance</ThemedText>
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
