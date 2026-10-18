import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Activity, Building2, Clapperboard, Film, LayoutDashboard, LogOut, Plus, QrCode, RefreshCw, CalendarDays, Search, ShieldCheck } from "lucide-react";
import "./styles.css";

type Config = { url?: string; anonKey?: string };
type RecordRow = Record<string, any>;
type Section = "Overview" | "Movies" | "Campaigns" | "Events & Hunts" | "Venues" | "QR Manager";
const sections: { name: Section; icon: typeof Film; table?: string }[] = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Movies", icon: Film, table: "movies" },
  { name: "Campaigns", icon: Activity, table: "campaigns" },
  { name: "Events & Hunts", icon: CalendarDays, table: "missions" },
  { name: "Venues", icon: Building2, table: "venues" },
  { name: "QR Manager", icon: QrCode, table: "qr_codes" },
];
const columns: Record<string, string[]> = {
  Movies: ["title", "language", "release_date", "active"],
  Campaigns: ["name", "movie_id", "active"],
  "Events & Hunts": ["name", "mission_type", "reward_points", "is_active"],
  Venues: ["name", "venue_type", "city", "state", "active"],
  "QR Manager": ["public_code", "purpose", "campaign_id", "is_active"],
};
const label = (v: string) => v.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());

export default function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [configError, setConfigError] = useState("");
  const [loading, setLoading] = useState(true);
  const [db, setDb] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [section, setSection] = useState<Section>("Overview");
  const [rows, setRows] = useState<Record<string, RecordRow[]>>({});
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState<RecordRow>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/config", { cache: "no-store", headers: { Accept: "application/json" } });
        const type = response.headers.get("content-type") || "";
        if (!response.ok) throw new Error("Worker config endpoint returned HTTP " + response.status + ".");
        if (!type.includes("application/json")) throw new Error("The Worker is returning the website HTML for /api/config instead of JSON. Redeploy the Worker configuration.");
        const values = await response.json() as Config;
        if (!values.url || !values.anonKey) throw new Error("The Worker endpoint works, but VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is empty in Worker Variables and Secrets.");
        if (!cancelled) { setConfig(values); setDb(createClient(values.url, values.anonKey)); }
      } catch (e: any) {
        if (!cancelled) setConfigError(e?.message || "Could not load Worker configuration.");
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!db) return;
    db.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = db.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => subscription.unsubscribe();
  }, [db]);

  useEffect(() => {
    if (!db || !session) { setIsAdmin(false); return; }
    let cancelled = false;
    (async () => {
      setBusy(true); setError("");
      const { data, error: authError } = await db.rpc("is_admin");
      if (cancelled) return;
      if (authError) setError("Admin verification failed: " + authError.message);
      else if (data !== true) { setError("This account does not have administrator access."); await db.auth.signOut(); }
      else { setIsAdmin(true); await loadData(db); }
      if (!cancelled) setBusy(false);
    })();
    return () => { cancelled = true; };
  }, [db, session]);

  async function loadData(client = db) {
    if (!client) return;
    const results = await Promise.all(sections.filter(s => s.table).map(async s => {
      const { data, error } = await client.from(s.table!).select("*").limit(500);
      return { name: s.name, data: data || [], error };
    }));
    const next: Record<string, RecordRow[]> = {};
    results.forEach(r => { if (r.error) console.warn("Could not load " + r.name, r.error); next[r.name] = r.data; });
    setRows(next);
  }

  async function signIn(e: FormEvent) {
    e.preventDefault(); if (!db) return;
    setBusy(true); setError("");
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setBusy(false);
  }

  async function addRecord(e: FormEvent) {
    e.preventDefault(); if (!db) return;
    const table = sections.find(s => s.name === section)?.table;
    if (!table || !["Movies", "Campaigns", "Venues"].includes(section)) return;
    const payload = { ...draft };
    if (section === "Movies") { payload.active = payload.active !== false; if (!payload.release_date) delete payload.release_date; }
    if (section === "Campaigns") { payload.active = payload.active !== false; if (!payload.movie_id) delete payload.movie_id; }
    if (section === "Venues") { payload.active = payload.active !== false; payload.venue_type ||= "shop"; payload.city ||= "Chennai"; payload.state ||= "Tamil Nadu"; }
    setBusy(true); setError(""); setNotice("");
    const { error } = await db.from(table).insert(payload);
    if (error) setError(error.message);
    else { setNotice("Record created."); setShowAdd(false); setDraft({}); await loadData(); }
    setBusy(false);
  }

  const visibleRows = useMemo(() => (rows[section] || []).filter(row => JSON.stringify(row).toLowerCase().includes(search.toLowerCase())), [rows, section, search]);
  const total = (name: string) => (rows[name] || []).length;
  if (loading) return <div className="center"><div className="loader"/><p>Connecting securely…</p></div>;
  if (configError || !db) return <div className="center"><div className="config-card"><div className="brand-icon"><Clapperboard/></div><p className="eyebrow">HONEYBADGER / ADMIN</p><h1>Configuration needs attention</h1><p>{configError || "Supabase client could not be created."}</p><div className="help"><b>Check Cloudflare Worker settings</b><span>Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY under Settings → Variables and Secrets, then redeploy.</span><span>Test <code>/api/config</code>: it must return JSON with non-empty <code>url</code> and <code>anonKey</code> fields.</span></div><button className="button" onClick={() => location.reload()}><RefreshCw size={16}/> Retry</button></div></div>;
  if (!session || !isAdmin) return <div className="center"><form className="login-card" onSubmit={signIn}><div className="brand-icon"><Clapperboard/></div><p className="eyebrow">HONEYBADGER / CONTROL ROOM</p><h1>Admin sign in</h1><p>Sign in with an existing Supabase account that has administrator access.</p><label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username"/></label><label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password"/></label>{error && <div className="error">{error}</div>}<button className="button full" disabled={busy}>{busy ? "Checking…" : "Sign in securely"}</button><small><ShieldCheck size={14}/> Protected by Supabase Auth and admin-role verification</small></form></div>;

  return <div className="layout">
    <aside className="sidebar"><div className="brand"><div className="brand-icon"><Clapperboard/></div><div><b>HONEYBADGER</b><small>ADMIN CONTROL ROOM</small></div></div><p className="eyebrow">WORKSPACE</p><nav>{sections.map(s => <button key={s.name} className={section === s.name ? "nav active" : "nav"} onClick={() => { setSection(s.name); setSearch(""); setShowAdd(false); }}><s.icon size={17}/>{s.name}{s.table && <span>{total(s.name)}</span>}</button>)}</nav><div className="side-bottom"><i/> Supabase connected <button title="Sign out" onClick={() => db.auth.signOut()}><LogOut size={16}/></button></div></aside>
    <main><header className="topbar"><span>Workspace / <b>{section}</b></span><div><span className="live">● LIVE DATA</span><button className="icon-button" title="Refresh data" onClick={() => loadData()}><RefreshCw size={16}/></button><button className="icon-button" title="Sign out" onClick={() => db.auth.signOut()}><LogOut size={16}/></button></div></header>
      <div className="content"><div className="page-title"><div><p className="eyebrow">HONEYBADGER / MANAGEMENT</p><h1>{section === "Overview" ? "Your movie universe." : section}</h1><p>Manage the same live data used by the Honeybadger app.</p></div>{["Movies","Campaigns","Venues"].includes(section) && <button className="button" onClick={() => { setDraft(section === "Movies" ? { title: "", language: "Tamil", active: true } : section === "Campaigns" ? { name: "", active: true } : { name: "", venue_type: "shop", city: "Chennai", state: "Tamil Nadu", active: true }); setShowAdd(!showAdd); }}><Plus size={16}/> Add {section === "Venues" ? "venue" : section.slice(0,-1).toLowerCase()}</button>}</div>
      {error && <div className="error">{error}</div>}{notice && <div className="notice">{notice}</div>}
      {section === "Overview" ? <><div className="hero"><span className="eyebrow">SYSTEM OVERVIEW</span><h2>Every campaign.<br/><em>One command centre.</em></h2><p>Manage movie records, campaigns, events, partner venues and QR codes connected to your production marketing.</p></div><div className="stats">{[{name:"Movies",icon:Film},{name:"Campaigns",icon:Activity},{name:"Events & Hunts",icon:CalendarDays},{name:"Venues",icon:Building2},{name:"QR Manager",icon:QrCode}].map(s=><button className="stat" key={s.name} onClick={() => setSection(s.name as Section)}><s.icon size={18}/><span>{s.name}</span><b>{total(s.name)}</b></button>)}</div><div className="panel"><h3>Recent movies</h3><DataTable rows={(rows.Movies || []).slice(0,8)} columns={columns.Movies}/></div></> : <>
      {showAdd && <form className="add-form" onSubmit={addRecord}><h3>New {section === "Venues" ? "venue" : section.slice(0,-1).toLowerCase()}</h3>
        {section === "Movies" && <><label>Movie title<input required value={draft.title || ""} onChange={e => setDraft({...draft,title:e.target.value})}/></label><label>Language<input value={draft.language || ""} onChange={e => setDraft({...draft,language:e.target.value})}/></label><label>Release date<input type="date" value={draft.release_date || ""} onChange={e => setDraft({...draft,release_date:e.target.value})}/></label><label>Poster URL<input type="url" value={draft.poster_url || ""} onChange={e => setDraft({...draft,poster_url:e.target.value})}/></label></>}
        {section === "Campaigns" && <><label>Campaign name<input required value={draft.name || ""} onChange={e => setDraft({...draft,name:e.target.value})}/></label><label>Movie ID<input placeholder="Paste movie UUID" value={draft.movie_id || ""} onChange={e => setDraft({...draft,movie_id:e.target.value})}/></label><label>Media URL<input type="url" value={draft.media_url || ""} onChange={e => setDraft({...draft,media_url:e.target.value})}/></label></>}
        {section === "Venues" && <><label>Venue name<input required value={draft.name || ""} onChange={e => setDraft({...draft,name:e.target.value})}/></label><label>Type<select value={draft.venue_type || "shop"} onChange={e => setDraft({...draft,venue_type:e.target.value})}>{["shop","mall","college","cafe","theatre","other"].map(v=><option key={v}>{v}</option>)}</select></label><label>City<input value={draft.city || ""} onChange={e => setDraft({...draft,city:e.target.value})}/></label><label>State<input value={draft.state || ""} onChange={e => setDraft({...draft,state:e.target.value})}/></label><label>Address<input value={draft.address || ""} onChange={e => setDraft({...draft,address:e.target.value})}/></label></>}
        <div className="form-actions"><button type="button" className="secondary" onClick={() => setShowAdd(false)}>Cancel</button><button className="button" disabled={busy}>{busy ? "Saving…" : "Create record"}</button></div>
      </form>}
      <div className="toolbar"><div className="search"><Search size={16}/><input placeholder={"Search " + section.toLowerCase()} value={search} onChange={e => setSearch(e.target.value)}/></div><span>{visibleRows.length} records</span></div>
      <div className="panel"><DataTable rows={visibleRows} columns={columns[section] || []}/></div>
      </>}
      <footer>HONEYBADGER ADMIN <span>Live data from Supabase</span></footer></div>
    </main>
  </div>;
}

function DataTable({rows, columns = []}: {rows: RecordRow[]; columns?: string[]}) {
  if (!rows.length) return <div className="empty">No records found.</div>;
  const keys = columns.length ? columns : Object.keys(rows[0]).filter(k => !["id","created_at","updated_at","metadata"].includes(k)).slice(0,5);
  return <div className="table-scroll"><table><thead><tr>{keys.map(k=><th key={k}>{label(k)}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={r.id || i}>{keys.map(k=><td key={k}>{typeof r[k] === "boolean" ? <span className={r[k] ? "badge yes" : "badge"}>{r[k] ? "Active" : "Inactive"}</span> : r[k] == null || r[k] === "" ? "—" : String(r[k]).length > 70 ? String(r[k]).slice(0,67)+"…" : String(r[k])}</td>)}</tr>)}</tbody></table></div>;
}
