"use strict";
// AI Travel Language Assistant - front end.
// Model output is always inserted with textContent, never interpreted as HTML.

const $ = (id) => document.getElementById(id);
const DEFAULTS = { country: "", region: "", local: [], language: "Spanish", politeness: "polite", approximate: false };
const SUGGESTIONS = [
  "Help me order food",
  "How do I ask for the bill?",
  "I need a pharmacy for a headache",
  "How do I bargain politely?",
  "I'm lost, how do I ask the way?",
  "How do I say I'm allergic to nuts?",
];
const TOPIC_ICONS = {
  restaurant: "utensils", transport: "car-taxi-front", hotel: "bed-double", directions: "signpost",
  shopping: "shopping-bag", health: "pill", emergency: "siren", money: "banknote",
  social: "messages-square", sightseeing: "landmark", airport: "plane", phone: "smartphone",
};
// Lucide icons (ISC licence): inner SVG markup, constant strings only.
const ICONS = {
  "message-circle": '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
  "book-open": '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  bookmark: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
  "map-pin": '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  "volume-2": '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/>',
  snail: '<path d="M2 13a6 6 0 1 0 12 0 4 4 0 1 0-8 0 2 2 0 0 0 4 0"/><circle cx="10" cy="13" r="8"/><path d="M2 21h12c4.4 0 8-3.6 8-8V7a2 2 0 1 0-4 0v6"/><path d="M18 3 19.1 5.2"/><path d="M22 3 20.9 5.2"/>',
  "maximize-2": '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" x2="14" y1="3" y2="10"/><line x1="3" x2="10" y1="21" y2="14"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  "car-taxi-front": '<path d="M10 2h4"/><path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8"/><path d="M7 14h.01"/><path d="M17 14h.01"/><rect width="18" height="8" x="3" y="10" rx="2"/><path d="M5 18v2"/><path d="M19 18v2"/>',
  "bed-double": '<path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M12 4v6"/><path d="M2 18h20"/>',
  signpost: '<path d="M12 13v8"/><path d="M12 3v3"/><path d="M18 6a2 2 0 0 1 1.387.56l2.307 2.22a1 1 0 0 1 0 1.44l-2.307 2.22A2 2 0 0 1 18 13H6a2 2 0 0 1-1.387-.56l-2.306-2.22a1 1 0 0 1 0-1.44l2.306-2.22A2 2 0 0 1 6 6z"/>',
  "shopping-bag": '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  pill: '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>',
  siren: '<path d="M7 18v-6a5 5 0 1 1 10 0v6"/><path d="M5 21a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2z"/><path d="M21 12h1"/><path d="M18.5 4.5 18 5"/><path d="M2 12h1"/><path d="M12 2v1"/><path d="m4.929 4.929.707.707"/><path d="M12 12v6"/>',
  banknote: '<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
  "messages-square": '<path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/>',
  landmark: '<line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/>',
  plane: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  smartphone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
  "send-horizontal": '<path d="M3.714 3.048a.498.498 0 0 0-.683.627l2.843 7.627a2 2 0 0 1 0 1.396l-2.842 7.627a.498.498 0 0 0 .682.627l18-8.5a.5.5 0 0 0 0-.904z"/><path d="M6 12h16"/>',
  mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>',
  "rotate-ccw": '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  "locate-fixed": '<line x1="2" x2="5" y1="12" y2="12"/><line x1="19" x2="22" y1="12" y2="12"/><line x1="12" x2="12" y1="2" y2="5"/><line x1="12" x2="12" y1="19" y2="22"/><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/>',
  languages: '<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>',
  "settings-2": '<path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>',
};

const state = {
  config: null,
  settings: { ...DEFAULTS, ...load("settings", {}) },
  saved: load("saved", []),
  history: [], // recent chat turns sent back to the model
  essentials: {}, // settings key -> answer
  voices: [],
  busy: false,
};

init();

