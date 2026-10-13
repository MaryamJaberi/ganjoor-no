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

let DATA = { poets: [], bridges: [], events: [], tazmin: [], lexicon: [], forms: [], topics: [] };
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
  return String(value ?? "")
    .replaceAll("&", "\u0026amp;")
    .replaceAll("<", "\u0026lt;")
    .replaceAll(">", "\u0026gt;")
    .replaceAll('"', "\u0026quot;");
}
function poemHref(item) {
  return `#/poem/${item.poet.id}/${item.book.id}/${item.poem.id}`;
}
function query() {
  return new URLSearchParams(location.hash.split("?")[1] || "");
}
function cleanWord(value) {
  return String(value).replace(/[،.؟!«»:؛\-]/g, "").replace(/\u200c/g, "");
}
function peers(poet) {
  return DATA.poets.filter((other) => other.id !== poet.id && other.birth <= poet.death && other.death >= poet.birth);
}
function socialAt(poet, year) {
  return (poet.position || []).find((item) => year >= item.from && year <= item.to) || null;
}
function lexOf(clean) {
  const bare = clean.replace(/^ال/, "");
  return DATA.lexicon.find((entry) => entry.aliases.some((alias) => alias === clean || alias === bare));
}
function topicByName(name) {
  return DATA.topics.find((topic) => topic.name === name);
}
function poemsByTopic(name) {
  return allPoems().filter((item) => (item.poem.topics || []).includes(name));
}
function poemsByForm(name) {
  return allPoems().filter((item) => item.poem.form === name);
}
function cardPoet(poet) {
  const n = poet.books.reduce((sum, book) => sum + book.poems.length, 0);
  return `<a class="card" href="#/poet/${poet.id}"><strong>${esc(poet.name)}</strong><div class="muted">${esc(poet.full)}</div><div class="muted">${esc(poet.city)} · ${poet.birth} تا ${poet.death} · ${n} شعر نمونه</div></a>`;
}
function cardPoem(item) {
  return `<a class="card" href="${poemHref(item)}"><div class="kicker">${esc(item.poet.name)} · ${esc(item.poem.form)}</div><strong>${esc(item.poem.title)}</strong><div class="muted">${esc(item.poem.verses[0]?.text || "")}</div></a>`;
}
function noteBanner() {
  return `<p class="note">${esc(DATA.note || "")}</p>`;
}
function siteLinks() {
  const links = [
    ["#/poets", "شاعران"],
    ["#/map", "نقشه"],
    ["#/sky", "آسمان"],
    ["#/bridges", "پل‌ها"],
    ["#/caravan", "کاروان"],
    ["#/network", "تضمین"],
    ["#/roots", "ریشه‌ها"],
    ["#/history", "تاریخ"],
    ["#/vazn", "وزن"],
    ["#/forms", "فرم‌ها"],
    ["#/topics", "موضوع‌ها"],
    ["#/words", "واژه‌ها"],
    ["#/eras", "قرن‌ها"],
    ["#/readings", "خوانش"],
    ["#/library", "کتابخانه"],
    ["#/about", "درباره"],
  ];
  return `<nav class="chips" aria-label="بخش‌ها">${links.map(([href, label]) => `<a class="chip" href="${href}">${label}</a>`).join("")}</nav>`;
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
  const featured = allPoems()[Math.floor(Date.now() / 86400000) % allPoems().length];
  const cards = DATA.poets.map(cardPoet).join("");
  page(
    "خانه",
    `${noteBanner()}
     <p class="kicker">گنجینه شعر فارسی</p>
     <h1>شعر را آرام بخوان، ارتباطش را ببین</h1>
     <p class="lead">نمونه تعاملی ریدیزاین. متن در مرکز است. معنی، نسخه، حاشیه، سن شاعر و هم‌عصران یک کلیک دورترند.</p>
     <div class="grid cards three" style="margin-top:20px">
       <a class="card ink" href="#/map"><strong>نقشه هم‌عصران</strong><div>سال را جابه‌جا کن و ببین چه کسانی همزمان زنده‌اند.</div></a>
       <a class="card lapis-card" href="#/sky"><strong>آسمان شعر</strong><div>هر شاعر یک ستاره است. قرن را عوض کن.</div></a>
       <a class="card" href="${poemHref(featured)}"><div class="kicker">بیت نمونه امروز</div><strong>${esc(featured.poem.title)}</strong><div class="muted">${esc(featured.poet.name)}: ${esc(featured.poem.verses[0].text)}</div></a>
     </div>
     <h2 class="section">از اینجا شروع کن</h2>
     ${siteLinks()}
     <h2 class="section">شاعران این نمونه</h2>
     <div class="grid cards">${cards}</div>`,
  );
}

