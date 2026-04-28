import { useEffect, useState } from 'react';

interface Item {
  id: number;
  name: string;
  created_at: string;
}

export default function App() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/items`)
      .then((res) => res.json())
      .then(setItems);
  }, []);

  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  );
}
