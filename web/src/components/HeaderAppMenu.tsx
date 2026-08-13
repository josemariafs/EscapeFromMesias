import { useEffect, useRef, useState } from 'react';

interface HeaderAppMenuProps {
  menuLabel: string;
  adminLabel: string;
  wipeLabel: string;
  canAccessAdmin: boolean;
  onWipeAll: () => void;
}

/** Menú compacto ⋯ para acciones globales (Admin, Wipe). */
export function HeaderAppMenu({
  menuLabel,
  adminLabel,
  wipeLabel,
  canAccessAdmin,
  onWipeAll,
}: HeaderAppMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="header-app-menu" ref={rootRef}>
      <button
        type="button"
        className={`header-app-menu-trigger${open ? ' is-open' : ''}`}
        aria-label={menuLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        title={menuLabel}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden>⋯</span>
      </button>
      {open && (
        <div className="header-app-menu-panel" role="menu">
          {canAccessAdmin && (
            <a
              className="header-app-menu-item"
              href="/admin"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              {adminLabel}
            </a>
          )}
          <button
            type="button"
            className="header-app-menu-item header-app-menu-item--danger"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onWipeAll();
            }}
          >
            {wipeLabel}
          </button>
        </div>
      )}
    </div>
  );
}
