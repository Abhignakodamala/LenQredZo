'use client';

import { useEffect, useRef, useState } from 'react';

type FaceCaptureModalProps = {
  title: string;
  message: string;
  onCapture: (photoBase64: string) => void | Promise<void>;
  onCancel: () => void;
};

export default function FaceCaptureModal({ title, message, onCapture, onCancel }: FaceCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    let active = true;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then(stream => {
        if (!active) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => {
        if (active) setCameraError('Camera access is unavailable. Close this dialog to proceed.');
      });

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) return;

    setCapturing(true);
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 640 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    try {
      await onCapture(canvas.toDataURL('image/jpeg', 0.82));
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div role="presentation" style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(15, 23, 42, 0.62)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <section role="dialog" aria-modal="true" aria-labelledby="face-capture-title" style={{ width: '100%', maxWidth: 440, background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.28)' }}>
        <h2 id="face-capture-title" style={{ margin: '0 0 8px', fontSize: 20, color: '#111827' }}>{title}</h2>
        <p style={{ margin: '0 0 16px', color: '#4b5563', fontSize: 14, lineHeight: 1.5 }}>{message}</p>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={() => setCameraReady(true)}
          style={{ display: 'block', width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', background: '#111827', borderRadius: 8 }}
        />
        {cameraError && <p role="alert" style={{ color: '#b91c1c', fontSize: 13, margin: '10px 0 0' }}>{cameraError}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button type="button" onClick={onCancel} disabled={capturing} style={{ padding: '9px 14px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', color: '#374151', cursor: 'pointer' }}>
            Cancel
          </button>
          <button type="button" onClick={capturePhoto} disabled={!cameraReady || capturing} style={{ padding: '9px 14px', border: 'none', borderRadius: 6, background: '#0f766e', color: '#fff', cursor: cameraReady && !capturing ? 'pointer' : 'default', opacity: !cameraReady || capturing ? 0.6 : 1 }}>
            {capturing ? 'Saving...' : 'Capture photo'}
          </button>
        </div>
      </section>
    </div>
  );
}