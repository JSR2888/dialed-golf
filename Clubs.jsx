import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Clubs() {
  const [clubs, setClubs] = useState([]);
  const [shotCounts, setShotCounts] = useState({});
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from('clubs').select('*').order('sort_order');
    if (!error) setClubs(data);
    await loadShotCounts();
    setLoading(false);
  }

  async function loadShotCounts() {
    // Lightweight for personal-scale data: just pull club_id for every shot
    // and tally client-side rather than needing a group-by RPC.
    const { data, error } = await supabase.from('shots').select('club_id');
    if (error) return;
    const counts = {};
    (data || []).forEach((s) => {
      if (s.club_id) counts[s.club_id] = (counts[s.club_id] || 0) + 1;
    });
    setShotCounts(counts);
  }

  useEffect(() => {
    load();
  }, []);

  async function addClub(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    const sortOrder = clubs.length ? Math.max(...clubs.map((c) => c.sort_order)) + 1 : 1;
    const { error } = await supabase
      .from('clubs')
      .insert({ name: newName.trim(), sort_order: sortOrder });
    if (!error) {
      setNewName('');
      load();
    }
  }

  async function removeClub(id) {
    if (!confirm('Delete this club? Past shots keep their numbers but lose the club label.')) return;
    await supabase.from('clubs').delete().eq('id', id);
    load();
  }

  async function move(id, direction) {
    const idx = clubs.findIndex((c) => c.id === id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= clubs.length) return;
    const a = clubs[idx];
    const b = clubs[swapIdx];
    await supabase.from('clubs').update({ sort_order: b.sort_order }).eq('id', a.id);
    await supabase.from('clubs').update({ sort_order: a.sort_order }).eq('id', b.id);
    load();
  }

  async function resetShots(club) {
    const count = shotCounts[club.id] || 0;
    if (count === 0) {
      setStatus(`No shots logged for ${club.name} yet.`);
      return;
    }
    if (
      !confirm(
        `Delete all ${count} shot${count === 1 ? '' : 's'} logged for ${club.name}? This can't be undone.`
      )
    ) {
      return;
    }
    const { error } = await supabase.from('shots').delete().eq('club_id', club.id);
    if (error) {
      setStatus(`Error: ${error.message}`);
      return;
    }
    setStatus(`Deleted ${count} shot${count === 1 ? '' : 's'} for ${club.name}.`);
    loadShotCounts();
  }

  return (
    <div className="page">
      <h1>Clubs</h1>
      <form onSubmit={addClub} className="inline-form">
        <input placeholder="e.g. 6 Iron" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button type="submit">Add</button>
      </form>

      {status && <p className="status-line">{status}</p>}

      {loading ? (
        <p className="hint">Loading…</p>
      ) : (
        <ul className="club-list">
          {clubs.map((c) => (
            <li key={c.id} className="club-list__item">
              <div className="club-list__info">
                <span className="club-list__name">{c.name}</span>
                <span className="club-list__count">
                  {shotCounts[c.id] || 0} shot{(shotCounts[c.id] || 0) === 1 ? '' : 's'}
                </span>
              </div>
              <div className="club-list__actions">
                <button onClick={() => move(c.id, -1)} aria-label="Move up">↑</button>
                <button onClick={() => move(c.id, 1)} aria-label="Move down">↓</button>
                <button
                  onClick={() => resetShots(c)}
                  disabled={!shotCounts[c.id]}
                  className="danger-text"
                >
                  Reset shots
                </button>
                <button onClick={() => removeClub(c.id)} aria-label="Delete club" className="danger-text">
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
