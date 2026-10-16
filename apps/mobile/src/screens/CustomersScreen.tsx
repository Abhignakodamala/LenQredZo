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
import { Customer } from '../types';
import { fetchAllCustomers } from '../services/collections';

export default function CustomersScreen() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    try {
      const data = await fetchAllCustomers();
      setCustomers(data);
    } catch (err: any) {
      console.warn('Failed to load customers:', err);
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

  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(c => {
      const name = (c.name || '').toLowerCase();
      const phone = (c.phone || '').toLowerCase();
      const city = (c.city || '').toLowerCase();
      return name.includes(q) || phone.includes(q) || city.includes(q);
    });
  }, [customers, search]);

  const handleCall = (phone: string) => {
    if (!phone) {
      Alert.alert('No Phone', 'No contact number available.');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  const handleWhatsApp = (phone: string, name: string) => {
    if (!phone) {
      Alert.alert('No Phone', 'No contact number available.');
      return;
    }
    const clean = phone.replace(/\D/g, '');
    const full = clean.length === 10 ? `91${clean}` : clean;
    const msg = encodeURIComponent(`Hello ${name}, this is your LenQredzo loan officer.`);
    Linking.openURL(`https://wa.me/${full}?text=${msg}`);
  };

  const renderItem = ({ item }: { item: Customer }) => {
    const kyc = item.kycStatus || 'pending';

    return (
      <View style={styles.card}>
        <View style={styles.topRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(item.name || 'C').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.phone}>{item.phone}</Text>
          </View>
          <View style={[styles.kycBadge, kyc === 'verified' ? styles.kycVerified : styles.kycPending]}>
            <Text style={[styles.kycText, kyc === 'verified' ? styles.kycVerifiedText : styles.kycPendingText]}>
              {kyc === 'verified' ? '✓ KYC' : 'KYC Pending'}
            </Text>
          </View>
        </View>

        {item.address ? (
          <Text style={styles.addressText} numberOfLines={2}>
            📍 {item.address}{item.city ? `, ${item.city}` : ''}
          </Text>
        ) : null}

        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleCall(item.phone)}>
            <Text style={styles.actionIcon}>📞</Text>
            <Text style={styles.actionText}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.waBtn]} onPress={() => handleWhatsApp(item.phone, item.name)}>
            <Text style={styles.actionIcon}>💬</Text>
            <Text style={[styles.actionText, { color: '#059669' }]}>WhatsApp</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Borrower Directory</Text>
        <Text style={styles.sub}>{customers.length} registered borrowers</Text>
      </View>

      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, phone or city..."
          style={styles.input}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.clear}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1e40af" />
          <Text style={styles.loadText}>Loading borrowers...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredCustomers}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>👥</Text>
              <Text style={styles.emptyText}>No customers found</Text>
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0'
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a'
  },
  sub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8
  },
  input: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a'
  },
  clear: {
    fontSize: 14,
    color: '#94a3b8',
    padding: 4
  },
  list: {
    padding: 16,
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
  topRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1e40af',
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700'
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a'
  },
  phone: {
    fontSize: 12.5,
    color: '#64748b',
    marginTop: 2
  },
  kycBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  kycText: {
    fontSize: 11,
    fontWeight: '700'
  },
  kycVerified: {
    backgroundColor: '#dcfce7'
  },
  kycVerifiedText: {
    color: '#15803d',
    fontSize: 11,
    fontWeight: '700'
  },
  kycPending: {
    backgroundColor: '#fef3c7'
  },
  kycPendingText: {
    color: '#92400e',
    fontSize: 11,
    fontWeight: '700'
  },
  addressText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 10,
    lineHeight: 16
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
    backgroundColor: '#f1f5f9',
    paddingVertical: 8,
    borderRadius: 8
  },
  waBtn: {
    backgroundColor: '#ecfdf5'
  },
  actionIcon: {
    fontSize: 13
  },
  actionText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155'
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadText: {
    marginTop: 10,
    color: '#64748b',
    fontSize: 13
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 40
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600'
  }
});
