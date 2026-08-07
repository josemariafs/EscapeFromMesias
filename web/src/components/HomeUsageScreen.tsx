import { useState } from 'react';
import type { Translations } from '../i18n/translations';
import { DailyCodeModal } from './DailyCodeModal';

export type HomeUsageChoice = 'pvp' | 'seasonal' | 'routes';

interface HomeUsageScreenProps {
  t: Translations;
  onChoose: (choice: HomeUsageChoice) => void;
  canRevealDailyCode?: boolean;
}

function IconRoutes() {
  return (
    <svg className="home-usage-card-icon" viewBox="0 0 64 64" aria-hidden>
      <defs>
        <radialGradient id="home-icon-routes-metal" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#c8d4d8" />
          <stop offset="45%" stopColor="#7a8a90" />
          <stop offset="100%" stopColor="#3a454a" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="url(#home-icon-routes-metal)" stroke="#1a2226" strokeWidth="2" />
      <circle cx="32" cy="32" r="24" fill="#1c282c" stroke="#6a7a80" strokeWidth="1.5" />
      <path
        d="M22 40c4-10 8-14 14-14s8 6 12 4"
        fill="none"
        stroke="#9fd9cf"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="22" cy="40" r="3.5" fill="#9fd9cf" />
      <circle cx="36" cy="26" r="3.5" fill="#9fd9cf" />
      <path d="M48 24l-4 10 10-4-8-2z" fill="#c5e8e0" />
    </svg>
  );
}

function IconPvp() {
  return (
    <svg className="home-usage-card-icon" viewBox="0 0 64 64" aria-hidden>
      <defs>
        <radialGradient id="home-icon-pvp-metal" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#d0d6d8" />
          <stop offset="45%" stopColor="#808890" />
          <stop offset="100%" stopColor="#3c4248" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="url(#home-icon-pvp-metal)" stroke="#1a2226" strokeWidth="2" />
      <circle cx="32" cy="32" r="22" fill="none" stroke="#5a656c" strokeWidth="3" strokeDasharray="4 3" />
      <circle cx="32" cy="32" r="18" fill="#1a2428" stroke="#8a949a" strokeWidth="1.2" />
      <path
        d="M32 16c-6 0-10 5-10 11 0 5 3 9 6 12l4 5 4-5c3-3 6-7 6-12 0-6-4-11-10-11z"
        fill="#9aa4aa"
      />
      <path d="M26 30h12M28 35c2 3 6 3 8 0" fill="none" stroke="#1a2428" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="28" cy="28" r="1.4" fill="#1a2428" />
      <circle cx="36" cy="28" r="1.4" fill="#1a2428" />
    </svg>
  );
}

function IconSeasonal() {
  return (
    <svg className="home-usage-card-icon" viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="home-icon-season-metal" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8fd4c8" />
          <stop offset="45%" stopColor="#4a7a74" />
          <stop offset="100%" stopColor="#2a403c" />
        </linearGradient>
      </defs>
      <path
        d="M32 4 56 18v28L32 60 8 46V18Z"
        fill="url(#home-icon-season-metal)"
        stroke="#1a2226"
        strokeWidth="2"
      />
      <path d="M32 12 48 22v20L32 52 16 42V22Z" fill="#1a282c" stroke="#6a9a92" strokeWidth="1.2" />
      <path
        d="M32 20c-5 0-8 4-8 8 0 4 2 7 5 10l3 4 3-4c3-3 5-6 5-10 0-4-3-8-8-8z"
        fill="#a8c4c0"
      />
      <path d="M27 34h10v4c0 2-2 4-5 4s-5-2-5-4v-4z" fill="#6a8a86" />
      <path d="M24 28h16" stroke="#1a282c" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function HomeUsageScreen({
  t,
  onChoose,
  canRevealDailyCode = false,
}: HomeUsageScreenProps) {
  const [dailyOpen, setDailyOpen] = useState(false);

  return (
    <div className="home-usage">
      <div className="home-usage-hero">
        <img src="/logo.png" alt={t.appTitle} className="home-usage-logo" />
      </div>

      <div className="home-usage-strip" role="list">
        <button
          type="button"
          className="home-usage-card home-usage-card--routes"
          role="listitem"
          title={t.homeRoutesHint}
          onClick={() => onChoose('routes')}
        >
          <IconRoutes />
          <span className="home-usage-card-text">
            <strong className="home-usage-card-title">{t.homeCardRoutes}</strong>
            <span className="home-usage-card-tag">{t.homeCardTagRoutes}</span>
          </span>
        </button>

        <button
          type="button"
          className="home-usage-card home-usage-card--pvp"
          role="listitem"
          title={t.gameModeHint.regular}
          onClick={() => onChoose('pvp')}
        >
          <IconPvp />
          <span className="home-usage-card-text">
            <strong className="home-usage-card-title">{t.homeCardPvp}</strong>
            <span className="home-usage-card-tag">{t.homeCardTagRegular}</span>
          </span>
        </button>

        <button
          type="button"
          className="home-usage-card home-usage-card--seasonal"
          role="listitem"
          title={t.gameModeHint.seasonal}
          onClick={() => onChoose('seasonal')}
        >
          <IconSeasonal />
          <span className="home-usage-card-text">
            <strong className="home-usage-card-title">{t.homeCardSeasonal}</strong>
            <span className="home-usage-card-tag">{t.homeCardTagSeasonal}</span>
          </span>
          <span className="home-usage-card-info" aria-hidden>i</span>
        </button>
      </div>

      {canRevealDailyCode && (
        <button
          type="button"
          className="home-daily-code-btn"
          onClick={() => setDailyOpen(true)}
        >
          Daily access code
        </button>
      )}

      <DailyCodeModal open={dailyOpen} onClose={() => setDailyOpen(false)} />
    </div>
  );
}
