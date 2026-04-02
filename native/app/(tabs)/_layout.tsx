import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Notifications from 'expo-notifications';
import { Tabs, useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const lastHandledNotificationIdRef = useRef<string | null>(null);

  useEffect(() => {
    const resolveTargetPath = (data: Record<string, unknown>) => {
      const type = String(data?.type || '').toLowerCase();

      if (type.startsWith('leave_')) return '/(tabs)/leaves';
      if (type === 'attendance_request_pending_approval') return '/(tabs)/attendance';
      if (type === 'attendance_override') return '/(tabs)/attendance';
      if (type.includes('payroll')) return '/(tabs)/payroll';
      if (type.includes('employee')) return '/(tabs)/employee';
      return '/(tabs)';
    };

    const handleNotificationResponse = (response: Notifications.NotificationResponse | null) => {
      const notificationId = response?.notification?.request?.identifier || null;
      if (!response || !notificationId || lastHandledNotificationIdRef.current === notificationId) {
        return;
      }

      lastHandledNotificationIdRef.current = notificationId;
      const data = (response.notification.request.content.data || {}) as Record<string, unknown>;
      router.replace(resolveTargetPath(data));
    };

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      handleNotificationResponse(response);
    });

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationResponse(response);
    });

    return () => {
      subscription.remove();
    };
  }, [router]);

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
