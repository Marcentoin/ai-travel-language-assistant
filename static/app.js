const form = document.getElementById("form");
const statusLine = document.getElementById("status");
const results = document.getElementById("results");

document.querySelectorAll(".chip").forEach((chip) =>
  chip.addEventListener("click", () => { form.situation.value = chip.textContent; })
);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  results.hidden = true;
  statusLine.textContent = "Writing your phrasebook…";
  try {
    const response = await fetch("/api/phrases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed.");
    render(data);
    statusLine.textContent = "";
  } catch (error) {
    statusLine.textContent = "⚠ " + error.message;
  } finally {
    button.disabled = false;
  }
});

function render(book) {
  document.getElementById("title").textContent = `${book.language}: ${book.situation}`;
  document.getElementById("phrases").replaceChildren(...book.phrases.map((p) => card(p, book.speech_code)));
  document.getElementById("tips").replaceChildren(...book.tips.map((tip) => el("li", tip)));
  results.hidden = false;
}

function card(phrase, lang) {
  const item = el("li", "", "card");
  item.append(el("p", phrase.english, "english"), el("p", phrase.translation, "translation"));
  if (phrase.romanization && phrase.romanization !== phrase.translation) {
    item.append(el("p", phrase.romanization, "romanization"));
  }
  item.append(el("p", "Say: " + phrase.pronunciation, "pronunciation"));
  if (phrase.note) item.append(el("p", phrase.note, "note"));
  const listen = el("button", "🔊 Listen", "listen");
  listen.type = "button";
  listen.addEventListener("click", () => speak(phrase.translation, lang));
  item.append(listen);
  return item;
}

function speak(text, lang) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.8; // slower, easier to repeat
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

function el(tag, text = "", className = "") {
  const node = document.createElement(tag);
  node.textContent = text; // textContent: model output is never interpreted as HTML
  if (className) node.className = className;
  return node;
}
