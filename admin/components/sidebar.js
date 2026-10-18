const items = [
  ['dashboard','Dashboard','dashboard.html'],['clients','Clients','clients.html'],['movies','Movies','movies.html'],['campaigns','Campaigns','campaigns.html'],['venues','Venues','venues.html'],['activations','Activations','activations.html'],['leads','Leads','leads.html'],['expenses','Expenses','expenses.html'],['invoices','Invoices','invoices.html'],['reports','Reports','reports.html']
];

export function mountSidebar(active='dashboard') {
  const nav=document.getElementById('sidebar'); if(!nav) return;
  nav.innerHTML=`<div class="brand"><img src="../assets/badger-logo.svg" onerror="this.style.display='none'"/><div><strong><span class="brand-honey">HONEY</span><span class="brand-badger">BANGER2</span></strong><span>MEDIA</span></div></div><nav>${items.map(([id,label,file])=>`<a class="nav-item ${id===active?'active':''}" href="${file}"><span class="nav-icon">${icon(id)}</span>${label}</a>`).join('')}</nav><div class="sidebar-bottom"><div class="user-mini"><div class="avatar" data-avatar>A</div><div><strong data-user-email>Admin</strong><small>Administrator</small></div></div><button id="signoutBtn" class="signout">Sign out</button></div>`;
  document.getElementById('signoutBtn')?.addEventListener('click', async()=>{ const { supabaseClient }=await import('../js/config.js'); await supabaseClient.auth.signOut(); window.location.href='../login.html'; });
}

function icon(id){ return ({dashboard:'⌂',clients:'◉',movies:'▣',campaigns:'◈',venues:'⌖',activations:'⚡',leads:'♙',expenses:'₹',invoices:'▤',reports:'▥'})[id]||'•'; }