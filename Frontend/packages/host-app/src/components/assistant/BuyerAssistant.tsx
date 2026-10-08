import React from 'react';
import {
  deleteAssistantSession,
  getAssistantSession,
  getAssistantSessions,
  sendAssistantMessage,
  type ItemChoice,
  type AssistantSession,
  type AssistantStoredMessage,
} from '../../api/assistantApi';
import ItemChoiceTable from './ItemChoiceTable';
import './BuyerAssistant.css';

const WELCOME: AssistantStoredMessage = {
  role: 'assistant',
  content: 'Hi! I can create RFQs, compare bids, award, and create contracts or purchase orders. What would you like to do?',
  suggestions: ['Create an RFQ', 'Show my RFQs'],
};

const VISIBLE_OPTIONS = 6;
const BULLET = /^\s*[•\-*]\s+(.+?)\s*$/;

interface SplitReply {
  text: string;
  options: string[];
  extras: string[];
}

/**
 * When the bot lists choices as bullets and also offers them as quick replies, show them once, as buttons:
 * the bullets leave the text, and the buttons are the bullets plus any other suggestion (e.g. "Skip").
 * Replies whose bullets are not choices (such as a summary) are left as they are.
 */
const splitReply = (content: string, suggestions: string[] = []): SplitReply => {
  const lines = content.split('\n');
  const bullets = lines.map((l) => BULLET.exec(l)?.[1] ?? null);
  const bulletTexts = new Set(bullets.filter((b): b is string => b !== null));
  const matching = suggestions.filter((s) => bulletTexts.has(s)).length;
  if (suggestions.length === 0 || bulletTexts.size === 0 || matching * 2 < suggestions.length) {
    return { text: content, options: [], extras: suggestions };
  }
  const text = lines
    .filter((l, i) => bullets[i] === null && !/^\s*all other .+:\s*$/i.test(l))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return {
    text,
    options: [...bulletTexts],
    extras: suggestions.filter((s) => !bulletTexts.has(s)),
  };
};

const SIZE_KEY = 'vosox.assistant.size';
const MIN_WIDTH = 320;
const MIN_HEIGHT = 360;
const EDGE = 16; // the gap kept to the window edge

interface PanelSize {
  width: number;
  height: number;
}

const clampSize = (size: PanelSize): PanelSize => ({
  width: Math.min(Math.max(size.width, MIN_WIDTH), Math.max(MIN_WIDTH, window.innerWidth - 2 * EDGE)),
  height: Math.min(Math.max(size.height, MIN_HEIGHT), Math.max(MIN_HEIGHT, window.innerHeight - 2 * EDGE)),
});

/** The size the buyer last chose; storage can be blocked, so a failure just means the default size. */
const savedSize = (): PanelSize | null => {
  try {
    const parsed = JSON.parse(localStorage.getItem(SIZE_KEY) ?? 'null') as Partial<PanelSize> | null;
    return parsed && typeof parsed.width === 'number' && typeof parsed.height === 'number' ? clampSize({ width: parsed.width, height: parsed.height }) : null;
  } catch {
    return null;
  }
};

