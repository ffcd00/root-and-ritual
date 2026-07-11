interface GameHeaderProps {
  readonly soundEnabled: boolean;
  readonly onToggleSound: () => void;
}

export function GameHeader({ soundEnabled, onToggleSound }: GameHeaderProps) {
  return (
    <header className="topbar">
      <div className="brand" aria-label="Root and Ritual">
        <span className="brand-mark" aria-hidden="true">✦</span>
        <span>Root &amp; Ritual</span>
      </div>
      <div className="topbar-actions">
        <button
          className="icon-button"
          type="button"
          onClick={onToggleSound}
          aria-label={soundEnabled ? 'Mute sound effects' : 'Turn on sound effects'}
          aria-pressed={soundEnabled}
          title={soundEnabled ? 'Sound on' : 'Sound off'}
        >
          {soundEnabled ? '🔊' : '🔇'}
        </button>
      </div>
    </header>
  );
}
