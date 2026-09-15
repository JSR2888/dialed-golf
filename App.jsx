import { useState } from 'react';
import PasscodeGate from './components/PasscodeGate';
import BottomNav from './components/BottomNav';
import RoundMode from './pages/RoundMode';
import PracticeMode from './pages/PracticeMode';
import PreRound from './pages/PreRound';
import Stats from './pages/Stats';
import Clubs from './pages/Clubs';

export default function App() {
  const [active, setActive] = useState('round');

  return (
    <PasscodeGate>
      <div className="app-shell">
        <main className="app-main">
          {active === 'round' && <RoundMode />}
          {active === 'practice' && <PracticeMode />}
          {active === 'preround' && <PreRound />}
          {active === 'stats' && <Stats />}
          {active === 'clubs' && <Clubs />}
        </main>
        <BottomNav active={active} onChange={setActive} />
      </div>
    </PasscodeGate>
  );
}