async function init() {
  document.querySelectorAll("[data-icon]").forEach((node) => node.prepend(icon(node.dataset.icon)));
  try {
    state.config = await api("/api/config");
  } catch (error) {
    toast(error.message);
    return;
  }
  $("model").textContent = state.config.demo ? "Demo mode: recorded answers" : `Model: ${state.config.model}`;
  const countries = Object.entries(state.config.countries).sort((a, b) => a[1].name.localeCompare(b[1].name));
  $("country").append(...countries.map(([code, country]) => option(code, country.name)));
  applySettings();

  $("country").addEventListener("change", () => setPlace({ country: $("country").value }));
  $("language").addEventListener("change", () => update({ language: $("language").value }));
  $("politeness").addEventListener("change", () => update({ politeness: $("politeness").value }));
  $("locate").addEventListener("click", locate);
  $("settings-open").addEventListener("click", () => toggleSettings(!$("settings").classList.contains("open")));
  $("settings-done").addEventListener("click", () => toggleSettings(false));
  $("show-close").addEventListener("click", () => $("show").close());
  document.querySelectorAll('[role="tab"]').forEach((tab) =>
    tab.addEventListener("click", () => showTab(tab.getAttribute("aria-controls"))));
  setupChat();
  setupPhrasebook();
  setupSpeech();
  renderSavedCount();
  if (!state.settings.country) locateApproximately(true); // first visit: guess the country quietly
}

/* ---------- Where am I, which language ---------- */

function applySettings() {
  const s = state.settings;
  if (!state.config.languages[s.language]) s.language = s.local[0] || DEFAULTS.language;
  $("country").value = s.country;
  $("politeness").value = s.politeness;
  const others = Object.keys(state.config.languages).filter((name) => !s.local.includes(name));
  $("language").replaceChildren(
    ...(s.local.length ? [optionGroup("Spoken here", s.local)] : []),
    optionGroup(s.local.length ? "Other languages" : "All languages", others),
  );
  $("language").value = s.language;

  const place = placeName();
  $("place-name").textContent = place || "Where are you travelling?";
  $("place-detail").textContent = place
    ? `Phrases in ${s.language}, ${s.politeness} tone.${s.approximate ? " Approximate location from your internet connection." : ""}`
    : `Phrases in ${s.language}, ${s.politeness} tone. Locate yourself to switch to the local language.`;
}

function placeName() {
  const country = state.config.countries[state.settings.country];
  return country ? [state.settings.region, country.name].filter(Boolean).join(", ") : "";
}

function setPlace({ country, region = "", languages, approximate = false }) {
  const local = languages || state.config.countries[country]?.languages || [];
  update({ country, region, local, approximate, language: local[0] || state.settings.language });
}

function update(changes) {
  Object.assign(state.settings, changes);
  store("settings", state.settings);
  applySettings();
  const place = placeName();
  note(`Answers now in ${state.settings.language}${place ? ` for ${place}` : ""}, ${state.settings.politeness} tone.`);
  if (!$("essentials").hidden) loadEssentials();
}

function locate() {
  const button = $("locate");
  const label = button.querySelector("span");
  const done = () => { button.disabled = false; label.textContent = "Locate me"; };
  button.disabled = true;
  label.textContent = "Locating…";
  if (!navigator.geolocation) return locateApproximately(false).finally(done);
  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      try {
        const place = await api("/api/locate", { lat: coords.latitude, lon: coords.longitude });
        setPlace(place);
        toast(`You are in ${place.place}.`);
      } catch {
        await locateApproximately(false);
      }
      done();
    },
    () => locateApproximately(false).finally(done), // GPS blocked or unavailable: use the internet connection
    { timeout: 8000, maximumAge: 600000 },
  );
}

async function locateApproximately(quiet) {
  try {
    const place = await api("/api/locate", {});
    setPlace(place);
    if (!quiet) toast(`Approximate location from your internet connection: ${place.place}.`);
  } catch (error) {
    if (!quiet) toast(error.message);
  }
}

function toggleSettings(open) {
  $("settings").classList.toggle("open", open);
  $("settings-open").setAttribute("aria-expanded", String(open));
}

