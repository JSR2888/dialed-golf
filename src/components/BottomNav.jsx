const ITEMS = [
  { key: 'round', label: 'Round' },
  { key: 'practice', label: 'Practice' },
  { key: 'preround', label: 'Pins' },
  { key: 'stats', label: 'Dispersion' },
  { key: 'clubs', label: 'Clubs' },
];

export default function BottomNav({ active, onChange }) {
  return (
    <nav className="bottom-nav">
      {ITEMS.map((item) => (
        <button
          key={item.key}
          className={`bottom-nav__item ${active === item.key ? 'is-active' : ''}`}
          onClick={() => onChange(item.key)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
