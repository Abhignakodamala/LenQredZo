import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Platform
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

type Tab = 'dashboard' | 'loans' | 'dues' | 'customers' | 'profile';

function MainApp() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    restoreSession()
      .then(sess => {
        if (sess) {
          setUser(sess.user);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setActiveTab('dashboard');
  };

  if (loading) {
    return (
      <View style={styles.splashContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0f1d" />
        <View style={styles.splashGlow}>
          <View style={styles.splashLogo}>
            <Ionicons name="shield-checkmark" size={38} color="#ffffff" />
          </View>
        </View>
        <Text style={styles.splashBrand}>LenQredzo</Text>
        <Text style={styles.splashSub}>Finance Management & Field Portal</Text>
        <ActivityIndicator size="small" color="#3b82f6" style={{ marginTop: 24 }} />
      </View>
    );
  }

  // If not logged in, show Login Screen with mandatory attendance flow
  if (!user) {
    return (
      <View style={[styles.rootContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0f1d" />
        <LoginScreen onLoginSuccess={setUser} />
      </View>
    );
  }

  // Logged-in Complete Application View with 5 Tabs
  return (
    <View style={[styles.rootContainerLight, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Screen Body */}
      <View style={styles.screenBody}>
        {activeTab === 'dashboard' && <DashboardScreen user={user} onNavigateTab={setActiveTab} />}
        {activeTab === 'loans' && <LoansScreen />}
        {activeTab === 'dues' && <TodayDuesScreen user={user} />}
        {activeTab === 'customers' && <CustomersScreen />}
        {activeTab === 'profile' && <ProfileScreen user={user} onLogout={handleLogout} />}
      </View>

      {/* Bottom Modern 5-Tab Bar */}
      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
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
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10
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
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b'
  },
  tabLabelActive: {
    color: '#2563eb',
    fontWeight: '700'
  }
});
