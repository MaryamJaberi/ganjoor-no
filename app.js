const root = document.querySelector("#content");
const bar = document.querySelector("#bar");
const foot = document.querySelector("#foot");
const mobile = document.querySelector("#mobile");
const menuBtn = document.querySelector("#menu");
const form = document.querySelector("#search-form");

const store = {
  load() {
    try {
      return JSON.parse(localStorage.getItem("ganjoor-no") || "{}");
    } catch {
      return {};
    }
  },
  save(next) {
    localStorage.setItem("ganjoor-no", JSON.stringify(next));
  },
  get() {
    return { marks: [], notes: {}, history: [], ...this.load() };
  },
  toggleMark(id) {
    const data = this.get();
    data.marks = data.marks.includes(id) ? data.marks.filter((m) => m !== id) : [id, ...data.marks];
    this.save(data);
  },
  note(id, text) {
    const data = this.get();
    data.notes[id] = text;
    this.save(data);
  },
  visit(id) {
    const data = this.get();
    data.history = [id, ...data.history.filter((h) => h !== id)].slice(0, 24);
    this.save(data);
  },
};

let DATA = { poets: [], bridges: [], events: [] };
let playTimer = 0;

function allPoems() {
  const list = [];
  for (const poet of DATA.poets) {
    for (const book of poet.books) {
      for (const poem of book.poems) list.push({ poet, book, poem });
    }
  }
  return list;
}
function poetBy(id) {
  return DATA.poets.find((p) => p.id === id);
}
function findPoem(id) {
  return allPoems().find((item) => item.poem.id === id);
}
function locate(poetId, bookId, poemId) {
  const poet = poetBy(poetId);
  const book = poet?.books.find((b) => b.id === bookId);
  const poem = book?.poems.find((p) => p.id === poemId);
  if (!poet || !book || !poem) return null;
  return { poet, book, poem };
}
function esc(value) {
  return String(value)
    .replaceAll("&", "&")
    .replaceAll("<", "<")
    .replaceAll(">", ">")
    .replaceAll('"', """);
}
function poemHref(item) {
  return `#/poem/${item.poet.id}/${item.book.id}/${item.poem.id}`;
}

menuBtn.addEventListener("click", () => {
  const open = mobile.hasAttribute("hidden");
  mobile.toggleAttribute("hidden", !open);
  menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
});
mobile.addEventListener("click", (event) => {
  if (event.target.closest("a")) mobile.hidden = true;
});
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const q = new FormData(form).get("q") || "";
  location.hash = `#/search?q=${encodeURIComponent(String(q))}`;
});

function page(title, body, quiet = false) {
  document.title = `${title} — گنجور نو`;
  document.body.classList.toggle("quiet", quiet);
  bar.hidden = quiet;
  foot.hidden = quiet;
  root.onclick = null;
  root.innerHTML = body;
  window.scrollTo(0, 0);
}

function home() {
  const cards = DATA.poets
    .map(
      (p) => `<a class="card" href="#/poet/${p.id}"><strong>${esc(p.name)}</strong><div class="muted">قرن ${p.century} · ${esc(p.city)} · ${p.birth}–${p.death}</div></a>`,
    )
    .join("");
  page(
    "خانه",
    `<p class="kicker">گنجینه شعر فارسی</p>
     <h1>شعر را آرام بخوان، ارتباطش را ببین</h1>
     <p class="lead">پروتوتایپ ریدیزاین آرشیو شعر. متن در مرکز است و معنی، تأثیر و هم‌عصران یک کلیک دورترند.</p>
     <div class="grid cards three" style="margin-top:20px">
       <a class="card" href="#/map" style="background:#0a6b60;color:#fffdf8"><strong>نقشه هم‌عصران</strong><div>سال را جابه‌جا کن.</div></a>
       <a class="card" href="#/discover" style="background:#1c39bb;color:#fffdf8"><strong>پل‌های تأثیر</strong><div>از رودکی تا حافظ.</div></a>
       <a class="card" href="#/poem/hafez/ghazaliat/saghi"><strong>شروع خواندن</strong><div class="muted">حافظ: الا یا ایها الساقی</div></a>
     </div>
     <h2 style="margin-top:28px">شاعران</h2>
     <div class="grid cards">${cards}</div>`,
  );
}

function poets() {
  const cards = DATA.poets
    .map(
      (p) => `<a class="card" href="#/poet/${p.id}"><strong>${esc(p.name)}</strong><div class="muted">${esc(p.full)}</div><div class="muted">${esc(p.city)} · ${p.birth} تا ${p.death}</div></a>`,
    )
    .join("");
  page("شاعران", `<h1>شاعران</h1><p class="lead">نمونه آموزشی از قرن چهارم تا هشتم.</p><div class="grid cards">${cards}</div>`);
}

function poet(id) {
  const p = poetBy(id);
  if (!p) return page("نیست", `<h1>این شاعر در نمونه نیست.</h1>`);
  const books = p.books
    .map((b) => `<a class="card" href="#/book/${p.id}/${b.id}"><strong>${esc(b.title)}</strong><div class="muted">${b.poems.length} شعر</div></a>`)
    .join("");
  const poems = p.books
    .flatMap((b) => b.poems.map((poem) => `<a class="card" href="#/poem/${p.id}/${b.id}/${poem.id}">${esc(poem.title)} <span class="muted">حدود ${poem.age} سالگی</span></a>`))
    .join("");
  const life = p.timeline.map((s) => `<div class="card"><div class="kicker">${esc(s.year)}</div>${esc(s.label)}</div>`).join("");
  const trips = p.travels.map((s) => `<div class="card"><strong>${esc(s.city)}</strong> <span class="muted">${esc(s.note)}</span></div>`).join("");
  page(
    p.name,
    `<p class="crumb"><a href="#/poets">شاعران</a></p>
     <p class="kicker">${esc(p.city)} · قرن ${p.century}</p>
     <h1>${esc(p.name)}</h1>
     <p class="lead">${esc(p.bio)}</p>
     <p class="muted">${esc(p.full)} · ${p.birth}–${p.death} · ${esc(p.style)}</p>
     <h2>نوار عمر</h2><div class="grid cards three">${life}</div>
     <h2 style="margin-top:24px">ردپای سفر</h2><div class="grid">${trips}</div>
     <h2 style="margin-top:24px">آثار</h2><div class="grid cards">${books}</div>
     <h2 style="margin-top:24px">سن‌سنج شعر</h2><div class="grid">${poems}</div>`,
  );
}

function book(poetId, bookId) {
  const located = poetBy(poetId);
  const item = located?.books.find((b) => b.id === bookId);
  if (!located || !item) return page("نیست", `<h1>این کتاب در نمونه نیست.</h1>`);
  const poems = item.poems
    .map((poem) => `<a class="card" href="#/poem/${located.id}/${item.id}/${poem.id}"><strong>${esc(poem.title)}</strong><div class="muted">${esc(poem.verses[0]?.text || "")}</div></a>`)
    .join("");
  page(item.title, `<p class="crumb"><a href="#/poet/${located.id}">${esc(located.name)}</a></p><h1>${esc(item.title)}</h1><p class="lead">${esc(item.intro)}</p><div class="grid">${poems}</div>`);
}

function poem(poetId, bookId, poemId) {
  const located = locate(poetId, bookId, poemId);
  if (!located) return page("نیست", `<h1>این شعر در نمونه نیست.</h1>`);
  const { poet, book: bk, poem: item } = located;
  store.visit(item.id);
  const data = store.get();
  const marked = data.marks.includes(item.id);
  clearInterval(playTimer);
  page(
    item.title,
    `<p class="crumb"><a href="#/poets">شاعران</a> / <a href="#/poet/${poet.id}">${esc(poet.name)}</a> / <a href="#/book/${poet.id}/${bk.id}">${esc(bk.title)}</a></p>
     <h1>${esc(item.title)}</h1>
     <p class="muted">${esc(poet.name)} · ${esc(item.form)} · حدود ${item.age} سالگی · ${esc(item.meter)}</p>
     <div class="row">
       <button class="btn" id="mark">${marked ? "نشان شد" : "نشان"}</button>
       <button class="btn primary" id="quiet">اتاق خلوت</button>
       <button class="btn lapis" id="play">خوانش خط‌به‌خط</button>
     </div>
     <div class="layout">
       <div class="poem" id="verses"></div>
       <aside class="panel" id="side"></aside>
     </div>
     <label class="panel" style="display:block;margin-top:16px">یادداشت من
       <textarea id="note" rows="4">${esc(data.notes[item.id] || "")}</textarea>
     </label>`,
  );
  let active = 0;
  let tab = "plain";
  let word = "";
  const verses = document.querySelector("#verses");
  const side = document.querySelector("#side");
  function count(raw) {
    const clean = raw.replace(/[،.؟!«»:؛]/g, "");
    let n = 0;
    const samples = [];
    for (const book of poet.books) {
      for (const poem of book.poems) {
        for (const verse of poem.verses) {
          for (const part of verse.text.split(/\s+/)) {
            if (part.replace(/[،.؟!«»:؛]/g, "") === clean) {
              n += 1;
              if (samples.length < 3) samples.push(verse.text);
            }
          }
        }
      }
    }
    return { n, samples, clean };
  }
  function draw() {
    verses.innerHTML = item.verses
      .map((verse, i) => {
        const words = verse.text
          .split(" ")
          .map((part) => `<span class="word" data-word="${esc(part)}">${esc(part)}</span>`)
          .join(" ");
        return `<div><button class="verse ${i === active ? "on" : ""}" data-i="${i}">${words}</button></div>`;
      })
      .join("");
    const verse = item.verses[active];
    const related = item.related
      .map((id) => findPoem(id))
      .filter(Boolean)
      .map((hit) => `<div><a href="${poemHref(hit)}">${esc(hit.poet.name)}: ${esc(hit.poem.title)}</a></div>`)
      .join("");
    const mirror = word ? count(word) : null;
    const body =
      tab === "plain"
        ? esc(verse.plain)
        : tab === "mystic"
          ? esc(verse.mystic)
          : tab === "talk"
            ? item.comments.map((c) => `<p><strong>${esc(c.author)}:</strong> ${esc(c.text)}</p>`).join("")
            : related || "پیوندی نیست.";
    side.innerHTML = `${
      mirror
        ? `<div class="card" style="background:#e8ecfa;margin-bottom:8px"><strong>واژه در آینه ${esc(poet.name)}</strong><div>«${esc(mirror.clean)}» ${mirror.n} بار</div>${mirror.samples.map((s) => `<div class="muted">${esc(s)}</div>`).join("")}</div>`
        : ""
    }
      <div class="tabs">
        ${["plain:معنی", "mystic:تفسیر", "talk:حاشیه", "links:پیوند"]
          .map(([id]) => id)
          .map((id, idx) => {
            const label = ["معنی", "تفسیر", "حاشیه", "پیوند"][idx];
            return `<button class="chip ${tab === id ? "on" : ""}" data-tab="${id}">${label}</button>`;
          })
          .join("")}
      </div>
      <p><strong>${esc(verse.text)}</strong></p>
      <div>${body}</div>
      ${item.versions ? `<p class="muted">نسخه دیگر: ${esc(item.versions[0])}</p>` : ""}`;
  }
  draw();
  root.onclick = (event) => {
    const wordEl = event.target.closest("[data-word]");
    const verseEl = event.target.closest("[data-i]");
    const tabEl = event.target.closest("[data-tab]");
    if (wordEl) {
      word = wordEl.dataset.word;
      active = Number(wordEl.closest("[data-i]").dataset.i);
      draw();
    } else if (verseEl) {
      active = Number(verseEl.dataset.i);
      draw();
    } else if (tabEl) {
      tab = tabEl.dataset.tab;
      draw();
    }
  };
  document.querySelector("#mark").onclick = () => {
    store.toggleMark(item.id);
    document.querySelector("#mark").textContent = store.get().marks.includes(item.id) ? "نشان شد" : "نشان";
  };
  document.querySelector("#quiet").onclick = () => {
    const on = !document.body.classList.contains("quiet");
    document.body.classList.toggle("quiet", on);
    bar.hidden = on;
    foot.hidden = on;
    side.hidden = on;
    document.querySelector("#quiet").textContent = on ? "خروج از خلوت" : "اتاق خلوت";
  };
  document.querySelector("#play").onclick = () => {
    active = 0;
    draw();
    clearInterval(playTimer);
    playTimer = setInterval(() => {
      if (active >= item.verses.length - 1) {
        clearInterval(playTimer);
        return;
      }
      active += 1;
      draw();
    }, 1700);
  };
  document.querySelector("#note").onchange = (event) => store.note(item.id, event.target.value);
}

function mapPage() {
  page(
    "نقشه",
    `<h1>نقشه هم‌عصران</h1>
     <p class="lead">سال را حرکت بده. نقطه‌ها تقریبی و آموزشی‌اند.</p>
     <label>سال <output id="year-out">1258</output> میلادی
       <input id="year" type="range" min="850" max="1400" value="1258" />
     </label>
     <p id="alive" class="muted"></p>
     <div class="map" id="map">
       <svg viewBox="0 0 100 100" aria-label="نقشه ساده"><path d="M18 28 L30 18 L48 16 L62 22 L78 18 L88 30 L84 48 L90 62 L78 78 L60 86 L42 80 L28 84 L16 70 L12 50 Z" fill="#d5ebe6" stroke="#0a6b60" stroke-width="0.6"/></svg>
     </div>`,
  );
  const input = document.querySelector("#year");
  const paint = () => {
    const year = Number(input.value);
    document.querySelector("#year-out").textContent = String(year);
    const living = DATA.poets.filter((p) => year >= p.birth && year <= p.death);
    document.querySelector("#alive").textContent = living.map((p) => p.name).join("، ") || "در این سال کسی از نمونه نیست.";
    document.querySelectorAll(".dot").forEach((n) => n.remove());
    const map = document.querySelector("#map");
    for (const poet of living) {
      const a = document.createElement("a");
      a.className = "dot";
      a.href = `#/poet/${poet.id}`;
      a.textContent = poet.name;
      a.style.left = `${poet.x}%`;
      a.style.top = `${poet.y}%`;
      map.appendChild(a);
    }
  };
  input.addEventListener("input", paint);
  paint();
}

function discover() {
  const bridges = DATA.bridges
    .map((b) => {
      const from = poetBy(b.from);
      const to = poetBy(b.to);
      return `<div class="card"><a href="#/poet/${from.id}">${esc(from.name)}</a> ← ${esc(b.kind)} ← <a href="#/poet/${to.id}">${esc(to.name)}</a><div class="muted">${esc(b.note)}</div></div>`;
    })
    .join("");
  const trips = poetBy("saadi")
    .travels.map((s, i) => `<div class="card"><div class="kicker">منزل ${i + 1}</div><strong>${esc(s.city)}</strong><div class="muted">${esc(s.note)}</div></div>`)
    .join("");
  page(
    "کشف",
    `<h1>کشف ارتباط‌ها</h1>
     <div class="panel" style="text-align:center;margin-bottom:16px">
       <a class="btn primary" href="#/poet/rudaki">رودکی</a>
       <div class="grid cards three" style="margin-top:12px">
         <a class="card" href="#/poet/ferdowsi"><div class="kicker">حماسه</div>فردوسی</a>
         <a class="card" href="#/poet/rumi"><div class="kicker">عرفان</div>مولانا</a>
         <a class="card" href="#/poet/hafez"><div class="kicker">غزل</div>حافظ</a>
       </div>
     </div>
     <h2>پل‌های تأثیر</h2><div class="grid">${bridges}</div>
     <h2 style="margin-top:24px">کاروان سعدی</h2><div class="grid cards three">${trips}</div>`,
  );
}

function search() {
  const q = new URLSearchParams(location.hash.split("?")[1] || "").get("q") || "";
  const hits = q
    ? allPoems().filter(({ poet, book, poem }) =>
        [poet.name, book.title, poem.title, poem.meter, ...poem.verses.map((v) => v.text)].join(" ").includes(q),
      )
    : [];
  const html = hits
    .map((item) => `<a class="card" href="${poemHref(item)}"><div class="kicker">${esc(item.poet.name)}</div><strong>${esc(item.poem.title)}</strong><div class="muted">${esc(item.poem.verses[0].text)}</div></a>`)
    .join("");
  page("جستجو", `<h1>جستجو</h1><p class="lead">${q ? `نتیجه برای «${esc(q)}»` : "از نوار بالا جستجو کن."}</p>${q && !hits.length ? `<p>چیزی پیدا نشد.</p>` : `<div class="grid">${html}</div>`}`);
}

function vazn() {
  const meters = [...new Set(allPoems().map((item) => item.poem.meter))];
  const selected = new URLSearchParams(location.hash.split("?")[1] || "").get("m") || "";
  const chips = meters.map((m) => `<a class="chip ${m === selected ? "on" : ""}" href="#/vazn?m=${encodeURIComponent(m)}">${esc(m)}</a>`).join("");
  const hits = allPoems().filter((item) => item.poem.meter === selected);
  const list = hits.map((item) => `<a class="card" href="${poemHref(item)}">${esc(item.poet.name)} — ${esc(item.poem.title)}<div class="muted">قافیه: ${esc(item.poem.rhyme)}</div></a>`).join("");
  page("وزن", `<h1>وزن و قافیه</h1><div class="grid">${chips}</div><div class="grid" style="margin-top:16px">${list}</div>`);
}

function history() {
  const items = DATA.events
    .map((event) => {
      const hit = findPoem(event.poem);
      return `<div class="card"><div class="kicker">${event.year}</div><strong>${esc(event.title)}</strong><div class="muted">${esc(event.text)}</div>${hit ? `<div><a href="${poemHref(hit)}">شعر: ${esc(hit.poem.title)}</a></div>` : ""}</div>`;
    })
    .join("");
  page("تاریخ", `<h1>موج تاریخ</h1><div class="grid">${items}</div>`);
}

function readings() {
  const items = allPoems()
    .map((item) => `<a class="card" href="${poemHref(item)}">${esc(item.poet.name)} — ${esc(item.poem.title)} <span class="kicker">شروع خوانش</span></a>`)
    .join("");
  page("خوانش", `<h1>خوانش‌ها</h1><p class="lead">خوانش خط‌به‌خط داخل صفحه شعر است.</p><div class="grid">${items}</div>`);
}

function library() {
  const data = store.get();
  const block = (ids) =>
    ids
      .map((id) => findPoem(id))
      .filter(Boolean)
      .map((item) => `<a class="card" href="${poemHref(item)}"><strong>${esc(item.poem.title)}</strong><div class="muted">${esc(item.poet.name)}</div></a>`)
      .join("") || `<p class="muted">خالی است.</p>`;
  const notes = Object.entries(data.notes)
    .filter(([, text]) => String(text).trim())
    .map(([id, text]) => {
      const item = findPoem(id);
      if (!item) return "";
      return `<div class="card"><a href="${poemHref(item)}">${esc(item.poem.title)}</a><div class="muted">${esc(text)}</div></div>`;
    })
    .join("");
  page(
    "کتابخانه",
    `<h1>کتابخانه من</h1><p class="lead">روی همین دستگاه می‌ماند.</p>
     <h2>نشان‌ها</h2>${block(data.marks)}
     <h2 style="margin-top:20px">یادداشت‌ها</h2>${notes || `<p class="muted">یادداشتی نیست.</p>`}
     <h2 style="margin-top:20px">اخیراً</h2>${block(data.history)}`,
  );
}

function about() {
  page(
    "درباره",
    `<p class="kicker">نمونه کار طراحی محصول</p>
     <h1>چرا گنجور نو</h1>
     <p>این پروتوتایپ تعاملی است، نه سایت رسمی گنجور. معماری اطلاعات، خوانایی و هویت ایرانی را در یک محصول قابل کلیک نشان می‌دهد.</p>
     <p>لایه‌های بیت فقط وقتی باز می‌شوند که لازم باشند. اتاق خلوت بقیه صفحه را کنار می‌گذارد. سن‌ها و نقشه تقریبی و آموزشی‌اند.</p>
     <p><a href="#/map">نقشه</a> · <a href="#/discover">کشف</a> · <a href="#/poem/hafez/ghazaliat/saghi">یک غزل حافظ</a></p>`,
  );
}

const routes = [
  [/^#\/?$/, home],
  [/^#\/poets$/, poets],
  [/^#\/poet\/([\w-]+)$/, (m) => poet(m[1])],
  [/^#\/book\/([\w-]+)\/([\w-]+)$/, (m) => book(m[1], m[2])],
  [/^#\/poem\/([\w-]+)\/([\w-]+)\/([\w-]+)$/, (m) => poem(m[1], m[2], m[3])],
  [/^#\/map$/, mapPage],
  [/^#\/discover$/, discover],
  [/^#\/search/, search],
  [/^#\/vazn/, vazn],
  [/^#\/history$/, history],
  [/^#\/readings$/, readings],
  [/^#\/library$/, library],
  [/^#\/about$/, about],
];

function render() {
  clearInterval(playTimer);
  const hash = location.hash || "#/";
  const path = hash.split("?")[0];
  for (const [re, fn] of routes) {
    const match = path.match(re) || hash.match(re);
    if (match && (re.source.includes("search") || re.source.includes("vazn") || path.match(re))) {
      fn(match);
      return;
    }
  }
  page("نیست", `<h1>این صفحه در نمونه نیست.</h1><p><a href="#/">بازگشت</a></p>`);
}

const data = await fetch("data.json").then((res) => res.json());
DATA = data;
window.addEventListener("hashchange", render);
if (!location.hash) location.hash = "#/";
render();
