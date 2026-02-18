import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

const LEAVE_TYPES = ['Sick Leave', 'Annual Leave', 'Personal', 'Emergency'];

export default function LeaveModal() {
  const [leaveType, setLeaveType] = useState('Sick Leave');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.closeButton}>
            <MaterialIcons name="close" size={24} color="#6b7280" />
          </Pressable>
          <ThemedText type="title">Apply for Leave</ThemedText>
          <ThemedText style={styles.subtitle}>Submit your leave request</ThemedText>
        </View>

        <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
          <ThemedText style={styles.label}>Leave Type</ThemedText>
          <View style={styles.typeRow}>
            {LEAVE_TYPES.map((type) => (
              <Pressable
                key={type}
                style={[styles.typeChip, leaveType === type && styles.typeChipActive]}
                onPress={() => setLeaveType(type)}
              >
                <ThemedText style={[styles.chipText, leaveType === type && styles.chipTextActive]}>
                  {type}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Start Date</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9ca3af"
              value={startDate}
              onChangeText={setStartDate}
            />
          </View>
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>End Date</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9ca3af"
              value={endDate}
              onChangeText={setEndDate}
            />
          </View>
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Reason</ThemedText>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Enter reason for leave..."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={4}
              value={reason}
              onChangeText={setReason}
            />
          </View>

          <Pressable
            style={({ pressed }) => [styles.submitButton, pressed && styles.buttonPressed]}
            onPress={() => router.back()}
          >
            <MaterialIcons name="send" size={22} color="#fff" />
            <ThemedText style={styles.submitText}>Submit Request</ThemedText>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
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
  form: { flex: 1, padding: 24 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  typeChipActive: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  chipText: { fontSize: 14, fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  inputGroup: { marginBottom: 20 },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    gap: 8,
  },
  buttonPressed: { opacity: 0.9 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
