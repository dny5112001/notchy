import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { createFace } from "./face";
import { ICONS, type IconName } from "./icons";
import { EVENTS, MALE_VOICE, PERSONAS, hasHindi, pickLine, present, spokenLang, staticLines, type Kind, type Lang, type MacEvent, type Persona } from "./lines";
import type { Settings } from "./settings-types";
import "./settings.css";

interface ElevenVoice {
  id: string;
  name: string;
  description: string;
  accent: string;
  gender: string;
  previewUrl: string | null;
}

interface CacheProgress {
  ready: number;
  total: number;
  busy: boolean;
  error: string | null;
}

interface Voice {
  name: string;
  locale: string;
  quality: number;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const CHECK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>`;

let settings = await invoke<Settings>("get_settings");
settings.personaVoices ??= {};
const maleHindiVoice = await invoke<boolean>("has_male_hindi_voice").catch(() => false);
const lang = () =>
  spokenLang(settings.personality as Persona, settings.language as Lang, settings.engine, maleHindiVoice);
const personaName = () => PERSONAS.find((p) => p.id === settings.personality)?.name ?? "";
/** The ElevenLabs voice the current personality speaks with. */
const currentVoiceId = () => settings.personaVoices[settings.personality] || settings.elevenVoice;
let saveTimer: number | undefined;

function save() {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => invoke("save_settings", { settings }), 200);
}

async function saveNow() {
  clearTimeout(saveTimer);
  await invoke("save_settings", { settings });
}

const VOICE_FIELDS: (keyof Settings)[] = ["engine", "elevenVoice", "personaVoices", "elevenModel", "personality", "language", "rate"];
let cacheTimer: number | undefined;

function update(patch: Partial<Settings>) {
  const preview = "personality" in patch || "language" in patch;
  settings = { ...settings, ...patch };
  render();
  save();
  if (preview) renderPreview(true);
  if (VOICE_FIELDS.some((f) => f in patch)) {
    clearTimeout(cacheTimer);
    cacheTimer = window.setTimeout(() => void refreshCache(), 600);
  }
}

for (const el of document.querySelectorAll<HTMLElement>("[data-icon]")) {
  el.innerHTML = ICONS[el.dataset.icon as IconName];
}

// ---------- Live preview ----------

const SAMPLES: Partial<Record<Kind, Omit<MacEvent, "kind">>> = {
  charger_connected: { level: 42 },
  charger_disconnected: { level: 87 },
  battery_full: { level: 100 },
  battery_low: { level: 18 },
  battery_critical: { level: 7 },
  bt_connected: { name: "AirPods Pro", device: "airpods" },
  bt_disconnected: { name: "Magic Mouse", device: "input" },
  drive_mounted: { name: "SanDisk" },
  drive_unmounted: { name: "SanDisk" },
};
const sample = (kind: Kind): MacEvent => ({ kind, ...SAMPLES[kind] });

const PREVIEW_KINDS: Kind[] = [
  "charger_connected",
  "bt_connected",
  "battery_low",
  "unlock",
  "thermal_hot",
  "late_night",
  "battery_critical",
  "charger_disconnected",
];
let previewIndex = 0;
const previewFace = createFace(1.15);
$("previewFace").append(previewFace.el);

function renderPreview(animate = false) {
  const event = sample(PREVIEW_KINDS[previewIndex]);
  const persona = settings.personality as Persona;
  const look = present(event, persona);
  const island = $("preview");
  island.style.setProperty("--accent-ev", look.color);
  previewFace.set(look.mood, look.color);
  if (look.then) setTimeout(() => previewFace.set(look.then!, look.color), 1300);
  $("previewTitle").textContent = look.title;
  $("previewLine").textContent = pickLine(persona, lang(), event);
  if (animate) {
    island.classList.remove("swap");
    void island.offsetWidth;
    island.classList.add("swap");
  }
}

$("shuffle").innerHTML = `${ICONS.shuffle} Another one`;
$("shuffle").onclick = () => {
  previewIndex = (previewIndex + 1) % PREVIEW_KINDS.length;
  renderPreview(true);
};
$("playOnNotch").innerHTML = `${ICONS.play} Play in notch`;
$("playOnNotch").onclick = async () => {
  await saveNow();
  await invoke("test_event", { event: sample(PREVIEW_KINDS[previewIndex]) });
};

// ---------- Personality ----------

const personas = $("personas");
for (const p of PERSONAS) {
  const card = document.createElement("button");
  card.className = "persona";
  card.dataset.value = p.id;
  card.innerHTML = `<div class="avatar"></div><b>${p.name}</b><small>${p.blurb}</small><span class="check">${CHECK}</span>`;
  const face = createFace(0.8);
  face.set(p.mood);
  card.querySelector(".avatar")!.append(face.el);
  card.onclick = () => update({ personality: p.id });
  personas.append(card);
}

// ---------- Speech ----------

for (const button of $("language").querySelectorAll<HTMLButtonElement>("button")) {
  button.onclick = () => update({ language: button.dataset.value! });
}

const voiceSelect = $<HTMLSelectElement>("voice");
const voices = await invoke<Voice[]>("list_voices");
voices.sort((a, b) => b.quality - a.quality || a.locale.localeCompare(b.locale) || a.name.localeCompare(b.name));
const hasGoodVoice = voices.some((v) => v.quality > 0 && v.locale.startsWith("en"));
voiceSelect.add(new Option("Auto — best installed", "auto"));
for (const v of voices) {
  const star = v.quality > 0 ? "★ " : "";
  voiceSelect.add(new Option(`${star}${v.name} · ${v.locale.replace("_", "-")}`, v.name));
}
voiceSelect.onchange = () => update({ voice: voiceSelect.value });
$("voiceHint").textContent = hasGoodVoice
  ? "★ voices sound the most human."
  : "Premium voices (Zoe, Ava) sound far more human.";
$("getVoices").onclick = () => invoke("open_voice_settings");

const checkbox = (id: keyof Settings) =>
  ($<HTMLInputElement>(id).onchange = (e) => update({ [id]: (e.target as HTMLInputElement).checked }));
const slider = (id: keyof Settings) =>
  ($<HTMLInputElement>(id).oninput = (e) => update({ [id]: Number((e.target as HTMLInputElement).value) }));

// ---------- ElevenLabs ----------

for (const button of $("engine").querySelectorAll<HTMLButtonElement>("button")) {
  button.onclick = () => update({ engine: button.dataset.value as Settings["engine"] });
}

let hasKey = await invoke<boolean>("elevenlabs_has_key");
let elevenVoices: ElevenVoice[] = [];
const elevenVoiceSelect = $<HTMLSelectElement>("elevenVoice");
const elevenModelSelect = $<HTMLSelectElement>("elevenModel");
const status = $("elevenStatus");

function setStatus(text: string, tone: "" | "ok" | "error" = "") {
  status.textContent = text;
  status.className = `hint ${tone}`;
}

async function loadElevenLabs() {
  if (!hasKey) {
    setStatus("Get a key at elevenlabs.io → Developers → API Keys.");
    return;
  }
  try {
    const [voices, models] = await Promise.all([
      invoke<ElevenVoice[]>("elevenlabs_voices"),
      invoke<{ id: string; name: string }[]>("elevenlabs_models"),
    ]);
    elevenVoices = voices;
    elevenVoiceSelect.replaceChildren();
    for (const v of voices) {
      const traits = [v.accent, v.gender].filter(Boolean).join(", ");
      elevenVoiceSelect.add(new Option(traits ? `${v.name} · ${traits}` : v.name, v.id));
    }
    elevenModelSelect.replaceChildren();
    for (const m of models) elevenModelSelect.add(new Option(m.name, m.id));

    const patch: Partial<Settings> = {};
    const isIndian = (v: ElevenVoice) => /india|hindi/i.test(`${v.accent} ${v.description}`);
    if (!voices.some((v) => v.id === settings.elevenVoice) && voices.length > 0) {
      const indian = voices.find(isIndian);
      const pick = (settings.language !== "english" && indian) || voices[0];
      Object.assign(patch, { elevenVoice: pick.id, elevenVoiceName: pick.name });
    }
    // Male personalities get a man's voice unless one is already chosen for them.
    const personaVoices = { ...settings.personaVoices };
    for (const persona of MALE_VOICE) {
      if (voices.some((v) => v.id === personaVoices[persona])) continue;
      const men = voices.filter((v) => /^male$/i.test(v.gender));
      const pick = men.find(isIndian) ?? men[0];
      if (pick) personaVoices[persona] = pick.id;
    }
    if (JSON.stringify(personaVoices) !== JSON.stringify(settings.personaVoices)) {
      patch.personaVoices = personaVoices;
    }
    if (!models.some((m) => m.id === settings.elevenModel) && models.length > 0) {
      patch.elevenModel = (models.find((m) => m.id === "eleven_v4") ?? models[0]).id;
    }
    if (Object.keys(patch).length > 0) update(patch);
    else render();
    await refreshCache();
  } catch (error) {
    setStatus(String(error), "error");
  }
}

async function refreshCache() {
  if (!hasKey || settings.engine !== "elevenlabs") return;
  await saveNow();
  const progress = await invoke<CacheProgress | null>("prepare_voice_cache", {
    lines: staticLines(settings.personality as Persona, lang()),
  });
  if (progress) showCache(progress);
}

function showCache(p: CacheProgress) {
  if (p.error) setStatus(p.error, "error");
  else if (p.ready >= p.total) setStatus(`All ${p.total} lines ready — they'll play instantly.`, "ok");
  else setStatus(`Preparing voice… ${p.ready} of ${p.total} lines`);
}
await listen<CacheProgress>("voice-cache", (e) => showCache(e.payload));
await listen<string>("voice-error", (e) => setStatus(`${e.payload} Used the Mac voice instead.`, "error"));

