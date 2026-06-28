import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Heart, Home, MessageCircle, Pause, Play, Send, Share2, X } from 'lucide-react';
import { listenToUser, loginWithGoogle } from '../services/authService.js';
import {
  addStoryComment,
  listenToComments,
  listenToStoryStats,
  listenToUserLike,
  toggleStoryLike
} from '../services/storyEngagementService.js';

const WIDTH_FACTOR = 0.94;
const PAGE_BOTTOM_SAFETY = 28;
const JUSTIFY_MIN_RATIO = 0.82;
const AUDIO_CHARS_PER_SECOND = 13;

const cleanTitle = (v) => String(v || '').replace(/\s+/g, ' ').trim();
const cleanBody = (v) => String(v || '')
  .replace(/[\u200B-\u200D\uFEFF]/g, '')
  .replace(/\u00A0/g, ' ')
  .replace(/\r\n/g, '\n')
  .replace(/\r/g, '\n')
  .replace(/[ \t]+/g, ' ')
  .replace(/\n[ \t]+/g, '\n')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{4,}/g, '\n\n\n')
  .trim();
const wordTokens = (v) => cleanTitle(v).match(/\S+\s*/g) || [];
const audioClean = (v) => String(v || '').replace(/\s+/g, ' ').trim();

function canvasCtx() {
  if (typeof document === 'undefined') return null;
  if (!canvasCtx.canvas) canvasCtx.canvas = document.createElement('canvas');
  return canvasCtx.canvas.getContext('2d');
}

function wrappedLines(ctx, text, width) {
  const ws = wordTokens(text);
  if (!ws.length) return 0;
  let n = 1;
  let line = '';

  ws.forEach((w) => {
    const next = line ? `${line}${w}` : w;
    if (ctx.measureText(next.trim()).width <= width) {
      line = next;
    } else {
      n += 1;
      line = w;
    }
  });

  return n;
}

function shouldJustifyLine(ctx, line, width, isLastParagraphLine) {
  if (!line || isLastParagraphLine) return false;
  if ((line.match(/\s+/g) || []).length < 2) return false;
  return ctx.measureText(line.trim()).width >= width * JUSTIFY_MIN_RATIO;
}

function wrapTextIntoVisualLines(ctx, text, width) {
  const cleaned = cleanBody(text);
  if (!cleaned) return [];
  const logicalLines = cleaned.split('\n');
  const visualLines = [];

  logicalLines.forEach((logicalLine) => {
    const line = logicalLine.trim();
    if (!line) {
      visualLines.push({ text: '', justify: false, empty: true });
      return;
    }

    const tokens = line.match(/\S+\s*/g) || [];
    const paragraphLines = [];
    let currentLine = '';

    tokens.forEach((token) => {
      const next = currentLine ? `${currentLine}${token}` : token;
      if (!currentLine || ctx.measureText(next.trim()).width <= width) {
        currentLine = next;
        return;
      }
      paragraphLines.push(currentLine.trimEnd());
      currentLine = token;
    });

    if (currentLine) paragraphLines.push(currentLine.trimEnd());

    paragraphLines.forEach((visualLine, index) => {
      const isLastParagraphLine = index === paragraphLines.length - 1;
      visualLines.push({
        text: visualLine,
        justify: shouldJustifyLine(ctx, visualLine, width, isLastParagraphLine),
        empty: false
      });
    });
  });

  return visualLines;
}

function pageText(lines = []) {
  return lines.map((line) => line.text || '').join('\n').trim();
}

function paginate(text, layout, chapterTitle) {
  const ctx = canvasCtx();
  if (!ctx || !layout.width || !layout.height || !layout.bodyLineHeight) {
    const fallback = cleanBody(text);
    return [{ lines: fallback ? [{ text: fallback, justify: false, empty: false }] : [], text: fallback }];
  }

  const width = layout.width * WIDTH_FACTOR;
  const pageLimit = Math.max(layout.bodyLineHeight * 5, layout.height - PAGE_BOTTOM_SAFETY);
  const bodyLineHeight = layout.bodyLineHeight;
  const titleLineHeight = layout.titleLineHeight || bodyLineHeight;
  const titleMargin = layout.titleMarginBottom || Math.round(bodyLineHeight * 0.35);
  const pages = [];
  let pageLines = [];
  let usedHeight = 0;

  const save = () => {
    const lines = pageLines;
    const textValue = pageText(lines);
    if (textValue) pages.push({ lines, text: textValue });
    pageLines = [];
    usedHeight = 0;
  };

  const addHeightOnly = (height) => {
    usedHeight += height;
  };

  const addVisualLine = (visualLine) => {
    if (usedHeight + bodyLineHeight > pageLimit && pageLines.length) save();
    pageLines.push(visualLine);
    usedHeight += bodyLineHeight;
  };

  if (chapterTitle) {
    ctx.font = layout.titleFont || layout.bodyFont;
    addHeightOnly(wrappedLines(ctx, chapterTitle, width) * titleLineHeight + titleMargin);
  }

  ctx.font = layout.bodyFont;
  const visualLines = wrapTextIntoVisualLines(ctx, text, width);
  visualLines.forEach(addVisualLine);

  if (pageLines.length) {
    const textValue = pageText(pageLines);
    if (textValue) pages.push({ lines: pageLines, text: textValue });
  }
  return pages.length ? pages : [{ lines: [], text: '' }];
}

