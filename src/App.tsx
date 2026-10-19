import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Activity, Building2, Clapperboard, Film, LayoutDashboard, LogOut, Plus, QrCode, RefreshCw, CalendarDays, Search, ShieldCheck, Copy, ExternalLink, X, Save, UserRound, Phone, Mail, Clock3, ListChecks, ClipboardList, MapPin } from "lucide-react";
import "./styles.css";
import { ActivityTasksPanel, UserActivityPanel } from "./AdminPanels";

type Config = { url?: string; anonKey?: string };
type RecordRow = Record<string, any>;
type Section = "Overview" | "Movies" | "Clients" | "Campaigns" | "Events & Hunts" | "Venues" | "Campaign Locations" | "QR Manager" | "Activations" | "Leads" | "Invoices" | "Expenses" | "User Activity" | "Activity & Tasks";
const sections: { name: Section; icon: typeof Film; table?: string }[] = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Movies", icon: Film, table: "movies" },
  { name: "Clients", icon: Building2, table: "clients" },
  { name: "Campaigns", icon: Activity, table: "campaigns" },
  { name: "Events & Hunts", icon: CalendarDays, table: "missions" },
  { name: "Venues", icon: Building2, table: "venues" },
  { name: "Campaign Locations", icon: MapPin, table: "locations" },
  { name: "QR Manager", icon: QrCode, table: "qr_codes" },
  { name: "Activations", icon: ClipboardList, table: "activations" },
  { name: "Leads", icon: UserRound, table: "leads" },
  { name: "Invoices", icon: Save, table: "invoices" },
  { name: "Expenses", icon: Activity, table: "expenses" },
  { name: "User Activity", icon: UserRound },
  { name: "Activity & Tasks", icon: ListChecks },
];
const columns: Record<string, string[]> = {
  Movies: ["title", "client_name", "language", "release_date", "active"],
  Clients: ["name", "contact_person", "phone", "email", "active"],
  Campaigns: ["name", "movie_title", "client_name", "active"],
  "Events & Hunts": ["name", "mission_type", "reward_points", "is_active"],
  Venues: ["name", "venue_type", "city", "state", "coordinates", "linked_movies", "linked_campaigns", "linked_locations", "active"],
  "Campaign Locations": ["name", "category", "campaign_name", "movie_title", "venue_name", "latitude", "longitude", "points", "is_active"],
  "QR Manager": ["display_name", "short_code", "purpose", "campaign_name", "venue_name", "use_count", "is_active"],
  Activations: ["name", "shop_code", "campaign_name", "venue_name", "active"],
  Leads: ["name", "phone", "email", "campaign_name", "activation_name", "verified_via", "consent_given"],
  Invoices: ["invoice_number", "client_name", "campaign_name", "issue_date", "due_date", "total_amount", "status"],
  Expenses: ["campaign_name", "category", "description", "vendor", "expense_date", "amount"],
};
const TABLE_DEPENDENCIES: Record<Section, string[]> = {
  Overview: ["Movies", "Clients"],
  Movies: ["Movies", "Clients"],
  Clients: ["Clients"],
  Campaigns: ["Campaigns", "Movies", "Clients", "Venues", "Campaign Locations"],
  "Events & Hunts": ["Events & Hunts", "Campaigns"],
  Venues: ["Venues", "Campaign Locations", "Campaigns", "Movies", "QR Manager"],
  "Campaign Locations": ["Campaign Locations", "Campaigns", "Movies", "Venues"],
  "QR Manager": ["QR Manager", "Campaigns", "Movies", "Venues", "Campaign Locations", "Events & Hunts"],
  Activations: ["Activations", "Campaigns", "Venues"],
  Leads: ["Leads", "Campaigns", "Activations"],
  Invoices: ["Invoices", "Clients", "Campaigns"],
  Expenses: ["Expenses", "Campaigns"],
  "User Activity": [],
  "Activity & Tasks": ["Campaigns"],
};
const DATA_COLUMNS: Record<string, string> = {
  Movies: "id,title,client_id,language,release_date,poster_url,trailer_url,active,notes,created_at",
  Clients: "id,name,contact_person,phone,email,address,city,state,notes,status,active,created_at",
  Campaigns: "id,name,media_url,terms_url,active,created_at,client_id,movie_id",
  Venues: "id,name,address,city,state,pincode,venue_type,contact_person,phone,email,active,notes,created_at,latitude,longitude",
  "Campaign Locations": "id,campaign_id,name,category,description,latitude,longitude,address,points,is_active,created_at,venue_id",
  "QR Manager": "id,campaign_id,interaction_source_id,qr_type,is_active,starts_at,expires_at,max_uses,use_count,created_at,purpose,public_code,venue_id,inviter_user_id,referral_code,hunt_id,display_name,short_code",
  Activations: "id,campaign_id,name,shop_code,venue_name,created_at,venue_id,active",
  Leads: "id,campaign_id,activation_id,name,phone,email,verified_via,consent_given,consent_at,created_at",
  Invoices: "id,client_id,campaign_id,invoice_number,issue_date,due_date,amount,tax_amount,total_amount,status,notes,created_at",
  Expenses: "id,campaign_id,category,description,amount,expense_date,vendor,notes,created_at",
  "Events & Hunts": "*",
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
  const [locationPickerSearch, setLocationPickerSearch] = useState("");
  const [qrDraft, setQrDraft] = useState<RecordRow>({});
  const [qrFilters, setQrFilters] = useState({ purpose: "", campaign_id: "", venue_id: "", is_active: "" });
  const [taskSchema, setTaskSchema] = useState({ progress: false, verification: false });
  const [loadWarning, setLoadWarning] = useState("");
  const [lookupLoaded, setLookupLoaded] = useState({ qr: false, categories: false });
  const [venueCoordinatesAvailable, setVenueCoordinatesAvailable] = useState(false);
  const [loadedTables, setLoadedTables] = useState<Record<string, boolean>>({});
  const [rowCounts, setRowCounts] = useState<Record<string, number>>({});
  const [countsLoaded, setCountsLoaded] = useState(false);

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
      else { setIsAdmin(true); }
      if (!cancelled) setBusy(false);
    })();
    return () => { cancelled = true; };
  }, [db, session]);

  async function loadData(client = db, force = true) {
    if (!client) return;
    const requiredNames = TABLE_DEPENDENCIES[section] || [];
    const namesToLoad = requiredNames.filter(name => force || !loadedTables[name]);
    const needsVenues = namesToLoad.includes("Venues");
    let supportsVenueCoordinates = venueCoordinatesAvailable;
    if (needsVenues) {
      // Venue coordinates are an additive migration. Detect it so the UI remains usable
      // against the current production schema while that migration is pending.
      const probe = await client.from("venues").select("latitude,longitude").limit(1);
      supportsVenueCoordinates = !probe.error;
      setVenueCoordinatesAvailable(supportsVenueCoordinates);
    }

    const pageSize = 500;
    const dataPromise = Promise.all(namesToLoad.map(async name => {
      const sectionInfo = sections.find(item => item.name === name && item.table);
      if (!sectionInfo?.table) return { name, data: [] as RecordRow[], count: null as number | null, error: new Error("No table mapping exists.") };
      const allRows: RecordRow[] = [];
      const baseColumns = DATA_COLUMNS[name] || "*";
      const selection = name === "Venues" && !supportsVenueCoordinates
        ? baseColumns.replace(",latitude,longitude", "")
        : baseColumns;
      let count: number | null = null;
      for (let offset = 0; ; offset += pageSize) {
        const { data, error, count: pageCount } = await client.from(sectionInfo.table)
          .select(selection, { count: "exact" })
          .order("id", { ascending: true })
          .range(offset, offset + pageSize - 1);
        if (error) return { name, data: allRows, count, error };
        if (offset === 0) count = pageCount ?? 0;
        const page = (data || []) as RecordRow[];
        allRows.push(...page);
        if (page.length < pageSize) break;
      }
      return { name, data: allRows, count: count ?? allRows.length, error: null };
    }));

    const countPromise = countsLoaded ? Promise.resolve(null) : Promise.all(
      sections.filter(item => item.table).map(async item => {
        const { count, error } = await client.from(item.table!).select("id", { count: "exact", head: true });
        return { name: item.name, count: count ?? 0, error };
      })
    );
    if (!countsLoaded) setCountsLoaded(true);
    const [results, countResults] = await Promise.all([dataPromise, countPromise]);
    const failed = results.filter(result => result.error);
    const next: Record<string, RecordRow[]> = {};
    const nextLoaded: Record<string, boolean> = {};
    const nextCounts: Record<string, number> = {};
    results.forEach(result => {
      if (!result.error) {
        next[result.name] = result.data;
        nextLoaded[result.name] = true;
        if (result.count != null) nextCounts[result.name] = result.count;
      }
    });
    if (countResults) countResults.forEach(result => {
      if (!result.error) nextCounts[result.name] = result.count;
    });
    if (failed.length) {
      setLoadWarning("Some admin data could not be loaded (" + failed.map(result => result.name + ": " + (result.error?.message || "unknown error")).join("; ") + "). The last successful data is retained where available. Refresh after checking permissions or schema.");
    } else {
      setLoadWarning("");
    }
    setRows(current => ({ ...current, ...next }));
    setLoadedTables(current => ({ ...current, ...nextLoaded }));
    setRowCounts(current => ({ ...current, ...nextCounts }));

    const missionRows = results.find(result => result.name === "Events & Hunts")?.data || rows["Events & Hunts"] || [];
    if (missionRows.length) {
      const keys = new Set(Object.keys(missionRows[0]));
      setTaskSchema({
        progress: keys.has("progress_event_type_id") && keys.has("progress_mode"),
        verification: keys.has("verification_action") && keys.has("verification_config") && keys.has("ui_component") && keys.has("ui_config"),
      });
    } else if (namesToLoad.includes("Events & Hunts")) {
      const [progressProbe, verificationProbe] = await Promise.all([
        client.from("missions").select("progress_event_type_id,progress_mode").limit(1),
        client.from("missions").select("verification_action,verification_config,ui_component,ui_config").limit(1),
      ]);
      setTaskSchema({ progress: !progressProbe.error, verification: !verificationProbe.error });
    }
  }
  async function loadQrLookups(client = db, force = false) {
    if (!client || (lookupLoaded.qr && !force)) return;
    const [sourceResult, profileResult] = await Promise.all([
      client.from("interaction_sources").select("id,name,source_type,points,reward_entries,campaign_id,is_active,location_id").order("name").limit(1000),
      client.from("profiles").select("user_id,display_name").order("display_name").limit(1000),
    ]);
    const errors = [
      sourceResult.error ? "interaction sources: " + sourceResult.error.message : "",
      profileResult.error ? "user profiles: " + profileResult.error.message : "",
    ].filter(Boolean);
    if (errors.length) setLoadWarning("QR lookups could not fully load (" + errors.join("; ") + "). Refresh the QR panel after checking permissions.");
    setRows(current => ({
      ...current,
      ...(sourceResult.error ? {} : { "QR Sources": sourceResult.data || [] }),
      ...(profileResult.error ? {} : { "QR Profiles": profileResult.data || [] }),
    }));
    if (!sourceResult.error && !profileResult.error) setLookupLoaded(current => ({ ...current, qr: true }));
  }

  async function loadActivityCategories(client = db, force = false) {
    if (!client || (lookupLoaded.categories && !force)) return;
    const { data, error: categoryError } = await client.from("activity_event_types")
      .select("id,code,description,is_important").order("id").limit(1000);
    if (categoryError) {
      setLoadWarning("Activity categories could not be loaded: " + categoryError.message + ". Refresh the Campaigns panel after checking permissions.");
      return;
    }
    setRows(current => ({ ...current, "Activity Categories": data || [] }));
    setLookupLoaded(current => ({ ...current, categories: true }));
  }

  useEffect(() => {
    if (!db || !isAdmin) return;
    void loadData(db, false);
    if (section === "QR Manager") void loadQrLookups(db);
    if (section === "Campaigns") void loadActivityCategories(db);
  }, [db, isAdmin, section]);
  async function signIn(e: FormEvent) {
    e.preventDefault(); if (!db) return;
    setBusy(true); setError("");
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setBusy(false);
  }

  async function addRecord(e: FormEvent) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const finishLocationAfterSave = submitter?.dataset.locationSaveMode !== "another";
    if (!db) return;
    const table = sections.find(s => s.name === section)?.table;
    if (!table || !["Movies", "Clients", "Campaigns", "Venues", "Campaign Locations", "Activations", "Leads", "Invoices", "Expenses"].includes(section)) return;

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
      if (venueCoordinatesAvailable) {
        const latText = String(payload.latitude ?? "").trim();
      const lonText = String(payload.longitude ?? "").trim();
      if (Boolean(latText) !== Boolean(lonText)) { setError("Enter both venue latitude and longitude, or leave both blank."); return; }
      if (!latText) {
        payload.latitude = null;
        payload.longitude = null;
      } else {
        const latitude = Number(latText), longitude = Number(lonText);
        if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
          setError("Enter valid venue coordinates: latitude from -90 to 90 and longitude from -180 to 180."); return;
        }
        payload.latitude = latitude;
        payload.longitude = longitude;
        }
      } else {
        // Older schema: keep the normal venue form functional, omitting fields that are
        // not present until the additive migration has been applied.
        delete payload.latitude;
        delete payload.longitude;
      }
    }
    if (section === "Activations") {
      payload.name = String(payload.name || "").trim();
      payload.shop_code = String(payload.shop_code || "").trim();
      if (!payload.name || !payload.shop_code || !payload.campaign_id) { setError("Activation name, unique shop code and campaign are required."); return; }
      payload.venue_id = emptyToNull(payload.venue_id);
      payload.venue_name = emptyToNull(payload.venue_name);
      payload.active = payload.active !== false;
      optionalFields(payload, ["shop_code", "venue_name"]);
    }
    if (section === "Leads") {
      payload.name = String(payload.name || "").trim();
      payload.phone = String(payload.phone || "").trim();
      if (!payload.name || !payload.phone || !payload.campaign_id) { setError("Lead name, phone and campaign are required."); return; }
      payload.activation_id = emptyToNull(payload.activation_id);
      optionalFields(payload, ["email", "verified_via"]);
      payload.verified_via ||= "manual";
      if (payload.consent_given !== true) { setError("Confirm consent before creating or updating a lead contact record."); return; }
      payload.consent_at = payload.consent_at || new Date().toISOString();
    }
    if (section === "Invoices") {
      payload.invoice_number = String(payload.invoice_number || "").trim();
      if (!payload.invoice_number) { setError("Enter an invoice number."); return; }
      payload.client_id = emptyToNull(payload.client_id);
      payload.campaign_id = emptyToNull(payload.campaign_id);
      const amount = Number(payload.amount ?? 0), tax = Number(payload.tax_amount ?? 0);
      if (![amount, tax].every(value => Number.isFinite(value) && value >= 0)) { setError("Invoice amount and tax must be non-negative numbers."); return; }
      payload.amount = amount; payload.tax_amount = tax; payload.total_amount = amount + tax;
      payload.issue_date ||= new Date().toISOString().slice(0,10);
      payload.due_date = emptyToNull(payload.due_date);
      payload.status ||= "draft";
      optionalFields(payload, ["notes"]);
    }
    if (section === "Expenses") {
      payload.campaign_id = emptyToNull(payload.campaign_id);
      payload.category = String(payload.category || "").trim();
      const amount = Number(payload.amount ?? 0);
      if (!payload.campaign_id || !payload.category || !Number.isFinite(amount) || amount < 0) { setError("Expense campaign, category and a non-negative amount are required."); return; }
      payload.amount = amount;
      payload.expense_date ||= new Date().toISOString().slice(0,10);
      optionalFields(payload, ["description", "vendor", "notes"]);
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
    let createdCampaignForEditing: RecordRow | null = null;
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
        createdCampaignForEditing = { ...payload, id: campaign.id };
        setNotice("Campaign created and " + selectedTasks.length + " standard task(s) attached. Add its locations below.");
      } else if (section === "Campaign Locations" && editingLocationId) {
        const { data: updated, error: updateError } = await db.from("locations").update(payload).eq("id", editingLocationId).select("id");
        if (updateError) throw new Error("Could not update campaign location: " + updateError.message);
        if (!updated?.length) throw new Error("No location was updated. Refresh and check admin permissions.");
        setNotice("Campaign location updated, including its campaign/movie and optional physical venue association.");
      } else if (editingRecordId && ["Movies", "Clients", "Campaigns", "Venues", "Activations", "Leads", "Invoices", "Expenses"].includes(section)) {
        const { data: updated, error: updateError } = await db.from(table).update(payload).eq("id", editingRecordId).select("id");
        if (updateError) throw new Error("Could not update record: " + updateError.message);
        if (!updated?.length) throw new Error("No record was updated. Refresh and check admin permissions.");
        const recordNames: Record<string, string> = { Movies: "Movie", Clients: "Client", Campaigns: "Campaign", Venues: "Venue", Activations: "Activation", Leads: "Lead", Invoices: "Invoice", Expenses: "Expense" };
        setNotice((recordNames[section] || section) + " updated successfully.");
      } else {
        const { error: insertError } = await db.from(table).insert(payload);
        if (insertError) throw new Error("Could not create record: " + insertError.message);
        if (section === "Campaign Locations") setNotice("Campaign location created and attached to the selected campaign and map. The linked movie is derived from that campaign.");
        else {
          const recordNames: Record<string, string> = { Movies: "Movie", Clients: "Client", Venues: "Venue", Activations: "Activation", Leads: "Lead", Invoices: "Invoice", Expenses: "Expense" };
          setNotice((recordNames[section] || section) + " created successfully.");
        }
      }
      const backToCampaignId = section === "Campaign Locations" ? returnToCampaignId : null;
      const keepAddingLocations = section === "Campaign Locations" && Boolean(backToCampaignId) && !editingLocationId && !finishLocationAfterSave;
      if (keepAddingLocations && backToCampaignId) {
        setEditingLocationId(null); setEditingRecordId(null); setShowAdd(true);
        setDraft({ name: "", campaign_id: backToCampaignId, category: "shopping", venue_id: "", latitude: "", longitude: "", address: "", description: "", points: 20, is_active: true });
        setLocationPickerSearch("");
        await loadData();
        setNotice("Location saved. Add another location, or choose Finish & return to movie when you're done.");
        return;
      }
      setShowAdd(false); setDraft({}); setEditingLocationId(null); setEditingRecordId(null); setReturnToCampaignId(null); setLocationPickerSearch("");
      await loadData();
      if (createdCampaignForEditing) {
        setSection("Campaigns"); setEditingRecordId(createdCampaignForEditing.id);
        setDraft({ ...createdCampaignForEditing, selected_task_keys: [], task_points: {} }); setShowAdd(true);
      } else if (backToCampaignId) {
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

  async function addExistingMapPointToCampaign(source: RecordRow) {
    if (!db) return;
    const targetCampaignId = String(draft.campaign_id || returnToCampaignId || "");
    if (!targetCampaignId || !(rows.Campaigns || []).some(campaign => campaign.id === targetCampaignId)) {
      setError("Choose the campaign first, then add a saved map point to it."); return;
    }
    if (String(source.campaign_id) === targetCampaignId) {
      setError("This map point is already on the selected campaign. Edit the existing row instead of adding a duplicate."); return;
    }
    if (String(draft.name || "").trim() || String(draft.latitude ?? "").trim() || String(draft.longitude ?? "").trim()) {
      setError("Save the current location draft or clear it before reusing another saved map point."); return;
    }
    const latitude = Number(source.latitude), longitude = Number(source.longitude), points = Number(source.points ?? 0);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180 || !Number.isInteger(points) || points < 0) {
      setError("This saved map point has invalid coordinates or points, so it cannot be reused safely."); return;
    }
    const campaignLocations = rows["Campaign Locations"] || [];
    const duplicate = campaignLocations.some(location => location.campaign_id === targetCampaignId &&
      String(location.name || "").trim().toLowerCase() === String(source.name || "").trim().toLowerCase() &&
      Number(location.latitude) === latitude && Number(location.longitude) === longitude);
    if (duplicate) {
      setError("This venue or map point already appears on the selected campaign. Open Campaign Locations to edit that existing entry."); return;
    }
    const payload = {
      campaign_id: targetCampaignId,
      name: String(source.name || "").trim(),
      category: String(source.category || "other"),
      description: source.description || null,
      latitude,
      longitude,
      address: source.address || null,
      points,
      is_active: true,
      venue_id: source.venue_id || null,
    };
    if (!payload.name) { setError("The saved map point has no name and cannot be reused."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const { error: insertError } = await db.from("locations").insert(payload);
      if (insertError) throw new Error("Could not add this map point to the campaign: " + insertError.message);
      setLocationPickerSearch("");
      setEditingRecordId(null); setEditingLocationId(null); setShowAdd(true);
      setDraft({ name: "", campaign_id: targetCampaignId, category: "shopping", venue_id: "", latitude: "", longitude: "", address: "", description: "", points: 20, is_active: true });
      await loadData();
      setNotice("Added “" + payload.name + "” to this campaign. Its original pin is unchanged. Add more locations now, then click Finish & return to movie.");
    } catch (e: any) {
      setError(e?.message || "Could not reuse this campaign location.");
    } finally { setBusy(false); }
  }

  function finishLocationFlow(discardDraft = false) {
    const targetCampaignId = returnToCampaignId;
    if (!targetCampaignId) { setError("No movie campaign is attached to this location workflow."); return; }
    if (!discardDraft && (String(draft.name || "").trim() || String(draft.latitude ?? "").trim() || String(draft.longitude ?? "").trim())) {
      setError("This location form has unsaved details. Save the location, or use Finish without saving to discard it."); return;
    }
    const campaign = (rows.Campaigns || []).find(item => item.id === targetCampaignId);
    if (!campaign) { setError("The campaign could not be found. Refresh and open the movie campaign again."); return; }
    setSection("Campaigns");
    setEditingRecordId(campaign.id);
    setEditingLocationId(null);
    setReturnToCampaignId(null);
    setDraft({ ...campaign, selected_task_keys: [], task_points: {} });
    setShowAdd(true);
    setLocationPickerSearch("");
    setError("");
    setNotice("Saved campaign locations are now visible in the movie campaign editor.");
  }

  function useVenueDetails(venue: RecordRow) {
    const venueType = String(venue.venue_type || "").toLowerCase();
    const category = venueType === "shop" ? "shopping" : ["mall", "college", "cafe", "theatre", "public"].includes(venueType) ? venueType : "other";
    const address = [venue.address, venue.city, venue.state, venue.pincode].filter(value => String(value || "").trim()).join(", ");
    setDraft(current => ({
      ...current,
      name: venue.name || "",
      category,
      venue_id: venue.id,
      address,
      latitude: venue.latitude == null ? "" : String(venue.latitude),
      longitude: venue.longitude == null ? "" : String(venue.longitude),
      description: current.description || "",
      points: current.points ?? 20,
      is_active: true,
    }));
    setNotice(venue.latitude != null && venue.longitude != null
      ? "Venue details and saved coordinates loaded. You can still adjust the map pin for this campaign."
      : "Venue details loaded. Save this venue's latitude and longitude in Venues, or enter coordinates for this campaign map pin.");
    setError("");
  }

  const locationLibraryResults = useMemo(() => {
    const query = locationPickerSearch.trim().toLowerCase();
    const campaignLocations = rows["Campaign Locations"] || [];
    const points = campaignLocations
      .slice()
      .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
      .map(location => {
        const campaign = (rows.Campaigns || []).find(item => item.id === location.campaign_id);
        const movie = (rows.Movies || []).find(item => item.id === campaign?.movie_id);
        const venue = (rows.Venues || []).find(item => item.id === location.venue_id);
        const title = String(location.name || "Unnamed map point");
        const subtitle = [movie?.title, campaign?.name, label(location.category || "other"), venue?.name, venue?.city, location.address].filter(Boolean).join(" · ");
        return { kind: "map-point" as const, id: location.id, item: location, title, subtitle, searchText: [title, subtitle].join(" ").toLowerCase() };
      });
    const venues = (rows.Venues || [])
      .filter(venue => venue.active !== false)
      .map(venue => {
        const title = String(venue.name || "Unnamed venue");
        const subtitle = [label(venue.venue_type || "venue"), venue.city, venue.state, venue.address, venue.pincode,
          venue.latitude != null && venue.longitude != null ? Number(venue.latitude).toFixed(5) + ", " + Number(venue.longitude).toFixed(5) : "coordinates not saved"].filter(Boolean).join(" · ");
        return { kind: "venue" as const, id: venue.id, item: venue, title, subtitle, searchText: [title, subtitle].join(" ").toLowerCase() };
      });
    return [...points, ...venues].filter(result => !query || result.searchText.includes(query)).slice(0, 8);
  }, [rows, locationPickerSearch]);

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
          coordinates: venue.latitude != null && venue.longitude != null ? Number(venue.latitude).toFixed(5) + ", " + Number(venue.longitude).toFixed(5) : "Coordinates not saved",
        };
      }).filter(row => JSON.stringify(row).toLowerCase().includes(search.toLowerCase()));
    }
    if (section === "Activations") {
      return base.map(row => {
        const campaign = (rows.Campaigns || []).find(item => item.id === row.campaign_id);
        const venue = (rows.Venues || []).find(item => item.id === row.venue_id);
        return { ...row, campaign_name: campaign?.name || row.campaign_id, venue_name: venue?.name || row.venue_name || "—" };
      }).filter(row => JSON.stringify(row).toLowerCase().includes(search.toLowerCase()));
    }
    if (section === "Leads") {
      return base.map(row => ({
        ...row,
        campaign_name: (rows.Campaigns || []).find(item => item.id === row.campaign_id)?.name || row.campaign_id,
        activation_name: (rows.Activations || []).find(item => item.id === row.activation_id)?.name || "—",
      })).filter(row => JSON.stringify(row).toLowerCase().includes(search.toLowerCase()));
    }
    if (section === "Invoices") {
      return base.map(row => ({
        ...row,
        client_name: (rows.Clients || []).find(item => item.id === row.client_id)?.name || "—",
        campaign_name: (rows.Campaigns || []).find(item => item.id === row.campaign_id)?.name || "—",
      })).filter(row => JSON.stringify(row).toLowerCase().includes(search.toLowerCase()));
    }
    if (section === "Expenses") {
      return base.map(row => ({ ...row, campaign_name: (rows.Campaigns || []).find(item => item.id === row.campaign_id)?.name || row.campaign_id }))
        .filter(row => JSON.stringify(row).toLowerCase().includes(search.toLowerCase()));
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
  const total = (name: string) => loadedTables[name] ? (rows[name] || []).length : (rowCounts[name] ?? 0);
  const mismatchedQrRecords = (rows["QR Manager"] || []).filter(qr => {
    const source = (rows["QR Sources"] || []).find(item => String(item.id) === String(qr.interaction_source_id));
    return source && String(source.campaign_id) !== String(qr.campaign_id);
  });

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
    const linkedSource = (rows["QR Sources"] || []).find(item => String(item.id) === String(raw.interaction_source_id));
    const sourceMismatch = linkedSource && String(linkedSource.campaign_id) !== String(raw.campaign_id);
    setSelectedQr(raw);
    setQrDraft({
      ...raw,
      interaction_source_id: sourceMismatch ? "" : raw.interaction_source_id,
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
    const selectedSource = (rows["QR Sources"] || []).find(source => String(source.id) === String(qrDraft.interaction_source_id));
    if (!selectedSource) { setError("Select a valid interaction source for this QR."); return; }
    if (String(selectedSource.campaign_id) !== String(qrDraft.campaign_id)) { setError("The interaction source belongs to a different campaign. Select a source from the chosen campaign."); return; }
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
    <aside className="sidebar"><div className="brand"><div className="brand-icon"><Clapperboard/></div><div><b>HONEYBADGER</b><small>ADMIN CONTROL ROOM</small></div></div><p className="eyebrow">WORKSPACE</p><nav>{sections.filter(s => s.name !== "Events & Hunts").map(s => <button key={s.name} className={section === s.name ? "nav active" : "nav"} onClick={() => { setSection(s.name); setSearch(""); setShowAdd(false); setEditingRecordId(null); setEditingLocationId(null); setReturnToCampaignId(null); setDraft({}); }}><s.icon size={17}/>{s.name}{s.table && <span>{total(s.name)}</span>}</button>)}</nav><div className="side-bottom"><i/> Supabase connected <button title="Sign out" onClick={() => db.auth.signOut()}><LogOut size={16}/></button></div></aside>
    <main><header className="topbar"><span>Workspace / <b>{section}</b></span><div><span className="live">● LIVE DATA</span><button className="icon-button" title="Refresh data" onClick={() => { void loadData(); if (section === "QR Manager") { setLookupLoaded(current => ({ ...current, qr: false })); void loadQrLookups(db, true); } if (section === "Campaigns") { setLookupLoaded(current => ({ ...current, categories: false })); void loadActivityCategories(db, true); } }}><RefreshCw size={16}/></button><button className="icon-button" title="Sign out" onClick={() => db.auth.signOut()}><LogOut size={16}/></button></div></header>
      <div className="content">{loadWarning && <div className="error" role="status">{loadWarning}</div>}<div className="page-title"><div><p className="eyebrow">HONEYBADGER / MANAGEMENT</p><h1>{section === "Overview" ? "Your movie universe." : section}</h1><p>{section === "Campaign Locations" ? "Campaign-specific map pins store coordinates, category and points. Search and reuse an existing pin across campaigns instead of entering its details again." : section === "Venues" ? "Reusable physical place records—create each mall, college, shop or theatre once. Campaign Locations are separate campaign-specific map pins that can link to a venue." : ["Movies", "Campaigns", "Clients"].includes(section) ? "Click a row in the table to edit the saved record. Campaigns also let you add and edit their locations." : "Manage the same live data used by the Honeybadger app."}</p></div>{["Movies","Clients","Campaigns","Venues","Campaign Locations","Activations","Leads","Invoices","Expenses"].includes(section) && <button className="button" onClick={() => { setError(""); setNotice(""); setEditingLocationId(null); setEditingRecordId(null); setReturnToCampaignId(null); setLocationPickerSearch(""); setDraft(section === "Movies" ? { title: "", language: "Tamil", active: true, client_id: "" } : section === "Clients" ? { name: "", active: true, status: "active" } : section === "Campaigns" ? { name: "", active: true, movie_id: "", client_id: "", selected_task_keys: [], task_points: {} } : section === "Campaign Locations" ? { name: "", campaign_id: "", category: "shopping", venue_id: "", latitude: "", longitude: "", address: "", description: "", points: 20, is_active: true } : section === "Venues" ? { name: "", venue_type: "shop", city: "Chennai", state: "Tamil Nadu", active: true } : section === "Activations" ? { name: "", shop_code: "", campaign_id: "", venue_id: "", venue_name: "", active: true } : section === "Leads" ? { name: "", phone: "", email: "", campaign_id: "", activation_id: "", verified_via: "manual", consent_given: true } : section === "Invoices" ? { invoice_number: "", client_id: "", campaign_id: "", issue_date: new Date().toISOString().slice(0,10), due_date: "", amount: 0, tax_amount: 0, total_amount: 0, status: "draft", notes: "" } : { campaign_id: "", category: "", description: "", amount: 0, expense_date: new Date().toISOString().slice(0,10), vendor: "", notes: "" }); setShowAdd(true); }}><Plus size={16}/> Add {section === "Venues" ? "venue" : section === "Campaign Locations" ? "campaign location" : section.slice(0,-1).toLowerCase()}</button>}</div>
      {error && <div className="error">{error}</div>}{notice && <div className="notice">{notice}</div>}
      {section === "User Activity" ? <UserActivityPanel db={db} /> : section === "Activity & Tasks" ? <ActivityTasksPanel db={db} campaigns={rows.Campaigns || []} onRefresh={loadData} /> : section === "Overview" ? <><div className="hero"><span className="eyebrow">SYSTEM OVERVIEW</span><h2>Every campaign.<br/><em>One command centre.</em></h2><p>Manage movie records, campaigns, events, partner venues and QR codes connected to your production marketing.</p></div><div className="stats">{[{name:"Movies",icon:Film},{name:"Campaigns",icon:Activity},{name:"Venues",icon:Building2},{name:"Campaign Locations",icon:MapPin},{name:"QR Manager",icon:QrCode},{name:"Activations",icon:ClipboardList},{name:"Leads",icon:UserRound},{name:"Invoices",icon:Save},{name:"Expenses",icon:Activity},{name:"Activity & Tasks",icon:ListChecks}].map(s=><button className="stat" key={s.name} onClick={() => setSection(s.name as Section)}><s.icon size={18}/><span>{s.name}</span><b>{total(s.name)}</b></button>)}</div><div className="panel"><h3>Recent movies</h3><DataTable rows={(rows.Movies || []).slice(0,8)} columns={columns.Movies}/></div></> : <>
      {showAdd && <form className="add-form" onSubmit={addRecord}>
        <h3>{editingLocationId && section === "Campaign Locations" ? "Edit campaign location" : section === "Campaign Locations" ? "Add location to a campaign" : editingRecordId && section === "Movies" ? "Edit movie" : editingRecordId && section === "Clients" ? "Edit client / production company" : editingRecordId && section === "Campaigns" ? "Edit campaign" : editingRecordId && section === "Venues" ? "Edit venue" : editingRecordId && section === "Activations" ? "Edit activation" : editingRecordId && section === "Leads" ? "Edit lead" : editingRecordId && section === "Invoices" ? "Edit invoice" : editingRecordId && section === "Expenses" ? "Edit expense" : section === "Venues" ? "New venue" : section === "Clients" ? "New client / production company" : section === "Campaigns" ? "New movie campaign" : section === "Activations" ? "New activation" : section === "Leads" ? "New lead" : section === "Invoices" ? "New invoice" : section === "Expenses" ? "New expense" : "New movie"}</h3>
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
          <label>Movie <span className="required-mark">Required</span><select required value={draft.movie_id || ""} onChange={e => { const movie = (rows.Movies || []).find(item => item.id === e.target.value); const previousMovie = (rows.Movies || []).find(item => item.id === draft.movie_id); const currentClientIsMovieClient = !draft.client_id || draft.client_id === previousMovie?.client_id; const currentMediaIsMovieTrailer = !draft.media_url || draft.media_url === previousMovie?.trailer_url; setDraft({...draft,movie_id:e.target.value,client_id:currentClientIsMovieClient ? movie?.client_id || "" : draft.client_id,media_url:currentMediaIsMovieTrailer ? movie?.trailer_url || "" : draft.media_url}); }}><option value="">Choose an existing movie…</option>{(rows.Movies || []).filter(movie => movie.active !== false || movie.id === draft.movie_id).map(movie => <option key={movie.id} value={movie.id}>{movie.title}{movie.language ? " · " + movie.language : ""}{movie.release_date ? " · " + movie.release_date : ""}{movie.active === false ? " (inactive)" : ""}</option>)}</select>{!(rows.Movies || []).length && <small className="field-help">No movie exists yet. Cancel and create one from the Movies panel first.</small>}</label>
          <label>Client / production company<select value={draft.client_id || ""} onChange={e => setDraft({...draft,client_id:e.target.value})}><option value="">Use the movie's production company</option>{(rows.Clients || []).filter(client => client.active !== false).map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</select><small className="field-help">{(() => { const movie = (rows.Movies || []).find(item => item.id === draft.movie_id); return movie?.client_id && draft.client_id === movie.client_id ? "Using the selected movie's production company." : draft.client_id ? "Custom campaign client override." : "Leave blank to inherit the movie's production company."; })()}</small></label>
          <label>Campaign media / trailer URL<input type="url" value={draft.media_url || ""} onChange={e => setDraft({...draft,media_url:e.target.value})} placeholder="Defaults to the movie trailer URL"/><small className="field-help">Defaults follow the selected movie. Enter a different URL only when this campaign needs a custom media link.</small></label>
          <div className="campaign-default-actions"><small className="field-help">Reset inherited fields if you changed a movie or want to remove custom overrides.</small><button type="button" className="secondary" onClick={() => { const movie = (rows.Movies || []).find(item => item.id === draft.movie_id); setDraft({...draft,client_id:movie?.client_id || "",media_url:movie?.trailer_url || ""}); }}>Use movie defaults</button></div>
          <label>Terms and conditions URL<input type="url" value={draft.terms_url || ""} onChange={e => setDraft({...draft,terms_url:e.target.value})} placeholder="https://…"/></label>
          <label className="inline-check"><input type="checkbox" checked={draft.active !== false} onChange={e => setDraft({...draft,active:e.target.checked})}/> Campaign is active</label>
          {editingRecordId && <section className="campaign-location-manager">
            <div className="campaign-location-manager-head">
              <div><h4>Locations for this campaign</h4><p>These are the map points users can discover for this movie campaign.</p></div>
              <button type="button" className="button" onClick={() => {
                const campaignIdForLocation = editingRecordId;
                setReturnToCampaignId(campaignIdForLocation);
                setLocationPickerSearch("");
                setEditingRecordId(null); setEditingLocationId(null);
                setSection("Campaign Locations");
                setDraft({ name: "", campaign_id: campaignIdForLocation, category: "shopping", venue_id: "", latitude: "", longitude: "", address: "", description: "", points: 20, is_active: true });
                setShowAdd(true); setError(""); setNotice("");
              }}><Plus size={14}/> Find / reuse location</button>
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
          {venueCoordinatesAvailable ? <>
            <div className="qr-field-row venue-coordinates-row"><label>Venue latitude<input type="number" step="any" min="-90" max="90" value={draft.latitude ?? ""} onChange={e => setDraft({...draft,latitude:e.target.value})} placeholder="13.0827"/></label><label>Venue longitude<input type="number" step="any" min="-180" max="180" value={draft.longitude ?? ""} onChange={e => setDraft({...draft,longitude:e.target.value})} placeholder="80.2707"/></label></div>
            <small className="field-help">Store the venue's general coordinates once. A campaign location may use these by default and still override them for a specific entrance, shop or QR placement.</small>
          </> : <small className="field-help">Venue coordinate fields are ready in the admin code but need the venue-coordinates database migration applied before they can be stored. Campaign locations can still have their own coordinates.</small>}
          <label>Contact person<input value={draft.contact_person || ""} onChange={e => setDraft({...draft,contact_person:e.target.value})}/></label>
          <label>Phone<input type="tel" value={draft.phone || ""} onChange={e => setDraft({...draft,phone:e.target.value})}/></label>
          <label>Email<input type="email" value={draft.email || ""} onChange={e => setDraft({...draft,email:e.target.value})}/></label>
          <label>Notes<textarea rows={2} value={draft.notes || ""} onChange={e => setDraft({...draft,notes:e.target.value})}/></label>
          <label className="inline-check"><input type="checkbox" checked={draft.active !== false} onChange={e => setDraft({...draft,active:e.target.checked})}/> Venue is active</label>
        </>}
        {section === "Activations" && <>
          <p className="form-intro">Register the physical activation or QR-placement code. The saved venue name can remain as a historical snapshot while venue_id links to the reusable venue record.</p>
          <label>Activation name <span className="required-mark">Required</span><input required value={draft.name || ""} onChange={e => setDraft({...draft,name:e.target.value})} placeholder="e.g. T. Nagar partner activation"/></label>
          <label>Shop / activation code <span className="required-mark">Required</span><input required value={draft.shop_code || ""} onChange={e => setDraft({...draft,shop_code:e.target.value})} placeholder="e.g. TNAGAR-001"/></label>
          <label>Campaign <span className="required-mark">Required</span><select required value={draft.campaign_id || ""} onChange={e => setDraft({...draft,campaign_id:e.target.value})}><option value="">Choose campaign…</option>{(rows.Campaigns || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Physical venue<select value={draft.venue_id || ""} onChange={e => { const venue = (rows.Venues || []).find(v => v.id === e.target.value); setDraft({...draft,venue_id:e.target.value,venue_name:venue?.name || draft.venue_name || ""}); }}><option value="">No linked venue</option>{(rows.Venues || []).map(v => <option key={v.id} value={v.id}>{v.name}{v.city ? " · " + v.city : ""}</option>)}</select></label>
          <label>Venue name snapshot<input value={draft.venue_name || ""} onChange={e => setDraft({...draft,venue_name:e.target.value})} placeholder="Optional historical venue label"/></label>
          <label className="inline-check"><input type="checkbox" checked={draft.active !== false} onChange={e => setDraft({...draft,active:e.target.checked})}/> Activation is active</label>
        </>}
        {section === "Leads" && <>
          <p className="form-intro">Manage leads collected through your campaign activations. Consent is stored explicitly; do not add contact details without appropriate permission.</p>
          <label>Lead name <span className="required-mark">Required</span><input required value={draft.name || ""} onChange={e => setDraft({...draft,name:e.target.value})} placeholder="Full name"/></label>
          <label>Phone number <span className="required-mark">Required</span><input required type="tel" value={draft.phone || ""} onChange={e => setDraft({...draft,phone:e.target.value})} placeholder="Contact number"/></label>
          <label>Email<input type="email" value={draft.email || ""} onChange={e => setDraft({...draft,email:e.target.value})} placeholder="Optional"/></label>
          <label>Campaign <span className="required-mark">Required</span><select required value={draft.campaign_id || ""} onChange={e => setDraft({...draft,campaign_id:e.target.value})}><option value="">Choose campaign…</option>{(rows.Campaigns || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Activation (optional)<select value={draft.activation_id || ""} onChange={e => setDraft({...draft,activation_id:e.target.value})}><option value="">No activation linked</option>{(rows.Activations || []).filter(a => !draft.campaign_id || a.campaign_id === draft.campaign_id).map(a => <option key={a.id} value={a.id}>{a.name} · {a.shop_code}</option>)}</select></label>
          <label>Verification method<input value={draft.verified_via || "manual"} onChange={e => setDraft({...draft,verified_via:e.target.value})} placeholder="manual"/></label>
          <label className="inline-check"><input type="checkbox" checked={draft.consent_given === true} onChange={e => setDraft({...draft,consent_given:e.target.checked})}/> Consent obtained</label>
        </>}
        {section === "Invoices" && <>
          <p className="form-intro">Draft invoices for campaign work. Total is computed from the base amount plus tax.</p>
          <label>Invoice number <span className="required-mark">Required</span><input required value={draft.invoice_number || ""} onChange={e => setDraft({...draft,invoice_number:e.target.value})} placeholder="e.g. HB-2026-001"/></label>
          <label>Client<select value={draft.client_id || ""} onChange={e => setDraft({...draft,client_id:e.target.value})}><option value="">No linked client</option>{(rows.Clients || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Campaign<select value={draft.campaign_id || ""} onChange={e => { const c = (rows.Campaigns || []).find(row => row.id === e.target.value); setDraft({...draft,campaign_id:e.target.value,client_id:draft.client_id || c?.client_id || ""}); }}><option value="">No linked campaign</option>{(rows.Campaigns || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <div className="qr-field-row"><label>Issue date<input required type="date" value={draft.issue_date || ""} onChange={e => setDraft({...draft,issue_date:e.target.value})}/></label><label>Due date<input type="date" value={draft.due_date || ""} onChange={e => setDraft({...draft,due_date:e.target.value})}/></label></div>
          <div className="qr-field-row"><label>Amount<input type="number" min="0" step="0.01" value={draft.amount ?? 0} onChange={e => setDraft({...draft,amount:e.target.value,total_amount:Number(e.target.value||0)+Number(draft.tax_amount||0)})}/></label><label>Tax amount<input type="number" min="0" step="0.01" value={draft.tax_amount ?? 0} onChange={e => setDraft({...draft,tax_amount:e.target.value,total_amount:Number(draft.amount||0)+Number(e.target.value||0)})}/></label></div>
          <label>Total amount<input readOnly type="number" value={Number(draft.amount||0)+Number(draft.tax_amount||0)}/></label>
          <label>Status<select value={draft.status || "draft"} onChange={e => setDraft({...draft,status:e.target.value})}>{["draft","sent","paid","overdue","cancelled"].map(v=><option key={v} value={v}>{label(v)}</option>)}</select></label>
          <label>Notes<textarea rows={2} value={draft.notes || ""} onChange={e => setDraft({...draft,notes:e.target.value})}/></label>
        </>}
        {section === "Expenses" && <>
          <p className="form-intro">Track expenses by campaign to measure the cost of each marketing activation.</p>
          <label>Campaign <span className="required-mark">Required</span><select required value={draft.campaign_id || ""} onChange={e => setDraft({...draft,campaign_id:e.target.value})}><option value="">Choose campaign…</option>{(rows.Campaigns || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Category <span className="required-mark">Required</span><input required value={draft.category || ""} onChange={e => setDraft({...draft,category:e.target.value})} placeholder="Printing, venue rental, travel…"/></label>
          <label>Description<textarea rows={2} value={draft.description || ""} onChange={e => setDraft({...draft,description:e.target.value})} placeholder="What was purchased or delivered?"/></label>
          <div className="qr-field-row"><label>Expense date<input required type="date" value={draft.expense_date || ""} onChange={e => setDraft({...draft,expense_date:e.target.value})}/></label><label>Amount<input required type="number" min="0" step="0.01" value={draft.amount ?? 0} onChange={e => setDraft({...draft,amount:e.target.value})}/></label></div>
          <label>Vendor<input value={draft.vendor || ""} onChange={e => setDraft({...draft,vendor:e.target.value})}/></label>
          <label>Notes<textarea rows={2} value={draft.notes || ""} onChange={e => setDraft({...draft,notes:e.target.value})}/></label>
        </>}
        {section === "Campaign Locations" && <>
          <p className="form-intro">A campaign location is a map pin for this specific campaign—not a second venue record. Search below to copy a saved campaign map point into this campaign, or select a reusable venue and use its saved coordinates. Maintain physical venue details once in Venues.</p>
          {returnToCampaignId && <section className="location-batch-panel"><div><b>Adding places to {(rows.Movies || []).find(movie => movie.id === (rows.Campaigns || []).find(campaign => campaign.id === returnToCampaignId)?.movie_id)?.title || "this movie"}</b><small>{(rows["Campaign Locations"] || []).filter(location => location.campaign_id === returnToCampaignId).length} campaign location(s) saved so far. Keep adding pins here; finish when ready.</small></div><button type="button" className="secondary" onClick={() => finishLocationFlow()}>Finish & return to movie</button></section>}
          <label>Campaign / movie <span className="required-mark">Required</span><select required value={draft.campaign_id || ""} onChange={e => setDraft({...draft,campaign_id:e.target.value})}><option value="">Choose a campaign…</option>{(rows.Campaigns || []).map(campaign => { const movie = (rows.Movies || []).find(item => item.id === campaign.movie_id); return <option key={campaign.id} value={campaign.id}>{movie?.title || "Movie not linked"} · {campaign.name}{campaign.active ? "" : " (inactive)"}</option>; })}</select>{!(rows.Campaigns || []).length && <small className="field-help">Create a campaign first from the Campaigns panel.</small>}</label>
          {!editingLocationId && <section className="location-library">
            <div className="location-library-head"><div><h4>Find an existing location</h4><p>Search saved map pins by location, venue, campaign, movie or address. Selecting a map pin copies its details into this campaign; the original stays unchanged.</p></div></div>
            <label className="location-library-search"><Search size={15}/><input value={locationPickerSearch} onChange={e => setLocationPickerSearch(e.target.value)} placeholder="Search saved locations and venues…" aria-label="Search saved campaign locations and venues"/></label>
            <div className="location-library-results">
              {locationLibraryResults.map(result => result.kind === "map-point" ? <article className="location-library-result" key={"map-" + result.id}>
                <span className="location-library-icon"><MapPin size={16}/></span>
                <div className="location-library-copy"><b>{result.title}</b><small>{result.subtitle}</small></div>
                <button type="button" className="secondary location-library-action" disabled={busy || !draft.campaign_id || String(result.item.campaign_id) === String(draft.campaign_id)} onClick={() => void addExistingMapPointToCampaign(result.item)}>{!draft.campaign_id ? "Choose campaign" : String(result.item.campaign_id) === String(draft.campaign_id) ? "Already added" : returnToCampaignId ? "Add & keep going" : "Add to campaign"}</button>
              </article> : <article className="location-library-result" key={"venue-" + result.id}>
                <span className="location-library-icon"><Building2 size={16}/></span>
                <div className="location-library-copy"><b>{result.title}</b><small>{result.subtitle} · No saved map pin yet</small></div>
                <button type="button" className="secondary location-library-action" disabled={busy} onClick={() => useVenueDetails(result.item)}>Use venue</button>
              </article>)}
              {locationLibraryResults.length === 0 && <div className="location-library-empty">No matching saved map points or unused venues. You can create a new campaign map point below.</div>}
            </div>
            <small className="field-help">Venues hold reusable physical-place details. Campaign Locations hold campaign-specific coordinates and game settings.</small>
          </section>}
          <div className="location-manual-heading"><h4>{editingLocationId ? "Map point details" : "Or create a new campaign map point"}</h4><p>Use these fields when there is no existing map pin to reuse. A venue record alone does not contain map coordinates.</p></div>
          <label>Location name <span className="required-mark">Required</span><input required value={draft.name || ""} onChange={e => setDraft({...draft,name:e.target.value})} placeholder="e.g. Express Avenue QR activation"/></label>
          <label>Category <span className="required-mark">Required</span><select required value={draft.category || ""} onChange={e => setDraft({...draft,category:e.target.value})}><option value="">Choose category…</option>{Array.from(new Set([...LOCATION_CATEGORIES,...(rows["Campaign Locations"] || []).map(location => location.category).filter(Boolean)])).map(category => <option key={category} value={category}>{label(category)}</option>)}</select></label>
          <label>Physical venue (optional)<select value={draft.venue_id || ""} onChange={e => { const venue = (rows.Venues || []).find(item => item.id === e.target.value); const address = venue ? [venue.address, venue.city, venue.state, venue.pincode].filter(value => String(value || "").trim()).join(", ") : ""; setDraft({...draft,venue_id:e.target.value,address:!draft.address && address ? address : draft.address,latitude:String(draft.latitude ?? "").trim() === "" ? (venue?.latitude == null ? "" : String(venue.latitude)) : draft.latitude,longitude:String(draft.longitude ?? "").trim() === "" ? (venue?.longitude == null ? "" : String(venue.longitude)) : draft.longitude}); }}><option value="">Map point only — no venue record</option>{(rows.Venues || []).filter(venue => venue.active !== false).map(venue => <option key={venue.id} value={venue.id}>{venue.name}{venue.city ? " · " + venue.city : ""}{venue.venue_type ? " · " + venue.venue_type : ""}</option>)}</select><small className="field-help">Saved venue coordinates and address prefill empty fields. You can use different coordinates for an entrance or an individual campaign placement.</small></label>
          <div className="qr-field-row"><label>Latitude <span className="required-mark">Required</span><input required type="number" step="any" min="-90" max="90" value={draft.latitude ?? ""} onChange={e => setDraft({...draft,latitude:e.target.value})} placeholder="13.0827"/></label><label>Longitude <span className="required-mark">Required</span><input required type="number" step="any" min="-180" max="180" value={draft.longitude ?? ""} onChange={e => setDraft({...draft,longitude:e.target.value})} placeholder="80.2707"/></label></div>
          <label>Address / directions<input value={draft.address || ""} onChange={e => setDraft({...draft,address:e.target.value})} placeholder="Street, landmark, city"/></label>
          <label>Description<textarea rows={2} value={draft.description || ""} onChange={e => setDraft({...draft,description:e.target.value})} placeholder="What should participants find or do here?"/></label>
          <label>Points for reaching this location<input type="number" min="0" step="1" value={draft.points ?? 0} onChange={e => setDraft({...draft,points:e.target.value})}/><small className="field-help">This is the location's points field; task rewards are configured separately.</small></label>
          <label className="inline-check"><input type="checkbox" checked={draft.is_active !== false} onChange={e => setDraft({...draft,is_active:e.target.checked})}/> Campaign location is active</label>
        </>}
        <div className="form-actions"><button type="button" className="secondary" onClick={() => { if (section === "Campaign Locations" && returnToCampaignId) { setEditingLocationId(null); setEditingRecordId(null); setDraft({ name: "", campaign_id: returnToCampaignId, category: "shopping", venue_id: "", latitude: "", longitude: "", address: "", description: "", points: 20, is_active: true }); setError(""); setNotice("Unsaved location details cleared. You can continue adding pins or finish."); return; } const backToCampaignId = section === "Campaign Locations" ? returnToCampaignId : null; setShowAdd(false); setEditingLocationId(null); setEditingRecordId(null); setDraft({}); setReturnToCampaignId(null); setLocationPickerSearch(""); if (backToCampaignId) { const campaign = (rows.Campaigns || []).find(item => item.id === backToCampaignId); if (campaign) { setSection("Campaigns"); setEditingRecordId(campaign.id); setDraft({ ...campaign, selected_task_keys: [], task_points: {} }); setShowAdd(true); } } }}>{returnToCampaignId ? "Clear draft" : "Cancel"}</button>{returnToCampaignId && section === "Campaign Locations" && !editingLocationId && <><button type="submit" className="secondary" data-location-save-mode="another" disabled={busy}>{busy ? "Saving…" : "Save & add another"}</button><button type="button" className="secondary" disabled={busy} onClick={() => finishLocationFlow(true)}>Finish without saving</button></>}{returnToCampaignId && section === "Campaign Locations" && editingLocationId && <button type="button" className="secondary" disabled={busy} onClick={() => finishLocationFlow(true)}>Cancel edit & return to movie</button>}<button className="button" data-location-save-mode="finish" disabled={busy || (section === "Campaigns" && !(rows.Movies || []).length) || (section === "Campaign Locations" && !(rows.Campaigns || []).length)}>{busy ? "Saving…" : editingLocationId || editingRecordId ? "Save changes" : section === "Campaigns" ? "Create campaign + tasks" : section === "Campaign Locations" ? returnToCampaignId ? "Save location & return to movie" : "Add campaign location" : "Create record"}</button></div>
      </form>}
      <div className="toolbar"><div className="search"><Search size={16}/><input placeholder={section === "QR Manager" ? "Search by QR name, code, venue, purpose…" : "Search " + section.toLowerCase()} value={search} onChange={e => setSearch(e.target.value)}/></div><span>{visibleRows.length} records</span></div>
      {section === "QR Manager" && mismatchedQrRecords.length > 0 && <div className="error" role="status">{mismatchedQrRecords.length} saved QR code(s) currently reference an interaction source from a different campaign. Existing records were not changed automatically. Open each QR and select a source belonging to its campaign.</div>}
      {section === "QR Manager" && selectedQr && <form className="qr-editor" onSubmit={saveQr}>
        <div className="qr-editor-head"><div><p className="eyebrow">QR DETAILS / EDIT MODE</p><h2>{qrDraft.display_name || "Unnamed QR"}</h2><p>Edit the label and scan rules. The public code itself stays unchanged so existing printed QR codes keep working.</p></div><button type="button" className="icon-button close-editor" title="Close editor" onClick={() => setSelectedQr(null)}><X size={18}/></button></div>
        <div className="qr-editor-grid">
          <section className="qr-preview"><div className="qr-image-wrap"><img alt={"QR code for " + (qrDraft.display_name || "QR")} src={"https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=" + encodeURIComponent("https://honeycomb2.prudhvi123143.workers.dev/q/" + (selectedQr.short_code || selectedQr.public_code || ""))}/></div><b>{qrDraft.display_name || "Unnamed QR"}</b><small className="mono qr-short-code">{selectedQr.short_code || "No short code"}</small><div className="qr-link-actions"><button type="button" className="secondary" onClick={() => { navigator.clipboard.writeText("https://honeycomb2.prudhvi123143.workers.dev/q/" + (selectedQr.short_code || selectedQr.public_code)); setNotice("QR link copied."); }}><Copy size={14}/> Copy link</button><button type="button" className="secondary" onClick={() => { navigator.clipboard.writeText(selectedQr.short_code || selectedQr.public_code || ""); setNotice("Short QR code copied."); }}><Copy size={14}/> Copy code</button><a className="secondary link-button" href={"https://honeycomb2.prudhvi123143.workers.dev/q/" + encodeURIComponent(selectedQr.short_code || selectedQr.public_code || "")} target="_blank" rel="noreferrer"><ExternalLink size={14}/> Open link</a></div><small className="qr-url">honeycomb2.prudhvi123143.workers.dev/q/{selectedQr.short_code || selectedQr.public_code}</small><div className="qr-stats"><span>Scans / uses<b>{selectedQr.use_count || 0}</b></span><span>Created<b>{selectedQr.created_at ? new Date(selectedQr.created_at).toLocaleDateString() : "—"}</b></span></div></section>
          <div className="qr-fields">
            <label>QR display name<input required maxLength={120} placeholder="e.g. Sri Murugan Tea Stall – T. Nagar" value={qrDraft.display_name || ""} onChange={e => setQrDraft({...qrDraft,display_name:e.target.value})}/></label>
            <div className="qr-field-row"><label>Purpose<select value={qrDraft.purpose || "general"} onChange={e => setQrDraft({...qrDraft,purpose:e.target.value})}>{[["vendor","Vendor / shop"],["mall","Mall"],["friend_invite","Friend invite"],["hunt_location","Hunt location"],["general","General"]].map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label><label>QR type<input value={qrDraft.qr_type || "generic"} onChange={e => setQrDraft({...qrDraft,qr_type:e.target.value})}/></label></div>
            <label>Campaign<select required value={qrDraft.campaign_id || ""} onChange={e => { const campaignId = e.target.value; const currentSource = (rows["QR Sources"] || []).find(source => String(source.id) === String(qrDraft.interaction_source_id)); setQrDraft({...qrDraft,campaign_id:campaignId,interaction_source_id:currentSource && String(currentSource.campaign_id) === String(campaignId) ? currentSource.id : ""}); }}><option value="">Select campaign…</option>{(rows.Campaigns || []).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label>Interaction source<select required value={qrDraft.interaction_source_id || ""} onChange={e => { const sourceId = e.target.value; const source = (rows["QR Sources"] || []).find(item => String(item.id) === String(sourceId)); const linkedLocation = source?.location_id ? (rows["Campaign Locations"] || []).find(item => String(item.id) === String(source.location_id)) : null; setQrDraft({...qrDraft,interaction_source_id:sourceId,campaign_id:source?.campaign_id || qrDraft.campaign_id,venue_id:linkedLocation?.venue_id || ""}); }}><option value="">Select source from this campaign…</option>{(rows["QR Sources"] || []).filter(src => String(src.campaign_id) === String(qrDraft.campaign_id)).map(src=><option key={src.id} value={src.id}>{src.name} · {src.source_type} · {src.points} pts</option>)}</select><small className="field-help">Sources are filtered to the selected campaign. If the source is linked to a campaign location with a venue, that venue is prefilled below.</small></label>
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
      <div className="panel"><DataTable rows={visibleRows} columns={columns[section] || []} onRowClick={section === "Campaign Locations" ? openLocationEditor : ["Movies", "Campaigns", "Venues", "Clients", "Activations", "Leads", "Invoices", "Expenses"].includes(section) ? openRecordEditor : section === "QR Manager" ? openQrEditor : undefined}/></div>
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




