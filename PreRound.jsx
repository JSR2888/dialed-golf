import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useGeolocation } from '../hooks/useGeolocation';
import { fetchNearbyPins } from '../lib/overpass';
import MapView from '../components/MapView';

const HOLE_NUMBERS = Array.from({ length: 18 }, (_, i) => i + 1);

export default function PreRound() {
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [newCourseName, setNewCourseName] = useState('');
  const [holes, setHoles] = useState({});
  const [activeHole, setActiveHole] = useState(1);
  const [editing, setEditing] = useState(false);
  const [osmCandidates, setOsmCandidates] = useState([]);
  const { getPosition, locating } = useGeolocation();
  const [status, setStatus] = useState('');

  useEffect(() => {
    supabase.from('courses').select('*').order('name').then(({ data }) => setCourses(data || []));
  }, []);

  useEffect(() => {
    if (!courseId) {
      setHoles({});
      return;
    }
    supabase
      .from('course_holes')
      .select('*')
      .eq('course_id', courseId)
      .then(({ data }) => {
        const map = {};
        (data || []).forEach((h) => {
          map[h.hole_number] = h;
        });
        setHoles(map);
      });
  }, [courseId]);

  async function createCourse() {
    if (!newCourseName.trim()) return;
    const { data, error } = await supabase.from('courses').insert({ name: newCourseName.trim() }).select().single();
    if (error) {
      setStatus(error.message);
      return;
    }
    setCourses((c) => [...c, data]);
    setCourseId(data.id);
    setNewCourseName('');
  }

  async function savePin(latlng, source) {
    const { data, error } = await supabase
      .from('course_holes')
      .upsert(
        {
          course_id: courseId,
          hole_number: activeHole,
          pin_lat: latlng.lat,
          pin_lng: latlng.lng,
          pin_source: source,
        },
        { onConflict: 'course_id,hole_number' }
      )
      .select()
      .single();

    if (error) {
      setStatus(error.message);
      return;
    }
    setHoles((h) => ({ ...h, [activeHole]: data }));
    setEditing(false);
    setOsmCandidates([]);
  }

  async function lookupOsm() {
    try {
      const here = await getPosition();
      const pins = await fetchNearbyPins(here, 900);
      if (!pins.length) {
        setStatus('No OpenStreetMap pin data found nearby.');
        return;
      }
      setOsmCandidates(pins);
    } catch (err) {
      setStatus(err.message);
    }
  }

  const current = holes[activeHole];
  const currentLatLng = current ? { lat: current.pin_lat, lng: current.pin_lng } : undefined;

  return (
    <div className="page page--preround">
      <h1>Set pin locations</h1>
      <p className="hint">
        Walk each green (or look it up) before your round so pins are ready to go. This is entirely
        optional — rounds work fine without it, and you can always edit or add pins mid-round instead.
      </p>

      <div className="field">
        <label>Course</label>
        <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          <option value="">— select —</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          createCourse();
        }}
      >
        <input
          placeholder="New course name"
          value={newCourseName}
          onChange={(e) => setNewCourseName(e.target.value)}
        />
        <button type="submit">Add course</button>
      </form>

      {courseId && (
        <>
          <div className="hole-tabs">
            {HOLE_NUMBERS.map((n) => (
              <button
                key={n}
                className={`hole-tabs__item ${n === activeHole ? 'is-active' : ''} ${
                  holes[n] ? 'is-set' : ''
                }`}
                onClick={() => {
                  setActiveHole(n);
                  setEditing(false);
                  setOsmCandidates([]);
                }}
              >
                {n}
              </button>
            ))}
          </div>

          <p>
            {current
              ? `Pin saved${current.pin_source === 'osm' ? ' (from OpenStreetMap)' : ''}.`
              : 'No pin saved for this hole.'}
          </p>

          <div className="control-row">
            <button onClick={() => setEditing((v) => !v)} className={editing ? 'is-active' : ''}>
              {editing ? 'Tap the map to set pin' : 'Set manually'}
            </button>
            <button onClick={lookupOsm} disabled={locating}>
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

          <MapView
            center={currentLatLng}
            markers={currentLatLng ? [{ ...currentLatLng, type: 'pin', label: 'Pin' }] : []}
            onMapClick={(latlng) => editing && savePin(latlng, 'manual')}
            className="map-view map-view--tall"
          />
        </>
      )}

      {status && <p className="status-line">{status}</p>}
    </div>
  );
}
