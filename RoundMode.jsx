import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useGeolocation } from '../hooks/useGeolocation';
import { computeDispersion, distanceYards } from '../lib/geo';
import { fetchNearbyPins } from '../lib/overpass';
import MapView from '../components/MapView';

export default function RoundMode() {
  const [round, setRound] = useState(null);
  const [courseName, setCourseName] = useState('');
  const [savedCourses, setSavedCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [hole, setHole] = useState(1);
  const [pin, setPin] = useState(null);
  const [pinEditing, setPinEditing] = useState(false);
  const [osmCandidates, setOsmCandidates] = useState([]);
  const [pendingStart, setPendingStart] = useState(null);
  const [pendingEnd, setPendingEnd] = useState(null);
  const [clubs, setClubs] = useState([]);
  const [holeShots, setHoleShots] = useState([]);
  const { getPosition, locating } = useGeolocation();
  const [status, setStatus] = useState('');

  useEffect(() => {
    supabase.from('clubs').select('*').order('sort_order').then(({ data }) => setClubs(data || []));
    supabase.from('courses').select('*').order('name').then(({ data }) => setSavedCourses(data || []));
  }, []);

  const loadPin = useCallback(
    async (holeNumber) => {
      setPin(null);
      setOsmCandidates([]);
      const { data: roundHole } = await supabase
        .from('round_holes')
        .select('*')
        .eq('round_id', round.id)
        .eq('hole_number', holeNumber)
        .maybeSingle();

      if (roundHole?.pin_lat != null) {
        setPin({ lat: roundHole.pin_lat, lng: roundHole.pin_lng, source: roundHole.pin_source });
        return;
      }

      if (round.course_id) {
        const { data: courseHole } = await supabase
          .from('course_holes')
          .select('*')
          .eq('course_id', round.course_id)
          .eq('hole_number', holeNumber)
          .maybeSingle();
        if (courseHole?.pin_lat != null) {
          setPin({ lat: courseHole.pin_lat, lng: courseHole.pin_lng, source: 'course_default' });
        }
      }
    },
    [round]
  );

  useEffect(() => {
    if (round) loadPin(hole);
  }, [hole, round, loadPin]);

  async function startRound() {
    let course_id = selectedCourseId || null;
    let name = courseName;

    if (!course_id && courseName.trim()) {
      const { data } = await supabase.from('courses').insert({ name: courseName.trim() }).select().single();
      course_id = data?.id ?? null;
    }
    if (course_id && !name) {
      name = savedCourses.find((c) => c.id === course_id)?.name || '';
    }

    const { data, error } = await supabase
      .from('rounds')
      .insert({ course_id, course_name: name || null })
      .select()
      .single();

    if (error) {
      setStatus(`Could not start round: ${error.message}`);
      return;
    }
    setRound(data);
    setHole(1);
  }

  async function savePin(latlng, source) {
    await supabase.from('round_holes').upsert(
      {
        round_id: round.id,
        hole_number: hole,
        pin_lat: latlng.lat,
        pin_lng: latlng.lng,
        pin_source: source,
      },
      { onConflict: 'round_id,hole_number' }
    );
    setPin({ ...latlng, source });
    setPinEditing(false);
    setOsmCandidates([]);
  }

  async function lookupOsmPin() {
    try {
      const here = await getPosition();
      const pins = await fetchNearbyPins(here, 900);
      if (!pins.length) {
        setStatus('No OpenStreetMap pin data found nearby — set it manually instead.');
        return;
      }
      setOsmCandidates(pins);
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function markShotStart() {
    try {
      const pos = await getPosition();
      setPendingStart(pos);
      setPendingEnd(null);
      setStatus('Shot start marked. Go hit it.');
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function markShotEnd() {
    if (!pendingStart) {
      setStatus('Mark the shot start first.');
      return;
    }
    try {
      const pos = await getPosition();
      setPendingEnd(pos);
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function confirmShot(clubId) {
    if (!pendingStart || !pendingEnd) return;
    const { totalYards, targetDistanceYards, lateralYards, longShortYards } = computeDispersion(
      pendingStart,
      pin,
      pendingEnd
    );
    const { data, error } = await supabase
      .from('shots')
      .insert({
        club_id: clubId,
        mode: 'round',
        round_id: round.id,
        hole_number: hole,
        start_lat: pendingStart.lat,
        start_lng: pendingStart.lng,
        end_lat: pendingEnd.lat,
        end_lng: pendingEnd.lng,
        target_lat: pin?.lat ?? null,
        target_lng: pin?.lng ?? null,
        total_yards: totalYards,
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
    setHoleShots((s) => [...s, data]);
    setStatus(`Logged ${totalYards.toFixed(1)} yd shot.`);
    // Next shot on this hole naturally starts where this one ended.
    setPendingStart(pendingEnd);
    setPendingEnd(null);
  }

  async function setCarryForShot(id, rawValue) {
    const value = rawValue.trim();
    const carry_yards = value === '' ? null : Number(value);
    if (value !== '' && Number.isNaN(carry_yards)) return;
    const { data, error } = await supabase
      .from('shots')
      .update({ carry_yards })
      .eq('id', id)
      .select()
      .single();
    if (!error) {
      setHoleShots((shots) => shots.map((s) => (s.id === id ? data : s)));
    }
  }

  function cancelPendingShot() {
    setPendingStart(null);
    setPendingEnd(null);
    setStatus('Shot cancelled — not logged.');
  }

  function discardShot() {
    // Keep pendingStart as the start of the next attempt, since you're
    // presumably still standing where the discarded shot ended up.
    setPendingStart(pendingEnd);
    setPendingEnd(null);
    setStatus('Shot discarded — not logged.');
  }

  function changeHole(delta) {
    const next = Math.min(18, Math.max(1, hole + delta));
    setHole(next);
    setPendingStart(null);
    setPendingEnd(null);
    setHoleShots([]);
    setPinEditing(false);
    setStatus('');
  }

  async function endRound() {
    if (!confirm('End this round?')) return;
    await supabase.from('rounds').update({ finished_at: new Date().toISOString() }).eq('id', round.id);
    setRound(null);
    setPin(null);
    setPendingStart(null);
    setPendingEnd(null);
    setHoleShots([]);
  }

  const handleMapClick = useCallback(
    (latlng) => {
      if (pinEditing) savePin(latlng, 'manual');
    },
    [pinEditing, round, hole]
  );

  if (!round) {
    return (
      <div className="page">
        <h1>Start a round</h1>
        <div className="field">
          <label>Saved course</label>
          <select value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)}>
            <option value="">— none / new —</option>
            {savedCourses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        {!selectedCourseId && (
          <div className="field">
            <label>Course name (optional)</label>
            <input
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              placeholder="e.g. Hobble Creek"
            />
          </div>
        )}
        <button onClick={startRound}>Start round</button>
        <p className="hint">
          No pin locations? No problem — play the round and add or edit pins per hole whenever you like.
        </p>
        {status && <p className="status-line">{status}</p>}
      </div>
    );
  }

  const pinDistance = pin && pendingStart ? distanceYards(pendingStart, pin) : null;

  const markers = [
    pendingStart && { ...pendingStart, type: 'start', label: 'Shot start' },
    pin && { ...pin, type: 'pin', label: 'Pin' },
    ...holeShots.map((s) => ({
      lat: s.end_lat,
      lng: s.end_lng,
      type: 'ball',
      label: `${s.total_yards.toFixed(0)} yd`,
    })),
  ].filter(Boolean);

  return (
    <div className="page page--round">
      <div className="round-header">
        <button onClick={() => changeHole(-1)} disabled={hole <= 1} aria-label="Previous hole">
          ‹
        </button>
        <h1>Hole {hole}</h1>
        <button onClick={() => changeHole(1)} disabled={hole >= 18} aria-label="Next hole">
          ›
        </button>
      </div>

      <div className="pin-info">
        {pin ? (
          <p>
            Pin set{pin.source === 'osm' ? ' from OpenStreetMap' : pin.source === 'course_default' ? ' (course default)' : ''}.
            {pinDistance != null && ` ${pinDistance.toFixed(0)} yd from your last mark.`}
          </p>
        ) : (
          <p>No pin location for this hole yet — you can still log shots without one.</p>
        )}
        <div className="control-row">
          <button onClick={() => setPinEditing((v) => !v)} className={pinEditing ? 'is-active' : ''}>
            {pinEditing ? 'Tap the map to set pin' : 'Edit pin'}
          </button>
          <button onClick={lookupOsmPin} disabled={locating}>
            Look up on OpenStreetMap
          </button>
        </div>
        {osmCandidates.length > 0 && (
          <ul className="osm-candidates">
            {osmCandidates.map((c, i) => (
              <li key={i}>
                <button onClick={() => savePin(c, 'osm')}>Use pin {c.ref ? `#${c.ref}` : i + 1}</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <MapView
        center={pendingStart || pin || undefined}
        markers={markers}
        onMapClick={handleMapClick}
        className="map-view map-view--tall"
      />

      <div className="control-row">
        <button onClick={markShotStart} disabled={locating}>
          Mark shot start
        </button>
        <button onClick={markShotEnd} disabled={!pendingStart || locating}>
          I'm at my ball
        </button>
        {pendingStart && !pendingEnd && (
          <button onClick={cancelPendingShot} className="danger-text-btn">
            Cancel
          </button>
        )}
      </div>

      {pendingEnd && (
        <div className="club-picker">
          <p>Which club?</p>
          <div className="club-picker__grid">
            {clubs.map((c) => (
              <button key={c.id} onClick={() => confirmShot(c.id)}>
                {c.name}
              </button>
            ))}
          </div>
          <button onClick={discardShot} className="danger-text-btn club-picker__discard">
            Don't log this shot
          </button>
        </div>
      )}

      {status && <p className="status-line">{status}</p>}

      <h2>Shots this hole ({holeShots.length})</h2>
      <ul className="shot-list">
        {holeShots.map((s) => (
          <li key={s.id} className="shot-list__item">
            <div className="shot-list__line">{s.total_yards.toFixed(1)} yd total</div>
            <label className="shot-list__carry">
              Carry
              <input
                type="number"
                inputMode="decimal"
                placeholder="optional"
                defaultValue={s.carry_yards ?? ''}
                onBlur={(e) => setCarryForShot(s.id, e.target.value)}
              />
            </label>
          </li>
        ))}
      </ul>

      <button className="danger" onClick={endRound}>
        End round
      </button>
    </div>
  );
}
