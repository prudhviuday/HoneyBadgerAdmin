import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Activity, Building2, Clapperboard, Film, LayoutDashboard, LogOut, Plus, QrCode, RefreshCw, CalendarDays, Search, ShieldCheck, Copy, ExternalLink, X, Save, UserRound, Phone, Mail, Clock3, ListChecks, ClipboardList, MapPin } from "lucide-react";
import "./styles.css";

type Config = { url?: string; anonKey?: string };
type RecordRow = Record<string, any>;
type Section = "Overview" | "Movies" | "Clients" | "Campaigns" | "Events & Hunts" | "Venues" | "Campaign Locations" | "QR Manager" | "User Activity" | "Activity & Tasks";
const sections: { name: Section; icon: typeof Film; table?: string }[] = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Movies", icon: Film, table: "movies" },
  { name: "Clients", icon: Building2, table: "clients" },
  { name: "Campaigns", icon: Activity, table: "campaigns" },
  { name: "Events & Hunts", icon: CalendarDays, table: "missions" },
  { name: "Venues", icon: Building2, table: "venues" },
  { name: "Campaign Locations", icon: MapPin, table: "locations" },
  { name: "QR Manager", icon: QrCode, table: "qr_codes" },
  { name: "User Activity", icon: UserRound },
  { name: "Activity & Tasks", icon: ListChecks },
];
const columns: Record<string, string[]> = {
  Movies: ["title", "client_name", "language", "release_date", "active"],
  Clients: ["name", "contact_person", "phone", "email", "active"],
  Campaigns: ["name", "movie_title", "client_name", "active"],
  "Events & Hunts": ["name", "mission_type", "reward_points", "is_active"],
  Venues: ["name", "venue_type", "city", "state", "linked_movies", "linked_campaigns", "linked_locations", "active"],
  "Campaign Locations": ["name", "category", "campaign_name", "movie_title", "venue_name", "latitude", "longitude", "points", "is_active"],
  "QR Manager": ["display_name", "short_code", "purpose", "campaign_name", "venue_name", "use_count", "is_active"],
};
const label = (v: string) => v.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
const LOCATION_CATEGORIES = ["neighborhood", "shopping", "mall", "transport", "business", "public", "beach", "industrial", "transit", "college", "cafe", "theatre", "activation", "other"];

