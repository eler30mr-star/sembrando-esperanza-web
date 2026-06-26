import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen } from 'lucide-react';

export default function BookReader({ title, subtitle, pages = [], footerLabel = 'Página' }) {
  const [page, setPage] = useState(0);
  const current = useMemo(() => pages[page] || '', [pages, page]);

  const next = () => setPage((value) => Math.min(value + 1, pages.length - 1));
  const previous = () => setPage((value) => Math.max(value - 1, 0));

  return (
    <section className="reader-shell">
      <div className="reader-top">
        <div>
          <span className="eyebrow"><BookOpen size={16} /> Lectura espiritual</span>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <span className="page-count">{footerLabel} {page + 1} de {pages.length}</span>
      </div>

      <div className="book-stage">
        <article className="book-page" key={page}>
          <div className="paper-grain" />
          <p>{current}</p>
          <span className="page-number">{page + 1}</span>
        </article>
      </div>

      <div className="reader-controls">
        <button type="button" onClick={previous} disabled={page === 0}>
          <ArrowLeft size={18} /> Anterior
        </button>
        <button type="button" onClick={next} disabled={page === pages.length - 1}>
          Siguiente <ArrowRight size={18} />
        </button>
      </div>
    </section>
  );
}
