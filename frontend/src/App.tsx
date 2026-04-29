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
      .then(setItems)
      .catch(() => {});

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
    <div style={{ minHeight: '100vh', background: '#0f1523', color: '#fff', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      {/* Header */}
      <header style={{ background: '#0a0f1a', borderBottom: '1px solid #1e2d4a', padding: '0 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, background: '#1d4ed8', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>F</div>
            <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.3px' }}>factory42</span>
          </div>
          <nav style={{ display: 'flex', gap: 32 }}>
            {['Dashboard', 'Items', 'Reports'].map((n) => (
              <span key={n} style={{ fontSize: 13, color: n === 'Items' ? '#60a5fa' : '#94a3b8', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>{n}</span>
            ))}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #0f1e3d 0%, #0f1523 60%)', borderBottom: '1px solid #1e2d4a', padding: '48px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ color: '#60a5fa', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 12 }}>Customer Portal</p>
          <h1 style={{ fontSize: 36, fontWeight: 800, margin: '0 0 12px', letterSpacing: '-0.5px' }}>Item Management</h1>
          <p style={{ color: '#94a3b8', fontSize: 15, margin: 0 }}>Add, manage, and track your items in real time.</p>
        </div>
      </div>

      {/* Main */}
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 40px' }}>

        {/* Add form */}
        <div style={{ background: '#131d2e', border: '1px solid #1e2d4a', borderRadius: 12, padding: '28px 32px', marginBottom: 32 }}>
          <h2 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Add New Item</h2>
          <div style={{ display: 'flex', gap: 12 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addItem()}
              placeholder="Enter item name..."
              style={{
                flex: 1, padding: '12px 16px', fontSize: 14,
                background: '#0a0f1a', border: '1px solid #1e2d4a',
                borderRadius: 8, color: '#fff', outline: 'none',
              }}
            />
            <button
              onClick={addItem}
              disabled={loading || !input.trim()}
              style={{
                padding: '12px 28px', background: loading || !input.trim() ? '#1e2d4a' : '#1d4ed8',
                color: loading || !input.trim() ? '#94a3b8' : '#fff',
                border: 'none', borderRadius: 8, fontSize: 14,
                fontWeight: 600, cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s',
              }}
            >
              {loading ? 'Adding...' : '+ Add Item'}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
          {[
            { label: 'Total Items', value: items.length },
            { label: 'Last Added', value: items[0] ? items[0].name.slice(0, 16) + (items[0].name.length > 16 ? '…' : '') : '—' },
            { label: 'Status', value: 'Active' },
          ].map((s) => (
            <div key={s.label} style={{ background: '#131d2e', border: '1px solid #1e2d4a', borderRadius: 12, padding: '20px 24px' }}>
              <p style={{ margin: '0 0 6px', fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>{s.label}</p>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#e2e8f0' }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Items list */}
        <div style={{ background: '#131d2e', border: '1px solid #1e2d4a', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #1e2d4a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>All Items</h2>
            <span style={{ fontSize: 12, color: '#64748b', background: '#0a0f1a', padding: '4px 10px', borderRadius: 20, border: '1px solid #1e2d4a' }}>{items.length} records</span>
          </div>

          {items.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
              <p style={{ margin: 0, fontSize: 15 }}>No items yet. Add your first item above.</p>
            </div>
          ) : (
            items.map((item, i) => (
              <div
                key={item.id}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '16px 24px', borderBottom: i < items.length - 1 ? '1px solid #1e2d4a' : 'none',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#0f1828')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 36, height: 36, background: '#0f1e3d', border: '1px solid #1e2d4a', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#60a5fa', fontWeight: 700 }}>
                    {item.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{item.name}</p>
                    <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                      {new Date(item.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => deleteItem(item.id)}
                  style={{
                    padding: '7px 16px', background: 'transparent',
                    color: '#ef4444', border: '1px solid #3f1515',
                    borderRadius: 6, fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#3f1515'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #1e2d4a', marginTop: 60, padding: '24px 40px', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: 13, color: '#475569' }}>© 2026 factory42 · Customer Portal</p>
      </footer>
    </div>
  );
}
