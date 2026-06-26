import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Home, Pause, Play } from 'lucide-react';

function chunkText(text, maxChars) {
  const paragraphs = String(text || '')
    .split(/\n\s*\n/g)
    .map((item) => item.trim())
    .filter(Boolean);

  const chunks = [];
  let currentChunk = '';

  paragraphs.forEach((paragraph) => {
    const candidate = currentChunk ? `${currentChunk}\n\n${paragraph}` : paragraph;

    if (candidate.length <= maxChars) {
      currentChunk = candidate;
      return;
    }

    if (currentChunk) chunks.push(currentChunk);

    if (paragraph.length <= maxChars) {
      currentChunk = paragraph;
      return;
    }

    const sentences = paragraph.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [paragraph];
    let sentenceChunk = '';

    sentences.forEach((sentence) => {
      const cleanSentence = sentence.trim();
      const sentenceCandidate = sentenceChunk ? `${sentenceChunk} ${cleanSentence}` : cleanSentence;
      if (sentenceCandidate.length <= maxChars) {
        sentenceChunk = sentenceCandidate;
      } else {
        if (sentenceChunk) chunks.push(sentenceChunk);
        sentenceChunk = cleanSentence;
      }
    });

    currentChunk = sentenceChunk;
  });

  if (currentChunk) chunks.push(currentChunk);
  return chunks.length ? chunks : [''];
}

function getMaxChars() {
  if (typeof window === 'undefined') return 520;
  if (window.innerWidth <= 420) return 430;
  if (window.innerWidth <= 620) return 520;
  if (window.innerWidth <= 900) return 780;
  return 1180;
}

function normalizeChapters({ chapters = [], pages = [] }) {
  if (Array.isArray(chapters) && chapters.length > 0) {
    return chapters.map((chapter, index) => ({
      title: chapter.title || `Capítulo ${index + 1}`,
      content: chapter.content || ''
    }));
  }

  return [
    {
      title: 'Capítulo 1',
      content: Array.isArray(pages) ? pages.join('\n\n') : ''
    }
  ];
}

export default function BookReader({ title, subtitle, chapters = [], pages = [], footerLabel = 'Página' }) {
  const [page, setPage] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [maxChars, setMaxChars] = useState(getMaxChars);

  useEffect(() => {
    const handleResize = () => setMaxChars(getMaxChars());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const readerPages = useMemo(() => {
    const normalizedChapters = normalizeChapters({ chapters, pages });

    return normalizedChapters.flatMap((chapter, chapterIndex) => {
      const chapterPages = chunkText(chapter.content, maxChars);
      return chapterPages.map((content, pageIndex) => ({
        content,
        chapterTitle: chapter.title,
        chapterNumber: chapterIndex + 1,
        chapterPage: pageIndex + 1,
        chapterTotalPages: chapterPages.length
      }));
    });
  }, [chapters, pages, maxChars]);

  const currentPage = readerPages[page] || {
    content: '',
    chapterTitle: 'Capítulo 1',
    chapterNumber: 1,
    chapterPage: 1,
    chapterTotalPages: 1
  };

  useEffect(() => {
    setPage(0);
  }, [readerPages.length]);

  const next = () => setPage((value) => Math.min(value + 1, readerPages.length - 1));
  const previous = () => setPage((value) => Math.max(value - 1, 0));

  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }
  }, [page]);

  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, []);

  function toggleAudio() {
    if (!('speechSynthesis' in window)) return;

    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    const text = `${title}. ${currentPage.chapterTitle}. ${currentPage.content}`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    utterance.rate = 0.92;
    utterance.pitch = 1;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }

  return (
    <section className="reader-shell immersive-reader">
      <div className="reader-top immersive-reader-top">
        <div>
          <span className="page-count">
            Capítulo {currentPage.chapterNumber} · {footerLabel} {currentPage.chapterPage} de {currentPage.chapterTotalPages}
          </span>
          <h1>{title}</h1>
          <h2 className="reader-chapter-title">{currentPage.chapterTitle}</h2>
        </div>
      </div>

      <div className="book-stage immersive-book-stage">
        <article className="book-page immersive-book-page" key={`${currentPage.chapterNumber}-${currentPage.chapterPage}`}>
          <div className="paper-grain" />
          <p>{currentPage.content}</p>
          <span className="page-number">{page + 1}</span>
        </article>
      </div>

      <div className="reader-controls immersive-reader-controls" aria-label="Controles de lectura">
        <Link className="reader-home-button" to="/historias" aria-label="Ir a historias">
          <Home size={18} /> Inicio
        </Link>

        <button className="reader-triangle" type="button" onClick={previous} disabled={page === 0} aria-label="Página anterior">
          ◀
        </button>

        <button className="reader-audio-button" type="button" onClick={toggleAudio} aria-label={speaking ? 'Detener audio' : 'Reproducir audio'}>
          {speaking ? <Pause size={18} /> : <Play size={18} />} Audio
        </button>

        <button className="reader-triangle" type="button" onClick={next} disabled={page === readerPages.length - 1} aria-label="Página siguiente">
          ▶
        </button>
      </div>
    </section>
  );
}
