// @ts-nocheck -- a straight port of the classroom page's script (see below); its API is typed in JailScene.tsx.
/**
 * Real-life Four Corners' big screen (docs/JAIL-PLAN.md): the "Four Corners Classroom" page James played with
 * (artifact AsFYTDr4fBKNLQ2puJevxn, source /mnt/project-files/four-corners-room/index.html, 27 Nov 2026 NZ), moved here
 * nearly line for line: the painted map, te reo corner numbers (Tahi Yellow, Rua Red, Toru Blue, Whā Green), the countdown
 * with music that turns hot at 5 s, FREEZE, the dice hopping round the corners, OUT stamp, banner and confetti, settings
 * kept in this browser. Added: the jail list, the big "<name> is back in!" flash with Bella, the late code and End.
 *
 * It draws inside a shadow root so its CSS (written for a page of its own) can't touch the hub's, or the hub's it.
 * The countdown and the dice are only on this screen; nothing about them goes to the server.
 */

const CSS = `/* Layout: a projector screen. The painted map fills the left as a big square; one fat control column on the right.
   Single dark look on purpose (it's thrown onto a classroom wall). */
:host {
  position: fixed; inset: 0; z-index: 50; display: block;
  color-scheme: dark;
  --ink: #fff8ec;
  --ink-soft: #d9cdb8;
  --night: #120f1c;
  --panel: rgba(20, 16, 32, 0.78);
  --panel-edge: rgba(255, 236, 200, 0.16);
  --gold: #ffc83d;
  --gold-deep: #e48a12;
  --red: #ef4444;
  --blue: #3b82f6;
  --green: #22c55e;
  --yellow: #facc15;
  --star: #a855f7;
  --display: "Lilita One", "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif;
  --body: "Nunito", "Segoe UI", system-ui, sans-serif;
}
.wrap {
  position: fixed; inset: 0;
  background: var(--night);
  color: var(--ink);
  font-family: var(--body);
  font-weight: 800;
  overflow: hidden;
}
* { box-sizing: border-box; }
h2, h3, p { margin: 0; }
[hidden] { display: none !important; }
button { font: inherit; color: inherit; cursor: pointer; }
button:focus-visible, input:focus-visible { outline: 4px solid var(--gold); outline-offset: 3px; }

/* ---------- backdrop ---------- */
.backdrop {
  position: fixed; inset: 0; z-index: 0;
  background-size: cover; background-position: center;
  transition: background-image .6s;
  filter: saturate(1.1);
}
.backdrop::after {
  content: ""; position: absolute; inset: 0;
  background:
    radial-gradient(ellipse at 30% 50%, rgba(10, 8, 20, 0.15), rgba(10, 8, 20, 0.7) 75%),
    linear-gradient(180deg, rgba(10, 8, 20, 0.45), rgba(10, 8, 20, 0.2) 30%, rgba(10, 8, 20, 0.55));
}
.danger-glow {
  position: fixed; inset: 0; z-index: 1; pointer-events: none; opacity: 0;
  box-shadow: inset 0 0 18vmin 4vmin rgba(255, 40, 40, 0.75);
}
.danger-glow.on { animation: danger 1s ease-out infinite; }
@keyframes danger { 0% { opacity: 1; } 100% { opacity: 0; } }

.app {
  position: relative; z-index: 2;
  height: 100%;
  display: grid; grid-template-rows: auto 1fr;
  padding-left: max(16px, env(safe-area-inset-left, 0px));
  padding-right: max(16px, env(safe-area-inset-right, 0px));
  padding-block: 10px 14px;
  gap: 10px;
}

/* ---------- top bar ---------- */
.top { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding-left: 52px; }
.logo {
  font-family: var(--display); font-size: clamp(26px, 3.4vw, 46px); line-height: 1; letter-spacing: .5px;
  display: flex; align-items: center; gap: 10px;
  text-shadow: 0 3px 0 #5a2d00, 0 6px 14px rgba(0,0,0,.6);
}
.logo .sq { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; width: 1.05em; height: 1.05em; transform: rotate(-8deg); }
.logo .sq i { border-radius: 4px; box-shadow: inset 0 -3px 0 rgba(0,0,0,.25); }
.logo .sq i:nth-child(1) { background: var(--red); } .logo .sq i:nth-child(2) { background: var(--blue); }
.logo .sq i:nth-child(3) { background: var(--yellow); } .logo .sq i:nth-child(4) { background: var(--green); }
.round-pill {
  font-family: var(--display); font-size: clamp(18px, 2vw, 28px);
  background: var(--gold); color: #3a1d00; padding: 4px 16px; border-radius: 999px;
  box-shadow: 0 4px 0 var(--gold-deep);
}
.top .spacer { flex: 1; }
.icon-btn {
  min-width: 52px; height: 52px; padding: 0 14px; border-radius: 16px;
  background: var(--panel); border: 2px solid var(--panel-edge);
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  font-size: 18px; backdrop-filter: blur(6px);
}
.icon-btn:hover { border-color: var(--gold); }
.icon-btn svg { width: 26px; height: 26px; }
.icon-btn.off { opacity: .55; }

/* ---------- stage ---------- */
.stage { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: clamp(14px, 2vw, 32px); align-items: center; min-height: 0; }
.stage.shake { animation: shake .55s cubic-bezier(.36,.07,.19,.97); }
@keyframes shake {
  10%, 90% { transform: translate(-3px, 2px); } 20%, 80% { transform: translate(6px, -4px); }
  30%, 50%, 70% { transform: translate(-10px, 6px); } 40%, 60% { transform: translate(10px, -6px); }
}
.board {
  position: relative;
  width: min(calc(100dvh - 110px), 60vw);
  aspect-ratio: 1; max-width: 100%;
  border-radius: 28px; overflow: hidden; isolation: isolate; clip-path: inset(0 round 28px);
  box-shadow: 0 0 0 6px rgba(255, 240, 210, .18), 0 24px 60px rgba(0,0,0,.6);
  background: #222;
}
.board > img.map { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.corner {
  position: absolute; width: 50%; height: 50%;
  --cc: var(--red);
  transition: background .15s, box-shadow .15s, opacity .3s;
}
.c0 { left: 0; top: 0; --cc: var(--red); }
.c1 { right: 0; top: 0; --cc: var(--blue); }
.c2 { right: 0; bottom: 0; --cc: var(--green); }
.c3 { left: 0; bottom: 0; --cc: var(--yellow); }
.corner.hop { background: color-mix(in srgb, var(--cc) 55%, transparent); box-shadow: inset 0 0 0 10px #fff, inset 0 0 80px var(--cc); }
.corner.dim { background: rgba(8, 6, 16, .55); }
.corner.hit { animation: hit .42s ease-in-out infinite alternate; }
@keyframes hit {
  from { background: color-mix(in srgb, var(--cc) 35%, transparent); box-shadow: inset 0 0 0 8px var(--cc); }
  to { background: color-mix(in srgb, var(--cc) 75%, #fff 10%); box-shadow: inset 0 0 0 14px #fff, inset 0 0 120px var(--cc); }
}
.corner.lucky { animation: lucky 0.6s ease-in-out infinite alternate; }
@keyframes lucky {
  from { background: rgba(255, 210, 80, .12); box-shadow: inset 0 0 0 6px rgba(255, 220, 120, .6); }
  to { background: rgba(255, 220, 110, .35); box-shadow: inset 0 0 0 12px #fff3c4, inset 0 0 90px var(--gold); }
}
.spot {
  position: absolute; font-family: var(--display); font-size: clamp(14px, 1.8vmin, 26px);
  background: rgba(10, 8, 20, .72); padding: 4px 12px; border-radius: 12px; border: 3px solid var(--cc);
  max-width: 80%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.spot:empty { display: none; }
.c0 .spot, .c1 .spot { top: 30%; } .c2 .spot, .c3 .spot { bottom: 30%; }
.no {
  position: absolute; width: 26%; aspect-ratio: 1; display: grid; place-items: center; border-radius: 26%;
  font-family: var(--display); font-size: clamp(32px, 9vmin, 120px); line-height: 1; color: #fff;
  background: color-mix(in srgb, var(--cc) 88%, #000 12%); border: .07em solid #fff;
  box-shadow: 0 .06em 0 rgba(0,0,0,.35), 0 8px 24px rgba(0,0,0,.5);
  text-shadow: 0 .05em 0 rgba(0,0,0,.35); z-index: 1;
  font-size: clamp(18px, 5.2vmin, 70px); align-content: center; gap: .05em;
}
.no b { font-weight: 400; display: block; }
.no i { font-style: normal; display: block; font-size: .5em; opacity: .85; }
.reo { font-family: var(--display); font-size: clamp(22px, 5vmin, 64px); line-height: 1; color: var(--gold); text-shadow: 0 .05em 0 #5a2d00; margin-top: .1em; text-align: center; max-width: 80%; }
.count.late .reo { color: #ffb0b0; text-shadow: 0 .05em 0 #6b0000; }
.countin { position: relative; display: grid; justify-items: center; }
.c3 .no { color: #3a2400; text-shadow: 0 .04em 0 rgba(255,255,255,.4); }
.c0 .no, .c1 .no { top: 3%; } .c2 .no, .c3 .no { bottom: 3%; }
.c0 .no, .c3 .no { left: 3%; } .c1 .no, .c2 .no { right: 3%; }
.c0 .spot, .c3 .spot { left: 4%; } .c1 .spot, .c2 .spot { right: 4%; }
.stamp, .safe {
  position: absolute; left: 50%; top: 50%; translate: -50% -50%;
  font-family: var(--display); pointer-events: none; opacity: 0;
}
.stamp {
  font-size: clamp(48px, 11vmin, 150px); color: #fff; rotate: -14deg;
  padding: 0 .25em; border: .09em solid #fff; border-radius: .18em;
  background: color-mix(in srgb, var(--cc) 80%, #000 20%);
  text-shadow: 0 .05em 0 rgba(0,0,0,.4);
  box-shadow: 0 10px 40px rgba(0,0,0,.6);
}
.corner.hit .stamp { animation: stamp .5s cubic-bezier(.2, 1.6, .4, 1) forwards; }
@keyframes stamp { 0% { opacity: 0; scale: 3.2; } 100% { opacity: 1; scale: 1; } }
.safe { font-size: clamp(26px, 5vmin, 64px); color: #d9ffe1; text-shadow: 0 4px 0 #0b5d2a, 0 0 24px rgba(0,0,0,.8); }
.corner.dim .safe { animation: fadein .4s .3s forwards; }
.corner.lucky .safe { animation: fadein .4s .3s forwards; color: #fff5c9; text-shadow: 0 4px 0 #8a5a00, 0 0 24px rgba(0,0,0,.8); }
@keyframes fadein { to { opacity: 1; } }

/* centre: countdown, freeze, dice */
.centre { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; }
.centre > * { grid-area: 1 / 1; }
.count { position: relative; width: 46%; aspect-ratio: 1; display: grid; place-items: center; opacity: 0; transition: opacity .25s; }
.count.show { opacity: 1; }
.count svg { position: absolute; inset: 0; width: 100%; height: 100%; rotate: -90deg; filter: drop-shadow(0 6px 18px rgba(0,0,0,.6)); }
.count .disc { fill: rgba(12, 9, 24, .72); }
.count .track { fill: none; stroke: rgba(255,255,255,.18); stroke-width: 7; }
.count .ring { fill: none; stroke: var(--gold); stroke-width: 7; stroke-linecap: round; transition: stroke .3s; }
.count.late .ring { stroke: #ff4b4b; }
.num {
  position: relative; font-family: var(--display); font-variant-numeric: tabular-nums;
  font-size: clamp(80px, 22vmin, 300px); line-height: 1; color: var(--ink);
  text-shadow: 0 .04em 0 #5a2d00, 0 0 .3em rgba(255, 200, 60, .5);
}
.count.late .num { color: #ffd2d2; text-shadow: 0 .04em 0 #6b0000, 0 0 .35em rgba(255, 60, 60, .8); }
.num.beat { animation: beat .5s ease-out; }
@keyframes beat { 0% { scale: 1.45; } 100% { scale: 1; } }
.freeze {
  font-family: var(--display); font-size: clamp(64px, 17vmin, 230px); color: #e8f8ff; opacity: 0;
  text-shadow: 0 .05em 0 #1f5f8a, 0 0 .4em rgba(120, 210, 255, .9);
  -webkit-text-stroke: .02em #0d3550;
}
.freeze.show { animation: freeze 1.3s cubic-bezier(.2, 1.4, .4, 1) forwards; }
@keyframes freeze { 0% { opacity: 0; scale: 3; rotate: 8deg; } 25% { opacity: 1; scale: 1; rotate: -4deg; } 80% { opacity: 1; scale: 1.04; } 100% { opacity: 0; scale: 1.1; } }
.dice { width: 32%; aspect-ratio: 1; opacity: 0; position: relative; }
.dice img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 18px 20px rgba(0,0,0,.55)); }
.dice.show { opacity: 1; }
.dice.tumble img { animation: tumble .32s linear infinite; }
@keyframes tumble {
  0% { transform: translate(-8%, 0) rotate(0) scale(1, 1); }
  25% { transform: translate(6%, -18%) rotate(90deg) scale(.92, 1.08); }
  50% { transform: translate(10%, 0) rotate(180deg) scale(1.1, .9); }
  75% { transform: translate(-4%, -14%) rotate(270deg) scale(.95, 1.05); }
  100% { transform: translate(-8%, 0) rotate(360deg) scale(1, 1); }
}
.dice.landed img { animation: land .6s cubic-bezier(.2, 1.8, .4, 1); }
@keyframes land { 0% { transform: scale(1.7) rotate(-20deg); } 100% { transform: scale(1) rotate(0); } }
.dice .wave {
  position: absolute; inset: 0; border-radius: 50%; border: 10px solid var(--wave, #fff); opacity: 0; pointer-events: none;
}
.dice.landed .wave { animation: wave .9s ease-out; }
.dice.landed .wave:nth-child(3) { animation-delay: .15s; }
@keyframes wave { 0% { opacity: .9; scale: .6; } 100% { opacity: 0; scale: 3.4; } }

/* ---------- side panel ---------- */
.panel {
  align-self: stretch; min-width: 0; min-height: 0;
  display: flex; flex-direction: column; gap: clamp(10px, 1.6vh, 20px); justify-content: center;
}
.status { background: var(--panel); border: 2px solid var(--panel-edge); border-radius: 24px; padding: clamp(14px, 2vh, 24px) 22px; backdrop-filter: blur(8px); }
.status h2 { margin: 0; font-family: var(--display); font-weight: 400; font-size: clamp(30px, 4.6vw, 72px); line-height: 1.02; text-wrap: balance; }
.status p { margin: 8px 0 0; color: var(--ink-soft); font-size: clamp(16px, 1.6vw, 24px); text-wrap: balance; }
.go {
  position: relative; border: 0; border-radius: 28px;
  padding: clamp(18px, 3vh, 34px) 20px;
  font-family: var(--display); font-size: clamp(32px, 4.4vw, 70px); line-height: 1;
  color: #3a1d00; background: linear-gradient(180deg, #ffe07a, var(--gold) 55%, #ffb21f);
  box-shadow: 0 10px 0 var(--gold-deep), 0 18px 40px rgba(0,0,0,.45), inset 0 3px 0 rgba(255,255,255,.6);
  transition: transform .08s, box-shadow .08s;
  display: flex; align-items: center; justify-content: center; gap: 16px;
}
.go:hover { filter: brightness(1.06); }
.go:active { transform: translateY(7px); box-shadow: 0 3px 0 var(--gold-deep), 0 8px 20px rgba(0,0,0,.4), inset 0 3px 0 rgba(255,255,255,.6); }
.go[disabled] { filter: grayscale(.7) brightness(.7); cursor: default; }
.go.roll { color: #fff; background: linear-gradient(180deg, #ff7a7a, #ef4444 55%, #c81e1e); box-shadow: 0 10px 0 #7f1010, 0 18px 40px rgba(0,0,0,.45), inset 0 3px 0 rgba(255,255,255,.45); text-shadow: 0 3px 0 rgba(0,0,0,.3); }
.go.roll:not([disabled]) { animation: throb 1s ease-in-out infinite; }
.go.stop { color: #fff; background: linear-gradient(180deg, #7cc4ff, #3b82f6 55%, #1d4ed8); box-shadow: 0 10px 0 #12307a, 0 18px 40px rgba(0,0,0,.45), inset 0 3px 0 rgba(255,255,255,.45); text-shadow: 0 3px 0 rgba(0,0,0,.3); }
@keyframes throb { 50% { transform: scale(1.04); } }
.go .ico { width: .9em; height: .9em; flex: none; }
.row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.ghost {
  flex: 1; min-height: 56px; border-radius: 18px; background: var(--panel); border: 2px solid var(--panel-edge);
  font-size: clamp(16px, 1.5vw, 22px); padding: 8px 16px; backdrop-filter: blur(6px);
}
.ghost:hover { border-color: var(--gold); }
.ghost[hidden] { display: none !important; }
.timer {
  display: flex; align-items: center; gap: 8px; background: var(--panel); border: 2px solid var(--panel-edge);
  border-radius: 18px; padding: 6px 8px 6px 16px; font-size: clamp(16px, 1.5vw, 22px); backdrop-filter: blur(6px);
}
.timer .lbl { flex: 1; }
.timer output { font-family: var(--display); font-size: 1.5em; min-width: 3.2ch; text-align: center; font-variant-numeric: tabular-nums; }
.step { width: 48px; height: 48px; border-radius: 14px; border: 0; background: rgba(255,255,255,.12); font-size: 28px; line-height: 1; }
.step:hover { background: rgba(255,255,255,.22); }
.history { background: var(--panel); border: 2px solid var(--panel-edge); border-radius: 18px; padding: 12px 16px; backdrop-filter: blur(6px); }
.history h3 { margin: 0 0 8px; font-size: 14px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-soft); }
.pips { display: flex; gap: 6px; flex-wrap: wrap; min-height: 28px; }
.pip { width: 28px; height: 28px; border-radius: 8px; box-shadow: inset 0 -3px 0 rgba(0,0,0,.25); display: grid; place-items: center; font-size: 15px; color: #fff; }
.pip.two { background: linear-gradient(135deg, var(--a) 50%, var(--b) 50%); }
.pips .none { color: var(--ink-soft); font-weight: 600; }
.tally { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 10px; }
.tally div { border-radius: 10px; text-align: center; padding: 4px 0; font-family: var(--display); font-size: 20px; background: color-mix(in srgb, var(--cc) 30%, transparent); border: 2px solid var(--cc); font-variant-numeric: tabular-nums; }
.keys { margin: 0; color: var(--ink-soft); font-size: 14px; font-weight: 600; }
.keys kbd { font-family: var(--body); font-weight: 900; background: rgba(255,255,255,.14); border-radius: 6px; padding: 1px 7px; }

/* ---------- banner + fx ---------- */
.banner {
  position: fixed; left: 50%; bottom: 6vh; z-index: 5; translate: -50% 0;
  font-family: var(--display); font-size: clamp(40px, 8vw, 128px); line-height: 1; white-space: nowrap;
  padding: .15em .6em .2em; border-radius: .3em; pointer-events: none; opacity: 0;
  color: #fff; background: var(--bc, var(--red)); border: .06em solid #fff;
  box-shadow: 0 .08em 0 rgba(0,0,0,.35), 0 20px 60px rgba(0,0,0,.6), 0 0 80px var(--bc, var(--red));
  text-shadow: 0 .05em 0 rgba(0,0,0,.35);
  max-width: calc(100vw - 32px); overflow: hidden; text-overflow: ellipsis;
}
.banner.dark-text { color: #3a2400; text-shadow: 0 .04em 0 rgba(255,255,255,.4); }
.banner.show { animation: banner .7s cubic-bezier(.2, 1.5, .4, 1) forwards, bannerOut .5s ease-in 3.4s forwards; }
@keyframes bannerOut { to { opacity: 0; transform: translateY(40%) scale(.85); } }
@keyframes banner { 0% { opacity: 0; transform: translateY(60%) scale(.6) rotate(-4deg); } 100% { opacity: 1; transform: none; } }
#fx { position: fixed; inset: 0; z-index: 6; pointer-events: none; width: 100%; height: 100%; }
.flash { position: fixed; inset: 0; z-index: 4; pointer-events: none; background: #fff; opacity: 0; }
.flash.go-flash { animation: flash .5s ease-out; }
@keyframes flash { 0% { opacity: .75; } 100% { opacity: 0; } }

/* ---------- settings ---------- */
.sheet-back { position: fixed; inset: 0; z-index: 10; background: rgba(5, 4, 12, .66); display: grid; place-items: center; padding: 16px; }
.sheet {
  width: min(880px, 100%); max-height: calc(100dvh - 32px); overflow: auto;
  background: #1d1830; border: 2px solid var(--panel-edge); border-radius: 26px; padding: 22px 24px 26px;
  box-shadow: 0 30px 80px rgba(0,0,0,.6);
  display: grid; gap: 20px;
}
.sheet header { display: flex; align-items: center; gap: 12px; }
.sheet h2 { margin: 0; flex: 1; font-family: var(--display); font-weight: 400; font-size: 34px; }
.sheet h3 { margin: 0 0 10px; font-size: 14px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-soft); }
.maps { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.map-pick { border: 4px solid transparent; border-radius: 18px; overflow: hidden; padding: 0; background: #000; position: relative; }
.map-pick img { display: block; width: 100%; aspect-ratio: 1; object-fit: cover; }
.map-pick span { position: absolute; left: 0; right: 0; bottom: 0; padding: 6px; font-family: var(--display); font-size: 20px; background: linear-gradient(transparent, rgba(0,0,0,.8)); }
.map-pick[aria-pressed="true"] { border-color: var(--gold); box-shadow: 0 0 0 3px rgba(255,200,61,.35); }
.opts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 22px; }
.opt { display: flex; align-items: center; gap: 12px; font-size: 18px; min-height: 44px; }
.opt small { display: block; color: var(--ink-soft); font-weight: 600; font-size: 14px; }
.opt input[type="checkbox"] { width: 28px; height: 28px; accent-color: var(--gold); flex: none; }
.opt input[type="range"] { flex: 1; accent-color: var(--gold); }
.spots { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.spots label { display: flex; align-items: center; gap: 10px; font-size: 16px; }
.spots .sw { width: 26px; height: 26px; border-radius: 8px; flex: none; }
.spots input { flex: 1; min-width: 0; height: 44px; border-radius: 12px; border: 2px solid var(--panel-edge); background: #0f0c1c; color: var(--ink); padding: 0 12px; font: inherit; font-weight: 700; }
.sheet .done { justify-self: end; font-size: 26px; padding: 14px 34px; }
.danger-btn { background: transparent; border: 2px solid rgba(255,120,120,.5); color: #ffc1c1; border-radius: 14px; padding: 10px 16px; font-size: 16px; }
.note { color: var(--ink-soft); font-weight: 600; font-size: 14px; margin: 0; }

.start-veil { position: fixed; inset: 0; z-index: 9; display: grid; place-items: center; background: rgba(8, 6, 16, .5); }
.start-card { text-align: center; display: grid; gap: 14px; justify-items: center; padding: 16px; }
.start-card h1 { margin: 0; font-family: var(--display); font-weight: 400; font-size: clamp(54px, 10vw, 150px); line-height: .95; text-shadow: 0 6px 0 #5a2d00, 0 14px 40px rgba(0,0,0,.7); }
.start-card p { margin: 0; font-size: clamp(18px, 2vw, 28px); color: var(--ink); text-shadow: 0 2px 10px #000; max-width: 34ch; }

@media (max-width: 900px), (max-aspect-ratio: 1/1) {
  .wrap { overflow: auto; }
  .app { height: auto; min-height: 100%; }
  .stage { grid-template-columns: minmax(0, 1fr); }
  .board { width: min(100%, 70dvh); justify-self: center; }
  .maps { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .opts, .spots { grid-template-columns: minmax(0, 1fr); }
  .banner { white-space: normal; text-align: center; width: max-content; }
}
@media (prefers-reduced-motion: reduce) {
  .stage.shake, .go.roll:not([disabled]), .danger-glow.on { animation: none; }
  .dice.tumble img { animation-duration: 1.2s; }
}

/* ---------- Real-life Four Corners: jail list, back in, code, end ---------- */
.code-pill { font-family: var(--display); font-size: clamp(16px, 1.7vw, 24px); background: var(--panel); border: 2px solid rgba(255, 213, 74, .7); color: #fff6c9; padding: 6px 14px; border-radius: 999px; }
.code-pill b { color: var(--gold); letter-spacing: .12em; margin-left: 4px; font-weight: 400; }
.icon-btn.end { border-color: rgba(255,120,120,.55); color: #ffd0d0; }
.jail { background: var(--panel); border: 2px solid var(--panel-edge); border-radius: 18px; padding: 12px 16px; backdrop-filter: blur(6px); min-height: 0; display: flex; flex-direction: column; }
.jail h3 { margin: 0 0 8px; font-size: 14px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-soft); display: flex; gap: 8px; align-items: center; }
.jail h3 .n { font-family: var(--display); font-size: 22px; letter-spacing: 0; color: #fff; background: #b3263e; border-radius: 999px; min-width: 1.6em; text-align: center; padding: 0 .3em; }
.jail h3 .backs { margin-left: auto; letter-spacing: 0; text-transform: none; font-size: 15px; color: #c9ffd8; }
.jail ul { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; overflow: auto; max-height: 22vh; }
.jail li { font-family: var(--display); font-size: clamp(16px, 1.7vw, 26px); padding: 2px 12px 3px; border-radius: 12px; background: rgba(179, 38, 62, .35); border: 2px solid rgba(255, 120, 120, .6); }
.jail li button { all: unset; cursor: pointer; }
.jail li.new { animation: jailin .6s cubic-bezier(.2, 1.6, .4, 1); }
@keyframes jailin { 0% { scale: 1.8; opacity: 0; } 100% { scale: 1; opacity: 1; } }
.jail .empty { color: var(--ink-soft); font-weight: 600; font-size: clamp(14px, 1.3vw, 19px); }
.jail .how { margin: 8px 0 0; color: var(--ink-soft); font-weight: 600; font-size: clamp(13px, 1.2vw, 17px); }
.history.small .tally { display: none; }
.panel > .jail { flex: none; }
.panel > .history { flex: 0 1 auto; min-height: 0; overflow: hidden; }
.panel > .row .timer { flex: 1 1 auto; }
.panel > .row .ghost { flex: 1 1 12em; }
@media (max-height: 820px) {
  .keys { display: none; }
  .status h2 { font-size: clamp(26px, 3.6vw, 56px); }
  .go { padding-block: clamp(14px, 2.2vh, 26px); }
}
.backin { position: fixed; inset: 0; z-index: 8; display: grid; place-items: center; pointer-events: none; }
.backin .card {
  text-align: center; padding: .3em .8em .4em; border-radius: .35em; font-family: var(--display); line-height: 1;
  background: linear-gradient(180deg, #4ade80, #16a34a); border: .06em solid #fff; color: #fff;
  box-shadow: 0 .08em 0 rgba(0,0,0,.35), 0 20px 70px rgba(0,0,0,.6), 0 0 120px #22c55e;
  text-shadow: 0 .05em 0 rgba(0,0,0,.35); max-width: calc(100vw - 32px);
  animation: backin 4.2s cubic-bezier(.2, 1.5, .4, 1) forwards;
}
.backin .who { display: block; font-size: clamp(60px, 13vw, 220px); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.backin .says { display: block; font-size: clamp(30px, 5vw, 84px); margin-top: .1em; color: #f0fff4; }
.backin .card.flashing { animation: backin 4.2s cubic-bezier(.2, 1.5, .4, 1) forwards, backflash .35s steps(2) 6; }
@keyframes backin { 0% { opacity: 0; transform: scale(.3) rotate(-6deg); } 12% { opacity: 1; transform: scale(1.06) rotate(2deg); } 18% { transform: none; } 88% { opacity: 1; transform: none; } 100% { opacity: 0; transform: scale(1.1); } }
@keyframes backflash { 50% { filter: brightness(1.5) saturate(1.3); } }
.over { position: fixed; inset: 0; z-index: 9; display: grid; place-items: center; background: rgba(8, 6, 16, .72); }
.over .start-card h1 { font-size: clamp(48px, 8vw, 120px); }
.over ol { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; max-width: 80vw; }
.over li { font-family: var(--display); font-size: clamp(18px, 2vw, 30px); background: rgba(34, 197, 94, .3); border: 2px solid #4ade80; border-radius: 12px; padding: 2px 12px; }
@media (prefers-reduced-motion: reduce) { .backin .card.flashing { animation: backin 4.2s ease forwards; } }
`;

