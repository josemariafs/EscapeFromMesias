import { useEffect, useRef, useState } from 'react';
import { fetchDailyAccessCode } from '../api/siteAuth';

interface DailyCodeModalProps {
  open: boolean;
  onClose: () => void;
}

export function DailyCodeModal({ open, onClose }: DailyCodeModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [code, setCode] = useState<string | null>(null);
  const [dayKey, setDayKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setCode(null);

    void (async () => {
      const result = await fetchDailyAccessCode();
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.error === 'forbidden' ? 'ACCESS RESTRICTED' : 'SIGNAL LOST');
        return;
      }
      setCode(result.code);
      setDayKey(result.dayKey);
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const w = 180;
    const h = 102;
    canvas.width = w;
    canvas.height = h;

    let frame = 0;
    let raf = 0;
    const image = ctx.createImageData(w, h);
    const data = image.data;

    const draw = () => {
      frame += 1;
      for (let i = 0; i < data.length; i += 4) {
        const n = (Math.random() * 220) | 0;
        const row = (i / 4 / w) | 0;
        const tear = row % 9 === frame % 9 ? 18 : 0;
        const v = Math.min(255, n + tear);
        data[i] = v * 0.85;
        data[i + 1] = v;
        data[i + 2] = v * 0.9;
        data[i + 3] = 255;
      }
      ctx.putImageData(image, 0, 0);
      raf = window.requestAnimationFrame(draw);
    };

    draw();
    return () => window.cancelAnimationFrame(raf);
  }, [open]);

  if (!open) return null;

  return (
    <div className="tv-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="tv-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-code-title"
        onClick={(event) => event.stopPropagation()}
      >
        <canvas ref={canvasRef} className="tv-login-noise" aria-hidden />
        <div className="tv-login-scanlines" aria-hidden />
        <div className="tv-login-vignette" aria-hidden />
        <div className="tv-login-glow" aria-hidden />

        <div className="tv-modal-panel">
          <p className="tv-login-eyebrow">CH-04 // DAILY KEY</p>
          <h2 id="daily-code-title" className="tv-login-title">
            TODAY'S ACCESS CODE
          </h2>
          <p className="tv-login-status">
            {loading
              ? 'TUNING FREQUENCY…'
              : error
                ? error
                : 'VALID UNTIL 05:00 EUROPE/MADRID'}
          </p>

          <div className="tv-modal-code" aria-live="polite">
            {loading ? '····' : error ? '----' : code}
          </div>

          {dayKey && !error && (
            <p className="tv-modal-day">DAY {dayKey}</p>
          )}

          <button type="button" className="tv-login-submit" onClick={onClose}>
            CLOSE CHANNEL
          </button>
        </div>
      </div>
    </div>
  );
}
