import { Link } from 'react-router-dom';
import { Smartphone } from 'lucide-react';

export default function AppStoreCard() {
  return (
    <section className="app-card">
      <div className="app-card-icon"><Smartphone size={34} /></div>
      <div>
        <span className="eyebrow">Biblia Universal</span>
        <h2>La Palabra de Dios siempre contigo</h2>
        <p>Lee, escucha, ora, guarda versículos y acompaña tu día con una experiencia cristiana creada por AppsMart Technology.</p>
      </div>
      <Link className="btn primary" to="/app">Ver app</Link>
    </section>
  );
}
