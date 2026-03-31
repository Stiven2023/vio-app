export const PRIMARY = "var(--viomar-primary)";
export const PRIMARY_DARK = "var(--viomar-primary-dark)";
export const FG = "var(--viomar-fg)";

export const HOME_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@300;400;600;700;800;900&family=Barlow:wght@300;400;500;600&display=swap');

  .viomar-btn {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    font-size: 0.8rem;
    padding: 10px 22px;
    background: ${PRIMARY};
    color: #fff;
    border: none;
    cursor: pointer;
    transition: background 0.14s, transform 0.12s;
  }

  .viomar-btn:hover { background: ${PRIMARY_DARK}; transform: scale(1.01); }
  .viomar-btn:active { transform: scale(0.97); }

  .module-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    line-height: 0.9;
    letter-spacing: -0.01em;
    color: ${FG};
    font-size: clamp(2.2rem, 4vw, 4rem);
    position: relative;
    display: inline-block;
  }

  .module-title::after {
    content: '';
    position: absolute;
    bottom: 2px;
    left: 0;
    height: 3px;
    width: 0;
    background: ${PRIMARY};
    transition: width 0.2s ease;
  }

  .panel-active .module-title::after { width: 100%; }

  .panel {
    position: relative;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    cursor: pointer;
    transition: flex 0.24s cubic-bezier(0.3, 0.8, 0.2, 1);
    min-height: 220px;
  }

  .active-bar {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: ${PRIMARY};
    transform: scaleY(0);
    transform-origin: top;
    transition: transform 0.18s ease;
  }

  .panel-active .active-bar { transform: scaleY(1); }

  .accent-tag {
    opacity: 0;
    transform: translateX(8px);
    transition: opacity 0.16s, transform 0.16s;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 0.65rem;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: ${PRIMARY};
  }

  .panel-active .accent-tag { opacity: 1; transform: translateX(0); }

  .desc-text { transition: opacity 0.16s; opacity: 0.56; }
  .panel-active .desc-text { opacity: 1; }

  .noise-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0.02;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size: 200px 200px;
  }

  .panel-glow {
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.16s;
    background: linear-gradient(135deg, color-mix(in srgb, var(--viomar-primary) 11%, transparent) 0%, transparent 55%);
  }

  .panel-active .panel-glow { opacity: 1; }

  .home-main {
    -webkit-overflow-scrolling: touch;
  }

  @media (max-width: 1024px) {
    .selector-grid {
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px !important;
      padding: 0 16px 16px !important;
    }

    .selector-grid .panel {
      border-right: none !important;
      border: 1px solid #D0CCC5 !important;
      border-radius: 14px;
      min-height: 240px;
    }

    .selector-grid .panel:nth-child(3) {
      grid-column: 1 / -1;
    }

    .selector-grid .panel .active-bar {
      display: none;
    }
  }

  @media (max-width: 640px) {
    .home-header {
      padding: 14px 16px !important;
    }

    .home-brand {
      gap: 8px !important;
    }

    .home-user-name {
      display: inline;
    }

    .home-logo {
      height: 24px !important;
    }

    .home-user-name {
      display: none !important;
    }

    .home-user-trigger {
      padding: 0 !important;
    }

    .home-system-label {
      font-size: 0.58rem !important;
      letter-spacing: 0.14em !important;
    }

    .home-sub {
      padding: 12px 16px 8px !important;
    }

    .home-sub-text {
      font-size: 0.6rem !important;
      letter-spacing: 0.24em !important;
    }

    .selector-grid {
      grid-template-columns: 1fr !important;
      gap: 10px !important;
      padding: 0 12px 12px !important;
    }

    .selector-grid .panel {
      min-height: 210px;
    }

    .panel-inner {
      padding: 14px 14px !important;
    }

    .home-footer {
      padding: 10px 12px !important;
      justify-content: center !important;
      gap: 8px !important;
    }

    .footer-modules {
      display: none !important;
    }

    .footer-legal {
      order: 2;
      width: 100%;
      text-align: center;
    }

    .footer-right {
      order: 1;
      width: 100%;
      justify-content: center;
    }
  }
`;
