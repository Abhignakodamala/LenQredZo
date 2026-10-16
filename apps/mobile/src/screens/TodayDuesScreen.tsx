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
import { EMIItem, User } from '../types';
import { fetchAllCollections, isDateToday, isDateOverdue } from '../services/collections';
import CollectModal from './CollectModal';

interface TodayDuesScreenProps {
  user: User;
}

type TabType = 'today' | 'overdue' | 'collected' | 'all';

export default function TodayDuesScreen({ user }: TodayDuesScreenProps) {
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
      const name = (item.loan?.customer?.name || '').toLowerCase();
      const phone = (item.loan?.customer?.phone || '').toLowerCase();
      const loanId = `ln${1000 + item.loanId}`;
      return name.includes(q) || phone.includes(q) || loanId.includes(q);
    });
  }, [emis, activeTab, search]);

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
    const dueAmount = item.amount - (item.paidAmount || 0);

    return (
      <View style={styles.card}>
        {/* Top Card Row */}
        <View style={styles.cardTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.customerName}>{customer?.name || 'Borrower'}</Text>
            <Text style={styles.loanIdText}>Loan #LN{1000 + item.loanId}</Text>
          </View>
          <View style={[styles.statusBadge, isPaid ? styles.statusPaid : isOver ? styles.statusOverdue : styles.statusDue]}>
            <Text style={[styles.statusBadgeText, isPaid ? styles.statusPaidText : isOver ? styles.statusOverdueText : styles.statusDueText]}>
              {isPaid ? '✓ Paid' : isOver ? '⚠ Overdue' : 'Due Today'}
            </Text>
          </View>
        </View>

        {/* Due & Date Details */}
        <View style={styles.amountRow}>
          <View>
            <Text style={styles.amountLabel}>Due Amount</Text>
            <Text style={styles.amountValue}>₹{dueAmount.toLocaleString('en-IN')}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.dateLabel}>Due Date</Text>
            <Text style={styles.dateValue}>
              {new Date(item.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
            </Text>
          </View>
        </View>

        {/* Action Buttons Row */}
        <View style={styles.actionRow}>
          {customer?.phone && (
            <>
              <TouchableOpacity style={styles.iconBtn} onPress={() => handleCall(customer.phone)}>
                <Text style={styles.btnIcon}>📞</Text>
                <Text style={styles.iconBtnText}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconBtn, styles.waBtn]} onPress={() => handleWhatsApp(customer.phone, customer.name, dueAmount)}>
                <Text style={styles.btnIcon}>💬</Text>
                <Text style={[styles.iconBtnText, { color: '#059669' }]}>WhatsApp</Text>
              </TouchableOpacity>
            </>
          )}

          {!isPaid ? (
            <TouchableOpacity
              style={styles.collectBtn}
              onPress={() => setSelectedEmi(item)}
            >
              <Text style={styles.collectBtnText}>💵 Collect EMI</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.clearedBadge}>
              <Text style={styles.clearedText}>✓ Collected</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Banner */}
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.greeting}>Hello, {user.name} 👋</Text>
          <Text style={styles.shiftText}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}
          </Text>
        </View>
        <View style={styles.branchPill}>
          <Text style={styles.branchPillText}>Field Agent</Text>
        </View>
      </View>

      {/* Summary KPI Strip */}
      <View style={styles.kpiContainer}>
        <View style={styles.kpiItem}>
          <Text style={styles.kpiLabel}>Today's Target</Text>
          <Text style={styles.kpiValue}>₹{stats.todayTarget.toLocaleString('en-IN')}</Text>
        </View>
        <View style={styles.kpiDivider} />
        <View style={styles.kpiItem}>
          <Text style={[styles.kpiLabel, { color: '#16a34a' }]}>Collected</Text>
          <Text style={[styles.kpiValue, { color: '#15803d' }]}>₹{stats.todayCollected.toLocaleString('en-IN')}</Text>
        </View>
        <View style={styles.kpiDivider} />
        <View style={styles.kpiItem}>
          <Text style={[styles.kpiLabel, { color: '#dc2626' }]}>Pending</Text>
          <Text style={[styles.kpiValue, { color: '#b91c1c' }]}>{stats.pendingCount}</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsRow}>
        {[
          { id: 'today', label: 'Due Today' },
          { id: 'overdue', label: 'Overdue' },
          { id: 'collected', label: 'Collected' },
          { id: 'all', label: 'All' }
        ].map(t => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tabBtn, activeTab === t.id && styles.tabBtnActive]}
            onPress={() => setActiveTab(t.id as TabType)}
          >
            <Text style={[styles.tabText, activeTab === t.id && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search Input */}
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search borrower by name, phone or loan ID..."
          style={styles.searchInput}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.clearSearch}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Dues List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1e40af" />
          <Text style={styles.loadingText}>Loading assigned dues...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredEmis}
          keyExtractor={item => String(item.id)}
          renderItem={renderEmiCard}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={{ fontSize: 36, marginBottom: 8 }}>🎉</Text>
              <Text style={styles.emptyTitle}>No pending dues found</Text>
              <Text style={styles.emptySub}>
                {search ? 'Try adjusting your search criteria.' : 'All collections for this filter are complete.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Payment Collection Sheet Modal */}
      {selectedEmi && (
        <CollectModal
          visible={!!selectedEmi}
          emi={selectedEmi}
          onClose={() => setSelectedEmi(null)}
          onSuccess={loadData}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0'
  },
  greeting: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a'
  },
  shiftText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2
  },
  branchPill: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe'
  },
  branchPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1d4ed8'
  },
  kpiContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2
  },
  kpiItem: {
    flex: 1,
    alignItems: 'center'
  },
  kpiDivider: {
    width: 1,
    backgroundColor: '#e2e8f0'
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.4
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 4
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 8
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center'
  },
  tabBtnActive: {
    backgroundColor: '#1e40af',
    borderColor: '#1e40af'
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569'
  },
  tabTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a'
  },
  clearSearch: {
    fontSize: 14,
    color: '#94a3b8',
    padding: 4
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
    gap: 12
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  customerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a'
  },
  loanIdText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700'
  },
  statusPaid: {
    backgroundColor: '#dcfce7'
  },
  statusPaidText: {
    color: '#15803d',
    fontSize: 11,
    fontWeight: '700'
  },
  statusOverdue: {
    backgroundColor: '#fee2e2'
  },
  statusOverdueText: {
    color: '#b91c1c',
    fontSize: 11,
    fontWeight: '700'
  },
  statusDue: {
    backgroundColor: '#fef3c7'
  },
  statusDueText: {
    color: '#92400e',
    fontSize: 11,
    fontWeight: '700'
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12
  },
  amountLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600'
  },
  amountValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e3a8a',
    marginTop: 2
  },
  dateLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600'
  },
  dateValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginTop: 2
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  iconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8
  },
  waBtn: {
    backgroundColor: '#ecfdf5'
  },
  btnIcon: {
    fontSize: 13
  },
  iconBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155'
  },
  collectBtn: {
    flex: 1,
    backgroundColor: '#1e40af',
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center'
  },
  collectBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  },
  clearedBadge: {
    flex: 1,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center'
  },
  clearedText: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '700'
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748b'
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4
  },
  emptySub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center'
  }
});
