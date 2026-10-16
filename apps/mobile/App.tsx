import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator
} from 'react-native';
import { User } from './src/types';
import { restoreSession, logout } from './src/services/auth';
import LoginScreen from './src/screens/LoginScreen';
import TodayDuesScreen from './src/screens/TodayDuesScreen';
import CustomersScreen from './src/screens/CustomersScreen';
import ProfileScreen from './src/screens/ProfileScreen';

type Tab = 'dues' | 'customers' | 'profile';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('dues');

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
    setActiveTab('dues');
  };

  if (loading) {
    return (
      <View style={styles.splashContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
        <View style={styles.splashLogo}>
          <Text style={styles.splashLogoText}>LQ</Text>
        </View>
        <Text style={styles.splashBrand}>LenQredzo Agent</Text>
        <ActivityIndicator size="small" color="#3b82f6" style={{ marginTop: 16 }} />
      </View>
    );
  }

  // If not logged in, show Login Screen with mandatory attendance flow
  if (!user) {
    return (
      <SafeAreaView style={styles.safeContainerDark}>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
        <LoginScreen onLoginSuccess={setUser} />
      </SafeAreaView>
    );
  }

  // Logged-in Main App View with Bottom Tab Navigation
  return (
    <SafeAreaView style={styles.safeContainerLight}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Screen Body */}
      <View style={styles.screenBody}>
        {activeTab === 'dues' && <TodayDuesScreen user={user} />}
        {activeTab === 'customers' && <CustomersScreen />}
        {activeTab === 'profile' && <ProfileScreen user={user} onLogout={handleLogout} />}
      </View>

      {/* Bottom Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('dues')}
        >
          <Text style={[styles.tabIcon, activeTab === 'dues' && styles.tabIconActive]}>
            📋
          </Text>
          <Text style={[styles.tabLabel, activeTab === 'dues' && styles.tabLabelActive]}>
            Today's Dues
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('customers')}
        >
          <Text style={[styles.tabIcon, activeTab === 'customers' && styles.tabIconActive]}>
            👥
          </Text>
          <Text style={[styles.tabLabel, activeTab === 'customers' && styles.tabLabelActive]}>
            Borrowers
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('profile')}
        >
          <Text style={[styles.tabIcon, activeTab === 'profile' && styles.tabIconActive]}>
            👤
          </Text>
          <Text style={[styles.tabLabel, activeTab === 'profile' && styles.tabLabelActive]}>
            Profile
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainerDark: {
    flex: 1,
    backgroundColor: '#0f172a'
  },
  safeContainerLight: {
    flex: 1,
    backgroundColor: '#ffffff'
  },
  splashContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center'
  },
  splashLogo: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#1e40af',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16
  },
  splashLogoText: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '900'
  },
  splashBrand: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff'
  },
  screenBody: {
    flex: 1
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 8,
    paddingBottom: 10,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: 2,
    opacity: 0.5
  },
  tabIconActive: {
    opacity: 1
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b'
  },
  tabLabelActive: {
    color: '#1e40af',
    fontWeight: '700'
  }
});
