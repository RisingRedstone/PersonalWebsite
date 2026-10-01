// Threadweaver: animated, steppable model of the simple SCSP ring buffer
// (Matching-Engine-Threadweaver, src/buffer/ring/simple_approach.hpp).
//
// One producer process (core 3) and one consumer process (core 2) share a
// mmap'd layout: write_head and read_head on separate 64-byte cache lines,
// followed by a power-of-two data array indexed with `head & (size - 1)`.
// Each side caches its own head and acquire-loads the other side's head on
// every call; a full or empty buffer makes the call fail and the caller retries.
//
// Markup: <figure class="tw" data-tw-anim="compact|full"> with a .tw-stage child.
(() => {
    const SIZE = 8;
    const MASK = SIZE - 1;
    const NS = 'http://www.w3.org/2000/svg';

    // Base duration (ms at 1x) of each protocol step: load, check, data, store.
    const BASE_MS = [650, 300, 650, 550];

    const SCENES = {
        steady:   { label: 'Steady flow',     p: 1.0, c: 1.0 },
        producer: { label: 'Producer faster', p: 2.4, c: 0.6 },
        consumer: { label: 'Consumer faster', p: 0.6, c: 2.4 },
    };
    const AUTO_ORDER = [['steady', 8000], ['producer', 14000], ['consumer', 16000]];

    const STEPS = {
        P: {
            status: ['load read_head', 'check: full?', 'write data[w & 7]', 'store write_head'],
            retry: 'FULL → retry',
            code: [
                'r_h = read_head.load(acquire);',
                'if (w_h_cache >= size + r_h) return false;',
                'data[w_h_cache & (size - 1)] = item;',
                'write_head.store(++w_h_cache, release);',
            ],
        },
        C: {
            status: ['load write_head', 'check: empty?', 'read data[r & 7]', 'store read_head'],
            retry: 'EMPTY → retry',
            code: [
                'w_h = write_head.load(acquire);',
                'if (r_h_cache >= w_h) return nullopt;',
                'item = data[r_h_cache & (size - 1)];',
                'read_head.store(++r_h_cache, release);',
            ],
        },
    };

    // ---- Geometry (viewBox 0 0 380 308) ----
    const CORE = { P: { x: 8, y: 8 }, C: { x: 202, y: 8 }, w: 170, h: 80 };
    const HEAD = { w: { x: 20, y: 130 }, r: { x: 196, y: 130 }, w_: 164, h: 40 };
    const SLOT = { x0: 22, pitch: 42, w: 38, y: 198, h: 34 };
    const slotCx = i => SLOT.x0 + i * SLOT.pitch + SLOT.w / 2;
    const PT = {
        coreP: [CORE.P.x + CORE.w / 2, CORE.P.y + CORE.h],
        coreC: [CORE.C.x + CORE.w / 2, CORE.C.y + CORE.h],
        headW: [HEAD.w.x + HEAD.w_ / 2, HEAD.w.y + HEAD.h / 2],
        headR: [HEAD.r.x + HEAD.w_ / 2, HEAD.r.y + HEAD.h / 2],
        slot: i => [slotCx(i), SLOT.y + SLOT.h / 2],
    };

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    function svgEl(name, attrs, parent, text) {
        const n = document.createElementNS(NS, name);
        for (const k in attrs) n.setAttribute(k, attrs[k]);
        if (text != null) n.textContent = text;
        if (parent) parent.appendChild(n);
        return n;
    }

    function htmlEl(tag, attrs, parent, text) {
        const n = document.createElement(tag);
        for (const k in attrs) n.setAttribute(k, attrs[k]);
        if (text != null) n.textContent = text;
        if (parent) parent.appendChild(n);
        return n;
    }

    let instance = 0;

    function init(root) {
        const id = 'tw' + (++instance);
        const full = root.dataset.twAnim === 'full';
        const stage = root.querySelector('.tw-stage');

        // ---------- Model ----------
        const m = {
            time: 0,
            w: 3, r: 0, // shared write_head / read_head
            slots: Array.from({ length: SIZE }, (_, i) => (i < 3 ? { item: i, state: 'filled' } : { item: null, state: 'empty' })),
            P: { cache: 3, loaded: 0, phase: 0, t0: 0, t1: 0, retry: false },
            C: { cache: 0, loaded: 0, phase: 0, t0: 0, t1: 0, retry: false },
            flashSlot: -1, flashUntil: 0,
            auto: true, autoIndex: 0, sceneStart: 0, scene: 'steady',
        };

        const rate = who => SCENES[m.scene][who === 'P' ? 'p' : 'c'];

        function schedule(who, t0) {
            const a = m[who];
            a.t0 = t0;
            a.t1 = t0 + (BASE_MS[a.phase] / rate(who)) * (0.85 + Math.random() * 0.3);
            if (a.phase === 2) {
                const i = a.cache & MASK;
                m.slots[i].state = who === 'P' ? 'writing' : 'reading';
            }
        }

        // Applies the effect of the step `who` just finished; returns a sentence for screen readers.
        function complete(who) {
            const a = m[who];
            const t = a.t1;
            let msg;
            if (who === 'P') {
                switch (a.phase) {
                    case 0: a.loaded = m.r; a.phase = 1; msg = `loaded read_head = ${m.r}`; break;
                    case 1:
                        if (a.cache >= SIZE + a.loaded) {
                            a.retry = true; a.phase = 0;
                            m.flashSlot = a.cache & MASK; m.flashUntil = t + 900;
                            msg = 'buffer full, write() returns false and the caller retries';
                        } else { a.retry = false; a.phase = 2; msg = 'space available'; }
                        break;
                    case 2: {
                        const i = a.cache & MASK;
                        m.slots[i] = { item: a.cache, state: 'filled' };
                        a.phase = 3; msg = `wrote item #${a.cache} to slot ${i}`; break;
                    }
                    default: a.cache++; m.w = a.cache; a.phase = 0; msg = `published write_head = ${m.w}`;
                }
            } else {
                switch (a.phase) {
                    case 0: a.loaded = m.w; a.phase = 1; msg = `loaded write_head = ${m.w}`; break;
                    case 1:
                        if (a.cache >= a.loaded) { a.retry = true; a.phase = 0; msg = 'buffer empty, read() returns nullopt and the caller retries'; }
                        else { a.retry = false; a.phase = 2; msg = 'data available'; }
                        break;
                    case 2: {
                        const i = a.cache & MASK;
                        m.slots[i].state = 'stale';
                        a.phase = 3; msg = `read item #${m.slots[i].item} from slot ${i}`; break;
                    }
                    default: a.cache++; m.r = a.cache; a.phase = 0; msg = `published read_head = ${m.r}`;
                }
            }
            schedule(who, t);
            return (who === 'P' ? 'Producer: ' : 'Consumer: ') + msg + '.';
        }

        function nextActor() { return m.P.t1 <= m.C.t1 ? 'P' : 'C'; }

        function advance(simDt) {
            m.time += simDt;
            if (m.auto && m.time - m.sceneStart > AUTO_ORDER[m.autoIndex][1]) {
                m.autoIndex = (m.autoIndex + 1) % AUTO_ORDER.length;
                m.scene = AUTO_ORDER[m.autoIndex][0];
                m.sceneStart = m.time;
            }
            for (let guard = 0; guard < 64; guard++) {
                const who = nextActor();
                if (m[who].t1 > m.time) break;
                complete(who);
            }
        }

        schedule('P', 0);
        schedule('C', 0);

        // ---------- SVG ----------
        const titleId = id + '-t', descId = id + '-d';
        const svg = svgEl('svg', { viewBox: '0 0 380 308', class: 'tw-svg', role: 'img', 'aria-labelledby': `${titleId} ${descId}` });
        svgEl('title', { id: titleId }, svg, 'Threadweaver simple ring buffer between two processes');
        svgEl('desc', { id: descId }, svg,
            'A producer process pinned to core 3 and a consumer process pinned to core 2 share memory holding write_head, read_head, ' +
            'and an 8-slot ring buffer. The producer loads read_head, checks for space, writes a slot, then publishes write_head. ' +
            'The consumer loads write_head, checks for data, reads a slot, then publishes read_head.');

        const text = {};
        function core(who) {
            const { x, y } = CORE[who];
            const g = svgEl('g', { class: 'tw-core tw-core-' + who.toLowerCase() }, svg);
            svgEl('rect', { class: 'tw-box', x, y, width: CORE.w, height: CORE.h }, g);
            svgEl('rect', { class: 'tw-stripe', x, y, width: 3, height: CORE.h }, g);
            svgEl('text', { class: 'tw-title', x: x + 12, y: y + 18 }, g, who === 'P' ? 'CORE 3 · PRODUCER' : 'CORE 2 · CONSUMER');
            svgEl('text', { class: 'tw-label', x: x + 12, y: y + 36 }, g, who === 'P' ? 'w_h_cache (own)' : 'r_h_cache (own)');
            text[who + 'cache'] = svgEl('text', { class: 'tw-value', x: x + CORE.w - 10, y: y + 36, 'text-anchor': 'end' }, g);
            svgEl('text', { class: 'tw-label', x: x + 12, y: y + 52 }, g, who === 'P' ? 'r_h (loaded)' : 'w_h (loaded)');
            text[who + 'loaded'] = svgEl('text', { class: 'tw-value', x: x + CORE.w - 10, y: y + 52, 'text-anchor': 'end' }, g);
            text[who + 'status'] = svgEl('text', { class: 'tw-status', x: x + 12, y: y + 70 }, g);
        }
        core('P');
        core('C');

        svgEl('rect', { class: 'tw-panel', x: 8, y: 104, width: 364, height: 196 }, svg);
        svgEl('text', { class: 'tw-label', x: 20, y: 122 }, svg, 'SHARED MEMORY (mmap, both processes)');
        text.used = svgEl('text', { class: 'tw-label', x: 360, y: 122, 'text-anchor': 'end' }, svg);

        function headBox(kind) {
            const { x, y } = HEAD[kind];
            const g = svgEl('g', { class: 'tw-head tw-head-' + kind }, svg);
            svgEl('rect', { class: 'tw-box', x, y, width: HEAD.w_, height: HEAD.h }, g);
            text[kind + 'head'] = svgEl('text', { class: 'tw-head-name', x: x + 10, y: y + 16 }, g);
            text[kind + 'idx'] = svgEl('text', { class: 'tw-label', x: x + 10, y: y + 31 }, g);
        }
        headBox('w');
        headBox('r');

        const slotEls = [];
        for (let i = 0; i < SIZE; i++) {
            const x = SLOT.x0 + i * SLOT.pitch;
            const g = svgEl('g', { class: 'tw-slot' }, svg);
            svgEl('rect', { x, y: SLOT.y, width: SLOT.w, height: SLOT.h }, g);
            const t = svgEl('text', { x: x + SLOT.w / 2, y: SLOT.y + 21, 'text-anchor': 'middle' }, g);
            svgEl('text', { class: 'tw-label', x: x + SLOT.w / 2, y: SLOT.y + SLOT.h + 13, 'text-anchor': 'middle' }, svg, String(i));
            slotEls.push({ g, t });
        }

        const markW = svgEl('g', { class: 'tw-marker tw-marker-w' }, svg);
        svgEl('text', { x: 0, y: 184, 'text-anchor': 'middle' }, markW, 'W');
        svgEl('path', { d: 'M-5 187 L5 187 L0 195 Z' }, markW);
        const markR = svgEl('g', { class: 'tw-marker tw-marker-r' }, svg);
        svgEl('path', { d: 'M-5 260 L5 260 L0 252 Z' }, markR);
        svgEl('text', { x: 0, y: 272, 'text-anchor': 'middle' }, markR, 'R');

        svgEl('text', { class: 'tw-label', x: 20, y: 292 }, svg, 'heads alignas(64) · size 8 (power of two)');

        const packets = {
            P: svgEl('circle', { class: 'tw-packet tw-packet-p', r: 4.5 }, svg),
            C: svgEl('circle', { class: 'tw-packet tw-packet-c', r: 4.5 }, svg),
        };

        stage.replaceChildren(svg);

        // ---------- Controls ----------
        const controls = htmlEl('div', { class: 'tw-controls' });
        const playBtn = htmlEl('button', { type: 'button', class: 'tw-btn' }, controls);
        const stepBtn = htmlEl('button', { type: 'button', class: 'tw-btn' }, controls, 'Step');
        const sceneLabel = htmlEl('label', { class: 'tw-field' }, controls, 'Scene ');
        const sceneSel = htmlEl('select', {}, sceneLabel);
        htmlEl('option', { value: 'auto' }, sceneSel, 'Auto cycle');
        for (const k in SCENES) htmlEl('option', { value: k }, sceneSel, SCENES[k].label);

        let speed = 1;
        if (full) {
            const speedLabel = htmlEl('label', { class: 'tw-field' }, controls, 'Speed ');
            const range = htmlEl('input', { type: 'range', min: '0.25', max: '2', step: '0.25', value: '1' }, speedLabel);
            const out = htmlEl('output', {}, speedLabel, '1×');
            range.addEventListener('input', () => { speed = Number(range.value); out.textContent = speed + '×'; });
        }
        stage.after(controls);

        const live = htmlEl('p', { class: 'sr-only', 'aria-live': 'polite' });
        controls.after(live);

        let codeLines = null;
        if (full) {
            const code = htmlEl('div', { class: 'tw-code' });
            codeLines = {};
            for (const who of ['P', 'C']) {
                const col = htmlEl('div', { class: 'tw-code-col tw-code-' + who.toLowerCase() }, code);
                htmlEl('p', { class: 'tw-code-title' }, col, who === 'P' ? 'Producer · write()' : 'Consumer · read()');
                const pre = htmlEl('pre', {}, col);
                const c = htmlEl('code', {}, pre);
                codeLines[who] = STEPS[who].code.map(line => htmlEl('span', { class: 'line' }, c, line));
            }
            controls.before(code);
        }

        const barScene = root.querySelector('.tw-scene');

        // ---------- Render ----------
        const marker = { w: slotCx(m.w & MASK), r: slotCx(m.r & MASK) };

        function moveMarker(kind, target, el, dt, snap) {
            let x = marker[kind];
            if (snap || target < x - 1) x = target; // wrap-around jumps straight back to slot 0
            else x += (target - x) * Math.min(1, dt / 90);
            marker[kind] = x;
            el.setAttribute('transform', `translate(${x.toFixed(2)} 0)`);
        }

        function packetPath(who) {
            const a = m[who];
            const i = a.cache & MASK;
            if (who === 'P') return [[PT.headR, PT.coreP], null, [PT.coreP, PT.slot(i)], [PT.coreP, PT.headW]][a.phase];
            return [[PT.headW, PT.coreC], null, [PT.slot(i), PT.coreC], [PT.coreC, PT.headR]][a.phase];
        }

        function render(dt, snap) {
            for (const who of ['P', 'C']) {
                const a = m[who];
                text[who + 'cache'].textContent = a.cache;
                text[who + 'loaded'].textContent = a.loaded;
                const retry = a.retry && a.phase === 0;
                text[who + 'status'].textContent = '▸ ' + (retry ? STEPS[who].retry : STEPS[who].status[a.phase]);
                text[who + 'status'].classList.toggle('is-retry', retry);

                const path = packetPath(who);
                const p = packets[who];
                if (!path) { p.setAttribute('visibility', 'hidden'); }
                else {
                    const k = Math.max(0, Math.min(1, (m.time - a.t0) / (a.t1 - a.t0)));
                    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
                    p.setAttribute('cx', (path[0][0] + (path[1][0] - path[0][0]) * e).toFixed(2));
                    p.setAttribute('cy', (path[0][1] + (path[1][1] - path[0][1]) * e).toFixed(2));
                    p.setAttribute('visibility', 'visible');
                }
                if (codeLines) codeLines[who].forEach((l, n) => l.classList.toggle('is-current', n === a.phase));
            }

            text.whead.textContent = `write_head = ${m.w}`;
            text.widx.textContent = `${m.w} & 7 → slot ${m.w & MASK}`;
            text.rhead.textContent = `read_head = ${m.r}`;
            text.ridx.textContent = `${m.r} & 7 → slot ${m.r & MASK}`;
            text.used.textContent = `used ${m.w - m.r} / ${SIZE}`;

            const flashing = m.time < m.flashUntil ? m.flashSlot : -1;
            m.slots.forEach((s, i) => {
                const el = slotEls[i];
                el.g.setAttribute('class', `tw-slot is-${s.state}${i === flashing ? ' is-full' : ''}`);
                el.t.textContent = s.item == null ? '·' : '#' + s.item;
            });

            moveMarker('w', slotCx(m.w & MASK), markW, dt, snap);
            moveMarker('r', slotCx(m.r & MASK), markR, dt, snap);

            if (barScene) barScene.textContent = (m.auto ? 'AUTO · ' : '') + SCENES[m.scene].label.toUpperCase();
        }

        // ---------- Loop ----------
        let playing = !reducedMotion.matches;
        let visible = false;
        let rafId = null;
        let last = null;

        const running = () => playing && visible && !document.hidden;

        function frame(ts) {
            if (!running()) { rafId = null; last = null; return; }
            const dt = last == null ? 0 : Math.min(100, ts - last);
            last = ts;
            advance(dt * speed);
            render(dt, false);
            rafId = requestAnimationFrame(frame);
        }
        function kick() { if (running() && rafId == null) rafId = requestAnimationFrame(frame); }

        function syncPlayButton() {
            playBtn.textContent = playing ? 'Pause' : 'Play';
            playBtn.setAttribute('aria-pressed', String(playing));
        }

        playBtn.addEventListener('click', () => { playing = !playing; syncPlayButton(); kick(); });
        stepBtn.addEventListener('click', () => {
            playing = false;
            syncPlayButton();
            const who = nextActor();
            m.time = m[who].t1;
            live.textContent = complete(who);
            render(0, true);
        });
        sceneSel.addEventListener('change', () => {
            m.auto = sceneSel.value === 'auto';
            if (m.auto) { m.autoIndex = 0; m.scene = AUTO_ORDER[0][0]; m.sceneStart = m.time; }
            else m.scene = sceneSel.value;
            live.textContent = 'Scene: ' + (m.auto ? 'auto cycle' : SCENES[m.scene].label);
            render(0, !playing);
        });

        root.classList.toggle('is-reduced', reducedMotion.matches);
        reducedMotion.addEventListener?.('change', e => root.classList.toggle('is-reduced', e.matches));

        new IntersectionObserver(entries => {
            visible = entries[0].isIntersecting;
            kick();
        }).observe(root);
        document.addEventListener('visibilitychange', kick);

        syncPlayButton();
        render(0, true);
    }

    document.querySelectorAll('[data-tw-anim]').forEach(init);
})();
