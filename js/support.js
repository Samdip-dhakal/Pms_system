// Support & Helpdesk page logic (frontend-only using localStorage)
(function() {
  const $ = (id) => document.getElementById(id);

  // Use existing helpers from index.js if present
  const toast = (msg, type='info') =>
    (window.showNotification ? window.showNotification(msg, type) : alert(msg));
  const validate = (form) =>
    (window.validateForm ? window.validateForm(form) : true);

  // Init stores
  const get = (k, fb) => JSON.parse(localStorage.getItem(k) || JSON.stringify(fb));
  const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  if (!get('tickets', null)) set('tickets', []);
  if (!get('appointments', null)) set('appointments', []);

  // ----- Tabs -----
  const tabs = document.querySelectorAll('.tab-btn');
  const panes = {
    ai: $('tab-ai'),
    ticket: $('tab-ticket'),
    faq: $('tab-faq'),
    mine: $('tab-mine')
  };
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      panes[btn.dataset.tab].classList.add('active');
    });
  });

  // ----- Chatbot -----
  const chatWin = $('chatWindow'), chatInput = $('chatInput'), sendBtn = $('sendBtn');

  const addMsg = (text, who='bot') => {
    const div = document.createElement('div');
    div.className = `chat-msg ${who}`;
    div.textContent = text;
    chatWin.appendChild(div);
    chatWin.scrollTop = chatWin.scrollHeight;
  };

  const greet = () => addMsg("Hello! I'm your virtual health assistant. Ask about hours, location, booking, or type 'agent' to open a ticket.");
  greet();

  function detectIntent(text) {
    const t = text.toLowerCase();
    if (/\bhour|open|time\b/.test(t)) return {k:'faq', a:'Support hours: Mon–Fri, 8:00–18:00.'};
    if (/\blocation|where|address\b/.test(t)) return {k:'faq', a:'1 Main Street, Pakenham VIC 3810 (Main Wing, Level 2).'};
    if (/\bhelp|agent|human\b/.test(t)) return {k:'agent'};
    const m = t.match(/book\s+(mental|career)\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/);
    if (m) return {k:'book', type:m[1], slot:`${m[2]}T${m[3]}`};
    return {k:'fallback', a:"Try asking about hours, location, or say 'agent' to open a ticket. Quick book: book mental 2025-10-12 15:00"};
  }

  function openTicket(subject) {
    const tickets = get('tickets', []);
    const id = tickets.length ? tickets[tickets.length - 1].id + 1 : 1;
    tickets.push({
      id,
      subject,
      category: 'General',
      priority: 'Medium',
      name: 'Guest',
      status: 'In Progress',
      createdAt: new Date().toISOString()
    });
    set('tickets', tickets);
    renderTickets();
    return id;
  }

  function quickBook(type, slot) {
    const appts = get('appointments', []);
    if (appts.some(a => a.type === type && a.slot === slot)) return {ok:false, msg:'That slot is already booked.'};
    const id = appts.length ? appts[appts.length - 1].id + 1 : 1;
    appts.push({ id, type, slot, userName: 'Guest', createdAt: new Date().toISOString() });
    set('appointments', appts);
    renderAppointments();
    return {ok:true, id};
  }

  function handleChat() {
    const text = chatInput.value.trim();
    if (!text) return;
    addMsg(text, 'user');
    chatInput.value = '';
    const i = detectIntent(text);
    if (i.k === 'faq' || i.k === 'fallback') return setTimeout(() => addMsg(i.a, 'bot'), 120);
    if (i.k === 'agent') {
      const id = openTicket('Assistance requested via chatbot');
      return setTimeout(() => addMsg(`Ticket ${id} opened. Our team will contact you.`, 'bot'), 150);
    }
    if (i.k === 'book') {
      const r = quickBook(i.type, i.slot);
      return setTimeout(() => addMsg(r.ok ? `Booked ${i.type} counselling at ${i.slot.replace('T',' ')}.` : r.msg, 'bot'), 150);
    }
  }
  sendBtn.addEventListener('click', handleChat);
  chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleChat(); });

  // ----- Tickets -----
  const ticketForm = $('ticketForm');
  ticketForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validate(ticketForm)) { toast('Please fill all required fields.', 'error'); return; }
    const tickets = get('tickets', []);
    const id = tickets.length ? tickets[tickets.length - 1].id + 1 : 1;
    tickets.push({
      id,
      subject: $('tSubject').value.trim(),
      category: $('tCategory').value,
      priority: $('tPriority').value,
      name: $('tName').value.trim() || 'Guest',
      status: 'In Progress',
      createdAt: new Date().toISOString()
    });
    set('tickets', tickets);
    ticketForm.reset();
    renderTickets();
    toast('Ticket submitted successfully.', 'success');
    // Switch to "My Tickets"
    document.querySelector('.tab-btn[data-tab="mine"]').click();
  });

  function renderTickets() {
    const holder = $('myTickets');
    const list = get('tickets', []).slice().reverse();
    holder.innerHTML = '';
    if (list.length === 0) {
      holder.innerHTML = '<p class="muted">No tickets yet.</p>';
      return;
    }
    list.forEach(t => {
      const div = document.createElement('div');
      div.className = 'ticket';
      div.innerHTML = `
        <h4>${t.subject} <span class="badge">${t.status}</span></h4>
        <p class="muted">Category: ${t.category} · Priority: ${t.priority} · Created: ${new Date(t.createdAt).toLocaleDateString()}</p>
        <div style="margin-top:8px">
          <button class="btn btn-primary" data-toggle="${t.id}">${t.status === 'Resolved' ? 'Reopen' : 'Resolve'}</button>
        </div>
      `;
      holder.appendChild(div);
    });
    holder.querySelectorAll('button[data-toggle]').forEach(btn => {
      btn.onclick = () => {
        const id = Number(btn.dataset.toggle);
        const tickets = get('tickets', []);
        const t = tickets.find(x => x.id === id);
        t.status = t.status === 'Resolved' ? 'In Progress' : 'Resolved';
        set('tickets', tickets);
        renderTickets();
      };
    });
  }
  renderTickets();

  // ----- Appointments -----
  $('qaMental').onclick = () => { $('aType').value = 'mental'; $('aName').focus(); };
  $('qaCareer').onclick = () => { $('aType').value = 'career'; $('aName').focus(); };

  const apptForm = $('apptForm');
  apptForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validate(apptForm)) { toast('Please fill all required fields.', 'error'); return; }
    const type = $('aType').value;
    const slot = $('aSlot').value;
    const name = $('aName').value.trim();
    const notes = $('aNotes').value.trim();
    const appts = get('appointments', []);
    if (appts.some(a => a.type === type && a.slot === slot)) { toast('That slot is already booked.', 'error'); return; }
    const id = appts.length ? appts[appts.length - 1].id + 1 : 1;
    appts.push({ id, type, slot, userName: name, notes: notes || null, createdAt: new Date().toISOString() });
    set('appointments', appts);
    apptForm.reset();
    renderAppointments();
    toast('Appointment booked.', 'success');
  });

  function renderAppointments() {
    const box = $('apptList');
    const list = get('appointments', []).slice().reverse();
    box.innerHTML = '';
    if (list.length === 0) {
      box.innerHTML = '<p class="muted">No appointments yet.</p>';
      return;
    }
    list.forEach(a => {
      const d = document.createElement('div');
      d.className = 'ticket';
      d.innerHTML = `
        <h4>#${a.id} · ${a.type.toUpperCase()} · ${new Date(a.slot).toLocaleString()}</h4>
        <p class="muted">${a.userName}${a.notes ? ' — ' + a.notes : ''}</p>
        <div style="margin-top:8px">
          <button class="btn btn-orange" data-cancel="${a.id}">Cancel</button>
        </div>
      `;
      box.appendChild(d);
    });
    box.querySelectorAll('button[data-cancel]').forEach(b => {
      b.onclick = () => {
        const id = Number(b.dataset.cancel);
        const appts = get('appointments', []).filter(x => x.id !== id);
        set('appointments', appts);
        renderAppointments();
        toast('Appointment cancelled.', 'success');
      };
    });
  }
  renderAppointments();
})();
