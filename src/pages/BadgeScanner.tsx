/**
 * "Scan my badge" on the sign-in page: the camera looks for a QR sign-in badge and, when it sees one, opens its page.
 * Loaded only when a pupil taps the button (the QR reader is about 130 KB).
 */
import jsQR from 'jsqr';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { codeFromScan } from '../data/badge';

export default function BadgeScanner({ onClose }: { onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();
  const [problem, setProblem] = useState<string | null>(null);
  const [notBadge, setNotBadge] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const look = () => {
      if (stopped) return;
      const v = video.current;
      if (v && ctx && v.readyState >= 2 && v.videoWidth) {
        // A smaller picture is quicker to read and still plenty for a card held up to the camera.
        const scale = Math.min(1, 640 / v.videoWidth);
        canvas.width = Math.round(v.videoWidth * scale);
        canvas.height = Math.round(v.videoHeight * scale);
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const found = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, {
          inversionAttempts: 'dontInvert',
        });
        if (found) {
          const code = codeFromScan(found.data);
          if (code) {
            stopped = true;
            navigate(`/badge/${code}`, { replace: true });
            return;
          }
          setNotBadge(true);
        }
      }
      frame = requestAnimationFrame(look);
    };

    if (!navigator.mediaDevices?.getUserMedia) {
      setProblem('This device can’t use its camera here. Ask your teacher.');
      return;
    }
    // The camera on the screen's side, so the pupil can see themselves holding the card up.
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((s) => {
        if (stopped) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play().catch(() => {});
        }
        frame = requestAnimationFrame(look);
      })
      .catch(() => setProblem('The camera is off. Ask your teacher to let this site use the camera.'));

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [navigate]);

  return (
    <div className="badge-scan" role="dialog" aria-modal="true" aria-labelledby="badge-scan-title">
      <h2 id="badge-scan-title">Hold your badge up to the camera</h2>
      {problem ? (
        <p className="badge-scan__problem" role="alert">{problem}</p>
      ) : (
        <div className="badge-scan__view">
          <video ref={video} className="badge-scan__video" muted playsInline aria-label="Camera" />
          <div className="badge-scan__frame" aria-hidden="true" />
        </div>
      )}
      {notBadge && !problem && <p role="status">That QR code isn’t a sign-in badge.</p>}
      <button type="button" className="button button--light-outline" onClick={onClose}>
        Close
      </button>
    </div>
  );
}
