import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Platform,
  Image
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { User } from './src/types';
import { restoreSession, logout } from './src/services/auth';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import LoansScreen from './src/screens/LoansScreen';
import TodayDuesScreen from './src/screens/TodayDuesScreen';
import CustomersScreen from './src/screens/CustomersScreen';
import ProfileScreen from './src/screens/ProfileScreen';

type AppMode = 'executive' | 'field';
type Tab = 'dashboard' | 'loans' | 'dues' | 'customers' | 'profile';

const isManagementUser = (role?: string) => {
  if (!role) return false;
  const clean = role.toLowerCase().replace(/[\s_-]/g, '');
  return ['owner', 'admin', 'superadmin', 'branchmanager', 'manager', 'director'].includes(clean);
};

function MainApp() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [appMode, setAppMode] = useState<AppMode>('executive');
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const insets = useSafeAreaInsets();

  const isOwner = isManagementUser(user?.role);

  useEffect(() => {
    restoreSession()
      .then(sess => {
        if (sess) {
          setUser(sess.user);
          const owner = isManagementUser(sess.user.role);
          setAppMode(owner ? 'executive' : 'field');
          setActiveTab(owner ? 'dashboard' : 'dues');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    const owner = isManagementUser(loggedInUser.role);
    setAppMode(owner ? 'executive' : 'field');
    setActiveTab(owner ? 'dashboard' : 'dues');
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setAppMode('executive');
    setActiveTab('dashboard');
  };

  const toggleAppMode = (targetMode: AppMode) => {
    setAppMode(targetMode);
    if (targetMode === 'executive') {
      setActiveTab('dashboard');
    } else {
      setActiveTab('dues');
    }
  };

  if (loading) {
    return (
      <View style={styles.splashContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0f1d" />
        <View style={styles.splashGlow}>
          <View style={styles.splashLogo}>
            <Image
              source={require('./assets/lenqredzo-logo-transparent.png')}
              style={{ width: 44, height: 44 }}
              resizeMode="contain"
            />
          </View>
        </View>
        <Text style={styles.splashBrand}>LenQredzo Capital</Text>
        <Text style={styles.splashSub}>Enterprise Loan Management & Mobility</Text>
        <ActivityIndicator size="small" color="#3b82f6" style={{ marginTop: 24 }} />
      </View>
    );
  }

  // If not logged in, show Login Screen with mandatory attendance flow
  if (!user) {
    return (
      <View style={[styles.rootContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0f1d" />
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      </View>
    );
  }

  // Logged-in Complete Application View
  return (
    <View style={[styles.rootContainerLight, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Mode Switcher Pill in Top Bar for Owners / Admins */}
      {isOwner && (
        <View style={styles.topModeBar}>
          <View style={styles.topModeContainer}>
            <TouchableOpacity
              style={[styles.modeToggleTab, appMode === 'executive' && styles.modeToggleTabActive]}
              onPress={() => toggleAppMode('executive')}
              activeOpacity={0.75}
            >
              <Ionicons
                name="pie-chart"
                size={13}
                color={appMode === 'executive' ? '#2563eb' : '#64748b'}
              />
              <Text style={[styles.modeToggleLabel, appMode === 'executive' && styles.modeToggleLabelActive]}>
                👑 Executive View
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeToggleTab, appMode === 'field' && styles.modeToggleTabFieldActive]}
              onPress={() => toggleAppMode('field')}
              activeOpacity={0.75}
            >
              <Ionicons
                name="bicycle"
                size={14}
                color={appMode === 'field' ? '#16a34a' : '#64748b'}
              />
              <Text style={[styles.modeToggleLabel, appMode === 'field' && styles.modeToggleLabelFieldActive]}>
                🏍️ Field Mode
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Screen Body */}
      <View style={styles.screenBody}>
        {activeTab === 'dashboard' && (
          <DashboardScreen
            user={user}
            onNavigateTab={setActiveTab}
            onSwitchToFieldMode={isOwner ? () => toggleAppMode('field') : undefined}
          />
        )}
        {activeTab === 'loans' && <LoansScreen />}
        {activeTab === 'dues' && (
          <TodayDuesScreen
            user={user}
            onSwitchToExecutiveMode={isOwner && appMode === 'field' ? () => toggleAppMode('executive') : undefined}
          />
        )}
        {activeTab === 'customers' && <CustomersScreen />}
        {activeTab === 'profile' && (
          <ProfileScreen
            user={user}
            onLogout={handleLogout}
            appMode={appMode}
            onToggleMode={isOwner ? toggleAppMode : undefined}
          />
        )}
      </View>

      {/* Dynamic Tab Bar: 5-Tab Executive vs 3-Tab Field Route */}
      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {appMode === 'executive' ? (
          /* ──────── 5-TAB EXECUTIVE COCKPIT ──────── */
          <>
            {/* 1. Dashboard Tab */}
            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => setActiveTab('dashboard')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrapper, activeTab === 'dashboard' && styles.iconWrapperActive]}>
                <Ionicons
                  name={activeTab === 'dashboard' ? 'pie-chart' : 'pie-chart-outline'}
                  size={19}
                  color={activeTab === 'dashboard' ? '#2563eb' : '#64748b'}
                />
              </View>
              <Text style={[styles.tabLabel, activeTab === 'dashboard' && styles.tabLabelActive]}>
                Dashboard
              </Text>
            </TouchableOpacity>

            {/* 2. Loans Tab */}
            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => setActiveTab('loans')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrapper, activeTab === 'loans' && styles.iconWrapperActive]}>
                <Ionicons
                  name={activeTab === 'loans' ? 'document-text' : 'document-text-outline'}
                  size={19}
                  color={activeTab === 'loans' ? '#2563eb' : '#64748b'}
                />
              </View>
              <Text style={[styles.tabLabel, activeTab === 'loans' && styles.tabLabelActive]}>
                Loans
              </Text>
            </TouchableOpacity>

            {/* 3. Collections Tab */}
            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => setActiveTab('dues')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrapper, activeTab === 'dues' && styles.iconWrapperActive]}>
                <Ionicons
                  name={activeTab === 'dues' ? 'wallet' : 'wallet-outline'}
                  size={19}
                  color={activeTab === 'dues' ? '#2563eb' : '#64748b'}
                />
              </View>
              <Text style={[styles.tabLabel, activeTab === 'dues' && styles.tabLabelActive]}>
                Collect
              </Text>
            </TouchableOpacity>

            {/* 4. Customers Tab */}
            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => setActiveTab('customers')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrapper, activeTab === 'customers' && styles.iconWrapperActive]}>
                <Ionicons
                  name={activeTab === 'customers' ? 'people' : 'people-outline'}
                  size={19}
                  color={activeTab === 'customers' ? '#2563eb' : '#64748b'}
                />
              </View>
              <Text style={[styles.tabLabel, activeTab === 'customers' && styles.tabLabelActive]}>
                Borrowers
              </Text>
            </TouchableOpacity>

            {/* 5. Profile Tab */}
            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => setActiveTab('profile')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrapper, activeTab === 'profile' && styles.iconWrapperActive]}>
                <Ionicons
                  name={activeTab === 'profile' ? 'person-circle' : 'person-circle-outline'}
                  size={19}
                  color={activeTab === 'profile' ? '#2563eb' : '#64748b'}
                />
              </View>
              <Text style={[styles.tabLabel, activeTab === 'profile' && styles.tabLabelActive]}>
                Profile
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          /* ──────── 3-TAB FIELD AGENT WEAPON ──────── */
          <>
            {/* 1. Today's Route Tab */}
            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => setActiveTab('dues')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrapper, activeTab === 'dues' && styles.iconWrapperFieldActive]}>
                <Ionicons
                  name={activeTab === 'dues' ? 'map' : 'map-outline'}
                  size={20}
                  color={activeTab === 'dues' ? '#16a34a' : '#64748b'}
                />
              </View>
              <Text style={[styles.tabLabel, activeTab === 'dues' && styles.tabLabelFieldActive]}>
                Today's Route
              </Text>
            </TouchableOpacity>

            {/* 2. Borrowers Quick Lookup Tab */}
            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => setActiveTab('customers')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrapper, activeTab === 'customers' && styles.iconWrapperFieldActive]}>
                <Ionicons
                  name={activeTab === 'customers' ? 'people' : 'people-outline'}
                  size={20}
                  color={activeTab === 'customers' ? '#16a34a' : '#64748b'}
                />
              </View>
              <Text style={[styles.tabLabel, activeTab === 'customers' && styles.tabLabelFieldActive]}>
                Borrowers
              </Text>
            </TouchableOpacity>

            {/* 3. My Shift / Profile Tab */}
            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => setActiveTab('profile')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrapper, activeTab === 'profile' && styles.iconWrapperFieldActive]}>
                <Ionicons
                  name={activeTab === 'profile' ? 'shield-checkmark' : 'shield-checkmark-outline'}
                  size={20}
                  color={activeTab === 'profile' ? '#16a34a' : '#64748b'}
                />
              </View>
              <Text style={[styles.tabLabel, activeTab === 'profile' && styles.tabLabelFieldActive]}>
                My Shift
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

