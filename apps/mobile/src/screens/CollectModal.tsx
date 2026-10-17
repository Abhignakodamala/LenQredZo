import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { EMIItem, PaymentMethod, User } from '../types';
import { submitEmiCollection } from '../services/collections';

interface CollectModalProps {
  visible: boolean;
  emi: EMIItem | null;
  user?: User;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CollectModal({
  visible,
  emi,
  onClose,
  onSuccess
}: CollectModalProps) {
  if (!emi) return null;

  const dueAmount = emi.amount - (emi.paidAmount || 0);
  const [payAmount, setPayAmount] = useState<string>(String(dueAmount));
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [reference, setReference] = useState('');
  const [proofUri, setProofUri] = useState<string | null>(null);
  const [proofBase64, setProofBase64] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const takeProofPhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera Permission Required', 'Please enable camera access to snap cash/receipt proof.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        cameraType: ImagePicker.CameraType.back,
        allowsEditing: true,
        quality: 0.6,
        base64: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setProofUri(asset.uri);
        const b64 = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setProofBase64(b64);
      }
    } catch (err: any) {
      Alert.alert('Camera Error', err.message || 'Could not launch camera.');
    }
  };

  const handleSubmit = async () => {
    const numAmount = parseFloat(payAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount greater than ₹0.');
      return;
    }

    if (!proofBase64) {
      Alert.alert(
        'Photo Proof Required',
        'Please snap a quick photo proof of the cash handed over or UPI confirmation screen.'
      );
      return;
    }

    setSubmitting(true);
    try {
      await submitEmiCollection({
        emiId: emi.id,
        payAmount: numAmount,
        method,
        reference: reference.trim() || undefined,
        verificationPhoto: proofBase64
      });

      Alert.alert(
        '✓ Collection Recorded',
        `Successfully collected ₹${numAmount.toLocaleString('en-IN')} from ${emi.loan?.customer?.name || 'Customer'}.`,
        [{ text: 'OK', onPress: () => { onSuccess(); onClose(); } }]
      );
    } catch (err: any) {
      Alert.alert('Collection Failed', err.message || 'Could not record collection.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          {/* Grab Handle */}
          <View style={styles.handleBar} />

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Collect EMI Payment</Text>
                <Text style={styles.subtitle}>
                  Loan #{1000 + emi.loanId} · {emi.loan?.customer?.name}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Outstanding Due Card */}
            <View style={styles.dueCard}>
              <View>
                <Text style={styles.dueLabel}>Outstanding EMI Due</Text>
                <Text style={styles.dueValue}>₹{dueAmount.toLocaleString('en-IN')}</Text>
              </View>
              <View style={styles.dueDateBadge}>
                <Ionicons name="calendar-outline" size={13} color="#2563eb" />
                <Text style={styles.dueDateText}>
                  {new Date(emi.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </Text>
              </View>
            </View>

            {/* Amount Received Input & Quick Chips */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Amount Received (₹)</Text>
              <View style={styles.amountInputBox}>
                <Text style={styles.rupeeSymbol}>₹</Text>
                <TextInput
                  keyboardType="numeric"
                  value={payAmount}
                  onChangeText={setPayAmount}
                  placeholder="0"
                  placeholderTextColor="#94a3b8"
                  style={styles.amountInput}
                />
              </View>
              {/* Quick amount shortcuts */}
              <View style={styles.chipRow}>
                <TouchableOpacity
                  style={[styles.chip, payAmount === String(dueAmount) && styles.chipActive]}
                  onPress={() => setPayAmount(String(dueAmount))}
                >
                  <Text style={[styles.chipText, payAmount === String(dueAmount) && styles.chipTextActive]}>
                    Full: ₹{dueAmount.toLocaleString('en-IN')}
                  </Text>
                </TouchableOpacity>

                {dueAmount > 500 && (
                  <TouchableOpacity
                    style={[styles.chip, payAmount === String(Math.round(dueAmount / 2)) && styles.chipActive]}
                    onPress={() => setPayAmount(String(Math.round(dueAmount / 2)))}
                  >
                    <Text style={[styles.chipText, payAmount === String(Math.round(dueAmount / 2)) && styles.chipTextActive]}>
                      50%: ₹{Math.round(dueAmount / 2).toLocaleString('en-IN')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Payment Method Selector */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Payment Mode</Text>
              <View style={styles.methodRow}>
                {[
                  { id: 'cash', label: 'Cash', icon: 'cash-outline' },
                  { id: 'upi', label: 'UPI / QR', icon: 'qr-code-outline' },
                  { id: 'bank_transfer', label: 'Bank', icon: 'business-outline' }
                ].map(m => {
                  const isActive = method === m.id;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.methodBtn, isActive && styles.methodBtnActive]}
                      onPress={() => setMethod(m.id as PaymentMethod)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={m.icon as any}
                        size={20}
                        color={isActive ? '#2563eb' : '#64748b'}
                        style={{ marginBottom: 4 }}
                      />
                      <Text style={[styles.methodText, isActive && styles.methodTextActive]}>
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Reference Number / Notes */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Reference / Receipt Note (Optional)</Text>
              <TextInput
                value={reference}
                onChangeText={setReference}
                placeholder={method === 'upi' ? 'UPI UTR / Transaction ID' : 'Receipt number or remarks'}
                placeholderTextColor="#94a3b8"
                style={styles.textInput}
              />
            </View>

            {/* Photo Proof Section (Mandatory) */}
            <View style={styles.inputGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={styles.inputLabel}>
                  Camera Proof <Text style={{ color: '#dc2626' }}>*</Text>
                </Text>
                <Text style={styles.requiredTag}>Mandatory</Text>
              </View>

              {proofUri ? (
                <View style={styles.proofPreviewCard}>
                  <Image source={{ uri: proofUri }} style={styles.proofThumbnail} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={styles.proofVerifiedPill}>
                      <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
                      <Text style={styles.proofVerifiedText}>Photo Verified</Text>
                    </View>
                    <Text style={styles.proofSubText}>Cash/Receipt image attached</Text>
                  </View>
                  <TouchableOpacity style={styles.retakeIconBtn} onPress={takeProofPhoto}>
                    <Ionicons name="camera-reverse" size={20} color="#2563eb" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.cameraBox}
                  onPress={takeProofPhoto}
                  activeOpacity={0.8}
                >
                  <View style={styles.cameraCircle}>
                    <Ionicons name="camera" size={26} color="#2563eb" />
                  </View>
                  <Text style={styles.cameraTitle}>Take Cash / Receipt Photo</Text>
                  <Text style={styles.cameraDesc}>
                    Snap currency bundle or UPI confirmation screen
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <View style={styles.btnInner}>
                  <Ionicons name="checkmark-done" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                  <Text style={styles.submitBtnText}>
                    Confirm Collection ₹{parseFloat(payAmount || '0').toLocaleString('en-IN')}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelLink} onPress={onClose}>
              <Text style={styles.cancelLinkText}>Discard and Go Back</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 15, 29, 0.75)',
    justifyContent: 'flex-end'
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 20
  },
  handleBar: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6
  },
  scrollContent: {
    padding: 20
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0f172a'
  },
  subtitle: {
    fontSize: 12.5,
    color: '#64748b',
    marginTop: 2
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  dueCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#dbeafe'
  },
  dueLabel: {
    fontSize: 11,
    color: '#3b82f6',
    fontWeight: '700',
    letterSpacing: 0.3
  },
  dueValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1e40af',
    marginTop: 2
  },
  dueDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 4
  },
  dueDateText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e40af'
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
  requiredTag: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#dc2626',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  amountInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52
  },
  rupeeSymbol: {
    fontSize: 20,
    fontWeight: '800',
    color: '#64748b',
    marginRight: 6
  },
  amountInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    height: '100%'
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  chipActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb'
  },
  chipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569'
  },
  chipTextActive: {
    color: '#2563eb',
    fontWeight: '700'
  },
  methodRow: {
    flexDirection: 'row',
    gap: 8
  },
  methodBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingVertical: 12
  },
  methodBtnActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb'
  },
  methodText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569'
  },
  methodTextActive: {
    color: '#2563eb',
    fontWeight: '700'
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a'
  },
  cameraBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cameraCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8
  },
  cameraTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1e293b'
  },
  cameraDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2
  },
  proofPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dcfce7',
    borderRadius: 14,
    padding: 10
  },
  proofThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 10
  },
  proofVerifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
    gap: 4
  },
  proofVerifiedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803d'
  },
  proofSubText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4
  },
  retakeIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center'
  },
  submitBtn: {
    backgroundColor: '#2563eb',
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4
  },
  btnInner: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  submitBtnDisabled: {
    opacity: 0.7
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700'
  },
  cancelLink: {
    paddingVertical: 12,
    alignItems: 'center'
  },
  cancelLinkText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600'
  }
});
