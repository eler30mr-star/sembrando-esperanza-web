import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Eye, Heart } from 'lucide-react';
import SectionHeader from '../components/SectionHeader.jsx';
import { getPublishedStories } from '../services/storiesService.js';
import '../stories.css';

const storyCategories = ['Fe', 'Esperanza', 'Amor', 'Perdón', 'Oración', 'Familia', 'Milagros', 'Reflexión'];

function categorySlug(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function normalizeCategory(value) {
  const clean = String(value || '').trim().toLowerCase();
  return storyCategories.find((category) => category.toLowerCase() === clean) || 'Reflexión';
}

function getCategoryFromSlug(slug) {
  return storyCategories.find((category) => categorySlug(category) === slug) || null;
}

function formatCount(value) {
  const number = Number(value || 0);
  if (number >= 1000000) return `${(number / 1000000).toFixed(number >= 10000000 ? 0 : 1)}M`;
  if (number >= 1000) return `${(number / 1000).toFixed(number >= 10000 ? 0 : 1)}K`;
  return String(number);
}

function StoryCard({ story }) {
  const category = normalizeCategory(story.category);
  const author = story.author || story.authorName || 'Sembrando Esperanza';
  const views = story.views || story.viewCount || story.totalViews || 0;
  const likes = story.likes || story.likeCount || story.totalLikes || 0;

  return (
    <Link className="story-cover-card" to={`/historias/${story.slug}`}>
      <div className="story-cover-image">
        <img src={story.image} alt={story.title} loading="lazy" />
        <span className="story-cover-meta">{category}</span>
      </div>
      <div className="story-cover-info">
        <h3>{story.title}</h3>
        <p>{author}</p>
        <div className="story-cover-stats">
          <span><Eye size={21} strokeWidth={2.4} /><strong>{formatCount(views)}</strong></span>
          <span><Heart size={21} strokeWidth={2.4} /><strong>{formatCount(likes)}</strong></span>
        </div>
      </div>
    </Link>
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
    return () => { alive = false; };
  }, []);

  const groupedStories = useMemo(() => storyCategories.map((category) => ({
    category,
    items: stories.filter((story) => normalizeCategory(story.category) === category)
  })).filter((section) => section.items.length > 0), [stories]);

  const categoryStories = useMemo(() => activeCategory ? stories.filter((story) => normalizeCategory(story.category) === activeCategory) : [], [activeCategory, stories]);

  if (activeCategory) {
    return (
      <section className="page section library-page">
        <SectionHeader eyebrow="Historias por género" title={activeCategory} description={`Todas las historias cristianas disponibles en la sección ${activeCategory.toLowerCase()}.`} align="center" />
        <div style={{ marginBottom: 24, textAlign: 'center' }}><Link className="text-link" to="/historias">← Volver a todas las secciones</Link></div>
        {loading && <p className="empty-copy">Cargando historias...</p>}
        {!loading && categoryStories.length === 0 && <p className="empty-copy">Aún no hay historias publicadas en esta sección.</p>}
        <div className="story-category-grid">{categoryStories.map((story) => <div className="story-row-item" key={story.slug}><StoryCard story={story} /></div>)}</div>
      </section>
    );
  }

  return (
    <section className="page section library-page">
      <SectionHeader eyebrow="Biblioteca de Esperanza" title="Historias y reflexiones" description="Lecturas cristianas organizadas por género para fortalecer tu fe, tu esperanza y tu caminar con Dios." align="center" />
      {loading && <p className="empty-copy">Cargando historias...</p>}
      {!loading && stories.length === 0 && <p className="empty-copy">Aún no hay historias publicadas.</p>}
      <div className="story-sections">
        {groupedStories.map((section) => {
          const visibleStories = section.items.slice(0, 6);
          return (
            <section key={section.category} className="soft-section story-section-card">
              <div className="story-section-head">
                <div className="section-header">
                  <span className="eyebrow">{section.items.length} {section.items.length === 1 ? 'lectura' : 'lecturas'}</span>
                  <h2>{section.category}</h2>
                  <p>Historias cristianas sobre {section.category.toLowerCase()} para leer con calma y reflexión.</p>
                </div>
                <Link className="story-section-link" to={`/historias/categoria/${categorySlug(section.category)}`} aria-label={`Ver todas las historias de ${section.category}`} title={`Ver todas las historias de ${section.category}`}><ArrowRight size={22} /></Link>
              </div>
              <div className="story-row">{visibleStories.map((story) => <div className="story-row-item" key={story.slug}><StoryCard story={story} /></div>)}</div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
