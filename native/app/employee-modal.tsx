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

export default function EmployeeModal() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [department, setDepartment] = useState('');

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
          <ThemedText type="title">Add Employee</ThemedText>
          <ThemedText style={styles.subtitle}>Register a new team member</ThemedText>
        </View>

        <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Full Name</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="Enter full name"
              placeholderTextColor="#9ca3af"
              value={name}
              onChangeText={setName}
            />
          </View>
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Email</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="email@company.com"
              placeholderTextColor="#9ca3af"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </View>
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Role</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="e.g. Software Engineer"
              placeholderTextColor="#9ca3af"
              value={role}
              onChangeText={setRole}
            />
          </View>
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Department</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="e.g. Engineering"
              placeholderTextColor="#9ca3af"
              value={department}
              onChangeText={setDepartment}
            />
          </View>

          <Pressable
            style={({ pressed }) => [styles.submitButton, pressed && styles.buttonPressed]}
            onPress={() => router.back()}
          >
            <MaterialIcons name="person-add" size={22} color="#fff" />
            <ThemedText style={styles.submitText}>Add Employee</ThemedText>
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
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    gap: 8,
  },
  buttonPressed: { opacity: 0.9 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
