// Local sample-command engine (SIMULATED AI). Swap `processCommand` for a call to a
// Python backend later (e.g. POST /api/command { text }) returning the same shape.
export type CommandAction =
  | { type: "open"; url: string; label: string }
  | { type: "clear" }
  | { type: "stop" }
  | { type: "repeat" }
  | { type: "status" };

export interface CommandResult {
  reply: string;
  understood: boolean;
  action?: CommandAction;
}

const KNOWLEDGE: Record<string, string> = {
  "artificial intelligence":
    "Artificial intelligence is the field of building computer systems that perform tasks normally requiring human intelligence, such as understanding language, recognising images, and making decisions.",
  "machine learning":
    "Machine learning is a branch of AI where systems learn patterns from data instead of being explicitly programmed. Common types are supervised, unsupervised and reinforcement learning.",
  python:
    "Python is a beginner-friendly, high-level programming language used for web development, automation, data science and AI. Try starting with variables, loops, functions, and libraries like NumPy.",
};

export function processCommand(raw: string, now: Date = new Date()): CommandResult {
  const t = raw.toLowerCase().trim().replace(/[?.!,]/g, "");
  if (!t) return notUnderstood();

  if (/\b(stop listening|stop|be quiet|cancel)\b/.test(t))
    return { reply: "Standing by.", understood: true, action: { type: "stop" } };
  if (/\b(repeat|say that again)\b/.test(t))
    return { reply: "", understood: true, action: { type: "repeat" } };
  if (/\bclear (the )?chat\b/.test(t))
    return { reply: "Chat cleared.", understood: true, action: { type: "clear" } };
  if (/\b(system status|status report|status)\b/.test(t))
    return {
      reply: "All systems online. Voice and text interfaces operational. Running local command engine.",
      understood: true,
      action: { type: "status" },
    };

  if (/\btime\b/.test(t))
    return {
      reply: `The time is ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`,
      understood: true,
    };
  if (/\b(date|today|day is it)\b/.test(t))
    return {
      reply: `Today is ${now.toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`,
      understood: true,
    };

  const sites: [RegExp, string, string][] = [
    [/\byoutube\b/, "https://www.youtube.com", "YouTube"],
    [/\bgmail\b/, "https://mail.google.com", "Gmail"],
    [/\bgoogle\b/, "https://www.google.com", "Google"],
  ];
  if (/\bopen\b/.test(t)) {
    for (const [re, url, label] of sites)
      if (re.test(t)) return { reply: `Opening ${label}.`, understood: true, action: { type: "open", url, label } };
  }

  const search = t.match(/\b(?:search for|search|google)\s+(.+)/);
  if (search) {
    const q = search[1].trim();
    return {
      reply: `Searching Google for ${q}.`,
      understood: true,
      action: { type: "open", url: `https://www.google.com/search?q=${encodeURIComponent(q)}`, label: "Google Search" },
    };
  }

  if (/\b(explain|tell me about|what is|help)\b/.test(t)) {
    for (const key of Object.keys(KNOWLEDGE)) if (t.includes(key)) return { reply: KNOWLEDGE[key], understood: true };
  }
  if (/\b(hello|hi|hey)\b/.test(t))
    return { reply: "Hello. JARVIS at your service. How can I help?", understood: true };

  return notUnderstood();
}

function notUnderstood(): CommandResult {
  return { reply: "I'm not sure I understood that command. Could you please repeat it?", understood: false };
}