const HTML = `<div class="wrap">
<div class="backdrop" id="backdrop"></div>
<div class="danger-glow" id="danger"></div>
<div class="flash" id="flash"></div>

<div class="app">
  <div class="top">
    <div class="logo"><span class="sq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>Four Corners</div>
    <span class="code-pill" id="codePill" hidden>Code <b id="code"></b></span>
    <div class="round-pill" id="roundPill">Round 1</div>
    <div class="spacer"></div>
    <button class="icon-btn" id="mapBtn" title="Change map (S)"><span id="mapName">Jungle</span></button>
    <button class="icon-btn" id="soundBtn" title="Sound on or off (M)" aria-label="Sound on or off">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z"/><path id="soundWaves" d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>
    </button>
    <button class="icon-btn" id="setBtn" title="Settings (S)" aria-label="Settings">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>
    </button>
    <button class="icon-btn end" id="endBtn" title="End the game">End</button>
    <button class="icon-btn" id="fsBtn" title="Full screen (F)" aria-label="Full screen">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>
    </button>
  </div>

  <main class="stage" id="stage">
    <div class="board" id="board">
      <img class="map" id="mapImg" alt="The four corners map">
      <div class="corner c0" data-c="0"><span class="no"></span><span class="spot"></span><span class="safe">SAFE</span><span class="stamp">OUT!</span></div>
      <div class="corner c1" data-c="1"><span class="no"></span><span class="spot"></span><span class="safe">SAFE</span><span class="stamp">OUT!</span></div>
      <div class="corner c2" data-c="2"><span class="no"></span><span class="spot"></span><span class="safe">SAFE</span><span class="stamp">OUT!</span></div>
      <div class="corner c3" data-c="3"><span class="no"></span><span class="spot"></span><span class="safe">SAFE</span><span class="stamp">OUT!</span></div>
      <div class="centre">
        <div class="count" id="count">
          <svg viewBox="0 0 100 100" aria-hidden="true"><circle class="disc" cx="50" cy="50" r="46"/><circle class="track" cx="50" cy="50" r="45"/><circle class="ring" id="ring" cx="50" cy="50" r="45" pathLength="100" stroke-dasharray="100" stroke-dashoffset="0"/></svg>
          <div class="countin"><div class="num" id="num">10</div><div class="reo" id="reo">tekau</div></div>
        </div>
        <div class="freeze" id="freeze">FREEZE!</div>
        <div class="dice" id="dice"><img id="diceImg" alt=""><span class="wave"></span><span class="wave"></span></div>
      </div>
    </div>

    <aside class="panel">
      <div class="status">
        <h2 id="msg">Ready to play?</h2>
        <p id="sub">Start the countdown, then everyone runs to a corner.</p>
      </div>
      <button class="go" id="go"></button>
      <div class="row">
        <button class="ghost" id="rollNow">Roll now, no countdown</button>
        <div class="timer">
          <span class="lbl">Countdown</span>
          <button class="step" id="minus" aria-label="Shorter countdown">−</button>
          <output id="secs">10 s</output>
          <button class="step" id="plus" aria-label="Longer countdown">+</button>
        </div>
      </div>
      <div class="jail" aria-live="polite">
        <h3>In jail <span class="n" id="jailN">0</span><span class="backs" id="backs"></span></h3>
        <ul id="jailList"></ul>
        <p class="how" id="jailHow"></p>
      </div>
      <div class="history small">
        <h3>The dice so far</h3>
        <div class="pips" id="pips"></div>
        <div class="tally" id="tally"></div>
      </div>
      <p class="keys"><kbd>Space</kbd> next step · <kbd>R</kbd> roll · <kbd>S</kbd> settings · <kbd>M</kbd> sound · <kbd>F</kbd> full screen</p>
    </aside>
  </main>
</div>

<div class="banner" id="banner"></div>
<div class="backin" id="backin"></div>
<canvas id="fx"></canvas>

<div class="start-veil" id="veil">
  <div class="start-card">
    <h1>Four Corners</h1>
    <p>Kids run to a corner while the clock counts down. Then the dice picks a corner, and everyone in it is out. Out? Tap your name on a jail station iPad and answer questions to get back in!</p>
    <button class="go" id="enter" style="padding-inline:48px">Let's play</button>
  </div>
</div>

<div class="sheet-back" id="sheetBack" hidden>
  <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="setTitle">
    <header><h2 id="setTitle">Settings</h2><button class="icon-btn" id="closeSet" aria-label="Close settings">✕</button></header>
    <section>
      <h3>Map</h3>
      <div class="maps" id="maps"></div>
    </section>
    <section>
      <h3>Countdown and dice</h3>
      <div class="opts">
        <label class="opt" for="optSecs"><span style="min-width:9ch">Countdown<small id="optSecsVal">10 seconds</small></span><input type="range" id="optSecs" min="3" max="30" step="1"></label>
        <label class="opt" for="optAuto"><input type="checkbox" id="optAuto"><span>Roll by itself<small>The dice rolls as soon as the countdown ends</small></span></label>
        <label class="opt" for="optTwists"><input type="checkbox" id="optTwists"><span>Twists<small>Sometimes two corners are out, sometimes a lucky star saves everyone</small></span></label>
        <label class="opt" for="optRepeat"><input type="checkbox" id="optRepeat"><span>No repeats<small>The same corner can't come up twice in a row</small></span></label>
      </div>
    </section>
    <section>
      <h3>Sound</h3>
      <div class="opts">
        <label class="opt" for="optMusic"><input type="checkbox" id="optMusic"><span>Music during the countdown</span></label>
        <label class="opt" for="optVoice"><input type="checkbox" id="optVoice"><span>Bella reads it out</span></label>
        <label class="opt" for="optFx"><input type="checkbox" id="optFx"><span>Ticks, drumroll and boom</span></label>
        <label class="opt" for="optVol"><span style="min-width:9ch">Volume</span><input type="range" id="optVol" min="0" max="100" step="5"></label>
      </div>
    </section>
    <section>
      <h3>Where is each corner in your room? (optional)</h3>
      <div class="spots">
        <label for="spot0"><span class="sw" style="background:var(--red)"></span><input id="spot0" maxlength="24" placeholder="Rua (2) Red: e.g. by the door"></label>
        <label for="spot1"><span class="sw" style="background:var(--blue)"></span><input id="spot1" maxlength="24" placeholder="Toru (3) Blue: e.g. by the sink"></label>
        <label for="spot3"><span class="sw" style="background:var(--yellow)"></span><input id="spot3" maxlength="24" placeholder="Tahi (1) Yellow: e.g. reading corner"></label>
        <label for="spot2"><span class="sw" style="background:var(--green)"></span><input id="spot2" maxlength="24" placeholder="Whā (4) Green: e.g. by the window"></label>
      </div>
    </section>
    <div class="row" style="justify-content:space-between">
      <button class="danger-btn" id="resetBtn">New game (clear rounds)</button>
      <button class="go done" id="doneSet">Done</button>
    </div>
  </div>
</div>
<div class="over" id="over" hidden><div class="start-card"><h1>Game over!</h1><p id="overSay"></p><ol id="overList"></ol><button class="go" id="again" style="padding-inline:40px">Back to Class Live</button></div></div>
</div>`;

