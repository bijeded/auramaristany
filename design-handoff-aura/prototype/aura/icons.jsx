// ============================================================
// AURA — Iconos SVG line-style. Export a window.Icon
// Uso: <Icon name="home" size={22} />
// ============================================================
(function () {
  const P = {
    // navegación cliente
    home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /><path d="M9.5 20v-6h5v6" /></>,
    chart: <><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M21 20H3" /></>,
    chat: <><path d="M4 5h16v11H9l-4 4v-4H4z" /></>,
    gear: <><circle cx="12" cy="12" r="3.2" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" /></>,
    // admin
    grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.4" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.4" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.4" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.4" /></>,
    users: <><circle cx="9" cy="8" r="3.3" /><path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" /><path d="M16 5.2A3.3 3.3 0 0 1 16 11.6M17.5 14.8c2.2.5 3.8 2.4 3.8 5.2" /></>,
    book: <><path d="M5 4.5h11a2 2 0 0 1 2 2V20H7a2 2 0 0 1-2-2z" /><path d="M5 17.5h13" /><path d="M9 8h6M9 11h6" /></>,
    clipboard: <><rect x="5" y="5" width="14" height="16" rx="2" /><path d="M9 5V3.5h6V5" /><path d="M8.5 11h7M8.5 15h5" /></>,
    // ui
    calendar: <><rect x="4" y="5" width="16" height="16" rx="2.2" /><path d="M4 9.5h16M8 3.5v3M16 3.5v3" /></>,
    weight: <><path d="M6.5 9h11l1.5 11H5z" /><path d="M9 9a3 3 0 0 1 6 0" /></>,
    check: <><path d="M5 12.5l4.5 4.5L19 7" /></>,
    'check-sm': <><path d="M4 12l5 5L20 6" /></>,
    lock: <><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>,
    'lock-open': <><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 7.5-2" /></>,
    mail: <><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="M4 7l8 6 8-6" /></>,
    eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>,
    'eye-off': <><path d="M3 3l18 18" /><path d="M10 6c.6-.1 1.3-.2 2-.2 6 0 9.5 6.2 9.5 6.2a16 16 0 0 1-3 3.6M6.5 7.6A16 16 0 0 0 2.5 12S6 18.5 12 18.5c1.3 0 2.4-.3 3.5-.7" /></>,
    clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5.2l3.3 2" /></>,
    timer: <><circle cx="12" cy="13" r="7.5" /><path d="M12 13V8.5M9.5 2.5h5" /></>,
    moon: <><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" /></>,
    heart: <><path d="M12 20s-7-4.4-7-9.4A3.9 3.9 0 0 1 12 7a3.9 3.9 0 0 1 7 3.6c0 5-7 9.4-7 9.4z" /></>,
    star: <><path d="M12 3.5l2.6 5.3 5.9.8-4.3 4.1 1 5.8L12 17l-5.2 2.7 1-5.8L3.5 9.6l5.9-.8z" /></>,
    play: <><path d="M8 5.5v13l11-6.5z" /></>,
    camera: <><path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.5" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    minus: <><path d="M5 12h14" /></>,
    x: <><path d="M6 6l12 12M18 6L6 18" /></>,
    search: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>,
    'arrow-right': <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    'arrow-left': <><path d="M19 12H5M11 18l-6-6 6-6" /></>,
    'chevron-right': <><path d="M9 5l7 7-7 7" /></>,
    'chevron-left': <><path d="M15 5l-7 7 7 7" /></>,
    'chevron-down': <><path d="M5 9l7 7 7-7" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    drag: <><circle cx="9" cy="6" r="1.4" /><circle cx="15" cy="6" r="1.4" /><circle cx="9" cy="12" r="1.4" /><circle cx="15" cy="12" r="1.4" /><circle cx="9" cy="18" r="1.4" /><circle cx="15" cy="18" r="1.4" /></>,
    edit: <><path d="M5 19h3l9.5-9.5a2 2 0 0 0-3-3L5 16z" /><path d="M14 7l3 3" /></>,
    trash: <><path d="M5 7h14M9 7V5h6v2M7 7l1 12h8l1-12" /></>,
    file: <><path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5H7A.5.5 0 0 1 6.5 20V4A.5.5 0 0 1 7 3.5z" /><path d="M14 3.5V8h4" /></>,
    pdf: <><path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5H7A.5.5 0 0 1 6.5 20V4A.5.5 0 0 1 7 3.5z" /><path d="M14 3.5V8h4" /></>,
    image: <><rect x="3.5" y="5" width="17" height="14" rx="2" /><circle cx="9" cy="10" r="1.8" /><path d="M4 17l4.5-4 3.5 3 3-2.5L20 17" /></>,
    'text-icon': <><path d="M5 6h14M5 6V4.5h14V6M12 6v13M9 19h6" /></>,
    youtube: <><rect x="3" y="6" width="18" height="12" rx="3" /><path d="M10.5 9.5v5l4-2.5z" fill="currentColor" stroke="none" /></>,
    dumbbell: <><path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12" /></>,
    card: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /></>,
    logout: <><path d="M14 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h8" /><path d="M11 12h9M17 8l4 4-4 4" /></>,
    bell: <><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z" /><path d="M10 19a2 2 0 0 0 4 0" /></>,
    send: <><path d="M21 4L3 11l7 2.5L13 21l8-17z" /><path d="M10 13.5L21 4" /></>,
    megaphone: <><path d="M4 10v4l3 .5L9 19l2-.5-1.2-3.7L18 17V7l-9 2.5L4 10z" /></>,
    'dots-v': <><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></>,
    info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 7.8v.2" /></>,
    warning: <><path d="M12 4l9 15.5H3z" /><path d="M12 10v4M12 17v.2" /></>,
    ruler: <><rect x="3" y="8" width="18" height="8" rx="1.4" transform="rotate(0 12 12)" /><path d="M7 8v3M11 8v4M15 8v3M19 8v3" /></>,
    sparkle: <><path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z" /><path d="M18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" /></>,
    phone: <><rect x="7" y="3" width="10" height="18" rx="2.5" /><path d="M10.5 18.5h3" /></>,
    user: <><circle cx="12" cy="8" r="3.6" /><path d="M5 20c0-3.8 3-6.2 7-6.2s7 2.4 7 6.2" /></>,
    target: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /></>,
    refresh: <><path d="M20 11A8 8 0 0 0 6 6.5L3.5 9" /><path d="M4 13a8 8 0 0 0 14 4.5L20.5 15" /><path d="M3.5 4.5V9H8M20.5 19.5V15H16" /></>,
    money: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v9M14.5 9.5c0-1.1-1.1-1.8-2.5-1.8s-2.5.8-2.5 1.9 1.1 1.6 2.5 1.6 2.5.6 2.5 1.7-1.1 1.8-2.5 1.8-2.5-.7-2.5-1.8" /></>
  };

  function Icon({ name, size = 22, color = 'currentColor', strokeWidth = 1.7, style = {}, className = '' }) {
    const path = P[name];
    if (!path) return null;
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style} aria-hidden="true">
        {path}
      </svg>);

  }

  window.Icon = Icon;
})();