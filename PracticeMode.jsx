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
    } catch {
      setStatus('Could not get your location.');
    }
  }

  async function markEndByWalking() {
    try {
      const pos = await getPosition();
      await saveShot(pos);
    } catch {
      setStatus('Could not get your location.');
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
      const { carryYards, targetDistanceYards, lateralYards, longShortYards } = computeDispersion(
        start,
        target,
        end
      );
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
          carry_yards: carryYards,
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
      setStatus(`Logged ${carryYards.toFixed(1)} yd shot.`);
    },
    [start, target, clubId]
  );

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
      label: `${s.carry_yards.toFixed(0)} yd`,
    })),
  ].filter(Boolean);

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

      <MapView
        center={start || target || undefined}
        markers={markers}
        onMapClick={handleMapClick}
        className="map-view map-view--tall"
      />

      <div className="control-row">
        <button onClick={markEndByWalking} disabled={!start || locating}>
          I walked to my ball
        </button>
        <button
          onClick={() => setPlaceMode('end')}
          className={placeMode === 'end' ? 'is-active' : ''}
          disabled={!start}
        >
          Tap ball on map
        </button>
      </div>

      {status && <p className="status-line">{status}</p>}

      <h2>This session ({sessionShots.length})</h2>
      <ul className="shot-list">
        {sessionShots.map((s) => (
          <li key={s.id}>
            {s.carry_yards.toFixed(1)} yd
            {s.long_short_yards != null &&
              ` · ${s.long_short_yards > 0 ? '+' : ''}${s.long_short_yards.toFixed(1)} long/short`}
            {s.lateral_yards != null &&
              ` · ${s.lateral_yards > 0 ? 'R' : 'L'} ${Math.abs(s.lateral_yards).toFixed(1)}`}
          </li>
        ))}
      </ul>
    </div>
  );
}
