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
import { User, DashboardStats, EMIItem } from '../types';
import { fetchDashboardStats, fetchAllCollections } from '../services/collections';
import { getApiUrl } from '../config';

interface DashboardScreenProps {
  user: User;
  onNavigateTab: (tab: 'dashboard' | 'loans' | 'dues' | 'customers' | 'profile') => void;
  onSwitchToFieldMode?: () => void;
}

export default function DashboardScreen({ user, onNavigateTab, onSwitchToFieldMode }: DashboardScreenProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [todayDueAmount, setTodayDueAmount] = useState<number>(0);
  const [todayDueCount, setTodayDueCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentHost, setCurrentHost] = useState('192.168.1.20:5000');

  const loadData = useCallback(async () => {
    try {
      const host = await getApiUrl();
      setCurrentHost(host.replace('http://', ''));

      const [data, emis] = await Promise.all([
        fetchDashboardStats(),
        fetchAllCollections().catch(() => [] as EMIItem[])
      ]);

      if (data) {
        setStats(data);
      }

      // Calculate today's real pending due
      if (Array.isArray(emis)) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(todayStart);
        todayEnd.setDate(todayEnd.getDate() + 1);

        let sum = 0;
        let count = 0;
        emis.forEach((e: EMIItem) => {
          if (e.status !== 'paid') {
            const d = new Date(e.dueDate);
            if (d <= todayEnd) {
              sum += (e.amount - (e.paidAmount || 0) + (e.penalty || 0));
              count += 1;
            }
          }
        });
        setTodayDueAmount(sum);
        setTodayDueCount(count);
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

  const effPercent = stats?.collectionEfficiency ?? 100;

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
            source={require('../../assets/lenqredzo-logo-transparent.png')}
            style={styles.brandLogo}
            resizeMode="contain"
          />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.companyName}>LENQREDZO CAPITAL</Text>
            <Text style={styles.companySub}>Enterprise Lending & Mobility</Text>
          </View>
        </View>

        {onSwitchToFieldMode ? (
          <TouchableOpacity
            style={styles.modeSwitchHeaderBtn}
            onPress={onSwitchToFieldMode}
            activeOpacity={0.7}
          >
            <Ionicons name="bicycle" size={13} color="#2563eb" />
            <Text style={styles.modeSwitchHeaderText}>Field View</Text>
            <Ionicons name="swap-horizontal" size={12} color="#2563eb" style={{ marginLeft: 2 }} />
          </TouchableOpacity>
        ) : (
          <View style={styles.roleBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.roleBadgeText}>LIVE</Text>
          </View>
        )}
      </View>

      {/* Live Server Sync Status Bar */}
      <View style={styles.serverSyncBar}>
        <View style={styles.serverSyncLeft}>
          <View style={styles.livePulsingDot} />
          <Text style={styles.serverSyncText}>
            Live Sync: <Text style={{ fontWeight: '700', color: '#0f172a' }}>{currentHost}</Text> · 100% Synced
          </Text>
        </View>
        <TouchableOpacity
          style={styles.refreshSyncBtn}
          onPress={onRefresh}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh" size={13} color="#2563eb" />
          <Text style={styles.refreshSyncText}>Sync</Text>
        </TouchableOpacity>
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
              <Text style={styles.kpiValue}>{fmt(stats?.totalDisbursed)}</Text>
              <Text style={styles.kpiSub}>{stats?.totalLoans || 0} total sanctioned loans</Text>
            </View>

            {/* Total Collections */}
            <View style={styles.kpiCard}>
              <View style={styles.kpiTopRow}>
                <Text style={[styles.kpiLabel, { color: '#16a34a' }]}>TOTAL COLLECTIONS</Text>
                <View style={[styles.kpiIconCircle, { backgroundColor: '#ecfdf5' }]}>
                  <Ionicons name="checkmark-circle" size={15} color="#16a34a" />
                </View>
              </View>
              <Text style={[styles.kpiValue, { color: '#15803d' }]}>{fmt(stats?.totalCollections)}</Text>
              <Text style={styles.kpiSub}>received till date</Text>
            </View>

            {/* Active Customers */}
            <View style={styles.kpiCard}>
              <View style={styles.kpiTopRow}>
                <Text style={styles.kpiLabel}>ACTIVE BORROWERS</Text>
                <View style={[styles.kpiIconCircle, { backgroundColor: '#f5f3ff' }]}>
                  <Ionicons name="people" size={15} color="#7c3aed" />
                </View>
              </View>
              <Text style={styles.kpiValue}>{stats?.activeCustomers || 0}</Text>
              <Text style={styles.kpiSub}>{stats?.activeLoans || 0} active loan accounts</Text>
            </View>

            {/* Today's Due */}
            <View style={styles.kpiCard}>
              <View style={styles.kpiTopRow}>
                <Text style={[styles.kpiLabel, { color: todayDueAmount > 0 ? '#b45309' : '#64748b' }]}>SCHEDULED DUE</Text>
                <View style={[styles.kpiIconCircle, { backgroundColor: todayDueAmount > 0 ? '#fef3c7' : '#eff6ff' }]}>
                  <Ionicons name="calendar" size={15} color={todayDueAmount > 0 ? '#b45309' : '#2563eb'} />
                </View>
              </View>
              <Text style={[styles.kpiValue, todayDueAmount > 0 ? { color: '#b45309' } : {}]}>{fmt(todayDueAmount)}</Text>
              <Text style={styles.kpiSub}>{todayDueCount} installments scheduled</Text>
            </View>

            {/* Collection Efficiency Gauge Card */}
            <View style={[styles.kpiCard, { width: '100%' }]}>
              <View style={styles.kpiTopRow}>
                <Text style={[styles.kpiLabel, { color: '#059669' }]}>COLLECTION EFFICIENCY</Text>
                <View style={[styles.kpiIconCircle, { backgroundColor: '#ecfdf5' }]}>
                  <Ionicons name="speedometer" size={15} color="#059669" />
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                <Text style={[styles.kpiValue, { color: '#059669' }]}>{effPercent}%</Text>
                <Text style={styles.kpiSub}>on-time recovery yield</Text>
              </View>
              {/* Progress bar */}
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${Math.min(100, effPercent)}%` }]} />
              </View>
            </View>
          </View>

          {/* Quick Actions (Matching Web) */}
          <Text style={styles.sectionHeader}>Quick Operations</Text>
          <View style={styles.quickGrid}>
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
              onPress={() => onNavigateTab('profile')}
              activeOpacity={0.7}
            >
              <View style={[styles.quickIconCircle, { backgroundColor: '#f5f3ff' }]}>
                <Ionicons name="wifi" size={18} color="#7c3aed" />
              </View>
              <Text style={styles.quickTitle}>Cloud Sync</Text>
              <Text style={styles.quickSub}>Server & Wi-Fi IP</Text>
            </TouchableOpacity>
          </View>

          {/* Recent Loans Disbursed (Real Live Data matching Web 1:1) */}
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionHeader}>Recent Loans Disbursed</Text>
            <TouchableOpacity onPress={() => onNavigateTab('loans')}>
              <Text style={styles.viewAllText}>View All →</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.cardContainer}>
            {(!stats?.recentLoans || stats.recentLoans.length === 0) ? (
              <View style={{ padding: 24, alignItems: 'center' }}>
                <Ionicons name="documents-outline" size={28} color="#94a3b8" style={{ marginBottom: 6 }} />
                <Text style={{ fontSize: 13, color: '#94a3b8', fontWeight: '500' }}>No loans sanctioned yet.</Text>
              </View>
            ) : (
              stats.recentLoans.slice(0, 5).map((loan: any, idx: number) => {
                const borrowerName = loan.customer?.name || 'Borrower';
                const initial = borrowerName.charAt(0).toUpperCase();
                const isDisbursed = loan.status === 'disbursed' || loan.status === 'active';
                const isCompleted = loan.status === 'completed' || loan.status === 'paid';
                return (
                  <React.Fragment key={loan.id}>
                    {idx > 0 && <View style={styles.divider} />}
                    <View style={styles.loanRow}>
                      <View style={[styles.avatarCircle, { backgroundColor: isDisbursed ? '#e0f2fe' : '#f1f5f9' }]}>
                        <Text style={[styles.avatarInitial, { color: isDisbursed ? '#0369a1' : '#475569' }]}>
                          {initial}
                        </Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.borrowerTitle}>{borrowerName}</Text>
                        <Text style={styles.loanMeta}>#LN{1000 + loan.id} · {(loan.type || 'Personal').toUpperCase()}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.loanAmount}>₹{Number(loan.amount || 0).toLocaleString('en-IN')}</Text>
                        <View style={[
                          styles.statusTag,
                          isDisbursed ? { backgroundColor: '#ecfdf5' } : isCompleted ? { backgroundColor: '#eff6ff' } : { backgroundColor: '#fef3c7' }
                        ]}>
                          <Text style={[
                            styles.statusTagText,
                            isDisbursed ? { color: '#15803d' } : isCompleted ? { color: '#2563eb' } : { color: '#b45309' }
                          ]}>
                            {loan.status ? (loan.status.charAt(0).toUpperCase() + loan.status.slice(1)) : 'Active'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </React.Fragment>
                );
              })
            )}
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
    paddingBottom: 40
  },
  brandHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  brandLogo: {
    width: 38,
    height: 38,
    borderRadius: 10
  },
  companyName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.5
  },
  companySub: {
    fontSize: 11,
    color: '#64748b'
  },
  serverSyncBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1
  },
  serverSyncLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1
  },
  livePulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981'
  },
  serverSyncText: {
    fontSize: 11,
    color: '#475569'
  },
  refreshSyncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#eff6ff'
  },
  refreshSyncText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb'
  },
  welcomeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16
  },
  welcomeText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4
  },
  welcomeSub: {
    fontSize: 12,
    color: '#94a3b8'
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12
  },
  userAvatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff'
  },
  loadingBox: {
    padding: 40,
    alignItems: 'center'
  },
  loadingText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 10
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1e293b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 6
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
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1
  },
  kpiTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.3
  },
  kpiIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center'
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 2
  },
  kpiSub: {
    fontSize: 10,
    color: '#94a3b8'
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 3,
    marginTop: 8,
    overflow: 'hidden'
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 3
  },
  quickGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16
  },
  quickCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1
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
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center'
  },
  quickSub: {
    fontSize: 9,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 1
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  viewAllText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb'
  },
  cardContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1
  },
  loanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarInitial: {
    fontSize: 15,
    fontWeight: '800'
  },
  borrowerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a'
  },
  loanMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2
  },
  loanAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 2
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  statusTagText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9'
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#a7f3d0'
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginRight: 4
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065f46'
  },
  modeSwitchHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 5
  },
  modeSwitchHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
    marginHorizontal: 3
  }
});