function poets() {
  const century = Number(query().get("c") || 0);
  const centuries = [...new Set(DATA.poets.map((poet) => poet.century))];
  const chips = [`<a class="chip ${century ? "" : "on"}" href="#/poets">همه</a>`]
    .concat(centuries.map((item) => `<a class="chip ${century === item ? "on" : ""}" href="#/poets?c=${item}">قرن ${item}</a>`))
    .join("");
  const list = DATA.poets.filter((poet) => !century || poet.century === century);
  page(
    "شاعران",
    `<h1>شاعران</h1>
     <p class="lead">هفت شاعر از قرن چهارم تا هشتم. این فهرست نمونه است، نه همه گنجور.</p>
     <div class="chips">${chips}</div>
     <div class="grid cards" style="margin-top:16px">${list.map(cardPoet).join("")}</div>`,
  );
}

function poet(id) {
  const item = poetBy(id);
  if (!item) return page("نیست", `<h1>این شاعر در نمونه نیست.</h1>`);
  const books = item.books
    .map((book) => `<a class="card" href="#/book/${item.id}/${book.id}"><strong>${esc(book.title)}</strong><div class="muted">${book.poems.length} شعر · ${esc(book.intro)}</div></a>`)
    .join("");
  const span = Math.max(1, item.death - item.birth);
  const poems = item.books
    .flatMap((book) => book.poems.map((poem) => ({ book, poem })))
    .sort((a, b) => a.poem.age - b.poem.age)
    .map(({ book, poem }) => {
      const right = Math.min(100, Math.max(8, ((poem.age || 0) / span) * 100));
      return `<li style="--p:${right}%"><a href="#/poem/${item.id}/${book.id}/${poem.id}">${esc(poem.title)}</a><span class="muted">حدود ${poem.age} سالگی</span></li>`;
    })
    .join("");
  const life = item.timeline
    .map((step) => `<article class="card"><div class="kicker">${esc(step.year)}</div><strong>${esc(step.label)}</strong><p class="muted">${esc(step.detail || "")}</p></article>`)
    .join("");
  const roles = (item.position || [])
    .map((role) => `<article class="card"><div class="kicker">${role.from}–${role.to}</div><strong>${esc(role.role)}</strong><p>${esc(role.effect)}</p></article>`)
    .join("");
  const trips = item.travels
    .map((trip, index) => `<article class="card"><div class="kicker">منزل ${index + 1} · ${esc(trip.year || "")}</div><strong>${esc(trip.city)}</strong><p class="muted">${esc(trip.note)}</p></article>`)
    .join("");
  const near = peers(item)
    .map((other) => `<a class="chip" href="#/poet/${other.id}">${esc(other.name)}</a>`)
    .join("") || `<span class="muted">در این نمونه هم‌عصر نزدیکی نیست.</span>`;
  const from = (item.influences || []).map((pid) => poetBy(pid)).filter(Boolean);
  const to = DATA.poets.filter((other) => (other.influences || []).includes(item.id));
  page(
    item.name,
    `<p class="crumb"><a href="#/poets">شاعران</a></p>
     <p class="kicker">${esc(item.city)} · قرن ${item.century}</p>
     <h1>${esc(item.name)}</h1>
     <p class="lead">${esc(item.bio)}</p>
     <p class="muted">${esc(item.full)} · ${item.birth}–${item.death} · ${esc(item.style)}</p>
     <p><a class="chip" href="#/map">روی نقشه</a> <a class="chip" href="#/sky">در آسمان</a> <a class="chip" href="#/eras">قرن ${item.century}</a></p>
     <h2 class="section">موقعیت اجتماعی</h2>
     <div class="grid">${roles}</div>
     <h2 class="section">نوار عمر</h2>
     <div class="grid cards three">${life}</div>
     <h2 class="section">سن‌سنج شعر</h2>
     <p class="muted">جای هر نام، سن تقریبی سرایش روی خط عمر است. عددها آموزشی‌اند.</p>
     <ol class="ages" aria-label="سن شعرها">${poems}</ol>
     <h2 class="section">ردپای سفر</h2>
     <div class="grid cards three">${trips}</div>
     <h2 class="section">هم‌عصران در این نمونه</h2>
     <div class="chips">${near}</div>
     <h2 class="section">تأثیر</h2>
     <div class="grid cards">
       <article class="card"><div class="kicker">از این‌ها گرفته</div>${from.map((poet) => `<div><a href="#/poet/${poet.id}">${esc(poet.name)}</a></div>`).join("") || "در این نمونه، سرسلسله است."}</article>
       <article class="card"><div class="kicker">بر این‌ها اثر گذاشته</div>${to.map((poet) => `<div><a href="#/poet/${poet.id}">${esc(poet.name)}</a></div>`).join("") || "در این نمونه ادامه مستقیم ثبت نشده."}</article>
     </div>
     <h2 class="section">آثار</h2>
     <div class="grid">${books}</div>`,
  );
}

