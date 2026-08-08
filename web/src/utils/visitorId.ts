const VISITOR_ID_KEY = 'efg-visitor-id';

const VISITOR_ID_RE = /^[a-zA-Z0-9_-]{8,80}$/;

/** ID estable por navegador para visitas / presencia online. */
export function readOrCreateVisitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_ID_KEY);
    if (existing && VISITOR_ID_RE.test(existing)) return existing;
    const id = `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(VISITOR_ID_KEY, id);
    return id;
  } catch {
    return `v_tmp_${Date.now().toString(36)}`;
  }
}

export function isValidVisitorId(value: string): boolean {
  return VISITOR_ID_RE.test(value);
}
