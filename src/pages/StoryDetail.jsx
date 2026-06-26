import { Link, useParams } from 'react-router-dom';
import { stories } from '../data/content.js';
import BookReader from '../components/BookReader.jsx';

export default function StoryDetail() {
  const { slug } = useParams();
  const story = stories.find((item) => item.slug === slug);

  if (!story) {
    return <section className="section page"><h1>Historia no encontrada</h1><Link to="/historias">Volver a historias</Link></section>;
  }

  return (
    <section className="immersive-reader-page">
      <BookReader title={story.title} subtitle={story.description} pages={story.pages} />
    </section>
  );
}
