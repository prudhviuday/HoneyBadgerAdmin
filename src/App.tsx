import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Activity, Building2, Clapperboard, Film, LayoutDashboard, LogOut, Plus, QrCode, RefreshCw, CalendarDays, Search, ShieldCheck, Copy, ExternalLink, X, Save, UserRound, Phone, Mail, Clock3, ListChecks, ClipboardList } from "lucide-react";
import "./styles.css";

type Config = { url?: string; anonKey?: string };
type RecordRow = Record<string, any>;
type Section = "Overview" | "Movies" | "Campaigns" | "Events & Hunts" | "Venues" | "QR Manager" | "User Activity" | "Activity & Tasks";
const sections: { name: Section; icon: typeof Film; table?: string }[] = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Movies", icon: Film, table: "movies" },
  { name: "Campaigns", icon: Activity, table: "campaigns" },
  { name: "Events & Hunts", icon: CalendarDays, table: "missions" },
  { name: "Venues", icon: Building2, table: "venues" },
  { name: "QR Manager", icon: QrCode, table: "qr_codes" },
  { name: "User Activity", icon: UserRound },
  { name: "Activity & Tasks", icon: ListChecks },
];
const columns: Record<string, string[]> = {
  Movies: ["title", "language", "release_date", "active"],
  Campaigns: ["name", "movie_id", "active"],
  "Events & Hunts": ["name", "mission_type", "reward_points", "is_active"],
  Venues: ["name", "venue_type", "city", "state", "active"],
  "QR Manager": ["display_name", "short_code", "purpose", "campaign_name", "venue_name", "use_count", "is_active"],
};
const label = (v: string) => v.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
const toLocalDateTime = (value: string) => { const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };

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
  const [selectedQr, setSelectedQr] = useState<RecordRow | null>(null);
  const [qrDraft, setQrDraft] = useState<RecordRow>({});
  const [qrFilters, setQrFilters] = useState({ purpose: "", campaign_id: "", venue_id: "", is_active: "" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/config", { cache: "no-store", headers: { Accept: "application/json" } });
        const type = response.headers.get("content-type") || "";
        if (!response.ok) throw new Error("Worker config endpoint returned HTTP " + response.status + ".");
        if (!type.includes("application/json")) throw new Error("The Worker is returning the website HTML for /api/config instead of JSON. Redeploy the Worker configuration.");
        const values = await response.json() as Config;
        if (!values.url || !values.anonKey) throw new Error("The Worker endpoint works, but VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY (or the legacy VITE_SUPABASE_ANON_KEY) is empty in Worker Variables and Secrets.");
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
    const [sourceResult, profileResult] = await Promise.all([
      client.from("interaction_sources").select("id,name,source_type,points,reward_entries,campaign_id,is_active").limit(1000),
      client.from("profiles").select("user_id,display_name").limit(1000),
    ]);
    const next: Record<string, RecordRow[]> = {};
    results.forEach(r => { if (r.error) console.warn("Could not load " + r.name, r.error); next[r.name] = r.data; });
    if (sourceResult.error) console.warn("Could not load QR interaction sources", sourceResult.error);
    if (profileResult.error) console.warn("Could not load QR user profiles", profileResult.error);
    next["QR Sources"] = sourceResult.data || [];
    next["QR Profiles"] = profileResult.data || [];
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

  const visibleRows = useMemo(() => {
    const base = rows[section] || [];
    if (section !== "QR Manager") return base.filter(row => JSON.stringify(row).toLowerCase().includes(search.toLowerCase()));
    const sources = rows["QR Sources"] || [];
    const profiles = rows["QR Profiles"] || [];
    const campaigns = rows.Campaigns || [];
    const venues = rows.Venues || [];
    const hunts = rows["Events & Hunts"] || [];
    return base.map((qr): RecordRow => {
      const source = sources.find(item => item.id === qr.interaction_source_id);
      const profile = profiles.find(item => item.user_id === qr.inviter_user_id);
      const campaign = campaigns.find(item => item.id === qr.campaign_id);
      const venue = venues.find(item => item.id === qr.venue_id);
      const hunt = hunts.find(item => item.id === qr.hunt_id);
      return { ...qr, display_name: qr.display_name || source?.name || "Unnamed QR", source_name: source?.name || "", source_type: source?.source_type || "", campaign_name: campaign?.name || qr.campaign_id, venue_name: venue?.name || "", inviter_name: profile?.display_name || "", hunt_name: hunt?.name || "" };
    }).filter(row => {
      if (!JSON.stringify(row).toLowerCase().includes(search.toLowerCase())) return false;
      if (qrFilters.purpose && String(row.purpose ?? "") !== qrFilters.purpose) return false;
      if (qrFilters.campaign_id && (qrFilters.campaign_id === "__unassigned__" ? row.campaign_id != null : String(row.campaign_id ?? "") !== qrFilters.campaign_id)) return false;
      if (qrFilters.venue_id && (qrFilters.venue_id === "__unassigned__" ? row.venue_id != null : String(row.venue_id ?? "") !== qrFilters.venue_id)) return false;
      if (qrFilters.is_active !== "" && String(row.is_active ?? "") !== qrFilters.is_active) return false;
      return true;
    });
  }, [rows, section, search, qrFilters]);
  const total = (name: string) => (rows[name] || []).length;

  function openQrEditor(row: RecordRow) {
    const raw = (rows["QR Manager"] || []).find(item => item.id === row.id) || row;
    setSelectedQr(raw);
    setQrDraft({
      ...raw,
      display_name: raw.display_name || row.source_name || "",
      max_uses: raw.max_uses == null ? "" : String(raw.max_uses),
      starts_at: raw.starts_at ? toLocalDateTime(raw.starts_at) : "",
      expires_at: raw.expires_at ? toLocalDateTime(raw.expires_at) : "",
    });
    setError("");
    setNotice("");
  }

  async function saveQr(e: FormEvent) {
    e.preventDefault();
    if (!db || !selectedQr) return;
    const name = String(qrDraft.display_name || "").trim();
    if (!name) { setError("Give this QR a name so you can identify it later."); return; }
    if (!qrDraft.campaign_id || !qrDraft.interaction_source_id) { setError("A campaign and interaction source are required for every QR."); return; }
    const nullable = (value: any) => value === "" || value == null ? null : value;
    const payload = {
      display_name: name,
      purpose: qrDraft.purpose,
      qr_type: qrDraft.qr_type,
      campaign_id: qrDraft.campaign_id,
      interaction_source_id: qrDraft.interaction_source_id,
      venue_id: nullable(qrDraft.venue_id),
      inviter_user_id: nullable(qrDraft.inviter_user_id),
      referral_code: nullable(qrDraft.referral_code),
      hunt_id: nullable(qrDraft.hunt_id),
      starts_at: nullable(qrDraft.starts_at) ? new Date(qrDraft.starts_at).toISOString() : null,
      expires_at: nullable(qrDraft.expires_at) ? new Date(qrDraft.expires_at).toISOString() : null,
      max_uses: nullable(qrDraft.max_uses) === null ? null : Number(qrDraft.max_uses),
      is_active: qrDraft.is_active === true,
    };
    if (payload.max_uses !== null && (!Number.isInteger(payload.max_uses) || payload.max_uses < 1)) { setError("Maximum uses must be a positive whole number, or leave it blank for unlimited."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const { data: savedRows, error: saveError } = await db.from("qr_codes").update(payload).eq("id", selectedQr.id).select("id");
      if (saveError) setError("Could not save QR: " + saveError.message);
      else if (!savedRows || savedRows.length === 0) setError("No QR record was updated. Your admin session may have expired, or the database policy blocked this change. Refresh the page and sign in again.");
      else {
        setNotice("QR details saved successfully.");
        setSelectedQr(null);
        await loadData();
      }
    } catch (e: any) {
      setError("Could not save QR: " + (e?.message || "Unexpected error."));
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <div className="center"><div className="loader"/><p>Connecting securely…</p></div>;
  if (configError || !db) return <div className="center"><div className="config-card"><div className="brand-icon"><Clapperboard/></div><p className="eyebrow">HONEYBADGER / ADMIN</p><h1>Configuration needs attention</h1><p>{configError || "Supabase client could not be created."}</p><div className="help"><b>Check Cloudflare Worker settings</b><span>Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY under Settings → Variables and Secrets, then redeploy.</span><span>Test <code>/api/config</code>: it must return JSON with non-empty <code>url</code> and <code>anonKey</code> fields.</span></div><button className="button" onClick={() => location.reload()}><RefreshCw size={16}/> Retry</button></div></div>;
  if (!session || !isAdmin) return <div className="center"><form className="login-card" onSubmit={signIn}><div className="brand-icon"><Clapperboard/></div><p className="eyebrow">HONEYBADGER / CONTROL ROOM</p><h1>Admin sign in</h1><p>Sign in with an existing Supabase account that has administrator access.</p><label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username"/></label><label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password"/></label>{error && <div className="error">{error}</div>}<button className="button full" disabled={busy}>{busy ? "Checking…" : "Sign in securely"}</button><small><ShieldCheck size={14}/> Protected by Supabase Auth and admin-role verification</small></form></div>;

  return <div className="layout">
    <aside className="sidebar"><div className="brand"><div className="brand-icon"><Clapperboard/></div><div><b>HONEYBADGER</b><small>ADMIN CONTROL ROOM</small></div></div><p className="eyebrow">WORKSPACE</p><nav>{sections.map(s => <button key={s.name} className={section === s.name ? "nav active" : "nav"} onClick={() => { setSection(s.name); setSearch(""); setShowAdd(false); }}><s.icon size={17}/>{s.name}{s.table && <span>{total(s.name)}</span>}</button>)}</nav><div className="side-bottom"><i/> Supabase connected <button title="Sign out" onClick={() => db.auth.signOut()}><LogOut size={16}/></button></div></aside>
    <main><header className="topbar"><span>Workspace / <b>{section}</b></span><div><span className="live">● LIVE DATA</span><button className="icon-button" title="Refresh data" onClick={() => loadData()}><RefreshCw size={16}/></button><button className="icon-button" title="Sign out" onClick={() => db.auth.signOut()}><LogOut size={16}/></button></div></header>
      <div className="content"><div className="page-title"><div><p className="eyebrow">HONEYBADGER / MANAGEMENT</p><h1>{section === "Overview" ? "Your movie universe." : section}</h1><p>Manage the same live data used by the Honeybadger app.</p></div>{["Movies","Campaigns","Venues"].includes(section) && <button className="button" onClick={() => { setDraft(section === "Movies" ? { title: "", language: "Tamil", active: true } : section === "Campaigns" ? { name: "", active: true } : { name: "", venue_type: "shop", city: "Chennai", state: "Tamil Nadu", active: true }); setShowAdd(!showAdd); }}><Plus size={16}/> Add {section === "Venues" ? "venue" : section.slice(0,-1).toLowerCase()}</button>}</div>
      {error && <div className="error">{error}</div>}{notice && <div className="notice">{notice}</div>}
      {section === "User Activity" ? <UserActivityPanel db={db} /> : section === "Activity & Tasks" ? <ActivityTasksPanel db={db} campaigns={rows.Campaigns || []} onRefresh={loadData} /> : section === "Overview" ? <><div className="hero"><span className="eyebrow">SYSTEM OVERVIEW</span><h2>Every campaign.<br/><em>One command centre.</em></h2><p>Manage movie records, campaigns, events, partner venues and QR codes connected to your production marketing.</p></div><div className="stats">{[{name:"Movies",icon:Film},{name:"Campaigns",icon:Activity},{name:"Events & Hunts",icon:CalendarDays},{name:"Venues",icon:Building2},{name:"QR Manager",icon:QrCode},{name:"Activity & Tasks",icon:ListChecks}].map(s=><button className="stat" key={s.name} onClick={() => setSection(s.name as Section)}><s.icon size={18}/><span>{s.name}</span><b>{total(s.name)}</b></button>)}</div><div className="panel"><h3>Recent movies</h3><DataTable rows={(rows.Movies || []).slice(0,8)} columns={columns.Movies}/></div></> : <>
      {showAdd && <form className="add-form" onSubmit={addRecord}><h3>New {section === "Venues" ? "venue" : section.slice(0,-1).toLowerCase()}</h3>
        {section === "Movies" && <><label>Movie title<input required value={draft.title || ""} onChange={e => setDraft({...draft,title:e.target.value})}/></label><label>Language<input value={draft.language || ""} onChange={e => setDraft({...draft,language:e.target.value})}/></label><label>Release date<input type="date" value={draft.release_date || ""} onChange={e => setDraft({...draft,release_date:e.target.value})}/></label><label>Poster URL<input type="url" value={draft.poster_url || ""} onChange={e => setDraft({...draft,poster_url:e.target.value})}/></label></>}
        {section === "Campaigns" && <><label>Campaign name<input required value={draft.name || ""} onChange={e => setDraft({...draft,name:e.target.value})}/></label><label>Movie ID<input placeholder="Paste movie UUID" value={draft.movie_id || ""} onChange={e => setDraft({...draft,movie_id:e.target.value})}/></label><label>Media URL<input type="url" value={draft.media_url || ""} onChange={e => setDraft({...draft,media_url:e.target.value})}/></label></>}
        {section === "Venues" && <><label>Venue name<input required value={draft.name || ""} onChange={e => setDraft({...draft,name:e.target.value})}/></label><label>Type<select value={draft.venue_type || "shop"} onChange={e => setDraft({...draft,venue_type:e.target.value})}>{["shop","mall","college","cafe","theatre","other"].map(v=><option key={v}>{v}</option>)}</select></label><label>City<input value={draft.city || ""} onChange={e => setDraft({...draft,city:e.target.value})}/></label><label>State<input value={draft.state || ""} onChange={e => setDraft({...draft,state:e.target.value})}/></label><label>Address<input value={draft.address || ""} onChange={e => setDraft({...draft,address:e.target.value})}/></label></>}
        <div className="form-actions"><button type="button" className="secondary" onClick={() => setShowAdd(false)}>Cancel</button><button className="button" disabled={busy}>{busy ? "Saving…" : "Create record"}</button></div>
      </form>}
      <div className="toolbar"><div className="search"><Search size={16}/><input placeholder={section === "QR Manager" ? "Search by QR name, code, venue, purpose…" : "Search " + section.toLowerCase()} value={search} onChange={e => setSearch(e.target.value)}/></div><span>{visibleRows.length} records</span></div>
      {section === "QR Manager" && selectedQr && <form className="qr-editor" onSubmit={saveQr}>
        <div className="qr-editor-head"><div><p className="eyebrow">QR DETAILS / EDIT MODE</p><h2>{qrDraft.display_name || "Unnamed QR"}</h2><p>Edit the label and scan rules. The public code itself stays unchanged so existing printed QR codes keep working.</p></div><button type="button" className="icon-button close-editor" title="Close editor" onClick={() => setSelectedQr(null)}><X size={18}/></button></div>
        <div className="qr-editor-grid">
          <section className="qr-preview"><div className="qr-image-wrap"><img alt={"QR code for " + (qrDraft.display_name || "QR")} src={"https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=" + encodeURIComponent("https://honeycomb2.prudhvi123143.workers.dev/q/" + (selectedQr.short_code || selectedQr.public_code || ""))}/></div><b>{qrDraft.display_name || "Unnamed QR"}</b><small className="mono qr-short-code">{selectedQr.short_code || "No short code"}</small><div className="qr-link-actions"><button type="button" className="secondary" onClick={() => { navigator.clipboard.writeText("https://honeycomb2.prudhvi123143.workers.dev/q/" + (selectedQr.short_code || selectedQr.public_code)); setNotice("QR link copied."); }}><Copy size={14}/> Copy link</button><button type="button" className="secondary" onClick={() => { navigator.clipboard.writeText(selectedQr.short_code || selectedQr.public_code || ""); setNotice("Short QR code copied."); }}><Copy size={14}/> Copy code</button><a className="secondary link-button" href={"https://honeycomb2.prudhvi123143.workers.dev/q/" + encodeURIComponent(selectedQr.short_code || selectedQr.public_code || "")} target="_blank" rel="noreferrer"><ExternalLink size={14}/> Open link</a></div><small className="qr-url">honeycomb2.prudhvi123143.workers.dev/q/{selectedQr.short_code || selectedQr.public_code}</small><div className="qr-stats"><span>Scans / uses<b>{selectedQr.use_count || 0}</b></span><span>Created<b>{selectedQr.created_at ? new Date(selectedQr.created_at).toLocaleDateString() : "—"}</b></span></div></section>
          <div className="qr-fields">
            <label>QR display name<input required maxLength={120} placeholder="e.g. Sri Murugan Tea Stall – T. Nagar" value={qrDraft.display_name || ""} onChange={e => setQrDraft({...qrDraft,display_name:e.target.value})}/></label>
            <div className="qr-field-row"><label>Purpose<select value={qrDraft.purpose || "general"} onChange={e => setQrDraft({...qrDraft,purpose:e.target.value})}>{[["vendor","Vendor / shop"],["mall","Mall"],["friend_invite","Friend invite"],["hunt_location","Hunt location"],["general","General"]].map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label><label>QR type<input value={qrDraft.qr_type || "generic"} onChange={e => setQrDraft({...qrDraft,qr_type:e.target.value})}/></label></div>
            <label>Campaign<select required value={qrDraft.campaign_id || ""} onChange={e => setQrDraft({...qrDraft,campaign_id:e.target.value})}><option value="">Select campaign…</option>{(rows.Campaigns || []).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label>Interaction source<select required value={qrDraft.interaction_source_id || ""} onChange={e => setQrDraft({...qrDraft,interaction_source_id:e.target.value})}><option value="">Select source…</option>{(rows["QR Sources"] || []).map(src=><option key={src.id} value={src.id}>{src.name} · {src.source_type} · {src.points} pts</option>)}</select></label>
            <div className="qr-field-row"><label>Venue / shop / mall<select value={qrDraft.venue_id || ""} onChange={e => setQrDraft({...qrDraft,venue_id:e.target.value})}><option value="">No venue linked</option>{(rows.Venues || []).map(v=><option key={v.id} value={v.id}>{v.name}{v.city ? " — " + v.city : ""}</option>)}</select></label><label>Hunt / mission<select value={qrDraft.hunt_id || ""} onChange={e => setQrDraft({...qrDraft,hunt_id:e.target.value})}><option value="">No hunt linked</option>{(rows["Events & Hunts"] || []).map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select></label></div>
            <label>Inviter user<select value={qrDraft.inviter_user_id || ""} onChange={e => setQrDraft({...qrDraft,inviter_user_id:e.target.value})}><option value="">No inviter linked</option>{(rows["QR Profiles"] || []).map(p=><option key={p.user_id} value={p.user_id}>{p.display_name || p.user_id}</option>)}</select></label>
            <label>Referral code<input value={qrDraft.referral_code || ""} onChange={e => setQrDraft({...qrDraft,referral_code:e.target.value})} placeholder="Optional referral code"/></label>
            <div className="qr-field-row"><label>Starts at<input type="datetime-local" value={qrDraft.starts_at || ""} onChange={e => setQrDraft({...qrDraft,starts_at:e.target.value})}/></label><label>Expires at<input type="datetime-local" value={qrDraft.expires_at || ""} onChange={e => setQrDraft({...qrDraft,expires_at:e.target.value})}/></label></div>
            <label>Maximum uses <small>Leave blank for unlimited uses</small><input type="number" min="1" step="1" value={qrDraft.max_uses ?? ""} onChange={e => setQrDraft({...qrDraft,max_uses:e.target.value})} placeholder="Unlimited"/></label>
            <label className="qr-active-toggle"><input type="checkbox" checked={qrDraft.is_active === true} onChange={e => setQrDraft({...qrDraft,is_active:e.target.checked})}/> QR is active and can be used</label>
            <div className="form-actions"><button type="button" className="secondary" onClick={() => setSelectedQr(null)}>Cancel</button><button className="button" disabled={busy}><Save size={15}/>{busy ? "Saving…" : "Save QR changes"}</button></div>
          </div>
        </div>
      </form>}
      {section === "QR Manager" && <div className="qr-filter-bar" aria-label="Filter QR codes">
        <div className="qr-filter-title"><b>Filter QR codes</b><span>Combine filters like a spreadsheet</span></div>
        <label>Purpose<select value={qrFilters.purpose} onChange={e => setQrFilters({...qrFilters,purpose:e.target.value})}><option value="">All purposes</option>{Array.from(new Set((rows["QR Manager"] || []).map(q => q.purpose).filter(Boolean))).sort().map(v => <option key={v} value={v}>{label(v)}</option>)}</select></label>
        <label>Campaign<select value={qrFilters.campaign_id} onChange={e => setQrFilters({...qrFilters,campaign_id:e.target.value})}><option value="">All campaigns</option>{Array.from(new Set((rows["QR Manager"] || []).map(q => q.campaign_id).filter(Boolean).map(String))).map(id => { const campaign = (rows.Campaigns || []).find(v => String(v.id) === id); return <option key={id} value={id}>{campaign?.name || id}</option>; })}{(rows["QR Manager"] || []).some(q => !q.campaign_id) && <option value="__unassigned__">Unassigned campaign</option>}</select></label>
        <label>Venue<select value={qrFilters.venue_id} onChange={e => setQrFilters({...qrFilters,venue_id:e.target.value})}><option value="">All venues</option>{Array.from(new Set((rows["QR Manager"] || []).map(q => q.venue_id).filter(Boolean).map(String))).map(id => { const venue = (rows.Venues || []).find(v => String(v.id) === id); return <option key={id} value={id}>{venue?.name || id}</option>; })}{(rows["QR Manager"] || []).some(q => !q.venue_id) && <option value="__unassigned__">Unassigned venue</option>}</select></label>
        <label>Status<select value={qrFilters.is_active} onChange={e => setQrFilters({...qrFilters,is_active:e.target.value})}><option value="">All statuses</option><option value="true">Active</option><option value="false">Inactive</option></select></label>
        <button type="button" className="secondary qr-clear-filters" onClick={() => { setQrFilters({purpose:"",campaign_id:"",venue_id:"",is_active:""}); setSearch(""); }}>Clear filters</button>
      </div>}
      <div className="panel"><DataTable rows={visibleRows} columns={columns[section] || []} onRowClick={section === "QR Manager" ? openQrEditor : undefined}/></div>
      </>}
      <footer>HONEYBADGER ADMIN <span>Live data from Supabase</span></footer></div>
    </main>
  </div>;
}

function DataTable({rows, columns = [], onRowClick}: {rows: RecordRow[]; columns?: string[]; onRowClick?: (row: RecordRow) => void}) {
  if (!rows.length) return <div className="empty">No records found.</div>;
  const keys = columns.length ? columns : Object.keys(rows[0]).filter(k => !["id","created_at","updated_at","metadata"].includes(k)).slice(0,5);
  return <div className="table-scroll"><table><thead><tr>{keys.map(k=><th key={k}>{label(k)}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={r.id || i} className={onRowClick ? "clickable-row" : undefined} onClick={onRowClick ? () => onRowClick(r) : undefined} title={onRowClick ? "Click to view and edit QR details" : undefined}>{keys.map(k=><td key={k}>{typeof r[k] === "boolean" ? <span className={r[k] ? "badge yes" : "badge"}>{r[k] ? "Active" : "Inactive"}</span> : r[k] == null || r[k] === "" ? "—" : String(r[k]).length > 70 ? String(r[k]).slice(0,67)+"…" : String(r[k])}</td>)}</tr>)}</tbody></table></div>;
}




type ActivityCategory = { id: number; code: string; description: string; is_important: boolean };
type TaskRow = RecordRow & {
  id: string; name: string; campaign_id: string; mission_type: string;
  target_value: number; reward_points: number; reward_entries: number; is_active: boolean;
  progress_event_type_id?: number | null; progress_mode?: string;
};

function ActivityTasksPanel({ db, campaigns, onRefresh }: { db: SupabaseClient; campaigns: RecordRow[]; onRefresh: () => Promise<void> }) {
  const [categories, setCategories] = useState<ActivityCategory[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [events, setEvents] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [supportsConfiguredProgress, setSupportsConfiguredProgress] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [important, setImportant] = useState(true);
  const [taskName, setTaskName] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [activityTypeId, setActivityTypeId] = useState("");
  const [missionType, setMissionType] = useState("referral_friend_qualified");
  const [progressMode, setProgressMode] = useState<"event_count" | "distinct_entities">("event_count");
  const [target, setTarget] = useState("3");
  const [points, setPoints] = useState("50");
  const [entries, setEntries] = useState("0");
  const [filter, setFilter] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    const [categoryResult, taskResult, eventResult, configProbe] = await Promise.all([
      db.from("activity_event_types").select("id,code,description,is_important").order("id"),
      db.from("missions").select("*").order("created_at", { ascending: false }).limit(500),
      db.from("activity_events").select("*").order("created_at", { ascending: false }).limit(100),
      db.from("missions").select("progress_event_type_id,progress_mode").limit(1),
    ]);
    if (categoryResult.error) setError("Could not load activity categories: " + categoryResult.error.message);
    else setCategories((categoryResult.data || []) as ActivityCategory[]);
    if (taskResult.error) setError("Could not load tasks: " + taskResult.error.message);
    else setTasks((taskResult.data || []) as TaskRow[]);
    if (eventResult.error) setError("Could not load activity log: " + eventResult.error.message);
    else setEvents(eventResult.data || []);
    setSupportsConfiguredProgress(!configProbe.error);
    setLoading(false);
  }

  useEffect(() => { void refresh(); }, [db]);

  async function createCategory(e: FormEvent) {
    e.preventDefault();
    const cleanName = displayName.trim();
    const cleanCode = code.trim();
    if (!cleanName || !/^[a-z][a-z0-9_]{2,62}$/.test(cleanCode)) {
      setError("Enter a display name and a stable code (lowercase letters, digits and underscores).");
      return;
    }
    setSaving(true); setError(""); setNotice("");
    const nextId = Math.max(0, ...categories.map(item => item.id)) + 1;
    const { error: insertError } = await db.from("activity_event_types").insert({
      id: nextId, code: cleanCode, description: description.trim() || cleanName, is_important: important,
    });
    if (insertError) setError("Could not create activity category: " + insertError.message);
    else {
      setNotice("Created activity category " + nextId + " (" + cleanCode + "). Category IDs identify the type; each occurrence has its own record.");
      setDisplayName(""); setCode(""); setDescription(""); setImportant(true);
      await refresh();
    }
    setSaving(false);
  }

  async function createTask(e: FormEvent) {
    e.preventDefault();
    const targetNumber = Number(target), pointsNumber = Number(points), entriesNumber = Number(entries);
    const selectedCategory = categories.find(item => item.id === Number(activityTypeId));
    if (!taskName.trim() || !campaignId || !Number.isInteger(targetNumber) || targetNumber < 1 ||
      !Number.isInteger(pointsNumber) || pointsNumber < 0 || !Number.isInteger(entriesNumber) || entriesNumber < 0) {
      setError("Choose a campaign and enter a target of at least 1 plus non-negative whole-number rewards.");
      return;
    }
    if (supportsConfiguredProgress && !selectedCategory) {
      setError("Choose the activity category that should advance this task.");
      return;
    }
    setSaving(true); setError(""); setNotice("");
    const payload: RecordRow = {
      name: taskName.trim(),
      description: taskDescription.trim() || null,
      campaign_id: campaignId,
      mission_type: supportsConfiguredProgress && selectedCategory ? selectedCategory.code : missionType.trim(),
      target_value: targetNumber,
      reward_points: pointsNumber,
      reward_entries: entriesNumber,
      is_active: true,
    };
    if (supportsConfiguredProgress && selectedCategory) {
      payload.progress_event_type_id = selectedCategory.id;
      payload.progress_mode = progressMode;
    }
    const { error: insertError } = await db.from("missions").insert(payload);
    if (insertError) setError("Could not create task: " + insertError.message);
    else {
      setNotice(supportsConfiguredProgress
        ? "Task created. Its selected activity category and progress mode are saved."
        : "Task created using the existing mission fields. Event-category-driven progress is not enabled in the database yet; apply the activity-task-engine migration before relying on automatic activity matching.");
      setTaskName(""); setTaskDescription(""); setTarget("3"); setPoints("50"); setEntries("0");
      await refresh(); await onRefresh();
    }
    setSaving(false);
  }

  async function toggleTask(task: TaskRow) {
    setSaving(true); setError(""); setNotice("");
    const { data, error: updateError } = await db.from("missions").update({ is_active: !task.is_active }).eq("id", task.id).select("id");
    if (updateError) setError("Could not update task: " + updateError.message);
    else if (!data?.length) setError("No task was updated. Check admin permissions and refresh.");
    else { setNotice("Task " + (task.is_active ? "paused" : "activated") + "."); await refresh(); await onRefresh(); }
    setSaving(false);
  }

  const pretty = (value: unknown) => String(value ?? "—").replace(/_/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
  const visibleEvents = events.filter(event => JSON.stringify(event).toLowerCase().includes(filter.toLowerCase()));
  const eventNumber = (event: RecordRow) => event.activity_number ?? event.id;
  const eventCode = (event: RecordRow) => categories.find(item => item.id === Number(event.event_type_id))?.code || event.event_type || "Unknown activity";

  return <div className="activity-task-page">
    <div className="page-title"><div><p className="eyebrow">ADMIN / EVENT CONFIGURATION</p><h1>Activity & task management</h1><p>Create the activity categories, movie tasks and reward rules used by Honeybadger hunts.</p></div><div className="user-activity-icon"><ListChecks size={21}/></div></div>
    {error && <div className="error" role="status">{error}</div>}
    {notice && <div className="notice" role="status">{notice}</div>}
    <div className="activity-task-metrics">
      <div><small>Activity categories</small><b>{loading ? "—" : categories.length}</b></div>
      <div><small>Configured tasks</small><b>{loading ? "—" : tasks.length}</b></div>
      <div><small>Active tasks</small><b>{loading ? "—" : tasks.filter(task => task.is_active).length}</b></div>
      <div><small>Recent activity records</small><b>{loading ? "—" : events.length}</b></div>
    </div>
    {!supportsConfiguredProgress && !loading && <div className="activity-task-warning"><ShieldCheck size={17}/><span>The database currently exposes the legacy task schema. Task creation works, but assigning a numeric activity category and counting distinct friends requires the numbered activity/task-engine migration.</span></div>}
    <div className="activity-task-grid">
      <form className="panel activity-task-form" onSubmit={createCategory}>
        <h3><Activity size={17}/> Create activity category</h3>
        <p className="activity-task-help">Register a reusable type such as a referral, QR scan, hunt start or reward earned.</p>
        <label>Display name<input value={displayName} onChange={e => { const oldAuto = displayName.toLowerCase().trim().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,""); setDisplayName(e.target.value); if (!code || code === oldAuto) setCode(e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"")); }} placeholder="Friend referral qualified" required/></label>
        <label>Stable code<input value={code} onChange={e => setCode(e.target.value)} pattern="[a-z][a-z0-9_]{2,62}" placeholder="referral_friend_qualified" required/></label>
        <label>Description<textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="When should this event be recorded?"/></label>
        <label className="activity-task-check"><input type="checkbox" checked={important} onChange={e => setImportant(e.target.checked)}/> Important for analytics</label>
        <button className="button" disabled={saving}><Plus size={15}/>{saving ? "Saving…" : "Create category"}</button>
        <small className="activity-task-help">IDs are kept stable after creation. Do not reuse an existing category ID.</small>
      </form>
      <section className="panel">
        <div className="activity-task-section-heading"><div><h3>Activity registry</h3><p>Numeric type ID · stable code · importance</p></div><button className="icon-button" type="button" title="Refresh registry" onClick={() => void refresh()}><RefreshCw size={15}/></button></div>
        {loading ? <div className="empty">Loading activity types…</div> : <div className="activity-category-list">{categories.map(item => <div key={item.id} className="activity-category-row"><b>{item.id}</b><div><strong>{item.code}</strong><small>{item.description}</small></div>{item.is_important && <span className="badge yes">Important</span>}</div>)}{!categories.length && <div className="empty">No activity categories found.</div>}</div>}
      </section>
    </div>
    <div className="activity-task-grid activity-task-grid-bottom">
      <form className="panel activity-task-form" onSubmit={createTask}>
        <h3><Plus size={17}/> Create movie task</h3>
        <p className="activity-task-help">Set the campaign, completion target and rewards.</p>
        <label>Task name<input value={taskName} onChange={e => setTaskName(e.target.value)} placeholder="Refer 3 friends to this movie" required/></label>
        <label>Description<textarea value={taskDescription} onChange={e => setTaskDescription(e.target.value)} rows={2} placeholder="Instructions visible to participants"/></label>
        <label>Movie campaign<select value={campaignId} onChange={e => setCampaignId(e.target.value)} required><option value="">Choose campaign…</option>{campaigns.map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.name}{campaign.active ? "" : " (inactive)"}</option>)}</select></label>
        {supportsConfiguredProgress ? <><label>Qualifying activity category<select value={activityTypeId} onChange={e => setActivityTypeId(e.target.value)} required><option value="">Choose category…</option>{categories.map(item => <option key={item.id} value={item.id}>{item.id} · {item.code}</option>)}</select></label><label>Progress mode<select value={progressMode} onChange={e => setProgressMode(e.target.value as "event_count" | "distinct_entities")}><option value="event_count">Count qualifying events</option><option value="distinct_entities">Count unique friends / entities</option></select></label></> : <label>Legacy mission type<input value={missionType} onChange={e => setMissionType(e.target.value)} placeholder="referral_friend_qualified" required/></label>}
        <div className="activity-task-field-row"><label>Target count<input type="number" min="1" step="1" value={target} onChange={e => setTarget(e.target.value)} required/></label><label>Reward points<input type="number" min="0" step="1" value={points} onChange={e => setPoints(e.target.value)} required/></label><label>Reward entries<input type="number" min="0" step="1" value={entries} onChange={e => setEntries(e.target.value)} required/></label></div>
        <button className="button" disabled={saving || campaigns.length === 0}>{saving ? "Saving…" : "Create and activate task"}</button>
        <small className="activity-task-help">This configures the task. Reward eligibility must be validated by trusted server-side logic, not browser-submitted points.</small>
      </form>
      <section className="panel">
        <div className="activity-task-section-heading"><div><h3>Configured tasks</h3><p>Pause tasks without deleting their progress.</p></div><button className="icon-button" type="button" title="Refresh tasks" onClick={() => void refresh()}><RefreshCw size={15}/></button></div>
        {loading ? <div className="empty">Loading tasks…</div> : <div className="activity-task-list">{tasks.map(task => <article key={task.id} className="activity-task-card"><div className="activity-task-card-top"><div><strong>{task.name}</strong><small>{campaigns.find(campaign => campaign.id === task.campaign_id)?.name || "Unknown campaign"} · {task.progress_event_type_id != null ? categories.find(item => item.id === task.progress_event_type_id)?.code || ("Type " + task.progress_event_type_id) : task.mission_type}</small></div><span className={task.is_active ? "badge yes" : "badge"}>{task.is_active ? "Active" : "Paused"}</span></div><div className="activity-task-card-bottom"><span>Target <b>{task.target_value}</b> · Points <b>{task.reward_points}</b> · Entries <b>{task.reward_entries}</b>{task.progress_mode ? " · " + pretty(task.progress_mode) : ""}</span><button type="button" className="secondary" disabled={saving} onClick={() => void toggleTask(task)}>{task.is_active ? "Pause" : "Activate"}</button></div></article>)}{!tasks.length && <div className="empty">No tasks configured yet.</div>}</div>}
      </section>
    </div>
    <section className="panel activity-log-panel">
      <div className="activity-task-section-heading"><div><h3><ClipboardList size={17}/> Recent activity log</h3><p>Each row is one occurrence; type IDs describe the category.</p></div><div className="activity-log-actions"><span>{visibleEvents.length} events</span><button className="icon-button" type="button" title="Refresh activity log" onClick={() => void refresh()}><RefreshCw size={15}/></button></div></div>
      <div className="search activity-log-search"><Search size={15}/><input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter by type, user, campaign, entity…"/></div>
      {loading ? <div className="empty">Loading activity…</div> : <div className="table-scroll"><table><thead><tr>{["Occurrence / record ID","Type ID","Activity type","User","Campaign","Entity","Recorded"].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{visibleEvents.map(event => <tr key={String(event.id)}><td><code>{String(eventNumber(event)).slice(0,18)}</code></td><td>{event.event_type_id ?? "—"}</td><td>{eventCode(event)}</td><td><code>{event.user_id ? String(event.user_id).slice(0,8) + "…" : "system"}</code></td><td>{campaigns.find(campaign => campaign.id === event.campaign_id)?.name || (event.campaign_id ? String(event.campaign_id).slice(0,8) + "…" : "—")}</td><td>{pretty(event.entity_type)}{event.entity_id ? " · " + String(event.entity_id).slice(0,8) + "…" : ""}</td><td><AdminDate value={event.created_at}/></td></tr>)}</tbody></table>{!visibleEvents.length && <div className="empty">No activity records match this filter.</div>}</div>}
    </section>
  </div>;
}


type AdminUserSearchResult = {
  user_id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  last_active_at: string | null;
  activity_count: number;
};
type AdminUserActivity = {
  id: string;
  created_at: string;
  campaign_id: string | null;
  campaign_name: string | null;
  event_type_id: number | null;
  event_type: string | null;
  event_description: string | null;
  entity_type: string | null;
  entity_id: string | null;
  location_id: string | null;
  origin: string;
  metadata: Record<string, unknown> | null;
};
type AdminUserActivityResponse = {
  user: {
    user_id: string;
    display_name: string;
    email: string | null;
    phone: string | null;
    created_at: string;
    last_active_at: string | null;
  };
  activities: AdminUserActivity[];
};

function AdminDate({ value }: { value: string | null | undefined }) {
  return <>{value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"}</>;
}

type UserTrackPoint = { id: string; lat: number; lon: number; label: string; recordedAt: string };
function UserTrackMap({ points }: { points: UserTrackPoint[] }) {
  if (!points.length) return null;
  const lats = points.map(p => p.lat), lons = points.map(p => p.lon);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const midLon = (Math.min(...lons) + Math.max(...lons)) / 2;
  const span = Math.max((Math.max(...lons) - Math.min(...lons)) * Math.max(Math.cos(midLat * Math.PI / 180), 0.1), Math.max(...lats) - Math.min(...lats), 0.002);
  const zoom = Math.max(3, Math.min(18, Math.floor(Math.log2(1080 / span))));
  const scale = 256 * Math.pow(2, zoom);
  const world = (lat: number, lon: number) => {
    const safeLat = Math.max(-85.0511, Math.min(85.0511, lat));
    const sin = Math.sin(safeLat * Math.PI / 180);
    return { x: (lon + 180) / 360 * scale, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale };
  };
  const center = world(midLat, midLon);
  const tileX = Math.floor(center.x / 256), tileY = Math.floor(center.y / 256);
  const screen = (point: UserTrackPoint) => {
    const p = world(point.lat, point.lon);
    return { x: 384 + p.x - center.x, y: 256 + p.y - center.y };
  };
  const plotted = points.map(point => ({ ...point, ...screen(point) }));
  const tiles = [];
  for (let x = tileX - 1; x <= tileX + 1; x++) for (let y = tileY - 1; y <= tileY + 1; y++) {
    const wrappedX = ((x % Math.pow(2, zoom)) + Math.pow(2, zoom)) % Math.pow(2, zoom);
    tiles.push({ key: zoom + "-" + wrappedX + "-" + y, x: 384 + x * 256 - center.x, y: 256 + y * 256 - center.y, url: "https://tile.openstreetmap.org/" + zoom + "/" + wrappedX + "/" + y + ".png" });
  }
  return <div className="user-map-frame">
    <svg className="user-track-map" viewBox="0 0 768 512" role="img" aria-label="Map showing the user's recorded activity locations and track">
      <rect width="768" height="512" fill="#e5e4df"/>
      {tiles.filter(tile => tile.y > -256 && tile.y < 512).map(tile => <image key={tile.key} href={tile.url} x={tile.x} y={tile.y} width="256" height="256" />)}
      {plotted.length > 1 && <polyline points={plotted.map(p => p.x + "," + p.y).join(" ")} fill="none" stroke="#f56f2c" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />}
      {plotted.map((point,index) => <g key={point.id}><circle cx={point.x} cy={point.y} r={index === plotted.length - 1 ? 10 : 7} fill={index === plotted.length - 1 ? "#f56f2c" : "#fff"} stroke="#28282c" strokeWidth="3"><title>{point.label + " · " + point.recordedAt}</title></circle><text x={point.x + 11} y={point.y - 10} fontSize="13" fontWeight="700" fill="#171719" stroke="#fff" strokeWidth="3" paintOrder="stroke">{index + 1}</text></g>)}
    </svg>
    <div className="user-map-caption"><span>{points.length} recorded point{points.length === 1 ? "" : "s"} · Map track oldest → newest</span><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a></div>
  </div>;
}

function UserActivityPanel({ db }: { db: SupabaseClient }) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<AdminUserSearchResult[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [detail, setDetail] = useState<AdminUserActivityResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  async function runSearch(e: FormEvent) {
    e.preventDefault();
    const term = query.trim();
    if (term.length < 2) { setError("Enter at least 2 characters, or paste a full user UUID."); return; }
    setSearching(true); setError(""); setSearched(true); setUsers([]); setSelectedUserId(""); setDetail(null);
    try {
      const { data, error: rpcError } = await db.rpc("admin_search_users", { p_query: term, p_limit: 25 });
      if (rpcError) throw rpcError;
      const matches = (data?.users ?? []) as AdminUserSearchResult[];
      setUsers(matches);
      if (!matches.length) setError("No users matched that name, phone number, email or UUID.");
    } catch (e: any) {
      setError("User search failed: " + (e?.message || "Check admin permissions and try again."));
    } finally { setSearching(false); }
  }

  async function openUser(user: AdminUserSearchResult) {
    setSelectedUserId(user.user_id); setLoadingDetail(true); setError(""); setDetail(null);
    try {
      const { data, error: rpcError } = await db.rpc("admin_get_user_activity", { p_user_id: user.user_id, p_limit: 150 });
      if (rpcError) throw rpcError;
      setDetail(data as AdminUserActivityResponse);
    } catch (e: any) {
      setError("Could not load activity: " + (e?.message || "Admin permission may have changed."));
    } finally { setLoadingDetail(false); }
  }

  const pretty = (value: string | null | undefined) => (value || "Activity").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const locationEvents = (detail?.activities ?? []).filter(item => {
    const meta = item.metadata ?? {};
    return Number.isFinite(Number(meta.location_latitude)) &&
      Number.isFinite(Number(meta.location_longitude)) &&
      meta.location_latitude !== null && meta.location_latitude !== undefined &&
      meta.location_longitude !== null && meta.location_longitude !== undefined;
  }).reverse();
  const latestLocation = locationEvents[locationEvents.length - 1];
  const locationOf = (item: AdminUserActivity) => ({
    lat: Number(item.metadata?.location_latitude),
    lon: Number(item.metadata?.location_longitude),
  });
  const trackLats = locationEvents.map(item => locationOf(item).lat);
  const trackLons = locationEvents.map(item => locationOf(item).lon);
  const minLat = Math.min(...trackLats), maxLat = Math.max(...trackLats);
  const minLon = Math.min(...trackLons), maxLon = Math.max(...trackLons);
  const trackSvgPoints = locationEvents.map(item => {
    const point = locationOf(item);
    return {
      id: item.id,
      x: 20 + ((point.lon - minLon) / (maxLon - minLon || 0.00001)) * 260,
      y: 20 + (1 - ((point.lat - minLat) / (maxLat - minLat || 0.00001))) * 120,
    };
  });
  const fieldClass = "admin-user-search-input";

  return <div className="user-activity-page">
    <div className="page-title"><div><p className="eyebrow">ADMIN / USER INSIGHTS</p><h1>User activity</h1><p>Search by name, phone, email or user UUID. This view is available only inside the administrator console.</p></div><div className="user-activity-icon"><Activity size={21}/></div></div>
    <form className="user-search-card" onSubmit={runSearch}>
      <label htmlFor="admin-user-search">Find a user</label>
      <div className="user-search-row"><div className="user-search-field"><Search size={16}/><input id="admin-user-search" className={fieldClass} value={query} onChange={e => setQuery(e.target.value)} placeholder="Name, phone, email or user UUID" autoComplete="off"/></div><button className="button" disabled={searching}>{searching ? <RefreshCw size={15} className="spin"/> : <Search size={15}/>} {searching ? "Searching…" : "Search users"}</button></div>
      <small>Phone search works best with at least the last 4 digits.</small>
    </form>
    {error && <div className="error" role="status">{error}</div>}
    {users.length > 0 && <section className="user-results"><div className="user-results-heading"><h2>Matching users</h2><span>{users.length} result{users.length === 1 ? "" : "s"}</span></div><div className="user-result-list">
      {users.map(user => <button type="button" key={user.user_id} onClick={() => void openUser(user)} className={"user-result" + (selectedUserId === user.user_id ? " selected" : "")}>
        <span className="user-avatar"><UserRound size={18}/></span><span className="user-result-content"><span className="user-result-top"><b>{user.display_name || "Unnamed user"}</b><small>{user.activity_count} logged events</small></span><span className="user-contact">{user.email && <span><Mail size={12}/>{user.email}</span>}{user.phone && <span><Phone size={12}/>{user.phone}</span>}</span><code>{user.user_id}</code></span>
      </button>)}
    </div></section>}
    {searched && !searching && users.length === 0 && !error && <div className="user-empty">No matching users found.</div>}
    {loadingDetail && <div className="user-empty">Loading activity history…</div>}
    {detail && !loadingDetail && <section className="user-detail-card">
      <div className="user-detail-head"><div><small>SELECTED USER</small><h2>{detail.user.display_name || "Unnamed user"}</h2><div className="user-contact">{detail.user.email && <span><Mail size={13}/>{detail.user.email}</span>}{detail.user.phone && <span><Phone size={13}/>{detail.user.phone}</span>}</div></div><button type="button" className="secondary" onClick={() => { const user = users.find(u => u.user_id === selectedUserId); if (user) void openUser(user); }}><RefreshCw size={13}/> Refresh</button></div>
      <div className="user-metrics"><div><small>Events loaded</small><b>{detail.activities.length}</b></div><div><small>Joined</small><b><AdminDate value={detail.user.created_at}/></b></div><div><small>Last active</small><b><AdminDate value={detail.user.last_active_at}/></b></div></div>
      <code className="user-uuid">{detail.user.user_id}</code>
      <section className="user-location-section">
        <div className="user-timeline-heading"><h3>Location history & track</h3><small>{locationEvents.length} activity location{locationEvents.length === 1 ? "" : "s"}</small></div>
        {locationEvents.length === 0 ? <div className="user-empty">No coordinates recorded for these events. Ordinary events only use location when browser permission is already granted; QR scan attempts request location for that event. Permission denials and unavailable locations are still recorded in the activity timeline. No background tracking is used.</div> : <>
          <UserTrackMap points={locationEvents.map(item => {
            const point = locationOf(item);
            return {
              id: item.id,
              lat: point.lat,
              lon: point.lon,
              label: pretty(item.event_description || item.event_type),
              recordedAt: String(item.metadata?.location_recorded_at || item.created_at),
            };
          })} />
          <div className="user-track-card">
            <div className="user-track-card-head"><b>Recorded movement points</b><small>Oldest → newest · points come from logged activities</small></div>
            {locationEvents.length > 1 && <svg className="user-track-plot" viewBox="0 0 300 160" role="img" aria-label="Relative movement between recorded activity locations">
              <path d="M 20 20 V 140 H 280" fill="none" stroke="#393a42" strokeWidth="1"/>
              <polyline points={trackSvgPoints.map(point => point.x + "," + point.y).join(" ")} fill="none" stroke="#ff9a62" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
              {trackSvgPoints.map((point,index) => <circle key={point.id} cx={point.x} cy={point.y} r={index === trackSvgPoints.length - 1 ? 5 : 3.5} fill={index === trackSvgPoints.length - 1 ? "#ff9a62" : "#eee"} stroke="#18191f" strokeWidth="1.5"><title>{"Point " + (index + 1)}</title></circle>)}
            </svg>}
            <ol className="user-track-list">{locationEvents.slice().reverse().map((item,index) => {
              const point = locationOf(item);
              const accuracy = item.metadata?.location_accuracy_m;
              const locationUrl = "https://www.openstreetmap.org/?mlat=" + point.lat + "&mlon=" + point.lon + "#map=17/" + point.lat + "/" + point.lon;
              return <li key={item.id}><span className="user-track-number">{locationEvents.length - index}</span><div><b>{pretty(item.event_description || item.event_type)}</b><small><AdminDate value={item.metadata?.location_recorded_at as string || item.created_at}/>{accuracy != null ? " · ±" + accuracy + " m accuracy" : ""}</small><code>{point.lat.toFixed(6)}, {point.lon.toFixed(6)}</code></div><a href={locationUrl} target="_blank" rel="noreferrer" aria-label="Open this location in OpenStreetMap">Map ↗</a></li>;
            })}</ol>
          </div>
        </>}
      </section>
      <div className="user-timeline-heading"><h3>Recent activity timeline</h3><small>Newest first · up to 150 events</small></div>
      {!detail.activities.length ? <div className="user-empty">No activity events have been recorded for this user yet.</div> : <ol className="user-timeline">{detail.activities.map(item => <li key={item.id}><span className="timeline-icon"><Activity size={15}/></span><div className="timeline-body"><div className="timeline-title-row"><b>{pretty(item.event_description || item.event_type)}</b><span><Clock3 size={12}/><AdminDate value={item.created_at}/></span></div><div className="timeline-tags">{item.campaign_name && <span>{item.campaign_name}</span>}{item.event_type_id != null && <span>Event #{item.event_type_id}</span>}{item.entity_type && <span>{pretty(item.entity_type)}</span>}{item.origin && <span>{item.origin}</span>}{item.metadata?.location_status != null && String(item.metadata.location_status) !== "" && <span className={item.metadata.location_verified === true ? "badge yes" : "badge"}>Location: {String(item.metadata.location_status).replace(/_/g, " ")}{item.metadata.location_verified === true ? " · verified" : " · not verified"}</span>}</div>{item.metadata && Object.keys(item.metadata).length > 0 && <details><summary>Event details</summary><pre>{JSON.stringify(item.metadata, null, 2)}</pre></details>}{item.entity_id && <code className="user-entity-id">Entity ID: {item.entity_id}</code>}</div></li>)}</ol>}
    </section>}
  </div>;
}
