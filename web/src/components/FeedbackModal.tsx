import { useCallback, useEffect, useId, useRef, useState, type ChangeEvent, type ClipboardEvent, type FormEvent } from 'react';
import { submitFeedback } from '../api/feedback';
import type { Translations } from '../i18n/translations';
import { fileToCompressedDataUrl } from '../utils/routePointImage';

const MAX_IMAGES = 4;

function formatFeedbackError(raw: string, fallback: string): string {
  if (!raw || raw === 'network' || raw === 'session' || raw.startsWith('http_')) {
    return fallback;
  }
  if (/RESEND_API_KEY|ADMIN_EMAIL|not configured/i.test(raw)) {
    return fallback;
  }
  // Errores de Resend / validación: mostrar detalle útil (p. ej. destinatario no permitido).
  if (/Email provider error/i.test(raw) || /you can only send/i.test(raw) || /verify a domain/i.test(raw)) {
    const cleaned = raw.replace(/^Email provider error \(\d+\):\s*/i, '').trim();
    try {
      const parsed = JSON.parse(cleaned) as { message?: string };
      if (parsed.message) return parsed.message;
    } catch {
      // ignore
    }
    return cleaned || fallback;
  }
  return raw.length > 220 ? `${raw.slice(0, 220)}…` : raw;
}

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
  t: Translations;
}

export function FeedbackModal({ open, onClose, t }: FeedbackModalProps) {
  const titleId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const reset = useCallback(() => {
    setTitle('');
    setMessage('');
    setImages([]);
    setBusy(false);
    setError(null);
    setDone(false);
  }, []);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, busy, reset]);

  const addImageFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (!list.length) return;

    setError(null);
    const next: string[] = [];
    for (const file of list) {
      if (images.length + next.length >= MAX_IMAGES) break;
      try {
        next.push(await fileToCompressedDataUrl(file));
      } catch {
        setError(t.feedbackImageError);
        return;
      }
    }
    if (next.length) {
      setImages((prev) => [...prev, ...next].slice(0, MAX_IMAGES));
    }
  }, [images.length, t.feedbackImageError]);

  const handlePaste = useCallback(async (event: ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (!files.length) return;
    event.preventDefault();
    await addImageFiles(files);
  }, [addImageFiles]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files?.length) await addImageFiles(files);
    event.target.value = '';
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const trimmedTitle = title.trim();
    const trimmedMessage = message.trim();
    if (!trimmedTitle || !trimmedMessage) {
      setError(t.feedbackRequired);
      return;
    }

    setBusy(true);
    setError(null);
    const result = await submitFeedback({
      title: trimmedTitle,
      message: trimmedMessage,
      images,
    });
    setBusy(false);

    if (!result.ok) {
      setError(formatFeedbackError(result.error, t.feedbackSendError));
      return;
    }
    setDone(true);
  };

  if (!open) return null;

  return (
    <div className="feedback-modal-backdrop" role="presentation" onClick={() => !busy && onClose()}>
      <div
        className="feedback-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        onPaste={(event) => { void handlePaste(event); }}
      >
        <header className="feedback-modal-header">
          <h2 id={titleId}>{t.feedbackTitle}</h2>
          <button
            type="button"
            className="feedback-modal-close"
            onClick={onClose}
            disabled={busy}
            aria-label={t.feedbackClose}
          >
            ×
          </button>
        </header>

        {done ? (
          <div className="feedback-modal-body">
            <p className="feedback-modal-success">{t.feedbackSuccess}</p>
            <button type="button" className="btn btn-start" onClick={onClose}>
              {t.feedbackClose}
            </button>
          </div>
        ) : (
          <form className="feedback-modal-body" onSubmit={(event) => { void handleSubmit(event); }}>
            <label className="feedback-field">
              <span>{t.feedbackFieldTitle}</span>
              <input
                type="text"
                value={title}
                maxLength={120}
                autoFocus
                disabled={busy}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t.feedbackFieldTitlePlaceholder}
              />
            </label>

            <label className="feedback-field">
              <span>{t.feedbackFieldMessage}</span>
              <textarea
                value={message}
                maxLength={4000}
                rows={5}
                disabled={busy}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={t.feedbackFieldMessagePlaceholder}
              />
            </label>

            <div className="feedback-field">
              <span>{t.feedbackAttachments}</span>
              <p className="feedback-hint">{t.feedbackAttachmentsHint}</p>
              <div className="feedback-attach-actions">
                <button
                  type="button"
                  className="btn"
                  disabled={busy || images.length >= MAX_IMAGES}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {t.feedbackUpload}
                </button>
                <span className="feedback-attach-count">
                  {images.length}/{MAX_IMAGES}
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(event) => { void handleFileChange(event); }}
              />
              {images.length > 0 && (
                <ul className="feedback-thumbs">
                  {images.map((src, index) => (
                    <li key={`${index}-${src.slice(0, 24)}`}>
                      <img src={src} alt="" />
                      <button
                        type="button"
                        className="feedback-thumb-remove"
                        onClick={() => removeImage(index)}
                        disabled={busy}
                        aria-label={t.feedbackRemoveImage}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {error ? <p className="feedback-modal-error">{error}</p> : null}

            <div className="feedback-modal-actions">
              <button type="button" className="btn" onClick={onClose} disabled={busy}>
                {t.feedbackCancel}
              </button>
              <button type="submit" className="btn btn-start" disabled={busy}>
                {busy ? t.feedbackSending : t.feedbackSend}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
