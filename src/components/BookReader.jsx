import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Home, MessageCircle, Pause, Play, Send, Share2, X } from 'lucide-react';
import { listenToUser, loginWithGoogle } from '../services/authService.js';
import { addStoryComment, listenToComments, listenToStoryStats, listenToUserLike, toggleStoryLike } from '../services/storyEngagementService.js';

const WIDTH_FACTOR = 0.88;
const textStyle = { margin: 0, fontSize: '1.04rem', lineHeight: 1.58, textAlign: 'justify', whiteSpace: 'pre-wrap' };
const actionStyle = { border: 0, background: 'transparent', color: '#6f4b16', fontWeight: 800, display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer' };
const cleanTitle = (v) => String(v || '').replace(/\s+/g, ' ').trim();
const cleanBody = (v) => String(v || '').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\u00A0/g, ' ').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n[ \t]+/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim();
const wordTokens = (v) => cleanTitle(v).match(/\S+\s*/g) || [];
const bodyTokens = (v) => cleanBody(v).match(/\n|[^\s\n]+\s*/g) || [];
function canvasCtx() { if (typeof document === 'undefined') return null; if (!canvasCtx.canvas) canvasCtx.canvas = document.createElement('canvas'); return canvasCtx.canvas.getContext('2d'); }
function wrappedLines(ctx, text, width) { const ws = wordTokens(text); if (!ws.length) return 0; let n = 1, line = ''; ws.forEach((w) => { const next = line ? `${line}${w}` : w; if (ctx.measureText(next.trim()).width <= width) line = next; else { n += 1; line = w; } }); return n; }
function paginate(text, layout, chapterTitle, chapterNumber) {
  const toks = bodyTokens(text), ctx = canvasCtx();
  if (!toks.length) return [''];
  if (!ctx || !layout.width || !layout.lines) return [cleanBody(text)];
  ctx.font = layout.font;
  const width = layout.width * WIDTH_FACTOR;
  const header = wrappedLines(ctx, `CAPÍTULO ${chapterNumber}`, width) + wrappedLines(ctx, chapterTitle, width) + 1;
  const pages = [];
  let page = [], line = '', used = 0, pageIndex = 0;
  const limit = () => Math.max(4, layout.lines - (pageIndex === 0 ? header : 0) - 1);
  const save = () => { const content = page.join('').trim(); if (content) pages.push(content); page = []; line = ''; used = 0; pageIndex += 1; };
  const addWord = (tok) => {
    if (!line) { if (used + 1 > limit()) save(); page.push(tok); line = tok; used += 1; return; }
    const next = `${line}${tok}`;
    if (ctx.measureText(next.trim()).width <= width) { page.push(tok); line = next; return; }
    if (used + 1 > limit()) save();
    page.push(tok); line = tok; used += 1;
  };
  toks.forEach((tok) => {
    if (tok === '\n') { if (used + 1 > limit()) save(); else { page.push(tok); line = ''; used += 1; } return; }
    addWord(tok);
  });
  if (page.length) pages.push(page.join('').trim());
  return pages.length ? pages : [''];
}

