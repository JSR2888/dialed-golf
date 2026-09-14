import { useState } from 'react';

const STORAGE_KEY = 'dialed-unlocked';
const PASSCODE = import.meta.env.VITE_APP_PASSCODE;

export default function PasscodeGate({ children }) {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem(STORAGE_KEY) === 'true'
  );
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);

  if (unlocked) return children;

  function handleSubmit(e) {
    e.preventDefault();
    if (!PASSCODE) {
      // No passcode configured — don't lock the owner out of their own app.
      setUnlocked(true);
      return;
    }
    if (input === PASSCODE) {
      sessionStorage.setItem(STORAGE_KEY, 'true');
      setUnlocked(true);
    } else {
      setError(true);
      setInput('');
    }
  }

  return (
    <div className="passcode-gate">
      <form onSubmit={handleSubmit} className="passcode-gate__form">
        <h1>Dialed</h1>
        <p>Enter your passcode to continue.</p>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError(false);
          }}
        />
        {error && <p className="passcode-gate__error">Wrong passcode. Try again.</p>}
        <button type="submit">Enter</button>
      </form>
    </div>
  );
}
