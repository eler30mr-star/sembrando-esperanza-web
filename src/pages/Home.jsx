import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, PlayCircle, Sparkles } from 'lucide-react';
import SectionHeader from '../components/SectionHeader.jsx';
import ContentCard from '../components/ContentCard.jsx';
import AppStoreCard from '../components/AppStoreCard.jsx';
import { albums, plans, prayers, stories as localStories, verses, videos } from '../data/content.js';
import { getPublishedStories } from '../services/storiesService.js';

export default function Home() {
  const verse = verses[1];
  const [publishedStories, setPublishedStories] = useState(localStories);

  useEffect(() => {
    let alive = true;

    async function loadStories() {
      const stories = await getPublishedStories();
      if (!alive) return;
      setPublishedStories(stories);
    }

    loadStories();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      <section className="hero">
        <div className="hero-content">
          <span className="eyebrow"><Sparkles size={16} /> Comunidad cristiana</span>
          <h1>Sembrando Esperanza 🕊</h1>
          <p>Planes bíblicos, historias, versículos, imágenes cristianas, videos y oraciones para fortalecer tu fe cada día.</p>
          <div className="hero-actions">
            <Link className="btn primary" to="/planes">Ver planes</Link>
            <Link className="btn secondary" to="/historias">Leer historias</Link>
          </div>
        </div>
        <div className="hero-panel">
          <span>Versículo destacado</span>
          <h2>{verse.text}</h2>
          <p>{verse.reference}</p>
        </div>
      </section>

      <section className="section">
        <SectionHeader
          eyebrow="Portada"
          title="Contenido para alimentar tu vida espiritual"
          description="Un resumen de todo lo que encontrarás en la comunidad. Entra a cada sección para leer, ver y compartir más contenido cristiano."
        />
        <div className="feature-grid">
          <Link to="/planes" className="feature-tile"><BookOpen /> Planes bíblicos <ArrowRight /></Link>
          <Link to="/historias" className="feature-tile"><BookOpen /> Historias y reflexiones <ArrowRight /></Link>
          <Link to="/videos" className="feature-tile"><PlayCircle /> Videos cristianos <ArrowRight /></Link>
        </div>
      </section>

      <section className="section soft-section">
        <SectionHeader eyebrow="Planes" title="Planes destacados" description="Lecturas organizadas por días para crecer con dirección espiritual." />
        <div className="card-grid two">
          {plans.map((plan) => (
            <ContentCard
              key={plan.slug}
              image={plan.image}
              title={plan.title}
              description={plan.description}
              meta={`${plan.category} · ${plan.duration}`}
              to={`/planes/${plan.slug}`}
              action="Comenzar plan"
            />
          ))}
        </div>
      </section>

      <section className="section">
        <SectionHeader eyebrow="Biblioteca" title="Historias y reflexiones" description="Lecturas con estilo de libro para meditar con calma." />
        <div className="card-grid two">
          {publishedStories.slice(0, 4).map((story) => (
            <ContentCard
              key={story.slug}
              image={story.image}
              title={story.title}
              description={story.description}
              meta={`${story.category} · ${story.readingTime}`}
              to={`/historias/${story.slug}`}
              action="Abrir lectura"
              variant="book"
            />
          ))}
        </div>
      </section>

      <section className="section split-section">
        <div>
          <SectionHeader eyebrow="Versículos" title="Palabra para hoy" description="Versículos organizados por temas para acompañar tus momentos de fe." />
          <div className="verse-grid compact">
            {verses.slice(0, 4).map((item) => (
              <article className="verse-card" key={item.reference}>
                <span>{item.theme}</span>
                <p>“{item.text}”</p>
                <strong>{item.reference}</strong>
              </article>
            ))}
          </div>
        </div>
        <div className="prayer-panel">
          <span className="eyebrow">Oración</span>
          <h2>{prayers[0].title}</h2>
          <p>{prayers[0].text}</p>
          <Link className="text-link" to="/oracion">Ver más oraciones</Link>
        </div>
      </section>

      <section className="section soft-section">
        <SectionHeader eyebrow="Multimedia" title="Imágenes y videos" description="Galerías visuales y enlaces cristianos organizados para compartir y edificar." />
        <div className="card-grid three">
          <ContentCard image={albums[0].image} title={albums[0].title} description={albums[0].description} meta={`${albums[0].count} imágenes`} to="/imagenes" action="Ver álbumes" />
          <ContentCard image={videos[0].thumbnail} title={videos[0].title} description={videos[0].description} meta={videos[0].category} to="/videos" action="Ver videos" />
          <ContentCard image={albums[1].image} title={albums[1].title} description={albums[1].description} meta={`${albums[1].count} imágenes`} to="/imagenes" action="Ver álbumes" />
        </div>
      </section>

      <section className="section">
        <AppStoreCard />
      </section>
    </>
  );
}
