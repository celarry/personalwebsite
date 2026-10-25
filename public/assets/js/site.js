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

  /* ---------- Pictures open full size ----------
     Links marked data-lightbox open in a viewer on the page; arrows move through the set. */
  const shots = [...document.querySelectorAll('a[data-lightbox]')];
  if (shots.length && typeof HTMLDialogElement === 'function') {
    const box = document.createElement('dialog');
    box.className = 'lightbox';
    box.setAttribute('aria-label', 'Picture');
    box.innerHTML = `<figure><img alt=""><figcaption></figcaption></figure>
      <button type="button" class="lightbox__close" aria-label="Close">×</button>
      <button type="button" class="lightbox__prev" aria-label="Previous picture">‹</button>
      <button type="button" class="lightbox__next" aria-label="Next picture">›</button>
      <p class="lightbox__count" aria-live="polite"></p>`;
    document.body.appendChild(box);
    const img = box.querySelector('img');
    const cap = box.querySelector('figcaption');
    const count = box.querySelector('.lightbox__count');
    let set = [], at = 0;
    const show = (k) => {
      at = (k + set.length) % set.length;
      const a = set[at];
      img.src = a.href;
      img.alt = a.querySelector('img') ? a.querySelector('img').alt : '';
      cap.textContent = a.dataset.caption || '';
      count.textContent = set.length > 1 ? `${at + 1} of ${set.length}` : '';
      box.querySelector('.lightbox__prev').hidden = box.querySelector('.lightbox__next').hidden = set.length < 2;
    };
    shots.forEach((a) =>
      a.addEventListener('click', (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        // The set is every picture from the same project in the same list.
        set = [...a.closest('ul').querySelectorAll(`a[data-lightbox="${a.dataset.lightbox}"]`)];
        show(set.indexOf(a));
        box.showModal();
      })
    );
    box.querySelector('.lightbox__close').addEventListener('click', () => box.close());
    box.querySelector('.lightbox__prev').addEventListener('click', () => show(at - 1));
    box.querySelector('.lightbox__next').addEventListener('click', () => show(at + 1));
    box.addEventListener('click', (e) => { if (e.target === box) box.close(); });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') show(at - 1);
      if (e.key === 'ArrowRight') show(at + 1);
    });
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

  /* ---------- Email, for people without an email app ----------
     A mailto: link only works if the computer has an email app set up for it. On plenty of
     machines it doesn't, and the visitor gets a system error instead. So every email link
     offers a choice: Gmail or Outlook in the browser, the email app, or just copying. */
  const composeLinks = (to, subject = '', text = '') => {
    const q = (o) => Object.entries(o).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return {
      gmail: `https://mail.google.com/mail/?${q({ view: 'cm', fs: '1', to, su: subject, body: text })}`,
      outlook: `https://outlook.live.com/mail/0/deeplink/compose?${q({ to, subject, body: text })}`,
      app: `mailto:${to}${subject || text ? `?${q({ subject, body: text })}` : ''}`,
    };
  };
  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // Older browsers: a hidden text box and the copy command.
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (err) {}
      ta.remove();
      return ok;
    }
  };
  let menuEl = null;
  let menuFrom = null;
  const closeMenu = (refocus) => {
    if (!menuEl) return;
    menuEl.remove();
    menuEl = null;
    if (refocus && menuFrom) menuFrom.focus();
    menuFrom = null;
  };
  function emailMenu(from, { to, subject = '', text = '' }) {
    closeMenu();
    const links = composeLinks(to, subject, text);
    menuEl = document.createElement('div');
    menuEl.className = 'mailmenu';
    menuEl.setAttribute('role', 'dialog');
    menuEl.setAttribute('aria-label', 'Send an email');
    menuEl.innerHTML = `<p class="mailmenu__to">${text ? 'Send it with' : 'Email'} <b></b></p>
      <a href="${links.gmail}" target="_blank" rel="noopener">Gmail</a>
      <a href="${links.outlook}" target="_blank" rel="noopener">Outlook</a>
      <a href="${links.app}" data-app>Your email app</a>
      <button type="button" data-copy-mail>${text ? 'Copy the message' : 'Copy the address'}</button>`;
    menuEl.querySelector('b').textContent = text ? '' : to;
    menuEl.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setTimeout(() => closeMenu(), 0)));
    const copyBtn = menuEl.querySelector('[data-copy-mail]');
    copyBtn.addEventListener('click', async () => {
      const ok = await copyText(text ? `To: ${to}\nSubject: ${subject}\n\n${text}` : to);
      copyBtn.textContent = ok ? (text ? 'Copied. Paste it into an email.' : 'Copied') : to;
    });
    document.body.appendChild(menuEl);
    menuFrom = from;
    // Under the link that opened it, kept on screen; centred if there's nothing to sit under.
    const r = from && from.getBoundingClientRect ? from.getBoundingClientRect() : null;
    const w = menuEl.offsetWidth, h = menuEl.offsetHeight;
    let left = r ? r.left : (innerWidth - w) / 2;
    let top = r ? r.bottom + 8 : (innerHeight - h) / 2;
    if (r && top + h > innerHeight - 8 && r.top - h - 8 > 8) top = r.top - h - 8;
    left = Math.max(8, Math.min(innerWidth - w - 8, left));
    menuEl.style.left = `${left + scrollX}px`;
    menuEl.style.top = `${top + scrollY}px`;
    menuEl.querySelector('a').focus({ preventScroll: true });
  }
  window.emailMenu = (opts) => emailMenu(null, { to: body.dataset.email || '', ...opts });
  document.addEventListener('click', (e) => {
    if (menuEl && !menuEl.contains(e.target) && !e.target.closest('a[href^="mailto:"]')) closeMenu();
    const a = e.target.closest('a[href^="mailto:"]');
    if (!a || a.closest('.mailmenu') || a.hasAttribute('data-direct') || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (menuEl && menuFrom === a) return closeMenu();
    const url = new URL(a.href);
    emailMenu(a, { to: decodeURIComponent(url.pathname), subject: url.searchParams.get('subject') || '', text: url.searchParams.get('body') || '' });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuEl) closeMenu(true);
  });
  window.addEventListener('resize', () => closeMenu());

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
      const subject = `Hello from ${name}`;
      const message = `${text}\n\n${name}`;
      const links = composeLinks(email, subject, message);
      reply(`Thanks, ${name}. How do you want to send it? Pick one and it opens with your message already written.`, () => {
        const li = document.createElement('li');
        li.className = 'msg__send';
        const make = (label, href, external) => {
          const a = document.createElement('a');
          a.href = href;
          a.textContent = label;
          if (external) { a.target = '_blank'; a.rel = 'noopener'; }
          a.className = 'msg__choice';
          a.dataset.direct = '';
          return a;
        };
        const copy = document.createElement('button');
        copy.type = 'button';
        copy.className = 'msg__choice';
        copy.textContent = 'Copy it';
        copy.addEventListener('click', async () => {
          const ok = await copyText(`To: ${email}\nSubject: ${subject}\n\n${message}`);
          copy.textContent = ok ? 'Copied' : 'Copy failed';
          if (ok) reply(`Copied. Paste it into an email to ${email} and it comes straight to me.`);
        });
        li.append(make('Gmail', links.gmail, true), make('Outlook', links.outlook, true), make('Email app', links.app, false), copy);
        log.appendChild(li);
        const after = document.createElement('li');
        after.className = 'msg__actions';
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
        after.append(reset);
        log.appendChild(after);
        li.querySelector('a').focus({ preventScroll: true });
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
