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
import { LoanItem } from '../types';
import { fetchLoans } from '../services/collections';

export default function LoansScreen() {
  const [loans, setLoans] = useState<LoanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disbursed' | 'completed'>('all');

  const loadData = useCallback(async () => {
    try {
      const data = await fetchLoans();
      setLoans(data);
    } catch (err) {
      console.warn('Failed to load loans:', err);
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

  const filteredLoans = useMemo(() => {
    return loans.filter(l => {
      // Filter status
      if (statusFilter !== 'all') {
        if (l.status.toLowerCase() !== statusFilter) return false;
      }

      // Filter search
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const name = (l.customer?.name || '').toLowerCase();
      const phone = (l.customer?.phone || '').toLowerCase();
      const loanId = `ln${1000 + l.id}`;
      return name.includes(q) || phone.includes(q) || loanId.includes(q);
    });
  }, [loans, statusFilter, search]);

  const handleCall = (phone?: string) => {
    if (!phone) {
      Alert.alert('No Phone', 'No contact number available.');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  const handleWhatsApp = (phone?: string, name?: string) => {
    if (!phone) {
      Alert.alert('No Phone', 'No contact number available.');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const msg = encodeURIComponent(`Hello ${name || 'Customer'}, this is regarding your loan with LenQredzo.`);
    Linking.openURL(`https://wa.me/${fullPhone}?text=${msg}`);
  };

  const renderLoanCard = ({ item }: { item: LoanItem }) => {
    const isCompleted = item.status === 'completed';
    const isDisbursed = item.status === 'disbursed' || item.status === 'active';

    return (
      <View style={styles.card}>
        <View style={styles.topRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(item.customer?.name || 'L').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.borrowerName}>{item.customer?.name || 'Borrower'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <View style={styles.loanBadge}>
                <Text style={styles.loanBadgeText}>#LN{1000 + item.id}</Text>
              </View>
              <Text style={styles.typeText}>{item.type || 'Personal Loan'}</Text>
            </View>
          </View>

          <View style={[styles.statusBadge, isCompleted ? styles.statusCompleted : isDisbursed ? styles.statusDisbursed : styles.statusPending]}>
            <Text style={[styles.statusText, isCompleted ? styles.textCompleted : isDisbursed ? styles.textDisbursed : styles.textPending]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.amountBox}>
          <View>
            <Text style={styles.amountLabel}>Principal Disbursed</Text>
            <Text style={styles.amountValue}>₹{item.amount.toLocaleString('en-IN')}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.amountLabel}>Tenure / Frequency</Text>
            <Text style={styles.tenureValue}>{item.tenure || 12} Months · {item.frequency || 'Monthly'}</Text>
          </View>
        </View>

        {item.customer?.phone && (
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleCall(item.customer?.phone)}
              activeOpacity={0.7}
            >
              <Ionicons name="call" size={13} color="#2563eb" />
              <Text style={styles.actionBtnText}>Call</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.waBtn]}
              onPress={() => handleWhatsApp(item.customer?.phone, item.customer?.name)}
              activeOpacity={0.7}
            >
              <Ionicons name="logo-whatsapp" size={13} color="#16a34a" />
              <Text style={[styles.actionBtnText, { color: '#16a34a' }]}>WhatsApp</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>All Loans Portfolio</Text>
        <Text style={styles.headerSub}>{loans.length} total loan accounts registered</Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsRow}>
        {(['all', 'disbursed', 'completed'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.tabChip, statusFilter === f && styles.tabChipActive]}
            onPress={() => setStatusFilter(f)}
          >
            <Text style={[styles.tabChipText, statusFilter === f && styles.tabChipTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search Input */}
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by borrower name, phone or loan ID..."
          placeholderTextColor="#94a3b8"
          style={styles.input}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color="#94a3b8" />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading loans...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredLoans}
          keyExtractor={item => String(item.id)}
          renderItem={renderLoanCard}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="document-text-outline" size={36} color="#94a3b8" />
              <Text style={styles.emptyTitle}>No loans found</Text>
              <Text style={styles.emptySub}>No loan accounts match your active search filter.</Text>
            </View>
          }
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
  header: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a'
  },
  headerSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 8
  },
  tabChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0'
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
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  input: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    height: '100%'
  },
  list: {
    padding: 16,
    paddingTop: 8,
    gap: 12
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#2563eb'
  },
  borrowerName: {
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
  typeText: {
    fontSize: 11,
    color: '#64748b'
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8
  },
  statusCompleted: { backgroundColor: '#eff6ff' },
  textCompleted: { color: '#2563eb', fontSize: 10, fontWeight: '800' },
  statusDisbursed: { backgroundColor: '#ecfdf5' },
  textDisbursed: { color: '#15803d', fontSize: 10, fontWeight: '800' },
  statusPending: { backgroundColor: '#fffbeb' },
  textPending: { color: '#b45309', fontSize: 10, fontWeight: '800' },
  statusText: { fontSize: 10, fontWeight: '800' },
  amountBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginTop: 12
  },
  amountLabel: {
    fontSize: 10.5,
    color: '#64748b',
    fontWeight: '600'
  },
  amountValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2
  },
  tenureValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
    marginTop: 2
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#f1f5f9'
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#eff6ff',
    paddingVertical: 8,
    borderRadius: 10
  },
  waBtn: {
    backgroundColor: '#ecfdf5'
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb'
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingText: {
    marginTop: 10,
    color: '#64748b',
    fontSize: 13
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 48
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 8
  },
  emptySub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2
  }
});
