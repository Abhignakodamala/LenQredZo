import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView
} from 'react-native';
import { User } from '../types';
import { getApiUrl, setApiUrl, DEFAULT_API_URL } from '../config';

interface ProfileScreenProps {
  user: User;
  onLogout: () => void;
}

export default function ProfileScreen({ user, onLogout }: ProfileScreenProps) {
  const [apiUrl, setApiUrlState] = useState('');
  const [savingUrl, setSavingUrl] = useState(false);

  useEffect(() => {
    getApiUrl().then(setApiUrlState);
  }, []);

  const handleSaveApiUrl = async () => {
    if (!apiUrl.trim()) {
      Alert.alert('Invalid URL', 'Please enter a valid backend API URL.');
      return;
    }
    setSavingUrl(true);
    try {
      await setApiUrl(apiUrl.trim());
      Alert.alert('✓ Saved', 'Backend API endpoint updated successfully.');
    } catch {
      Alert.alert('Error', 'Failed to save API URL.');
    } finally {
      setSavingUrl(false);
    }
  };

  const handleResetApiUrl = async () => {
    setApiUrlState(DEFAULT_API_URL);
    await setApiUrl(DEFAULT_API_URL);
    Alert.alert('Reset', `API endpoint reset to default: ${DEFAULT_API_URL}`);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Agent Profile</Text>
        <Text style={styles.headerSub}>LenQredzo Mobile Collection Portal</Text>
      </View>

      {/* User Info Card */}
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user.name || 'A').charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.userName}>{user.name}</Text>
        <Text style={styles.userEmail}>{user.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{user.role.toUpperCase()}</Text>
        </View>
      </View>

      {/* Branch & Details Card */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Shift & Assignment Details</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Company ID</Text>
          <Text style={styles.rowValue}>#{user.companyId}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Designation</Text>
          <Text style={styles.rowValue}>Field Collection Agent</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Attendance Status</Text>
          <Text style={[styles.rowValue, { color: '#16a34a' }]}>✓ Logged In (Photo Verified)</Text>
        </View>
      </View>

      {/* Server API URL Config */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>⚙️ Backend Server Endpoint</Text>
        <Text style={styles.configDesc}>
          Set this to your laptop's local IP (e.g. http://192.168.x.x:5000) or public API endpoint.
        </Text>
        <TextInput
          value={apiUrl}
          onChangeText={setApiUrlState}
          placeholder="http://192.168.0.186:5000"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveApiUrl} disabled={savingUrl}>
            <Text style={styles.saveBtnText}>Save URL</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.resetBtn} onPress={handleResetApiUrl}>
            <Text style={styles.resetBtnText}>Reset Default</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Logout Action */}
      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={() => {
          Alert.alert(
            'Confirm Sign Out',
            'Are you sure you want to end your shift and log out?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Log Out', style: 'destructive', onPress: onLogout }
            ]
          );
        }}
      >
        <Text style={styles.logoutText}>🚪 End Shift & Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  content: {
    paddingBottom: 32
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: '#ffffff',
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
  card: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
    alignItems: 'center'
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1e40af',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800'
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a'
  },
  userEmail: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2
  },
  roleBadge: {
    marginTop: 10,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe'
  },
  roleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1d4ed8'
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    alignSelf: 'flex-start',
    marginBottom: 12
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 8
  },
  rowLabel: {
    fontSize: 13,
    color: '#64748b'
  },
  rowValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a'
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    width: '100%'
  },
  configDesc: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 16,
    marginBottom: 10,
    alignSelf: 'flex-start'
  },
  input: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 10
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%'
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#1e40af',
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center'
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '700'
  },
  resetBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center'
  },
  resetBtnText: {
    color: '#475569',
    fontSize: 12.5,
    fontWeight: '600'
  },
  logoutBtn: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    marginHorizontal: 16,
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center'
  },
  logoutText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '700'
  }
});