function book(poetId, bookId) {
  const poet = poetBy(poetId);
  const item = poet?.books.find((entry) => entry.id === bookId);
  if (!poet || !item) return page("نیست", `<h1>این کتاب در نمونه نیست.</h1>`);
  const poems = item.poems
    .map((poem) => `<a class="card" href="#/poem/${poet.id}/${item.id}/${poem.id}"><div class="kicker">${esc(poem.form)} · ${esc(poem.meter)}</div><strong>${esc(poem.title)}</strong><div class="muted">${esc(poem.verses[0]?.text || "")}</div><div class="muted">حدود ${poem.age} سالگی · ${poem.year}</div></a>`)
    .join("");
  page(
    item.title,
    `<p class="crumb"><a href="#/poet/${poet.id}">${esc(poet.name)}</a></p>
     <h1>${esc(item.title)}</h1>
     <p class="lead">${esc(item.intro)}</p>
     <p class="muted">${item.poems.length} شعر در این نمونه</p>
     <div class="grid">${poems}</div>`,
  );
}

function poem(poetId, bookId, poemId) {
  const located = locate(poetId, bookId, poemId);
  if (!located) return page("نیست", `<h1>این شعر در نمونه نیست.</h1><p><a href="#/poets">شاعران</a></p>`);
  const { poet, book: bk, poem: item } = located;
  store.visit(item.id);
  const saved = store.get();
  const marked = saved.marks.includes(item.id);
  clearInterval(playTimer);
  const role = socialAt(poet, item.year);
  const form = DATA.forms.find((entry) => entry.name === item.form);
  const topics = (item.topics || [])
    .map((name) => {
      const topic = topicByName(name);
      return topic ? `<a class="chip" href="#/topic/${topic.id}">${esc(name)}</a>` : "";
    })
    .join("");
  page(
    item.title,
    `<p class="crumb"><a href="#/poets">شاعران</a> / <a href="#/poet/${poet.id}">${esc(poet.name)}</a> / <a href="#/book/${poet.id}/${bk.id}">${esc(bk.title)}</a></p>
     <h1>${esc(item.title)}</h1>
     <p class="muted">${esc(poet.name)} · حدود ${item.age} سالگی · ${item.year} · قافیه ${esc(item.rhyme)}</p>
     <p class="chips">
       ${form ? `<a class="chip" href="#/form/${form.id}">${esc(item.form)}</a>` : ""}
       <a class="chip" href="#/vazn?m=${encodeURIComponent(item.meter)}">${esc(item.meter)}</a>
       ${topics}
     </p>
     ${item.occasion ? `<p class="panel">${esc(item.occasion)}</p>` : ""}
     ${role ? `<p class="panel"><strong>موقعیت در این سال: </strong>${esc(role.role)}<br>${esc(role.effect)}</p>` : ""}
     <div class="row">
       <button class="btn" id="mark">${marked ? "نشان شد" : "نشان"}</button>
       <button class="btn primary" id="quiet">اتاق خلوت</button>
       <button class="btn lapis" id="play">خوانش خط‌به‌خط</button>
     </div>
     <div class="layout">
       <div>
         <div class="poem" id="verses"></div>
         <p class="muted" style="text-align:center">روی واژه بزن تا آینه و معنی باز شود. روی بیت بزن تا شرح همان بیت بیاید.</p>
       </div>
       <aside class="panel" id="side"></aside>
     </div>
     <label class="panel block">یادداشت من
       <textarea id="note" rows="4">${esc(saved.notes[item.id] || "")}</textarea>
     </label>
     ${noteBanner()}`,
  );
  let active = 0;
  let tab = "plain";
  let word = "";
  const verses = document.querySelector("#verses");
  const side = document.querySelector("#side");
  function mirror(raw) {
    const clean = cleanWord(raw);
    let n = 0;
    const samples = [];
    for (const entry of allPoems()) {
      for (const verse of entry.poem.verses) {
        for (const part of verse.text.split(/\s+/)) {
          if (cleanWord(part) === clean) {
            n += 1;
            if (samples.length < 3) samples.push(`${entry.poet.name}: ${verse.text}`);
          }
        }
      }
    }
    const lex = lexOf(clean);
    return { n, samples, clean, lex };
  }
  function draw() {
    verses.innerHTML = item.verses
      .map((verse, index) => {
        const words = verse.text
          .split(" ")
          .map((part) => `<span class="word" data-word="${esc(part)}">${esc(part)}</span>`)
          .join(" ");
        return `<div><button class="verse ${index === active ? "on" : ""}" data-i="${index}">${words}</button></div>`;
      })
      .join("");
    const verse = item.verses[active];
    const related = (item.related || [])
      .map((rid) => findPoem(rid))
      .filter(Boolean)
      .map((hit) => `<div><a href="${poemHref(hit)}">${esc(hit.poet.name)}: ${esc(hit.poem.title)}</a></div>`)
      .join("");
    const comments = (verse.comments || item.comments || [])
      .map((comment) => `<p><strong>${esc(comment.author)}:</strong> ${esc(comment.text)}</p>`)
      .join("") || "<p class=\"muted\">حاشیه‌ای برای این بیت ثبت نشده.</p>";
    const versions = (item.versions || [])
      .map((version) => `<p>${esc(version)}</p>`)
      .join("") || "<p class=\"muted\">اختلاف نسخه برای این شعر در نمونه نیست.</p>";
    const seen = word ? mirror(word) : null;
    const body =
      tab === "plain"
        ? esc(verse.plain)
        : tab === "mystic"
          ? esc(verse.mystic)
          : tab === "talk"
            ? comments
            : tab === "copy"
              ? versions
              : related || "پیوندی نیست.";
    side.innerHTML = `${
      seen
        ? `<div class="card soft"><strong>واژه در آینه</strong><div>«${esc(seen.clean)}» ${seen.n} بار در این نمونه</div>${seen.samples.map((line) => `<div class="muted">${esc(line)}</div>`).join("")}${seen.lex ? `<p><a href="#/word/${seen.lex.id}">${esc(seen.lex.word)} در واژه‌نامه</a><br>${esc(seen.lex.meaning)}</p>` : ""}</div>`
        : ""
    }
      <div class="tabs">
        ${[
          ["plain", "معنی"],
          ["mystic", "تفسیر"],
          ["talk", "حاشیه"],
          ["links", "پیوند"],
          ["copy", "نسخه"],
        ]
          .map(([tid, label]) => `<button class="chip ${tab === tid ? "on" : ""}" data-tab="${tid}">${label}</button>`)
          .join("")}
      </div>
      <p><strong>${esc(verse.text)}</strong></p>
      <div>${body}</div>`;
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
    } else if (tabEl) {
      tab = tabEl.dataset.tab;
      draw();
    } else if (verseEl) {
      active = Number(verseEl.dataset.i);
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
    }, 1600);
  };
  document.querySelector("#note").onchange = (event) => store.note(item.id, event.target.value);
  if (query().get("play") === "1") document.querySelector("#play").click();
}

