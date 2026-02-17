import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Link } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ActionCard } from '@/components/hrm/ActionCard';
import { ThemedText } from '@/components/themed-text';

const MOCK_EMPLOYEES = [
  { id: '1', name: 'John Doe', role: 'Software Engineer', dept: 'Engineering' },
  { id: '2', name: 'Jane Smith', role: 'HR Manager', dept: 'Human Resources' },
  { id: '3', name: 'Mike Wilson', role: 'Designer', dept: 'Design' },
];

export default function EmployeeScreen() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <ThemedText type="title">Employees</ThemedText>
        <ThemedText style={styles.subtitle}>
          Manage your team members
        </ThemedText>
      </View>

      <Link href="/employee-modal" asChild>
        <View style={styles.addButton}>
          <MaterialIcons name="person-add" size={22} color="#fff" />
          <ThemedText style={styles.addButtonText}>Add Employee</ThemedText>
        </View>
      </Link>

      <View style={styles.list}>
        {MOCK_EMPLOYEES.map((emp) => (
          <Link key={emp.id} href="/employee-modal" asChild>
            <View style={styles.employeeCard}>
              <View style={styles.avatar}>
                <ThemedText style={styles.avatarText}>
                  {emp.name.charAt(0)}
                </ThemedText>
              </View>
              <View style={styles.employeeInfo}>
                <ThemedText style={styles.employeeName}>{emp.name}</ThemedText>
                <ThemedText style={styles.employeeRole}>{emp.role}</ThemedText>
                <ThemedText style={styles.employeeDept}>{emp.dept}</ThemedText>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#9ca3af" />
            </View>
          </Link>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  header: { marginBottom: 20 },
  subtitle: { fontSize: 16, marginTop: 4, opacity: 0.7 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    padding: 14,
    borderRadius: 12,
    marginBottom: 24,
    gap: 8,
  },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  list: { gap: 12 },
  employeeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  employeeInfo: { flex: 1 },
  employeeName: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  employeeRole: { fontSize: 14, opacity: 0.8 },
  employeeDept: { fontSize: 12, opacity: 0.6, marginTop: 2 },
});