$("saveKey").onclick = async () => {
  const key = $<HTMLInputElement>("elevenKey").value.trim();
  if (!key) return;
  setStatus("Checking key…");
  try {
    await invoke("set_elevenlabs_key", { key });
    hasKey = true;
    $<HTMLInputElement>("elevenKey").value = "";
    render();
    await loadElevenLabs();
  } catch (error) {
    setStatus(String(error), "error");
  }
};
$("elevenKey").onkeydown = (e) => {
  if (e.key === "Enter") $("saveKey").click();
};
$("removeKey").onclick = async () => {
  await invoke("set_elevenlabs_key", { key: null });
  hasKey = false;
  render();
  setStatus("Key removed. Notchy will use the Mac voice.");
};

elevenVoiceSelect.onchange = () => {
  update({ personaVoices: { ...settings.personaVoices, [settings.personality]: elevenVoiceSelect.value } });
};
elevenModelSelect.onchange = () => update({ elevenModel: elevenModelSelect.value });

let sampleAudio: HTMLAudioElement | null = null;
$("elevenPreview").innerHTML = ICONS.play;
$("elevenPreview").onclick = () => {
  const url = elevenVoices.find((v) => v.id === currentVoiceId())?.previewUrl;
  if (!url) return;
  sampleAudio?.pause();
  sampleAudio = new Audio(url);
  sampleAudio.volume = settings.volume;
  void sampleAudio.play();
};

