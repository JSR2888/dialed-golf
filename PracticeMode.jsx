import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useGeolocation } from '../hooks/useGeolocation';
import { computeDispersion } from '../lib/geo';
import MapView from '../components/MapView';

export default function PracticeMode() {
  const [clubs, setClubs] = useState([]);
  const [clubId, setClubId] = useState('');
  const [start, setStart] = useState(null);
  const [target, setTarget] = useState(null);
  const [placeMode, setPlaceMode] = useState(null); // 'target' | 'end' | null
  // What marking the ball's position actually represents. At a normal range
  // you can walk out and mark the finished/rolled-out spot (total). At a
  // simulator or Topgolf bay you can only mark where it lands, since rollout
  // on turf/nets isn't representative, so you'd mark that as carry instead.
  const [markAs, setMarkAs] = useState('total'); // 'total' | 'carry'
  const [sessionShots, setSessionShots] = useState([]);
  const { getPosition, locating } = useGeolocation();
  const [status, setStatus] = useState('');

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

  async function markStart() {
    try {
      const pos = await getPosition();
      setStart(pos);
      setStatus('Start position set.');
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function markEndByWalking() {
    try {
      const pos = await getPosition();
      await saveShot(pos);
    } catch (err) {
      setStatus(err.message);
    }
  }

  const saveShot = useCallback(
    async (end) => {
      if (!start) {
        setStatus('Set your start position first.');
        return;
      }
      if (!clubId) {
        setStatus('Pick a club first.');
        return;
      }
      const { totalYards: measuredYards, targetDistanceYards, lateralYards, longShortYards } =
        computeDispersion(start, target, end);

      const { data, error } = await supabase
        .from('shots')
        .insert({
          club_id: clubId,
          mode: 'practice',
          start_lat: start.lat,
          start_lng: start.lng,
          end_lat: end.lat,
          end_lng: end.lng,
          target_lat: target?.lat ?? null,
          target_lng: target?.lng ?? null,
          total_yards: markAs === 'total' ? measuredYards : null,
          carry_yards: markAs === 'carry' ? measuredYards : null,
          dispersion_basis: markAs,
          target_distance_yards: targetDistanceYards,
          lateral_yards: lateralYards,
          long_short_yards: longShortYards,
        })
        .select()
        .single();

      if (error) {
        setStatus(`Error saving shot: ${error.message}`);
        return;
      }
      setSessionShots((s) => [data, ...s]);
      setStatus(`Logged ${measuredYards.toFixed(1)} yd (${markAs}).`);
    },
    [start, target, clubId, markAs]
  );

  // Fill in the *other* metric by hand after the fact — e.g. you marked
  // carry at Topgolf but also want to jot down where it actually stopped.
  async function setOtherMetric(shot, rawValue) {
    const field = shot.dispersion_basis === 'total' ? 'carry_yards' : 'total_yards';
    const value = rawValue.trim();
    const parsed = value === '' ? null : Number(value);
    if (value !== '' && Number.isNaN(parsed)) return;
    const { data, error } = await supabase
      .from('shots')
      .update({ [field]: parsed })
      .eq('id', shot.id)
      .select()
      .single();
    if (!error) {
      setSessionShots((shots) => shots.map((s) => (s.id === shot.id ? data : s)));
    }
  }

  const handleMapClick = useCallback(
    (latlng) => {
      if (placeMode === 'target') {
        setTarget(latlng);
        setPlaceMode(null);
        setStatus('Target set.');
      } else if (placeMode === 'end') {
        setPlaceMode(null);
        saveShot(latlng);
      }
    },
    [placeMode, saveShot]
  );

  const markers = [
    start && { ...start, type: 'start', label: 'Start' },
    target && { ...target, type: 'target', label: 'Target' },
    ...sessionShots.map((s) => ({
      lat: s.end_lat,
      lng: s.end_lng,
      type: 'ball',
      label: `${(s.total_yards ?? s.carry_yards).toFixed(0)} yd`,
    })),
  ].filter(Boolean);

  const walkLabel = markAs === 'carry' ? "I walked to where it landed" : 'I walked to my ball';
  const tapLabel = markAs === 'carry' ? 'Tap landing spot on map' : 'Tap ball on map';

  return (
    <div className="page page--practice">
      <h1>Practice</h1>

      <div className="control-row">
        <select value={clubId} onChange={(e) => setClubId(e.target.value)}>
          {clubs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button onClick={markStart} disabled={locating}>
          {start ? 'Reset start (here)' : 'Set start (here)'}
        </button>
        <button
          onClick={() => setPlaceMode('target')}
          className={placeMode === 'target' ? 'is-active' : ''}
        >
          {target ? 'Move target' : 'Set target on map'}
        </button>
      </div>

      <div className="control-row">
        <span className="control-row__label">Marking:</span>
        <button className={markAs === 'total' ? 'is-active' : ''} onClick={() => setMarkAs('total')}>
          Total (where it stops)
        </button>
        <button className={markAs === 'carry' ? 'is-active' : ''} onClick={() => setMarkAs('carry')}>
          Carry (where it lands)
        </button>
      </div>

      <MapView
        center={start || target || undefined}
        markers={markers}
        onMapClick={handleMapClick}
        className="map-view map-view--tall"
      />

      <div className="control-row">
        <button onClick={markEndByWalking} disabled={!start || locating}>
          {walkLabel}
        </button>
        <button
          onClick={() => setPlaceMode('end')}
          className={placeMode === 'end' ? 'is-active' : ''}
          disabled={!start}
        >
          {tapLabel}
        </button>
      </div>

      {status && <p className="status-line">{status}</p>}

      <h2>This session ({sessionShots.length})</h2>
      <ul className="shot-list">
        {sessionShots.map((s) => {
          const primaryValue = s.dispersion_basis === 'total' ? s.total_yards : s.carry_yards;
          const secondaryValue = s.dispersion_basis === 'total' ? s.carry_yards : s.total_yards;
          const secondaryLabel = s.dispersion_basis === 'total' ? 'Carry' : 'Total';
          return (
            <li key={s.id} className="shot-list__item">
              <div className="shot-list__line">
                {primaryValue.toFixed(1)} yd {s.dispersion_basis}
                {s.long_short_yards != null &&
                  ` · ${s.long_short_yards > 0 ? '+' : ''}${s.long_short_yards.toFixed(1)} long/short`}
                {s.lateral_yards != null &&
                  ` · ${s.lateral_yards > 0 ? 'R' : 'L'} ${Math.abs(s.lateral_yards).toFixed(1)}`}
              </div>
              <label className="shot-list__carry">
                {secondaryLabel}
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="optional"
                  defaultValue={secondaryValue ?? ''}
                  onBlur={(e) => setOtherMetric(s, e.target.value)}
                />
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
