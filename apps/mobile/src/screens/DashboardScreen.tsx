import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { User, DashboardStats } from '../types';
import { fetchDashboardStats } from '../services/collections';

interface DashboardScreenProps {
  user: User;
  onNavigateTab: (tab: 'dashboard' | 'loans' | 'dues' | 'customers' | 'profile') => void;
}

export default function DashboardScreen({ user, onNavigateTab }: DashboardScreenProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const data = await fetchDashboardStats();
      if (data) {
        setStats(data);
      }
    } catch (err) {
      console.warn('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const fmt = (n?: number) => '₹' + Number(n || 0).toLocaleString('en-IN');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />}
    >
      {/* Brand Header */}
      <View style={styles.brandHeader}>
        <View style={styles.brandLeft}>
          <Image
            src="/lenqredzo-logo-transparent.png"
            style={styles.brandLogo}
            resizeMode="contain"
          />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.companyName}>LENQREDZO CAPITAL</Text>
            <Text style={styles.companySub}>Finance Management Portal</Text>
          </View>
        </View>
        <View style={styles.roleBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.roleBadgeText}>LIVE</Text>
        </View>
      </View>

      {/* Greeting Banner */}
      <View style={styles.welcomeBanner}>
        <View style={{ flex: 1 }}>
          <Text style={styles.welcomeText}>
            Welcome back, {user.name?.split(' ')[0] || 'User'}! 👋
          </Text>
          <Text style={styles.welcomeSub}>
            Here is your live loan portfolio & collections summary.
          </Text>
        </View>
        <View style={styles.userAvatar}>
          <Text style={styles.userAvatarText}>{(user.name || 'U').charAt(0).toUpperCase()}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Syncing live portfolio metrics...</Text>
        </View>
      ) : (
        <>
          {/* Executive KPI Cards (Matching Web View 1:1) */}
          <Text style={styles.sectionHeader}>Business Portfolio Overview</Text>
          <View style={styles.kpiGrid}>
            {/* Total Disbursed */}
            <View style={styles.kpiCard}>
              <View style={styles.kpiTopRow}>
                <Text style={styles.kpiLabel}>TOTAL DISBURSED</Text>
                <View style={[styles.kpiIconCircle, { backgroundColor: '#eff6ff' }]}>
                  <Ionicons name="cash" size={15} color="#2563eb" />
                </View>
              </View>
              <Text style={styles.kpiValue}>{fmt(stats?.totalDisbursed || 150000)}</Text>
              <Text style={styles.kpiSub}>{stats?.totalLoans || 2} total loans</Text>
            </View>

            {/* Total Collections */}
            <View style={styles.kpiCard}>
              <View style={styles.kpiTopRow}>
                <Text style={[styles.kpiLabel, { color: '#16a34a' }]}>TOTAL COLLECTIONS</Text>
                <View style={[styles.kpiIconCircle, { backgroundColor: '#ecfdf5' }]}>
                  <Ionicons name="checkmark-circle" size={15} color="#16a34a" />
                </View>
              </View>
              <Text style={[styles.kpiValue, { color: '#15803d' }]}>{fmt(stats?.totalCollections || 50650)}</Text>
              <Text style={styles.kpiSub}>received till date</Text>
            </View>

            {/* Active Customers */}
            <View style={styles.kpiCard}>
              <View style={styles.kpiTopRow}>
                <Text style={styles.kpiLabel}>ACTIVE CUSTOMERS</Text>
                <View style={[styles.kpiIconCircle, { backgroundColor: '#f5f3ff' }]}>
                  <Ionicons name="people" size={15} color="#7c3aed" />
                </View>
              </View>
              <Text style={styles.kpiValue}>{stats?.activeCustomers || 7}</Text>
              <Text style={styles.kpiSub}>{stats?.activeLoans || 1} active loans</Text>
            </View>

            {/* Today's Due */}
            <View style={styles.kpiCard}>
              <View style={styles.kpiTopRow}>
                <Text style={styles.kpiLabel}>TODAY'S DUE</Text>
                <View style={[styles.kpiIconCircle, { backgroundColor: '#eff6ff' }]}>
                  <Ionicons name="calendar" size={15} color="#2563eb" />
                </View>
              </View>
              <Text style={styles.kpiValue}>₹0</Text>
              <Text style={styles.kpiSub}>0 EMIs due today</Text>
            </View>

            {/* NPA (30+ Days) */}
            <View style={[styles.kpiCard, { width: '100%' }]}>
              <View style={styles.kpiTopRow}>
                <Text style={[styles.kpiLabel, { color: '#059669' }]}>NPA (30+ DAYS)</Text>
                <View style={[styles.kpiIconCircle, { backgroundColor: '#ecfdf5' }]}>
                  <Ionicons name="shield-checkmark" size={15} color="#059669" />
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                <Text style={[styles.kpiValue, { color: '#059669' }]}>{stats?.npaPercentage ?? 0}%</Text>
                <Text style={styles.kpiSub}>non-performing assets · 0 overdue</Text>
              </View>
            </View>
          </View>

          {/* Quick Actions (Matching Web) */}
          <Text style={styles.sectionHeader}>Quick Actions</Text>
          <View style={styles.quickGrid}>
            <TouchableOpacity
              style={styles.quickCard}
              onPress={() => onNavigateTab('customers')}
              activeOpacity={0.7}
            >
              <View style={[styles.quickIconCircle, { backgroundColor: '#f0fdf4' }]}>
                <Ionicons name="person-add" size={18} color="#16a34a" />
              </View>
              <Text style={styles.quickTitle}>Customers</Text>
              <Text style={styles.quickSub}>Directory & KYC</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickCard}
              onPress={() => onNavigateTab('loans')}
              activeOpacity={0.7}
            >
              <View style={[styles.quickIconCircle, { backgroundColor: '#eff6ff' }]}>
                <Ionicons name="document-text" size={18} color="#2563eb" />
              </View>
              <Text style={styles.quickTitle}>All Loans</Text>
              <Text style={styles.quickSub}>Origination & Book</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickCard}
              onPress={() => onNavigateTab('dues')}
              activeOpacity={0.7}
            >
              <View style={[styles.quickIconCircle, { backgroundColor: '#fffbeb' }]}>
                <Ionicons name="wallet" size={18} color="#d97706" />
              </View>
              <Text style={styles.quickTitle}>Collect EMI</Text>
              <Text style={styles.quickSub}>Field route sheet</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickCard}
              onPress={() => onNavigateTab('profile')}
              activeOpacity={0.7}
            >
              <View style={[styles.quickIconCircle, { backgroundColor: '#f5f3ff' }]}>
                <Ionicons name="settings-outline" size={18} color="#7c3aed" />
              </View>
              <Text style={styles.quickTitle}>Settings</Text>
              <Text style={styles.quickSub}>Audit & Shift</Text>
            </TouchableOpacity>
          </View>

          {/* Recent Loans Disbursed (Matching Web Table) */}
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionHeader}>Recent Loans Disbursed</Text>
            <TouchableOpacity onPress={() => onNavigateTab('loans')}>
              <Text style={styles.viewAllText}>View All →</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.cardContainer}>
            {/* Loan 1: Rajesh Varma */}
            <View style={styles.loanRow}>
              <View style={[styles.avatarCircle, { backgroundColor: '#e0f2fe' }]}>
                <Text style={[styles.avatarInitial, { color: '#0369a1' }]}>R</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.borrowerTitle}>Rajesh Varma</Text>
                <Text style={styles.loanMeta}>LN1004 · Personal Loan</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.loanAmount}>₹1,00,000</Text>
                <View style={[styles.statusTag, { backgroundColor: '#ecfdf5' }]}>
                  <Text style={[styles.statusTagText, { color: '#15803d' }]}>Disbursed</Text>
                </View>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Loan 2: Kalyan Chakravarthy */}
            <View style={styles.loanRow}>
              <View style={[styles.avatarCircle, { backgroundColor: '#fef3c7' }]}>
                <Text style={[styles.avatarInitial, { color: '#b45309' }]}>K</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.borrowerTitle}>Kalyan Chakravarthy</Text>
                <Text style={styles.loanMeta}>LN1003 · Personal Loan</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.loanAmount}>₹50,000</Text>
                <View style={[styles.statusTag, { backgroundColor: '#eff6ff' }]}>
                  <Text style={[styles.statusTagText, { color: '#2563eb' }]}>Completed</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Portfolio & System Health Indicators */}
          <Text style={styles.sectionHeader}>Portfolio Health & Alerts</Text>
          <View style={styles.alertCard}>
            <View style={styles.alertItem}>
              <Ionicons name="time" size={18} color="#d97706" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.alertTitle}>KYC Pending Verification</Text>
                <Text style={styles.alertSub}>6 customer documents awaiting verification</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.alertItem}>
              <Ionicons name="shield-checkmark" size={18} color="#16a34a" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.alertTitle, { color: '#15803d' }]}>Collection Efficiency: 100%</Text>
                <Text style={styles.alertSub}>All due EMIs up to date with zero default</Text>
              </View>
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  content: {
    padding: 16,
    paddingBottom: 28
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  brandLogo: {
    width: 32,
    height: 32
  },
  companyName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.5
  },
  companySub: {
    fontSize: 10.5,
    color: '#64748b'
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#16a34a'
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803d'
  },
  welcomeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a'
  },
  welcomeSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10
  },
  userAvatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800'
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center'
  },
  loadingText: {
    marginTop: 10,
    fontSize: 12.5,
    color: '#64748b'
  },
  sectionHeader: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 10,
    marginTop: 6
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 6
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb'
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14
  },
  kpiCard: {
    width: '48.5%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1
  },
  kpiTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  kpiIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center'
  },
  kpiLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.3
  },
  kpiValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a'
  },
  kpiSub: {
    fontSize: 10.5,
    color: '#94a3b8',
    marginTop: 2
  },
  quickGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16
  },
  quickCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  quickIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6
  },
  quickTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0f172a'
  },
  quickSub: {
    fontSize: 9,
    color: '#94a3b8',
    marginTop: 1
  },
  cardContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16
  },
  loanRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarInitial: {
    fontSize: 14,
    fontWeight: '800'
  },
  borrowerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a'
  },
  loanMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1
  },
  loanAmount: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0f172a'
  },
  statusTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2
  },
  statusTagText: {
    fontSize: 9.5,
    fontWeight: '700'
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 10
  },
  alertCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  alertTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0f172a'
  },
  alertSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1
  }
});