checkbox("voiceEnabled");
checkbox("soundEffects");
checkbox("quietEnabled");
slider("rate");
slider("volume");
slider("lowBattery");
slider("criticalBattery");

$("previewVoice").innerHTML = `${ICONS.play} Preview`;
$("previewVoice").onclick = async () => {
  await saveNow();
  const text = {
    hindi: "नमस्ते! मैं तुम्हारा मैक हूँ. चार्जर लगाओ, दोस्ती पक्की.",
    hinglish: "Namaste! Main tumhara Mac hoon. Charger lagao, dosti pakki.",
    english: "Hello! I'm your Mac. Plug me in and we'll be best friends.",
  }[lang()];
  await invoke("speak", { text, sound: settings.soundEffects ? "Tink" : null });
};

// ---------- Reactions ----------

const eventsGroup = $("events");
for (const e of EVENTS) {
  const row = document.createElement("label");
  row.className = "row";
  const dark = e.color === "#ffd60a";
  row.innerHTML = `
    <span class="label"><i class="ico" style="--c:${e.color}${dark ? ";--fg:#000" : ""}">${ICONS[e.icon]}</i>${e.label}</span>
    <span class="inline">
      <button class="play" title="Try it">${ICONS.play}</button>
      <input type="checkbox" class="switch" data-kind="${e.kind}" />
    </span>`;
  row.querySelector<HTMLButtonElement>(".play")!.onclick = async (ev) => {
    ev.preventDefault();
    await saveNow();
    await invoke("test_event", { event: sample(e.kind) });
  };
  row.querySelector<HTMLInputElement>("input")!.onchange = (ev) => {
    const on = (ev.target as HTMLInputElement).checked;
    const disabled = settings.disabledEvents.filter((k) => k !== e.kind);
    update({ disabledEvents: on ? disabled : [...disabled, e.kind] });
  };
  eventsGroup.append(row);
}

