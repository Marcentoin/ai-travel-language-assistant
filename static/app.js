"use strict";
// AI Travel Language Assistant - front end.
// Model output is always inserted with textContent, never interpreted as HTML.

const $ = (id) => document.getElementById(id);
const DEFAULTS = { country: "", region: "", local: [], language: "Spanish", politeness: "polite" };
const SUGGESTIONS = [
  "Help me order food",
  "How do I ask for the bill?",
  "I need a pharmacy for a headache",
  "How do I bargain politely?",
  "I'm lost, how do I ask the way?",
  "How do I say I'm allergic to nuts?",
];
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

  $("country").addEventListener("change", () => setPlace($("country").value, ""));
  $("language").addEventListener("change", () => update({ language: $("language").value }));
  $("politeness").addEventListener("change", () => update({ politeness: $("politeness").value }));
  $("locate").addEventListener("click", locate);
  $("show-close").addEventListener("click", () => $("show").close());
  document.querySelectorAll('[role="tab"]').forEach((tab) =>
    tab.addEventListener("click", () => showTab(tab.getAttribute("aria-controls"))));
  setupChat();
  setupPhrasebook();
  setupSpeech();
  renderSavedCount();
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
  $("place").hidden = !place;
  const spoken = s.local.slice(0, 6).join(", ") + (s.local.length > 6 ? ` and ${s.local.length - 6} more` : "");
  $("place").textContent = place ? `📍 ${place} · spoken here: ${spoken}` : "";
}

function placeName() {
  const country = state.config.countries[state.settings.country];
  return country ? [state.settings.region, country.name].filter(Boolean).join(", ") : "";
}

function setPlace(country, region, languages) {
  const local = languages || state.config.countries[country]?.languages || [];
  update({ country, region, local, language: local[0] || state.settings.language });
}

function update(changes) {
  Object.assign(state.settings, changes);
  store("settings", state.settings);
  applySettings();
  const place = placeName();
  note(`Answers now in ${state.settings.language}${place ? ` for ${place}` : ""} (${state.settings.politeness}).`);
  if (!$("essentials").hidden) loadEssentials();
}

function locate() {
  if (!navigator.geolocation) return toast("Location is not available in this browser. Please choose your country.");
  const button = $("locate");
  const done = () => { button.disabled = false; button.textContent = "📍 Locate me"; };
  button.disabled = true;
  button.textContent = "📍 Locating…";
  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      try {
        const place = await api("/api/locate", { lat: coords.latitude, lon: coords.longitude });
        setPlace(place.country, place.region, place.languages);
        toast(`You are in ${place.place}.`);
      } catch (error) {
        toast(error.message);
      }
      done();
    },
    () => { toast("Location is blocked or unavailable. Please choose your country in the list."); done(); },
    { timeout: 15000, maximumAge: 600000 },
  );
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
  bubble.append(el("p", "Hi! Tell me where you are and what you need to say, for example “I'm at a pharmacy and need " +
    "something for a headache”. I'll give you the phrases, how to pronounce them, and you can listen to them."));
  if (!state.settings.country) bubble.append(el("p", "Tip: tap 📍 Locate me so I answer in the local language.", "hint"));
}

async function send(text = $("message").value.trim()) {
  if (!text || state.busy) return;
  state.busy = true;
  $("message").value = "";
  grow();
  bubbleFor("user").textContent = text;
  const bubble = bubbleFor("assistant pending");
  bubble.textContent = "Finding the right words…";
  try {
    const answer = await api("/api/chat", { ...settingsBody(), message: text, history: state.history });
    bubble.className = "msg assistant";
    bubble.replaceChildren(...answerNodes(answer));
    state.history = [...state.history, { role: "user", content: text }, { role: "assistant", content: summary(answer) }].slice(-8);
  } catch (error) {
    bubble.className = "msg assistant error";
    bubble.textContent = `⚠ ${error.message}`;
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
  $("essentials-title").textContent = `Essential phrases in ${state.settings.language}`;
  if (state.essentials[key]) return renderEssentials(state.essentials[key]);
  $("essentials-list").replaceChildren(el("p", "Writing your essentials… (about 10 seconds the first time)", "loading"));
  try {
    state.essentials[key] = await api("/api/essentials", settingsBody());
    if (key === JSON.stringify(settingsBody())) renderEssentials(state.essentials[key]);
  } catch (error) {
    $("essentials-list").replaceChildren(el("p", `⚠ ${error.message}`, "error"));
  }
}

function renderEssentials(answer) {
  let start = 0;
  $("essentials-list").replaceChildren(...state.config.essentials.map(({ title, phrases }) => {
    const group = el("section", "", "group");
    group.append(el("h3", title), cards(answer.phrases.slice(start, start += phrases.length), info(answer)));
    return group;
  }));
}

function setupPhrasebook() {
  $("topics").append(...state.config.topics.map((topic) =>
    button(`${topic.icon} ${topic.label}`, "topic", () => loadBook({ topic: topic.id }, topic.label))));
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
    const nodes = [el("h2", `${label} · ${answer.language}`)];
    if (answer.demo) nodes.push(el("p", `Demo mode: recorded example “${answer.title}”.`, "hint"));
    nodes.push(cards(answer.phrases, info(answer)));
    if (answer.tips.length) nodes.push(el("h3", "Cultural tips"), tipList(answer.tips));
    book.replaceChildren(...nodes);
  } catch (error) {
    book.replaceChildren(el("p", `⚠ ${error.message}`, "error"));
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

function cards(phrases, language) {
  const list = el("div", "", "cards");
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
  node.append(el("p", `Say: ${phrase.pronunciation}`, "pronunciation"));
  if (phrase.note) node.append(el("p", phrase.note, "note"));

  const save = button(isSaved(phrase, language) ? "★ Saved" : "☆ Save", "action", () => {
    toggleSaved(phrase, language);
    save.textContent = isSaved(phrase, language) ? "★ Saved" : "☆ Save";
  });
  const actions = el("div", "", "actions");
  actions.append(
    button("🔊 Listen", "action", () => speak(phrase.translation, language, false)),
    button("🐢 Slow", "action", () => speak(phrase.translation, language, true)),
    button("📱 Show", "action", () => showBig(phrase, language)),
    button("📋 Copy", "action", () => copy(phrase.translation)),
    save,
  );
  node.append(actions);
  return node;
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
    $("saved-list").replaceChildren(el("p", "Nothing saved yet: tap ☆ Save on any phrase.", "hint"));
    return;
  }
  const groups = {};
  state.saved.forEach((item) => (groups[item.language] ||= []).push(item));
  $("saved-list").replaceChildren(...Object.entries(groups).map(([language, items]) => {
    const group = el("section", "", "group");
    group.append(el("h3", language), cards(items, { language, code: items[0].code }));
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

function el(tag, text = "", className = "") {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

function button(text, className, onClick) {
  const node = el("button", text, className);
  node.type = "button";
  node.addEventListener("click", onClick);
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
