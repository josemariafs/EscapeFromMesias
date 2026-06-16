import { useCallback, useEffect, useRef, useState } from 'react';
import type { Task } from '../types';
import type { Translations } from '../i18n/translations';
import { extractTextFromImages, getImagesFromClipboardEvent } from '../utils/screenshotOcr';
import { matchTasksInText } from '../utils/taskImport';

interface ScreenshotImportButtonProps {
  tasks: Task[];
  t: Translations;
  onImport: (taskIds: string[]) => void;
}

export function ScreenshotImportButton({ tasks, t, onImport }: ScreenshotImportButtonProps) {
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const listeningRef = useRef(false);

  const processImages = useCallback(async (images: Blob[]) => {
    if (images.length === 0) {
      setStatus(t.importScreenshotNoImage);
      return;
    }

    setProcessing(true);
    setStatus(t.importScreenshotProcessing);

    try {
      const text = await extractTextFromImages(images);
      const matched = matchTasksInText(text, tasks);

      if (matched.length === 0) {
        setStatus(t.importScreenshotNoMatch);
        return;
      }

      onImport(matched.map((task) => task.id));
      setStatus(t.importScreenshotResult(matched.length));
    } catch {
      setStatus(t.importScreenshotError);
    } finally {
      setProcessing(false);
      setListening(false);
      listeningRef.current = false;
    }
  }, [onImport, t, tasks]);

  useEffect(() => {
    if (!listening) return;

    const onPaste = (event: ClipboardEvent) => {
      if (!listeningRef.current) return;
      event.preventDefault();
      const images = getImagesFromClipboardEvent(event);
      void processImages(images);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        listeningRef.current = false;
        setListening(false);
        setStatus(null);
      }
    };

    const timeout = window.setTimeout(() => {
      listeningRef.current = false;
      setListening(false);
      setStatus(null);
    }, 30000);

    window.addEventListener('paste', onPaste);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('keydown', onKeyDown);
      window.clearTimeout(timeout);
    };
  }, [listening, processImages]);

  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => setStatus(null), 5000);
    return () => window.clearTimeout(timer);
  }, [status]);

  const handleClick = () => {
    if (processing) return;
    listeningRef.current = true;
    setListening(true);
    setStatus(t.importScreenshotHint);
  };

  return (
    <div className="screenshot-import">
      <button
        type="button"
        className={`btn btn-import${listening ? ' listening' : ''}${processing ? ' processing' : ''}`}
        onClick={handleClick}
        disabled={processing}
        title={t.importScreenshot}
        aria-label={t.importScreenshot}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path
            fill="currentColor"
            d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"
          />
        </svg>
        <span className="btn-import-label">{t.importScreenshot}</span>
      </button>
      {status && (
        <span className="screenshot-import-status" role="status">
          {status}
        </span>
      )}
    </div>
  );
}
