import { useEffect, useRef } from 'react';

export const CRT_TRANSITION_MS = 700;

interface CrtViewTransitionProps {
  active: boolean;
  /** Cambia en cada transición para reiniciar la animación CSS. */
  playId: number;
}

/** Overlay CRT de cambio de canal (0,7s) con logo parpadeante. */
export function CrtViewTransition({ active, playId }: CrtViewTransitionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const w = 160;
    const h = 90;
    canvas.width = w;
    canvas.height = h;

    let frame = 0;
    let raf = 0;
    const image = ctx.createImageData(w, h);
    const data = image.data;

    const draw = () => {
      frame += 1;
      for (let i = 0; i < data.length; i += 4) {
        const n = (Math.random() * 230) | 0;
        const row = (i / 4 / w) | 0;
        const tear = row % 8 === frame % 8 ? 40 : 0;
        const v = Math.min(255, n + tear);
        data[i] = v * 0.8;
        data[i + 1] = v;
        data[i + 2] = v * 0.85;
        data[i + 3] = 255;
      }
      ctx.putImageData(image, 0, 0);
      raf = window.requestAnimationFrame(draw);
    };

    draw();
    return () => window.cancelAnimationFrame(raf);
  }, [active, playId]);

  if (!active) return null;

  return (
    <div className="crt-transition" key={playId} aria-hidden>
      <canvas ref={canvasRef} className="crt-transition-noise" />
      <div className="crt-transition-scanlines" />
      <div className="crt-transition-roll" />
      <div className="crt-transition-vignette" />
      <img
        src="/logo.png"
        alt=""
        className="crt-transition-logo"
        draggable={false}
      />
    </div>
  );
}
