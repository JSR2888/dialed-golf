import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Clubs() {
  const [clubs, setClubs] = useState([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from('clubs').select('*').order('sort_order');
    if (!error) setClubs(data);
    setLoading(false);
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

  return (
    <div className="page">
      <h1>Clubs</h1>
      <form onSubmit={addClub} className="inline-form">
        <input placeholder="e.g. 6 Iron" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button type="submit">Add</button>
      </form>

      {loading ? (
        <p className="hint">Loading…</p>
      ) : (
        <ul className="club-list">
          {clubs.map((c) => (
            <li key={c.id} className="club-list__item">
              <span>{c.name}</span>
              <div className="club-list__actions">
                <button onClick={() => move(c.id, -1)} aria-label="Move up">↑</button>
                <button onClick={() => move(c.id, 1)} aria-label="Move down">↓</button>
                <button onClick={() => removeClub(c.id)} aria-label="Delete" className="danger-text">✕</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
