// Translation engine. Each language lives in its own file in js/i18n/<code>.js and
// registers itself with LS.i18n.register(code, { key: 'text' }).
//
//   t('link.savedTo', { name: 'Work' })   -> "Saved to Work"     ({name} placeholders)
//   t('count.links', { count: 3 })         -> "3 links"           (plural forms: key_one, key_two, key_few, key_many, key_other)
//   rich('welcome.tip3')                   -> DOM nodes; **bold** and [[Key]] (keyboard key) markup
//
// Missing keys fall back to English, then to the key itself.
(function (g) {
  const LS = (g.LS = g.LS || {});

  const LANGUAGES = [
    { code: 'en', name: 'English', locale: 'en' },
    { code: 'he', name: 'עברית', locale: 'he', rtl: true },
    { code: 'fr', name: 'Français', locale: 'fr' },
    { code: 'es', name: 'Español', locale: 'es' },
    { code: 'zh', name: '中文', locale: 'zh-CN' },
  ];
  const DEFAULT = 'en';
  const dicts = {};
  let lang = DEFAULT;

  const info = (code) => LANGUAGES.find((l) => l.code === code) || LANGUAGES[0];

  function register(code, dict) { dicts[code] = dict; }

  function setLang(code) {
    lang = LANGUAGES.some((l) => l.code === code) ? code : DEFAULT;
    if (typeof document !== 'undefined') {
      document.documentElement.lang = info(lang).locale;
      document.documentElement.dir = info(lang).rtl ? 'rtl' : 'ltr';
    }
    return lang;
  }

  const getLang = () => lang;
  const locale = () => info(lang).locale;
  const isRtl = () => !!info(lang).rtl;

  function lookup(code, key, vars) {
    const dict = dicts[code];
    if (!dict) return undefined;
    if (vars && typeof vars.count === 'number') {
      const cat = new Intl.PluralRules(info(code).locale).select(vars.count);
      if (dict[`${key}_${cat}`] !== undefined) return dict[`${key}_${cat}`];
      if (dict[`${key}_other`] !== undefined) return dict[`${key}_other`];
    }
    return dict[key];
  }

  function t(key, vars) {
    let s = lookup(lang, key, vars);
    if (s === undefined && lang !== DEFAULT) s = lookup(DEFAULT, key, vars);
    if (s === undefined) s = key;
    if (!vars) return s;
    return s.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m));
  }

  const has = (key) => !!(dicts[lang] && key in dicts[lang]) || !!(dicts[DEFAULT] && key in dicts[DEFAULT]);

  // Stored error messages are translation keys; older ones may be plain text.
  const err = (msg) => (msg && has(msg) ? t(msg) : msg || '');

  // Builds safe DOM nodes from a translation: **bold** and [[Key]] become <strong> and <kbd>.
  function rich(key, vars) {
    const text = t(key, vars);
    const frag = document.createDocumentFragment();
    const re = /\*\*(.+?)\*\*|\[\[(.+?)\]\]/g;
    let last = 0;
    let m;
    while ((m = re.exec(text))) {
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      const el = document.createElement(m[1] !== undefined ? 'strong' : 'kbd');
      el.textContent = m[1] !== undefined ? m[1] : m[2];
      frag.appendChild(el);
      last = re.lastIndex;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    return frag;
  }

  // Fills static HTML: data-i18n="key" (plain text), data-i18n-rich="key" (with markup),
  // data-i18n-placeholder / data-i18n-title / data-i18n-aria-label for attributes.
  function applyStatic(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    root.querySelectorAll('[data-i18n-rich]').forEach((el) => { el.replaceChildren(rich(el.dataset.i18nRich)); });
    for (const attr of ['placeholder', 'title', 'aria-label']) {
      const dataKey = 'i18n' + attr.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase());
      root.querySelectorAll(`[data-i18n-${attr}]`).forEach((el) => el.setAttribute(attr, t(el.dataset[dataKey])));
    }
  }

  // "3 hours ago", "il y a 3 heures", "לפני 3 שעות"…
  function timeAgo(ts) {
    if (!ts) return t('time.never');
    const s = Math.round((Date.now() - ts) / 1000);
    if (s < 60) return t('time.justNow');
    const intl = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' });
    // Hebrew ICU data appends the number to dual forms ("לפני שעתיים (2)"); drop it.
    const rtf = { format: (n, unit) => intl.format(n, unit).replace(/\s*\(\d+\)$/, '') };
    const m = Math.round(s / 60);
    if (m < 60) return rtf.format(-m, 'minute');
    const hr = Math.round(m / 60);
    if (hr < 24) return rtf.format(-hr, 'hour');
    return rtf.format(-Math.round(hr / 24), 'day');
  }

  LS.i18n = { LANGUAGES, DEFAULT, register, setLang, getLang, locale, isRtl, t, has, err, rich, applyStatic, timeAgo };
  LS.t = t;
})(self);
