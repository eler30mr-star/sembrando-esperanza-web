import { useEffect, useMemo, useState } from 'react';
import SectionHeader from '../components/SectionHeader.jsx';
import ContentCard from '../components/ContentCard.jsx';
import { getPublishedStories } from '../services/storiesService.js';

const storyCategories = [
  'Fe',
  'Esperanza',
  'Amor',
  'Perdón',
  'Oración',
  'Familia',
  'Milagros',
  'Reflexión'
];

function normalizeCategory(value) {
  const clean = String(value || '').trim().toLowerCase();
  return storyCategories.find((category) => category.toLowerCase() === clean) || 'Reflexión';
}

export default function Stories() {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function loadStories() {
      const publishedStories = await getPublishedStories();
      if (!alive) return;
      setStories(publishedStories);
      setLoading(false);
    }

    loadStories();

    return () => {
      alive = false;
    };
  }, []);

  const groupedStories = useMemo(() => storyCategories
    .map((category) => ({
      category,
      items: stories.filter((story) => normalizeCategory(story.category) === category)
    }))
    .filter((section) => section.items.length > 0), [stories]);

  return (
    <section className="page section library-page">
      <SectionHeader
        eyebrow="Biblioteca de Esperanza"
        title="Historias y reflexiones"
        description="Lecturas cristianas organizadas por tema para fortalecer tu fe, tu esperanza y tu caminar con Dios."
        align="center"
      />

      {loading && <p className="empty-copy">Cargando historias...</p>}

      {!loading && stories.length === 0 && (
        <p className="empty-copy">Aún no hay historias publicadas.</p>
      )}

      <div style={{ display: 'grid', gap: 34 }}>
        {groupedStories.map((section) => (
          <section key={section.category} className="soft-section" style={{ padding: 22 }}>
            <div className="section-header" style={{ marginBottom: 18 }}>
              <span className="eyebrow">{section.items.length} {section.items.length === 1 ? 'lectura' : 'lecturas'}</span>
              <h2>{section.category}</h2>
              <p>Historias cristianas sobre {section.category.toLowerCase()} para leer con calma y reflexión.</p>
            </div>

            <div className="card-grid two">
              {section.items.map((story) => (
                <ContentCard
                  key={story.slug}
                  image={story.image}
                  title={story.title}
                  description={story.description}
                  meta={`${normalizeCategory(story.category)} · ${story.readingTime}`}
                  to={`/historias/${story.slug}`}
                  action="Leer historia"
                  variant="book"
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
