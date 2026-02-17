import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: isDark ? '#60a5fa' : '#2563eb',
        tabBarInactiveTintColor: isDark ? '#9ca3af' : '#6b7280',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: isDark ? '#1f2937' : '#ffffff',
          borderTopColor: isDark ? '#374151' : '#e5e7eb',
          paddingTop: 6,
          height: 65,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons
              name={focused ? 'dashboard' : 'dashboard'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="employee"
        options={{
          title: 'Employee',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="people" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: 'Attendance',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="event-available" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="leaves"
        options={{
          title: 'Leaves',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="event-busy" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="payroll"
        options={{
          title: 'Payroll',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="payments" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
