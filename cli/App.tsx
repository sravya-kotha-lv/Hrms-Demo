import { useEffect } from 'react';

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BlurView } from '@react-native-community/blur';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Image, StatusBar, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
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

const patchResponseForStatusZero = () => {
  if (typeof globalThis === 'undefined' || !globalThis.Response) {
    return;
  }
  const NativeResponse = globalThis.Response as typeof Response & { __patchedForZero?: boolean };
  type ResponseBody = ConstructorParameters<typeof Response>[0];
  if (NativeResponse.__patchedForZero) return;

  const WrappedResponse = function (
    body?: ResponseBody,
    init: ResponseInit = {}
  ) {
    const normalizedInit = { ...init };
    if (normalizedInit.status === 0) {
      normalizedInit.status = 200;
    }
    return new NativeResponse(body, normalizedInit);
  } as unknown as typeof Response;

  WrappedResponse.prototype = NativeResponse.prototype;
  Object.setPrototypeOf(WrappedResponse, NativeResponse);
  (WrappedResponse as typeof Response & { __patchedForZero?: boolean }).__patchedForZero = true;
  globalThis.Response = WrappedResponse;
};

patchResponseForStatusZero();

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

const TAB_BAR_BACKGROUND = ['rgb(255, 255, 255)', 'rgb(255, 255, 255)'];
const TAB_BAR_ACTIVE_ICON = '#fffdfd';
const TAB_BAR_INACTIVE_ICON = '#4379b6a6';
const TAB_BAR_ACTIVE_GRADIENT = ['#5b7cfa', '#5b7cfa'];

function TabBarBackground() {
  return (
    <View
      style={{
        flex: 1,
        borderRadius: 0,
        overflow: 'hidden',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: '#5b7cfa',
        backgroundColor: 'rgba(255,255,255,0.08)',
        shadowColor: '#3b82f6',
        shadowOpacity: 0.32,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 0 },
        elevation: 18,
      }}
    >
      <BlurView
        style={StyleSheet.absoluteFillObject}
        blurType="light"
        blurAmount={18}
        reducedTransparencyFallbackColor="rgba(255,255,255,0.86)"
      />
      <LinearGradient colors={TAB_BAR_BACKGROUND} style={{ flex: 1 }} />
    </View>
  );
}

type TabIconProps = {
  focused: boolean;
  icon: string;
  activeIcon?: string;
};

function EmployeeTabs() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const profile = session?.profile || session?.loginData || null;
  const profileImage = profile?.profileImage || profile?.profilePhoto || null;
  const initials =
    ((profile?.firstName?.[0] || '') + (profile?.lastName?.[0] || '') ||
      profile?.email?.[0] ||
      'U')
      .toUpperCase();

  return (
    <LinearGradient colors={['#dbeafe', '#eef2ff', '#e0f2fe']} style={{ flex: 1 }}>
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
            height: 78 + Math.max(insets.bottom, 0),
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            elevation: 0,
            shadowOpacity: 0,
            paddingTop: 10,
            paddingBottom: Math.max(insets.bottom, 10),
            paddingHorizontal: 0,
          },
          tabBarItemStyle: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingVertical: 4,
          },
        }}
      >
        <Tabs.Screen
          name="Attendance"
          component={AttendanceScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon
                focused={focused}
                icon="clipboard-check-outline"
                activeIcon="clipboard-check"
              />
            ),
          }}
        />
        <Tabs.Screen
          name="Leaves"
          component={LeavesScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon
                focused={focused}
                icon="calendar-remove-outline"
                activeIcon="calendar-remove"
              />
            ),
          }}
        />
        <Tabs.Screen
          name="Dashboard"
          component={EmployeeDashboardScreen}
          initialParams={{ initialTab: 'overview' }}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon
                focused={focused}
                icon="view-dashboard-outline"
                activeIcon="view-dashboard"
              />
            ),
          }}
        />
        <Tabs.Screen
          name="Timesheets"
          component={TimesheetsScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon
                focused={focused}
                icon="clipboard-text-outline"
                activeIcon="clipboard-text"
              />
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
                image={profileImage}
                initials={String(initials).toUpperCase()}
              />
            ),
          }}
        />
      </Tabs.Navigator>
    </LinearGradient>
  );
}

function TabIcon({ focused, icon, activeIcon }: TabIconProps) {
  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={`tab${focused ? ', active' : ''}`}
      accessibilityHint="Tap to switch sections"
      style={styles.tabIconWrapper}
    >
      {focused ? (
        <LinearGradient colors={TAB_BAR_ACTIVE_GRADIENT} style={styles.activeIconBubble}>
          <MaterialCommunityIcons
            name={(activeIcon || icon) as any}
            size={22}
            color={TAB_BAR_ACTIVE_ICON}
          />
        </LinearGradient>
      ) : (
        <View style={styles.inactiveIconBubble}>
          <MaterialCommunityIcons
            name={icon as any}
            size={24}
            color={TAB_BAR_INACTIVE_ICON}
          />
        </View>
      )}
    </View>
  );
}

function ProfileTabIcon({
  focused,
  image,
  initials,
}: {
  focused: boolean;
  image?: string | null;
  initials: string;
}) {
  return (
    <View style={styles.profileTabWrapper}>
      <View style={[styles.profileBubble, focused && styles.profileBubbleActive]}>
        {image ? (
          <Image
            source={{ uri: image }}
            style={[
              styles.profileAvatar,
              focused && styles.profileAvatarActive,
            ]}
          />
        ) : (
          <Text style={[styles.profileInitials, focused && styles.profileInitialsActive]}>{initials}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabIconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 56,
    alignSelf: 'center',
  },
  activeIconBubble: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.34)',
    shadowColor: '#60a5fa',
    shadowOpacity: 0.34,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  inactiveIconBubble: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  profileTabWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 56,
    alignSelf: 'center',
  },
  profileBubble: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  profileBubbleActive: {
    backgroundColor: 'rgba(219,234,254,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.40)',
    shadowColor: '#60a5fa',
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  profileAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  profileAvatarActive: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  profileInitials: {
    fontSize: 13,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  profileInitialsActive: {
    color: '#2563eb',
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
            <Stack.Screen
              name="Notifications"
              component={NotificationsScreen}
              options={{
                headerShown: false,
                presentation: 'card',
                animation: 'slide_from_right',
                contentStyle: { backgroundColor: '#f3f5f9' },
              }}
            />
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