// ---------- Quiet hours ----------

const hourLabel = (h: number) => new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: "numeric" });
for (const id of ["quietStart", "quietEnd"] as const) {
  const select = $<HTMLSelectElement>(id);
  for (let h = 0; h < 24; h++) select.add(new Option(hourLabel(h), String(h)));
  select.onchange = () => update({ [id]: Number(select.value) });
}

// ---------- Render ----------

function render() {
  const persona = settings.personality as Persona;
  const note =
    settings.language !== "hindi"
      ? ""
      : !hasHindi(persona)
        ? "Hindi lines are written for Tapori so far. This personality speaks Hinglish."
        : lang() !== "hindi"
          ? "The Mac's only Hindi voice is a woman's, so Tapori speaks Hinglish as Rishi. Use ElevenLabs for Hindi."
          : "";
  $("hindiNote").hidden = !note;
  $("hindiNoteText").textContent = note;
  document.body.classList.toggle("engine-apple", settings.engine !== "elevenlabs");
  document.body.classList.toggle("engine-elevenlabs", settings.engine === "elevenlabs");
  document.body.classList.toggle("has-key", hasKey);
  $("keyEntry").hidden = hasKey;
  $("keySaved").hidden = !hasKey;
  for (const b of $("engine").querySelectorAll<HTMLElement>("button")) {
    b.classList.toggle("selected", b.dataset.value === (settings.engine ?? "apple"));
  }
  if (elevenVoiceSelect.options.length) elevenVoiceSelect.value = currentVoiceId();
  $("elevenVoiceLabel").textContent = `Voice for ${personaName()}`;
  if (elevenModelSelect.options.length) elevenModelSelect.value = settings.elevenModel;
  for (const card of personas.querySelectorAll<HTMLElement>(".persona")) {
    card.classList.toggle("selected", card.dataset.value === settings.personality);
  }
  for (const b of $("language").querySelectorAll<HTMLElement>("button")) {
    b.classList.toggle("selected", b.dataset.value === settings.language);
  }
  $<HTMLInputElement>("voiceEnabled").checked = settings.voiceEnabled;
  $<HTMLInputElement>("soundEffects").checked = settings.soundEffects;
  voiceSelect.value = settings.voice;
  $<HTMLInputElement>("rate").value = String(settings.rate);
  $<HTMLInputElement>("volume").value = String(settings.volume);
  for (const input of eventsGroup.querySelectorAll<HTMLInputElement>("input[data-kind]")) {
    input.checked = !settings.disabledEvents.includes(input.dataset.kind!);
  }
  $<HTMLInputElement>("lowBattery").value = String(settings.lowBattery);
  $<HTMLInputElement>("criticalBattery").value = String(settings.criticalBattery);
  $("lowBatteryValue").textContent = `${settings.lowBattery}%`;
  $("criticalBatteryValue").textContent = `${settings.criticalBattery}%`;
  $<HTMLInputElement>("quietEnabled").checked = settings.quietEnabled;
  $<HTMLSelectElement>("quietStart").value = String(settings.quietStart);
  $<HTMLSelectElement>("quietEnd").value = String(settings.quietEnd);
  for (const id of ["voice", "rate", "volume"]) $<HTMLInputElement>(id).disabled = !settings.voiceEnabled;
  for (const id of ["quietStart", "quietEnd"]) $<HTMLSelectElement>(id).disabled = !settings.quietEnabled;
}

render();
renderPreview();
void loadElevenLabs();
