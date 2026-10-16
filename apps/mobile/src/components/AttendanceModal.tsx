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
          <View style={styles.header}>
            <Text style={styles.headerIcon}>🛡️</Text>
            <Text style={styles.title}>Mandatory Attendance</Text>
            <Text style={styles.subtitle}>
              Hello {agentName || 'Agent'}, take a live attendance snapshot to begin your collection shift.
            </Text>
          </View>

          {/* Photo Preview Box */}
          <View style={styles.previewContainer}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.previewImage} />
            ) : (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderIcon}>📸</Text>
                <Text style={styles.placeholderText}>No photo captured yet</Text>
              </View>
            )}
          </View>

          {/* Actions */}
          <TouchableOpacity
            style={styles.captureBtn}
            onPress={takeSelfie}
            disabled={capturing}
          >
            {capturing ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.captureBtnText}>
                {photoUri ? '🔄 Retake Photo' : '📷 Take Attendance Selfie'}
              </Text>
            )}
          </TouchableOpacity>

          {photoUri && (
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
              <Text style={styles.confirmBtnText}>✓ Confirm & Enter Dues</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelBtnText}>Cancel and Exit</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 8
  },
  header: {
    alignItems: 'center',
    marginBottom: 16
  },
  headerIcon: {
    fontSize: 28,
    marginBottom: 6
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4
  },
  subtitle: {
    fontSize: 12.5,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18
  },
  previewContainer: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#3b82f6',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20
  },
  previewImage: {
    width: '100%',
    height: '100%'
  },
  placeholder: {
    alignItems: 'center'
  },
  placeholderIcon: {
    fontSize: 36,
    marginBottom: 6
  },
  placeholderText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600'
  },
  captureBtn: {
    width: '100%',
    backgroundColor: '#1e40af',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10
  },
  captureBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700'
  },
  confirmBtn: {
    width: '100%',
    backgroundColor: '#16a34a',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10
  },
  confirmBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700'
  },
  cancelBtn: {
    paddingVertical: 8
  },
  cancelBtnText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600'
  }
});
