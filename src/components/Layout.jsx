import { Link, NavLink } from 'react-router-dom';
import { Menu, X, Dove, Heart } from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { to: '/', label: 'Inicio' },
  { to: '/planes', label: 'Planes' },
  { to: '/historias', label: 'Historias' },
  { to: '/versiculos', label: 'Versículos' },
  { to: '/imagenes', label: 'Imágenes' },
  { to: '/videos', label: 'Videos' },
  { to: '/oracion', label: 'Oración' },
  { to: '/app', label: 'App' }
];

export default function Layout({ children }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="site-shell">
      <header className="header">
        <Link className="brand" to="/" onClick={() => setOpen(false)}>
          <span className="brand-icon"><Dove size={22} /></span>
          <span>
            <strong>Sembrando Esperanza</strong>
            <small>Contenido cristiano diario</small>
          </span>
        </Link>

        <button className="menu-button" type="button" onClick={() => setOpen(!open)} aria-label="Abrir menú">
          {open ? <X /> : <Menu />}
        </button>

        <nav className={`nav ${open ? 'nav-open' : ''}`}>
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} onClick={() => setOpen(false)}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main>{children}</main>

      <footer className="footer">
        <div>
          <h3>Sembrando Esperanza 🕊</h3>
          <p>Una comunidad cristiana creada para compartir planes bíblicos, historias, versículos, imágenes, videos y oración.</p>
        </div>
        <div className="footer-links">
          <Link to="/planes">Planes</Link>
          <Link to="/historias">Historias</Link>
          <Link to="/app">Biblia Universal</Link>
        </div>
        <div className="footer-note">
          <Heart size={16} /> Creado por AppsMart Technology
        </div>
      </footer>
    </div>
  );
}
