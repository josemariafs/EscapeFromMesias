import { useCallback, useState } from 'react';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { useFixedRouteMaps } from '../hooks/useFixedRouteMaps';
import { useMapExtracts } from '../hooks/useMapExtracts';
import { useLanguage } from '../i18n/useLanguage';
import type { GameMode } from '../types';
import {
  allowsFixedPointLabel,
  DEFAULT_FIXED_MARKER_TYPE,
  DEFAULT_ROUTE_POINT_COLOR,
  isLabellessMarkerType,
  type FixedMarkerType,
  type RouteEnvironment,
} from '../types/routes';
import { fileToCompressedDataUrl } from '../utils/routePointImage';
import { AdminLoginCard } from './AdminLoginCard';
import { RouteMapsView } from './RouteMapsView';

export function AdminRoutesPage() {
  const { lang, t } = useLanguage();
  const auth = useAdminAuth();
  const [environment, setEnvironment] = useState<RouteEnvironment>('seasonal');
  const fixed = useFixedRouteMaps(environment);
  const extractGameMode: GameMode = environment === 'regular' ? 'regular' : 'seasonal';
  const mapExtracts = useMapExtracts(lang, extractGameMode);
  const [selectedMapKey, setSelectedMapKey] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string>(DEFAULT_ROUTE_POINT_COLOR);
  const [draftLabel, setDraftLabel] = useState('');
  const [draftImageUrl, setDraftImageUrl] = useState<string | null>(null);
  const [draftMarkerType, setDraftMarkerType] = useState<FixedMarkerType>(DEFAULT_FIXED_MARKER_TYPE);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const token = auth.token;
  const fixedPoints = selectedMapKey ? fixed.getPoints(selectedMapKey) : [];

  const handleEnvironmentChange = (next: RouteEnvironment) => {
    if (next === environment) return;
    setEnvironment(next);
    setSelectedMapKey(null);
    setActionError(null);
  };

  const handleLogout = () => {
    auth.logout();
    setSelectedMapKey(null);
  };

  const handleAddPoint = useCallback(async (left: number, top: number) => {
    if (!selectedMapKey || !token) return;
    setBusy(true);
    setActionError(null);
    try {
      await fixed.addPoint(token, {
        mapKey: selectedMapKey,
        left,
        top,
        color: selectedColor,
        label: allowsFixedPointLabel(draftMarkerType) ? (draftLabel.trim() || null) : null,
        imageUrl: draftImageUrl,
        markerType: draftMarkerType,
        environment,
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t.adminLoginError);
    } finally {
      setBusy(false);
    }
  }, [
    draftImageUrl,
    draftLabel,
    draftMarkerType,
    environment,
    fixed,
    selectedColor,
    selectedMapKey,
    t.adminLoginError,
    token,
  ]);

  const handleRemoveFixed = useCallback(async (pointId: string) => {
    if (!token) return;
    if (!window.confirm(t.adminDeletePoint)) return;
    setBusy(true);
    setActionError(null);
    try {
      await fixed.removePoint(token, pointId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t.adminLoginError);
    } finally {
      setBusy(false);
    }
  }, [fixed, t.adminDeletePoint, t.adminLoginError, token]);

  const handleMoveFixed = useCallback(async (pointId: string, left: number, top: number) => {
    if (!token) return;
    setActionError(null);
    try {
      await fixed.patchPoint(token, pointId, { left, top });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t.adminLoginError);
    }
  }, [fixed, t.adminLoginError, token]);

  const handleUpdateLabel = useCallback(async (pointId: string, label: string) => {
    if (!token) return;
    setBusy(true);
    setActionError(null);
    try {
      await fixed.patchPoint(token, pointId, { label: label || null });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t.adminLoginError);
    } finally {
      setBusy(false);
    }
  }, [fixed, t.adminLoginError, token]);

  const handleUpdateImage = useCallback(async (pointId: string, imageUrl: string | null) => {
    if (!token) return;
    setBusy(true);
    setActionError(null);
    try {
      await fixed.patchPoint(token, pointId, { imageUrl });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t.adminLoginError);
    } finally {
      setBusy(false);
    }
  }, [fixed, t.adminLoginError, token]);

  const handleUpdateMarkerType = useCallback(async (pointId: string, markerType: FixedMarkerType) => {
    if (!token) return;
    setBusy(true);
    setActionError(null);
    try {
      await fixed.patchPoint(token, pointId, {
        markerType,
        ...(isLabellessMarkerType(markerType) ? { label: null } : {}),
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t.adminLoginError);
    } finally {
      setBusy(false);
    }
  }, [fixed, t.adminLoginError, token]);

  const handleDraftImageFile = useCallback(async (file: File | null) => {
    if (!file) {
      setDraftImageUrl(null);
      return;
    }
    setActionError(null);
    try {
      setDraftImageUrl(await fileToCompressedDataUrl(file));
    } catch {
      setActionError(t.adminPointImageError);
    }
  }, [t.adminPointImageError]);

  const handlePointImageFile = useCallback(async (pointId: string, file: File | null) => {
    if (!file) {
      await handleUpdateImage(pointId, null);
      return;
    }
    setActionError(null);
    try {
      const imageUrl = await fileToCompressedDataUrl(file);
      await handleUpdateImage(pointId, imageUrl);
    } catch {
      setActionError(t.adminPointImageError);
    }
  }, [handleUpdateImage, t.adminPointImageError]);

  if (auth.status === 'checking') {
    return (
      <div className="admin-routes-page admin-routes-page--login">
        <p className="admin-muted">{t.adminWorking}</p>
      </div>
    );
  }

  if (auth.status === 'locked') {
    return (
      <div className="admin-routes-page admin-routes-page--login">
        <AdminLoginCard
          title={t.adminLoginTitle}
          subtitle={t.adminRoutesHint}
          loginValue={auth.loginValue}
          onLoginValueChange={auth.setLoginValue}
          onSubmit={auth.login}
          loggingIn={auth.loggingIn}
          error={auth.loginError ? t.adminLoginError : null}
        />
        <a className="admin-back-link" href="/">{t.routesBackToMaps}</a>
      </div>
    );
  }

  return (
    <div className="admin-routes-page">
      <header className="admin-routes-toolbar">
        <div className="admin-routes-toolbar-main">
          <a className="admin-brand" href="/" title={t.appTitle}>
            <img src="/logo.png" alt={t.appTitle} className="admin-brand-logo" />
          </a>
          <div className="admin-routes-toolbar-title">
            <p className="admin-eyebrow">Admin</p>
            <h1>{t.adminRoutesTitle}</h1>
          </div>
          <div className="segmented admin-env-segmented" role="tablist" aria-label={t.routeEnvironmentHint}>
            <button
              type="button"
              role="tab"
              aria-selected={environment === 'regular'}
              className={`segmented-item${environment === 'regular' ? ' active' : ''}`}
              onClick={() => handleEnvironmentChange('regular')}
            >
              {t.routeEnvironmentRegular}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={environment === 'seasonal'}
              className={`segmented-item${environment === 'seasonal' ? ' active' : ''}`}
              onClick={() => handleEnvironmentChange('seasonal')}
            >
              {t.routeEnvironmentSeasonal}
            </button>
          </div>
        </div>
        <nav className="admin-toolbar-nav" aria-label="Admin">
          <a className="admin-toolbar-nav-link" href="/admin">
            {t.adminBackToDashboard}
          </a>
        </nav>
        <div className="admin-routes-toolbar-actions">
          <button type="button" className="btn btn-wipe" onClick={handleLogout}>
            {t.adminLogout}
          </button>
        </div>
      </header>
      {actionError && <p className="admin-action-error">{actionError}</p>}
      <div className="admin-routes-body">
        <RouteMapsView
          mode="admin"
          routes={{}}
          fixedRoutes={fixed.routes}
          selectedMapKey={selectedMapKey}
          onSelectMap={setSelectedMapKey}
          points={[]}
          fixedPoints={fixedPoints}
          mapExtracts={
            selectedMapKey ? mapExtracts.extracts[selectedMapKey] ?? [] : []
          }
          selectedColor={selectedColor}
          colorLabels={{}}
          onChangeColor={setSelectedColor}
          onAddPoint={(left, top) => { void handleAddPoint(left, top); }}
          onRemovePoint={() => {}}
          draftLabel={draftLabel}
          onChangeDraftLabel={setDraftLabel}
          draftImageUrl={draftImageUrl}
          onChangeDraftImageFile={(file) => { void handleDraftImageFile(file); }}
          onClearDraftImage={() => setDraftImageUrl(null)}
          draftMarkerType={draftMarkerType}
          onChangeDraftMarkerType={setDraftMarkerType}
          onRemoveFixedPoint={(id) => { void handleRemoveFixed(id); }}
          onMoveFixedPoint={(id, left, top) => { void handleMoveFixed(id, left, top); }}
          onUpdateFixedLabel={(id, label) => { void handleUpdateLabel(id, label); }}
          onUpdateFixedImage={(id, file) => { void handlePointImageFile(id, file); }}
          onUpdateFixedMarkerType={(id, markerType) => { void handleUpdateMarkerType(id, markerType); }}
          fixedLoading={fixed.loading}
          fixedError={fixed.error}
          busy={busy}
          title={t.adminRoutesTitle}
          hint={
            environment === 'regular'
              ? t.routeEnvironmentRegular
              : t.routeEnvironmentSeasonal
          }
          t={t}
        />
      </div>
    </div>
  );
}
