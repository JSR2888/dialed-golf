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
  const [metric, setMetric] = useState('total'); // 'total' | 'carry'

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

  // Which shots count toward the summary stats depends on the toggle. Total
  // is only present for shots marked that way (or later filled in by hand);
  // same for carry.
  const metricShots = useMemo(() => {
    return shots.filter((s) => (metric === 'total' ? s.total_yards != null : s.carry_yards != null));
  }, [shots, metric]);

  const distanceStats = useMemo(() => {
    const values = metricShots.map((s) => (metric === 'total' ? s.total_yards : s.carry_yards));
    return { avg: mean(values), sd: stdev(values), n: values.length };
  }, [metricShots, metric]);

  // lateral_yards/long_short_yards describe whichever point was actually
  // marked (dispersion_basis). When that matches the selected metric it's
  // position-accurate. When it doesn't, we approximate using a manually
  // typed secondary number against the same target line — lateral miss
  // doesn't change much between carry and total, but long/short does.
  const chartShots = useMemo(() => {
    return shots
      .filter((s) => s.lateral_yards != null)
      .map((s) => {
        if (s.dispersion_basis === metric) {
          return { id: s.id, lateral: s.lateral_yards, longShort: s.long_short_yards };
        }
        const approxValue = metric === 'total' ? s.total_yards : s.carry_yards;
        if (approxValue == null || s.target_distance_yards == null) return null;
        return { id: s.id, lateral: s.lateral_yards, longShort: approxValue - s.target_distance_yards };
      })
      .filter(Boolean);
  }, [shots, metric]);

  const halfSpan = useMemo(() => {
    const maxAbsLateral = Math.max(10, ...chartShots.map((s) => Math.abs(s.lateral)));
    const maxAbsLong = Math.max(10, ...chartShots.map((s) => Math.abs(s.longShort)));
    return Math.max(maxAbsLateral, maxAbsLong) * 1.2;
  }, [chartShots]);

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

      <div className="control-row">
        <button className={metric === 'total' ? 'is-active' : ''} onClick={() => setMetric('total')}>
          Total
        </button>
        <button className={metric === 'carry' ? 'is-active' : ''} onClick={() => setMetric('carry')}>
          Carry
        </button>
      </div>
      {distanceStats.n < shots.length && (
        <p className="hint">
          {distanceStats.n} of {shots.length} shots have a {metric} number logged.
        </p>
      )}

      <div className="stat-summary">
        <div>
          <span>{distanceStats.n}</span>
          <label>shots</label>
        </div>
        <div>
          <span>{distanceStats.avg.toFixed(1)}</span>
          <label>avg yds</label>
        </div>
        <div>
          <span>±{distanceStats.sd.toFixed(1)}</span>
          <label>std dev</label>
        </div>
      </div>

      {chartShots.length > 0 ? (
        <>
          <svg viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`} className="dispersion-chart">
            <line x1={CHART_SIZE / 2} y1={0} x2={CHART_SIZE / 2} y2={CHART_SIZE} className="dispersion-chart__axis" />
            <line x1={0} y1={CHART_SIZE / 2} x2={CHART_SIZE} y2={CHART_SIZE / 2} className="dispersion-chart__axis" />
            <circle cx={CHART_SIZE / 2} cy={CHART_SIZE / 2} r={6} className="dispersion-chart__target" />
            {chartShots.map((s) => (
              <circle
                key={s.id}
                cx={toX(s.lateral)}
                cy={toY(s.longShort)}
                r={5}
                className="dispersion-chart__shot"
              />
            ))}
          </svg>
          <p className="hint">
            Target at center. Up = long, down = short, right/left = off-line ({metric}). Scale: ±
            {halfSpan.toFixed(0)} yd.
          </p>
        </>
      ) : (
        <p className="hint">
          {metric === 'total'
            ? 'No shots with a target recorded yet for this club — dispersion needs a target or pin to measure left/right and long/short against.'
            : 'No shots with both a carry number and a target recorded yet for this club.'}
        </p>
      )}

      <h2>Shot log</h2>
      <ul className="shot-list">
        {shots.map((s) => {
          const value = metric === 'total' ? s.total_yards : s.carry_yards;
          return (
            <li key={s.id}>
              {new Date(s.created_at).toLocaleDateString()} ·{' '}
              {value != null ? `${value.toFixed(1)} yd` : `— no ${metric} logged`}
              {s.mode === 'round' && s.hole_number ? ` · hole ${s.hole_number}` : ' · practice'}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