type CampaignTaskTemplate = {
  key: string; name: string; description: string; mission_type: string;
  target_value: number; reward_points: number; reward_entries: number;
  summary: string; lockedReason?: string;
};
const STANDARD_CAMPAIGN_TASKS: CampaignTaskTemplate[] = [
  { key: "scan_first_qr", name: "Scan your first QR", description: "Scan an official QR code from this movie campaign.", mission_type: "scan_count", target_value: 1, reward_points: 15, reward_entries: 0, summary: "1 QR scan · simple starter task" },
  { key: "scan_three_qrs", name: "Scan 3 campaign QR codes", description: "Scan QR codes at three campaign placements to explore the promotion.", mission_type: "scan_count", target_value: 3, reward_points: 40, reward_entries: 0, summary: "3 accepted scans · good repeat-engagement task" },
  { key: "visit_three_locations", name: "Explore 3 campaign locations", description: "Discover three different campaign locations.", mission_type: "unique_locations", target_value: 3, reward_points: 75, reward_entries: 0, summary: "3 locations · supports location discovery" },
  { key: "refer_three_friends", name: "Refer 3 friends", description: "Invite three friends who complete the required referral sign-up.", mission_type: "referral_signup_completed", target_value: 3, reward_points: 100, reward_entries: 0, summary: "3 qualified friends · 100 points", lockedReason: "Locked until the app has a referral-invite task action and the task-progress migration is applied." },
  { key: "watch_trailer", name: "Watch the official trailer", description: "Watch the official movie trailer.", mission_type: "watch_trailer", target_value: 1, reward_points: 15, reward_entries: 0, summary: "1 trailer · 15 points", lockedReason: "Locked because opening a trailer does not prove that it was watched. A trusted watch verifier is not registered yet." },
];
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
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [returnToCampaignId, setReturnToCampaignId] = useState<string | null>(null);
  const [qrDraft, setQrDraft] = useState<RecordRow>({});
  const [qrFilters, setQrFilters] = useState({ purpose: "", campaign_id: "", venue_id: "", is_active: "" });
  const [taskSchema, setTaskSchema] = useState({ progress: false, verification: false });

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
    const [sourceResult, profileResult, categoryResult, progressProbe, verificationProbe] = await Promise.all([
      client.from("interaction_sources").select("id,name,source_type,points,reward_entries,campaign_id,is_active").limit(1000),
      client.from("profiles").select("user_id,display_name").limit(1000),
      client.from("activity_event_types").select("id,code,description,is_important").limit(1000),
      client.from("missions").select("progress_event_type_id,progress_mode").limit(1),
      client.from("missions").select("verification_action,verification_config,ui_component,ui_config").limit(1),
    ]);
    const next: Record<string, RecordRow[]> = {};
    results.forEach(r => { if (r.error) console.warn("Could not load " + r.name, r.error); next[r.name] = r.data; });
    if (sourceResult.error) console.warn("Could not load QR interaction sources", sourceResult.error);
    if (profileResult.error) console.warn("Could not load QR user profiles", profileResult.error);
    if (categoryResult.error) console.warn("Could not load activity event types", categoryResult.error);
    next["QR Sources"] = sourceResult.data || [];
    next["QR Profiles"] = profileResult.data || [];
    next["Activity Categories"] = categoryResult.data || [];
    setTaskSchema({ progress: !progressProbe.error, verification: !verificationProbe.error });
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
    e.preventDefault();
    if (!db) return;
    const table = sections.find(s => s.name === section)?.table;
    if (!table || !["Movies", "Clients", "Campaigns", "Venues", "Campaign Locations"].includes(section)) return;

    const payload: RecordRow = { ...draft };
    if (editingRecordId || editingLocationId) { delete payload.id; delete payload.created_at; delete payload.updated_at; }
    const emptyToNull = (value: unknown) => String(value ?? "").trim() || null;
    const optionalFields = (row: RecordRow, fields: string[]) => {
      for (const field of fields) row[field] = emptyToNull(row[field]);
    };

    if (section === "Movies") {
      payload.title = String(payload.title || "").trim();
      if (!payload.title) { setError("Enter a movie title."); return; }
      payload.client_id = emptyToNull(payload.client_id);
      optionalFields(payload, ["language", "release_date", "poster_url", "trailer_url", "notes"]);
      payload.active = payload.active !== false;
    }
    if (section === "Clients") {
      payload.name = String(payload.name || "").trim();
      if (!payload.name) { setError("Enter the client or production-company name."); return; }
      optionalFields(payload, ["contact_person", "phone", "email", "address", "city", "state", "notes"]);
      payload.active = payload.active !== false;
      payload.status = payload.active ? "active" : "inactive";
    }
    if (section === "Campaigns") {
      payload.name = String(payload.name || "").trim();
      if (!payload.name) { setError("Enter a campaign name."); return; }
      if (!payload.movie_id || !(rows.Movies || []).some(movie => movie.id === payload.movie_id)) {
        setError("Choose an existing movie from the Movies panel before creating the campaign."); return;
      }
      const selectedMovie = (rows.Movies || []).find(movie => movie.id === payload.movie_id);
      payload.client_id = emptyToNull(payload.client_id) || selectedMovie?.client_id || null;
      payload.media_url = emptyToNull(payload.media_url) || selectedMovie?.trailer_url || null;
      payload.terms_url = emptyToNull(payload.terms_url);
      payload.active = payload.active !== false;
    }
    if (section === "Venues") {
      payload.name = String(payload.name || "").trim();
      if (!payload.name) { setError("Enter a venue name."); return; }
      payload.active = payload.active !== false;
      payload.venue_type ||= "shop";
      payload.city ||= "Chennai";
      payload.state ||= "Tamil Nadu";
      optionalFields(payload, ["address", "pincode", "contact_person", "phone", "email", "notes"]);
    }
    if (section === "Campaign Locations") {
      payload.name = String(payload.name || "").trim();
      payload.category = String(payload.category || "").trim();
      if (!payload.name) { setError("Enter a name for this campaign map location."); return; }
      if (!payload.campaign_id || !(rows.Campaigns || []).some(campaign => campaign.id === payload.campaign_id)) {
        setError("Choose an existing campaign; its linked movie will be shown automatically."); return;
      }
      if (!payload.category) { setError("Choose a location category."); return; }
      if (String(payload.latitude ?? "").trim() === "" || String(payload.longitude ?? "").trim() === "") {
        setError("Latitude and longitude are required for a campaign map location."); return;
      }
      const latitude = Number(payload.latitude), longitude = Number(payload.longitude);
      const locationPoints = Number(payload.points ?? 0);
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        setError("Enter valid coordinates: latitude from -90 to 90 and longitude from -180 to 180."); return;
      }
      if (!Number.isInteger(locationPoints) || locationPoints < 0) {
        setError("Location points must be a non-negative whole number."); return;
      }
      payload.latitude = latitude;
      payload.longitude = longitude;
      payload.points = locationPoints;
      payload.venue_id = emptyToNull(payload.venue_id);
      payload.description = emptyToNull(payload.description);
      payload.address = emptyToNull(payload.address);
      payload.is_active = payload.is_active !== false;
      delete payload.id;
      delete payload.created_at;
    }

    const selectedTaskKeys = section === "Campaigns" && Array.isArray(payload.selected_task_keys) ? payload.selected_task_keys as string[] : [];
    const selectedTasks = STANDARD_CAMPAIGN_TASKS.filter(task => selectedTaskKeys.includes(task.key));
    if (selectedTasks.some(task => !!campaignTaskLockReason(task))) {
      setError("One or more selected task templates are not ready for production yet. Remove the locked task(s) and choose a supported template."); return;
    }
    for (const task of selectedTasks) {
      const points = Number(payload.task_points?.[task.key] ?? task.reward_points);
      if (!Number.isInteger(points) || points < 0) { setError("Task rewards must be non-negative whole numbers."); return; }
    }
    delete payload.selected_task_keys;
    delete payload.task_points;

    setBusy(true); setError(""); setNotice("");
    try {
      if (section === "Campaigns" && !editingRecordId) {
        const { data: campaign, error: campaignError } = await db.from("campaigns").insert(payload).select("id").single();
        if (campaignError || !campaign) throw new Error("Could not create campaign: " + (campaignError?.message || "No campaign row was returned."));
        if (selectedTasks.length) {
          const categoryRows = rows["Activity Categories"] || [];
          const qrTaskType = categoryRows.find(type => type.code === "qr_scan_task_verified");
          const missionRows = selectedTasks.map(task => {
            const mission: RecordRow = {
              campaign_id: campaign.id, name: task.name, description: task.description,
              mission_type: task.mission_type, target_value: task.target_value,
              reward_points: Number(draft.task_points?.[task.key] ?? task.reward_points),
              reward_entries: task.reward_entries, is_active: true,
            };
            if (taskSchema.progress && taskSchema.verification && qrTaskType && ["scan_first_qr", "scan_three_qrs"].includes(task.key)) {
              mission.mission_type = "qr_scan_task_verified";
              mission.progress_event_type_id = qrTaskType.id;
              mission.progress_mode = "event_count";
              mission.verification_action = "recorded_qr_scan";
              mission.verification_config = {};
              mission.ui_component = "qr_scanner";
              mission.ui_config = { button_label: "Scan QR" };
            }
            return mission;
          });
          const { error: taskError } = await db.from("missions").insert(missionRows);
          if (taskError) {
            const { error: rollbackError } = await db.from("campaigns").delete().eq("id", campaign.id);
            const rollbackNote = rollbackError ? " The campaign row may need manual cleanup (ID " + campaign.id + ")." : " The incomplete campaign was rolled back.";
            throw new Error("Tasks could not be saved: " + taskError.message + "." + rollbackNote);
          }
        }
        setNotice("Campaign created and " + selectedTasks.length + " standard task(s) attached to it.");
      } else if (section === "Campaign Locations" && editingLocationId) {
        const { data: updated, error: updateError } = await db.from("locations").update(payload).eq("id", editingLocationId).select("id");
        if (updateError) throw new Error("Could not update campaign location: " + updateError.message);
        if (!updated?.length) throw new Error("No location was updated. Refresh and check admin permissions.");
        setNotice("Campaign location updated, including its campaign/movie and optional physical venue association.");
      } else if (editingRecordId && ["Movies", "Clients", "Campaigns", "Venues"].includes(section)) {
        const { data: updated, error: updateError } = await db.from(table).update(payload).eq("id", editingRecordId).select("id");
        if (updateError) throw new Error("Could not update record: " + updateError.message);
        if (!updated?.length) throw new Error("No record was updated. Refresh and check admin permissions.");
        setNotice((section === "Movies" ? "Movie" : section === "Clients" ? "Client" : section === "Campaigns" ? "Campaign" : "Venue") + " updated successfully.");
      } else {
        const { error: insertError } = await db.from(table).insert(payload);
        if (insertError) throw new Error("Could not create record: " + insertError.message);
        if (section === "Campaign Locations") setNotice("Campaign location created and attached to the selected campaign and map. The linked movie is derived from that campaign.");
        else setNotice((section === "Movies" ? "Movie" : section === "Clients" ? "Client" : "Venue") + " created successfully.");
      }
      const backToCampaignId = section === "Campaign Locations" ? returnToCampaignId : null;
      setShowAdd(false); setDraft({}); setEditingLocationId(null); setEditingRecordId(null); setReturnToCampaignId(null);
      await loadData();
      if (backToCampaignId) {
        const campaign = (rows.Campaigns || []).find(item => item.id === backToCampaignId);
        if (campaign) {
          setSection("Campaigns"); setEditingRecordId(campaign.id);
          setDraft({ ...campaign, selected_task_keys: [], task_points: {} }); setShowAdd(true);
        }
      }
    } catch (e: any) {
      setError(e?.message || "Could not create this record.");
    } finally {
      setBusy(false);
    }
  }

  const visibleRows = useMemo(() => {
    const base = rows[section] || [];
    if (section === "Venues") {
      return base.map(venue => {
        const locationLinks = (rows["Campaign Locations"] || []).filter(location => location.venue_id === venue.id);
        const qrLinks = (rows["QR Manager"] || []).filter(qr => qr.venue_id === venue.id && qr.campaign_id);
        const campaignIds = Array.from(new Set([...locationLinks.map(location => location.campaign_id), ...qrLinks.map(qr => qr.campaign_id)].filter(Boolean)));
        const linkedCampaigns = campaignIds.map(id => (rows.Campaigns || []).find(campaign => campaign.id === id)).filter((campaign): campaign is RecordRow => Boolean(campaign));
        const movieTitles = Array.from(new Set(linkedCampaigns.map(campaign => (rows.Movies || []).find(movie => movie.id === campaign.movie_id)?.title).filter(Boolean)));
        return {
          ...venue,
          linked_movies: movieTitles.join(" · ") || "Not linked to a movie yet",
          linked_campaigns: linkedCampaigns.map(campaign => campaign.name).join(" · ") || "Not linked to a campaign yet",
          linked_locations: locationLinks.length,
        };
      }).filter(row => JSON.stringify(row).toLowerCase().includes(search.toLowerCase()));
    }
    if (section === "Campaign Locations") {
      return base.map(location => {
        const campaign = (rows.Campaigns || []).find(item => item.id === location.campaign_id);
        const movie = (rows.Movies || []).find(item => item.id === campaign?.movie_id);
        const venue = (rows.Venues || []).find(item => item.id === location.venue_id);
        return { ...location, campaign_name: campaign?.name || "Unknown campaign", movie_title: movie?.title || "No movie linked", venue_name: venue ? venue.name + (venue.city ? " · " + venue.city : "") : "Map point only" };
      }).filter(row => JSON.stringify(row).toLowerCase().includes(search.toLowerCase()));
    }
    if (section === "Movies") {
      return base.map(row => ({ ...row, client_name: (rows.Clients || []).find(client => client.id === row.client_id)?.name || "—" }))
        .filter(row => JSON.stringify(row).toLowerCase().includes(search.toLowerCase()));
    }
    if (section === "Campaigns") {
      return base.map(row => {
        const movie = (rows.Movies || []).find(item => item.id === row.movie_id);
        const client = (rows.Clients || []).find(item => item.id === (row.client_id || movie?.client_id));
        return { ...row, movie_title: movie?.title || "No movie linked", client_name: client?.name || "—" };
      }).filter(row => JSON.stringify(row).toLowerCase().includes(search.toLowerCase()));
    }
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

  function openRecordEditor(row: RecordRow) {
    const raw = (rows[section] || []).find(item => item.id === row.id) || row;
    setEditingRecordId(raw.id);
    setEditingLocationId(null);
    setReturnToCampaignId(null);
    if (section === "Campaigns") {
      setDraft({ ...raw, selected_task_keys: [], task_points: {} });
    } else {
      setDraft({ ...raw });
    }
    setError("");
    setNotice("");
    setShowAdd(true);
    window.setTimeout(() => document.querySelector(".add-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function openLocationEditor(row: RecordRow) {
    const raw = (rows["Campaign Locations"] || []).find(item => item.id === row.id) || row;
    setEditingRecordId(null);
    setEditingLocationId(raw.id);
    setDraft({
      ...raw,
      latitude: String(raw.latitude ?? ""),
      longitude: String(raw.longitude ?? ""),
      points: String(raw.points ?? 0),
      venue_id: raw.venue_id || "",
    });
    setError("");
    setNotice("");
    setShowAdd(true);
    window.setTimeout(() => document.querySelector(".add-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  const campaignTaskLockReason = (task: CampaignTaskTemplate): string | null => {
    if (task.lockedReason) return task.lockedReason;
    if (taskSchema.progress && !taskSchema.verification && ["scan_first_qr", "scan_three_qrs", "visit_three_locations"].includes(task.key)) {
      return "The database has part of the newer task schema but is missing verifier settings. Apply the task-verification migration before using these tasks.";
    }
    if (taskSchema.progress && task.key === "visit_three_locations") {
      return "A trusted location-visit verifier is not registered yet; the newer task engine currently supports accepted QR-scan verification.";
    }
    return null;
  };

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
      <div className="content"><div className="page-title"><div><p className="eyebrow">HONEYBADGER / MANAGEMENT</p><h1>{section === "Overview" ? "Your movie universe." : section}</h1><p>{section === "Campaign Locations" ? "Map points belong to a campaign and inherit its movie. Link a saved physical venue when the map point is at a mall, college, shop or other venue. Click a row to edit." : section === "Venues" ? "Reusable physical places live here. Connect a venue to a campaign/movie from Campaign Locations." : "Manage the same live data used by the Honeybadger app."}</p></div>{["Movies","Clients","Campaigns","Venues","Campaign Locations"].includes(section) && <button className="button" onClick={() => { setError(""); setNotice(""); setEditingLocationId(null); setEditingRecordId(null); setReturnToCampaignId(null); setDraft(section === "Movies" ? { title: "", language: "Tamil", active: true, client_id: "" } : section === "Clients" ? { name: "", active: true, status: "active" } : section === "Campaigns" ? { name: "", active: true, movie_id: "", client_id: "", selected_task_keys: [], task_points: {} } : section === "Campaign Locations" ? { name: "", campaign_id: "", category: "shopping", venue_id: "", latitude: "", longitude: "", address: "", description: "", points: 20, is_active: true } : { name: "", venue_type: "shop", city: "Chennai", state: "Tamil Nadu", active: true }); setShowAdd(true); }}><Plus size={16}/> Add {section === "Venues" ? "venue" : section === "Campaign Locations" ? "campaign location" : section.slice(0,-1).toLowerCase()}</button>}</div>
      {error && <div className="error">{error}</div>}{notice && <div className="notice">{notice}</div>}
      {section === "User Activity" ? <UserActivityPanel db={db} /> : section === "Activity & Tasks" ? <ActivityTasksPanel db={db} campaigns={rows.Campaigns || []} onRefresh={loadData} /> : section === "Overview" ? <><div className="hero"><span className="eyebrow">SYSTEM OVERVIEW</span><h2>Every campaign.<br/><em>One command centre.</em></h2><p>Manage movie records, campaigns, events, partner venues and QR codes connected to your production marketing.</p></div><div className="stats">{[{name:"Movies",icon:Film},{name:"Campaigns",icon:Activity},{name:"Events & Hunts",icon:CalendarDays},{name:"Venues",icon:Building2},{name:"Campaign Locations",icon:MapPin},{name:"QR Manager",icon:QrCode},{name:"Activity & Tasks",icon:ListChecks}].map(s=><button className="stat" key={s.name} onClick={() => setSection(s.name as Section)}><s.icon size={18}/><span>{s.name}</span><b>{total(s.name)}</b></button>)}</div><div className="panel"><h3>Recent movies</h3><DataTable rows={(rows.Movies || []).slice(0,8)} columns={columns.Movies}/></div></> : <>
      {showAdd && <form className="add-form" onSubmit={addRecord}>
        <h3>{editingLocationId && section === "Campaign Locations" ? "Edit campaign location" : section === "Campaign Locations" ? "Add location to a campaign" : editingRecordId && section === "Movies" ? "Edit movie" : editingRecordId && section === "Clients" ? "Edit client / production company" : editingRecordId && section === "Campaigns" ? "Edit campaign" : editingRecordId && section === "Venues" ? "Edit venue" : section === "Venues" ? "New venue" : section === "Clients" ? "New client / production company" : section === "Campaigns" ? "New movie campaign" : "New movie"}</h3>
        {section === "Movies" && <>
          <p className="form-intro">{editingRecordId ? "Update the saved movie details. Campaigns linked to this movie will continue to reference it." : "Create the movie record first. Campaigns must select a saved movie record below; optional fields can be filled later."}</p>
          <label>Movie title <span className="required-mark">Required</span><input required value={draft.title || ""} onChange={e => setDraft({...draft,title:e.target.value})} placeholder="e.g. Mandaadi"/></label>
          <label>Production company / client<select value={draft.client_id || ""} onChange={e => setDraft({...draft,client_id:e.target.value})}><option value="">No client linked yet</option>{(rows.Clients || []).filter(client => client.active !== false).map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
          <label>Language<input value={draft.language || ""} onChange={e => setDraft({...draft,language:e.target.value})} placeholder="Tamil"/></label>
          <label>Release date<input type="date" value={draft.release_date || ""} onChange={e => setDraft({...draft,release_date:e.target.value})}/></label>
          <label>Poster image URL<input type="url" value={draft.poster_url || ""} onChange={e => setDraft({...draft,poster_url:e.target.value})} placeholder="https://…"/></label>
          <label>Official trailer URL<input type="url" value={draft.trailer_url || ""} onChange={e => setDraft({...draft,trailer_url:e.target.value})} placeholder="https://youtube.com/…"/></label>
          <label>Internal notes<textarea value={draft.notes || ""} onChange={e => setDraft({...draft,notes:e.target.value})} rows={2} placeholder="Optional production or campaign notes"/></label>
          <label className="inline-check"><input type="checkbox" checked={draft.active !== false} onChange={e => setDraft({...draft,active:e.target.checked})}/> Movie is active</label>
        </>}
        {section === "Clients" && <>
          <p className="form-intro">Save the production company or paying client once, then reuse it across movies and campaigns.</p>
          <label>Client / production company name <span className="required-mark">Required</span><input required value={draft.name || ""} onChange={e => setDraft({...draft,name:e.target.value})} placeholder="e.g. Star Pictures"/></label>
          <label>Contact person<input value={draft.contact_person || ""} onChange={e => setDraft({...draft,contact_person:e.target.value})} placeholder="Name"/></label>
          <label>Phone<input type="tel" value={draft.phone || ""} onChange={e => setDraft({...draft,phone:e.target.value})} placeholder="Contact number"/></label>
          <label>Email<input type="email" value={draft.email || ""} onChange={e => setDraft({...draft,email:e.target.value})} placeholder="producer@example.com"/></label>
          <label>Address<input value={draft.address || ""} onChange={e => setDraft({...draft,address:e.target.value})} placeholder="Office address"/></label>
          <label>City<input value={draft.city || ""} onChange={e => setDraft({...draft,city:e.target.value})} placeholder="Chennai"/></label>
          <label>State<input value={draft.state || ""} onChange={e => setDraft({...draft,state:e.target.value})} placeholder="Tamil Nadu"/></label>
          <label>Notes<textarea value={draft.notes || ""} onChange={e => setDraft({...draft,notes:e.target.value})} rows={2}/></label>
          <label className="inline-check"><input type="checkbox" checked={draft.active !== false} onChange={e => setDraft({...draft,active:e.target.checked})}/> Client is active</label>
        </>}
        {section === "Campaigns" && <>
          <p className="form-intro">{editingRecordId ? "Edit campaign details below and manage this campaign’s locations here." : "A campaign belongs to one existing movie. Choose the movie first; the production company can inherit from that movie."}</p>
          <label>Campaign name <span className="required-mark">Required</span><input required value={draft.name || ""} onChange={e => setDraft({...draft,name:e.target.value})} placeholder="e.g. Mandaadi • Chennai City Hunt"/></label>
          <label>Movie <span className="required-mark">Required</span><select required value={draft.movie_id || ""} onChange={e => { const movie = (rows.Movies || []).find(item => item.id === e.target.value); const previousMovie = (rows.Movies || []).find(item => item.id === draft.movie_id); const currentMediaIsMovieTrailer = !draft.media_url || draft.media_url === previousMovie?.trailer_url; setDraft({...draft,movie_id:e.target.value,media_url:currentMediaIsMovieTrailer ? movie?.trailer_url || "" : draft.media_url}); }}><option value="">Choose an existing movie…</option>{(rows.Movies || []).filter(movie => movie.active !== false).map(movie => <option key={movie.id} value={movie.id}>{movie.title}{movie.language ? " · " + movie.language : ""}{movie.release_date ? " · " + movie.release_date : ""}</option>)}</select>{!(rows.Movies || []).length && <small className="field-help">No movie exists yet. Cancel and create one from the Movies panel first.</small>}</label>
          <label>Client / production company<select value={draft.client_id || ""} onChange={e => setDraft({...draft,client_id:e.target.value})}><option value="">Use the movie's production company</option>{(rows.Clients || []).filter(client => client.active !== false).map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</select><small className="field-help">Leave this as-is to inherit the selected movie's client.</small></label>
          <label>Campaign media / trailer URL<input type="url" value={draft.media_url || ""} onChange={e => setDraft({...draft,media_url:e.target.value})} placeholder="Defaults to the movie trailer URL"/></label>
          <label>Terms and conditions URL<input type="url" value={draft.terms_url || ""} onChange={e => setDraft({...draft,terms_url:e.target.value})} placeholder="https://…"/></label>
          <label className="inline-check"><input type="checkbox" checked={draft.active !== false} onChange={e => setDraft({...draft,active:e.target.checked})}/> Campaign is active</label>
          {editingRecordId && <section className="campaign-location-manager">
            <div className="campaign-location-manager-head">
              <div><h4>Locations for this campaign</h4><p>These are the map points users can discover for this movie campaign.</p></div>
              <button type="button" className="button" onClick={() => {
                const campaignIdForLocation = editingRecordId;
                setReturnToCampaignId(campaignIdForLocation);
                setEditingRecordId(null); setEditingLocationId(null);
                setSection("Campaign Locations");
                setDraft({ name: "", campaign_id: campaignIdForLocation, category: "shopping", venue_id: "", latitude: "", longitude: "", address: "", description: "", points: 20, is_active: true });
                setShowAdd(true); setError(""); setNotice("");
              }}><Plus size={14}/> Add location</button>
            </div>
            <div className="campaign-location-inline-list">
              {(rows["Campaign Locations"] || []).filter(location => location.campaign_id === editingRecordId).map(location => {
                const venue = (rows.Venues || []).find(item => item.id === location.venue_id);
                return <article className="campaign-location-inline-row" key={location.id}>
                  <div><b>{location.name}</b><small>{label(location.category || "other")} · {venue ? venue.name : "Map point only"} · {Number(location.latitude).toFixed(5)}, {Number(location.longitude).toFixed(5)}</small></div>
                  <span className={location.is_active ? "badge yes" : "badge"}>{location.is_active ? "Active" : "Paused"}</span>
                  <button type="button" className="secondary" onClick={() => {
                    setReturnToCampaignId(String(editingRecordId));
                    setSection("Campaign Locations");
                    openLocationEditor(location);
                  }}>Edit</button>
                </article>;
              })}
              {!(rows["Campaign Locations"] || []).some(location => location.campaign_id === editingRecordId) && <div className="empty">No locations linked yet. Add the first location above.</div>}
            </div>
          </section>}
          {!editingRecordId && <div className="campaign-task-picker">
            <div className="campaign-task-picker-head"><div><h4>Standard campaign tasks</h4><p>Select the tasks participants can complete for points. Rewards can be adjusted per campaign.</p></div><span>{(Array.isArray(draft.selected_task_keys) ? draft.selected_task_keys : []).length} selected</span></div>
            <details className="campaign-task-dropdown">
              <summary><span>Choose tasks and adjust points</span><span>{(Array.isArray(draft.selected_task_keys) ? draft.selected_task_keys : []).length} selected <span aria-hidden="true">⌄</span></span></summary>
              <div className="campaign-task-list">
              {STANDARD_CAMPAIGN_TASKS.map(task => {
                const checked = (Array.isArray(draft.selected_task_keys) ? draft.selected_task_keys : []).includes(task.key);
                const lockReason = campaignTaskLockReason(task);
                const locked = !!lockReason;
                return <div className={"campaign-task-choice" + (locked ? " is-locked" : "")} key={task.key}>
                  <label className="campaign-task-check"><input type="checkbox" disabled={locked} checked={checked} onChange={e => { const prior = Array.isArray(draft.selected_task_keys) ? draft.selected_task_keys as string[] : []; setDraft({...draft,selected_task_keys:e.target.checked ? [...prior.filter(key => key !== task.key),task.key] : prior.filter(key => key !== task.key)}); }}/><span className="campaign-task-copy"><b>{task.name}</b><small>{task.summary}</small>{locked && <small className="task-locked-note">{lockReason}</small>}</span></label>
                  <div className="campaign-task-reward"><label>Points<input type="number" min="0" step="1" disabled={locked} value={draft.task_points?.[task.key] ?? task.reward_points} onChange={e => setDraft({...draft,task_points:{...(draft.task_points || {}),[task.key]:e.target.value}})}/></label></div>
                </div>;
              })}
              </div>
            </details>
            {!(rows.Movies || []).length && <p className="field-help">Create a movie before a campaign. Campaigns with no movie are not allowed in this form.</p>}
            {(!taskSchema.progress || !taskSchema.verification) && <p className="field-help">This database currently has the legacy task schema. QR-scan tasks can still be created, but the server-configured verification and task-progress fields will only be saved after their migrations are applied.</p>}
            <p className="field-help">Important: “Watch trailer” is shown as locked because opening a URL is not proof of watching. Once the app has a trusted watch verifier, it can be enabled here safely.</p>
          </div>}
        </>}
        {section === "Venues" && <>
          <p className="form-intro">{editingRecordId ? "Update this saved physical venue. Its campaign/movie associations are shown in the Venues table and managed through campaign locations." : "Create a reusable physical venue once. Attach it to individual campaigns from Campaign Locations; a venue can be used by several movie campaigns."}</p>
          <label>Venue name <span className="required-mark">Required</span><input required value={draft.name || ""} onChange={e => setDraft({...draft,name:e.target.value})} placeholder="e.g. Phoenix Marketcity"/></label>
          <label>Type<select value={draft.venue_type || "shop"} onChange={e => setDraft({...draft,venue_type:e.target.value})}>{["shop","mall","college","cafe","theatre","public place","other"].map(v=><option key={v}>{v}</option>)}</select></label>
          <label>City<input value={draft.city || ""} onChange={e => setDraft({...draft,city:e.target.value})} placeholder="Chennai"/></label>
          <label>State<input value={draft.state || ""} onChange={e => setDraft({...draft,state:e.target.value})} placeholder="Tamil Nadu"/></label>
          <label>Pincode<input value={draft.pincode || ""} onChange={e => setDraft({...draft,pincode:e.target.value})}/></label>
          <label>Address<input value={draft.address || ""} onChange={e => setDraft({...draft,address:e.target.value})}/></label>
          <label>Contact person<input value={draft.contact_person || ""} onChange={e => setDraft({...draft,contact_person:e.target.value})}/></label>
          <label>Phone<input type="tel" value={draft.phone || ""} onChange={e => setDraft({...draft,phone:e.target.value})}/></label>
          <label>Email<input type="email" value={draft.email || ""} onChange={e => setDraft({...draft,email:e.target.value})}/></label>
          <label>Notes<textarea rows={2} value={draft.notes || ""} onChange={e => setDraft({...draft,notes:e.target.value})}/></label>
          <label className="inline-check"><input type="checkbox" checked={draft.active !== false} onChange={e => setDraft({...draft,active:e.target.checked})}/> Venue is active</label>
        </>}
        {section === "Campaign Locations" && <>
          <p className="form-intro">Create a map point for one campaign. The movie is inherited from that campaign, and an existing physical venue can be linked without duplicating the venue record.</p>
          <label>Campaign / movie <span className="required-mark">Required</span><select required value={draft.campaign_id || ""} onChange={e => setDraft({...draft,campaign_id:e.target.value})}><option value="">Choose a campaign…</option>{(rows.Campaigns || []).map(campaign => { const movie = (rows.Movies || []).find(item => item.id === campaign.movie_id); return <option key={campaign.id} value={campaign.id}>{movie?.title || "Movie not linked"} · {campaign.name}{campaign.active ? "" : " (inactive)"}</option>; })}</select>{!(rows.Campaigns || []).length && <small className="field-help">Create a campaign first from the Campaigns panel.</small>}</label>
          <label>Location name <span className="required-mark">Required</span><input required value={draft.name || ""} onChange={e => setDraft({...draft,name:e.target.value})} placeholder="e.g. Express Avenue QR activation"/></label>
          <label>Category <span className="required-mark">Required</span><select required value={draft.category || ""} onChange={e => setDraft({...draft,category:e.target.value})}><option value="">Choose category…</option>{Array.from(new Set([...LOCATION_CATEGORIES,...(rows["Campaign Locations"] || []).map(location => location.category).filter(Boolean)])).map(category => <option key={category} value={category}>{label(category)}</option>)}</select></label>
          <label>Physical venue (optional)<select value={draft.venue_id || ""} onChange={e => setDraft({...draft,venue_id:e.target.value})}><option value="">Map point only — no venue record</option>{(rows.Venues || []).filter(venue => venue.active !== false).map(venue => <option key={venue.id} value={venue.id}>{venue.name}{venue.city ? " · " + venue.city : ""}{venue.venue_type ? " · " + venue.venue_type : ""}</option>)}</select><small className="field-help">Choose a saved mall, college, shop or other venue to show the campaign/movie against that physical place.</small></label>
          <div className="qr-field-row"><label>Latitude <span className="required-mark">Required</span><input required type="number" step="any" min="-90" max="90" value={draft.latitude ?? ""} onChange={e => setDraft({...draft,latitude:e.target.value})} placeholder="13.0827"/></label><label>Longitude <span className="required-mark">Required</span><input required type="number" step="any" min="-180" max="180" value={draft.longitude ?? ""} onChange={e => setDraft({...draft,longitude:e.target.value})} placeholder="80.2707"/></label></div>
          <label>Address / directions<input value={draft.address || ""} onChange={e => setDraft({...draft,address:e.target.value})} placeholder="Street, landmark, city"/></label>
          <label>Description<textarea rows={2} value={draft.description || ""} onChange={e => setDraft({...draft,description:e.target.value})} placeholder="What should participants find or do here?"/></label>
          <label>Points for reaching this location<input type="number" min="0" step="1" value={draft.points ?? 0} onChange={e => setDraft({...draft,points:e.target.value})}/><small className="field-help">This is the location's points field; task rewards are configured separately.</small></label>
          <label className="inline-check"><input type="checkbox" checked={draft.is_active !== false} onChange={e => setDraft({...draft,is_active:e.target.checked})}/> Campaign location is active</label>
        </>}
        <div className="form-actions"><button type="button" className="secondary" onClick={() => { setShowAdd(false); setEditingLocationId(null); }}>Cancel</button><button className="button" disabled={busy || (section === "Campaigns" && !(rows.Movies || []).length) || (section === "Campaign Locations" && !(rows.Campaigns || []).length)}>{busy ? "Saving…" : editingLocationId && section === "Campaign Locations" ? "Save location changes" : section === "Campaigns" ? "Create campaign + tasks" : section === "Campaign Locations" ? "Add campaign location" : "Create record"}</button></div>
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
      <div className="panel"><DataTable rows={visibleRows} columns={columns[section] || []} onRowClick={section === "Campaign Locations" ? openLocationEditor : ["Movies", "Campaigns", "Venues", "Clients"].includes(section) ? openRecordEditor : section === "QR Manager" ? openQrEditor : undefined}/></div>
      </>}
      <footer>HONEYBADGER ADMIN <span>Live data from Supabase</span></footer></div>
    </main>
  </div>;
}

function DataTable({rows, columns = [], onRowClick}: {rows: RecordRow[]; columns?: string[]; onRowClick?: (row: RecordRow) => void}) {
  if (!rows.length) return <div className="empty">No records found.</div>;
  const keys = columns.length ? columns : Object.keys(rows[0]).filter(k => !["id","created_at","updated_at","metadata"].includes(k)).slice(0,5);
  return <div className="table-scroll"><table><thead><tr>{keys.map(k=><th key={k}>{label(k)}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={r.id || i} className={onRowClick ? "clickable-row" : undefined} onClick={onRowClick ? () => onRowClick(r) : undefined} title={onRowClick ? "Click to edit this record" : undefined}>{keys.map(k=><td key={k}>{typeof r[k] === "boolean" ? <span className={r[k] ? "badge yes" : "badge"}>{r[k] ? "Active" : "Inactive"}</span> : r[k] == null || r[k] === "" ? "—" : String(r[k]).length > 70 ? String(r[k]).slice(0,67)+"…" : String(r[k])}</td>)}</tr>)}</tbody></table></div>;
}




type ActivityCategory = { id: number; code: string; description: string; is_important: boolean };
type TaskRow = RecordRow & {
  id: string; name: string; campaign_id: string; mission_type: string;
  target_value: number; reward_points: number; reward_entries: number; is_active: boolean;
  progress_event_type_id?: number | null; progress_mode?: string;
  verification_action?: string; verification_config?: RecordRow | null;
  ui_component?: string; ui_config?: RecordRow | null;
};
type VerificationOption = { key: string; label: string; description: string; uiComponents?: string[]; requiredEventTypeCode?: string };
type UiComponentOption = { key: string; label: string; description?: string };
const fallbackUiComponents: UiComponentOption[] = [
  { key: "generic", label: "Generic task action" },
  { key: "qr_scanner", label: "Open QR scanner" },
  { key: "open_url", label: "Open URL" },
  { key: "video_link", label: "Open trailer / video link" },
];
const fallbackVerificationOptions: VerificationOption[] = [
  { key: "event_progress", label: "Trusted event progress", description: "Progress advances from trusted events; manual completion claims are not accepted." },
  { key: "recorded_qr_scan", label: "Recent accepted QR scan", description: "Checks a recent accepted scan for this user and campaign.", uiComponents: ["qr_scanner"], requiredEventTypeCode: "qr_scan_task_verified" },
];

function ActivityTasksPanel({ db, campaigns, onRefresh }: { db: SupabaseClient; campaigns: RecordRow[]; onRefresh: () => Promise<void> }) {
  const [categories, setCategories] = useState<ActivityCategory[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [events, setEvents] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [supportsConfiguredProgress, setSupportsConfiguredProgress] = useState(false);
  const [supportsVerificationConfig, setSupportsVerificationConfig] = useState(false);
  const [verificationOptions, setVerificationOptions] = useState<VerificationOption[]>(fallbackVerificationOptions);
  const [uiComponentOptions, setUiComponentOptions] = useState<UiComponentOption[]>(fallbackUiComponents);
  const [verificationAction, setVerificationAction] = useState("event_progress");
  const [verificationConfigText, setVerificationConfigText] = useState("{}");
  const [uiComponent, setUiComponent] = useState("generic");
  const [uiConfigText, setUiConfigText] = useState("{}");
  const [taskStartsAt, setTaskStartsAt] = useState("");
  const [taskEndsAt, setTaskEndsAt] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
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
    const [categoryResult, taskResult, eventResult, progressProbe, verificationProbe, verifierCatalog] = await Promise.all([
      db.from("activity_event_types").select("id,code,description,is_important").order("id"),
      db.from("missions").select("*").order("created_at", { ascending: false }).limit(500),
      db.from("activity_events").select("*").order("created_at", { ascending: false }).limit(100),
      db.from("missions").select("progress_event_type_id,progress_mode").limit(1),
      db.from("missions").select("verification_action,verification_config,ui_component,ui_config").limit(1),
      db.functions.invoke("complete-task", { body: { action: "catalog" } }),
    ]);
    if (categoryResult.error) setError("Could not load activity categories: " + categoryResult.error.message);
    else setCategories((categoryResult.data || []) as ActivityCategory[]);
    if (taskResult.error) setError("Could not load tasks: " + taskResult.error.message);
    else setTasks((taskResult.data || []) as TaskRow[]);
    if (eventResult.error) setError("Could not load activity log: " + eventResult.error.message);
    else setEvents(eventResult.data || []);
    setSupportsConfiguredProgress(!progressProbe.error);
    setSupportsVerificationConfig(!verificationProbe.error);
    const remoteMethods = verifierCatalog.data?.methods;
    const remoteModes = verifierCatalog.data?.modes;
    const remoteUiComponents = verifierCatalog.data?.uiComponents;
    if (Array.isArray(remoteMethods) && Array.isArray(remoteModes)) {
      setVerificationOptions([
        ...remoteModes.map((method: any) => ({ key: String(method.key), label: String(method.label), description: String(method.description || ""), uiComponents: [] })),
        ...remoteMethods.map((method: any) => ({
          key: String(method.key), label: String(method.label), description: String(method.description || ""),
          uiComponents: Array.isArray(method.uiComponents) ? method.uiComponents : [],
          requiredEventTypeCode: typeof method.requiredEventTypeCode === "string" ? method.requiredEventTypeCode : undefined,
        })),
      ]);
    }
    if (Array.isArray(remoteUiComponents)) {
      setUiComponentOptions(remoteUiComponents.filter((item: any) => item && typeof item.key === "string" && typeof item.label === "string")
        .map((item: any) => ({ key: item.key, label: item.label, description: typeof item.description === "string" ? item.description : undefined })));
    }
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
    const selectedVerifier = verificationOptions.find(option => option.key === verificationAction);
    if (taskStartsAt && taskEndsAt && new Date(taskEndsAt).getTime() <= new Date(taskStartsAt).getTime()) {
      setError("Task end time must be later than its start time."); return;
    }
    let parsedVerificationConfig: RecordRow = {};
    let parsedUiConfig: RecordRow = {};
    try {
      const parsed = JSON.parse(verificationConfigText);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Verifier settings must be a JSON object.");
      parsedVerificationConfig = parsed;
      const parsedUi = JSON.parse(uiConfigText);
      if (!parsedUi || typeof parsedUi !== "object" || Array.isArray(parsedUi)) throw new Error("UI settings must be a JSON object.");
      parsedUiConfig = parsedUi;
    } catch (e: any) {
      if (supportsVerificationConfig) { setError(e?.message || "Verifier/UI settings must be valid JSON objects."); return; }
    }
    if (uiComponent === "open_url" || uiComponent === "video_link") {
      try {
        const url = new URL(String(parsedUiConfig.url || ""));
        if (!["https:", "http:"].includes(url.protocol)) throw new Error();
      } catch {
        setError('For Open URL / Trailer link, set a valid http(s) URL in UI settings JSON, e.g. {"url":"https://example.com/trailer","button_label":"Watch trailer"}.');
        return;
      }
    }
    if (!taskName.trim() || !campaignId || !Number.isInteger(targetNumber) || targetNumber < 1 ||
      !Number.isInteger(pointsNumber) || pointsNumber < 0 || !Number.isInteger(entriesNumber) || entriesNumber < 0) {
      setError("Choose a campaign and enter a target of at least 1 plus non-negative whole-number rewards.");
      return;
    }
    if (supportsConfiguredProgress && !selectedCategory) {
      setError("Choose the activity category that should advance this task.");
      return;
    }
    if (supportsVerificationConfig && selectedVerifier?.requiredEventTypeCode && selectedCategory?.code !== selectedVerifier.requiredEventTypeCode) {
      setError("Choose the '" + selectedVerifier.requiredEventTypeCode + "' activity category required by this verifier.");
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
      starts_at: taskStartsAt ? new Date(taskStartsAt).toISOString() : null,
      ends_at: taskEndsAt ? new Date(taskEndsAt).toISOString() : null,
    };
    if (!editingTaskId) payload.is_active = true;
    if (supportsConfiguredProgress && selectedCategory) {
      payload.progress_event_type_id = selectedCategory.id;
      payload.progress_mode = progressMode;
    }
    if (supportsVerificationConfig) {
      payload.verification_action = verificationAction;
      payload.verification_config = parsedVerificationConfig;
      payload.ui_component = uiComponent;
      payload.ui_config = parsedUiConfig;
    }
    let saveError: { message: string } | null = null;
    if (editingTaskId) {
      const { error } = await db.from("missions").update(payload).eq("id", editingTaskId);
      saveError = error;
    } else {
      const { error } = await db.from("missions").insert(payload);
      saveError = error;
    }
    if (saveError) setError("Could not " + (editingTaskId ? "update" : "create") + " task: " + saveError.message);
    else {
      setNotice((editingTaskId ? "Task updated" : "Task created") + (supportsVerificationConfig ? ". Task rules, verifier and UI settings are saved." : ". Apply the configurable-task-verification migration to configure verifier and UI fields."));
      setEditingTaskId(null);
      setTaskName(""); setTaskDescription(""); setTarget("3"); setPoints("50"); setEntries("0");
      setVerificationAction("event_progress"); setVerificationConfigText("{}"); setUiComponent("generic"); setUiConfigText("{}");
      setTaskStartsAt(""); setTaskEndsAt("");
      await refresh(); await onRefresh();
    }
    setSaving(false);
  }

  function editTask(task: TaskRow) {
    setEditingTaskId(task.id);
    setTaskName(task.name || "");
    setTaskDescription(task.description || "");
    setCampaignId(task.campaign_id);
    setActivityTypeId(task.progress_event_type_id == null ? "" : String(task.progress_event_type_id));
    setMissionType(task.mission_type || "");
    setProgressMode(task.progress_mode === "distinct_entities" ? "distinct_entities" : "event_count");
    setTarget(String(task.target_value ?? 1)); setPoints(String(task.reward_points ?? 0)); setEntries(String(task.reward_entries ?? 0));
    setVerificationAction(task.verification_action || "event_progress");
    setVerificationConfigText(JSON.stringify(task.verification_config || {}, null, 2));
    setUiComponent(task.ui_component || "generic");
    setUiConfigText(JSON.stringify(task.ui_config || {}, null, 2));
    setTaskStartsAt(task.starts_at ? toLocalDateTime(task.starts_at) : "");
    setTaskEndsAt(task.ends_at ? toLocalDateTime(task.ends_at) : "");
    setError(""); setNotice("");
    document.querySelector(".activity-task-grid-bottom")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function cancelTaskEdit() {
    setEditingTaskId(null); setTaskName(""); setTaskDescription(""); setTarget("3"); setPoints("50"); setEntries("0");
    setVerificationAction("event_progress"); setVerificationConfigText("{}"); setUiComponent("generic"); setUiConfigText("{}");
    setTaskStartsAt(""); setTaskEndsAt(""); setError(""); setNotice("");
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
    {!supportsVerificationConfig && !loading && <div className="activity-task-warning"><ShieldCheck size={17}/><span>Verifier and UI settings are not available in the current database schema. Apply the configurable-task-verification migration before relying on these controls.</span></div>}
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
        <h3><Plus size={17}/>{editingTaskId ? "Edit movie task" : "Create movie task"}</h3>
        <p className="activity-task-help">Configure task rules, verification, presentation and rewards without editing app code.</p>
        <label>Task name<input value={taskName} onChange={e => setTaskName(e.target.value)} placeholder="Refer 3 friends to this movie" required/></label>
        <label>Description<textarea value={taskDescription} onChange={e => setTaskDescription(e.target.value)} rows={2} placeholder="Instructions visible to participants"/></label>
        <label>Movie campaign<select value={campaignId} onChange={e => setCampaignId(e.target.value)} required><option value="">Choose campaign…</option>{campaigns.map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.name}{campaign.active ? "" : " (inactive)"}</option>)}</select></label>
        <div className="activity-task-field-row"><label>Starts at (optional)<input type="datetime-local" value={taskStartsAt} onChange={e => setTaskStartsAt(e.target.value)}/></label><label>Ends at (optional)<input type="datetime-local" value={taskEndsAt} onChange={e => setTaskEndsAt(e.target.value)}/></label></div>
        {supportsConfiguredProgress ? <><label>Qualifying activity category<select value={activityTypeId} onChange={e => setActivityTypeId(e.target.value)} required><option value="">Choose category…</option>{categories.map(item => <option key={item.id} value={item.id}>{item.id} · {item.code}</option>)}</select></label><label>Progress mode<select value={progressMode} onChange={e => setProgressMode(e.target.value as "event_count" | "distinct_entities")}><option value="event_count">Count qualifying events</option><option value="distinct_entities">Count unique friends / entities</option></select></label></> : <label>Legacy mission type<input value={missionType} onChange={e => setMissionType(e.target.value)} placeholder="referral_friend_qualified" required/></label>}
        {supportsVerificationConfig && <div className="activity-task-config-panel">
          <h4>Verification & task UI</h4>
          <label>Verification method<select value={verificationAction} onChange={e => {
            const key = e.target.value; setVerificationAction(key);
            const option = verificationOptions.find(item => item.key === key);
            if (option?.requiredEventTypeCode) {
              const category = categories.find(item => item.code === option.requiredEventTypeCode);
              if (category) setActivityTypeId(String(category.id));
            }
            if (option?.uiComponents?.[0]) setUiComponent(option.uiComponents[0]);
            else if (key === "event_progress") setUiComponent("generic");
          }} required>{verificationOptions.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
          <p className="activity-task-help">{verificationOptions.find(option => option.key === verificationAction)?.description || "Choose a registered server-side verification method."}</p>
          <label>Task UI component<select value={uiComponent} onChange={e => setUiComponent(e.target.value)}>
            {uiComponentOptions.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
          </select></label>
          {uiComponentOptions.find(option => option.key === uiComponent)?.description && <small className="activity-task-help">{uiComponentOptions.find(option => option.key === uiComponent)?.description}</small>}
          <small className="activity-task-help">A video link is presentation only. Verifying a watch requires trusted watch evidence.</small>
          <label>Verifier settings (JSON)<textarea value={verificationConfigText} onChange={e => setVerificationConfigText(e.target.value)} rows={3} spellCheck={false} placeholder='{"purpose":"vendor","venue_id":"...","scan_lookback_seconds":120}' /></label>
          <small className="activity-task-help">Optional settings narrow the server-verified evidence; they do not prove completion.</small>
          <label>UI settings (JSON)<textarea value={uiConfigText} onChange={e => setUiConfigText(e.target.value)} rows={3} spellCheck={false} placeholder='{"url":"https://...","button_label":"Watch trailer"}' /></label>
          <small className="activity-task-help">Never store credentials or correct quiz answers in presentation settings.</small>
        </div>}
        <div className="activity-task-field-row"><label>Target count<input type="number" min="1" step="1" value={target} onChange={e => setTarget(e.target.value)} required/></label><label>Reward points<input type="number" min="0" step="1" value={points} onChange={e => setPoints(e.target.value)} required/></label><label>Reward entries<input type="number" min="0" step="1" value={entries} onChange={e => setEntries(e.target.value)} required/></label></div>
        <div className="activity-task-form-actions"><button className="button" disabled={saving || campaigns.length === 0}>{saving ? "Saving…" : editingTaskId ? "Save task changes" : "Create and activate task"}</button>{editingTaskId && <button type="button" className="secondary" disabled={saving} onClick={cancelTaskEdit}>Cancel edit</button>}</div>
        <small className="activity-task-help">Reward eligibility and points are enforced by trusted server-side logic; browser-submitted progress is not proof.</small>
      </form>
      <section className="panel">
        <div className="activity-task-section-heading"><div><h3>Configured tasks</h3><p>Pause tasks without deleting their progress.</p></div><button className="icon-button" type="button" title="Refresh tasks" onClick={() => void refresh()}><RefreshCw size={15}/></button></div>
        {loading ? <div className="empty">Loading tasks…</div> : <div className="activity-task-list">{tasks.map(task => <article key={task.id} className="activity-task-card"><div className="activity-task-card-top"><div><strong>{task.name}</strong><small>{campaigns.find(campaign => campaign.id === task.campaign_id)?.name || "Unknown campaign"} · {task.progress_event_type_id != null ? categories.find(item => item.id === task.progress_event_type_id)?.code || ("Type " + task.progress_event_type_id) : task.mission_type}</small></div><span className={task.is_active ? "badge yes" : "badge"}>{task.is_active ? "Active" : "Paused"}</span></div><div className="activity-task-card-bottom"><span>Target <b>{task.target_value}</b> · Points <b>{task.reward_points}</b> · Entries <b>{task.reward_entries}</b>{task.progress_mode ? " · " + pretty(task.progress_mode) : ""} · Verify: {task.verification_action || "legacy"} · UI: {task.ui_component || "generic"}</span><div className="activity-task-actions"><button type="button" className="secondary" disabled={saving} onClick={() => editTask(task)}>Edit</button><button type="button" className="secondary" disabled={saving} onClick={() => void toggleTask(task)}>{task.is_active ? "Pause" : "Activate"}</button></div></div></article>)}{!tasks.length && <div className="empty">No tasks configured yet.</div>}</div>}
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
