'use client';

import { useEffect, useRef, useState } from 'react';

type FaceCaptureModalProps = {
  title?: string;
  message?: string;
  onCapture: (photoBase64: string) => void | Promise<void>;
  onCancel: () => void;
  required?: boolean;
};

export default function FaceCaptureModal({
  title = 'Verify your Face ID',
  message = 'A quick attendance snapshot is logged with every login for audit verification.',
  onCapture,
  onCancel,
  required = true
}: FaceCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [capturing, setCapturing] = useState(false);

  const startCamera = () => {
    setCameraError('');
    setCameraReady(false);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access is not supported on this browser. Please use a modern browser.');
      return;
    }

    navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 640 },
        height: { ideal: 480 }
      },
      audio: false
    })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch((err) => {
        console.warn('Camera access denied or unavailable:', err);
        setCameraError('Camera access was denied or is unavailable. Please grant camera permission in your browser to proceed.');
      });
  };

  useEffect(() => {
    startCamera();
    return () => {
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
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const photoBase64 = canvas.toDataURL('image/jpeg', 0.82);
      try {
        await onCapture(photoBase64);
      } finally {
        setCapturing(false);
      }
    } else {
      setCapturing(false);
    }
  };

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        style={{
          width: '100%',
          maxWidth: '520px',
          background: '#ffffff',
          borderRadius: '20px',
          padding: '28px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35)',
          textAlign: 'center'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={{ fontSize: '20px', color: '#2563eb' }}>🛡️</span>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
            {title}
          </h2>
        </div>

        <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: '13px', lineHeight: 1.5 }}>
          {message}
        </p>

        {/* Video Camera Container with Face Frame Overlay */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '4 / 3',
            background: '#0f172a',
            borderRadius: '14px',
            overflow: 'hidden',
            margin: '0 auto 16px'
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onLoadedMetadata={() => setCameraReady(true)}
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)' // mirror for natural selfie feel
            }}
          />

          {/* Visual Face Alignment Guide (Matching user reference) */}
          {cameraReady && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '170px',
                height: '210px',
                border: '2px dashed rgba(255, 255, 255, 0.65)',
                borderRadius: '80px',
                pointerEvents: 'none',
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.15)'
              }}
            />
          )}

          {!cameraReady && !cameraError && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8',
                fontSize: '13px',
                gap: '8px'
              }}
            >
              <div style={{ fontSize: '24px' }}>⏳</div>
              <span>Connecting to camera...</span>
            </div>
          )}
        </div>

        {/* Camera Status Message */}
        {cameraReady && !cameraError && (
          <p style={{ margin: '0 0 16px', color: '#16a34a', fontSize: '13px', fontWeight: 600 }}>
            ✓ Camera access granted! Click below to capture photo and sign in.
          </p>
        )}

        {cameraError && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              marginBottom: '16px'
            }}
          >
            <p style={{ margin: '0 0 6px', fontWeight: 600 }}>⚠️ Camera Access Required</p>
            <p style={{ margin: 0 }}>{cameraError}</p>
            <button
              onClick={startCamera}
              style={{
                marginTop: '8px',
                background: '#ffffff',
                border: '1px solid #f87171',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#b91c1c',
                cursor: 'pointer'
              }}
            >
              🔄 Retry Camera
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            type="button"
            onClick={capturePhoto}
            disabled={!cameraReady || capturing}
            style={{
              width: '100%',
              padding: '13px',
              border: 'none',
              borderRadius: '10px',
              background: cameraReady && !capturing ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : '#cbd5e1',
              color: '#ffffff',
              fontSize: '15px',
              fontWeight: 700,
              cursor: cameraReady && !capturing ? 'pointer' : 'not-allowed',
              boxShadow: cameraReady ? '0 4px 12px rgba(79, 70, 229, 0.3)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            {capturing ? 'Capturing & Logging...' : '📸 Capture Photo & Enter Dashboard'}
          </button>

          <button
            type="button"
            onClick={onCancel}
            disabled={capturing}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              padding: '6px'
            }}
          >
            Cancel and Return to Login
          </button>
        </div>
      </section>
    </div>
  );
}