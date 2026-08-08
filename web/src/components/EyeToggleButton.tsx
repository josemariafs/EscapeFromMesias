interface EyeToggleButtonProps {
  visible: boolean;
  labelShow: string;
  labelHide: string;
  onToggle: () => void;
  className?: string;
}

export function EyeToggleButton({
  visible,
  labelShow,
  labelHide,
  onToggle,
  className = '',
}: EyeToggleButtonProps) {
  const label = visible ? labelHide : labelShow;
  return (
    <button
      type="button"
      className={`btn-icon-ghost route-maps-visibility-toggle${visible ? '' : ' is-off'}${className ? ` ${className}` : ''}`}
      aria-label={label}
      aria-pressed={visible}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      {visible ? (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"
          />
          <circle
            cx="12"
            cy="12"
            r="3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
          />
          <line
            x1="1"
            y1="1"
            x2="23"
            y2="23"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}
