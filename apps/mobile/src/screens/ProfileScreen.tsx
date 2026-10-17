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
import { Ionicons } from '@expo/vector-icons';
import { User } from '../types';
import { getApiUrl, setApiUrl, DEFAULT_API_URL } from '../config';

interface ProfileScreenProps {
  user: User;
  onLogout: () => void;
  appMode?: 'executive' | 'field';
  onToggleMode?: (mode: 'executive' | 'field') => void;
}

export default function ProfileScreen({ user, onLogout, appMode = 'executive', onToggleMode }: ProfileScreenProps) {
  const [apiUrl, setApiUrlState] = useState('');
  const [savingUrl, setSavingUrl] = useState(false);

  const roleNormalized = (user.role || '').toLowerCase().replace(/[\s_-]/g, '');
  const isOwner = ['owner', 'admin', 'superadmin', 'branchmanager', 'manager', 'director'].includes(roleNormalized);

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
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{isOwner ? 'Executive Account & Profile' : 'Agent Profile'}</Text>
        <Text style={styles.headerSub}>LenQredzo Capital · {isOwner ? 'Executive Management' : 'Field Collection Portal'}</Text>
      </View>

      {/* User Info Card */}
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user.name || 'A').charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.userName}>{user.name}</Text>
        <Text style={styles.userEmail}>{user.email}</Text>
        <View style={styles.roleBadge}>
          <Ionicons name={isOwner ? 'ribbon' : 'shield-checkmark'} size={13} color="#2563eb" style={{ marginRight: 4 }} />
          <Text style={styles.roleText}>{user.role.toUpperCase()}</Text>
        </View>
      </View>

      {/* Executive vs Field Mode Switcher Card (For Owners & Admins) */}
      {isOwner && onToggleMode ? (
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Ionicons name="layers-outline" size={17} color="#0f172a" style={{ marginRight: 6 }} />
            <Text style={styles.sectionTitle}>App Experience Mode</Text>
          </View>
          <Text style={styles.configDesc}>
            Switch your mobile interface view between business cockpit and field agent route.
          </Text>

          <View style={styles.modeCardsRow}>
            {/* Executive Mode Card */}
            <TouchableOpacity
              style={[styles.modeCard, appMode === 'executive' && styles.modeCardActive]}
              onPress={() => onToggleMode('executive')}
              activeOpacity={0.75}
            >
              <View style={[styles.modeIconCircle, appMode === 'executive' ? styles.modeIconCircleActive : {}]}>
                <Ionicons name="pie-chart" size={18} color={appMode === 'executive' ? '#2563eb' : '#64748b'} />
              </View>
              <Text style={[styles.modeCardTitle, appMode === 'executive' && styles.modeCardTitleActive]}>
                👑 Executive
              </Text>
              <Text style={styles.modeCardSub}>
                Full KPIs, disbursements, loan portfolio & customer directory.
              </Text>
              {appMode === 'executive' && (
                <View style={styles.modeActivePill}>
                  <Text style={styles.modeActivePillText}>CURRENT ACTIVE</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Field Agent Mode Card */}
            <TouchableOpacity
              style={[styles.modeCard, appMode === 'field' && styles.modeCardActive]}
              onPress={() => onToggleMode('field')}
              activeOpacity={0.75}
            >
              <View style={[styles.modeIconCircle, appMode === 'field' ? styles.modeIconCircleActive : {}]}>
                <Ionicons name="bicycle" size={18} color={appMode === 'field' ? '#16a34a' : '#64748b'} />
              </View>
              <Text style={[styles.modeCardTitle, appMode === 'field' && styles.modeCardTitleFieldActive]}>
                🏍️ Field Route
              </Text>
              <Text style={styles.modeCardSub}>
                Door-to-door dues, 1-tap WhatsApp, calls & photo collections.
              </Text>
              {appMode === 'field' && (
                <View style={[styles.modeActivePill, { backgroundColor: '#ecfdf5' }]}>
                  <Text style={[styles.modeActivePillText, { color: '#16a34a' }]}>CURRENT ACTIVE</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Shift & Details Card */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{isOwner ? 'Organization & Authorization' : 'Shift & Assignment Details'}</Text>

        <View style={styles.detailRow}>
          <View style={styles.iconCircle}>
            <Ionicons name="business-outline" size={16} color="#2563eb" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.detailLabel}>Company & Tenant</Text>
            <Text style={styles.detailValue}>{user.companyName || `Company #${user.companyId}`}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.detailRow}>
          <View style={styles.iconCircle}>
            <Ionicons name="briefcase-outline" size={16} color="#2563eb" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.detailLabel}>Designation</Text>
            <Text style={styles.detailValue}>
              {isOwner ? (user.role === 'branch_manager' ? 'Branch Manager' : 'Executive Owner / Administrator') : 'Field Collection Agent'}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.detailRow}>
          <View style={[styles.iconCircle, { backgroundColor: '#ecfdf5' }]}>
            <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.detailLabel}>Authentication Status</Text>
            <Text style={[styles.detailValue, { color: '#15803d' }]}>
              {isOwner ? 'Authorized Session · All Features Unlocked' : 'Shift Active · Attendance Verified'}
            </Text>
          </View>
        </View>
      </View>

      {/* Server API URL Config */}
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <Ionicons name="server-outline" size={17} color="#0f172a" style={{ marginRight: 6 }} />
          <Text style={styles.sectionTitle}>Backend Server Endpoint</Text>
        </View>
        <Text style={styles.configDesc}>
          Endpoint used for logging collections & selfie uploads.
        </Text>
        <TextInput
          value={apiUrl}
          onChangeText={setApiUrlState}
          placeholder="http://192.168.0.186:5000"
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveApiUrl} disabled={savingUrl} activeOpacity={0.7}>
            <Text style={styles.saveBtnText}>Save Endpoint</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.resetBtn} onPress={handleResetApiUrl} activeOpacity={0.7}>
            <Text style={styles.resetBtnText}>Reset Default</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Logout Action */}
      <TouchableOpacity
        style={styles.logoutBtn}
        activeOpacity={0.85}
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
        <Ionicons name="log-out-outline" size={18} color="#dc2626" style={{ marginRight: 8 }} />
        <Text style={styles.logoutText}>End Shift & Sign Out</Text>
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
    borderColor: '#f1f5f9'
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
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#eff6ff',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#dbeafe'
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#2563eb'
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center'
  },
  userEmail: {
    fontSize: 12.5,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 2
  },
  roleBadge: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#dbeafe',
    alignItems: 'center'
  },
  roleText: {
    color: '#2563eb',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a'
  },
  modeCardsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8
  },
  modeCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    alignItems: 'flex-start'
  },
  modeCardActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff'
  },
  modeIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  modeIconCircleActive: {
    borderColor: '#bfdbfe',
    backgroundColor: '#ffffff'
  },
  modeCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 4
  },
  modeCardTitleActive: {
    color: '#1d4ed8'
  },
  modeCardTitleFieldActive: {
    color: '#15803d'
  },
  modeCardSub: {
    fontSize: 10,
    color: '#64748b',
    lineHeight: 14,
    marginBottom: 8
  },
  modeActivePill: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  modeActivePillText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#1d4ed8',
    letterSpacing: 0.4
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center'
  },
  detailLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500'
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 1
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 8
  },
  configDesc: {
    fontSize: 11.5,
    color: '#64748b',
    marginBottom: 10,
    lineHeight: 16
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a'
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center'
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '700'
  },
  resetBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center'
  },
  resetBtnText: {
    color: '#475569',
    fontSize: 12.5,
    fontWeight: '600'
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fee2e2',
    paddingVertical: 14,
    borderRadius: 16
  },
  logoutText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '700'
  }
});
