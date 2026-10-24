import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Mic, MicOff, Square, Send, Trash2, Clock, Search, Youtube, Code2, Activity,
  Maximize2, Minimize2, Power, ShieldCheck, Cpu, Keyboard, RotateCcw,
} from "lucide-react";
import { processCommand, type CommandResult } from "@/lib/commands";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JARVIS — Personal Intelligence System" },
      { name: "description", content: "Futuristic voice-controlled AI assistant prototype with chat, command history and live status." },
      { property: "og:title", content: "JARVIS — Personal Intelligence System" },
      { property: "og:description", content: "Futuristic voice-controlled AI assistant prototype." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JarvisApp,
});

type AssistantState = "idle" | "listening" | "processing" | "speaking";
type Role = "user" | "jarvis" | "system" | "voice";
interface ChatMessage { id: number; role: Role; text: string; time: string; retry?: boolean }
interface HistoryItem { text: string; time: string }

const HISTORY_KEY = "jarvis-history";
const STATE_LABEL: Record<AssistantState, string> = {
  idle: "TAP THE MIC OR TYPE A COMMAND",
  listening: "JARVIS IS LISTENING...",
  processing: "PROCESSING YOUR COMMAND...",
  speaking: "JARVIS IS RESPONDING...",
};

const stamp = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecognition = any;

