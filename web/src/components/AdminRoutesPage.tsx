import { useCallback, useState, type FormEvent } from 'react';
import { verifyAdminToken } from '../api/fixedRoutes';
import { useFixedRouteMaps } from '../hooks/useFixedRouteMaps';
import { useLanguage } from '../i18n/useLanguage';
import {
  ADMIN_TOKEN_STORAGE_KEY,
  DEFAULT_FIXED_MARKER_TYPE,
  DEFAULT_ROUTE_POINT_COLOR,
  type FixedMarkerType,
} from '../types/routes';
import { fileToCompressedDataUrl } from '../utils/routePointImage';
import { RouteMapsView } from './RouteMapsView';

function readStoredToken(): string {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function AdminRoutesPage() {
  const { t } = useLanguage();
  const fixed = useFixedRouteMaps();
  const [token, setToken] = useState(readStoredToken);
  const [authed, setAuthed] = useState(() => Boolean(readStoredToken()));
  const [loginValue, setLoginValue] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [selectedMapKey, setSelectedMapKey] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string>(DEFAULT_ROUTE_POINT_COLOR);
  const [draftLabel, setDraftLabel] = useState('');
  const [draftImageUrl, setDraftImageUrl] = useState<string | null>(null);
  const [draftMarkerType, setDraftMarkerType] = useState<FixedMarkerType>(DEFAULT_FIXED_MARKER_TYPE);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fixedPoints = selectedMapKey ? fixed.getPoints(selectedMapKey) : [];

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    const next = loginValue.trim();
    if (!next) return;
    setLoggingIn(true);
    setLoginError(null);
    try {
      await verifyAdminToken(next);
      sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, next);
      setToken(next);
      setAuthed(true);
      setLoginValue('');
    } catch {
      setLoginError(t.adminLoginError);
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    setToken('');
    setAuthed(false);
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
        label: draftMarkerType === 'default' ? (draftLabel.trim() || null) : null,
        imageUrl: draftImageUrl,
        markerType: draftMarkerType,
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t.adminLoginError);
    } finally {
      setBusy(false);
    }
  }, [draftImageUrl, draftLabel, draftMarkerType, fixed, selectedColor, selectedMapKey, t.adminLoginError, token]);

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
        ...(markerType !== 'default' ? { label: null } : {}),
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

  if (!authed) {
    return (
      <div className="admin-routes-page admin-routes-page--login">
        <form className="admin-login-card" onSubmit={handleLogin}>
          <h1>{t.adminLoginTitle}</h1>
          <p>{t.adminRoutesHint}</p>
          <label className="admin-login-label">
            {t.adminTokenLabel}
            <input
              type="password"
              autoComplete="current-password"
              value={loginValue}
              placeholder={t.adminTokenPlaceholder}
              onChange={(e) => setLoginValue(e.target.value)}
            />
          </label>
          {loginError && <p className="admin-login-error">{loginError}</p>}
          <button type="submit" className="btn btn-start" disabled={loggingIn || !loginValue.trim()}>
            {loggingIn ? t.adminWorking : t.adminLogin}
          </button>
          <a className="admin-back-link" href="/">{t.routesBackToMaps}</a>
        </form>
      </div>
    );
  }

  return (
    <div className="admin-routes-page">
      <header className="admin-routes-toolbar">
        <div>
          <h1>{t.adminRoutesTitle}</h1>
          <p>{t.adminRoutesHint}</p>
        </div>
        <div className="admin-routes-toolbar-actions">
          <a className="btn btn-reset" href="/">{t.appTitle}</a>
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
          onUpdateFixedLabel={(id, label) => { void handleUpdateLabel(id, label); }}
          onUpdateFixedImage={(id, file) => { void handlePointImageFile(id, file); }}
          onUpdateFixedMarkerType={(id, markerType) => { void handleUpdateMarkerType(id, markerType); }}
          fixedLoading={fixed.loading}
          fixedError={fixed.error}
          busy={busy}
          title={t.adminRoutesTitle}
          hint={t.adminRoutesHint}
          t={t}
        />
      </div>
    </div>
  );
}