export default function BookReader({ title, chapters = [], pages = [], storyId, storySlug }) {
  const textBoxRef = useRef(null);
  const utteranceRef = useRef(null);
  const audioTextRef = useRef('');
  const audioIndexRef = useRef(0);
  const audioStartIndexRef = useRef(0);
  const audioStartTimeRef = useRef(0);
  const audioHadBoundaryRef = useRef(false);
  const pauseCancelRef = useRef(false);
  const autoAdvanceRef = useRef(false);
  const [layout, setLayout] = useState({ width: 0, height: 0, bodyFont: '16px serif', bodyLineHeight: 24, titleFont: '16px serif', titleLineHeight: 24, titleMarginBottom: 8 });
  const [page, setPage] = useState(0);
  const [user, setUser] = useState(null);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [audioPaused, setAudioPaused] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');

  const readerPages = useMemo(() => {
    const source = chapters.length ? chapters : [{ title: 'Capítulo 1', content: pages.join('\n\n') }];
    return source.flatMap((ch, ci) => {
      const chapterTitle = cleanTitle(ch.title || `Capítulo ${ci + 1}`);
      const chapterNumber = ci + 1;
      return paginate(ch.content, layout, chapterTitle).map((pageData, i) => ({
        content: pageData.text,
        lines: pageData.lines,
        chapterTitle,
        chapterNumber,
        first: i === 0
      }));
    });
  }, [chapters, pages, layout]);

  const current = readerPages[page] || { content: '', lines: [], chapterTitle: '', chapterNumber: 1, first: true };

  useLayoutEffect(() => {
    const calc = () => {
      const box = textBoxRef.current;
      if (!box) return;
      const p = box.querySelector('p') || box;
      const titleEl = box.querySelector('.reader-chapter-title');
      const bodyStyle = window.getComputedStyle(p);
      const titleStyle = titleEl ? window.getComputedStyle(titleEl) : bodyStyle;
      const bodyFontSize = parseFloat(bodyStyle.fontSize) || 16;
      const titleFontSize = parseFloat(titleStyle.fontSize) || bodyFontSize;
      const bodyLineHeight = parseFloat(bodyStyle.lineHeight) || bodyFontSize * 1.58;
      const titleLineHeight = parseFloat(titleStyle.lineHeight) || titleFontSize * 1.2;
      const titleMarginBottom = parseFloat(titleStyle.marginBottom) || Math.round(bodyLineHeight * 0.35);
      const bodyFont = bodyStyle.font || `${bodyStyle.fontWeight} ${bodyStyle.fontSize} ${bodyStyle.fontFamily}`;
      const titleFont = titleStyle.font || `${titleStyle.fontWeight} ${titleStyle.fontSize} ${titleStyle.fontFamily}`;
      const next = {
        width: box.clientWidth,
        height: box.clientHeight,
        bodyFont,
        bodyLineHeight,
        titleFont,
        titleLineHeight,
        titleMarginBottom
      };
      setLayout((prev) => (
        prev.width === next.width &&
        prev.height === next.height &&
        prev.bodyFont === next.bodyFont &&
        prev.bodyLineHeight === next.bodyLineHeight &&
        prev.titleFont === next.titleFont &&
        prev.titleLineHeight === next.titleLineHeight &&
        prev.titleMarginBottom === next.titleMarginBottom ? prev : next
      ));
    };

    calc();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(calc) : null;
    if (textBoxRef.current) observer?.observe(textBoxRef.current);
    window.addEventListener('resize', calc);
    document.fonts?.ready?.then(calc).catch(() => {});

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', calc);
    };
  }, []);

  useEffect(() => listenToUser(setUser), []);
  useEffect(() => listenToStoryStats(storyId, (s) => { setLikeCount(s.likeCount); setCommentCount(s.commentCount); }), [storyId]);
  useEffect(() => listenToUserLike(storyId, setLiked), [storyId]);
  useEffect(() => (showComments ? listenToComments(storyId, setComments) : undefined), [storyId, showComments]);
  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
      audioTextRef.current = '';
      audioIndexRef.current = 0;
      audioStartIndexRef.current = 0;
      audioStartTimeRef.current = 0;
      audioHadBoundaryRef.current = false;
      pauseCancelRef.current = false;
      setSpeaking(false);
      setAudioPaused(false);
    }
  }, [page]);
  useEffect(() => {
    if (!autoAdvanceRef.current) return undefined;
    autoAdvanceRef.current = false;
    const nextText = audioTextForPage(readerPages[page]);
    const timer = window.setTimeout(() => {
      if (nextText.trim()) speakFrom(nextText, 0);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [page, readerPages]);
  useEffect(() => () => { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }, []);
  useEffect(() => setPage(0), [chapters, pages, layout.width, layout.height]);

  async function submitComment(e) {
    e.preventDefault();
    if (!user) {
      await loginWithGoogle();
      return;
    }
    const t = commentText.trim();
    if (!t) return;
    await addStoryComment(storyId, user, t);
    setCommentText('');
  }

  async function shareStory() {
    const url = `${window.location.origin}/historias/${storySlug || ''}`;
    if (navigator.share) await navigator.share({ title, text: title, url });
    else {
      await navigator.clipboard.writeText(url);
      alert('Enlace copiado');
    }
  }

  function audioTextForPage(pageData) {
    if (!pageData) return '';
    const heading = pageData.first ? audioClean(`Capítulo ${pageData.chapterNumber}. ${pageData.chapterTitle}`) : '';
    const body = audioClean(pageData.content);
    return [heading, body].filter(Boolean).join('. ');
  }

  function currentAudioText() {
    return audioTextForPage(current);
  }

  function wordStart(text, index) {
    let i = Math.max(0, Math.min(index, text.length));
    while (i > 0 && /\S/.test(text[i - 1])) i -= 1;
    return i;
  }

  function estimatedAudioIndex() {
    const text = audioTextRef.current || currentAudioText();
    if (!text) return 0;
    if (audioHadBoundaryRef.current && audioIndexRef.current > 0) return wordStart(text, audioIndexRef.current);
    const elapsedSeconds = Math.max(0, (performance.now() - audioStartTimeRef.current) / 1000);
    return wordStart(text, audioStartIndexRef.current + Math.floor(elapsedSeconds * AUDIO_CHARS_PER_SECOND));
  }

  function speakFrom(text, startIndex = 0) {
    if (!('speechSynthesis' in window)) return;
    const rawText = audioClean(text);
    const safeStart = wordStart(rawText, startIndex);
    const rawRemainder = rawText.slice(safeStart);
    const leadingSpaces = rawRemainder.length - rawRemainder.trimStart().length;
    const actualStart = safeStart + leadingSpaces;
    const spokenText = rawText.slice(actualStart);
    if (!spokenText.trim()) return;

    const u = new SpeechSynthesisUtterance(spokenText);
    utteranceRef.current = u;
    audioTextRef.current = rawText;
    audioIndexRef.current = actualStart;
    audioStartIndexRef.current = actualStart;
    audioStartTimeRef.current = performance.now();
    audioHadBoundaryRef.current = false;
    pauseCancelRef.current = false;
    u.lang = 'es-ES';
    u.rate = 0.92;
    u.pitch = 1;
    u.onboundary = (event) => {
      if (typeof event.charIndex === 'number') {
        audioHadBoundaryRef.current = true;
        audioIndexRef.current = wordStart(rawText, actualStart + event.charIndex);
      }
    };
    u.onend = () => {
      if (pauseCancelRef.current) return;
      utteranceRef.current = null;
      audioIndexRef.current = 0;
      audioStartIndexRef.current = 0;
      audioStartTimeRef.current = 0;
      audioHadBoundaryRef.current = false;
      if (page < readerPages.length - 1) {
        autoAdvanceRef.current = true;
        setPage((v) => Math.min(v + 1, readerPages.length - 1));
        return;
      }
      setSpeaking(false);
      setAudioPaused(false);
    };
    u.onerror = () => {
      if (pauseCancelRef.current) return;
      utteranceRef.current = null;
      setSpeaking(false);
      setAudioPaused(false);
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setSpeaking(true);
    setAudioPaused(false);
  }

  function toggleAudio() {
    if (!('speechSynthesis' in window)) return;

    if (speaking) {
      audioIndexRef.current = estimatedAudioIndex();
      pauseCancelRef.current = true;
      autoAdvanceRef.current = false;
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
      setSpeaking(false);
      setAudioPaused(true);
      return;
    }

    if (audioPaused) {
      speakFrom(audioTextRef.current || currentAudioText(), audioIndexRef.current);
      return;
    }

    speakFrom(currentAudioText(), 0);
  }

  return (
    <section className="reader-shell immersive-reader">
      <div className="reader-top immersive-reader-top">
        <Link className="reader-icon-button reader-top-button" to="/historias" aria-label="Inicio">
          <Home size={20} />
        </Link>
        <div className="reader-current-chapter">
          <span>Capítulo {current.chapterNumber}</span>
          <small>Página {Math.min(page + 1, readerPages.length)} de {readerPages.length || 1}</small>
        </div>
        <button className="reader-icon-button reader-top-button" type="button" onClick={toggleAudio} aria-label={speaking ? 'Pausar audio' : 'Reproducir audio'}>
          {speaking ? <Pause size={22} /> : <Play size={22} />}
        </button>
      </div>

      <div className="book-stage immersive-book-stage">
        <article className="book-page immersive-book-page">
          <div className="paper-grain" />
          <div className="reader-page-content">
            <div ref={textBoxRef} className="reader-text-box">
              {current.first && (
                <div className="reader-chapter-header">
                  <h2 className="reader-chapter-title">{current.chapterTitle}</h2>
                </div>
              )}
              <p className="reader-lines">
                {(current.lines || []).map((line, index) => (
                  <span
                    // eslint-disable-next-line react/no-array-index-key
                    key={`${page}-${index}`}
                    className={`reader-line${line.empty ? ' reader-line-empty' : ''}${line.justify ? ' reader-line-justify' : ' reader-line-normal'}`}
                  >
                    {line.empty ? '\u00A0' : line.text}
                  </span>
                ))}
              </p>
            </div>
          </div>
        </article>
      </div>

      {showComments && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(25,18,10,.48)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16 }}>
          <div style={{ width: 'min(560px,100%)', maxHeight: '78svh', overflow: 'hidden', borderRadius: 24, background: '#fff8ea', border: '1px solid rgba(120,79,23,.18)', boxShadow: '0 24px 70px rgba(0,0,0,.28)', padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div>
                <strong>Comentarios</strong>
                <p style={{ margin: '2px 0 0', fontSize: '.86rem' }}>{title}</p>
              </div>
              <button type="button" className="reader-triangle" onClick={() => setShowComments(false)}><X size={16} /></button>
            </div>
            {user ? (
              <form onSubmit={submitComment} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Escribe un comentario..." style={{ flex: 1, borderRadius: 999, border: '1px solid rgba(120,79,23,.25)', padding: '10px 12px' }} />
                <button type="submit" className="reader-triangle"><Send size={16} /></button>
              </form>
            ) : (
              <button type="button" className="reader-audio-button" onClick={loginWithGoogle} style={{ marginBottom: 12 }}>Iniciar con Google para comentar</button>
            )}
            <div style={{ display: 'grid', gap: 10, maxHeight: '46svh', overflow: 'auto', paddingRight: 4 }}>
              {comments.length === 0 && <small>Aún no hay comentarios.</small>}
              {comments.map((c) => (
                <div key={c.id} style={{ fontSize: '.9rem', borderTop: '1px solid rgba(120,79,23,.12)', paddingTop: 8 }}>
                  <strong>{c.displayName || 'Usuario'}</strong>
                  <p style={{ margin: '3px 0 0' }}>{c.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="reader-controls immersive-reader-controls" aria-label="Controles del lector">
        <button className="reader-icon-button" onClick={() => setPage((v) => Math.max(v - 1, 0))} disabled={page === 0} aria-label="Página anterior">
          <ChevronLeft size={24} />
        </button>
        <button className="reader-icon-button reader-reaction-button" type="button" onClick={() => toggleStoryLike(storyId)} aria-label="Me gusta">
          <Heart size={22} fill={liked ? 'currentColor' : 'none'} />
          <span>{likeCount}</span>
        </button>
        <button className="reader-icon-button reader-reaction-button" type="button" onClick={() => setShowComments(true)} aria-label="Comentar">
          <MessageCircle size={22} />
          <span>{commentCount}</span>
        </button>
        <button className="reader-icon-button" type="button" onClick={shareStory} aria-label="Compartir">
          <Share2 size={22} />
        </button>
        <button className="reader-icon-button" onClick={() => setPage((v) => Math.min(v + 1, readerPages.length - 1))} disabled={page === readerPages.length - 1} aria-label="Página siguiente">
          <ChevronRight size={24} />
        </button>
      </div>
    </section>
  );
}