function settingsBody() {
  const { language, politeness, country, region } = state.settings;
  return { language, politeness, country, region };
}

/* ---------- Tabs ---------- */

function showTab(name) {
  document.querySelectorAll('[role="tab"]').forEach((tab) =>
    tab.setAttribute("aria-selected", String(tab.getAttribute("aria-controls") === name)));
  document.querySelectorAll('[role="tabpanel"]').forEach((panel) => { panel.hidden = panel.id !== name; });
  toggleSettings(false);
  window.scrollTo({ top: 0 });
  if (name === "essentials") loadEssentials();
  if (name === "saved") renderSaved();
}

/* ---------- Chat ---------- */

function setupChat() {
  $("suggestions").append(...SUGGESTIONS.map((text) => button(text, "chip", () => send(text))));
  $("composer").addEventListener("submit", (event) => { event.preventDefault(); send(); });
  $("message").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); }
  });
  $("message").addEventListener("input", grow);
  $("clear").addEventListener("click", () => { state.history = []; $("log").replaceChildren(); greet(); });
  greet();
}

function greet() {
  const bubble = bubbleFor("assistant");
  bubble.append(el("p", "Hi! Tell me what is happening and what you need to say, for example “I'm at a pharmacy and " +
    "need something for a headache”. I'll give you the phrases in the local language, with a pronunciation " +
    "guide and audio.", "reply"));
}

