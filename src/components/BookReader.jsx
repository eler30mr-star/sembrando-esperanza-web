import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Home, MessageCircle, Pause, Play, Send, Share2, X } from 'lucide-react';
import { listenToUser, loginWithGoogle } from '../services/authService.js';
import { addStoryComment, listenToComments, listenToStoryStats, listenToUserLike, toggleStoryLike } from '../services/storyEngagementService.js';

function clean(value) {
  return String(value || '').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
}

function cleanContent(value) {
  return String(value || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function getWords(value) {
  return clean(value).match(/\S+\s*/g) || [];
}

function getTextTokens(value) {
  return cleanContent(value).match(/\n|[^\s\n]+\s*/g) || [];
}

function getCanvas() {
  if (typeof document === 'undefined') return null;
  if (!getCanvas.canvas) getCanvas.canvas = document.createElement('canvas');
  return getCanvas.canvas.getContext('2d');
}

function wrappedLineCount(ctx, text, width) {
  const words = getWords(text);
  if (!words.length) return 0;
  let lines = 1;
  let current = '';
  words.forEach((word) => {
    const candidate = current ? `${current}${word}` : word;
    if (ctx.measureText(candidate.trim()).width <= width) {
      current = candidate;
    } else {
      lines += 1;
      current = word;
    }
  });
  return lines;
}

function headerLineCount(ctx, chapterTitle, chapterNumber, layout) {
  if (!layout.width) return 0;
  const chapterLabel = `CAPÍTULO ${chapterNumber}`;
  return wrappedLineCount(ctx, chapterLabel, layout.width) + wrappedLineCount(ctx, chapterTitle, layout.width) + 1;
}

function splitByLines(text, layout, chapterTitle, chapterNumber) {
  const textTokens = getTextTokens(text);
  if (!textTokens.length) return [''];

  const ctx = getCanvas();
  if (!ctx || !layout.width || !layout.maxLines) return [cleanContent(text)];
  ctx.font = layout.font;

  const pages = [];
  let pageTokens = [];
  let currentLine = '';
  let usedLines = 1;
  let pageIndex = 0;

  const pageLineLimit = () => {
    const headerLines = pageIndex === 0 ? headerLineCount(ctx, chapterTitle, chapterNumber, layout) : 0;
    return Math.max(4, layout.maxLines - headerLines);
  };

  const pushPage = () => {
    const content = pageTokens.join('').trim();
    if (content) pages.push(content);
    pageTokens = [];
    currentLine = '';
    usedLines = 1;
    pageIndex += 1;
  };

  textTokens.forEach((token) => {
    if (token === '\n') {
      if (usedLines + 1 > pageLineLimit()) {
        pushPage();
      } else {
        pageTokens.push(token);
        currentLine = '';
        usedLines += 1;
      }
      return;
    }

    const candidate = currentLine ? `${currentLine}${token}` : token;
    const fitsLine = ctx.measureText(candidate.trim()).width <= layout.width;

    if (fitsLine) {
      currentLine = candidate;
      pageTokens.push(token);
      return;
    }

    if (usedLines + 1 > pageLineLimit()) {
      pushPage();
      pageTokens.push(token);
      currentLine = token;
      return;
    }

    pageTokens.push(token);
    currentLine = token;
    usedLines += 1;
  });

  if (pageTokens.length) pages.push(pageTokens.join('').trim());
  return pages.length ? pages : [''];
}

const textStyle = { margin: 0, fontSize: '1.04rem', lineHeight: 1.58, textAlign: 'justify', whiteSpace: 'pre-wrap' };
const actionStyle = { border: 0, background: 'transparent', color: '#6f4b16', fontWeight: 800, display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer' };

export default function BookReader({ title, chapters = [], pages = [], storyId, storySlug }) {
  const textBoxRef = useRef(null);
  const [layout, setLayout] = useState({ width: 0, maxLines: 12, font: '16px serif' });
  const [page, setPage] = useState(0);
  const [user, setUser] = useState(null);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');

  const readerPages = useMemo(() => {
    const source = chapters.length ? chapters : [{ title: 'Capítulo 1', content: pages.join('\n\n') }];
    return source.flatMap((chapter, chapterIndex) => {
      const chapterTitle = clean(chapter.title || `Capítulo ${chapterIndex + 1}`);
      const chapterNumber = chapterIndex + 1;
      return splitByLines(chapter.content, layout, chapterTitle, chapterNumber).map((content, index) => ({
        content,
        chapterTitle,
        chapterNumber,
        first: index === 0
      }));
    });
  }, [chapters, pages, layout]);

  const current = readerPages[page] || { content: '', chapterTitle: '', chapterNumber: 1, first: true };

  useLayoutEffect(() => {
    function calculateLines() {
      const box = textBoxRef.current;
      if (!box) return;
      const paragraph = box.querySelector('p') || box;
      const styles = window.getComputedStyle(paragraph);
      const fontSize = parseFloat(styles.fontSize) || 16;
      const lineHeight = parseFloat(styles.lineHeight) || fontSize * 1.58;
      const maxLines = Math.max(4, Math.floor(box.clientHeight / lineHeight));
      const font = styles.font || `${styles.fontWeight} ${styles.fontSize} ${styles.fontFamily}`;
      setLayout({ width: box.clientWidth, maxLines, font });
    }
    calculateLines();
    window.addEventListener('resize', calculateLines);
    document.fonts?.ready?.then(calculateLines).catch(() => {});
    return () => window.removeEventListener('resize', calculateLines);
  }, []);

  useEffect(() => listenToUser(setUser), []);
  useEffect(() => listenToStoryStats(storyId, (stats) => { setLikeCount(stats.likeCount); setCommentCount(stats.commentCount); }), [storyId]);
  useEffect(() => listenToUserLike(storyId, setLiked), [storyId]);
  useEffect(() => (showComments ? listenToComments(storyId, setComments) : undefined), [storyId, showComments]);
  useEffect(() => { if ('speechSynthesis' in window) { window.speechSynthesis.cancel(); setSpeaking(false); } }, [page]);
  useEffect(() => () => { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }, []);
  useEffect(() => setPage(0), [chapters, pages, layout.width, layout.maxLines]);

  async function submitComment(event) {
    event.preventDefault();
    if (!user) { await loginWithGoogle(); return; }
    const text = commentText.trim();
    if (!text) return;
    await addStoryComment(storyId, user, text);
    setCommentText('');
  }

  async function shareStory() {
    const url = `${window.location.origin}/historias/${storySlug || ''}`;
    if (navigator.share) await navigator.share({ title, text: title, url });
    else { await navigator.clipboard.writeText(url); alert('Enlace copiado'); }
  }

  function toggleAudio() {
    if (!('speechSynthesis' in window)) return;
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const audioText = [page === 0 ? title : '', current.first ? `Capítulo ${current.chapterNumber}. ${current.chapterTitle}` : '', current.content].filter(Boolean).join('. ');
    const utterance = new SpeechSynthesisUtterance(audioText);
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
      <div className="reader-top immersive-reader-top" style={{ justifyContent: 'center', textAlign: 'center' }}><div style={{ width: '100%', textAlign: 'center' }}><h1>{title}</h1></div></div>
      <div className="book-stage immersive-book-stage"><article className="book-page immersive-book-page"><div className="paper-grain" /><div className="reader-page-content" style={{ position: 'relative', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', paddingBottom: 0 }}><div ref={textBoxRef} style={{ flex: '1 1 auto', minHeight: 0, overflow: 'hidden' }}>{current.first && <div style={{ textAlign: 'center', marginBottom: 16 }}><span style={{ display: 'block', marginBottom: 6, color: 'var(--gold-dark)', fontWeight: 800, letterSpacing: '0.12em' }}>CAPÍTULO {current.chapterNumber}</span><h2 className="reader-chapter-title">{current.chapterTitle}</h2></div>}<p style={textStyle}>{current.content}</p></div><div style={{ flex: '0 0 auto', paddingTop: 8, display: 'flex', justifyContent: 'center', gap: 18 }}><button type="button" style={actionStyle} onClick={() => toggleStoryLike(storyId)} aria-label="Me gusta"><Heart size={22} fill={liked ? 'currentColor' : 'none'} /><span>{likeCount}</span></button><button type="button" style={actionStyle} onClick={() => setShowComments(true)} aria-label="Comentar"><MessageCircle size={22} /><span>{commentCount}</span></button><button type="button" style={actionStyle} onClick={shareStory} aria-label="Compartir"><Share2 size={22} /><span>Compartir</span></button></div></div></article></div>
      {showComments && <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(25,18,10,.48)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16 }}><div style={{ width: 'min(560px,100%)', maxHeight: '78svh', overflow: 'hidden', borderRadius: 24, background: '#fff8ea', border: '1px solid rgba(120,79,23,.18)', boxShadow: '0 24px 70px rgba(0,0,0,.28)', padding: 16 }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}><div><strong>Comentarios</strong><p style={{ margin: '2px 0 0', fontSize: '.86rem' }}>{title}</p></div><button type="button" className="reader-triangle" onClick={() => setShowComments(false)}><X size={16} /></button></div>{user ? <form onSubmit={submitComment} style={{ display: 'flex', gap: 8, marginBottom: 12 }}><input value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Escribe un comentario..." style={{ flex: 1, borderRadius: 999, border: '1px solid rgba(120,79,23,.25)', padding: '10px 12px' }} /><button type="submit" className="reader-triangle"><Send size={16} /></button></form> : <button type="button" className="reader-audio-button" onClick={loginWithGoogle} style={{ marginBottom: 12 }}>Iniciar con Google para comentar</button>}<div style={{ display: 'grid', gap: 10, maxHeight: '46svh', overflow: 'auto', paddingRight: 4 }}>{comments.length === 0 && <small>Aún no hay comentarios.</small>}{comments.map((comment) => <div key={comment.id} style={{ fontSize: '.9rem', borderTop: '1px solid rgba(120,79,23,.12)', paddingTop: 8 }}><strong>{comment.displayName || 'Usuario'}</strong><p style={{ margin: '3px 0 0' }}>{comment.text}</p></div>)}</div></div></div>}
      <div className="reader-controls immersive-reader-controls"><Link className="reader-home-button" to="/historias"><Home size={18} /> Inicio</Link><button className="reader-triangle" onClick={() => setPage((value) => Math.max(value - 1, 0))} disabled={page === 0}>◀</button><button className="reader-audio-button" type="button" onClick={toggleAudio}>{speaking ? <Pause size={18} /> : <Play size={18} />} Audio</button><button className="reader-triangle" onClick={() => setPage((value) => Math.min(value + 1, readerPages.length - 1))} disabled={page === readerPages.length - 1}>▶</button></div>
    </section>
  );
}
