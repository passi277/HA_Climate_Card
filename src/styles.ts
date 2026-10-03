import { css } from "lit";

export const cardStyles = css`
  :host { display: block; }
  ha-card {
    --accent: var(--hcc-accent-c, var(--primary-color));
    --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
    --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
    position: relative; overflow: hidden; padding: 16px; box-sizing: border-box; height: 100%;
    display: flex; flex-direction: column; gap: 14px;
    transition: --hcc-accent-c 0.7s ease, background 0.4s; isolation: isolate;
    font-variant-numeric: tabular-nums;
  }

  /* Hintergrund-Glow: zwei weiche, langsam treibende Farbflächen in der Modusfarbe */
  .glow { position: absolute; inset: 0; pointer-events: none; z-index: -1; overflow: hidden; }
  .blob {
    position: absolute; border-radius: 50%; will-change: transform, opacity;
    transition: opacity 0.8s ease;
  }
  .b1 {
    width: 115%; aspect-ratio: 1; left: -8%; top: -62%;
    background: radial-gradient(closest-side, color-mix(in srgb, var(--accent) 30%, transparent), transparent 72%);
    animation: drift1 18s ease-in-out infinite;
  }
  .b2 {
    width: 80%; aspect-ratio: 1; right: -38%; top: -18%;
    background: radial-gradient(closest-side, color-mix(in srgb, var(--accent) 18%, color-mix(in srgb, #fff 6%, transparent)), transparent 70%);
    animation: drift2 23s ease-in-out infinite;
  }
  ha-card.idle .blob { opacity: 0.55; animation-play-state: paused; }
  ha-card.off .blob, ha-card.unavailable .blob { opacity: 0.25; animation-play-state: paused; }
  ha-card.compact .b1 { width: 80%; left: auto; right: -25%; top: -90%; }
  ha-card.compact .b2 { width: 55%; right: auto; left: -20%; top: 20%; }
  @keyframes drift1 { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(6%, 4%) scale(1.08); } }
  @keyframes drift2 { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(-10%, 8%) scale(0.92); } }
  button { font: inherit; color: inherit; }

  /* Header */
  .header { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .title {
    display: flex; align-items: center; gap: 12px; background: none; border: none; padding: 0;
    cursor: pointer; text-align: left; min-width: 0;
  }
  .icon-badge {
    position: relative; flex: none; width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
    background: color-mix(in srgb, var(--accent) 20%, transparent); color: var(--accent);
  }
  .icon-badge::after {
    content: ""; position: absolute; inset: 0; border-radius: 50%; pointer-events: none;
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 45%, transparent); opacity: 0;
  }
  .icon-badge.active::after { animation: ring 2.6s ease-out infinite; }
  /* Symbole mit Charakter je nach Tätigkeit */
  .icon-badge.active ha-icon { animation: breathe 2.4s ease-in-out infinite; }
  .icon-badge.active[data-action="cooling"] ha-icon,
  .icon-badge.active[data-action="defrosting"] ha-icon { animation: spin 9s linear infinite; }
  .icon-badge.active[data-action="fan"] ha-icon { animation: spin 1.6s linear infinite; }
  .icon-badge.active[data-action="heating"] ha-icon,
  .icon-badge.active[data-action="preheating"] ha-icon { animation: flicker 1.8s ease-in-out infinite; transform-origin: 50% 85%; }
  .icon-badge.active[data-action="drying"] ha-icon { animation: bob 2s ease-in-out infinite; }
  @keyframes ring { 0% { opacity: 1; box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 45%, transparent); }
    100% { opacity: 0; box-shadow: 0 0 0 10px color-mix(in srgb, var(--accent) 0%, transparent); } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes flicker { 0%, 100% { transform: scale(1) rotate(0); } 25% { transform: scale(1.08, 0.95) rotate(-3deg); }
    50% { transform: scale(0.96, 1.07) rotate(2deg); } 75% { transform: scale(1.05, 0.97) rotate(-1deg); } }
  @keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
  .names { display: flex; flex-direction: column; min-width: 0; }
  .name { font-size: 16px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .status { font-size: 13px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .power {
    flex: none; width: 42px; height: 42px; border-radius: 50%; border: none; cursor: pointer;
    background: rgba(127,127,127,0.12); color: var(--secondary-text-color);
    display: flex; align-items: center; justify-content: center;
    transition: background 0.3s, color 0.3s, box-shadow 0.4s, transform 0.2s var(--ease-spring);
  }
  .power:hover { transform: scale(1.06); }
  .power:active { transform: scale(0.92); }
  .power.on { background: var(--accent); color: var(--text-primary-color, #fff);
    box-shadow: 0 4px 14px color-mix(in srgb, var(--accent) 45%, transparent), inset 0 1px 0 rgba(255,255,255,0.25); }
  .power:focus-visible, .title:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

  /* Window banner */
  .banner {
    animation: slide-in 0.45s var(--ease-out) both;
    position: relative; display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; cursor: pointer;
    background: color-mix(in srgb, var(--warning-color, #ff9800) 18%, transparent); color: var(--primary-text-color);
  }
  .banner ha-icon { color: var(--warning-color, #ff9800); flex: none; }
  .banner div { display: flex; flex-direction: column; font-size: 13px; }
  .banner span { color: var(--secondary-text-color); font-size: 12px; }
  .banner div { flex: 1; min-width: 0; }
  .banner.info { cursor: default; background: color-mix(in srgb, var(--info-color, #039be5) 15%, transparent); }
  .banner.info ha-icon { color: var(--info-color, #039be5); }
  .banner.humid { cursor: default; background: color-mix(in srgb, var(--state-climate-dry-color, #00bcd4) 16%, transparent); }
  .banner.humid ha-icon { color: var(--state-climate-dry-color, #00bcd4); }
  .banner-action {
    flex: none; border: none; border-radius: 999px; padding: 6px 12px; font: inherit; font-size: 12px; font-weight: 600; cursor: pointer;
    background: var(--state-climate-dry-color, #00bcd4); color: #fff;
  }
  .hints { position: relative; display: flex; flex-direction: column; gap: 8px; }
  @keyframes slide-in { from { opacity: 0; transform: translateY(-6px) scale(0.98); } to { opacity: 1; transform: none; } }

  /* Ausklappbarer Bereich */
  .collapsible { display: grid; grid-template-rows: 0fr; opacity: 0; margin-top: -14px;
    transition: grid-template-rows 0.45s var(--ease-out), opacity 0.3s ease, margin-top 0.45s var(--ease-out); }
  .collapsible.open { grid-template-rows: 1fr; opacity: 1; margin-top: 0; }
  .collapsible-inner { min-height: 0; overflow: hidden; }
  .collapsible-inner > .controls { padding-top: 2px; padding-bottom: 2px; }
  .expand .chevron { transition: transform 0.35s var(--ease-out); }
  .expand[aria-expanded="true"] .chevron { transform: rotate(180deg); }


  /* Dial */
  .dial-center { display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .dial-label { font-size: 13px; color: var(--secondary-text-color); text-transform: uppercase; letter-spacing: 0.06em; }
  .dial-big { display: inline-block; font-size: clamp(40px, 13vw, 58px); font-weight: 300; line-height: 1; letter-spacing: -0.02em; }
  .dial-big sup, .big sup { font-size: 0.4em; font-weight: 400; vertical-align: top; margin-left: 2px; position: relative; top: 0.25em; }
  .dial-range { font-size: clamp(28px, 9vw, 38px); font-weight: 400; display: flex; gap: 6px; align-items: baseline; }
  .dial-range .sep { color: var(--secondary-text-color); font-size: 0.7em; }
  .dial-sub { display: flex; align-items: center; gap: 4px; font-size: 14px; color: var(--secondary-text-color); margin-top: 4px; }
  .dial-sub ha-icon { --mdc-icon-size: 16px; margin-left: 4px; }
  .dial-steppers { display: flex; justify-content: center; gap: 16px; margin-top: -24px; position: relative; flex-wrap: wrap; }
  .dial-steppers.dual { gap: 8px; margin-top: -8px; }
  hcc-climate-dial { margin-bottom: -16px; }
  .round {
    width: 48px; height: 48px; border-radius: 50%; border: none; cursor: pointer;
    background: color-mix(in srgb, var(--accent) 8%, rgba(127,127,127,0.12)); display: flex; align-items: center; justify-content: center;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), 0 1px 2px rgba(0,0,0,0.06);
    transition: background 0.25s, transform 0.25s var(--ease-spring), box-shadow 0.25s;
  }
  .round:hover { background: color-mix(in srgb, var(--accent) 22%, transparent); transform: translateY(-1px);
    box-shadow: 0 6px 16px color-mix(in srgb, var(--accent) 25%, transparent); }
  .round:active { transform: scale(0.9); transition-duration: 0.08s; }
  .round:focus-visible, .stepper button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

  /* Stepper */
  .stepper {
    display: inline-flex; align-items: center; gap: 4px; padding: 4px; border-radius: 999px;
    background: rgba(127,127,127,0.12);
  }
  .stepper button {
    width: 34px; height: 34px; border-radius: 50%; border: none; cursor: pointer; background: transparent;
    display: flex; align-items: center; justify-content: center; color: var(--accent, var(--primary-text-color));
    transition: background 0.2s, transform 0.25s var(--ease-spring);
  }
  .stepper button:hover { background: color-mix(in srgb, var(--accent, #888) 20%, transparent); }
  .stepper button:active { transform: scale(0.86); transition-duration: 0.08s; }
  .stepper-value { display: inline-block; min-width: 54px; text-align: center; font-size: 18px; font-weight: 600; }
  .stepper-value small { font-size: 11px; font-weight: 400; color: var(--secondary-text-color); margin-left: 1px; }

  /* Controls */
  .controls { position: relative; display: flex; flex-direction: column; gap: 14px; }
  .row-label {
    display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; color: var(--secondary-text-color);
    text-transform: uppercase; letter-spacing: 0.04em;
  }
  .row-label ha-icon { --mdc-icon-size: 16px; }
  .humidity-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .graph-wrap { display: flex; flex-direction: column; gap: 6px; }

  /* Compact */
  .compact-row { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
  .compact-current { display: flex; flex-direction: column; }
  .big { font-size: 34px; font-weight: 300; line-height: 1; }
  .compact-steppers { display: flex; gap: 6px; flex-wrap: wrap; }
  .expand {
    position: relative; align-self: center; display: flex; align-items: center; gap: 2px; border: none; background: none;
    color: var(--secondary-text-color); cursor: pointer; font-size: 12px; padding: 2px 8px; border-radius: 999px; margin: -6px 0;
  }
  .expand:hover { background: rgba(127,127,127,0.12); }

  .warning { padding: 8px; color: var(--error-color, #db4437); }
  ha-card.unavailable { opacity: 0.6; }

  @keyframes breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.12); } }
  @media (prefers-reduced-motion: reduce) {
    .icon-badge.active ha-icon, .icon-badge.active::after, .blob, .banner { animation: none !important; }
    .collapsible, ha-card { transition: none !important; }
  }
`;
