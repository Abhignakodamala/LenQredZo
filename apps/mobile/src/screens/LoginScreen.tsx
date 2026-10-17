import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { loginWithCredentials, uploadAttendancePhoto, saveActiveSession } from '../services/auth';
import { User } from '../types';
import AttendanceModal from '../components/AttendanceModal';

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Mandatory Attendance Photo States (For field agents)
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [pendingUser, setPendingUser] = useState<User | null>(null);

  const handleCredentialsSubmit = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Required Fields', 'Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await loginWithCredentials(email.trim(), password);
      const roleClean = (res.user?.role || '').toLowerCase().replace(/[\s_-]/g, '');
      const isOwner = ['owner', 'admin', 'superadmin', 'branchmanager', 'manager', 'director'].includes(roleClean);

      // Management / Owners enter immediately without field attendance roadblock
      if (isOwner) {
        await saveActiveSession(res.token, res.user);
        onLoginSuccess(res.user);
        return;
      }

      // Valid credentials for Field Collection Agent — enforce shift attendance photo
      setPendingToken(res.token);
      setPendingUser(res.user);
      setShowAttendanceModal(true);
    } catch (err: any) {
      Alert.alert('Login Failed', err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleAttendanceCaptured = async (photoBase64: string) => {
    if (!pendingToken || !pendingUser) return;

    // Log attendance photo to server
    await uploadAttendancePhoto(pendingToken, photoBase64);

    // Save session and enter main app
    await saveActiveSession(pendingToken, pendingUser);
    setShowAttendanceModal(false);
    onLoginSuccess(pendingUser);
  };

  const handleAttendanceCancel = () => {
    setShowAttendanceModal(false);
    setPendingToken(null);
    setPendingUser(null);
    Alert.alert('Attendance Mandatory', 'Attendance photo is required to access your collection route.');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Banner */}
        <View style={styles.brandBox}>
          <View style={styles.logoBadgeContainer}>
            <View style={styles.logoBadge}>
              <Image
                source={require('../../assets/lenqredzo-logo-transparent.png')}
                style={styles.brandLogoImg}
                resizeMode="contain"
              />
            </View>
          </View>
          <Text style={styles.brandName}>LenQredzo Capital</Text>
          <View style={styles.badgePill}>
            <Text style={styles.badgePillText}>FINANCE & FIELD MOBILITY</Text>
          </View>
          <Text style={styles.brandTagline}>Enterprise Loan Management & Recovery Portal</Text>
        </View>

        {/* Login Form Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign In</Text>
          <Text style={styles.cardSub}>Executive overview or field collection route</Text>

          {/* Email Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <View style={styles.inputBox}>
              <Ionicons name="mail-outline" size={18} color="#94a3b8" style={styles.fieldIcon} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="user@lenqredzo.com"
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.inputBox}>
              <Ionicons name="lock-closed-outline" size={18} color="#94a3b8" style={styles.fieldIcon} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Enter password"
                placeholderTextColor="#94a3b8"
                secureTextEntry={!showPassword}
                style={styles.input}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(p => !p)}
                style={styles.eyeBtn}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color="#64748b"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Attendance Requirement Notice */}
          <View style={styles.noticeBox}>
            <View style={styles.noticeIconCircle}>
              <Ionicons name="camera" size={16} color="#2563eb" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.noticeHeading}>Photo Attendance Verification</Text>
              <Text style={styles.noticeText}>
                A mandatory selfie snapshot is required after password verification to start your shift.
              </Text>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleCredentialsSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <View style={styles.btnInner}>
                <Ionicons name="log-in-outline" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.loginBtnText}>Sign In & Verify Selfie</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer info */}
        <View style={styles.footerBox}>
          <Text style={styles.footerText}>Secure Banking Grade End-to-End Encryption</Text>
        </View>
      </ScrollView>

      {/* Mandatory Attendance Selfie Modal */}
      {pendingUser && (
        <AttendanceModal
          visible={showAttendanceModal}
          agentName={pendingUser.name}
          onCaptured={handleAttendanceCaptured}
          onCancel={handleAttendanceCancel}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1d'
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20
  },
  brandBox: {
    alignItems: 'center',
    marginBottom: 24
  },
  logoBadgeContainer: {
    padding: 8,
    borderRadius: 24,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    marginBottom: 12
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
    padding: 6
  },
  brandLogoImg: {
    width: 48,
    height: 48
  },
  brandName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5
  },
  badgePill: {
    backgroundColor: 'rgba(59, 130, 246, 0.18)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)'
  },
  badgePillText: {
    color: '#60a5fa',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1
  },
  brandTagline: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 6,
    fontWeight: '500'
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a'
  },
  cardSub: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 3,
    marginBottom: 20
  },
  inputGroup: {
    marginBottom: 16
  },
  inputLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48
  },
  fieldIcon: {
    marginRight: 8
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    height: '100%'
  },
  eyeBtn: {
    padding: 8
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 14,
    padding: 12,
    marginBottom: 22,
    gap: 10
  },
  noticeIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1
  },
  noticeHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
    marginBottom: 2
  },
  noticeText: {
    fontSize: 11,
    color: '#3b82f6',
    lineHeight: 15,
    fontWeight: '500'
  },
  loginBtn: {
    backgroundColor: '#2563eb',
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4
  },
  btnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  loginBtnDisabled: {
    opacity: 0.7
  },
  loginBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3
  },
  footerBox: {
    marginTop: 24,
    alignItems: 'center'
  },
  footerText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '500'
  }
});