export default function BookReader({ title, chapters = [], pages = [], storyId, storySlug }) {
  const textBoxRef = useRef(null);
  const [layout, setLayout] = useState({ width: 0, lines: 12, font: '16px serif' });
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
    return source.flatMap((ch, ci) => { const chapterTitle = cleanTitle(ch.title || `Capítulo ${ci + 1}`), chapterNumber = ci + 1; return paginate(ch.content, layout, chapterTitle, chapterNumber).map((content, i) => ({ content, chapterTitle, chapterNumber, first: i === 0 })); });
  }, [chapters, pages, layout]);
  const current = readerPages[page] || { content: '', chapterTitle: '', chapterNumber: 1, first: true };
  useLayoutEffect(() => { const calc = () => { const box = textBoxRef.current; if (!box) return; const p = box.querySelector('p') || box; const s = window.getComputedStyle(p); const fs = parseFloat(s.fontSize) || 16; const lh = parseFloat(s.lineHeight) || fs * 1.58; const font = s.font || `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`; setLayout({ width: box.clientWidth, lines: Math.max(4, Math.floor(box.clientHeight / lh)), font }); }; calc(); window.addEventListener('resize', calc); document.fonts?.ready?.then(calc).catch(() => {}); return () => window.removeEventListener('resize', calc); }, []);
  useEffect(() => listenToUser(setUser), []);
  useEffect(() => listenToStoryStats(storyId, (s) => { setLikeCount(s.likeCount); setCommentCount(s.commentCount); }), [storyId]);
  useEffect(() => listenToUserLike(storyId, setLiked), [storyId]);
  useEffect(() => (showComments ? listenToComments(storyId, setComments) : undefined), [storyId, showComments]);
  useEffect(() => { if ('speechSynthesis' in window) { window.speechSynthesis.cancel(); setSpeaking(false); } }, [page]);
  useEffect(() => () => { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }, []);
  useEffect(() => setPage(0), [chapters, pages, layout.width, layout.lines]);
  async function submitComment(e) { e.preventDefault(); if (!user) { await loginWithGoogle(); return; } const t = commentText.trim(); if (!t) return; await addStoryComment(storyId, user, t); setCommentText(''); }
  async function shareStory() { const url = `${window.location.origin}/historias/${storySlug || ''}`; if (navigator.share) await navigator.share({ title, text: title, url }); else { await navigator.clipboard.writeText(url); alert('Enlace copiado'); } }
  function toggleAudio() { if (!('speechSynthesis' in window)) return; if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; } const txt = [page === 0 ? title : '', current.first ? `Capítulo ${current.chapterNumber}. ${current.chapterTitle}` : '', current.content].filter(Boolean).join('. '); const u = new SpeechSynthesisUtterance(txt); u.lang = 'es-ES'; u.rate = 0.92; u.pitch = 1; u.onend = () => setSpeaking(false); u.onerror = () => setSpeaking(false); window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); setSpeaking(true); }
  return <section className="reader-shell immersive-reader"><div className="reader-top immersive-reader-top" style={{ justifyContent: 'center', textAlign: 'center' }}><div style={{ width: '100%', textAlign: 'center' }}><h1>{title}</h1></div></div><div className="book-stage immersive-book-stage"><article className="book-page immersive-book-page"><div className="paper-grain" /><div className="reader-page-content" style={{ position: 'relative', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', paddingBottom: 0 }}><div ref={textBoxRef} style={{ flex: '1 1 auto', minHeight: 0, overflow: 'hidden' }}>{current.first && <div style={{ textAlign: 'center', marginBottom: 16 }}><span style={{ display: 'block', marginBottom: 6, color: 'var(--gold-dark)', fontWeight: 800, letterSpacing: '0.12em' }}>CAPÍTULO {current.chapterNumber}</span><h2 className="reader-chapter-title">{current.chapterTitle}</h2></div>}<p style={textStyle}>{current.content}</p></div><div style={{ flex: '0 0 auto', paddingTop: 8, display: 'flex', justifyContent: 'center', gap: 18 }}><button type="button" style={actionStyle} onClick={() => toggleStoryLike(storyId)} aria-label="Me gusta"><Heart size={22} fill={liked ? 'currentColor' : 'none'} /><span>{likeCount}</span></button><button type="button" style={actionStyle} onClick={() => setShowComments(true)} aria-label="Comentar"><MessageCircle size={22} /><span>{commentCount}</span></button><button type="button" style={actionStyle} onClick={shareStory} aria-label="Compartir"><Share2 size={22} /><span>Compartir</span></button></div></div></article></div>{showComments && <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(25,18,10,.48)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16 }}><div style={{ width: 'min(560px,100%)', maxHeight: '78svh', overflow: 'hidden', borderRadius: 24, background: '#fff8ea', border: '1px solid rgba(120,79,23,.18)', boxShadow: '0 24px 70px rgba(0,0,0,.28)', padding: 16 }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}><div><strong>Comentarios</strong><p style={{ margin: '2px 0 0', fontSize: '.86rem' }}>{title}</p></div><button type="button" className="reader-triangle" onClick={() => setShowComments(false)}><X size={16} /></button></div>{user ? <form onSubmit={submitComment} style={{ display: 'flex', gap: 8, marginBottom: 12 }}><input value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Escribe un comentario..." style={{ flex: 1, borderRadius: 999, border: '1px solid rgba(120,79,23,.25)', padding: '10px 12px' }} /><button type="submit" className="reader-triangle"><Send size={16} /></button></form> : <button type="button" className="reader-audio-button" onClick={loginWithGoogle} style={{ marginBottom: 12 }}>Iniciar con Google para comentar</button>}<div style={{ display: 'grid', gap: 10, maxHeight: '46svh', overflow: 'auto', paddingRight: 4 }}>{comments.length === 0 && <small>Aún no hay comentarios.</small>}{comments.map((c) => <div key={c.id} style={{ fontSize: '.9rem', borderTop: '1px solid rgba(120,79,23,.12)', paddingTop: 8 }}><strong>{c.displayName || 'Usuario'}</strong><p style={{ margin: '3px 0 0' }}>{c.text}</p></div>)}</div></div></div>}<div className="reader-controls immersive-reader-controls"><Link className="reader-home-button" to="/historias"><Home size={18} /> Inicio</Link><button className="reader-triangle" onClick={() => setPage((v) => Math.max(v - 1, 0))} disabled={page === 0}>◀</button><button className="reader-audio-button" type="button" onClick={toggleAudio}>{speaking ? <Pause size={18} /> : <Play size={18} />} Audio</button><button className="reader-triangle" onClick={() => setPage((v) => Math.min(v + 1, readerPages.length - 1))} disabled={page === readerPages.length - 1}>▶</button></div></section>;
}
