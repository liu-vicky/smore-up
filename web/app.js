// stage 1: menu dialogs, group setup, saved settings, and a working coldness bar.
(() => {
  // looks up a page element by its id
  const $ = (id) => document.getElementById(id);
  let state;
  try { state = JSON.parse(localStorage.getItem('littlefire')); } catch {}
  state ||= { name: '', goal: 14, last: Date.now(), plans: [], activity: [] };
  // escapes user-provided text before placing it in dialog html
  const escape = (text) => String(text).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  // returns the configured hangout interval, or a default based on the saved goal
  function spec() {
    return state.goalSpec || { count: state.goal === 7 ? 1 : 2, unit: 'weeks' };
  }

  // calculates when the next hangout is due, accounting for calendar month/year lengths
  function deadline() {
    const goal = spec();
    const date = new Date(state.last);
    if (goal.unit === 'days' || goal.unit === 'weeks') {
      date.setDate(date.getDate() + goal.count * (goal.unit === 'weeks' ? 7 : 1));
    } else {
      const day = date.getDate();
      date.setDate(1);
      if (goal.unit === 'months') date.setMonth(date.getMonth() + goal.count);
      else date.setFullYear(date.getFullYear() + goal.count);
      date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
    }
    return date.getTime();
  }

  // updates the group name, coldness progress bar, goal text, and plans message
  function render() {
    const goal = spec();
    const percentage = Math.max(0, Math.min(100, Math.round((Date.now() - state.last) / Math.max(1, deadline() - state.last) * 100)));
    $('group').textContent = state.name || 'the marshmallow club';
    $('percent').textContent = percentage + '%';
    $('fill').style.width = percentage + '%';
    $('goalnote').textContent = 'goal: a lil hanghout every ' + goal.count + ' ' + (goal.count === 1 ? goal.unit.slice(0,-1) : goal.unit);
    $('next').textContent = "you have no plans set so it's time to make one!";
  }

  // persists the current group settings and refreshes the page display
  function save() {
    localStorage.setItem('littlefire', JSON.stringify(state));
    render();
  }

  // hides the dialog overlay
  function close() { $('overlay').hidden = true; }

  // builds and opens the requested dialog, and saves setup/settings form submissions
  function show(type) {
    let content;
    if (type === 'setup' || type === 'settings') {
      const goal = spec();
      const value = goal.unit === 'weeks' && goal.count === 1 ? '7' : goal.unit === 'weeks' && goal.count === 2 ? '14' : 'custom';
      content = `<h2 id="dialogtitle">${type === 'setup' ? 'name your campfire' : 'your campfire'}</h2>
        <form id="group-form">
          <label>campfire name<input name="name" required maxlength="45" value="${escape(state.name)}" placeholder="the long weekend"></label>
          <label>our irl goal<select name="goal" id="goal-choice">
            <option value="7" ${value === '7' ? 'selected' : ''}>every week</option>
            <option value="14" ${value === '14' ? 'selected' : ''}>every 2 weeks</option>
            <option value="custom" ${value === 'custom' ? 'selected' : ''}>custom</option>
          </select></label>
          <div id="custom-goal" class="custom-goal" ${value !== 'custom' ? 'hidden' : ''}>
            <label>every<input name="count" type="number" min="1" max="999" value="${goal.count}"></label>
            <label>unit<select name="unit">${['days','weeks','months','years'].map(unit => `<option ${goal.unit === unit ? 'selected' : ''}>${unit}</option>`).join('')}</select></label>
          </div>
          <label>last time we hung out<input name="last" type="date" required max="${new Date().toLocaleDateString('en-CA')}" value="${new Date(state.last).toLocaleDateString('en-CA')}"></label>
          <button class="primary">save campfire</button>
        </form>`;
    } else if (type === 'friends') {
      content = '<h2 id="dialogtitle">around the fire</h2><p>just you for now.</p>';
    } else {
      const labels = { invite: 'invite your friends', poke: 'poke all', plans: 'hangout plans' };
      content = `<h2 id="dialogtitle">${labels[type] || 'campfire'}</h2><p>this menu is ready for its feature code.</p>`;
    }
    $('card').innerHTML = '<button class="close" aria-label="close">×</button>' + content;
    $('card').querySelector('.close').onclick = close;
    $('overlay').hidden = false;
    const form = $('group-form');
    if (!form) return;
    // shows or hides the custom interval fields when the goal selection changes
    $('goal-choice').onchange = () => { $('custom-goal').hidden = form.goal.value !== 'custom'; };
    // validates and saves the campfire form, then closes the dialog
    form.onsubmit = (event) => {
      event.preventDefault();
      const name = form.name.value.trim();
      const goal = form.goal.value === 'custom' ? { count: Number(form.count.value), unit: form.unit.value } : { count: form.goal.value === '7' ? 1 : 2, unit: 'weeks' };
      if (!name || !Number.isInteger(goal.count) || goal.count < 1 || goal.count > 999) return;
      state.name = name;
      state.goalSpec = goal;
      state.goal = goal.count * ({days:1,weeks:7,months:30,years:365}[goal.unit]);
      state.last = new Date(form.last.value + 'T12:00:00').getTime();
      save();
      close();
    };
  }

  // opens the panel associated with a clicked, enabled menu button
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-panel]');
    if (button && !button.disabled) show(button.dataset.panel);
  });
  // closes the dialog when the user clicks its backdrop
  $('overlay').onclick = (event) => { if (event.target === $('overlay')) close(); };
  // closes the dialog when the user presses escape
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
  // records that the group met today and refreshes the saved progress
  $('met').onclick = () => { state.last = Date.now(); save(); };
  render();
  // refreshes progress periodically so the coldness bar stays current
  setInterval(render, 60000);
  // opens initial setup for a group without a saved name
  if (!state.name) show('setup');
})();