export default function App() {
  const isWeb = Platform.OS === 'web';

  if (isWeb) {
    return (
      <SafeAreaProvider>
        <View style={styles.webWrapper}>
          <View style={styles.webDeviceFrame}>
            <MainApp />
          </View>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  webWrapper: {
    flex: 1,
    backgroundColor: '#030712',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100%' as any
  },
  webDeviceFrame: {
    width: '100%',
    maxWidth: 440,
    height: '100%',
    maxHeight: 900,
    backgroundColor: '#ffffff',
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.45,
    shadowRadius: 30,
    elevation: 20,
    borderWidth: 1,
    borderColor: '#1e293b'
  },
  rootContainer: {
    flex: 1,
    backgroundColor: '#0a0f1d'
  },
  rootContainerLight: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  topModeBar: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0'
  },
  topModeContainer: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 3
  },
  modeToggleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 9,
    gap: 5
  },
  modeToggleTabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2
  },
  modeToggleTabFieldActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2
  },
  modeToggleLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b'
  },
  modeToggleLabelActive: {
    color: '#2563eb',
    fontWeight: '800'
  },
  modeToggleLabelFieldActive: {
    color: '#15803d',
    fontWeight: '800'
  },
  splashContainer: {
    flex: 1,
    backgroundColor: '#0a0f1d',
    justifyContent: 'center',
    alignItems: 'center'
  },
  splashGlow: {
    padding: 10,
    borderRadius: 26,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    marginBottom: 16
  },
  splashLogo: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
    padding: 8
  },
  splashBrand: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5
  },
  splashSub: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
    fontWeight: '500'
  },
  screenBody: {
    flex: 1
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderColor: '#f1f5f9',
    paddingTop: 6,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 10
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  iconWrapper: {
    width: 38,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2
  },
  iconWrapperActive: {
    backgroundColor: '#eff6ff'
  },
  iconWrapperFieldActive: {
    backgroundColor: '#ecfdf5'
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b'
  },
  tabLabelActive: {
    color: '#2563eb',
    fontWeight: '700'
  },
  tabLabelFieldActive: {
    color: '#16a34a',
    fontWeight: '700'
  }
});
