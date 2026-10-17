import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

interface AttendanceModalProps {
  visible: boolean;
  agentName: string;
  onCaptured: (photoBase64: string) => void;
  onCancel: () => void;
}

export default function AttendanceModal({
  visible,
  agentName,
  onCaptured,
  onCancel
}: AttendanceModalProps) {
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  const takeSelfie = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Camera Required',
          'Camera permission is mandatory to record your login attendance snapshot.'
        );
        return;
      }

      setCapturing(true);
      const result = await ImagePicker.launchCameraAsync({
        cameraType: ImagePicker.CameraType.front,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setPhotoUri(asset.uri);
        const b64 = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setPhotoBase64(b64);
      }
    } catch (err: any) {
      Alert.alert('Camera Error', err.message || 'Could not open camera.');
    } finally {
      setCapturing(false);
    }
  };

  const handleConfirm = () => {
    if (!photoBase64) {
      Alert.alert('Photo Needed', 'Please capture your face photo to record attendance.');
      return;
    }
    onCaptured(photoBase64);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.shieldBadge}>
              <Ionicons name="shield-checkmark" size={24} color="#2563eb" />
            </View>
            <Text style={styles.title}>Attendance Verification</Text>
            <Text style={styles.subtitle}>
              Hello <Text style={{ fontWeight: '700', color: '#0f172a' }}>{agentName || 'Agent'}</Text>, please capture a clear selfie photo to start your shift.
            </Text>
          </View>

          {/* Photo Viewfinder */}
          <View style={styles.viewfinderWrapper}>
            {photoUri ? (
              <View style={styles.photoContainer}>
                <Image source={{ uri: photoUri }} style={styles.previewImage} />
                <View style={styles.verifiedTag}>
                  <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
                  <Text style={styles.verifiedText}>Captured</Text>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.placeholder}
                onPress={takeSelfie}
                disabled={capturing}
                activeOpacity={0.8}
              >
                <View style={styles.cameraIconCircle}>
                  <Ionicons name="camera" size={32} color="#2563eb" />
                </View>
                <Text style={styles.placeholderTitle}>Tap to Open Camera</Text>
                <Text style={styles.placeholderSub}>Ensure good lighting and face clearly visible</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Audit Notice */}
          <View style={styles.auditNotice}>
            <Ionicons name="time-outline" size={14} color="#64748b" />
            <Text style={styles.auditNoticeText}>
              Timestamped & stored in company audit photos
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.btnStack}>
            {photoUri ? (
              <>
                <TouchableOpacity
                  style={styles.confirmBtn}
                  onPress={handleConfirm}
                  activeOpacity={0.85}
                >
                  <Ionicons name="checkmark-sharp" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.confirmBtnText}>Confirm Attendance & Enter</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.retakeBtn}
                  onPress={takeSelfie}
                  disabled={capturing}
                  activeOpacity={0.7}
                >
                  <Ionicons name="refresh-outline" size={16} color="#475569" style={{ marginRight: 6 }} />
                  <Text style={styles.retakeBtnText}>Retake Photo</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={styles.captureBtn}
                onPress={takeSelfie}
                disabled={capturing}
                activeOpacity={0.85}
              >
                {capturing ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                    <Text style={styles.captureBtnText}>Open Camera</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onCancel}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Cancel & Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 15, 29, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12
  },
  header: {
    alignItems: 'center',
    marginBottom: 16
  },
  shieldBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#dbeafe'
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4
  },
  subtitle: {
    fontSize: 12.5,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8
  },
  viewfinderWrapper: {
    width: 220,
    height: 220,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    overflow: 'hidden',
    backgroundColor: '#f8fafc',
    marginBottom: 14,
    justifyContent: 'center',
    alignItems: 'center'
  },
  photoContainer: {
    width: '100%',
    height: '100%',
    position: 'relative'
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 22
  },
  verifiedTag: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803d'
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16
  },
  cameraIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10
  },
  placeholderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4
  },
  placeholderSub: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 15
  },
  auditNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 18
  },
  auditNoticeText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500'
  },
  btnStack: {
    width: '100%',
    gap: 10
  },
  captureBtn: {
    backgroundColor: '#2563eb',
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3
  },
  captureBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700'
  },
  confirmBtn: {
    backgroundColor: '#16a34a',
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3
  },
  confirmBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700'
  },
  retakeBtn: {
    backgroundColor: '#f1f5f9',
    height: 42,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  retakeBtnText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600'
  },
  cancelBtn: {
    paddingVertical: 10,
    alignItems: 'center'
  },
  cancelBtnText: {
    color: '#94a3b8',
    fontSize: 12.5,
    fontWeight: '600'
  }
});