const FONTS = 'https://fonts.googleapis.com/css2?family=Lilita+One&family=Nunito:wght@600;800;900&display=swap';

export function mountJailStage(host, opts) {
  if (!document.querySelector(`link[href="${FONTS}"]`)) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = FONTS;
    document.head.appendChild(l);
  }
  const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${CSS}</style>${HTML}`;
  'use strict';
  const $ = (id) => root.getElementById(id);
  const MAPS = [
    { id: 'jungle', name: 'Jungle' },
    { id: 'snow', name: 'Snow' },
    { id: 'castle', name: 'Castle' },
    { id: 'space', name: 'Space' },
  ];
  const NAMES = ['Red', 'Blue', 'Green', 'Yellow'];
  const COLOURS = ['#ef4444', '#3b82f6', '#22c55e', '#facc15'];
  const FACE = ['red', 'blue', 'green', 'yellow'];
  const NUM = [2, 3, 4, 1]; // James: Yellow 1, Red 2, Blue 3, Green 4
  const BY_NUM = [3, 0, 1, 2];
  const REO = ['', 'tahi', 'rua', 'toru', 'whā', 'rima', 'ono', 'whitu', 'waru', 'iwa', 'tekau'];
  const reo = (n) => n <= 10 ? REO[n] : n < 20 ? 'tekau mā ' + REO[n - 10] : REO[Math.floor(n / 10)] + ' tekau' + (n % 10 ? ' mā ' + REO[n % 10] : '');
  const Cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);
  const CN = (c) => Cap(REO[NUM[c]]); // corner name in te reo: Tahi, Rua, Toru, Whā
  const A = (f) => opts.asset(f);

  // ---------- settings (kept in this browser only) ----------
  const DEF = { map: 'jungle', secs: 10, auto: false, twists: false, noRepeat: false, music: true, voice: true, fx: true, vol: 80, muted: false, spots: ['', '', '', ''] };
  let S = { ...DEF };
  try { S = { ...DEF, ...JSON.parse(localStorage.getItem('fc-room') || '{}') }; } catch (e) {}
  if (!Array.isArray(S.spots) || S.spots.length !== 4) S.spots = ['', '', '', ''];
  if (opts.map) S.map = opts.map;
  const save = () => { try { localStorage.setItem('fc-room', JSON.stringify(S)); } catch (e) {} };

  // ---------- game state ----------
  let phase = 'ready'; // ready | count | freeze | rolling | result
  let round = 1;
  let history = []; // {rolled:[c], lucky}
  let countEnd = 0, countDur = 0, lastShown = -1, raf = 0, hotOn = false, hurrySaid = false;
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
  const clearTimers = () => { timers.forEach(clearTimeout); timers.clear(); };
  const rnd = (n) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
  const pick = (arr) => arr[rnd(arr.length)];

  // ---------- audio ----------
  let ctx = null, master = null, noise = null;
  function audio() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain(); master.connect(ctx.destination);
        const len = ctx.sampleRate * 1.5; noise = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { ctx = null; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    if (master) master.gain.value = S.muted ? 0 : (S.vol / 100) * 0.9;
    return ctx;
  }
  const fxOn = () => S.fx && !S.muted && audio();
  function osc(f, at, dur, type, peak, to, attack = 0.01) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, at);
    if (to) o.frequency.exponentialRampToValueAtTime(to, at + dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + Math.min(attack, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(master); o.start(at); o.stop(at + dur + 0.05);
  }
  function hiss(at, dur, f1, f2, peak, type = 'bandpass', q = 1, attack = 0.01) {
    const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(f1, at); fl.frequency.exponentialRampToValueAtTime(f2, at + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + Math.max(0.005, Math.min(attack, dur / 2)));
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    s.connect(fl).connect(g).connect(master); s.start(at); s.stop(at + dur + 0.05);
  }
  const SFX = {
    tick(last) {
      if (!fxOn()) return; const t = ctx.currentTime;
      const f = last ? 1320 : 880;
      osc(f, t, last ? 0.32 : 0.16, 'sine', last ? 0.5 : 0.32);
      osc(f * 2, t, 0.06, 'triangle', 0.12);
      hiss(t, 0.04, 4000, 3000, 0.12, 'bandpass', 4);
    },
    whoosh() {
      if (!fxOn()) return; const t = ctx.currentTime;
      hiss(t, 0.7, 300, 6000, 0.25, 'bandpass', 1.5, 0.4);
      [0, 4, 7, 12].forEach((s, i) => osc(523.25 * 2 ** (s / 12), t + 0.08 * i, 0.35, 'triangle', 0.18));
    },
    freeze() {
      if (!fxOn()) return; const t = ctx.currentTime;
      osc(150, t, 0.7, 'sawtooth', 0.22, 120); osc(155, t, 0.7, 'square', 0.12, 118);
      hiss(t, 0.5, 8000, 2000, 0.18, 'highpass', 1);
      [1, 2.76, 5.4].forEach((m, i) => osc(1400 * m, t + 0.02, 1.2 - i * 0.3, 'sine', 0.08 / (i + 1)));
    },
    clack(i) {
      if (!fxOn()) return; const t = ctx.currentTime;
      const f = 620 * (1 + (i % 3) * 0.18);
      osc(f, t, 0.09, 'triangle', 0.4, f * 0.7); osc(f * 2.4, t, 0.04, 'sine', 0.12);
      hiss(t, 0.05, 2600, 1200, 0.1, 'bandpass', 3);
    },
    drumroll(dur) {
      if (!fxOn()) return; const t = ctx.currentTime;
      let at = 0, i = 0;
      while (at < dur) {
        const k = at / dur;
        hiss(t + at, 0.07, 4000, 2000, 0.06 + k * 0.22, 'bandpass', 1.2, 0.004);
        osc(180 - k * 40, t + at, 0.06, 'triangle', 0.04 + k * 0.1);
        at += 1 / (16 + k * 22) + (i++ % 2 ? 0.004 : 0);
      }
      hiss(t, dur, 120, 400, 0.2, 'lowpass', 1, dur * 0.8);
    },
    boom() {
      if (!fxOn()) return; const t = ctx.currentTime;
      osc(110, t, 1.3, 'sine', 0.7, 36); osc(70, t, 0.9, 'sawtooth', 0.14, 40);
      hiss(t, 1.6, 7000, 900, 0.32, 'highpass', 1, 0.005); hiss(t, 1.2, 400, 90, 0.35, 'lowpass', 1, 0.01);
      [0, 4, 7, 12].forEach((s, i) => { osc(392 * 2 ** (s / 12), t + 0.06 + i * 0.07, 0.9, 'triangle', 0.16); osc(392 * 2 ** ((s + 12) / 12), t + 0.06 + i * 0.07, 0.5, 'sine', 0.06); });
    },
    wah() {
      if (!fxOn()) return; const t = ctx.currentTime + 0.5;
      [392, 370, 349, 311].forEach((f, i) => osc(f, t + i * 0.32, i === 3 ? 0.9 : 0.3, 'sawtooth', 0.12, i === 3 ? f * 0.85 : f));
    },
    sparkle() {
      if (!fxOn()) return; const t = ctx.currentTime;
      [0, 4, 7, 11, 12, 16, 19, 24].forEach((s, i) => osc(523.25 * 2 ** (s / 12), t + i * 0.06, 0.6, 'sine', 0.18));
      hiss(t, 1.2, 5000, 11000, 0.06, 'highpass', 1, 0.4);
    },
  };

  // music: one normal and one "hot" track per map, cross-faded near the end of the countdown
  const music = { a: new Audio(), b: new Audio(), fade: 0 };
  music.a.loop = music.b.loop = true; music.a.preload = music.b.preload = 'auto';
  function loadMusic() { music.a.src = A(`corners-${S.map}.mp3`); music.b.src = A(`corners-${S.map}-hot.mp3`); }
  const musicVol = () => (S.muted || !S.music ? 0 : (S.vol / 100) * 0.55);
  function fadeTo(el, target, ms, then) {
    const from = el.volume, start = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - start) / ms);
      el.volume = Math.max(0, Math.min(1, from + (target - from) * k));
      if (k < 1) requestAnimationFrame(step); else if (then) then();
    };
    requestAnimationFrame(step);
  }
  function musicStart() {
    if (!musicVol()) return;
    const a = music.a;
    try { a.currentTime = a.duration ? rnd(Math.max(1, Math.floor(a.duration - 20))) : 0; } catch (e) {}
    a.volume = 0; a.play().catch(() => {}); fadeTo(a, musicVol(), 600);
  }
  function musicHot() {
    if (!musicVol()) return;
    const b = music.b;
    try { b.currentTime = b.duration ? rnd(Math.max(1, Math.floor(b.duration - 20))) : 0; } catch (e) {}
    b.volume = 0; b.play().catch(() => {});
    fadeTo(b, musicVol(), 500); fadeTo(music.a, 0, 500, () => music.a.pause());
  }
  function musicStop(ms = 250) {
    [music.a, music.b].forEach((el) => { if (!el.paused) fadeTo(el, 0, ms, () => el.pause()); });
  }

  // Bella's lines
  let voiceEl = null;
  function say(name, delay = 0) {
    if (!S.voice || S.muted) return;
    later(() => {
      try { if (voiceEl) voiceEl.pause(); voiceEl = new Audio(opts.voice(name)); voiceEl.volume = Math.min(1, S.vol / 100); voiceEl.play().catch(() => {}); } catch (e) {}
    }, delay);
  }

  // ---------- visuals ----------
  const board = $('board'), corners = [...root.querySelectorAll('.corner')];
  const goBtn = $('go'), rollNow = $('rollNow'), msg = $('msg'), sub = $('sub');
  const countEl = $('count'), num = $('num'), ring = $('ring'), freezeEl = $('freeze');
  const dice = $('dice'), diceImg = $('diceImg'), banner = $('banner');
  const ICON_PLAY = '<svg class="ico" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z"/></svg>';
  const ICON_DICE = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.6" fill="currentColor"/><circle cx="16" cy="16" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/></svg>';

  // preload pictures
  const faces = {}; [...FACE, 'star'].forEach((k) => { const i = new Image(); i.src = A(`dice-${k}.webp`); faces[k] = i.src; });
  MAPS.forEach((m) => { new Image().src = A(`map-${m.id}.webp`); });

  function applyMap() {
    const m = MAPS.find((x) => x.id === S.map) || MAPS[0];
    $('mapImg').src = A(`map-${m.id}.webp`);
    $('backdrop').style.backgroundImage = `url("${A(`back-${m.id}.webp`)}")`;
    $('mapName').textContent = m.name + ' map';
    loadMusic();
    root.querySelectorAll('.map-pick').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.map === m.id)));
  }
  corners.forEach((el, i) => { el.querySelector('.no').innerHTML = `<b>${CN(i)}</b><i>${NUM[i]}</i>`; });
  function applySpots() { corners.forEach((el, i) => { el.querySelector('.spot').textContent = S.spots[i] || ''; }); }
  function applySecs() { $('secs').textContent = S.secs + ' s'; $('optSecs').value = S.secs; $('optSecsVal').textContent = S.secs + ' seconds'; }
  function applySound() {
    $('soundBtn').classList.toggle('off', S.muted);
    $('soundWaves').style.display = S.muted ? 'none' : '';
    if (master) master.gain.value = S.muted ? 0 : (S.vol / 100) * 0.9;
    [music.a, music.b].forEach((el) => { if (!el.paused) el.volume = musicVol(); });
    if (S.muted || !S.music) musicStop(150);
  }
  function clearBoard() {
    corners.forEach((el) => el.classList.remove('hop', 'dim', 'hit', 'lucky'));
    dice.className = 'dice'; banner.className = 'banner'; freezeEl.className = 'freeze';
    countEl.classList.remove('show', 'late'); $('danger').classList.remove('on');
  }
  function renderHistory() {
    const pips = $('pips'); pips.innerHTML = '';
    if (!history.length) pips.innerHTML = '<span class="none">No rolls yet</span>';
    history.slice(-24).forEach((h) => {
      const p = document.createElement('span'); p.className = 'pip';
      if (h.lucky) { p.style.background = 'var(--star)'; p.textContent = '★'; p.title = 'Lucky roll'; }
      else if (h.rolled.length > 1) { p.classList.add('two'); p.style.setProperty('--a', COLOURS[h.rolled[0]]); p.style.setProperty('--b', COLOURS[h.rolled[1]]); p.textContent = ''; p.title = h.rolled.map((c) => NAMES[c]).join(' and '); }
      else { p.style.background = COLOURS[h.rolled[0]]; p.textContent = NUM[h.rolled[0]]; if (h.rolled[0] === 3) p.style.color = '#3a2400'; p.title = NAMES[h.rolled[0]]; }
      pips.appendChild(p);
    });
    const counts = [0, 0, 0, 0]; history.forEach((h) => h.rolled.forEach((c) => counts[c]++));
    $('tally').innerHTML = BY_NUM.map((i) => `<div style="--cc:${COLOURS[i]}" title="${CN(i)} (${NUM[i]}, ${NAMES[i]}) out ${counts[i]} times">${CN(i)}: ${counts[i]}</div>`).join('');
    $('roundPill').textContent = 'Round ' + round;
  }
  function setUI() {
    goBtn.disabled = false; goBtn.className = 'go';
    rollNow.hidden = !(phase === 'ready' || phase === 'result');
    if (phase === 'ready') {
      goBtn.innerHTML = ICON_PLAY + 'Start countdown';
      msg.textContent = round === 1 && !history.length ? 'Ready to play?' : 'Round ' + round;
      sub.textContent = `Everyone gets ${S.secs} seconds to reach a corner.`;
    } else if (phase === 'count') {
      goBtn.className = 'go stop'; goBtn.textContent = 'Freeze now';
      msg.textContent = 'Run to a corner!'; sub.textContent = 'Pick a corner before the clock hits zero.';
    } else if (phase === 'freeze') {
      goBtn.className = 'go roll'; goBtn.innerHTML = ICON_DICE + 'Roll the dice!';
      msg.textContent = 'Freeze!'; sub.textContent = S.auto ? 'The dice is about to roll…' : 'Nobody move. Anyone not in a corner is out.';
      if (S.auto) goBtn.disabled = true;
    } else if (phase === 'rolling') {
      goBtn.className = 'go roll'; goBtn.disabled = true; goBtn.innerHTML = ICON_DICE + 'Rolling…';
      msg.textContent = 'Which corner?'; sub.textContent = 'Fingers crossed…';
    } else if (phase === 'result') {
      goBtn.innerHTML = ICON_PLAY + 'Next round';
    }
  }

  // ---------- countdown ----------
  function startCountdown() {
    clearTimers(); clearBoard(); audio();
    if (phase === 'result') round++;
    phase = 'count'; renderHistory(); setUI();
    countDur = S.secs * 1000; countEnd = performance.now() + countDur; lastShown = -1; hotOn = false; hurrySaid = false;
    countEl.classList.add('show');
    SFX.whoosh(); musicStart();
    say(pick(['go-go-go-find-a-corner', 'run-to-a-corner', 'quick-pick-a-corner', round === 1 ? 'four-corners-is-on-pick-a-corner-and-run' : 'get-to-a-corner-now']), 150);
    try { navigator.wakeLock && navigator.wakeLock.request('screen').catch(() => {}); } catch (e) {}
    cancelAnimationFrame(raf); raf = requestAnimationFrame(tickLoop);
  }
  function tickLoop(now) {
    if (phase !== 'count') return;
    const left = Math.max(0, countEnd - now);
    ring.setAttribute('stroke-dashoffset', String(100 - (left / countDur) * 100));
    const shown = Math.ceil(left / 1000);
    if (shown !== lastShown) {
      lastShown = shown;
      if (shown > 0) {
        num.textContent = shown; $('reo').textContent = reo(shown);
        num.classList.remove('beat'); void num.offsetWidth; num.classList.add('beat');
        const late = shown <= 3;
        countEl.classList.toggle('late', late); $('danger').classList.toggle('on', late);
        if (shown < Math.ceil(countDur / 1000)) SFX.tick(late);
        if (shown === 5 && countDur >= 8000 && !hurrySaid) { hurrySaid = true; say('hurry-hurry-nearly-out-of-time'); }
      }
      if (shown <= 5 && !hotOn && countDur >= 8000) { hotOn = true; musicHot(); }
    }
    if (left <= 0) return doFreeze();
    raf = requestAnimationFrame(tickLoop);
  }
  function doFreeze() {
    cancelAnimationFrame(raf);
    phase = 'freeze';
    countEl.classList.remove('show', 'late'); $('danger').classList.remove('on');
    musicStop(180); SFX.freeze();
    freezeEl.className = 'freeze'; void freezeEl.offsetWidth; freezeEl.classList.add('show');
    flash();
    setUI();
    if (S.auto) later(roll, 1500); else say('time-to-roll-the-dice', 700);
  }

  // ---------- the roll ----------
  function chooseOutcome() {
    const last = history.length ? history[history.length - 1] : null;
    if (S.twists && history.length >= 1) {
      const r = rnd(100);
      if (r < 10) return { lucky: true, rolled: [] };
      if (r < 22) {
        const a = rnd(4); let b = rnd(3); if (b >= a) b++;
        return { lucky: false, rolled: [a, b] };
      }
    }
    let pool = [0, 1, 2, 3];
    if (S.noRepeat && last && last.rolled.length === 1) pool = pool.filter((c) => c !== last.rolled[0]);
    return { lucky: false, rolled: [pick(pool)] };
  }
  function roll() {
    if (phase === 'rolling') return;
    clearTimers(); clearBoard(); audio(); musicStop(150);
    if (phase === 'result') round++;
    phase = 'rolling'; renderHistory(); setUI();
    const out = chooseOutcome();
    say('the-dice-is-rolling');
    const total = 3000;
    SFX.drumroll(total / 1000);
    dice.className = 'dice show tumble';
    // corner hops slow down around the board (clockwise), landing on the chosen corner
    const order = [0, 1, 2, 3];
    const finalCorner = out.lucky ? rnd(4) : out.rolled[0];
    let hops = 14 + rnd(4);
    // make the last hop land on finalCorner
    let start = (finalCorner - (hops % 4) + 4 * 10) % 4;
    let t = 0;
    for (let i = 0; i <= hops; i++) {
      const k = i / hops;
      const c = order[(start + i) % 4];
      const face = out.lucky && i === hops ? 'star' : FACE[c];
      later(() => {
        corners.forEach((el) => el.classList.remove('hop'));
        if (!(out.lucky && i === hops)) corners[c].classList.add('hop');
        diceImg.src = faces[face];
        SFX.clack(i);
      }, t);
      t += 70 + Math.pow(k, 2.4) * 380;
    }
    later(() => land(out), t + 60);
  }
  function land(out) {
    corners.forEach((el) => el.classList.remove('hop'));
    dice.className = 'dice show landed';
    const colour = out.lucky ? '#ffc83d' : COLOURS[out.rolled[0]];
    dice.style.setProperty('--wave', colour);
    diceImg.src = faces[out.lucky ? 'star' : FACE[out.rolled[0]]];
    SFX.boom(); shake(); flash();
    if (out.lucky) return finish(out);
    if (out.rolled.length > 1) {
      // first corner, then a second surprise hop
      hitCorners([out.rolled[0]]);
      showBanner(`${CN(out.rolled[0])} is out…`, out.rolled[0]);
      say('oh-no-two-corners-at-once', 600);
      later(() => {
        dice.className = 'dice show tumble'; SFX.drumroll(1.2);
        let t = 0; const second = out.rolled[1];
        for (let i = 0; i < 6; i++) {
          const c = i === 5 ? second : [0, 1, 2, 3].filter((x) => x !== out.rolled[0])[i % 3];
          later(() => { diceImg.src = faces[FACE[c]]; SFX.clack(i); }, t);
          t += 90 + i * 40;
        }
        later(() => { dice.className = 'dice show'; void dice.offsetWidth; dice.className = 'dice show landed'; SFX.boom(); shake(); flash(); finish(out); }, t + 80);
      }, 2200);
      return;
    }
    finish(out);
  }
  function hitCorners(list) {
    corners.forEach((el, i) => { el.classList.remove('hop', 'dim', 'hit'); el.classList.add(list.includes(i) ? 'hit' : 'dim'); });
    list.forEach((c) => burst(c));
  }
  function finish(out) {
    history.push(out);
    phase = 'result';
    if (out.lucky) {
      corners.forEach((el) => { el.classList.remove('dim', 'hit'); el.classList.add('lucky'); });
      showBanner('Lucky roll! Nobody is out', null, true);
      msg.textContent = 'Lucky roll!'; sub.textContent = 'Everyone in a corner is safe this time.';
      SFX.sparkle(); [0, 1, 2, 3].forEach((c) => burst(c, '#ffd75e'));
      say(pick(['a-lucky-roll-everyone-in-a-corner-is-safe', 'what-luck-every-corner-is-safe']), 400);
    } else {
      hitCorners(out.rolled);
      const two = out.rolled.length > 1;
      const names = out.rolled.map((c) => `${CN(c)} (${NUM[c]}, ${NAMES[c]})`);
      showBanner(two ? `${CN(out.rolled[0])} and ${CN(out.rolled[1])} are out!` : `${CN(out.rolled[0])} is out!`, out.rolled[0], false, two ? out.rolled[1] : null);
      msg.textContent = two ? `${names.join(' and ')} are out` : `${names[0]} is out`;
      const where = out.rolled.map((c) => S.spots[c]).filter(Boolean);
      sub.textContent = (where.length ? `Everyone ${where.join(' and ')}` : `Everyone in ${two ? 'those corners' : 'that corner'}`) + ', and anyone not in a corner, sits down.';
      SFX.wah();
      if (!two) say(`it-is-the-${FACE[out.rolled[0]]}-corner`, 350);
      else say('two-corners-this-time', 400);
    }
    renderHistory(); setUI();
  }
  function showBanner(text, c, lucky, c2) {
    banner.textContent = text;
    const col = lucky ? 'linear-gradient(90deg,#a855f7,#ffc83d)' : c2 != null ? `linear-gradient(90deg, ${COLOURS[c]} 50%, ${COLOURS[c2]} 50%)` : COLOURS[c];
    banner.style.setProperty('--bc', lucky ? '#ffc83d' : COLOURS[c]);
    banner.style.background = col;
    banner.className = 'banner' + (!lucky && c === 3 && c2 == null ? ' dark-text' : '');
    void banner.offsetWidth; banner.classList.add('show');
  }
  function shake() { const s = $('stage'); s.classList.remove('shake'); void s.offsetWidth; s.classList.add('shake'); }
  function flash() { const f = $('flash'); f.classList.remove('go-flash'); void f.offsetWidth; f.classList.add('go-flash'); }

  // ---------- confetti ----------
  const cv = $('fx'), g2 = cv.getContext('2d'); let parts = [], fxRaf = 0;
  function sizeCanvas() { const d = window.devicePixelRatio || 1; cv.width = innerWidth * d; cv.height = innerHeight * d; g2.setTransform(d, 0, 0, d, 0, 0); }
  window.addEventListener('resize', sizeCanvas); sizeCanvas();
  function burst(c, colour) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = corners[c].getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const cols = [colour || COLOURS[c], '#ffffff', '#ffe27a'];
    for (let i = 0; i < 140; i++) {
      const a = Math.random() * Math.PI * 2, sp = 4 + Math.random() * 14;
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 6, s: 6 + Math.random() * 10, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: cols[i % 3], life: 1, star: i % 7 === 0 });
    }
    if (!fxRaf) fxRaf = requestAnimationFrame(stepFx);
  }
  function stepFx() {
    g2.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter((p) => p.life > 0 && p.y < innerHeight + 40);
    for (const p of parts) {
      p.vy += 0.38; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= 0.008;
      g2.save(); g2.globalAlpha = Math.max(0, Math.min(1, p.life * 1.6)); g2.translate(p.x, p.y); g2.rotate(p.r); g2.fillStyle = p.c;
      if (p.star) { g2.beginPath(); for (let k = 0; k < 10; k++) { const rr = k % 2 ? p.s * .45 : p.s; const an = k * Math.PI / 5; g2.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } g2.fill(); }
      else g2.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      g2.restore();
    }
    fxRaf = parts.length ? requestAnimationFrame(stepFx) : 0;
    if (!parts.length) g2.clearRect(0, 0, innerWidth, innerHeight);
  }

  // ---------- controls ----------
  function main() {
    if (phase === 'ready' || phase === 'result') startCountdown();
    else if (phase === 'count') doFreeze();
    else if (phase === 'freeze' && !S.auto) roll();
  }
  goBtn.addEventListener('click', main);
  rollNow.addEventListener('click', roll);
  const setSecs = (n) => { S.secs = Math.max(3, Math.min(30, n)); save(); applySecs(); if (phase === 'ready' || phase === 'result') setUI(); };
  $('minus').addEventListener('click', () => setSecs(S.secs - 1));
  $('plus').addEventListener('click', () => setSecs(S.secs + 1));
  $('soundBtn').addEventListener('click', () => { S.muted = !S.muted; save(); applySound(); audio(); });
  function fullscreen() {
    try {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else document.documentElement.requestFullscreen().catch(() => {});
    } catch (e) {}
  }
  $('fsBtn').addEventListener('click', fullscreen);

  // settings sheet
  const back = $('sheetBack');
  const maps = $('maps');
  MAPS.forEach((m) => {
    const b = document.createElement('button'); b.className = 'map-pick'; b.dataset.map = m.id; b.type = 'button';
    b.innerHTML = `<img src="${A(`map-${m.id}.webp`)}" alt=""><span>${m.name}</span>`;
    b.addEventListener('click', () => { S.map = m.id; save(); applyMap(); });
    maps.appendChild(b);
  });
  function openSet() {
    if (phase === 'count' || phase === 'rolling') return;
    $('optAuto').checked = S.auto; $('optTwists').checked = S.twists; $('optRepeat').checked = S.noRepeat;
    $('optMusic').checked = S.music; $('optVoice').checked = S.voice; $('optFx').checked = S.fx; $('optVol').value = S.vol;
    S.spots.forEach((v, i) => { $('spot' + i).value = v; });
    applySecs(); back.hidden = false; $('closeSet').focus();
  }
  const closeSet = () => { back.hidden = true; setUI(); };
  $('setBtn').addEventListener('click', openSet); $('mapBtn').addEventListener('click', openSet);
  $('closeSet').addEventListener('click', closeSet); $('doneSet').addEventListener('click', closeSet);
  back.addEventListener('click', (e) => { if (e.target === back) closeSet(); });
  $('optSecs').addEventListener('input', (e) => setSecs(+e.target.value));
  [['optAuto', 'auto'], ['optTwists', 'twists'], ['optRepeat', 'noRepeat'], ['optMusic', 'music'], ['optVoice', 'voice'], ['optFx', 'fx']].forEach(([id, k]) => {
    $(id).addEventListener('change', (e) => { S[k] = e.target.checked; save(); applySound(); });
  });
  $('optVol').addEventListener('input', (e) => { S.vol = +e.target.value; save(); applySound(); });
  $('optVol').addEventListener('change', () => { audio(); SFX.tick(false); });
  [0, 1, 2, 3].forEach((i) => $('spot' + i).addEventListener('input', (e) => { S.spots[i] = e.target.value.trim(); save(); applySpots(); }));
  $('resetBtn').addEventListener('click', () => {
    clearTimers(); musicStop(); clearBoard(); history = []; round = 1; phase = 'ready'; renderHistory(); setUI();
    $('resetBtn').textContent = 'Cleared'; setTimeout(() => { $('resetBtn').textContent = 'New game (clear rounds)'; }, 1500);
  });

  // keyboard
  const onKey = (e) => {
    const target = e.composedPath ? e.composedPath()[0] : e.target;
    if ((target && target.matches && target.matches('input, textarea, select')) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (!$('veil').hidden) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); enter(); } return; }
    if (!back.hidden) { if (e.key === 'Escape') closeSet(); return; }
    const k = e.key.toLowerCase();
    if (e.key === ' ' || e.key === 'Enter') { if (root.activeElement && root.activeElement !== goBtn && e.key === 'Enter') return; e.preventDefault(); main(); }
    else if (k === 'r' && (phase === 'ready' || phase === 'result' || phase === 'freeze')) roll();
    else if (k === 's') openSet();
    else if (k === 'm') { S.muted = !S.muted; save(); applySound(); }
    else if (k === 'f') fullscreen();
    else if (k === 'arrowup' || k === '+' || k === '=') setSecs(S.secs + 1);
    else if (k === 'arrowdown' || k === '-') setSecs(S.secs - 1);
  };
  window.addEventListener('keydown', onKey);

  function enter() { $('veil').hidden = true; audio(); SFX.whoosh(); goBtn.focus(); }
  $('enter').addEventListener('click', enter);

  applyMap(); applySpots(); applySecs(); applySound(); renderHistory(); setUI();
  diceImg.src = faces.red;
  // ---------- Real-life Four Corners (docs/JAIL-PLAN.md): the jail list, "back in!", the code, the end ----------
  let jailSeen = null;
  function setJail(list, backs, how) {
    const ul = $('jailList');
    ul.innerHTML = '';
    $('jailN').textContent = String(list.length);
    $('backs').textContent = backs > 0 ? `${backs} back in so far` : '';
    $('jailHow').textContent = how;
    if (!list.length) ul.innerHTML = '<span class="empty">Nobody in jail</span>';
    const fresh = jailSeen ? list.filter((p) => !jailSeen.has(p.id)) : [];
    list.forEach((p) => {
      const li = document.createElement('li');
      if (fresh.includes(p)) li.className = 'new';
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = p.name;
      b.title = `Let ${p.name} out (no questions)`;
      b.addEventListener('click', () => opts.onRelease && opts.onRelease(p.id, p.name));
      li.appendChild(b);
      ul.appendChild(li);
    });
    jailSeen = new Set(list.map((p) => p.id));
  }
  const backQueue = [];
  let backBusy = false;
  function backIn(name) {
    backQueue.push(name);
    if (!backBusy) nextBack();
  }
  function nextBack() {
    const name = backQueue.shift();
    const box = $('backin');
    if (name === undefined) { backBusy = false; box.innerHTML = ''; return; }
    backBusy = true;
    box.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'card flashing';
    const who = document.createElement('span'); who.className = 'who'; who.textContent = name || 'Someone';
    const says = document.createElement('span'); says.className = 'says'; says.textContent = 'is back in! 🏃';
    card.append(who, says);
    box.appendChild(card);
    SFX.sparkle(); flash();
    [0, 1, 2, 3].forEach((c) => burst(c, '#4ade80'));
    say(opts.backLine(), 300);
    // A queue: two at once show one after the other (2.6 s each when busy, else the full 4.2 s).
    later(nextBack, backQueue.length ? 2600 : 4200);
  }
  function setCode(code) {
    $('codePill').hidden = !code;
    $('code').textContent = code || '';
  }
  function showOver(text, names) {
    clearTimers(); musicStop(); clearBoard(); cancelAnimationFrame(raf);
    phase = 'ready';
    $('overSay').textContent = text;
    const ol = $('overList'); ol.innerHTML = '';
    names.forEach((n) => { const li = document.createElement('li'); li.textContent = n; ol.appendChild(li); });
    $('over').hidden = false;
  }
  $('endBtn').addEventListener('click', () => opts.onEnd && opts.onEnd());
  $('again').addEventListener('click', () => opts.onAgain && opts.onAgain());
  // A tap on this page already (the teacher's "Let's play!"): no need for the start card.
  try { if (navigator.userActivation && navigator.userActivation.hasBeenActive) $('veil').hidden = true; } catch (e) {}

  return {
    setJail, backIn, setCode, showOver,
    destroy() {
      clearTimers(); cancelAnimationFrame(raf); cancelAnimationFrame(fxRaf);
      window.removeEventListener('keydown', onKey); window.removeEventListener('resize', sizeCanvas);
      [music.a, music.b].forEach((el) => { try { el.pause(); el.src = ''; } catch (e) {} });
      try { if (voiceEl) voiceEl.pause(); } catch (e) {}
      try { if (ctx) ctx.close(); } catch (e) {}
    },
  };
}
