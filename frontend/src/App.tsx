import { useEffect, useState } from 'react';

interface Item {
  id: number;
  name: string;
  created_at: string;
}

const API = import.meta.env.VITE_API_URL;

export default function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchItems = () =>
    fetch(`${API}/api/items`)
      .then((r) => r.json())
      .then(setItems);

  useEffect(() => { fetchItems(); }, []);

  const addItem = async () => {
    if (!input.trim()) return;
    setLoading(true);
    await fetch(`${API}/api/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: input.trim() }),
    });
    setInput('');
    await fetchItems();
    setLoading(false);
  };

  const deleteItem = async (id: number) => {
    await fetch(`${API}/api/items/${id}`, { method: 'DELETE' });
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <div style={{ maxWidth: 480, margin: '60px auto', fontFamily: 'sans-serif', padding: '0 16px' }}>
      <h2>Items</h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addItem()}
          placeholder="Item name..."
          style={{ flex: 1, padding: '8px 12px', fontSize: 14, border: '1px solid #ccc', borderRadius: 6 }}
        />
        <button
          onClick={addItem}
          disabled={loading || !input.trim()}
          style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          {loading ? '...' : 'Add'}
        </button>
      </div>

      {items.length === 0 ? (
        <p style={{ color: '#999' }}>No items yet. Add one above.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {items.map((item) => (
            <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #eee' }}>
              <span>{item.name}</span>
              <button
                onClick={() => deleteItem(item.id)}
                style={{ padding: '4px 10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
