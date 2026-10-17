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
    return customers.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.city || '').toLowerCase().includes(q)
    );
  }, [customers, search]);

  const handleCall = (phone: string) => {
    if (!phone) {
      Alert.alert('No Phone', 'No contact number registered for this customer.');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  const handleWhatsApp = (phone: string, name: string) => {
    if (!phone) {
      Alert.alert('No Phone', 'No contact number registered for this customer.');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const msg = encodeURIComponent(`Hello ${name}, this is your loan collection agent from LenQredzo.`);
    Linking.openURL(`https://wa.me/${fullPhone}?text=${msg}`);
  };

  const renderItem = ({ item }: { item: Customer }) => {
    const kyc = item.kycStatus || 'pending';
    const isVerified = kyc === 'verified';

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
          <View style={[styles.kycBadge, isVerified ? styles.kycVerified : styles.kycPending]}>
            <Ionicons
              name={isVerified ? 'checkmark-circle' : 'time-outline'}
              size={12}
              color={isVerified ? '#15803d' : '#92400e'}
              style={{ marginRight: 3 }}
            />
            <Text style={[styles.kycText, isVerified ? styles.kycVerifiedText : styles.kycPendingText]}>
              {isVerified ? 'KYC Done' : 'Pending'}
            </Text>
          </View>
        </View>

        {item.address ? (
          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={13} color="#94a3b8" />
            <Text style={styles.addressText} numberOfLines={1}>
              {item.address}{item.city ? `, ${item.city}` : ''}
            </Text>
          </View>
        ) : null}

        <View style={styles.btnRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleCall(item.phone)}
            activeOpacity={0.7}
          >
            <Ionicons name="call" size={14} color="#2563eb" />
            <Text style={styles.actionText}>Call Borrower</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.waBtn]}
            onPress={() => handleWhatsApp(item.phone, item.name)}
            activeOpacity={0.7}
          >
            <Ionicons name="logo-whatsapp" size={14} color="#16a34a" />
            <Text style={[styles.actionText, { color: '#16a34a' }]}>WhatsApp</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Borrower Directory</Text>
          <Text style={styles.sub}>{customers.length} registered borrowers in your branch</Text>
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, phone or city..."
          placeholderTextColor="#94a3b8"
          style={styles.input}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={16} color="#94a3b8" />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadText}>Loading borrowers...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredCustomers}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="people-outline" size={38} color="#94a3b8" />
              </View>
              <Text style={styles.emptyText}>No borrowers found</Text>
              <Text style={styles.emptySub}>Try adjusting your search criteria</Text>
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
    borderColor: '#f1f5f9'
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
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '800'
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8
  },
  kycVerified: {
    backgroundColor: '#ecfdf5'
  },
  kycVerifiedText: {
    color: '#15803d'
  },
  kycPending: {
    backgroundColor: '#fffbeb'
  },
  kycPendingText: {
    color: '#92400e'
  },
  kycText: {
    fontSize: 11,
    fontWeight: '700'
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    paddingHorizontal: 2
  },
  addressText: {
    fontSize: 11.5,
    color: '#64748b',
    flex: 1
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
  actionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb'
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
    paddingVertical: 48
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12
  },
  emptyText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700'
  },
  emptySub: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2
  }
});