async function send(text = $("message").value.trim()) {
  if (!text || state.busy) return;
  state.busy = true;
  $("message").value = "";
  grow();
  bubbleFor("user").textContent = text;
  const bubble = bubbleFor("assistant pending");
  bubble.append(el("span", "", "dot"), el("span", "", "dot"), el("span", "", "dot"));
  bubble.setAttribute("aria-label", "Finding the right words");
  try {
    const answer = await api("/api/chat", { ...settingsBody(), message: text, history: state.history });
    bubble.className = "msg assistant";
    bubble.removeAttribute("aria-label");
    bubble.replaceChildren(...answerNodes(answer));
    state.history = [...state.history, { role: "user", content: text }, { role: "assistant", content: summary(answer) }].slice(-8);
  } catch (error) {
    bubble.className = "msg assistant error";
    bubble.textContent = error.message;
  } finally {
    state.busy = false;
    bubble.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function bubbleFor(kind) {
  const node = el("div", "", `msg ${kind}`);
  $("log").append(node);
  return node;
}

function note(text) {
  $("log").append(el("p", text, "note-line"));
}

function summary(answer) { // what the model needs to remember of its own answer
  return JSON.stringify({ reply: answer.reply, phrases: answer.phrases.map(({ english, translation }) => ({ english, translation })) });
}

function grow() {
  const box = $("message");
  box.style.height = "auto";
  if (box.value) box.style.height = `${Math.min(box.scrollHeight, 160)}px`;
}

/* ---------- Essentials and phrasebook ---------- */

async function loadEssentials() {
  const key = JSON.stringify(settingsBody());
  $("essentials-title").textContent = `Essentials in ${state.settings.language}`;
  if (state.essentials[key]) return renderEssentials(state.essentials[key]);
  $("essentials-list").replaceChildren(el("p", "Writing your essentials… about 10 seconds the first time.", "loading"));
  try {
    state.essentials[key] = await api("/api/essentials", settingsBody());
    if (key === JSON.stringify(settingsBody())) renderEssentials(state.essentials[key]);
  } catch (error) {
    $("essentials-list").replaceChildren(el("p", error.message, "error"));
  }
}

function renderEssentials(answer) {
  let start = 0;
  $("essentials-list").replaceChildren(...state.config.essentials.map(({ title, phrases }) => {
    const group = el("section", "", "group");
    group.append(el("h3", title), cards(answer.phrases.slice(start, start += phrases.length), info(answer), true));
    return group;
  }));
}

function setupPhrasebook() {
  $("topics").append(...state.config.topics.map((topic) => {
    const tile = button("", "topic", () => loadBook({ topic: topic.id }, topic.label));
    const picto = el("span", "", "picto");
    picto.append(icon(TOPIC_ICONS[topic.id] || "book-open"));
    tile.append(picto, el("span", topic.label));
    return tile;
  }));
  $("situation-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const situation = $("situation").value.trim();
    if (situation) loadBook({ situation }, situation);
  });
}

async function loadBook(request, label) {
  const book = $("book");
  book.replaceChildren(el("p", `Writing phrases for “${label}”…`, "loading"));
  book.scrollIntoView({ behavior: "smooth", block: "start" });
  try {
    const answer = await api("/api/phrases", { ...settingsBody(), ...request });
    const nodes = [el("h3", `${label} in ${answer.language}`, "book-title")];
    if (answer.demo) nodes.push(el("p", `Demo mode: recorded example “${answer.title}”.`, "hint"));
    nodes.push(cards(answer.phrases, info(answer)));
    if (answer.tips.length) nodes.push(el("h4", "Good to know"), tipList(answer.tips));
    book.replaceChildren(...nodes);
  } catch (error) {
    book.replaceChildren(el("p", error.message, "error"));
  }
}

/* ---------- Phrase cards ---------- */

function answerNodes(answer) {
  const nodes = [];
  if (answer.demo) nodes.push(el("p", `Demo mode: recorded example “${answer.title}”.`, "hint"));
  if (answer.reply) nodes.push(el("p", answer.reply, "reply"));
  if (answer.phrases.length) nodes.push(cards(answer.phrases, info(answer)));
  if (answer.tips.length) nodes.push(tipList(answer.tips));
  return nodes;
}

function info(answer) {
  return { language: answer.language, code: answer.speech_code };
}

function cards(phrases, language, compact = false) {
  const list = el("div", "", compact ? "cards compact" : "cards");
  list.append(...phrases.map((phrase) => card(phrase, language)));
  return list;
}

function card(phrase, language) {
  const node = el("article", "", "card");
  const translation = el("p", phrase.translation, "translation");
  translation.lang = language.code;
  translation.dir = "auto";
  node.append(el("p", phrase.english, "english"), translation);
  if (phrase.romanization && phrase.romanization !== phrase.translation) node.append(el("p", phrase.romanization, "romanization"));
  const say = el("p", "", "say"); // the pronunciation guide, shown like a road sign
  say.append(icon("volume-2"), el("span", phrase.pronunciation));
  node.append(say);
  if (phrase.note) node.append(el("p", phrase.note, "note"));

  const save = iconButton("Save", "bookmark", () => {
    toggleSaved(phrase, language);
    setSaveLabel(save, phrase, language);
  });
  setSaveLabel(save, phrase, language);
  const actions = el("div", "", "actions");
  actions.append(
    button("Listen", "action listen", () => speak(phrase.translation, language, false), "volume-2"),
    iconButton("Listen slowly", "snail", () => speak(phrase.translation, language, true)),
    iconButton("Show in large print", "maximize-2", () => showBig(phrase, language)),
    iconButton("Copy", "copy", () => copy(phrase.translation)),
    save,
  );
  node.append(actions);
  return node;
}

function setSaveLabel(node, phrase, language) {
  const saved = isSaved(phrase, language);
  node.title = saved ? "Saved: tap to remove" : "Save";
  node.setAttribute("aria-label", node.title);
  node.setAttribute("aria-pressed", String(saved));
}

function tipList(tips) {
  const list = el("ul", "", "tips");
  list.append(...tips.map((tip) => el("li", tip)));
  return list;
}

function showBig(phrase, language) { // full screen, to show the phone to a driver or a shopkeeper
  $("show-text").textContent = phrase.translation;
  $("show-text").lang = language.code;
  $("show-roman").textContent = phrase.romanization;
  $("show-english").textContent = phrase.english;
  $("show").showModal();
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied.");
  } catch {
    toast("Copying is not allowed here: select the text instead.");
  }
}

/* ---------- Saved phrases (stored on this device) ---------- */

const savedKey = (phrase, language) => `${language}|${phrase.translation}`;

