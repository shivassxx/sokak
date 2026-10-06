import { useState } from 'react';
import { Practice } from './Practice';

export function App() {
  const [screen, setScreen] = useState<'home' | 'practice'>('home');
  if (screen === 'practice') return <Practice onExit={() => setScreen('home')} />;
  return (
    <div className="home">
      <h1 className="logo">
        SOKAK<span>OYUNLARI</span>
      </h1>
      <p className="tagline">Saklambaç oynayalım mı?</p>
      <button className="btn big" onClick={() => setScreen('practice')}>
        Mahallede dolaş
      </button>
    </div>
  );
}