function mapPage() {
  page(
    "نقشه",
    `<h1>نقشه هم‌عصران</h1>
     <p class="lead">سال را حرکت بده. فقط کسانی که در آن سال زنده‌اند روی نقشه می‌مانند. نقطه‌ها تقریبی‌اند و قونیه مولانا بیرون از این قاب ساده است؛ نشانش روی بلخ، زادبوم اوست.</p>
     <label class="year">سال <output id="year-out">1258</output>
       <input id="year" type="range" min="850" max="1400" value="1258" />
     </label>
     <div class="map" id="map">
       <svg viewBox="0 0 100 100" aria-hidden="true"><path d="M18 28 L30 18 L48 16 L62 22 L78 18 L88 30 L84 48 L90 62 L78 78 L60 86 L42 80 L28 84 L16 70 L12 50 Z" fill="#d5ebe6" stroke="#0a6b60" stroke-width="0.6"/></svg>
     </div>
     <h2 class="section">زنده در این سال</h2>
     <div class="grid cards" id="alive"></div>`,
  );
  const input = document.querySelector("#year");
  const paint = () => {
    const year = Number(input.value);
    document.querySelector("#year-out").textContent = String(year);
    const living = DATA.poets.filter((poet) => year >= poet.birth && year <= poet.death);
    document.querySelector("#alive").innerHTML = living.map(cardPoet).join("") || `<p class="muted">در این سال کسی از نمونه زنده نیست.</p>`;
    document.querySelectorAll(".dot").forEach((node) => node.remove());
    const map = document.querySelector("#map");
    for (const poet of living) {
      const link = document.createElement("a");
      link.className = "dot";
      link.href = `#/poet/${poet.id}`;
      link.textContent = poet.name;
      link.style.left = `${poet.x}%`;
      link.style.top = `${poet.y}%`;
      map.appendChild(link);
    }
  };
  input.addEventListener("input", paint);
  paint();
}

