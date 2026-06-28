import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Home, MessageCircle, Pause, Play, Send, Share2, X } from 'lucide-react';
import { listenToUser, loginWithGoogle } from '../services/authService.js';
import { addStoryComment, listenToComments, listenToStoryStats, listenToUserLike, toggleStoryLike } from '../services/storyEngagementService.js';

function normalizeText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function takeTextChunk(text, maxChars) {
  const cleanText = normalizeText(text);

  if (!cleanText || maxChars <= 0) {
    return { chunk: '', remaining: cleanText };
  }

  if (cleanText.length <= maxChars) {
    return { chunk: cleanText, remaining: '' };
  }

  let cutIndex = cleanText.lastIndexOf(' ', maxChars);

  if (cutIndex < Math.floor(maxChars * 0.82)) {
    cutIndex = maxChars;
  }

  return {
    chunk: cleanText.slice(0, cutIndex).trim(),
    remaining: cleanText.slice(cutIndex).trim()
  };
}

function getChapterHeaderCharacterCount(chapterNumber, chapterTitle) {
  return `CAPÍTULO ${chapterNumber}\n${String(chapterTitle || '').trim()}\n\n`.length;
}

function chunkChapterText(text, maxChars, chapterNumber, chapterTitle) {
  const chunks = [];
  const headerCount = getChapterHeaderCharacterCount(chapterNumber, chapterTitle);
  const firstPageLimit = Math.max(0, maxChars - headerCount);
  let remainingText = normalizeText(text);

  const firstChunk = takeTextChunk(remainingText, firstPageLimit);
  chunks.push(firstChunk.chunk);
  remainingText = firstChunk.remaining;

  while (remainingText) {
    const nextChunk = takeTextChunk(remainingText, maxChars);
    chunks.push(nextChunk.chunk);
    remainingText = nextChunk.remaining;
  }

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

const commentsOverlayStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 9999,
  background: 'rgba(25, 18, 10, 0.48)',
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
  padding: '16px'
};

const commentsPanelStyle = {
  width: 'min(560px, 100%)',
  maxHeight: '78svh',
  overflow: 'hidden',
  borderRadius: '24px',
  background: '#fff8ea',
  border: '1px solid rgba(120, 79, 23, 0.18)',
  boxShadow: '0 24px 70px rgba(0, 0, 0, 0.28)',
  padding: '16px'
};

const commentsHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
  marginBottom: '12px'
};

export default function BookReader({ title, subtitle, chapters = [], pages = [], storyId, storySlug }) {
  const [page, setPage] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [maxChars, setMaxChars] = useState(getMaxChars);
  const [user, setUser] = useState(null);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');

  useEffect(() => listenToUser(setUser), []);

  useEffect(() => {
    const handleResize = () => setMaxChars(getMaxChars());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => listenToStoryStats(storyId, (stats) => {
    setLikeCount(stats.likeCount);
    setCommentCount(stats.commentCount);
  }), [storyId]);

  useEffect(() => listenToUserLike(storyId, setLiked), [storyId]);

  useEffect(() => {
    if (!showComments) return undefined;
    return listenToComments(storyId, setComments);
  }, [storyId, showComments]);

  const readerPages = useMemo(() => {
    const normalizedChapters = normalizeChapters({ chapters, pages });

    return normalizedChapters.flatMap((chapter, chapterIndex) => {
      const chapterNumber = chapterIndex + 1;
      const chapterPages = chunkChapterText(chapter.content, maxChars, chapterNumber, chapter.title);
      return chapterPages.map((content, pageIndex) => ({
        content,
        chapterTitle: chapter.title,
        chapterNumber,
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
    await toggleStoryLike(storyId);
  }

  async function handleCommentClick() {
    if (!user) {
      await loginWithGoogle();
    }
    setShowComments(true);
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

  function buildAudioText() {
    const parts = [];
    if (page === 0) parts.push(title);
    if (currentPage.isFirstChapterPage) {
      parts.push(`Capítulo ${currentPage.chapterNumber}`);
      parts.push(currentPage.chapterTitle);
    }
    parts.push(currentPage.content);
    return parts.filter(Boolean).join('. ');
  }

  function toggleAudio() {
    if (!('speechSynthesis' in window)) return;

    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(buildAudioText());
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
              <button type="button" style={actionButtonStyle} onClick={handleCommentClick} aria-label="Comentar">
                <MessageCircle size={22} />
                <span>{commentCount}</span>
              </button>
              <button type="button" style={actionButtonStyle} onClick={handleShare} aria-label="Compartir">
                <Share2 size={22} />
                <span>Compartir</span>
              </button>
            </div>
          </div>
        </article>
      </div>

      {showComments && (
        <div style={commentsOverlayStyle}>
          <div style={commentsPanelStyle}>
            <div style={commentsHeaderStyle}>
              <div>
                <strong>Comentarios</strong>
                <p style={{ margin: '2px 0 0', fontSize: '0.86rem' }}>{title}</p>
              </div>
              <button type="button" className="reader-triangle" onClick={() => setShowComments(false)} aria-label="Cerrar comentarios">
                <X size={16} />
              </button>
            </div>

            {user ? (
              <form onSubmit={handleCommentSubmit} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
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
            ) : (
              <button type="button" className="reader-audio-button" onClick={loginWithGoogle}>
                Iniciar con Google para comentar
              </button>
            )}

            <div style={{ display: 'grid', gap: '10px', maxHeight: '46svh', overflow: 'auto', paddingRight: '4px' }}>
              {comments.length === 0 && <small>Aún no hay comentarios.</small>}
              {comments.map((comment) => (
                <div key={comment.id} style={{ fontSize: '0.9rem', borderTop: '1px solid rgba(120, 79, 23, 0.12)', paddingTop: '8px' }}>
                  <strong>{comment.displayName || 'Usuario'}</strong>
                  <p style={{ margin: '3px 0 0' }}>{comment.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