const BuyerAssistant: React.FC = () => {
  const [size, setSize] = React.useState<PanelSize | null>(savedSize);
  const panelRef = React.useRef<HTMLElement>(null);
  const [showAll, setShowAll] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [showHistory, setShowHistory] = React.useState(false);
  const [messages, setMessages] = React.useState<AssistantStoredMessage[]>([WELCOME]);
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [sessions, setSessions] = React.useState<AssistantSession[]>([]);
  const [input, setInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy, open]);

  // The panel is fixed to the bottom-right corner, so dragging its top-left corner to the left or up makes it larger.
  const startResize = (e: React.PointerEvent<HTMLDivElement>) => {
    const panel = panelRef.current;
    if (!panel) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const start = { width: panel.offsetWidth, height: panel.offsetHeight };
    let latest = start;
    const move = (ev: PointerEvent) => {
      latest = clampSize({ width: start.width + (startX - ev.clientX), height: start.height + (startY - ev.clientY) });
      setSize(latest);
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      try {
        localStorage.setItem(SIZE_KEY, JSON.stringify(latest));
      } catch {
        // not saved; the size still applies until the page is closed
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  };

  const resetSize = () => {
    setSize(null);
    try {
      localStorage.removeItem(SIZE_KEY);
    } catch {
      // nothing saved to remove
    }
  };

  const send = async (text: string, itemChoices?: ItemChoice[]) => {
    const message = text.trim();
    if (!message || busy) return;
    setError(null);
    setInput('');
    setShowAll(false);
    setMessages((prev) => [...prev, { role: 'user', content: message }]);
    setBusy(true);
    try {
      const reply = await sendAssistantMessage(message, sessionId, itemChoices);
      setSessionId(reply.session_id);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: reply.reply, suggestions: reply.suggestions, tables: reply.tables, data: reply.data },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const newChat = () => {
    setSessionId(null);
    setMessages([WELCOME]);
    setError(null);
    setShowHistory(false);
  };

  const openHistory = async () => {
    setShowHistory(true);
    setError(null);
    try {
      setSessions(await getAssistantSessions());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load conversations.');
    }
  };

  const openSession = async (id: string) => {
    setError(null);
    try {
      const session = await getAssistantSession(id);
      setSessionId(session.id);
      setMessages(session.messages.length ? session.messages : [WELCOME]);
      setShowHistory(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load the conversation.');
    }
  };

  const removeSession = async (id: string) => {
    try {
      await deleteAssistantSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (id === sessionId) {
        setSessionId(null);
        setMessages([WELCOME]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete the conversation.');
    }
  };

  // Suggestions are quick replies for the latest bot message only.
  const lastIndex = messages.length - 1;

  return (
    <>
      {!open && (
        <button type="button" className="va-fab" onClick={() => setOpen(true)} aria-label="Open buyer assistant">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}
      {open && (
        <section
          ref={panelRef}
          className="va-panel"
          aria-label="Buyer assistant"
          style={size ? { width: size.width, height: size.height } : undefined}
        >
          <div className="va-resize" onPointerDown={startResize} onDoubleClick={resetSize} title="Drag to resize, double-click to reset" />
          <header className="va-header">
            <span className="va-title">Buyer Assistant</span>
            <div className="va-header-actions">
              <button type="button" onClick={newChat}>New</button>
              <button type="button" onClick={showHistory ? () => setShowHistory(false) : openHistory}>
                {showHistory ? 'Chat' : 'History'}
              </button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>
          </header>

          {showHistory ? (
            <div className="va-body">
              {sessions.length === 0 && !error && <p className="va-muted">No earlier conversations.</p>}
              {sessions.map((s) => (
                <div key={s.id} className="va-session">
                  <button type="button" className="va-session-open" onClick={() => openSession(s.id)}>
                    <span>{s.title || 'Untitled conversation'}</span>
                    <small>{new Date(s.updated_at).toLocaleString()}</small>
                  </button>
                  <button type="button" className="va-session-delete" onClick={() => removeSession(s.id)} aria-label="Delete conversation">🗑</button>
                </div>
              ))}
              {error && <p className="va-error">{error}</p>}
            </div>
          ) : (
            <>
              <div className="va-body">
                {messages.map((m, i) => {
                  const isLast = i === lastIndex;
                  // Only the latest bot message offers choices; earlier ones keep their full text.
                  const itemTable = isLast && m.role === 'assistant' ? m.data?.item_table : undefined;
                  const { text, options, extras } = itemTable
                    // The table replaces the long list of entries and the quick replies; only what the bot settled by itself stays as text.
                    ? { text: [...itemTable.notes.filter((n) => !/free text/i.test(n)), 'Choose the item-master entry (group) for each item, then press Submit.'].join('\n'), options: [], extras: [] }
                    : isLast && m.role === 'assistant'
                      ? splitReply(m.content, m.suggestions)
                      : { text: m.content, options: [], extras: [] };
                  const visible = showAll ? options : options.slice(0, VISIBLE_OPTIONS);
                  const hidden = options.length - visible.length;
                  return (
                  <div key={i} className={`va-msg va-msg-${m.role}`}>
                    <div className="va-bubble">{text}</div>
                    {itemTable && !busy && (
                      <ItemChoiceTable key={m.content} table={itemTable} disabled={busy} onSubmit={(summary, choices) => send(summary, choices)} />
                    )}
                    {m.tables?.map((t, ti) => (
                      <div key={ti} className="va-table-wrap">
                        {t.title && <div className="va-table-title">{t.title}</div>}
                        <table className="va-table">
                          <thead>
                            <tr>{t.columns.map((c) => <th key={c}>{c}</th>)}</tr>
                          </thead>
                          <tbody>
                            {t.rows.map((r, ri) => (
                              <tr key={ri}>{r.map((cell, ci) => <td key={ci}>{cell}</td>)}</tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                    {isLast && !busy && (options.length > 0 || extras.length > 0) && (
                      <div className="va-suggestions">
                        {visible.map((s) => (
                          <button key={s} type="button" onClick={() => send(s)}>{s}</button>
                        ))}
                        {hidden > 0 && (
                          <button type="button" className="va-more" onClick={() => setShowAll(true)}>More ({hidden})</button>
                        )}
                        {options.length > VISIBLE_OPTIONS && showAll && (
                          <button type="button" className="va-more" onClick={() => setShowAll(false)}>Less</button>
                        )}
                        {extras.map((s) => (
                          <button key={s} type="button" onClick={() => send(s)}>{s}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  );
                })}
                {busy && <div className="va-msg va-msg-assistant"><div className="va-bubble va-typing">Thinking…</div></div>}
                {error && <p className="va-error">{error}</p>}
                <div ref={endRef} />
              </div>
              <form
                className="va-input"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send(input);
                }}
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a message…"
                  maxLength={4000}
                  disabled={busy}
                />
                <button type="submit" disabled={busy || !input.trim()}>Send</button>
              </form>
            </>
          )}
        </section>
      )}
    </>
  );
};

export default BuyerAssistant;
