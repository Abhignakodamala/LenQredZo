'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

type FaceCaptureModalProps = {
  title?: string;
  message?: string;
  onCapture: (photoBase64: string) => void | Promise<void>;
  onCancel: () => void;
  onSkip?: () => void;
  required?: boolean;
};

export default function FaceCaptureModal({
  title = 'Verify your Face ID',
  message = 'A quick attendance snapshot is logged with every login for audit verification.',
  onCapture,
  onCancel,
  onSkip,
  required = true
}: FaceCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isMirrored, setIsMirrored] = useState(true);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [showChromeTip, setShowChromeTip] = useState(false);

  // Stop current stream cleanly
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Enumerate cameras
  const refreshDevices = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return;
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const cams = all.filter(d => d.kind === 'videoinput');
      setVideoDevices(cams);
      if (cams.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(cams[0].deviceId);
      }
    } catch (e) {
      console.warn('Could not list cameras:', e);
    }
  }, [selectedDeviceId]);

  // Start camera with fallback constraints
  const startCamera = useCallback(async (deviceIdToUse?: string) => {
    setCameraError('');
    setCameraReady(false);
    stopStream();

    const isHttpInsecure = typeof window !== 'undefined'
      && !window.isSecureContext
      && window.location.protocol === 'http:'
      && !['localhost', '127.0.0.1'].includes(window.location.hostname);

    if (isHttpInsecure || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('HTTP_INSECURE_BLOCKED');
      return;
    }

    const targetDevice = deviceIdToUse || selectedDeviceId;

    // Constraint configurations to try in order
    const constraintAttempts: MediaStreamConstraints[] = [
      {
        video: {
          deviceId: targetDevice ? { exact: targetDevice } : undefined,
          facingMode: targetDevice ? undefined : 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      },
      {
        video: {
          deviceId: targetDevice ? { exact: targetDevice } : undefined,
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      },
      {
        video: targetDevice ? { deviceId: { exact: targetDevice } } : true,
        audio: false
      }
    ];

    let stream: MediaStream | null = null;
    let lastErr: any = null;

    for (const constraints of constraintAttempts) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (stream) break;
      } catch (err) {
        lastErr = err;
      }
    }

    if (!stream) {
      console.warn('All camera constraints failed:', lastErr);
      const msg = lastErr?.name === 'NotAllowedError'
        ? 'Camera permission was denied. Please allow camera access in your browser settings.'
        : lastErr?.name === 'NotReadableError'
          ? 'Camera is currently locked by another application (like Zoom, Teams, or another tab). Close other apps and retry.'
          : 'Unable to start camera. You can switch camera, upload a photo, or retry.';
      setCameraError(msg);
      return;
    }

    streamRef.current = stream;
    const video = videoRef.current;
    if (video) {
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('autoplay', 'true');

      const tryPlay = async () => {
        try {
          await video.play();
          setCameraReady(true);
        } catch (playErr) {
          console.warn('Autoplay failed, waiting for user gesture:', playErr);
        }
      };

      video.onloadedmetadata = () => { tryPlay(); };
      video.oncanplay = () => { tryPlay(); };
      video.onplaying = () => { setCameraReady(true); };

      tryPlay();
    }

    refreshDevices();
  }, [selectedDeviceId, stopStream, refreshDevices]);

  // Lifecycle
  useEffect(() => {
    startCamera();
    return () => {
      stopStream();
    };
  }, []);

  // Handle camera switch
  const handleDeviceChange = (newDeviceId: string) => {
    setSelectedDeviceId(newDeviceId);
    startCamera(newDeviceId);
  };

  // Flip mirror mode
  const toggleMirror = () => {
    setIsMirrored(prev => !prev);
  };

  // Capture photo from live video
  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video) return;

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    setCapturing(true);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      if (isMirrored) {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, width, height);
      const photoBase64 = canvas.toDataURL('image/jpeg', 0.85);
      setCapturedPreview(photoBase64);

      try {
        await onCapture(photoBase64);
      } finally {
        setCapturing(false);
      }
    } else {
      setCapturing(false);
    }
  };

  // Fallback: Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const photoBase64 = ev.target?.result as string;
      if (photoBase64) {
        setCapturedPreview(photoBase64);
        setCapturing(true);
        try {
          await onCapture(photoBase64);
        } finally {
          setCapturing(false);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const isHttpBlocked = cameraError === 'HTTP_INSECURE_BLOCKED';

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(15, 23, 42, 0.82)',
        backdropFilter: 'blur(6px)',
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
          borderRadius: '24px',
          padding: '28px 24px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.45)',
          textAlign: 'center',
          maxHeight: '94vh',
          overflowY: 'auto'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '6px' }}>
          <span style={{ fontSize: '22px' }}>📷</span>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
            {title}
          </h2>
        </div>

        <p style={{ margin: '0 0 14px', color: '#64748b', fontSize: '13px', lineHeight: 1.45 }}>
          {message}
        </p>

        {/* Camera Selector & Controls Toolbar (Only if camera is supported) */}
        {!isHttpBlocked && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            marginBottom: '10px',
            padding: '4px 6px'
          }}>
            {videoDevices.length > 1 ? (
              <select
                value={selectedDeviceId}
                onChange={(e) => handleDeviceChange(e.target.value)}
                style={{
                  fontSize: '12px',
                  padding: '6px 8px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#334155',
                  flex: 1,
                  maxWidth: '220px',
                  cursor: 'pointer'
                }}
              >
                {videoDevices.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label || `Camera ${i + 1}`}
                  </option>
                ))}
              </select>
            ) : (
              <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>🎥 Active Camera</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={toggleMirror}
                title="Flip Mirror"
                style={{
                  fontSize: '11.5px',
                  padding: '5px 9px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  background: isMirrored ? '#e0e7ff' : '#ffffff',
                  color: isMirrored ? '#3730a3' : '#475569',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                🪞 {isMirrored ? 'Mirrored' : 'Normal'}
              </button>

              <button
                type="button"
                onClick={() => startCamera()}
                title="Restart Video Feed"
                style={{
                  fontSize: '11.5px',
                  padding: '5px 9px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  color: '#334155',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                🔄 Refresh
              </button>
            </div>
          </div>
        )}

        {/* Video / Photo Container */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '4 / 3',
            background: isHttpBlocked ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' : '#020617',
            borderRadius: '16px',
            overflow: 'hidden',
            margin: '0 auto 12px',
            boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {/* Captured Photo Preview */}
          {capturedPreview ? (
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <img
                src={capturedPreview}
                alt="Captured Face"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
              <div style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: '#16a34a',
                color: '#ffffff',
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 700,
                boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
              }}>
                ✓ Photo Ready
              </div>
            </div>
          ) : isHttpBlocked ? (
            /* Friendly HTTP Notice Screen instead of black box */
            <div style={{
              padding: '24px 20px',
              textAlign: 'center',
              color: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(59, 130, 246, 0.15)',
                border: '2px solid rgba(59, 130, 246, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px',
                marginBottom: '12px'
              }}>
                📷
              </div>
              <h4 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700 }}>
                Live Webcam Blocked by Browser
              </h4>
              <p style={{ margin: '0 0 16px', fontSize: '12.5px', color: '#94a3b8', lineHeight: 1.45, maxWidth: '340px' }}>
                Chrome & Edge disable live webcam on plain HTTP (<code>http://187.127.163.34</code>) without SSL.
              </p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    padding: '9px 18px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(37,99,235,0.4)'
                  }}
                >
                  📁 Snap / Upload Photo
                </button>
                {onSkip && (
                  <button
                    type="button"
                    onClick={onSkip}
                    style={{
                      background: 'rgba(255,255,255,0.12)',
                      color: '#ffffff',
                      border: '1px solid rgba(255,255,255,0.25)',
                      padding: '9px 16px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Skip & Enter →
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Live Camera Stream */
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  display: 'block',
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: isMirrored ? 'scaleX(-1)' : 'none'
                }}
              />

              {/* Face Oval Alignment Guide */}
              {cameraReady && !cameraError && (
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '170px',
                    height: '210px',
                    border: '2.5px dashed rgba(59, 130, 246, 0.85)',
                    borderRadius: '85px',
                    pointerEvents: 'none',
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.22)'
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(15, 23, 42, 0.75)',
                    color: '#60a5fa',
                    fontSize: '10.5px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    whiteSpace: 'nowrap',
                    fontWeight: 600
                  }}>
                    Align Face Here
                  </div>
                </div>
              )}

              {/* Connecting State */}
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
                    gap: '8px',
                    background: 'rgba(2, 6, 23, 0.9)'
                  }}
                >
                  <div style={{ fontSize: '26px' }}>⏳</div>
                  <span style={{ fontWeight: 600 }}>Initializing Camera Stream...</span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Please accept camera permissions if prompted</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Helpful Tip Box */}
        {isHttpBlocked ? (
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '10px 14px',
            marginBottom: '14px',
            fontSize: '12px',
            color: '#334155',
            textAlign: 'left',
            lineHeight: 1.5
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>💡 Want live webcam streaming on this IP?</strong>
              <button
                type="button"
                onClick={() => setShowChromeTip(!showChromeTip)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  fontWeight: 600,
                  fontSize: '11.5px',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                {showChromeTip ? 'Hide 1-Minute Chrome Tip' : 'Show 1-Minute Chrome Tip'}
              </button>
            </div>
            {showChromeTip && (
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e2e8f0', fontSize: '11.5px', color: '#475569' }}>
                <p style={{ margin: '0 0 4px' }}>In Chrome or Edge, you can allow webcam on HTTP with 1 toggle:</p>
                <ol style={{ margin: '0 0 6px', paddingLeft: '18px' }}>
                  <li>Open a new tab: <code style={{ background: '#e2e8f0', padding: '1px 4px', borderRadius: '4px' }}>chrome://flags/#unsafely-treat-insecure-origin-as-secure</code></li>
                  <li>Paste this URL: <code style={{ background: '#e2e8f0', padding: '1px 4px', borderRadius: '4px' }}>http://187.127.163.34</code></li>
                  <li>Select <strong>Enabled</strong> and click <strong>Relaunch</strong>.</li>
                </ol>
                <p style={{ margin: 0, fontStyle: 'italic' }}>Or simply click <strong>Skip for now →</strong> below to enter the dashboard immediately!</p>
              </div>
            )}
          </div>
        ) : cameraReady && !cameraError ? (
          <p style={{ margin: '0 0 14px', color: '#16a34a', fontSize: '13px', fontWeight: 600 }}>
            ✓ Camera stream live! Position your face inside the frame.
          </p>
        ) : cameraError ? (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              padding: '10px 14px',
              borderRadius: '10px',
              fontSize: '12.5px',
              marginBottom: '14px',
              textAlign: 'left'
            }}
          >
            <p style={{ margin: '0 0 4px', fontWeight: 700 }}>⚠️ Camera Access Notice</p>
            <p style={{ margin: '0 0 8px', lineHeight: 1.4 }}>{cameraError}</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => startCamera()}
                style={{
                  background: '#ffffff',
                  border: '1px solid #f87171',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#b91c1c',
                  cursor: 'pointer'
                }}
              >
                🔄 Retry Camera
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  background: '#b91c1c',
                  border: 'none',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#ffffff',
                  cursor: 'pointer'
                }}
              >
                📁 Upload Photo Instead
              </button>
            </div>
          </div>
        ) : null}

        {/* Hidden File Input for Image Upload Fallback */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="user"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {!isHttpBlocked && (
            <button
              type="button"
              onClick={capturePhoto}
              disabled={capturing || (!cameraReady && !cameraError)}
              style={{
                width: '100%',
                padding: '13px',
                border: 'none',
                borderRadius: '10px',
                background: capturing ? '#94a3b8' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#ffffff',
                fontSize: '15px',
                fontWeight: 700,
                cursor: capturing ? 'default' : 'pointer',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                transition: 'all 0.15s ease'
              }}
            >
              {capturing ? 'Processing Photo...' : '📸 Capture Photo & Proceed'}
            </button>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', alignItems: 'center', marginTop: '2px' }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                background: 'none',
                border: 'none',
                color: '#2563eb',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              📁 Upload selfie photo instead
            </button>

            {onSkip && (
              <>
                <span style={{ color: '#cbd5e1' }}>•</span>
                <button
                  type="button"
                  onClick={onSkip}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '5px 12px',
                    color: '#0f172a',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Skip for now & Continue →
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={capturing}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '12.5px',
              fontWeight: 500,
              cursor: 'pointer',
              padding: '4px',
              marginTop: '4px'
            }}
          >
            Cancel and Return to Login
          </button>
        </div>
      </section>
    </div>
  );
}
