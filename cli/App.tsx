import { useEffect } from 'react';

import { NavigationContainer, NavigationState } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Image, Platform, StatusBar, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import LoginScreen from './src/screens/LoginScreen';
import EmployeeDashboardScreen from './src/screens/EmployeeDashboardScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import LeavesScreen from './src/screens/LeavesScreen';
import TimesheetsScreen from './src/screens/TimesheetsScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import ChangePasswordScreen from './src/screens/ChangePasswordScreen';
import RoleSwitchScreen from './src/screens/RoleSwitchScreen';
import AttendanceScreen from './src/screens/AttendanceScreen';
import { setUnauthorizedHandler } from './src/services/api';
import { AuthProvider, useAuth } from './src/context/AuthContext';

export type RootStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
  EmployeeTabs: undefined;
  Notifications: undefined;
  ChangePassword: undefined;
  RoleSwitch: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator();

const TAB_BAR_VARIANT: 'premium' | 'soft' = 'premium';
const TAB_BAR_BACKGROUND_COLOR = '#071236';
const TAB_BAR_OUTLINE_COLOR = '#0d3a7a';
const TAB_BAR_ACTIVE_LABEL = '#e8edff';
const TAB_BAR_INACTIVE_LABEL = '#7aa0d5';
const TAB_BAR_GRADIENT = [TAB_BAR_BACKGROUND_COLOR, '#0a1f58'];
const SOFT_TAB_GRADIENT = ['rgba(15,23,42,0.95)', 'rgba(15,23,42,0.72)'];
const SOFT_TAB_BORDER = 'rgba(99,102,241,0.8)';
const SOFT_ACTIVE_LABEL = '#7dd3fc';
const SOFT_INACTIVE_LABEL = '#cbd5f5';

function TabBarBackground() {
  if (TAB_BAR_VARIANT === 'premium') {
    return (
      <View
        style={{
          flex: 1,
          marginHorizontal: 0,
          borderRadius: 0,
          overflow: 'hidden',
          elevation: 18,
          shadowColor: TAB_BAR_OUTLINE_COLOR,
          shadowOpacity: 0.45,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 12 },
        }}
      >
        <LinearGradient colors={TAB_BAR_GRADIENT} style={{ flex: 1, paddingVertical: 10 }} />
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        marginHorizontal: 0,
        borderRadius: 0,
        borderWidth: 1,
        borderColor: SOFT_TAB_BORDER,
        backgroundColor: 'rgba(15,23,42,0.85)',
        overflow: 'hidden',
        elevation: 14,
        shadowColor: TAB_BAR_OUTLINE_COLOR,
        shadowOpacity: 0.45,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
      }}
    >
      <LinearGradient colors={SOFT_TAB_GRADIENT} style={{ flex: 1, paddingVertical: 10 }} />
    </View>
  );
}

type TabIconProps = {
  focused: boolean;
  icon: string;
  label: string;
};

function EmployeeTabs() {
  const { session } = useAuth();
  const profile = session?.profile || session?.loginData || null;
  const profileImage = profile?.profileImage || profile?.profilePhoto || null;
  const initials =
    ((profile?.firstName?.[0] || '') + (profile?.lastName?.[0] || '') ||
      profile?.email?.[0] ||
      'U')
      .toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: '#eef2ff' }}>
      <Tabs.Navigator
        initialRouteName="Dashboard"
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarBackground: () => <TabBarBackground />,
          tabBarStyle: {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 80,
            borderRadius: 28,
            backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 20,
          shadowColor: '#0f172a',
          shadowOpacity: 0.25,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 12 },
        paddingBottom: Platform.OS === 'ios' ? 12 : 8,
      },
    }}
    >
      <Tabs.Screen
        name="Attendance"
        component={AttendanceScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} label="Attendance" icon="clipboard-check-outline" />
          ),
        }}
      />
      <Tabs.Screen
        name="Leaves"
        component={LeavesScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} label="Leaves" icon="calendar-remove" />
          ),
        }}
      />
      <Tabs.Screen
        name="Dashboard"
        component={EmployeeDashboardScreen}
        initialParams={{ initialTab: 'overview' }}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} label="Dashboard" icon="view-dashboard-outline" />
          ),
        }}
      />
      <Tabs.Screen
        name="Timesheets"
        component={TimesheetsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} label="Timesheets" icon="clipboard-text-outline" />
          ),
        }}
      />
      <Tabs.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <ProfileTabIcon
              focused={focused}
              label="Profile"
              image={profileImage}
              initials={String(initials).toUpperCase()}
            />
          ),
        }}
      />
      </Tabs.Navigator>
    </View>
  );
}

function TabIcon({ focused, icon, label }: TabIconProps) {
  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={`${label} tab${focused ? ', active' : ''}`}
      accessibilityHint="Tap to switch sections"
      style={styles.tabIconWrapper}
    >
      <MaterialCommunityIcons
        name={icon as any}
        size={24}
        color={focused ? '#ffffff' : 'rgba(255,255,255,0.75)'}
      />
      <View style={[styles.tabDot, focused && styles.tabDotActive]} />
    </View>
  );
}

function ProfileTabIcon({
  focused,
  label,
  image,
  initials,
}: {
  focused: boolean;
  label: string;
  image?: string | null;
  initials: string;
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: focused ? 'rgba(255,255,255,0.15)' : 'transparent',
          overflow: 'hidden',
          borderWidth: image ? 1 : 0,
          borderColor: image ? 'rgba(248,250,252,0.55)' : 'transparent',
        }}
      >
        {image ? (
          <Image source={{ uri: image }} style={{ width: 26, height: 26, borderRadius: 13 }} />
        ) : (
          <Text style={{ color: focused ? TAB_BAR_ACTIVE_LABEL : TAB_BAR_INACTIVE_LABEL, fontWeight: '700' }}>
            {initials}
          </Text>
        )}
      </View>
    </View>
  );
}

function getTabLabelStyle(focused: boolean) {
  const activeColor = TAB_BAR_VARIANT === 'premium' ? TAB_BAR_ACTIVE_LABEL : SOFT_ACTIVE_LABEL;
  const inactiveColor = TAB_BAR_VARIANT === 'premium' ? TAB_BAR_INACTIVE_LABEL : SOFT_INACTIVE_LABEL;
  return {
    fontSize: 11,
    textAlign: 'center' as const,
    fontWeight: focused ? '800' : '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
    color: focused ? activeColor : inactiveColor,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  };
}

const styles = StyleSheet.create({
  tabIconWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Platform.OS === 'ios' ? 8 : 6,
  },
  tabDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'transparent',
    marginTop: 6,
  },
  tabDotActive: {
    backgroundColor: '#7dd3fc',
  },
  profileImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  profileInitials: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
});

function AppNavigator() {
  const { session, logout, setSessionExpiredMessage } = useAuth();

  useEffect(() => {
    const handler = () => {
      setSessionExpiredMessage('Your session has expired. Please log in again.');
      logout();
    };
    setUnauthorizedHandler(handler);
    return () => setUnauthorizedHandler(null);
  }, [logout, setSessionExpiredMessage]);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
          <>
            <Stack.Screen name="EmployeeTabs" component={EmployeeTabs} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
            <Stack.Screen name="RoleSwitch" component={RoleSwitchScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export default App;
