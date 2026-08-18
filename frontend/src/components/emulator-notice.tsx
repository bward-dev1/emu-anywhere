import './emulator-notice.css';
import { resetIsolationAttempts } from '../coi';

interface EmulatorNoticeProps {
  message: string;
  /** Shown when the notice is a warning the user can carry on past. */
  onDismiss?: () => void;
  /** Shown when the emulator is not going to come back on its own. */
  onStop?: () => void;
  tone?: 'error' | 'warning';
}

/**
 * The thing the app never had: a way to say out loud that the emulator is not
 * going to start, with a way out of it.
 *
 * Before this, a GBA boot that could not get cross-origin isolation never
 * rejected -- the module factory simply never came back -- so the catch in
 * emulator.tsx never ran, no message was ever rendered, and the user sat looking
 * at a black canvas with no idea whether to wait or reload. Reloading is the
 * actual fix in that case, so it is a button.
 */
export default function EmulatorNotice({ message, onDismiss, onStop, tone = 'error' }: EmulatorNoticeProps) {
  return (
    <div className={`emulator-notice emulator-notice-${tone}`} role="alert">
      <p className="emulator-notice-message">{message}</p>
      <div className="emulator-notice-actions">
        <button
          className="btn btn-sm btn-primary"
          onClick={() => {
            // An explicit request to try again, so give the isolation bootstrap
            // its full retry budget back rather than reloading into the same
            // exhausted state.
            resetIsolationAttempts();
            window.location.reload();
          }}
        >
          Reload
        </button>
        {onStop && (
          <button className="btn btn-sm" onClick={onStop}>
            Back to menu
          </button>
        )}
        {onDismiss && (
          <button className="btn btn-sm btn-ghost" onClick={onDismiss}>
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
