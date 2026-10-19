import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Activity, Building2, Clapperboard, Film, LayoutDashboard, LogOut, Plus, QrCode, RefreshCw, CalendarDays, Search, ShieldCheck, Copy, ExternalLink, X, Save, UserRound, Phone, Mail, Clock3, ListChecks, ClipboardList, MapPin } from "lucide-react";

type RecordRow = Record<string, any>;
const label = (v: string) => v.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
const toLocalDateTime = (value: string) => { const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };

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

export function ActivityTasksPanel({ db, campaigns, onRefresh }: { db: SupabaseClient; campaigns: RecordRow[]; onRefresh: () => Promise<void> }) {
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

export function UserActivityPanel({ db }: { db: SupabaseClient }) {
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
