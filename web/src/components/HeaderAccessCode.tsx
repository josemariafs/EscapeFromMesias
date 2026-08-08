import { useState } from 'react';
import { fetchDailyAccessCode } from '../api/siteAuth';

interface HeaderAccessCodeProps {
  enabled: boolean;
}

export function HeaderAccessCode({ enabled }: HeaderAccessCodeProps) {
  const [revealed, setRevealed] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  if (!enabled) return null;

  const reveal = async () => {
    if (revealed && code) {
      setRevealed(false);
      return;
    }
    if (code) {
      setRevealed(true);
      return;
    }

    setLoading(true);
    setError(false);
    const result = await fetchDailyAccessCode();
    setLoading(false);
    if (!result.ok) {
      setError(true);
      setRevealed(true);
      return;
    }
    setCode(result.code);
    setRevealed(true);
  };

  if (revealed) {
    return (
      <button
        type="button"
        className={`header-access-code header-access-code--revealed${error ? ' is-error' : ''}`}
        onClick={() => setRevealed(false)}
        title="Hide access code"
        aria-label="Hide access code"
      >
        <span className="header-access-code-crt" aria-hidden>
          <span className="header-access-code-scanlines" />
          <span className="header-access-code-glow" />
        </span>
        <span className="header-access-code-digits">
          {loading ? '…' : error ? '—' : code}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className="header-access-code"
      onClick={() => void reveal()}
      disabled={loading}
    >
      {loading ? '…' : 'Access Code'}
    </button>
  );
}
