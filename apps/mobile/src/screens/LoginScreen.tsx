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
  ScrollView
} from 'react-native';
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

  // Mandatory Attendance Photo States
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [pendingUser, setPendingUser] = useState<User | null>(null);

  const handleCredentialsSubmit = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Required Fields', 'Please enter your agent email and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await loginWithCredentials(email.trim(), password);
      // Valid credentials — now enforce mandatory attendance photo step
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
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        
        {/* Brand Banner */}
        <View style={styles.brandBox}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>LQ</Text>
          </View>
          <Text style={styles.brandName}>LenQredzo Agent</Text>
          <Text style={styles.brandTagline}>Field Loan & Collection Portal</Text>
        </View>

        {/* Login Form Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Agent Sign In</Text>
          <Text style={styles.cardSub}>Sign in to access today's assigned dues</Text>

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Agent Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="agent@company.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
          </View>

          {/* Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Enter password"
                secureTextEntry={!showPassword}
                style={[styles.input, { flex: 1, borderWidth: 0 }]}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(p => !p)}
                style={styles.eyeBtn}
              >
                <Text style={{ fontSize: 16 }}>{showPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Attendance Notice */}
          <View style={styles.noticeBox}>
            <Text style={styles.noticeIcon}>📷</Text>
            <Text style={styles.noticeText}>
              Every sign-in requires an attendance selfie snapshot before entering.
            </Text>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleCredentialsSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.loginBtnText}>🔒 Sign In to Shift</Text>
            )}
          </TouchableOpacity>
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
    backgroundColor: '#0f172a'
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24
  },
  brandBox: {
    alignItems: 'center',
    marginBottom: 28
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: '#1e40af',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#1e40af',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8
  },
  logoBadgeText: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 1
  },
  brandName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff'
  },
  brandTagline: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a'
  },
  cardSub: {
    fontSize: 12.5,
    color: '#64748b',
    marginTop: 2,
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
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a'
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10
  },
  eyeBtn: {
    paddingHorizontal: 12
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 10,
    padding: 10,
    marginBottom: 20,
    gap: 8
  },
  noticeIcon: {
    fontSize: 16
  },
  noticeText: {
    flex: 1,
    fontSize: 11.5,
    color: '#1d4ed8',
    lineHeight: 16,
    fontWeight: '500'
  },
  loginBtn: {
    backgroundColor: '#1e40af',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center'
  },
  loginBtnDisabled: {
    opacity: 0.7
  },
  loginBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700'
  }
});
