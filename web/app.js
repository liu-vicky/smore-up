(() => {
  let s;

  try {
    s = JSON.parse(localStorage.getItem('littlefire'));
  } catch {
    s = null;
  }

  s = s || {
    name: '',
    goal: 14,
    last: Date.now() - 7 * 86400000,
    plans: [],
    activity: [],
  };

  const $ = (id) => document.getElementById(id);

  function save() {
    localStorage.setItem('littlefire', JSON.stringify(s));
    render();
  }

  function goalSpec() {
    if (
      s.goalSpec &&
      ['days', 'weeks', 'months', 'years'].includes(s.goalSpec.unit) &&
      Number.isInteger(s.goalSpec.count) &&
      s.goalSpec.count > 0
    ) {
      return s.goalSpec;
    }

    if (s.goal === 7) {
      return { count: 1, unit: 'weeks' };
    }

    if (s.goal === 14) {
      return { count: 2, unit: 'weeks' };
    }

    return {
      count: Math.max(1, Number(s.goal) || 14),
      unit: 'days',
    };
  }

  function goalDeadline(last, spec) {
    const d = new Date(last);

    if (spec.unit === 'days' || spec.unit === 'weeks') {
      d.setDate(d.getDate() + spec.count * (spec.unit === 'weeks' ? 7 : 1));
      return d.getTime();
    }

    const day = d.getDate();
    d.setDate(1);

    if (spec.unit === 'months') {
      d.setMonth(d.getMonth() + spec.count);
    } else {
      d.setFullYear(d.getFullYear() + spec.count);
    }

    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDay));
    return d.getTime();
  }

  function goalLabel() {
    const g = goalSpec();
    return 'every ' + (g.count === 1 ? '' : g.count + ' ') + (g.count === 1 ? g.unit.slice(0, -1) : g.unit);
  }

  function goalFields() {
    const g = goalSpec();
    const preset = g.unit === 'weeks' && g.count === 1 ? '7' : g.unit === 'weeks' && g.count === 2 ? '14' : 'custom';

    return `
      <label>
        Our IRL goal
        <select name="goal" id="goal-choice">
          <option value="7" ${preset === '7' ? 'selected' : ''}>Every week</option>
          <option value="14" ${preset === '14' ? 'selected' : ''}>Every 2 weeks</option>
          <option value="custom" ${preset === 'custom' ? 'selected' : ''}>Custom</option>
        </select>
      </label>
      <div id="custom-goal" class="custom-goal" ${preset !== 'custom' ? 'hidden' : ''}>
        <label>
          Every
          <input id="goal-count" name="goalCount" type="number" min="1" max="999" step="1" value="${g.count}">
        </label>
        <label>
          Unit
          <select name="goalUnit" id="goal-unit">${['days', 'weeks', 'months', 'years']
            .map(
              (u) => `<option value="${u}" ${u === g.unit ? 'selected' : ''}>${u}</option>`
            )
            .join('')}</select>
        </label>
      </div>
    `;
  }

  function initGoalFields() {
    if (!$('goal-choice')) {
      return;
    }

    const update = () => {
      const custom = $('goal-choice').value === 'custom';
      $('custom-goal').hidden = !custom;
      $('goal-count').required = custom;
      $('goal-count').disabled = !custom;
      $('goal-unit').disabled = !custom;
    };

    $('goal-choice').onchange = update;
    update();
  }

  async function initInviteLink() {
    const input = $('link');
    const button = $('copy');
    const status = $('invite-status');
    const data = {
      name: s.name || 'Our campfire',
      goalSpec: goalSpec(),
    };
    const signature = JSON.stringify(data);

    const setLink = (code) => {
      input.value = location.origin + '/?join=' + code;
      button.disabled = false;
      status.innerHTML = 'your short campfire code: <span class="invite-code">' + code + '</span>';
    };

    button.onclick = async () => {
      try {
        await navigator.clipboard.writeText(input.value);
        toast('Invite link copied');
      } catch {
        input.select();
        toast('Select and copy the link above');
      }
    };

    try {
      if (s.inviteCode && s.inviteSignature === signature) {
        const check = await fetch('/api/invites/' + s.inviteCode);
        if (check.ok) {
          setLink(s.inviteCode);
          return;
        }
      }

      const response = await fetch('/api/invites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Unavailable');
      }

      const result = await response.json();
      s.inviteCode = result.code;
      s.inviteSignature = signature;
      saveDecorationState();
      setLink(result.code);
    } catch {
      input.placeholder = 'Short link unavailable';
      status.textContent = 'Could not create your link. Close and reopen Invite to try again.';
    }
  }

  async function openShortInvite(raw) {
    const code = String(raw).toUpperCase();

    try {
      const response = await fetch('/api/invites/' + encodeURIComponent(code));
      if (!response.ok) {
        throw new Error('Missing');
      }

      const data = await response.json();
      $('card').classList.remove('character-card');
      $('card').innerHTML = `
        <button class="close" aria-label="Close">×</button>
        <div class="kicker">Gather around</div>
        <h2 id="dialogtitle" class="user-content">${esc(data.name)}</h2>
        <p>
          This campfire preview brings in the group name and hangout goal. Live friends and shared updates are not connected yet.
        </p>
        <button class="primary" id="open-invited-camp">Open campfire preview</button>
      `;

      $('overlay').hidden = false;
      $('card').querySelector('.close').onclick = () => {
        close();
        if (!s.name) {
          panel('setup');
        }
      };

      $('open-invited-camp').onclick = () => {
        s.name = data.name;
        s.goalSpec = data.goalSpec;
        s.goal = data.goalSpec.count * { days: 1, weeks: 7, months: 30, years: 365 }[data.goalSpec.unit];
        delete s.inviteCode;
        save();
        history.replaceState(null, '', location.pathname);

        if (!s.character) {
          panel('character');
        } else {
          close();
        }
      };
    } catch {
      toast('That campfire link could not be found');
      if (!s.name) {
        panel('setup');
      } else if (!s.character) {
        panel('character');
      }
    }
  }

  function memberCount() {
    return Math.max(1, Array.isArray(s.members) ? s.members.length : 1);
  }

  function render() {
    paintAvatar();
    $('group').textContent = s.name || 'The marshmallow club';

    const cold = Math.min(
      100,
      Math.max(
        0,
        Math.round((Date.now() - s.last) / Math.max(1, goalDeadline(s.last, goalSpec()) - s.last) * 100)
      )
    );

    $('percent').textContent = cold + '%';
    $('fill').style.width = cold + '%';
    $('goalnote').textContent = 'goal: a lil hanghout ' + goalLabel();

    const next = s.plans
      .filter((p) => new Date(p.date) > new Date())
      .sort((a, b) => new Date(a.date) - new Date(b.date))[0];

    $('next').textContent = next
      ? '✧ ' +
        new Date(next.date).toLocaleString([], {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        }) +
        ' · ' +
        next.place
      : "you have no plans set so it's time to make one!";
  }

  function esc(t) {
    return String(t).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[c]));
  }

  function toast(t) {
    $('toast').textContent = t;
    $('toast').hidden = false;
    setTimeout(() => {
      $('toast').hidden = true;
    }, 3500);
  }

  function close() {
    $('overlay').hidden = true;
  }

  function panel(type) {
    $('card').classList.toggle('character-card', type === 'character');
    $('overlay').hidden = false;
    let content = '';

    if (type === 'setup' || type === 'settings') {
      content = `
        <div class="kicker">Gather around</div>
        <h2 id="dialogtitle">${type === 'setup' ? 'Name your campfire' : 'Your campfire'}</h2>
        <p>Pick a group name and agree how often you want to see each other in real life.</p>
        <form id="setup">
          <label>
            Campfire name
            <input name="name" maxlength="45" required placeholder="The Long Weekend" value="${esc(s.name)}">
          </label>
          ${goalFields()}
          <label>
            Last time we hung out
            <input type="date" name="last" required value="${new Date(s.last).toLocaleDateString('en-CA')}" max="${new Date().toLocaleDateString('en-CA')}">
          </label>
          <button class="primary">${type === 'setup' ? 'Start this campfire' : 'Save changes'}</button>
        </form>
      `;
    }

    if (type === 'character') {
      content = characterUI();
    }

    if (type === 'phone') {
      content = phoneUI();
    }

    if (type === 'friends') {
      content =
        '<h2 id="dialogtitle">Around the fire</h2>' +
        '<p>Just you for now. Invite your friends to gather around.</p>' +
        [s.nickname || 'you']
          .map(
            (n, i) => `
              <div class="row">
                <span class="avatar">${i === 0 && s.character ? `<img src="${s.character}" alt="Your drawn blob">` : '•ᴗ•'}</span>
                <span class="user-content">${esc(n)}
                  <div class="muted">campfire keeper</div>
                </span>
              </div>
            `
          )
          .join('') +
        '<button class="primary" data-panel="character">Customize your character</button>' +
        '<button data-panel="phone" style="width:100%;margin-top:14px">My phone & reminders</button>';
    }

    if (type === 'invite') {
      content =
        '<h2 id="dialogtitle">Make room for one more.</h2>' +
        '<p>Share a short campfire link. It opens your group name and hangout goal; live membership and shared updates are not connected yet.</p>' +
        '<input id="link" readonly aria-label="Campfire preview link" placeholder="Creating your short link…">' +
        '<p id="invite-status" class="fineprint" role="status"></p>' +
        '<button class="primary" id="copy" disabled>Copy invite link</button>';
    }

    if (type === 'poke') {
      content = `
        <div class="kicker">A little nudge</div>
        <h2 id="dialogtitle">Huddle up soon?</h2>
        <p>time to pick a hangout spot to warm the campfire!</p>
        <form id="poke-form">
          <label>
            Place
            <input name="place" required maxlength="100" placeholder="Coffee & a long walk">
          </label>
          <div class="split-fields">
            <label>
              Date
              <input type="date" name="date" required>
            </label>
            <label>
              Time
              <input type="time" name="time" required>
            </label>
          </div>
          <label>
            A little message
            <textarea name="message" rows="3" maxlength="320" placeholder="i miss you guys so it's time to HANG NOW &gt;:("></textarea>
          </label>
          <button class="primary" type="submit">Save hangout</button>
          <p class="fineprint sms-status">SMS is not connected yet. This saves your suggestion on this device; no texts will be sent.</p>
        </form>
      `;
    }

    if (type === 'plans') {
      content = `
        <h2 id="dialogtitle">Something to look forward to.</h2>
        ${
          s.plans.length
            ? s.plans
                .map(
                  (p) => `
                    <div class="row">
                      ✧ <span>${esc(p.place)}
                        <div class="muted">${esc(new Date(p.date).toLocaleString())} · proposed</div>
                      </span>
                    </div>
                  `
                )
                .join('')
            : '<p>No plans yet. Be the one who says “when?”</p>'
        }
        <form id="plan">
          <label>
            Where shall we go?
            <input name="place" placeholder="Coffee & a long walk" required maxlength="70">
          </label>
          <div class="split-fields">
            <label>
              Date
              <input type="date" name="date" required>
            </label>
            <label>
              Time
              <input type="time" name="time" required>
            </label>
          </div>
          <button class="primary">Propose this hangout</button>
        </form>
        <p class="muted">Plans are stored on this device. A completed hangout resets coldness.</p>
      `;
    }

    $('card').innerHTML = '<button class="close" aria-label="Close">×</button>' + content;
    $('card').querySelector('.close').onclick = close;

    if (type === 'setup') {
      $('card').querySelector('.close').hidden = true;
    }

    if ($('setup')) {
      $('setup').onsubmit = (e) => {
        e.preventDefault();
        s.name = e.target.name.value.trim();

        if (!s.name) {
          return;
        }

        s.goalSpec =
          e.target.goal.value === 'custom'
            ? {
                count: Number(e.target.goalCount.value),
                unit: e.target.goalUnit.value,
              }
            : {
                count: e.target.goal.value === '7' ? 1 : 2,
                unit: 'weeks',
              };

        if (!Number.isInteger(s.goalSpec.count) || s.goalSpec.count < 1 || s.goalSpec.count > 999) {
          toast('Choose a whole number from 1 to 999');
          return;
        }

        s.goal = s.goalSpec.count * { days: 1, weeks: 7, months: 30, years: 365 }[s.goalSpec.unit];
        s.last = new Date(e.target.last.value + 'T12:00:00').getTime();
        save();

        if (type === 'setup' && !s.character) {
          panel('character');
        } else {
          close();
        }
      };
    }

    if ($('plan')) {
      $('plan').date.min = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 10);

      $('plan').onsubmit = (e) => {
        e.preventDefault();

        if (!e.target.date.value || !e.target.time.value || new Date(e.target.date.value + 'T' + e.target.time.value) <= new Date()) {
          toast('Choose a time in the future');
          return;
        }

        s.plans.push({
          place: e.target.place.value.trim(),
          date: e.target.date.value + 'T' + e.target.time.value,
        });
        save();
        close();
        toast('A little plan to look forward to ♡');
      };
    }

    if ($('poke-form')) {
      const form = $('poke-form');
      form.date.min = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

      form.onsubmit = (e) => {
        e.preventDefault();
        const place = form.place.value.trim();
        const date = form.date.value + 'T' + form.time.value;

        if (!place || !form.date.value || !form.time.value || new Date(date) <= new Date()) {
          toast('Choose a place and a future date & time');
          return;
        }

        s.plans.push({
          place,
          date,
          message: form.message.value.trim(),
          smsStatus: 'not-connected',
        });
        save();
        close();
        toast('Hangout saved · no SMS sent');
      };
    }

    initGoalFields();
    initStyledPickers();

    if (type === 'character') {
      initDrawing();
    }

    if (type === 'phone') {
      initPhone();
    }

    if ($('link')) {
      initInviteLink();
    }

    setTimeout(() => {
      $('card').querySelector('input,button')?.focus();
    }, 20);
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-panel]');
    if (b) {
      panel(b.dataset.panel);
    }
  });

  $('overlay').onclick = (e) => {
    if (e.target === $('overlay') && s.name) {
      close();
    }
  };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && s.name) {
      close();
    }
  });

  function paintAvatar() {
    const g = $('my-blob');
    if (!g) {
      return;
    }

    g.replaceChildren();
    $('island-lonely-note').hidden = memberCount() > 1;

    if (!s.character) {
      return;
    }

    const img = document.createElement('img');
    img.src = s.character;
    img.alt = 'Your drawn blob';

    const label = document.createElement('span');
    label.className = 'user-content';
    label.textContent = s.nickname || 'you';

    g.append(img, label);
  }

  function characterUI() {
    return `
      <div class="kicker">A little you</div>
      <h2 id="dialogtitle">Make your blob</h2>
      <p>Your own little doodle, made from scratch.</p>
      <div class="character-desk">
        <div class="drawing-column">
          <div class="draw-wrap">
            <canvas id="drawing" class="draw-box" width="360" height="360" aria-label="Draw your blob here using your mouse or finger"></canvas>
          </div>
          <div class="draw-tools">
            <div class="brush-sizes" role="group" aria-label="Brush size">
              <input id="brush" type="hidden" value="5">
              <button type="button" class="brush-size" data-size="5" aria-label="Small brush" title="small" aria-pressed="true"><span style="--dot:5px"></span></button>
              <button type="button" class="brush-size" data-size="12" aria-label="Medium brush" title="medium" aria-pressed="false"><span style="--dot:12px"></span></button>
              <button type="button" class="brush-size" data-size="24" aria-label="Large brush" title="large" aria-pressed="false"><span style="--dot:24px"></span></button>
            </div>
            <button type="button" id="eraser" class="eraser-icon" aria-label="Eraser" title="eraser" aria-pressed="false">
              <svg viewBox="0 0 28 28" aria-hidden="true">
                <path d="m5 16 11-11a2 2 0 0 1 3 0l6 6a2 2 0 0 1 0 3L14 25H9l-4-4a3.5 3.5 0 0 1 0-5Z"/>
                <path d="m12 9 10 10M14 25h12"/>
              </svg>
            </button>
            <button id="undo">Undo</button>
            <button id="clear-draw">Clear</button>
          </div>
        </div>
        <div class="color-column">
          <label>
            Your name
            <input id="nickname" maxlength="25" value="${esc(s.nickname || 'you')}">
          </label>
          <label>Palette</label>
          <div class="swatches">
            ${['#292741', '#c0cba4', '#efb09c', '#e8bb82', '#a9c4cf', '#d0afd0', '#fffbea']
              .map(
                (c, i) =>
                  `<button class="swatch" data-color="${c}" style="background:${c}" aria-label="Draw with ${c}" aria-pressed="${i === 0}"></button>`
              )
              .join('')}
          </div>
          <div class="inline-colors">
            <label class="custom-color-label">
              <span class="color-preview" id="color-preview"></span>
              Custom color
            </label>
            <canvas id="color-wheel" class="color-wheel" width="220" height="220" aria-label="Custom color wheel"></canvas>
            <label>
              Lightness
              <input id="lightness" type="range" min="5" max="95" value="50">
            </label>
            <label>
              Hex color
              <input id="ink" value="#292741" maxlength="7" aria-label="Hex color">
            </label>
          </div>
          <button id="save-character" class="primary">Save your blob</button>
        </div>
      </div>
      <p class="fineprint">Edit your blob anytime below the island or in Friends.</p>
    `;
  }

  function initDrawing() {
    const c = $('drawing');
    const ctx = c.getContext('2d');
    let drawing = false;
    let erase = false;
    let history = [];
    let ink = '#292741';

    function snapshot() {
      history.push(ctx.getImageData(0, 0, 360, 360));
      if (history.length > 20) {
        history.shift();
      }
    }

    function starter() {
      ctx.clearRect(0, 0, 360, 360);
      ctx.fillStyle = '#c0cba4';
      ctx.strokeStyle = '#292741';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(99, 263);
      ctx.bezierCurveTo(66, 181, 105, 74, 176, 84);
      ctx.bezierCurveTo(251, 53, 275, 171, 261, 255);
      ctx.bezierCurveTo(287, 303, 77, 310, 99, 263);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#292741';
      ctx.beginPath();
      ctx.ellipse(148, 180, 4, 7, 0, 0, 7);
      ctx.ellipse(209, 180, 4, 7, 0, 0, 7);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(179, 202, 15, 0.1, Math.PI - 0.1);
      ctx.stroke();
    }

    if (s.character) {
      const im = new Image();
      im.onload = () => ctx.drawImage(im, 0, 0, 360, 360);
      im.src = s.character;
    } else {
      ctx.clearRect(0, 0, 360, 360);
    }

    function point(e) {
      const r = c.getBoundingClientRect();
      return [(e.clientX - r.left) * 360 / r.width, (e.clientY - r.top) * 360 / r.height];
    }

    c.onpointerdown = (e) => {
      e.preventDefault();
      snapshot();
      drawing = true;
      c.setPointerCapture(e.pointerId);
      ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
      ctx.lineCap = ctx.lineJoin = 'round';
      ctx.strokeStyle = ink;
      ctx.lineWidth = Number($('brush').value);
      ctx.beginPath();
      ctx.moveTo(...point(e));
      ctx.lineTo(point(e)[0] + 0.1, point(e)[1] + 0.1);
      ctx.stroke();
    };

    c.onpointermove = (e) => {
      if (drawing) {
        ctx.lineTo(...point(e));
        ctx.stroke();
      }
    };

    c.onpointerup = c.onpointercancel = () => {
      drawing = false;
      ctx.globalCompositeOperation = 'source-over';
    };

    document.querySelectorAll('[data-color]').forEach((b) => {
      b.onclick = () => {
        ink = b.dataset.color;
        $('ink').value = ink;
        erase = false;
        $('eraser').setAttribute('aria-pressed', 'false');
        document.querySelectorAll('[data-color]').forEach((x) => {
          x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
        });
      };
    });

    $('ink').oninput = (e) => {
      if (/^#[0-9a-f]{6}$/i.test(e.target.value)) {
        ink = e.target.value;
        erase = false;
        $('color-preview').style.background = ink;
      }
    };

    initColorWheel((color) => {
      ink = color;
      erase = false;
      $('ink').value = color;
      $('color-preview').style.background = color;
    });

    document.querySelectorAll('[data-size]').forEach((b) => {
      b.onclick = () => {
        $('brush').value = b.dataset.size;
        document.querySelectorAll('[data-size]').forEach((x) => {
          x.setAttribute('aria-pressed', String(x === b));
        });
      };
    });

    $('eraser').onclick = () => {
      erase = !erase;
      $('eraser').setAttribute('aria-pressed', String(erase));
    };

    $('undo').onclick = () => {
      if (history.length) {
        ctx.putImageData(history.pop(), 0, 0);
      }
    };

    $('clear-draw').onclick = () => {
      snapshot();
      ctx.clearRect(0, 0, 360, 360);
    };

    $('save-character').onclick = () => {
      if (!ctx.getImageData(0, 0, 360, 360).data.some((v, i) => i % 4 === 3 && v)) {
        toast('Draw a little something first ♡');
        return;
      }

      s.character = c.toDataURL('image/png');
      s.nickname = $('nickname').value.trim() || 'you';
      save();
      close();
      toast('Your little blob is home ♡');
    };
  }

  function phoneUI() {
    return `
      <div class="kicker">Keep in touch</div>
      <h2 id="dialogtitle">Your reminders</h2>
      <p>this feature is still in the works!</p>
      <form id="phone-form">
        <label>
          Phone number (with country code)
          <input id="phone-number" type="tel" autocomplete="tel" placeholder="+1 514 555 0123" value="${esc(s.phone || '')}">
        </label>
        <label class="check-label">
          <input type="checkbox" id="sms-consent" ${s.smsConsent ? 'checked' : ''}>
          I’d like hangout reminders when SMS delivery is available.
        </label>
        <button class="primary">Save reminder preference</button>
      </form>
    `;
  }

  function initPhone() {
    $('phone-form').onsubmit = (e) => {
      e.preventDefault();
      const n = $('phone-number').value.replace(/[\s()-]/g, '');

      if (n && !/^\+[1-9]\d{7,14}$/.test(n)) {
        toast('Use a country code, like +1 514 555 0123');
        return;
      }

      if ($('sms-consent').checked && !n) {
        toast('Add your phone number first');
        return;
      }

      s.phone = n;
      s.smsConsent = $('sms-consent').checked;
      save();
      close();
      toast('Preference saved · SMS not connected');
    };
  }

  function celebrate() {
    const scene = document.querySelector('.scene');

    for (let i = 0; i < 42; i += 1) {
      const el = document.createElement('i');
      el.className = 'spark';
      el.style.setProperty('--x', (Math.random() - 0.5) * 430 + 'px');
      el.style.setProperty('--y', (-70 - Math.random() * 230) + 'px');
      el.style.setProperty('--r', Math.random() * 720 + 'deg');
      el.style.setProperty('--spark', ['#efb09c', '#e8b55d', '#b3c797', '#d1adce'][i % 4]);
      scene.appendChild(el);
      setTimeout(() => el.remove(), 1600);
    }
  }

  function initColorWheel(onColor) {
    const c = $('color-wheel');
    const ctx = c.getContext('2d');
    let light = 50;

    function paint() {
      const im = ctx.createImageData(220, 220);
      for (let y = 0; y < 220; y += 1) {
        for (let x = 0; x < 220; x += 1) {
          const dx = x - 110;
          const dy = y - 110;
          const r = Math.hypot(dx, dy);

          if (r > 108) {
            continue;
          }

          const rgb = hsl((Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360, r / 108, light / 100);
          const i = (y * 220 + x) * 4;
          im.data.set([...rgb, 255], i);
        }
      }

      ctx.putImageData(im, 0, 0);
    }

    function pick(e) {
      const r = c.getBoundingClientRect();
      const x = (e.clientX - r.left) * 220 / r.width - 110;
      const y = (e.clientY - r.top) * 220 / r.height - 110;
      const rgb = hsl(
        (Math.atan2(y, x) * 180 / Math.PI + 360) % 360,
        Math.min(1, Math.hypot(x, y) / 108),
        light / 100
      );
      onColor('#' + rgb.map((n) => n.toString(16).padStart(2, '0')).join(''));
    }

    let active = false;

    c.onpointerdown = (e) => {
      active = true;
      c.setPointerCapture(e.pointerId);
      pick(e);
    };

    c.onpointermove = (e) => {
      if (active) {
        pick(e);
      }
    };

    c.onpointerup = c.onpointercancel = () => {
      active = false;
    };

    $('lightness').oninput = (e) => {
      light = +e.target.value;
      paint();
    };

    paint();
  }

  function hsl(h, s, l) {
    const a = s * Math.min(l, 1 - l);
    const f = (n) => {
      const k = (n + h / 30) % 12;
      return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
    };

    return [f(0), f(8), f(4)];
  }

  function initStyledPickers() {
    document.querySelectorAll('#card input[type=date]').forEach((input) => {
      input.type = 'hidden';
      const wrap = document.createElement('div');
      wrap.innerHTML = '<button type="button" class="picker-trigger"></button><div class="picker-pop" hidden></div>';
      input.after(wrap);

      const trigger = wrap.querySelector('button');
      const pop = wrap.querySelector('.picker-pop');
      let view = input.value ? new Date(input.value + 'T12:00:00') : new Date();

      function draw() {
        trigger.textContent = input.value
          ? new Date(input.value + 'T12:00:00').toLocaleDateString([], {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })
          : 'Choose a date';

        const yy = view.getFullYear();
        const mm = view.getMonth();
        pop.innerHTML =
          '<div class="calendar-head"><button type="button" aria-label="Previous month">‹</button><span>' +
          view.toLocaleDateString([], { month: 'long', year: 'numeric' }) +
          '</span><button type="button" aria-label="Next month">›</button></div><div class="calendar-grid">' +
          ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((n) => '<small>' + n + '</small>').join('') +
          '</div>';

        const nav = pop.querySelectorAll('button');
        nav[0].onclick = () => {
          view = new Date(yy, mm - 1, 1);
          draw();
        };
        nav[1].onclick = () => {
          view = new Date(yy, mm + 1, 1);
          draw();
        };

        const grid = pop.querySelector('.calendar-grid');
        for (let i = 0; i < new Date(yy, mm, 1).getDay(); i += 1) {
          grid.append(document.createElement('span'));
        }

        for (let day = 1; day <= new Date(yy, mm + 1, 0).getDate(); day += 1) {
          const value = yy + '-' + String(mm + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
          const b = document.createElement('button');
          b.type = 'button';
          b.textContent = day;
          b.setAttribute('aria-label', new Date(value + 'T12:00:00').toDateString());
          if (input.value === value) {
            b.className = 'selected';
          }
          b.disabled = !!((input.min && value < input.min) || (input.max && value > input.max));
          b.onclick = () => {
            input.value = value;
            pop.hidden = true;
            draw();
          };
          grid.append(b);
        }
      }

      trigger.onclick = () => {
        pop.hidden = !pop.hidden;
        draw();
      };

      draw();
    });

    document.querySelectorAll('#card input[type=time]').forEach((input) => {
      input.type = 'hidden';
      const w = document.createElement('div');
      w.innerHTML =
        '<button type="button" class="picker-trigger">Choose a time</button><div class="picker-pop" hidden><div class="time-grid"><label>Hour<select aria-label="Hour">' +
        Array.from({ length: 12 }, (_, i) => `<option>${i + 1}</option>`).join('') +
        '</select></label><label>Minute<select aria-label="Minute">' +
        Array.from({ length: 60 }, (_, i) => `<option>${String(i).padStart(2, '0')}</option>`).join('') +
        '</select></label><label>AM / PM<select aria-label="AM or PM"><option>AM</option><option>PM</option></select></label></div><button type="button" class="primary">Set time</button></div>';
      input.after(w);

      const buttons = w.querySelectorAll('button');
      const pop = w.querySelector('.picker-pop');

      buttons[0].onclick = () => {
        pop.hidden = !pop.hidden;
      };

      buttons[1].onclick = () => {
        const v = w.querySelectorAll('select');
        input.value =
          String((+v[0].value % 12) + (v[2].value === 'PM' ? 12 : 0)).padStart(2, '0') + ':' + v[1].value;
        buttons[0].textContent = v[0].value + ':' + v[1].value + ' ' + v[2].value;
        pop.hidden = true;
      };
    });
  }

  const ASSET_SCALE = 0.4675;

  const stampCatalog = [
    { id: 1, name: 'Broadleaf tree', src: 'assets/stamps/01.png', w: 224, h: 295 },
    { id: 2, name: 'Fruit tree', src: 'assets/stamps/02.png', w: 190, h: 250 },
    { id: 3, name: 'Tall pine', src: 'assets/stamps/03.png', w: 257, h: 286 },
    { id: 4, name: 'Pine tree', src: 'assets/stamps/04.png', w: 180, h: 231 },
    { id: 5, name: 'Round tree', src: 'assets/stamps/05.png', w: 187, h: 231 },
    { id: 6, name: 'Little pine', src: 'assets/stamps/06.png', w: 148, h: 213 },
    { id: 7, name: 'Small broadleaf', src: 'assets/stamps/07.png', w: 158, h: 220 },
    { id: 8, name: 'Long grass patch', src: 'assets/stamps/08.png', w: 162, h: 175 },
    { id: 9, name: 'Short grass patch', src: 'assets/stamps/09.png', w: 170, h: 119 },
    { id: 10, name: 'Pebble cluster', src: 'assets/stamps/10.png', w: 120, h: 72 },
    { id: 11, name: 'Three stones', src: 'assets/stamps/11.png', w: 59, h: 60 },
    { id: 12, name: 'Pond', src: 'assets/stamps/12.png', w: 386, h: 200 },
    { id: 13, name: 'Little bush', src: 'assets/stamps/13.png', w: 122, h: 69 },
    { id: 14, name: 'Leaf sprig', src: 'assets/stamps/14.png', w: 76, h: 75 },
    { id: 15, name: 'Flower cluster', src: 'assets/stamps/15.png', w: 168, h: 95 },
    { id: 16, name: 'Soft grass', src: 'assets/stamps/16.png', w: 103, h: 53 },
    { id: 17, name: 'Clover grass', src: 'assets/stamps/17.png', w: 92, h: 56 },
    { id: 18, name: 'Tall blades', src: 'assets/stamps/18.png', w: 98, h: 63 },
    { id: 19, name: 'Scattered stones', src: 'assets/stamps/19.png', w: 115, h: 123 },
    { id: 20, name: 'Bent sprout', src: 'assets/stamps/20.png', w: 57, h: 54 },
    { id: 21, name: 'Two leaves', src: 'assets/stamps/21.png', w: 78, h: 67 },
    { id: 22, name: 'Thick grass', src: 'assets/stamps/22.png', w: 110, h: 103 },
    { id: 23, name: 'Reeds', src: 'assets/stamps/23.png', w: 147, h: 207 },
    { id: 24, name: 'Tiny grass', src: 'assets/stamps/24.png', w: 66, h: 57 },
    { id: 25, name: 'Leafy bush', src: 'assets/stamps/25.png', w: 213, h: 140 },
    { id: 26, name: 'Low bush', src: 'assets/stamps/26.png', w: 230, h: 123 },
  ];

  let decorating = false;
  let chosenStamp = null;
  let selectedDecoration = null;

  s.decorations = Array.isArray(s.decorations) ? s.decorations : [];

  function boardPoint(e) {
    const r = $('island-board').getBoundingClientRect();
    return {
      x: Math.max(3, Math.min(97, (e.clientX - r.left) / r.width * 100)),
      y: Math.max(8, Math.min(92, (e.clientY - r.top) / r.height * 100)),
    };
  }

  function friendZone() {
    const r = $('island-board').getBoundingClientRect();
    return {
      width: r.width,
      height: r.height,
      radius: Math.min(r.width * 0.22, r.height * 0.35),
    };
  }

  function stampBounds(asset) {
    const zone = friendZone();
    return {
      hw: (asset.w * ASSET_SCALE) / 1200 * 50,
      hh: (asset.h * ASSET_SCALE) / 1200 * (zone.width / zone.height) * 50,
    };
  }

  function clampStamp(x, y, asset) {
    const { hw, hh } = stampBounds(asset);
    return {
      x: Math.max(hw + 1, Math.min(99 - hw, x)),
      y: Math.max(hh + 2, Math.min(98 - hh, y)),
    };
  }

  function nearFire(x, y, asset) {
    const z = friendZone();
    const w = asset ? (asset.w * ASSET_SCALE) / 1200 * z.width / 2 : 0;
    const h = asset ? (asset.h * ASSET_SCALE) / 1200 * z.width / 2 : 0;
    const dx = Math.max(0, Math.abs((x - 50) / 100 * z.width) - w);
    const dy = Math.max(0, Math.abs((y - 50) / 100 * z.height) - h);
    return dx * dx + dy * dy < (z.radius + 8) ** 2;
  }

  function fitFriendZone() {
    const zone = friendZone();
    $('island-board').style.setProperty('--friend-radius', zone.radius + 'px');
    let changed = false;

    s.decorations.forEach((item) => {
      const asset = stampCatalog.find((a) => a.id === item.stamp);
      if (!asset) {
        return;
      }

      const current = clampStamp(item.x, item.y, asset);
      if (!nearFire(current.x, current.y, asset)) {
        if (item.x !== current.x || item.y !== current.y) {
          Object.assign(item, current);
          changed = true;
        }
        return;
      }

      let best = null;
      let distance = Infinity;

      for (let x = 5; x <= 95; x += 3) {
        for (let y = 5; y <= 95; y += 3) {
          const p = clampStamp(x, y, asset);
          if (nearFire(p.x, p.y, asset)) {
            continue;
          }

          const d = (p.x - item.x) ** 2 + (p.y - item.y) ** 2;
          if (d < distance) {
            distance = d;
            best = p;
          }
        }
      }

      if (best) {
        Object.assign(item, best);
        changed = true;
      }
    });

    if (changed) {
      saveDecorationState();
      drawDecorations();
    }
  }

  function drawDecorations() {
    const layer = $('stamp-layer');
    if (!layer) {
      return;
    }

    layer.replaceChildren();

    s.decorations.forEach((item) => {
      const asset = stampCatalog.find((a) => a.id === item.stamp);
      if (!asset) {
        return;
      }

      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'placed-stamp' + (selectedDecoration === item.id ? ' selected' : '');
      el.dataset.decoration = item.id;
      el.setAttribute('aria-label', asset.name + (decorating ? ' · drag to move, arrow keys to adjust' : ''));
      el.style.left = item.x + '%';
      el.style.top = item.y + '%';
      el.style.width = (asset.w * ASSET_SCALE) / 1200 * 100 + '%';
      el.style.aspectRatio = asset.w + '/' + asset.h;
      el.disabled = !decorating;

      const img = document.createElement('img');
      img.src = asset.src;
      img.alt = '';
      img.draggable = false;
      el.append(img);
      layer.append(el);

      let origin = null;
      let moved = false;

      el.onpointerdown = (e) => {
        if (!decorating) {
          return;
        }

        e.stopPropagation();
        selectedDecoration = item.id;
        layer.querySelectorAll('button').forEach((b) => b.classList.toggle('selected', b === el));
        $('remove-stamp').disabled = false;
        origin = { x: item.x, y: item.y };
        moved = false;
        el.setPointerCapture(e.pointerId);
      };

      el.onpointermove = (e) => {
        if (!origin) {
          return;
        }

        const raw = boardPoint(e);
        const p = clampStamp(raw.x, raw.y, asset);
        const reserved = nearFire(p.x, p.y, asset);

        if (!reserved) {
          lastValid = { ...p };
        }
        
        el.style.left = p.x + '%';
        el.style.top = p.y + '%';
        el.classList.toggle('over-friend-zone', reserved);

        item.x = p.x;
        item.y = p.y;
        el.style.left = item.x + '%';
        el.style.top = item.y + '%';
        moved = true;
      };

      el.onpointerup = el.onpointercancel = (e) => {
        e.stopPropagation();
        if (!origin) {
          return;
        }

        origin = null;
        if (moved) {
          saveDecorationState();
        }
      };

      el.onclick = (e) => e.stopPropagation();
      el.onkeydown = (e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          removeSelected();
          return;
        }

        const delta = e.shiftKey ? 3 : 1;
        const dx = e.key === 'ArrowLeft' ? -delta : e.key === 'ArrowRight' ? delta : 0;
        const dy = e.key === 'ArrowUp' ? -delta : e.key === 'ArrowDown' ? delta : 0;

        if (!dx && !dy) {
          return;
        }

        e.preventDefault();
        const { x, y } = clampStamp(item.x + dx, item.y + dy, asset);
        if (nearFire(x, y, asset)) {
          return;
        }

        item.x = x;
        item.y = y;
        el.style.left = x + '%';
        el.style.top = y + '%';
        saveDecorationState();
      };
    });

    $('remove-stamp').disabled = !selectedDecoration;
  }

  function saveDecorationState() {
    localStorage.setItem('littlefire', JSON.stringify(s));
  }

  function removeSelected() {
    if (!selectedDecoration) {
      return;
    }

    s.decorations = s.decorations.filter((d) => d.id !== selectedDecoration);
    selectedDecoration = null;
    saveDecorationState();
    drawDecorations();
  }

  function initDecorations() {
    const tray = $('stamp-options');

    stampCatalog.forEach((asset) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'stamp-choice';
      b.setAttribute('aria-label', 'Use ' + asset.name);
      b.setAttribute('aria-pressed', 'false');

      const img = document.createElement('img');
      img.src = asset.src;
      img.alt = '';
      img.style.width = asset.w * 0.23 + 'px';
      img.style.height = asset.h * 0.23 + 'px';
      b.append(img);

      const name = document.createElement('span');
      name.textContent = asset.name;
      b.append(name);

      b.onclick = () => {
        chosenStamp = asset.id;
        selectedDecoration = null;
        $('remove-stamp').disabled = true;
        tray.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        $('decoration-hint').textContent = asset.name + ' selected · click the dotted island to place it.';
      };

      tray.append(b);
    });

    $('decorate-island').onclick = () => {
      decorating = !decorating;
      $('decorate-island').textContent = decorating ? '✓ Done decorating' : '✎ Decorate your island';
      $('decorate-island').setAttribute('aria-expanded', String(decorating));
      $('decoration-tools').hidden = !decorating;
      $('island-board').classList.toggle('decorating', decorating);

      if (!decorating) {
        chosenStamp = null;
        selectedDecoration = null;
        tray.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      }

      drawDecorations();
    };

    $('island-board').onclick = (e) => {
      if (!decorating || !chosenStamp) {
        return;
      }

      if (e.target.closest('.fixed-fire,.island-person')) {
        return;
      }

      const asset = stampCatalog.find((a) => a.id === chosenStamp);
      const raw = boardPoint(e);
      const p = clampStamp(raw.x, raw.y, asset);

      if (nearFire(p.x, p.y, asset)) {
        toast('This circle is saved for your friends ♡');
        return;
      }

      if (s.decorations.length >= 100) {
        toast('Your island has 100 stamps. Remove one to make room.');
        return;
      }

      const d = {
        id: crypto.randomUUID(),
        stamp: chosenStamp,
        x: p.x,
        y: p.y,
      };
      s.decorations.push(d);
      selectedDecoration = d.id;
      saveDecorationState();
      drawDecorations();
    };

    $('remove-stamp').onclick = removeSelected;
    drawDecorations();
    fitFriendZone();
    new ResizeObserver(fitFriendZone).observe($('island-board'));
  }

  initDecorations();

  const q = new URLSearchParams(location.search);

  if (q.has('camp') && !s.name) {
    s.name = q.get('camp').slice(0, 45);
    s.goal = [7, 14, 21, 30, 60].includes(Number(q.get('goal'))) ? Number(q.get('goal')) : 14;
    const n = Number(q.get('goalCount'));
    const u = q.get('goalUnit');

    if (Number.isInteger(n) && n >= 1 && n <= 999 && ['days', 'weeks', 'months', 'years'].includes(u)) {
      s.goalSpec = { count: n, unit: u };
    }

    save();
  }

  $('met').onclick = () => {
    s.last = Date.now();
    save();
    celebrate();
    toast('A warm fire & a fresh start ♡');
  };

  render();
  setInterval(render, 60000);

  if (q.has('join')) {
    openShortInvite(q.get('join'));
  } else if (!s.name) {
    panel('setup');
  } else if (!s.character) {
    panel('character');
  }
})();
