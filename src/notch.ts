import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { createFace } from "./face";
import { ICONS } from "./icons";
import { pickLine, present, soundFor, spokenLang, staticLines, type Lang, type MacEvent, type Persona } from "./lines";
import type { Settings } from "./settings-types";
import { springEasing } from "./spring";
import "./notch.css";

interface NotchMetrics {
  hasNotch: boolean;
  notchWidth: number;
  notchHeight: number;
}

const island = document.getElementById("island")!;
const content = document.getElementById("content")!;
const title = document.getElementById("title")!;
const lineEl = document.getElementById("line")!;
const widget = document.getElementById("widget")!;

const face = createFace(1.15);
document.getElementById("faceSlot")!.append(face.el);
document.documentElement.style.setProperty("--spring", springEasing());

const MAX_QUEUE = 3;
/** Longest the island waits for a voice line to download before opening without it. */
const MAX_AUDIO_WAIT = 1500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

let settings = await invoke<Settings>("get_settings");
const maleHindiVoice = await invoke<boolean>("has_male_hindi_voice").catch(() => false);
const lang = () =>
  spokenLang(settings.personality as Persona, settings.language as Lang, settings.engine, maleHindiVoice);
const queue: MacEvent[] = [];
let busy = false;

await listen<Settings>("settings-changed", (e) => {
  const before = voiceKey(settings);
  settings = e.payload;
  if (voiceKey(settings) !== before) warmVoiceCache();
});
warmVoiceCache();
await listen<MacEvent>("mac-event", (e) => enqueue(e.payload));

enqueue({ kind: "launch" });

function enqueue(event: MacEvent) {
  if (settings.disabledEvents.includes(event.kind)) return;
  if (queue.length >= MAX_QUEUE) queue.shift();
  queue.push(event);
  if (!busy) void drain();
}

async function drain() {
  busy = true;
  while (queue.length > 0) await show(queue.shift()!);
  busy = false;
}

async function show(event: MacEvent) {
  const persona = settings.personality as Persona;
  const line = pickLine(persona, lang(), event);
  if (!line) return;
  const look = present(event, persona);

  // Start the audio first. `speak` resolves once it's playing (a fresh ElevenLabs line has to
  // download), and the island opens then, so the voice and the notch arrive together.
  const speaking =
    !inQuietHours() && (settings.voiceEnabled || settings.soundEffects)
      ? invoke("speak", {
          text: settings.voiceEnabled ? line : null,
          sound: settings.soundEffects ? soundFor(event) : null,
        }).catch(() => {})
      : Promise.resolve();
  const metricsReady = invoke<NotchMetrics>("prepare_notch");
  await Promise.race([speaking, sleep(MAX_AUDIO_WAIT)]);

  const metrics = await metricsReady;
  const notchW = metrics.hasNotch ? metrics.notchWidth : 0;
  const notchH = metrics.notchHeight;
  const width = Math.max(notchW + 230, 440);

  island.style.setProperty("--notch-w", `${notchW}px`);
  island.style.setProperty("--notch-h", `${notchH}px`);
  island.style.setProperty("--accent", look.color);
  face.set(look.mood, look.color === "#ffffff" ? "#fff" : look.color);
  title.textContent = look.title;
  lineEl.innerHTML = line
    .split(/\s+/)
    .map((w, i) => `<span class="w" style="--i:${i}">${escape(w)}</span>`)
    .join(" ");
  widget.innerHTML = widgetFor(event, look.icon);

  // Content keeps its final width while the island grows, so text never reflows mid-animation.
  content.style.width = `${width}px`;
  island.style.setProperty("--w", `${width}px`);
  island.style.setProperty("--h", `${notchH + content.offsetHeight}px`);

  const words = line.split(/\s+/).length;
  const duration = Math.min(Math.max(2400 + words * 380, 4200), 9500);

  // Let the collapsed size paint first so the expansion animates.
  await nextFrame();
  island.classList.add("expanded");
  requestAnimationFrame(() => {
    const fill = widget.querySelector<SVGCircleElement>(".fill");
    if (fill) fill.style.strokeDashoffset = String(100 - (event.level ?? 0));
  });
  if (look.then) setTimeout(() => face.set(look.then!, look.color), 1300);


  await sleep(duration);
  island.classList.remove("expanded");
  await sleep(600);
}

/** Settings that change which audio files a line needs. */
function voiceKey(s: Settings): string {
  return [s.engine, s.elevenVoice, JSON.stringify(s.personaVoices), s.elevenModel, s.personality, s.language, s.rate].join("|");
}

/** Has ElevenLabs voice this personality's fixed lines in the background, so they play instantly. */
function warmVoiceCache() {
  if (settings.engine !== "elevenlabs") return;
  void invoke("prepare_voice_cache", {
    lines: staticLines(settings.personality as Persona, lang()),
  }).catch(() => {});
}

function widgetFor(event: MacEvent, icon: keyof typeof ICONS | null): string {
  if (event.level !== undefined) {
    const inner =
      event.kind === "charger_connected" || event.kind === "battery_full" ? ICONS.bolt : `${event.level}`;
    return `
      <div class="ring">
        <svg viewBox="0 0 40 40">
          <circle class="track" cx="20" cy="20" r="16" pathLength="100"/>
          <circle class="fill" cx="20" cy="20" r="16" pathLength="100"/>
        </svg>
        <span class="label">${inner}</span>
      </div>`;
  }
  if (icon) return `<div class="icon-bubble">${ICONS[icon]}</div>`;
  return "";
}

function inQuietHours(): boolean {
  if (!settings.quietEnabled) return false;
  const hour = new Date().getHours();
  const { quietStart: start, quietEnd: end } = settings;
  return start <= end ? hour >= start && hour < end : hour >= start || hour < end;
}

function escape(s: string): string {
  const el = document.createElement("span");
  el.textContent = s;
  return el.innerHTML;
}
