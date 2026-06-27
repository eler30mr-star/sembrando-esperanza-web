import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Home, MessageCircle, Pause, Play, Send, Share2 } from 'lucide-react';
import { listenToUser, loginWithGoogle } from '../services/authService.js';
import { addStoryComment, listenToComments, listenToStoryStats, listenToUserLike, toggleStoryLike } from '../services/storyEngagementService.js';

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
  if (typeof window === 'undefined') return 950;
  if (window.innerWidth <= 420) return 800;
  if (window.innerWidth <= 620) return 950;
  if (window.innerWidth <= 900) return 1400;
  return 2000;
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

const centeredHeaderStyle = {
  justifyContent: 'center',
  textAlign: 'center'
};

const centeredHeaderInnerStyle = {
  width: '100%',
  textAlign: 'center'
};

const pageContentStyle = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100%'
};

const chapterHeaderStyle = {
  marginBottom: '16px',
  textAlign: 'center'
};

const chapterNumberStyle = {
  display: 'block',
  marginBottom: '6px',
  color: 'var(--gold-dark)',
  fontSize: '0.78rem',
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase'
};

const readerTextStyle = {
  fontSize: '1.04rem',
  lineHeight: 1.58
};

const actionBarStyle = {
  marginTop: 'auto',
  paddingTop: '16px',
  display: 'flex',
  alignItems: 'end',
  justifyContent: 'center',
  gap: '18px'
};

const actionButtonStyle = {
  border: '0',
  background: 'transparent',
  color: '#6f4b16',
  display: 'inline-flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '3px',
  fontWeight: 800,
  cursor: 'pointer'
};

const commentsPanelStyle = {
  marginTop: '12px',
  padding: '12px',
  borderRadius: '18px',
  background: 'rgba(255, 248, 234, 0.92)',
  border: '1px solid rgba(120, 79, 23, 0.18)'
};

export default function BookReader({ title, subtitle, chapters = [], pages = [], storyId, storySlug }) {
  const [page, setPage] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [maxChars, setMaxChars] = useState(getMaxChars);
  const [user, setUser] = useState(null);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');

  useEffect(() => listenToUser(setUser), []);

  useEffect(() => {
    const handleResize = () => setMaxChars(getMaxChars());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => listenToStoryStats(storyId, (stats) => setLikeCount(stats.likeCount)), [storyId]);

  useEffect(() => {
    if (!user?.uid) {
      setLiked(false);
      return undefined;
    }
    return listenToUserLike(storyId, user.uid, setLiked);
  }, [storyId, user?.uid]);

  useEffect(() => {
    if (!showComments) return undefined;
    return listenToComments(storyId, setComments);
  }, [storyId, showComments]);

  const readerPages = useMemo(() => {
    const normalizedChapters = normalizeChapters({ chapters, pages });

    return normalizedChapters.flatMap((chapter, chapterIndex) => {
      const chapterPages = chunkText(chapter.content, maxChars);
      return chapterPages.map((content, pageIndex) => ({
        content,
        chapterTitle: chapter.title,
        chapterNumber: chapterIndex + 1,
        isFirstChapterPage: pageIndex === 0
      }));
    });
  }, [chapters, pages, maxChars]);

  const currentPage = readerPages[page] || {
    content: '',
    chapterTitle: 'Capítulo 1',
    chapterNumber: 1,
    isFirstChapterPage: true
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

  async function handleLike() {
    if (!user) {
      await loginWithGoogle();
      return;
    }
    await toggleStoryLike(storyId, user);
  }

  async function handleCommentSubmit(event) {
    event.preventDefault();
    if (!user) {
      await loginWithGoogle();
      return;
    }
    await addStoryComment(storyId, user, commentText);
    setCommentText('');
  }

  async function handleShare() {
    const shareUrl = `${window.location.origin}/historias/${storySlug || ''}`;
    if (navigator.share) {
      await navigator.share({ title, text: title, url: shareUrl });
    } else {
      await navigator.clipboard.writeText(shareUrl);
      alert('Enlace copiado');
    }
  }

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
      <div className="reader-top immersive-reader-top" style={centeredHeaderStyle}>
        <div style={centeredHeaderInnerStyle}>
          <h1 style={{ textAlign: 'center' }}>{title}</h1>
        </div>
      </div>

      <div className="book-stage immersive-book-stage">
        <article className="book-page immersive-book-page" key={`${currentPage.chapterNumber}-${page}`}>
          <div className="paper-grain" />
          <div className="reader-page-content" style={pageContentStyle}>
            <div>
              {currentPage.isFirstChapterPage && (
                <div style={chapterHeaderStyle}>
                  <span style={chapterNumberStyle}>Capítulo {currentPage.chapterNumber}</span>
                  <h2 className="reader-chapter-title">{currentPage.chapterTitle}</h2>
                </div>
              )}
              <p style={readerTextStyle}>{currentPage.content}</p>
            </div>

            <div style={actionBarStyle}>
              <button type="button" style={actionButtonStyle} onClick={handleLike} aria-label="Me gusta">
                <Heart size={22} fill={liked ? 'currentColor' : 'none'} />
                <span>{likeCount}</span>
              </button>
              <button type="button" style={actionButtonStyle} onClick={() => setShowComments((value) => !value)} aria-label="Comentar">
                <MessageCircle size={22} />
                <span>Comentar</span>
              </button>
              <button type="button" style={actionButtonStyle} onClick={handleShare} aria-label="Compartir">
                <Share2 size={22} />
                <span>Compartir</span>
              </button>
            </div>

            {showComments && (
              <div style={commentsPanelStyle}>
                {!user && (
                  <button type="button" className="reader-audio-button" onClick={loginWithGoogle}>
                    Iniciar con Google para comentar
                  </button>
                )}
                {user && (
                  <form onSubmit={handleCommentSubmit} style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                    <input
                      value={commentText}
                      onChange={(event) => setCommentText(event.target.value)}
                      placeholder="Escribe un comentario..."
                      style={{ flex: 1, borderRadius: '999px', border: '1px solid rgba(120, 79, 23, 0.25)', padding: '10px 12px' }}
                    />
                    <button type="submit" className="reader-triangle" aria-label="Enviar comentario">
                      <Send size={16} />
                    </button>
                  </form>
                )}
                <div style={{ display: 'grid', gap: '8px', maxHeight: '150px', overflow: 'auto' }}>
                  {comments.length === 0 && <small>Aún no hay comentarios.</small>}
                  {comments.map((comment) => (
                    <div key={comment.id} style={{ fontSize: '0.86rem' }}>
                      <strong>{comment.displayName || 'Usuario'}</strong>
                      <p style={{ margin: '2px 0 0' }}>{comment.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
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
