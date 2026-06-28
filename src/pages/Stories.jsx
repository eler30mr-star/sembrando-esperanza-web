import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
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

function categorySlug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeCategory(value) {
  const clean = String(value || '').trim().toLowerCase();
  return storyCategories.find((category) => category.toLowerCase() === clean) || 'Reflexión';
}

function getCategoryFromSlug(slug) {
  return storyCategories.find((category) => categorySlug(category) === slug) || null;
}

function StoryCard({ story }) {
  return (
    <ContentCard
      image={story.image}
      title={story.title}
      description={story.description}
      meta={`${normalizeCategory(story.category)} · ${story.readingTime}`}
      to={`/historias/${story.slug}`}
      action="Leer historia"
      variant="book"
    />
  );
}

export default function Stories() {
  const { categorySlug: activeCategorySlug } = useParams();
  const activeCategory = getCategoryFromSlug(activeCategorySlug);
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

  const categoryStories = useMemo(() => (
    activeCategory
      ? stories.filter((story) => normalizeCategory(story.category) === activeCategory)
      : []
  ), [activeCategory, stories]);

  if (activeCategory) {
    return (
      <section className="page section library-page">
        <SectionHeader
          eyebrow="Historias por género"
          title={activeCategory}
          description={`Todas las historias cristianas disponibles en la sección ${activeCategory.toLowerCase()}.`}
          align="center"
        />

        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <Link className="text-link" to="/historias">← Volver a todas las secciones</Link>
        </div>

        {loading && <p className="empty-copy">Cargando historias...</p>}

        {!loading && categoryStories.length === 0 && (
          <p className="empty-copy">Aún no hay historias publicadas en esta sección.</p>
        )}

        <div className="card-grid two">
          {categoryStories.map((story) => (
            <StoryCard key={story.slug} story={story} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="page section library-page">
      <SectionHeader
        eyebrow="Biblioteca de Esperanza"
        title="Historias y reflexiones"
        description="Lecturas cristianas organizadas por género para fortalecer tu fe, tu esperanza y tu caminar con Dios."
        align="center"
      />

      {loading && <p className="empty-copy">Cargando historias...</p>}

      {!loading && stories.length === 0 && (
        <p className="empty-copy">Aún no hay historias publicadas.</p>
      )}

      <div style={{ display: 'grid', gap: 34 }}>
        {groupedStories.map((section) => {
          const visibleStories = section.items.slice(0, 6);

          return (
            <section key={section.category} className="soft-section" style={{ padding: 22, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
                <div className="section-header" style={{ marginBottom: 0 }}>
                  <span className="eyebrow">{section.items.length} {section.items.length === 1 ? 'lectura' : 'lecturas'}</span>
                  <h2>{section.category}</h2>
                  <p>Historias cristianas sobre {section.category.toLowerCase()} para leer con calma y reflexión.</p>
                </div>

                <Link
                  to={`/historias/categoria/${categorySlug(section.category)}`}
                  aria-label={`Ver todas las historias de ${section.category}`}
                  title={`Ver todas las historias de ${section.category}`}
                  style={{
                    flex: '0 0 auto',
                    width: 46,
                    height: 46,
                    display: 'grid',
                    placeItems: 'center',
                    color: '#8b651f',
                    background: 'rgba(255, 248, 235, 0.95)',
                    border: '1px solid rgba(184, 134, 43, 0.24)',
                    borderRadius: 999,
                    boxShadow: '0 12px 30px rgba(31,41,51,.08)'
                  }}
                >
                  <ArrowRight size={22} />
                </Link>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridAutoFlow: 'column',
                  gridAutoColumns: '520px',
                  gridAutoRows: '330px',
                  alignItems: 'stretch',
                  gap: 18,
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  overscrollBehaviorInline: 'contain',
                  scrollSnapType: 'x proximity',
                  paddingBottom: 12
                }}
              >
                {visibleStories.map((story) => (
                  <div key={story.slug} style={{ width: 520, height: 330, overflow: 'hidden', scrollSnapAlign: 'start' }}>
                    <div style={{ height: '100%', overflow: 'hidden' }}>
                      <StoryCard story={story} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