function skyPage() {
  const century = Number(query().get("c") || 0);
  const centuries = [...new Set(DATA.poets.map((poet) => poet.century))];
  const chips = [`<a class="chip ${century ? "" : "on"}" href="#/sky">همه قرن‌ها</a>`]
    .concat(centuries.map((item) => `<a class="chip ${century === item ? "on" : ""}" href="#/sky?c=${item}">قرن ${item}</a>`))
    .join("");
  const spots = [
    [22, 28],
    [40, 18],
    [58, 34],
    [74, 20],
    [30, 58],
    [52, 70],
    [76, 62],
  ];
  const stars = DATA.poets
    .filter((poet) => !century || poet.century === century)
    .map((poet, index) => {
      const spot = spots[index % spots.length];
      return `<a class="star s${poet.fame || 2}" style="left:${spot[0]}%;top:${spot[1]}%" href="#/poet/${poet.id}"><i></i>${esc(poet.name)}<small>قرن ${poet.century}</small></a>`;
    })
    .join("");
  page(
    "آسمان",
    `<h1>آسمان شعر</h1>
     <p class="lead">اندازه ستاره، شهرت آموزشی است نه رتبه واقعی. قرن را عوض کن تا آسمان خلوت شود.</p>
     <div class="chips">${chips}</div>
     <div class="sky">${stars}</div>`,
  );
}

function discover() {
  const tools = [
    ["#/map", "نقشه هم‌عصران", "سال را عقب و جلو ببر."],
    ["#/sky", "آسمان شعر", "شاعران مثل ستاره، به تفکیک قرن."],
    ["#/bridges", "پل‌های تأثیر", "چه کسی زبان یا معنا را به بعدی رساند."],
    ["#/caravan", "کاروان ادبی", "منزل‌های سفر هر شاعر."],
    ["#/network", "شبکه تضمین و استقبال", "بیت‌هایی که بیت دیگر را در خود دارند."],
    ["#/roots", "ریشه‌های مشترک", "از رودکی به شاخه‌های بعد."],
    ["#/history", "موج تاریخ", "شعر کنار رویداد همان سال."],
    ["#/vazn", "وزن و قافیه", "شعرهایی با یک وزن."],
    ["#/words", "واژه در آینه", "یک کلمه در دهان چند شاعر."],
    ["#/topics", "موضوع‌ها", "عشق، خرد، اخلاق، وطن."],
    ["#/forms", "فرم‌ها", "غزل، قصیده، مثنوی، رباعی، قطعه."],
    ["#/eras", "قرن‌ها", "چه کسانی در یک قرن جا شده‌اند."],
  ];
  page(
    "کشف",
    `<h1>کشف ارتباط‌ها</h1>
     <p class="lead">ده مسیر برای دیدن شعر، نه فقط خواندن خطی آن.</p>
     <div class="grid cards">${tools.map(([href, title, text]) => `<a class="card" href="${href}"><strong>${title}</strong><div class="muted">${text}</div></a>`).join("")}</div>`,
  );
}

function bridgesPage() {
  const html = DATA.bridges
    .map((bridge) => {
      const from = poetBy(bridge.from);
      const to = poetBy(bridge.to);
      return `<article class="bridge"><a href="#/poet/${from.id}">${esc(from.name)}</a><span>${esc(bridge.kind)}</span><a href="#/poet/${to.id}">${esc(to.name)}</a><p class="muted">${esc(bridge.note)}</p></article>`;
    })
    .join("");
  page("پل‌ها", `<h1>پل‌های تأثیر</h1><p class="lead">جهت، از سرچشمه به سمت بعدی است. نسبت‌ها آموزشی‌اند.</p><div class="grid">${html}</div>`);
}

function caravanPage() {
  const selected = query().get("p") || "saadi";
  const chips = DATA.poets
    .map((poet) => `<a class="chip ${poet.id === selected ? "on" : ""}" href="#/caravan?p=${poet.id}">${esc(poet.name)}</a>`)
    .join("");
  const poet = poetBy(selected) || DATA.poets[0];
  const stops = poet.travels
    .map((trip, index) => `<article class="card"><div class="kicker">منزل ${index + 1} · ${esc(trip.year || "")}</div><strong>${esc(trip.city)}</strong><p class="muted">${esc(trip.note)}</p></article>`)
    .join("");
  page(
    "کاروان",
    `<h1>کاروان ادبی</h1>
     <p class="lead">سفر، فقط جابه‌جایی شهر نیست. برای سعدی ماده حکایت است و برای مولانا تغییر مقام.</p>
     <div class="chips">${chips}</div>
     <div class="grid cards three" style="margin-top:16px">${stops}</div>`,
  );
}

