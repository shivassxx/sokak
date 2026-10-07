import { useEffect, useState } from 'react';
import type { Game } from '../../game/Game';
import { clockLabel } from '../../game/dayHour';

/** HUD chip with the shared world clock: "🌙 23:40", "☀️ 14:10". */
export function DayClock({ game }: { game: Game }) {
  const [label, setLabel] = useState(() => clockLabel(game.daylight().hour));
  useEffect(() => {
    const iv = setInterval(() => setLabel(clockLabel(game.daylight().hour)), 1000);
    return () => clearInterval(iv);
  }, [game]);
  return (
    <span className="pill day-clock" title="Üsküdar'da saat">
      {label}
    </span>
  );
}
