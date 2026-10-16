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
  ScrollView
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { EMIItem, PaymentMethod } from '../types';
import { submitEmiCollection } from '../services/collections';

interface CollectModalProps {
  visible: boolean;
  emi: EMIItem | null;
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
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            
            {/* Header */}
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Collect EMI Payment</Text>
                <Text style={styles.subtitle}>
                  Loan #{1000 + emi.loanId} · {emi.loan?.customer?.name}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Amount Due Card */}
            <View style={styles.dueCard}>
              <Text style={styles.dueLabel}>Outstanding EMI Due</Text>
              <Text style={styles.dueValue}>₹{dueAmount.toLocaleString('en-IN')}</Text>
              <Text style={styles.dueSub}>
                Due Date: {new Date(emi.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </Text>
            </View>

            {/* Amount Received Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Amount Received (₹)</Text>
              <TextInput
                keyboardType="numeric"
                value={payAmount}
                onChangeText={setPayAmount}
                placeholder="Enter amount"
                style={styles.textInput}
              />
            </View>

            {/* Payment Method Selector */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Payment Mode</Text>
              <View style={styles.methodRow}>
                {(['cash', 'upi', 'bank_transfer'] as PaymentMethod[]).map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.methodBtn, method === m && styles.methodBtnActive]}
                    onPress={() => setMethod(m)}
                  >
                    <Text style={styles.methodIcon}>
                      {m === 'cash' ? '💵' : m === 'upi' ? '📲' : '🏦'}
                    </Text>
                    <Text style={[styles.methodText, method === m && styles.methodTextActive]}>
                      {m === 'cash' ? 'Cash' : m === 'upi' ? 'UPI / QR' : 'Bank'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Reference Number */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {method === 'upi' ? 'UPI UTR / Reference No.' : 'Receipt / Reference No. (Optional)'}
              </Text>
              <TextInput
                value={reference}
                onChangeText={setReference}
                placeholder={method === 'upi' ? 'e.g. 12-digit UTR' : 'e.g. Book receipt #'}
                style={styles.textInput}
              />
            </View>

            {/* Photo Proof Upload */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>📸 Payment Receipt / Cash Photo Proof (Mandatory)</Text>
              {proofUri ? (
                <View style={styles.proofPreviewRow}>
                  <Image source={{ uri: proofUri }} style={styles.proofThumb} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.proofSuccessText}>✓ Proof Photo Attached</Text>
                    <TouchableOpacity onPress={takeProofPhoto} style={styles.retakeBtn}>
                      <Text style={styles.retakeBtnText}>Retake Photo</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity style={styles.snapPhotoBtn} onPress={takeProofPhoto}>
                  <Text style={styles.snapPhotoText}>📷 Snap Receipt / Cash Photo</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitBtnText}>✓ Confirm & Record Collection</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={submitting}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end'
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    padding: 24
  },
  scrollContent: {
    paddingBottom: 20
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a'
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2
  },
  closeBtn: {
    padding: 6
  },
  closeText: {
    fontSize: 18,
    color: '#94a3b8',
    fontWeight: '700'
  },
  dueCard: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 18
  },
  dueLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e40af',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  dueValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1e3a8a',
    marginVertical: 4
  },
  dueSub: {
    fontSize: 12,
    color: '#60a5fa',
    fontWeight: '500'
  },
  inputGroup: {
    marginBottom: 16
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0f172a'
  },
  methodRow: {
    flexDirection: 'row',
    gap: 8
  },
  methodBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    alignItems: 'center'
  },
  methodBtnActive: {
    borderColor: '#1e40af',
    backgroundColor: '#eff6ff'
  },
  methodIcon: {
    fontSize: 18,
    marginBottom: 2
  },
  methodText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569'
  },
  methodTextActive: {
    color: '#1e40af',
    fontWeight: '700'
  },
  snapPhotoBtn: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1.5,
    borderColor: '#94a3b8',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center'
  },
  snapPhotoText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#1e40af'
  },
  proofPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 12,
    padding: 10
  },
  proofThumb: {
    width: 60,
    height: 60,
    borderRadius: 8
  },
  proofSuccessText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534'
  },
  retakeBtn: {
    marginTop: 4
  },
  retakeBtnText: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '600',
    textDecorationLine: 'underline'
  },
  submitBtn: {
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8
  },
  submitBtnDisabled: {
    opacity: 0.6
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700'
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 12
  },
  cancelBtnText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600'
  }
});
