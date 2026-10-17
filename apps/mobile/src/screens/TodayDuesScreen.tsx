import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Linking,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EMIItem, User } from '../types';
import { fetchAllCollections, isDateToday, isDateOverdue } from '../services/collections';
import CollectModal from './CollectModal';

interface TodayDuesScreenProps {
  user: User;
  onSwitchToExecutiveMode?: () => void;
}

type TabType = 'today' | 'overdue' | 'collected' | 'all';

export default function TodayDuesScreen({ user, onSwitchToExecutiveMode }: TodayDuesScreenProps) {
  const [emis, setEmis] = useState<EMIItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('today');
  const [selectedEmi, setSelectedEmi] = useState<EMIItem | null>(null);

  const loadData = useCallback(async () => {
    try {
      const data = await fetchAllCollections();
      setEmis(data);
    } catch (err: any) {
      console.warn('Failed to load collections:', err);
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

  // Filter items according to active tab & search
  const filteredEmis = useMemo(() => {
    return emis.filter(item => {
      const status = item.status;
      const isToday = isDateToday(item.dueDate);
      const isOver = isDateOverdue(item.dueDate, status);

      // Tab filter
      if (activeTab === 'today') {
        if (!isToday && !isOver) return false;
        if (status === 'paid') return false;
      } else if (activeTab === 'overdue') {
        if (!isOver) return false;
      } else if (activeTab === 'collected') {
        if (status !== 'paid') return false;
      }

      // Search filter
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const name = (item.customerName || item.loan?.customer?.name || '').toLowerCase();
      const phone = (item.customerPhone || item.loan?.customer?.phone || '').toLowerCase();
      const loanId = `ln${1000 + item.loanId}`;
      return name.includes(q) || phone.includes(q) || loanId.includes(q);
    });
  }, [emis, activeTab, search]);

  // Tab counts
  const tabCounts = useMemo(() => {
    let today = 0;
    let overdue = 0;
    let collected = 0;
    let all = emis.length;

    emis.forEach(e => {
      const isToday = isDateToday(e.dueDate);
      const isOver = isDateOverdue(e.dueDate, e.status);
      if ((isToday || isOver) && e.status !== 'paid') today += 1;
      if (isOver) overdue += 1;
      if (e.status === 'paid') collected += 1;
    });

    return { today, overdue, collected, all };
  }, [emis]);

  // Summary Metrics
  const stats = useMemo(() => {
    let todayTarget = 0;
    let todayCollected = 0;
    let pendingCount = 0;

    emis.forEach(e => {
      const isToday = isDateToday(e.dueDate);
      const isOver = isDateOverdue(e.dueDate, e.status);
      if (isToday || isOver) {
        todayTarget += e.amount;
        if (e.status === 'paid') {
          todayCollected += (e.paidAmount || e.amount);
        } else {
          pendingCount += 1;
        }
      }
    });

    return { todayTarget, todayCollected, pendingCount };
  }, [emis]);

  const handleCall = (phone: string) => {
    if (!phone) {
      Alert.alert('No Phone', 'No contact number available for this borrower.');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  const handleWhatsApp = (phone: string, customerName: string, amount: number) => {
    if (!phone) {
      Alert.alert('No Phone', 'No contact number available for this borrower.');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const msg = encodeURIComponent(
      `Hello ${customerName}, this is ${user.name} from LenQredzo. Your EMI payment of ₹${amount.toLocaleString('en-IN')} is scheduled for collection. Please keep it ready or tap to pay via UPI.`
    );
    Linking.openURL(`https://wa.me/${fullPhone}?text=${msg}`);
  };

  const renderEmiCard = ({ item }: { item: EMIItem }) => {
    const isPaid = item.status === 'paid';
    const isOver = isDateOverdue(item.dueDate, item.status);
    const customer = item.loan?.customer;
    const borrowerName = item.customerName || customer?.name || `Borrower #LN${1000 + item.loanId}`;
    const borrowerPhone = item.customerPhone || customer?.phone || '';
    const borrowerAddress = item.customerAddress || customer?.address || '';
    const dueAmount = item.remaining !== undefined ? item.remaining : (item.amount - (item.paidAmount || 0));

    return (
      <View style={styles.card}>
        {/* Top Card Row */}
        <View style={styles.cardTopRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(borrowerName || 'B').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.customerName}>{borrowerName}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <View style={styles.loanBadge}>
                <Text style={styles.loanBadgeText}>#LN{1000 + item.loanId}</Text>
              </View>
              {borrowerPhone ? (
                <Text style={styles.phoneSub}>{borrowerPhone}</Text>
              ) : null}
            </View>
          </View>

          {/* Status Badge */}
          <View style={[styles.statusBadge, isPaid ? styles.statusPaid : isOver ? styles.statusOverdue : styles.statusDue]}>
            <View style={[styles.statusDot, isPaid ? styles.dotPaid : isOver ? styles.dotOverdue : styles.dotDue]} />
            <Text style={[styles.statusBadgeText, isPaid ? styles.statusPaidText : isOver ? styles.statusOverdueText : styles.statusDueText]}>
              {isPaid ? 'Paid' : isOver ? 'Overdue' : 'Due Today'}
            </Text>
          </View>
        </View>

        {/* Due & Date Block */}
        <View style={styles.amountBox}>
          <View>
            <Text style={styles.amountLabel}>Outstanding Due</Text>
            <Text style={styles.amountValue}>₹{dueAmount.toLocaleString('en-IN')}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.dateLabel}>Due Date</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <Ionicons name="calendar-outline" size={13} color="#64748b" />
              <Text style={styles.dateValue}>
                {new Date(item.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
              </Text>
            </View>
          </View>
        </View>

        {/* Address if available */}
        {borrowerAddress ? (
          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={13} color="#94a3b8" />
            <Text style={styles.addressText} numberOfLines={1}>
              {borrowerAddress}
            </Text>
          </View>
        ) : null}

        {/* Action Buttons Row */}
        <View style={styles.actionRow}>
          {borrowerPhone ? (
            <>
              <TouchableOpacity
                style={styles.actionPill}
                onPress={() => handleCall(borrowerPhone)}
                activeOpacity={0.7}
              >
                <Ionicons name="call" size={14} color="#2563eb" />
                <Text style={styles.actionPillText}>Call</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionPill, styles.waPill]}
                onPress={() => handleWhatsApp(borrowerPhone, borrowerName, dueAmount)}
                activeOpacity={0.7}
              >
                <Ionicons name="logo-whatsapp" size={14} color="#16a34a" />
                <Text style={[styles.actionPillText, { color: '#16a34a' }]}>WhatsApp</Text>
              </TouchableOpacity>
            </>
          ) : null}

          {!isPaid ? (
            <TouchableOpacity
              style={styles.collectBtn}
              onPress={() => setSelectedEmi(item)}
              activeOpacity={0.85}
            >
              <Ionicons name="wallet-outline" size={15} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.collectBtnText}>Collect ₹{dueAmount.toLocaleString('en-IN')}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.clearedBadge}>
              <Ionicons name="checkmark-circle" size={15} color="#16a34a" style={{ marginRight: 4 }} />
              <Text style={styles.clearedText}>Collected</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <View style={styles.agentInfoRow}>
          <View style={styles.agentAvatar}>
            <Text style={styles.agentAvatarText}>{(user.name || 'A').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.greeting}>Hello, {user.name} 👋</Text>
            <Text style={styles.shiftText}>
              {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })} · Field Shift
            </Text>
          </View>
          {onSwitchToExecutiveMode ? (
            <TouchableOpacity
              style={styles.modeSwitchHeaderBtn}
              onPress={onSwitchToExecutiveMode}
              activeOpacity={0.7}
            >
              <Ionicons name="pie-chart" size={13} color="#2563eb" />
              <Text style={styles.modeSwitchHeaderText}>Executive</Text>
              <Ionicons name="swap-horizontal" size={12} color="#2563eb" style={{ marginLeft: 2 }} />
            </TouchableOpacity>
          ) : (
            <View style={styles.shiftBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.shiftBadgeText}>Active</Text>
            </View>
          )}
        </View>

        {/* 3 Metrics KPI Cards */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconCircle, { backgroundColor: '#eff6ff' }]}>
              <Ionicons name="flag" size={14} color="#2563eb" />
            </View>
            <Text style={styles.kpiLabel}>TARGET</Text>
            <Text style={styles.kpiValue}>₹{stats.todayTarget.toLocaleString('en-IN')}</Text>
          </View>

          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconCircle, { backgroundColor: '#ecfdf5' }]}>
              <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
            </View>
            <Text style={[styles.kpiLabel, { color: '#16a34a' }]}>COLLECTED</Text>
            <Text style={[styles.kpiValue, { color: '#15803d' }]}>₹{stats.todayCollected.toLocaleString('en-IN')}</Text>
          </View>

          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconCircle, { backgroundColor: '#fef2f2' }]}>
              <Ionicons name="time" size={14} color="#dc2626" />
            </View>
            <Text style={[styles.kpiLabel, { color: '#dc2626' }]}>PENDING</Text>
            <Text style={[styles.kpiValue, { color: '#b91c1c' }]}>{stats.pendingCount}</Text>
          </View>
        </View>
      </View>

      {/* Filter Segment Tabs */}
      <View style={styles.tabsContainer}>
        {[
          { id: 'today', label: 'Due Today', count: tabCounts.today },
          { id: 'overdue', label: 'Overdue', count: tabCounts.overdue },
          { id: 'collected', label: 'Collected', count: tabCounts.collected },
          { id: 'all', label: 'All', count: tabCounts.all }
        ].map(t => {
          const isActive = activeTab === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              style={[styles.tabChip, isActive && styles.tabChipActive]}
              onPress={() => setActiveTab(t.id as TabType)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabChipText, isActive && styles.tabChipTextActive]}>
                {t.label}
              </Text>
              {t.count > 0 && (
                <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
                    {t.count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Modern Search Bar */}
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by borrower, phone or loan ID..."
          placeholderTextColor="#94a3b8"
          style={styles.searchInput}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={16} color="#94a3b8" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Dues List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading assigned collection dues...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredEmis}
          keyExtractor={item => String(item.id)}
          renderItem={renderEmiCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="checkmark-done-circle-outline" size={42} color="#16a34a" />
              </View>
              <Text style={styles.emptyTitle}>All Caught Up!</Text>
              <Text style={styles.emptySub}>
                {search ? 'No matching borrowers found for your search.' : 'No pending collections in this category.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Payment Collection Bottom Sheet */}
      {selectedEmi && (
        <CollectModal
          visible={!!selectedEmi}
          emi={selectedEmi}
          user={user}
          onClose={() => setSelectedEmi(null)}
          onSuccess={() => {
            setSelectedEmi(null);
            loadData();
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  topHeader: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9'
  },
  agentInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14
  },
  agentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3
  },
  agentAvatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800'
  },
  greeting: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a'
  },
  shiftText: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 1,
    fontWeight: '500'
  },
  shiftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1fae5',
    gap: 5
  },
  modeSwitchHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    gap: 4
  },
  modeSwitchHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1d4ed8'
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a'
  },
  shiftBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803d'
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  kpiIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4
  },
  kpiLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5
  },
  kpiValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 6
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 4
  },
  tabChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb'
  },
  tabChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569'
  },
  tabChipTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  tabBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)'
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569'
  },
  tabBadgeTextActive: {
    color: '#ffffff'
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    height: '100%'
  },
  listContent: {
    padding: 16,
    paddingTop: 4,
    gap: 12
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#dbeafe'
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2563eb'
  },
  customerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a'
  },
  loanBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  loanBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569'
  },
  phoneSub: {
    fontSize: 11,
    color: '#64748b'
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5
  },
  dotPaid: { backgroundColor: '#16a34a' },
  dotOverdue: { backgroundColor: '#dc2626' },
  dotDue: { backgroundColor: '#d97706' },
  statusPaid: { backgroundColor: '#ecfdf5' },
  statusPaidText: { color: '#15803d', fontSize: 11, fontWeight: '700' },
  statusOverdue: { backgroundColor: '#fef2f2' },
  statusOverdueText: { color: '#b91c1c', fontSize: 11, fontWeight: '700' },
  statusDue: { backgroundColor: '#fffbeb' },
  statusDueText: { color: '#b45309', fontSize: 11, fontWeight: '700' },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  amountBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9'
  },
  amountLabel: {
    fontSize: 10.5,
    color: '#64748b',
    fontWeight: '600'
  },
  amountValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1e3a8a',
    marginTop: 1
  },
  dateLabel: {
    fontSize: 10.5,
    color: '#64748b',
    fontWeight: '600'
  },
  dateValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155'
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
    paddingHorizontal: 2
  },
  addressText: {
    fontSize: 11.5,
    color: '#64748b',
    flex: 1
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: '#f1f5f9'
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    gap: 4
  },
  waPill: {
    backgroundColor: '#ecfdf5'
  },
  actionPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#2563eb'
  },
  collectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 8,
    borderRadius: 10,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2
  },
  collectBtnText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '700'
  },
  clearedBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    paddingVertical: 8,
    borderRadius: 10
  },
  clearedText: {
    color: '#16a34a',
    fontSize: 12,
    fontWeight: '700'
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    marginTop: 10,
    color: '#64748b',
    fontSize: 13
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a'
  },
  emptySub: {
    fontSize: 12.5,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17
  }
});
