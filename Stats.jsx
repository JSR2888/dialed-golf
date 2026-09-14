import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

function mean(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function stdev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(mean(arr.map((v) => (v - m) ** 2)));
}

const CHART_SIZE = 320;
const CHART_PADDING = 24;

export default function Stats() {
  const [clubs, setClubs] = useState([]);
  const [clubId, setClubId] = useState('');
  const [shots, setShots] = useState([]);
  const [modeFilter, setModeFilter] = useState('all');

  useEffect(() => {
    supabase
      .from('clubs')
      .select('*')
      .order('sort_order')
      .then(({ data }) => {
        setClubs(data || []);
        if (data && data.length) setClubId(data[0].id);
      });
  }, []);

  useEffect(() => {
    if (!clubId) return;
    let query = supabase.from('shots').select('*').eq('club_id', clubId).order('created_at', { ascending: false });
    if (modeFilter !== 'all') query = query.eq('mode', modeFilter);
    query.then(({ data }) => setShots(data || []));
  }, [clubId, modeFilter]);

  const withTarget = useMemo(() => shots.filter((s) => s.lateral_yards != null), [shots]);

  const carryStats = useMemo(() => {
    const carries = shots.map((s) => s.carry_yards);
    return { avg: mean(carries), sd: stdev(carries), n: carries.length };
  }, [shots]);

  const halfSpan = useMemo(() => {
    const maxAbsLateral = Math.max(10, ...withTarget.map((s) => Math.abs(s.lateral_yards)));
    const maxAbsLong = Math.max(10, ...withTarget.map((s) => Math.abs(s.long_short_yards)));
    return Math.max(maxAbsLateral, maxAbsLong) * 1.2;
  }, [withTarget]);

  const toX = (lat) => CHART_SIZE / 2 + (lat / halfSpan) * (CHART_SIZE / 2 - CHART_PADDING);
  const toY = (ls) => CHART_SIZE / 2 - (ls / halfSpan) * (CHART_SIZE / 2 - CHART_PADDING);

  return (
    <div className="page page--stats">
      <h1>Dispersion</h1>

      <div className="control-row">
        <select value={clubId} onChange={(e) => setClubId(e.target.value)}>
          {clubs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value)}>
          <option value="all">All shots</option>
          <option value="practice">Practice only</option>
          <option value="round">Round only</option>
        </select>
      </div>

      <div className="stat-summary">
        <div>
          <span>{carryStats.n}</span>
          <label>shots</label>
        </div>
        <div>
          <span>{carryStats.avg.toFixed(1)}</span>
          <label>avg yds</label>
        </div>
        <div>
          <span>±{carryStats.sd.toFixed(1)}</span>
          <label>std dev</label>
        </div>
      </div>

      {withTarget.length > 0 ? (
        <>
          <svg viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`} className="dispersion-chart">
            <line x1={CHART_SIZE / 2} y1={0} x2={CHART_SIZE / 2} y2={CHART_SIZE} className="dispersion-chart__axis" />
            <line x1={0} y1={CHART_SIZE / 2} x2={CHART_SIZE} y2={CHART_SIZE / 2} className="dispersion-chart__axis" />
            <circle cx={CHART_SIZE / 2} cy={CHART_SIZE / 2} r={6} className="dispersion-chart__target" />
            {withTarget.map((s) => (
              <circle
                key={s.id}
                cx={toX(s.lateral_yards)}
                cy={toY(s.long_short_yards)}
                r={5}
                className="dispersion-chart__shot"
              />
            ))}
          </svg>
          <p className="hint">
            Target at center. Up = long, down = short, right/left = off-line. Scale: ±{halfSpan.toFixed(0)} yd.
          </p>
        </>
      ) : (
        <p className="hint">
          No shots with a target recorded yet for this club — dispersion needs a target or pin to measure
          left/right and long/short against.
        </p>
      )}

      <h2>Shot log</h2>
      <ul className="shot-list">
        {shots.map((s) => (
          <li key={s.id}>
            {new Date(s.created_at).toLocaleDateString()} · {s.carry_yards.toFixed(1)} yd
            {s.mode === 'round' && s.hole_number ? ` · hole ${s.hole_number}` : ' · practice'}
          </li>
        ))}
      </ul>
    </div>
  );
}
