import { useEffect, useRef, useState, type FormEvent } from 'react';

interface LoginScreenProps {
  error: 'invalid' | 'unavailable' | null;
  failCount: number;
  submitting: boolean;
  onSubmit: (password: string) => Promise<boolean>;
}

export function LoginScreen({ error, failCount, submitting, onSubmit }: LoginScreenProps) {
  const [password, setPassword] = useState('');
  const [shake, setShake] = useState(false);
  const [emptyFails, setEmptyFails] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const showDenied = Boolean(error) || emptyFails > 0;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!error && emptyFails === 0) return;
    setShake(true);
    setPassword('');
    const timer = window.setTimeout(() => {
      setShake(false);
      inputRef.current?.focus();
    }, 520);
    return () => window.clearTimeout(timer);
  }, [error, failCount, emptyFails]);

  useEffect(() => {
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
      const burst = error ? 48 : 12;

      for (let i = 0; i < data.length; i += 4) {
        const n = (Math.random() * 220) | 0;
        const row = (i / 4 / w) | 0;
        const tear = row % 9 === frame % 9 ? burst : 0;
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
  }, [error]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    const value = password.trim();
    if (!value) {
      setEmptyFails((n) => n + 1);
      return;
    }

    await onSubmit(value);
  };

  const statusText =
    error === 'unavailable'
      ? 'SIGNAL LOST — TRY AGAIN'
      : showDenied
        ? 'ACCESS DENIED — RE-ENTER CODE'
        : 'AWAITING ACCESS CODE';

  return (
    <div className={`tv-login${shake ? ' tv-login--shake' : ''}${showDenied ? ' tv-login--error' : ''}`}>
      <canvas ref={canvasRef} className="tv-login-noise" aria-hidden />
      <div className="tv-login-scanlines" aria-hidden />
      <div className="tv-login-vignette" aria-hidden />
      <div className="tv-login-glow" aria-hidden />

      <div className="tv-login-panel">
        <p className="tv-login-eyebrow">CH-07 // NO SIGNAL</p>
        <h1 className="tv-login-title">ESCAPE FROM GORDITOS</h1>
        <p className="tv-login-status" aria-live="polite">
          {statusText}
        </p>

        <form className="tv-login-form" onSubmit={handleSubmit}>
          <label className="tv-login-label" htmlFor="tv-access-code">
            Access code
          </label>
          <input
            ref={inputRef}
            id="tv-access-code"
            className="tv-login-input"
            type="password"
            name="password"
            autoComplete="current-password"
            spellCheck={false}
            value={password}
            disabled={submitting}
            placeholder="········"
            onChange={(event) => setPassword(event.target.value)}
          />
          <button className="tv-login-submit" type="submit" disabled={submitting}>
            {submitting ? 'TUNING…' : 'LOCK ON'}
          </button>
        </form>
      </div>
    </div>
  );
}
