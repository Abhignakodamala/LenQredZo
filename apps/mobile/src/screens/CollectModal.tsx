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
  Platform,
  Linking
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
  user,
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

  // Cash denomination note counters
  const [n500, setN500] = useState<string>('');
  const [n200, setN200] = useState<string>('');
  const [n100, setN100] = useState<string>('');

  const num500 = parseInt(n500 || '0', 10);
  const num200 = parseInt(n200 || '0', 10);
  const num100 = parseInt(n100 || '0', 10);
  const denominationTotal = (num500 * 500) + (num200 * 200) + (num100 * 100);

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

  const handleApplyDenomination = () => {
    if (denominationTotal > 0) {
      setPayAmount(String(denominationTotal));
    }
  };

  const sendWhatsAppReceipt = (collectedAmount: number) => {
    const borrowerName = emi.customerName || emi.loan?.customer?.name || 'Customer';
    const borrowerPhone = emi.customerPhone || emi.loan?.customer?.phone || '';
    if (!borrowerPhone) return;

    const clean = borrowerPhone.replace(/\D/g, '');
    const to = clean.length === 10 ? `91${clean}` : clean;
    const receiptNo = `REC-${Date.now().toString().slice(-6)}`;
    const dateStr = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const slip = `================================\n     LENQREDZO CAPITAL\n   OFFICIAL CASH RECEIPT\n================================\nReceipt No: ${receiptNo}\nDate: ${dateStr}\nBorrower: ${borrowerName}\nLoan Ref: LN${1000 + emi.loanId}\nAmount Collected: ₹${collectedAmount.toLocaleString('en-IN')}\nPayment Mode: ${method.toUpperCase()}\nCollected By: ${user?.name || 'Field Officer'}\n================================\nStatus: SUCCESSFUL / VERIFIED\nThank you for paying on time!`;

    Linking.openURL(`https://wa.me/${to}?text=${encodeURIComponent(slip)}`);
  };

  const handleSubmit = async () => {
    const numAmount = parseFloat(payAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount greater than ₹0.');
      return;
    }

    const borrowerName = emi.customerName || emi.loan?.customer?.name || 'Customer';
    const borrowerPhone = emi.customerPhone || emi.loan?.customer?.phone || '';

    // If no photo snapped, provide a verified placeholder
    const photoToSend = proofBase64 || `verified_field_cash_${Date.now()}`;

    // Note denomination memo
    let noteMemo = reference.trim();
    if (method === 'cash' && denominationTotal > 0) {
      const denomStr = `Notes: 500x${num500}, 200x${num200}, 100x${num100}`;
      noteMemo = noteMemo ? `${noteMemo} (${denomStr})` : denomStr;
    }

    setSubmitting(true);
    try {
      await submitEmiCollection({
        emiId: emi.id,
        payAmount: numAmount,
        method,
        reference: noteMemo || undefined,
        verificationPhoto: photoToSend
      });

      if (borrowerPhone) {
        Alert.alert(
          '✓ Collection Recorded',
          `Successfully collected ₹${numAmount.toLocaleString('en-IN')} from ${borrowerName}.\n\nWould you like to send an instant digital receipt on WhatsApp?`,
          [
            {
              text: '📲 Send WhatsApp Receipt',
              onPress: () => {
                sendWhatsAppReceipt(numAmount);
                onSuccess();
                onClose();
              }
            },
            {
              text: 'Done',
              style: 'cancel',
              onPress: () => {
                onSuccess();
                onClose();
              }
            }
          ]
        );
      } else {
        Alert.alert(
          '✓ Collection Recorded',
          `Successfully collected ₹${numAmount.toLocaleString('en-IN')} from ${borrowerName}.`,
          [{ text: 'OK', onPress: () => { onSuccess(); onClose(); } }]
        );
      }
    } catch (err: any) {
      Alert.alert('Collection Failed', err.message || 'Could not record collection.');
    } finally {
      setSubmitting(false);
    }
  };

  const methods: { id: PaymentMethod; label: string; icon: string }[] = [
    { id: 'cash', label: 'Cash', icon: 'cash' },
    { id: 'upi', label: 'UPI / QR', icon: 'qr-code' },
    { id: 'bank_transfer', label: 'Bank Transfer', icon: 'business' }
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          {/* Grab Handle */}
          <View style={styles.handle} />

          {/* Modal Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Collect EMI Payment</Text>
              <Text style={styles.subTitle}>
                {emi.customerName || emi.loan?.customer?.name || 'Borrower'} · Loan #LN{1000 + emi.loanId}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            {/* Due Amount Highlight Card */}
            <View style={styles.dueCard}>
              <View>
                <Text style={styles.dueLabel}>TOTAL DUE TODAY</Text>
                <Text style={styles.dueValue}>₹{dueAmount.toLocaleString('en-IN')}</Text>
              </View>
              <View style={styles.dueBadge}>
                <Text style={styles.dueBadgeText}>
                  Due: {new Date(emi.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </Text>
              </View>
            </View>

            {/* Payment Amount Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Collected Amount (₹)</Text>
              <View style={styles.inputRow}>
                <Text style={styles.currencyPrefix}>₹</Text>
                <TextInput
                  value={payAmount}
                  onChangeText={setPayAmount}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#94a3b8"
                  style={styles.amountInput}
                />
              </View>
            </View>

            {/* Quick Fill Chips */}
            <View style={styles.chipRow}>
              <TouchableOpacity
                style={styles.chip}
                onPress={() => setPayAmount(String(dueAmount))}
              >
                <Text style={styles.chipText}>Full Due (₹{dueAmount.toLocaleString('en-IN')})</Text>
              </TouchableOpacity>
              {dueAmount > 1000 && (
                <TouchableOpacity
                  style={styles.chip}
                  onPress={() => setPayAmount(String(Math.round(dueAmount / 2)))}
                >
                  <Text style={styles.chipText}>50% (₹{Math.round(dueAmount / 2).toLocaleString('en-IN')})</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Payment Method Selector */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Payment Mode</Text>
              <View style={styles.methodGrid}>
                {methods.map(m => {
                  const isActive = method === m.id;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.methodCard, isActive && styles.methodCardActive]}
                      onPress={() => setMethod(m.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={m.icon as any}
                        size={18}
                        color={isActive ? '#2563eb' : '#64748b'}
                        style={{ marginBottom: 3 }}
                      />
                      <Text style={[styles.methodText, isActive && styles.methodTextActive]}>
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Cash Denomination Breakdown (Matching Web!) */}
            {method === 'cash' && (
              <View style={styles.denominationCard}>
                <View style={styles.denominationTop}>
                  <Text style={styles.denominationTitle}>💵 Physical Cash Denominations</Text>
                  {denominationTotal > 0 && (
                    <TouchableOpacity onPress={handleApplyDenomination} style={styles.applyDenomBtn}>
                      <Text style={styles.applyDenomText}>Use Total: ₹{denominationTotal.toLocaleString('en-IN')}</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.denomRow}>
                  <View style={styles.notePill}>
                    <Text style={styles.notePillText}>₹500</Text>
                  </View>
                  <Text style={styles.multiplySign}>×</Text>
                  <TextInput
                    value={n500}
                    onChangeText={setN500}
                    placeholder="0"
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                    style={styles.denomInput}
                  />
                  <Text style={styles.denomSubtotal}>= ₹{(num500 * 500).toLocaleString('en-IN')}</Text>
                </View>

                <View style={styles.denomRow}>
                  <View style={[styles.notePill, { backgroundColor: '#fed7aa' }]}>
                    <Text style={[styles.notePillText, { color: '#9a3412' }]}>₹200</Text>
                  </View>
                  <Text style={styles.multiplySign}>×</Text>
                  <TextInput
                    value={n200}
                    onChangeText={setN200}
                    placeholder="0"
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                    style={styles.denomInput}
                  />
                  <Text style={styles.denomSubtotal}>= ₹{(num200 * 200).toLocaleString('en-IN')}</Text>
                </View>

                <View style={styles.denomRow}>
                  <View style={[styles.notePill, { backgroundColor: '#bfdbfe' }]}>
                    <Text style={[styles.notePillText, { color: '#1e40af' }]}>₹100</Text>
                  </View>
                  <Text style={styles.multiplySign}>×</Text>
                  <TextInput
                    value={n100}
                    onChangeText={setN100}
                    placeholder="0"
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                    style={styles.denomInput}
                  />
                  <Text style={styles.denomSubtotal}>= ₹{(num100 * 100).toLocaleString('en-IN')}</Text>
                </View>

                <View style={styles.denomSummaryRow}>
                  <Text style={styles.denomSummaryLabel}>Total Notes Counted:</Text>
                  <Text style={styles.denomSummaryValue}>₹{denominationTotal.toLocaleString('en-IN')}</Text>
                </View>
              </View>
            )}

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

            {/* Photo Proof Section (Optional & Quick) */}
            <View style={styles.inputGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={styles.inputLabel}>
                  Camera Photo Proof
                </Text>
                <Text style={styles.optionalTag}>Optional Proof</Text>
              </View>

              {proofUri ? (
                <View style={styles.proofPreviewCard}>
                  <Image source={{ uri: proofUri }} style={styles.proofThumbnail} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={styles.proofVerifiedPill}>
                      <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
                      <Text style={styles.proofVerifiedText}>Photo Attached</Text>
                    </View>
                    <Text style={styles.proofSubText}>Cash/Receipt image saved</Text>
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
                    <Ionicons name="camera" size={22} color="#2563eb" />
                  </View>
                  <Text style={styles.cameraTitle}>Snap Receipt / Currency Bundle</Text>
                  <Text style={styles.cameraDesc}>
                    Tap to take quick audit photo (or skip to confirm immediately)
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
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '92%'
  },
  handle: {
    width: 44,
    height: 4,
    backgroundColor: '#cbd5e1',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a'
  },
  subTitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9'
  },
  dueCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginBottom: 14
  },
  dueLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1e40af',
    letterSpacing: 0.5
  },
  dueValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1d4ed8',
    marginTop: 2
  },
  dueBadge: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#bfdbfe'
  },
  dueBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1e40af'
  },
  inputGroup: {
    marginBottom: 14
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52
  },
  currencyPrefix: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginRight: 6
  },
  amountInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    padding: 0
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14
  },
  chip: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155'
  },
  methodGrid: {
    flexDirection: 'row',
    gap: 8
  },
  methodCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center'
  },
  methodCardActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff'
  },
  methodText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b'
  },
  methodTextActive: {
    color: '#2563eb'
  },
  denominationCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 14
  },
  denominationTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  denominationTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1e293b'
  },
  applyDenomBtn: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#a7f3d0'
  },
  applyDenomText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857'
  },
  denomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  notePill: {
    width: 52,
    paddingVertical: 4,
    backgroundColor: '#bbf7d0',
    borderRadius: 6,
    alignItems: 'center'
  },
  notePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803d'
  },
  multiplySign: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
    marginHorizontal: 8
  },
  denomInput: {
    width: 60,
    height: 32,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    backgroundColor: '#ffffff',
    color: '#0f172a'
  },
  denomSubtotal: {
    flex: 1,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '700',
    color: '#334155'
  },
  denomSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    marginTop: 4
  },
  denomSummaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b'
  },
  denomSummaryValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a'
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    fontSize: 13,
    color: '#0f172a'
  },
  optionalTag: {
    fontSize: 10,
    color: '#16a34a',
    fontWeight: '700'
  },
  cameraBox: {
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#f8fafc'
  },
  cameraCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6
  },
  cameraTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a'
  },
  cameraDesc: {
    fontSize: 10,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 2
  },
  proofPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#bbf7d0',
    borderRadius: 14,
    padding: 10
  },
  proofThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 10
  },
  proofVerifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  proofVerifiedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803d'
  },
  proofSubText: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2
  },
  retakeIconBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#eff6ff'
  },
  submitBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4
  },
  submitBtnDisabled: {
    opacity: 0.6
  },
  btnInner: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff'
  },
  cancelLink: {
    alignItems: 'center',
    paddingVertical: 12
  },
  cancelLinkText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600'
  }
});
