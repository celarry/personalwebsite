// Runs on every page: theme, local clock, copy buttons, blog filters, the contact thread
// and a note for the curious.
(() => {
  const root = document.documentElement;
  const body = document.body;
  const dark = window.matchMedia('(prefers-color-scheme: dark)');
  const current = () => root.dataset.theme || (dark.matches ? 'dark' : 'light');

  /* ---------- Theme ---------- */
  const label = (btn) => btn.setAttribute('aria-label', current() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  const toggles = document.querySelectorAll('[data-theme-toggle]');
  function toggle() {
    const next = current() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) {}
    toggles.forEach(label);
  }
  toggles.forEach((btn) => {
    label(btn);
    btn.addEventListener('click', toggle);
  });
  dark.addEventListener('change', () => toggles.forEach(label));
  window.siteTheme = { toggle, current };

  /* ---------- Keyboard hint: ⌘K on Apple devices, Ctrl K elsewhere ---------- */
  const platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  if (!/mac|iphone|ipad|ipod/i.test(platform)) {
    document.querySelectorAll('[data-kbd-mod]').forEach((k) => (k.textContent = 'Ctrl K'));
    document.querySelectorAll('[data-kbd-mod-only]').forEach((k) => (k.textContent = 'Ctrl'));
  }

  /* ---------- Appearing on scroll ----------
     The head script hides these until they come into view (see .reveal in site.css).
     Things that arrive together go in order, a beat apart. */
  if (root.classList.contains('reveal')) {
    const targets = document.querySelectorAll('main > :not(.block):not(.prose), .block__label, .block__body > :not(ul):not(ol):not(dl), .block__body > :is(ul, ol) > li, .block__body > dl > div, .covers > li, .prose > *');
    const io = new IntersectionObserver((entries) => {
      const coming = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left);
      coming.forEach((e, k) => {
        e.target.style.setProperty('--reveal-delay', `${Math.min(k, 8) * 70}ms`);
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -6% 0px' });
    targets.forEach((el) => io.observe(el));
    // Printing shouldn't leave anything invisible.
    const showAll = () => targets.forEach((el) => el.classList.add('is-in'));
    window.addEventListener('beforeprint', showAll);
    window.revealReady = true;
  }

  /* ---------- Local clock ---------- */
  const tz = body.dataset.tz;
  const place = body.dataset.place;
  let fmt = null;
  try { fmt = new Intl.DateTimeFormat('en-AU', { hour: 'numeric', minute: '2-digit', timeZone: tz }); } catch (e) {}
  const clocks = document.querySelectorAll('[data-clock]');
  const tails = document.querySelectorAll('[data-clock-tail]');
  if (fmt && (clocks.length || tails.length)) {
    const tick = () => {
      const t = fmt.format(new Date()).replace(/\s?([ap])m$/i, ' $1m');
      clocks.forEach((c) => (c.textContent = `It's ${t} for me in ${place}.`));
      tails.forEach((c) => (c.textContent = `, where it's ${t}`));
    };
    tick();
    setInterval(tick, 30000);
  }

  /* ---------- "Updated 3 days ago" ---------- */
  document.querySelectorAll('time[data-ago]').forEach((el) => {
    const then = new Date(el.getAttribute('datetime') + 'T12:00:00');
    const days = Math.round((Date.now() - then) / 86400000);
    if (Number.isNaN(days) || days < 0) return;
    const ago = days === 0 ? 'today' : days === 1 ? 'yesterday' : days < 45 ? `${days} days ago` : `${Math.round(days / 30)} months ago`;
    el.title = el.textContent;
    el.textContent = `${el.textContent} (${ago})`;
  });

  /* ---------- Copy buttons ---------- */
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    const original = btn.textContent;
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        btn.textContent = 'Copied';
      } catch (e) {
        const target = btn.previousElementSibling;
        if (target) {
          const r = document.createRange();
          r.selectNodeContents(target);
          const s = window.getSelection();
          s.removeAllRanges();
          s.addRange(r);
        }
        btn.textContent = 'Press Ctrl C to copy';
      }
      setTimeout(() => (btn.textContent = original), 2200);
    });
  });

  /* ---------- Blog tag filters (bookmarkable as /blog/#life) ---------- */
  const filters = document.querySelector('[data-filters]');
  if (filters) {
    const buttons = [...filters.querySelectorAll('[data-filter]')];
    const items = [...document.querySelectorAll('.row[data-tags]')];
    const years = [...document.querySelectorAll('[data-year]')];
    const empty = document.querySelector('[data-filter-empty]');
    const apply = (tag, push) => {
      if (tag && !buttons.some((b) => b.dataset.filter === tag)) tag = '';
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === tag)));
      let shown = 0;
      items.forEach((li) => {
        const ok = !tag || li.dataset.tags.split(' ').includes(tag);
        li.hidden = !ok;
        if (ok) shown++;
      });
      years.forEach((y) => (y.hidden = !y.querySelector('.row[data-tags]:not([hidden])')));
      if (empty) empty.hidden = shown > 0;
      if (push) history.replaceState(null, '', tag ? `#${tag}` : location.pathname + location.search);
    };
    buttons.forEach((b) => b.addEventListener('click', () => apply(b.dataset.filter, true)));
    const fromHash = () => apply(decodeURIComponent(location.hash.slice(1)).toLowerCase(), false);
    window.addEventListener('hashchange', fromHash);
    fromHash();
  }

  /* ---------- Contact: a short text thread that ends in an email ---------- */
  const chat = document.querySelector('[data-chat]');
  if (chat) {
    const log = chat.querySelector('[data-chat-log]');
    const form = chat.querySelector('[data-chat-form]');
    const input = chat.querySelector('[data-chat-input]');
    const label = chat.querySelector('[data-chat-label]');
    const email = body.dataset.email || '';
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const first = log.innerHTML;
    let step = 'name';
    let name = '';
    chat.hidden = false;

    const add = (who, text) => {
      const li = document.createElement('li');
      li.className = `msg msg--${who}`;
      li.textContent = text;
      log.appendChild(li);
      return li;
    };
    // Lawrence "types" for a moment before each reply.
    const reply = (text, then) => {
      const typing = document.createElement('li');
      typing.className = 'msg msg--them msg--typing';
      typing.setAttribute('aria-hidden', 'true');
      typing.innerHTML = '<i></i><i></i><i></i>';
      log.appendChild(typing);
      setTimeout(() => {
        typing.remove();
        add('them', text);
        if (then) then();
      }, reduce.matches ? 0 : 650 + Math.min(900, text.length * 10));
    };
    const prompt = (placeholder, auto) => {
      input.placeholder = placeholder;
      input.setAttribute('autocomplete', auto);
      label.textContent = placeholder;
    };
    const autosize = () => {
      input.style.height = 'auto';
      input.style.height = `${Math.min(160, input.scrollHeight + 2)}px`;
    };
    input.addEventListener('input', autosize);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        form.requestSubmit();
      }
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return input.focus();
      add('me', text);
      input.value = '';
      autosize();
      if (step === 'name') {
        name = text.split(/\s+/).slice(0, 3).join(' ').slice(0, 40);
        step = 'message';
        prompt('Your message', 'off');
        reply(`Nice to meet you, ${name}. What's on your mind?`, () => input.focus({ preventScroll: true }));
        return;
      }
      step = 'done';
      form.hidden = true;
      const href = `mailto:${email}?subject=${encodeURIComponent(`Hello from ${name}`)}&body=${encodeURIComponent(`${text}\n\n${name}`)}`;
      // Open the visitor's email app now, while the click still counts as theirs.
      window.location.href = href;
      reply(`Thanks, ${name}. Your email app should have opened with that message ready to go. Press send there and it comes straight to me.`, () => {
        const li = document.createElement('li');
        li.className = 'msg__actions';
        const again = document.createElement('a');
        again.href = href;
        again.textContent = 'Open the email again';
        const copy = document.createElement('button');
        copy.type = 'button';
        copy.textContent = 'Copy the message';
        copy.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(text);
            copy.textContent = 'Copied. Paste it into an email to me.';
          } catch (err) {
            copy.textContent = `Email it to ${email}`;
          }
        });
        const reset = document.createElement('button');
        reset.type = 'button';
        reset.textContent = 'Start over';
        reset.addEventListener('click', () => {
          log.innerHTML = first;
          step = 'name';
          name = '';
          prompt('Your name', 'name');
          form.hidden = false;
          input.focus();
        });
        li.append(again, copy, reset);
        log.appendChild(li);
      });
    });
  }

  /* ---------- For anyone who opens the developer tools ---------- */
  try {
    const repo = body.dataset.repo;
    console.log(
      '%cHi, I\'m Lawrence.%c\nThanks for looking under the hood. No framework here: one Node build script, plain JS and a lot of CSS.\nPress ⌘K (or Ctrl K) to search.\nThe cart is window.floorDemo, if you want to boss it around.' + (repo ? `\nSource: ${repo}` : ''),
      'font: 700 16px system-ui; color: #2b45e0',
      'font: 13px/1.5 system-ui'
    );
  } catch (e) {}
})();