function JarvisApp() {
  const [online, setOnline] = useState(true);
  const [state, setState] = useState<AssistantState>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [input, setInput] = useState("");
  const [now, setNow] = useState<Date | null>(null);
  const [count, setCount] = useState(0);
  const [mode, setMode] = useState<"Voice" | "Text">("Text");
  const [focus, setFocus] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState<boolean | null>(null);
  const [toast, setToast] = useState<{ text: string; link?: string } | null>(null);
  const [particles, setParticles] = useState<{ l: number; s: number; d: number; dl: number }[]>([]);

  const recRef = useRef<AnyRecognition>(null);
  const gotResult = useRef(false);
  const lastReply = useRef("");
  const idRef = useRef(0);
  const chatEnd = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Init (client only)
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    const w = window as AnyRecognition;
    setVoiceSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
    try { setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]")); } catch { /* ignore */ }
    setParticles(Array.from({ length: 28 }, () => ({ l: Math.random() * 100, s: 1 + Math.random() * 2.5, d: 10 + Math.random() * 18, dl: -Math.random() * 25 })));
    pushMsg("system", "JARVIS online. Local command engine loaded (simulated AI).");
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);

  function pushMsg(role: Role, text: string, retry = false) {
    setMessages((m) => [...m, { id: ++idRef.current, role, text, time: stamp(), retry }]);
  }

  const stopAll = useCallback(() => {
    try { recRef.current?.abort(); } catch { /* ignore */ }
    recRef.current = null;
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setState("idle");
  }, []);

  function speak(text: string) {
    if (!text) { setState("idle"); return; }
    const synth = window.speechSynthesis;
    if (!synth) { setState("idle"); return; }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1; u.pitch = 0.9;
    u.onend = () => setState((s) => (s === "speaking" ? "idle" : s));
    u.onerror = () => setState("idle");
    setState("speaking");
    synth.speak(u);
  }

  function runAction(r: CommandResult) {
    const a = r.action;
    if (!a) return;
    if (a.type === "open") {
      const win = window.open(a.url, "_blank", "noopener");
      setToast(win === null ? { text: `Pop-up blocked. Tap to open ${a.label}`, link: a.url } : { text: `✓ Opened ${a.label}` });
      return;
    }
    if (a.type === "clear") { setMessages([]); setToast({ text: "✓ Chat cleared" }); return; }
    setToast({ text: "✓ Command executed" });
  }

  function handleCommand(text: string, source: "voice" | "text") {
    const clean = text.trim();
    if (!clean || !online) return;
    setMode(source === "voice" ? "Voice" : "Text");
    pushMsg(source === "voice" ? "voice" : "user", clean);
    const item = { text: clean, time: stamp() };
    setHistory((h) => {
      const next = [item, ...h].slice(0, 20);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
    setState("processing");
    setTimeout(() => {
      const r = processCommand(clean);
      setCount((c) => c + 1);
      if (r.action?.type === "stop") { stopAll(); pushMsg("system", "Listening and speech stopped."); return; }
      if (r.action?.type === "repeat") {
        const prev = lastReply.current || "I have nothing to repeat yet.";
        pushMsg("jarvis", prev); speak(prev); return;
      }
      if (r.action?.type !== "clear") pushMsg("jarvis", r.reply, !r.understood);
      lastReply.current = r.reply;
      if (r.understood) runAction(r);
      speak(r.reply);
    }, 650);
  }

  function startListening() {
    if (!online) return;
    const w = window as AnyRecognition;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      pushMsg("system", "Voice recognition isn't supported in this browser. Please use Chrome or Edge, or type your command.");
      inputRef.current?.focus();
      return;
    }
    window.speechSynthesis?.cancel();
    const rec = new SR();
    rec.lang = "en-US"; rec.interimResults = false; rec.maxAlternatives = 1;
    gotResult.current = false;
    rec.onresult = (e: AnyRecognition) => {
      gotResult.current = true;
      const transcript = e.results[0][0].transcript as string;
      recRef.current = null;
      handleCommand(transcript, "voice");
    };
    rec.onerror = (e: AnyRecognition) => {
      gotResult.current = true;
      recRef.current = null;
      setState("idle");
      if (e.error === "not-allowed" || e.error === "service-not-allowed")
        pushMsg("system", "Microphone permission denied. Allow mic access in your browser settings, or type your command.");
      else if (e.error === "aborted") return;
      else pushMsg("jarvis", "I couldn't understand that. Please try again.", true);
    };
    rec.onend = () => {
      recRef.current = null;
      setState((s) => (s === "listening" ? "idle" : s));
      if (!gotResult.current) pushMsg("jarvis", "I couldn't understand that. Please try again.", true);
    };
    recRef.current = rec;
    setMode("Voice");
    setState("listening");
    try { rec.start(); } catch { setState("idle"); pushMsg("system", "Couldn't start the microphone. Please try again."); }
  }

  function toggleMic() {
    if (state === "listening") stopAll();
    else startListening();
  }

  // Keyboard shortcuts
  const toggleRef = useRef(toggleMic);
  toggleRef.current = toggleMic;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "Escape") { stopAll(); return; }
      if (e.code === "Space" && tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "BUTTON") {
        e.preventDefault(); toggleRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stopAll]);

  function togglePower() {
    if (online) { stopAll(); setOnline(false); pushMsg("system", "JARVIS stopped. Press power to restart."); }
    else { setOnline(true); pushMsg("system", "JARVIS back online."); }
  }

  const coreState = online ? state : "offline";
  const micActive = state === "listening";
  const busy = state !== "idle";

  const quick = [
    { label: "Time & Date", icon: Clock, cmd: "What is the time?" },
    { label: "Google Search", icon: Search, cmd: "Search for Python tutorials" },
    { label: "YouTube", icon: Youtube, cmd: "Open YouTube" },
    { label: "Python Help", icon: Code2, cmd: "Tell me about Python" },
    { label: "System Status", icon: Activity, cmd: "System status" },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden grid-bg">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {particles.map((p, i) => (
          <span key={i} className="particle" style={{ left: `${p.l}%`, bottom: "-10px", width: p.s, height: p.s, animationDuration: `${p.d}s`, animationDelay: `${p.dl}s` }} />
        ))}
      </div>

      <div className="relative mx-auto flex max-w-7xl flex-col gap-4 p-3 sm:p-5">
        {/* Header */}
        <header className="hud-panel flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <JarvisLogo />
            <div>
              <h1 className="font-display text-2xl font-black tracking-[0.3em] text-cyan glow-text sm:text-3xl">JARVIS</h1>
              <p className="text-[10px] tracking-[0.25em] text-muted-foreground sm:text-xs">YOUR PERSONAL INTELLIGENCE SYSTEM.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden text-right sm:block">
              <div className="font-display text-lg text-cyan">{now ? now.toLocaleTimeString() : "--:--:--"}</div>
              <div className="text-xs text-muted-foreground">{now ? now.toDateString() : ""}</div>
            </div>
            <div className="flex items-center gap-2 rounded-md border px-2 py-1 text-xs font-display tracking-widest">
              <span className={`h-2.5 w-2.5 rounded-full ${online ? "bg-success blink" : "bg-danger"}`} />
              {online ? "ACTIVE" : "STOPPED"}
            </div>
            <button onClick={togglePower} className="hud-btn p-2" aria-label={online ? "Stop JARVIS" : "Start JARVIS"} title="Power">
              <Power className={`h-4 w-4 ${online ? "text-success" : "text-danger"}`} />
            </button>
            <button onClick={() => setFocus((f) => !f)} className="hud-btn flex items-center gap-1 px-2 py-2 text-xs" aria-label="Toggle focus mode">
              {focus ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              <span className="hidden sm:inline">{focus ? "Exit Focus" : "Focus"}</span>
            </button>
          </div>
        </header>

        {!focus && (
          <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatCard label="AI System" value={online ? "Online" : "Offline"} tone={online ? "ok" : "bad"} sub="Local engine (simulated)" />
            <StatCard label="Voice Recognition" value={voiceSupported === null ? "Checking" : voiceSupported ? (micActive ? "Listening" : "Ready") : "Unsupported"} tone={voiceSupported === false ? "bad" : micActive ? "ok" : undefined} sub={voiceSupported === false ? "Use text input" : "Browser Speech API"} />
            <StatCard label="Date / Time" value={now ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--"} sub={now ? now.toLocaleDateString() : ""} />
            <StatCard label="Commands" value={String(count)} sub="Processed this session" />
            <StatCard label="Mode" value={mode} sub={mode === "Voice" ? "Speech input" : "Keyboard input"} />
          </section>
        )}

        <main className={`grid gap-4 ${focus ? "lg:grid-cols-2" : "lg:grid-cols-[1fr_1.1fr_0.8fr]"}`}>
          {/* Core */}
          <section className="hud-panel flex flex-col items-center justify-center gap-5 p-5">
            <div className="core relative aspect-square w-64 sm:w-72" data-state={coreState}>
              <div className="ring dashed" />
              <div className="ring arc" style={{ inset: "8%" }} />
              <div className="ring" style={{ inset: "16%" }} />
              <span className="wave" /><span className="wave" style={{ animationDelay: "0.6s" }} /><span className="wave" style={{ animationDelay: "1.2s" }} />
              {Array.from({ length: 48 }).map((_, i) => (
                <span key={i} className="bar" style={{ transform: `translate(-50%,-100%) rotate(${i * 7.5}deg) translateY(-112px)`, animationDelay: `${(i % 8) * 0.08}s` }} />
              ))}
              <button
                onClick={toggleMic}
                disabled={!online}
                aria-label={micActive ? "Stop listening" : "Start listening"}
                className="mic-btn absolute inset-[30%] flex items-center justify-center rounded-full"
              >
                {micActive ? <Mic className="h-12 w-12" /> : online ? <Mic className="h-10 w-10" /> : <MicOff className="h-10 w-10" />}
              </button>
            </div>
            <p className={`font-display text-center text-sm tracking-[0.2em] ${state === "listening" ? "text-success" : "text-cyan"} ${busy ? "blink" : ""}`}>
              {online ? STATE_LABEL[state] : "JARVIS IS STOPPED"}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button onClick={stopAll} disabled={!busy} className="flex items-center gap-2 rounded-md border border-danger bg-danger/15 px-5 py-2 font-display text-sm tracking-widest text-danger transition hover:bg-danger/30 disabled:opacity-40">
                <Square className="h-4 w-4" /> STOP
              </button>
              <div className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${micActive ? "border-success text-success" : "text-muted-foreground"}`}>
                <ShieldCheck className="h-4 w-4" /> MIC {micActive ? "ACTIVE" : "OFF"} · no background recording
              </div>
            </div>
            {!focus && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground"><Keyboard className="h-3.5 w-3.5" /> Space: talk · Esc: stop</p>
            )}
          </section>

          {/* Chat */}
          <section className="hud-panel flex h-[520px] flex-col">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="font-display text-sm tracking-[0.2em] text-cyan">CONVERSATION</h2>
              <button onClick={() => setMessages([])} className="hud-btn flex items-center gap-1 px-2 py-1 text-xs"><Trash2 className="h-3.5 w-3.5" /> Clear</button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.length === 0 && <p className="text-center text-sm text-muted-foreground">No messages yet. Try “What is the time?”</p>}
              {messages.map((m) => <Bubble key={m.id} m={m} onRetry={startListening} />)}
              <div ref={chatEnd} />
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleCommand(input, "text"); setInput(""); }} className="flex gap-2 border-t p-3">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={!online}
                placeholder={online ? "Type a command…" : "JARVIS is stopped"}
                aria-label="Command input"
                className="flex-1 rounded-md border bg-background/60 px-3 py-2 text-base outline-none focus:border-cyan focus:ring-1 focus:ring-ring"
              />
              <button type="submit" disabled={!online || !input.trim()} className="hud-btn flex items-center gap-1 px-4" aria-label="Send"><Send className="h-4 w-4" /></button>
            </form>
          </section>

          {/* Sidebar */}
          {!focus && (
            <aside className="flex flex-col gap-4 lg:h-[520px]">
              <div className="hud-panel p-4">
                <h2 className="mb-3 font-display text-sm tracking-[0.2em] text-cyan">QUICK ACTIONS</h2>
                <div className="grid grid-cols-2 gap-2">
                  {quick.map((q) => (
                    <button key={q.label} disabled={!online} onClick={() => handleCommand(q.cmd, "text")} className="hud-btn flex items-center gap-2 px-3 py-2 text-sm last:col-span-2">
                      <q.icon className="h-4 w-4 text-cyan" /> {q.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="hud-panel flex min-h-48 flex-1 flex-col p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-display text-sm tracking-[0.2em] text-cyan">COMMAND HISTORY</h2>
                  {history.length > 0 && (
                    <button onClick={() => { setHistory([]); localStorage.removeItem(HISTORY_KEY); }} className="text-xs text-muted-foreground hover:text-cyan">Reset</button>
                  )}
                </div>
                <ul className="flex-1 space-y-2 overflow-y-auto text-sm">
                  {history.length === 0 && <li className="text-muted-foreground">No commands yet.</li>}
                  {history.map((h, i) => (
                    <li key={i}>
                      <button onClick={() => handleCommand(h.text, "text")} disabled={!online} className="flex w-full justify-between gap-2 rounded border-l-2 border-primary bg-accent/30 px-2 py-1 text-left hover:bg-accent/60">
                        <span className="truncate">{h.text}</span><span className="shrink-0 text-xs text-muted-foreground">{h.time}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          )}
        </main>

        {!focus && (
          <footer className="flex items-center justify-center gap-2 pb-2 text-center text-xs text-muted-foreground">
            <Cpu className="h-3.5 w-3.5" /> Working: voice input, speech output, opening sites, time/date. Simulated: AI answers come from a local sample-command engine.
          </footer>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 hud-panel px-4 py-2 text-sm text-success animate-in fade-in slide-in-from-bottom-4">
          {toast.link ? <a href={toast.link} target="_blank" rel="noopener noreferrer" className="underline">{toast.text}</a> : toast.text}
        </div>
      )}
    </div>
  );
}

function Bubble({ m, onRetry }: { m: ChatMessage; onRetry: () => void }) {
  if (m.role === "system")
    return <div className="text-center text-xs text-muted-foreground">[{m.time}] {m.text}</div>;
  const mine = m.role === "user" || m.role === "voice";
  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"} animate-in fade-in slide-in-from-bottom-2`}>
      <div className={`max-w-[85%] rounded-lg border px-3 py-2 ${mine ? "border-primary/60 bg-primary/15" : "border-cyan/50 bg-accent/40"}`}>
        <div className="mb-0.5 font-display text-[10px] tracking-widest text-muted-foreground">
          {m.role === "voice" ? "🎙 VOICE COMMAND" : m.role === "user" ? "YOU" : "JARVIS"} · {m.time}
        </div>
        <p className="text-base leading-snug">{m.text}</p>
        {m.retry && (
          <button onClick={onRetry} className="mt-1 flex items-center gap-1 text-xs text-cyan hover:underline"><RotateCcw className="h-3 w-3" /> Retry with voice</button>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "ok" | "bad" }) {
  return (
    <div className="hud-panel px-3 py-2 last:col-span-2 md:last:col-span-1">
      <div className="font-display text-[10px] tracking-[0.2em] text-muted-foreground">{label.toUpperCase()}</div>
      <div className={`font-display text-lg ${tone === "ok" ? "text-success" : tone === "bad" ? "text-danger" : "text-cyan"}`}>{value}</div>
      {sub && <div className="truncate text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function JarvisLogo() {
  return (
    <svg viewBox="0 0 48 48" className="h-11 w-11 text-cyan drop-shadow-[0_0_8px_currentColor]" fill="none" stroke="currentColor" strokeWidth="1.6" aria-label="JARVIS logo">
      <circle cx="24" cy="24" r="21" strokeDasharray="4 3" />
      <rect x="13" y="15" width="22" height="18" rx="5" />
      <circle cx="19.5" cy="23" r="2.2" fill="currentColor" />
      <circle cx="28.5" cy="23" r="2.2" fill="currentColor" />
      <path d="M19 29h10M24 15v-4M22 11h4" />
    </svg>
  );
}