function networkPage() {
  const html = DATA.tazmin
    .map((link) => {
      const from = findPoem(link.from);
      const to = findPoem(link.to);
      if (!from || !to) return "";
      return `<article class="card"><div class="kicker">${esc(link.kind)}</div><p><a href="${poemHref(from)}">${esc(from.poet.name)}: ${esc(from.poem.title)}</a></p><p>به <a href="${poemHref(to)}">${esc(to.poet.name)}: ${esc(to.poem.title)}</a></p><p class="muted">${esc(link.note)}</p></article>`;
    })
    .join("");
  page("تضمین", `<h1>شبکه تضمین و استقبال</h1><p class="lead">استقبال یعنی همان وزن را دوباره گفتن. تضمین یعنی آوردن عین سخن دیگری داخل شعر خود.</p><div class="grid">${html}</div>`);
}

function rootsPage() {
  function branch(node) {
    const poet = poetBy(node.id);
    const kids = (node.children || []).map(branch).join("");
    return `<li><a href="#/poet/${poet.id}">${esc(poet.name)}</a>${kids ? `<ul>${kids}</ul>` : ""}</li>`;
  }
  page(
    "ریشه‌ها",
    `<h1>ریشه‌های مشترک</h1>
     <p class="lead">این درخت یک قرائت آموزشی است: زبان از رودکی شروع می‌شود و بعد به حماسه، عرفان و غزل شاخه می‌دهد. حافظ روی دو شاخه نشسته چون هم از سعدی می‌آید و هم از پرسش خیام.</p>
     <div class="tree"><ul>${branch(DATA.roots)}</ul></div>`,
  );
}

function search() {
  const q = query().get("q") || "";
  const poets = q ? DATA.poets.filter((poet) => `${poet.name} ${poet.full} ${poet.city} ${poet.bio}`.includes(q)) : [];
  const poems = q
    ? allPoems().filter((item) =>
        [item.poet.name, item.book.title, item.poem.title, item.poem.meter, item.poem.form, ...item.poem.verses.map((verse) => verse.text)].join(" ").includes(q),
      )
    : [];
  const words = q ? DATA.lexicon.filter((entry) => `${entry.word} ${entry.meaning}`.includes(q)) : [];
  page(
    "جستجو",
    `<h1>جستجو</h1>
     <p class="lead">${q ? `نتیجه برای «${esc(q)}»` : "نام شاعر، یک واژه، یا تکه‌ای از بیت را بنویس."}</p>
     ${q && !poets.length && !poems.length && !words.length ? `<p>چیزی پیدا نشد.</p>` : ""}
     ${poets.length ? `<h2 class="section">شاعران</h2><div class="grid cards">${poets.map(cardPoet).join("")}</div>` : ""}
     ${poems.length ? `<h2 class="section">شعرها</h2><div class="grid">${poems.map(cardPoem).join("")}</div>` : ""}
     ${words.length ? `<h2 class="section">واژه‌ها</h2><div class="grid">${words.map((entry) => `<a class="card" href="#/word/${entry.id}"><strong>${esc(entry.word)}</strong><div class="muted">${esc(entry.meaning)}</div></a>`).join("")}</div>` : ""}`,
  );
}

function vazn() {
  const meters = [...new Set(allPoems().map((item) => item.poem.meter))];
  const selected = query().get("m") || meters[0];
  const chips = meters.map((meter) => `<a class="chip ${meter === selected ? "on" : ""}" href="#/vazn?m=${encodeURIComponent(meter)}">${esc(meter)}</a>`).join("");
  const hits = allPoems().filter((item) => item.poem.meter === selected);
  page(
    "وزن",
    `<h1>وزن و قافیه</h1>
     <p class="lead">وزن‌ها با نام سنتی آمده‌اند تا مقایسه ممکن شود. انتخاب کن تا شعرهای هم‌وزن را ببینی.</p>
     <div class="chips">${chips}</div>
     <div class="grid" style="margin-top:16px">${hits.map((item) => `<a class="card" href="${poemHref(item)}"><strong>${esc(item.poet.name)} — ${esc(item.poem.title)}</strong><div class="muted">قافیه: ${esc(item.poem.rhyme)}</div><div class="muted">${esc(item.poem.verses[0].text)}</div></a>`).join("")}</div>`,
  );
}

function history() {
  const items = DATA.events
    .map((event) => {
      const hit = findPoem(event.poem);
      const alive = DATA.poets.filter((poet) => event.year >= poet.birth && event.year <= poet.death);
      return `<article class="card wave"><div class="kicker">${event.year}</div><strong>${esc(event.title)}</strong><p>${esc(event.text)}</p>${hit ? `<p><a href="${poemHref(hit)}">${esc(hit.poet.name)}: ${esc(hit.poem.title)}</a></p>` : ""}<p class="muted">زنده در نمونه: ${alive.map((poet) => poet.name).join("، ") || "—"}</p></article>`;
    })
    .join("");
  page("تاریخ", `<h1>موج تاریخ</h1><p class="lead">رویداد کنار شعری که در این نمونه به آن سال نزدیک است.</p><div class="grid timeline">${items}</div>`);
}

