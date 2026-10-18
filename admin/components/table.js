import { esc } from '../js/utils.js';
export function renderTable(container, columns, rows, actions=()=> ''){
  if(!rows.length){container.innerHTML='<div class="empty">No records found.</div>';return;}
  container.innerHTML=`<div class="table-wrap"><table><thead><tr>${columns.map(c=>`<th>${esc(c.label)}</th>`).join('')}<th>Actions</th></tr></thead><tbody>${rows.map(r=>`<tr>${columns.map(c=>`<td>${c.render?c.render(r):esc(r[c.key])}</td>`).join('')}<td class="actions">${actions(r)}</td></tr>`).join('')}</tbody></table></div>`;
}