function isSaved(phrase, language) {
  return state.saved.some((item) => savedKey(item, item.language) === savedKey(phrase, language.language));
}

function toggleSaved(phrase, language) {
  const key = savedKey(phrase, language.language);
  const wasSaved = isSaved(phrase, language);
  state.saved = wasSaved
    ? state.saved.filter((item) => savedKey(item, item.language) !== key)
    : [...state.saved, { ...phrase, language: language.language, code: language.code }];
  store("saved", state.saved);
  renderSavedCount();
  if (!$("saved").hidden) renderSaved();
  toast(wasSaved ? "Removed from your saved phrases." : "Saved: find it in the Saved tab.");
}

function renderSavedCount() {
  $("saved-count").textContent = state.saved.length || "";
}

function renderSaved() {
  if (!state.saved.length) {
    $("saved-list").replaceChildren(el("p", "Nothing saved yet: tap Save on any phrase.", "hint"));
    return;
  }
  const groups = {};
  state.saved.forEach((item) => (groups[item.language] ||= []).push(item));
  $("saved-list").replaceChildren(...Object.entries(groups).map(([language, items]) => {
    const group = el("section", "", "group");
    group.append(el("h3", language), cards(items, { language, code: items[0].code }, true));
    return group;
  }));
}

/* ---------- Speech: listen to phrases, dictate messages ---------- */

function setupSpeech() {
  if ("speechSynthesis" in window) {
    const loadVoices = () => { state.voices = speechSynthesis.getVoices(); };
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
  }
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) return;
  $("mic").hidden = false;
  $("mic").addEventListener("click", () => {
    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.onresult = (event) => send(event.results[0][0].transcript);
    recognition.onerror = () => toast("I could not hear you. Check the microphone permission.");
    recognition.start();
    toast("Listening… speak in English.");
  });
}

function voiceFor(code) {
  const lang = (voice) => voice.lang.replace("_", "-").toLowerCase();
  const [base] = code.toLowerCase().split("-");
  const country = state.settings.country.toLowerCase();
  // Prefer the local accent (es-MX in Mexico). Chinese voices are matched exactly: Cantonese is not Mandarin.
  const wanted = [base !== "zh" && country ? `${base}-${country}` : "", code.toLowerCase()];
  return wanted.map((w) => state.voices.find((voice) => lang(voice) === w)).find(Boolean)
    || (base !== "zh" ? state.voices.find((voice) => lang(voice).split("-")[0] === base) : undefined);
}

function speak(text, language, slow) {
  if (!("speechSynthesis" in window)) return toast("This browser cannot read text aloud.");
  const voice = voiceFor(language.code);
  if (!voice) {
    return toast(`No ${language.language} voice on this device. Microsoft Edge has the most voices, ` +
      "or add the language in your system's speech settings.");
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.rate = slow ? 0.6 : 0.9;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

/* ---------- Helpers ---------- */

async function api(path, body) {
  let response;
  try {
    response = await fetch(path, body === undefined ? {} : {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Cannot reach the app. Is the server still running?");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function store(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage disabled (private mode): the app keeps working in memory
  }
}

let toastTimer;
function toast(text) {
  $("toast").textContent = text;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $("toast").hidden = true; }, 4000);
}

function icon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("icon");
  svg.innerHTML = ICONS[name] || ""; // constant markup from ICONS, never model output
  return svg;
}

function el(tag, text = "", className = "") {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

function button(text, className, onClick, iconName) {
  const node = el("button", "", className);
  node.type = "button";
  if (iconName) node.append(icon(iconName));
  if (text) node.append(el("span", text));
  node.addEventListener("click", onClick);
  return node;
}

function iconButton(label, iconName, onClick) {
  const node = button("", "action icon-only", onClick, iconName);
  node.title = label;
  node.setAttribute("aria-label", label);
  return node;
}

function option(value, text) {
  const node = el("option", text);
  node.value = value;
  return node;
}

function optionGroup(label, names) {
  const group = el("optgroup");
  group.label = label;
  group.append(...names.map((name) => option(name, name)));
  return group;
}