function readings() {
  const items = allPoems()
    .map((item) => `<a class="card" href="${poemHref(item)}?play=1"><div class="kicker">خوانش نمایشی</div><strong>${esc(item.poet.name)} — ${esc(item.poem.title)}</strong><div class="muted">${item.poem.verses.length} مصراع · خط‌به‌خط روشن می‌شود</div></a>`)
    .join("");
  page(
    "خوانش",
    `<h1>خوانش‌ها</h1>
     <p class="lead">فایل صوتی رسمی گنجور اینجا نیست. دکمه، مصراع‌ها را به نوبت روشن می‌کند تا ریتم خواندن دیده شود.</p>
     <div class="grid">${items}</div>`,
  );
}

function library() {
  const data = store.get();
  const block = (ids) =>
    ids
      .map((id) => findPoem(id))
      .filter(Boolean)
      .map((item) => `<a class="card" href="${poemHref(item)}"><strong>${esc(item.poem.title)}</strong><div class="muted">${esc(item.poet.name)}</div></a>`)
      .join("") || `<p class="muted">هنوز خالی است. از صفحه شعر، نشان را بزن.</p>`;
  const notes = Object.entries(data.notes)
    .filter(([, text]) => String(text).trim())
    .map(([id, text]) => {
      const item = findPoem(id);
      if (!item) return "";
      return `<article class="card"><a href="${poemHref(item)}">${esc(item.poem.title)}</a><p class="muted">${esc(text)}</p></article>`;
    })
    .join("");
  page(
    "کتابخانه",
    `<h1>کتابخانه من</h1>
     <p class="lead">نشان، یادداشت و تاریخچه فقط روی همین دستگاه می‌ماند.</p>
     <h2 class="section">نشان‌ها</h2>${block(data.marks)}
     <h2 class="section">یادداشت‌ها</h2>${notes || `<p class="muted">یادداشتی نیست.</p>`}
     <h2 class="section">اخیراً خوانده‌ای</h2>${block(data.history)}`,
  );
}

function wordsPage() {
  const html = DATA.lexicon
    .map((entry) => `<a class="card" href="#/word/${entry.id}"><strong>${esc(entry.word)}</strong><div class="muted">${esc(entry.meaning)}</div></a>`)
    .join("");
  page("واژه‌ها", `<h1>واژه‌نامه نمونه</h1><p class="lead">جایگزین دهخدا نیست. برای هر واژه یک معنی کوتاه و بیت‌هایی از همین نمونه هست. در صفحه شعر هم با زدن روی کلمه باز می‌شود.</p><div class="grid cards">${html}</div>`);
}

function wordPage(id) {
  const entry = DATA.lexicon.find((item) => item.id === id);
  if (!entry) return page("نیست", `<h1>این واژه در نمونه نیست.</h1>`);
  const hits = [];
  for (const item of allPoems()) {
    for (const verse of item.poem.verses) {
      const parts = verse.text.split(/\s+/).map(cleanWord);
      if (entry.aliases.some((alias) => parts.some((part) => part === alias || part.replace(/^ال/, "") === alias))) {
        hits.push(`<a class="card" href="${poemHref(item)}"><div class="kicker">${esc(item.poet.name)}</div><strong>${esc(verse.text)}</strong></a>`);
      }
    }
  }
  page(entry.word, `<p class="crumb"><a href="#/words">واژه‌ها</a></p><h1>${esc(entry.word)}</h1><p class="lead">${esc(entry.meaning)}</p><div class="grid">${hits.join("") || `<p class="muted">در بیت‌های نمونه نیامده.</p>`}</div>`);
}

function formsPage() {
  const html = DATA.forms
    .map((form) => `<a class="card" href="#/form/${form.id}"><strong>${esc(form.name)}</strong><div class="muted">${esc(form.about)}</div><div class="muted">${poemsByForm(form.name).length} شعر</div></a>`)
    .join("");
  page("فرم‌ها", `<h1>فرم‌ها</h1><div class="grid">${html}</div>`);
}

function formPage(id) {
  const form = DATA.forms.find((item) => item.id === id);
  if (!form) return page("نیست", `<h1>این فرم در نمونه نیست.</h1>`);
  page(form.name, `<p class="crumb"><a href="#/forms">فرم‌ها</a></p><h1>${esc(form.name)}</h1><p class="lead">${esc(form.about)}</p><div class="grid">${poemsByForm(form.name).map(cardPoem).join("")}</div>`);
}

