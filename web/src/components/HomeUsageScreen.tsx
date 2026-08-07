import type { Translations } from '../i18n/translations';

export type HomeUsageChoice = 'pvp' | 'seasonal' | 'routes';

interface HomeUsageScreenProps {
  t: Translations;
  onChoose: (choice: HomeUsageChoice) => void;
}

export function HomeUsageScreen({ t, onChoose }: HomeUsageScreenProps) {
  return (
    <div className="home-usage">
      <div className="home-usage-hero">
        <img src="/logo.png" alt={t.appTitle} className="home-usage-logo" />
        <h1>{t.homeChooseTitle}</h1>
        <p>{t.homeChooseHint}</p>
      </div>

      <div className="home-usage-grid" role="list">
        <button
          type="button"
          className="home-usage-card home-usage-card--pvp"
          role="listitem"
          onClick={() => onChoose('pvp')}
        >
          <strong className="home-usage-card-title">PVP</strong>
          <span className="home-usage-card-desc">{t.gameModeHint.regular}</span>
        </button>

        <button
          type="button"
          className="home-usage-card home-usage-card--seasonal"
          role="listitem"
          onClick={() => onChoose('seasonal')}
        >
          <strong className="home-usage-card-title">SEASONAL</strong>
          <span className="home-usage-card-desc">{t.gameModeHint.seasonal}</span>
        </button>

        <button
          type="button"
          className="home-usage-card home-usage-card--routes"
          role="listitem"
          onClick={() => onChoose('routes')}
        >
          <strong className="home-usage-card-title">ROUTES</strong>
          <span className="home-usage-card-desc">{t.homeRoutesHint}</span>
        </button>
      </div>
    </div>
  );
}
