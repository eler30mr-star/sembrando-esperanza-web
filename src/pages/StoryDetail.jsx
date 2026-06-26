import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import BookReader from '../components/BookReader.jsx';
import { getPublishedStoryBySlug } from '../services/storiesService.js';

export default function StoryDetail() {
  const { slug } = useParams();
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function loadStory() {
      const foundStory = await getPublishedStoryBySlug(slug);
      if (!alive) return;
      setStory(foundStory);
      setLoading(false);
    }

    loadStory();

    return () => {
      alive = false;
    };
  }, [slug]);

  if (loading) {
    return <section className="section page"><h1>Cargando historia...</h1></section>;
  }

  if (!story) {
    return <section className="section page"><h1>Historia no encontrada</h1><Link to="/historias">Volver a historias</Link></section>;
  }

  return (
    <section className="immersive-reader-page">
      <BookReader title={story.title} subtitle={story.description} chapters={story.chapters} pages={story.pages} />
    </section>
  );
}