function topicsPage() {
  const html = DATA.topics
    .map((topic) => `<a class="card" href="#/topic/${topic.id}"><strong>${esc(topic.name)}</strong><div class="muted">${poemsByTopic(topic.name).length} شعر</div></a>`)
    .join("");
  page("موضوع‌ها", `<h1>موضوع‌ها</h1><p class="lead">برچسب‌ها دستی و آموزشی‌اند تا از یک حال به شعرهای دور برسی.</p><div class="grid cards">${html}</div>`);
}

function topicPage(id) {
  const topic = DATA.topics.find((item) => item.id === id);
  if (!topic) return page("نیست", `<h1>این موضوع در نمونه نیست.</h1>`);
  page(topic.name, `<p class="crumb"><a href="#/topics">موضوع‌ها</a></p><h1>${esc(topic.name)}</h1><div class="grid">${poemsByTopic(topic.name).map(cardPoem).join("")}</div>`);
}

function erasPage() {
  const centuries = [...new Set(DATA.poets.map((poet) => poet.century))].sort((a, b) => a - b);
  const html = centuries
    .map((century) => {
      const poets = DATA.poets.filter((poet) => poet.century === century);
      return `<section class="panel"><h2>قرن ${century}</h2><div class="grid cards">${poets.map(cardPoet).join("")}</div></section>`;
    })
    .join("");
  page("قرن‌ها", `<h1>قرن‌ها</h1><p class="lead">برای دیدن همزمانی دقیق‌تر، <a href="#/map">نقشه</a> سال را نشان می‌دهد. اینجا گروه‌بندی درشت است.</p><div class="grid">${html}</div>`);
}

function about() {
  page(
    "درباره",
    `<p class="kicker">نمونه کار طراحی محصول</p>
     <h1>گنجور نو</h1>
     <p>این پروتوتایپ تعاملی مریم جابری است، نه سایت رسمی گنجور. هدفش نشان دادن این است که آرشیو شعر فارسی می‌تواند خوانا، آرام و در عین حال پر از رابطه باشد.</p>
     <p>در صفحه شعر معنی ساده، تفسیر، حاشیه، نسخه و پیوند هر بیت جداست. اتاق خلوت بقیه صفحه را کنار می‌گذارد. سن‌سنج، نقشه و پل‌ها تقریبی‌اند و جایی که سند محل بحث است، همان را نوشته‌ایم.</p>
     <h2 class="section">همه صفحه‌ها</h2>
     ${siteLinks()}
     <p class="muted">طراحی و ساخت: مریم جابری</p>`,
  );
}

const routes = [
  [/^#\/?$/, home],
  [/^#\/poets$/, poets],
  [/^#\/poet\/([\w-]+)$/, (match) => poet(match[1])],
  [/^#\/book\/([\w-]+)\/([\w-]+)$/, (match) => book(match[1], match[2])],
  [/^#\/poem\/([\w-]+)\/([\w-]+)\/([\w-]+)$/, (match) => poem(match[1], match[2], match[3])],
  [/^#\/map$/, mapPage],
  [/^#\/sky$/, skyPage],
  [/^#\/discover$/, discover],
  [/^#\/bridges$/, bridgesPage],
  [/^#\/caravan$/, caravanPage],
  [/^#\/network$/, networkPage],
  [/^#\/roots$/, rootsPage],
  [/^#\/search$/, search],
  [/^#\/vazn$/, vazn],
  [/^#\/history$/, history],
  [/^#\/readings$/, readings],
  [/^#\/library$/, library],
  [/^#\/words$/, wordsPage],
  [/^#\/word\/([\w-]+)$/, (match) => wordPage(match[1])],
  [/^#\/forms$/, formsPage],
  [/^#\/form\/([\w-]+)$/, (match) => formPage(match[1])],
  [/^#\/topics$/, topicsPage],
  [/^#\/topic\/([\w-]+)$/, (match) => topicPage(match[1])],
  [/^#\/eras$/, erasPage],
  [/^#\/about$/, about],
];

function render() {
  clearInterval(playTimer);
  const hash = location.hash || "#/";
  const path = hash.split("?")[0];
  for (const [re, fn] of routes) {
    const match = path.match(re);
    if (match) {
      fn(match);
      const q = query().get("q");
      const input = document.querySelector("#q");
      if (q != null && input) input.value = q;
      return;
    }
  }
  page("نیست", `<h1>این صفحه در نمونه نیست.</h1><p><a href="#/">بازگشت به خانه</a></p>`);
}

const data = await fetch("data.json?v=4").then((res) => res.json());
DATA = data;
window.addEventListener("hashchange", render);
if (!location.hash) location.hash = "#/";
render();
