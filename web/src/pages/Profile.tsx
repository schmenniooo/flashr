import { useMemo, useRef, useState, useEffect, useCallback, useSyncExternalStore } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Camera,
  Trash2,
  Mail,
  AtSign,
  Globe,
  Flame,
  Sparkles,
  Shield,
  CheckCircle2,
  LogOut,
  AlertTriangle,
  Crown,
  Bell,
} from "lucide-react";
import posthog from "posthog-js";
import { auth, billingApi, selectCollections, selectCurrentUser, selectNow, selectTotalCards, selectKnownCards, useDb, notificationsApi, subscribeNotif, getNotifSnapshot } from "../lib/store";
import { usePostHog } from "@posthog/react";
import "./Profile.css";

function resizeImage(file: File, maxPx = 400, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function Profile() {
  const navigate = useNavigate();
  const posthog = usePostHog();
  const currentUser = useDb(selectCurrentUser);
  const collectionsCount = useDb((db) => selectCollections(db).length);
  const totalCards = useDb(selectTotalCards);
  const knownCards = useDb(selectKnownCards);

  const [form, setForm] = useState(currentUser);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    currentUser?.avatarUrl ?? null,
  );
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [prevUserId, setPrevUserId] = useState(currentUser?.id);
  if (prevUserId !== currentUser?.id) {
    setPrevUserId(currentUser?.id);
    if (currentUser) {
      setForm(currentUser);
      setAvatarPreview(currentUser.avatarUrl);
    }
  }

  const notifState = useSyncExternalStore(subscribeNotif, getNotifSnapshot, getNotifSnapshot);

  const dirty = useMemo(() => {
    if (!currentUser || !form) return false;
    return (
      form.firstName !== currentUser.firstName ||
      form.lastName !== currentUser.lastName ||
      form.username !== currentUser.username ||
      form.bio !== currentUser.bio ||
      form.timezone !== currentUser.timezone ||
      form.dailyGoal !== currentUser.dailyGoal ||
      form.weeklyDigest !== currentUser.weeklyDigest ||
      (notifState.subscribed && form.notificationTime !== currentUser.notificationTime) ||
      avatarPreview !== currentUser.avatarUrl
    );
  }, [form, avatarPreview, currentUser, notifState.subscribed]);

  const [pushError, setPushError] = useState<string | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromCheckout = params.get("checkout") === "success";
    const fromPortal = params.get("portal") === "return";

    if (fromCheckout || fromPortal) {
      window.history.replaceState({}, "", window.location.pathname);
    }

    // Always sync plan from Stripe on every profile mount.
    // SyncPlan is a no-op for users with no Stripe customer (single DB query,
    // no external call). For users with a subscription it catches any state
    // that webhooks or FulfillCheckout may have missed — including trialing
    // subscriptions where payment_status is no_payment_required.
    void (async () => {
      if (fromCheckout) {
        const sessionId = params.get("session_id");
        if (sessionId) await billingApi.fulfill(sessionId).catch(console.error);
      }
      await billingApi.sync().catch(console.error);
      await auth.refreshUser();
      if (fromCheckout && selectNow(selectCurrentUser)?.plan === "pro") {
        setCheckoutSuccess(true);
        setTimeout(() => setCheckoutSuccess(false), 5000);
      }
    })();
  }, []);

  const handleDeleteAccount = useCallback(async () => {
    setDeleteLoading(true);
    setDeleteError("");
    const result = await auth.deleteAccount();
    if (result.ok) {
      navigate("/login");
    } else {
      setDeleteLoading(false);
      setDeleteError(result.error);
    }
  }, [navigate]);

  if (!currentUser || !form) return <Navigate to="/login" replace />;

  const initials = `${form.firstName[0] ?? ""}${form.lastName[0] ?? ""}`.toUpperCase();

  function update<K extends keyof NonNullable<typeof form>>(
    key: K,
    value: NonNullable<typeof form>[K],
  ) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  function handleAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleDiscard() {
    if (!currentUser) return;
    setForm(currentUser);
    setAvatarPreview(currentUser.avatarUrl);
    setAvatarFile(null);
    setSaveError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSave() {
    if (!form) return;
    setSaveLoading(true);
    setSaveError(null);
    try {
      if (avatarPreview !== currentUser?.avatarUrl) {
        if (avatarPreview === null) {
          await auth.removeAvatar();
        } else if (avatarFile) {
          const resized = await resizeImage(avatarFile);
          await auth.saveAvatar(resized);
          setAvatarPreview(resized);
          setAvatarFile(null);
          if (fileRef.current) fileRef.current.value = "";
        }
      }
      auth.updateProfile({
        firstName: form.firstName,
        lastName: form.lastName,
        username: form.username,
        bio: form.bio,
        timezone: form.timezone,
        dailyGoal: form.dailyGoal,
        weeklyDigest: form.weeklyDigest,
      });
      if (
        notifState.subscribed &&
        form.notificationTime !== currentUser?.notificationTime
      ) {
        try {
          await notificationsApi.updateTime(form.notificationTime, form.timezone);
          await auth.refreshUser();
        } catch {
          setSaveError("Could not save notification time — please try again.");
          return;
        }
      }
    } catch {
      setSaveError("Could not save avatar — please try again.");
    } finally {
      setSaveLoading(false);
    }
  }

  async function handleUpgrade() {
    if (!currentUser) return;
    posthog.capture("upgrade_clicked", { plan: currentUser.plan });
    setBillingLoading(true);
    setBillingError("");
    posthog.capture("upgrade_clicked", { plan: currentUser.plan });
    try {
      await billingApi.checkout(currentUser.email);
    } catch {
      setBillingError("Could not start checkout — please try again.");
      setBillingLoading(false);
    }
  }

  async function handleManageSubscription() {
    setBillingLoading(true);
    setBillingError("");
    try {
      await billingApi.portal();
    } catch {
      setBillingError("Could not open billing portal — please try again.");
      setBillingLoading(false);
    }
  }

  async function handlePushToggle(enabled: boolean) {
    setPushError(null);
    try {
      if (enabled) {
        await notificationsApi.enable(
          form?.notificationTime ?? "08:00",
          form?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        );
      } else {
        await notificationsApi.disable();
      }
      // Sync updated notification_time back into the auth store so the dirty
      // check doesn't falsely fire after enabling/disabling.
      await auth.refreshUser();
    } catch {
      if (getNotifSnapshot().permission === "denied") {
        setPushError("Notifications are blocked — allow them in your browser settings.");
      } else {
        setPushError("Could not update notification settings — please try again.");
      }
    }
  }

  function handleSignOut() {
    posthog.capture("user_signed_out");
    auth.signOut();
    navigate("/login");
  }

  return (
    <div className="prof">
      <Link to="/app" className="prof__back">
        <ArrowLeft size={14} strokeWidth={2} />
        Back to dashboard
      </Link>

      {checkoutSuccess && (
        <div className="prof__checkout-banner fade-in">
          <CheckCircle2 size={16} strokeWidth={2} />
          You're now on Pro — enjoy all features!
        </div>
      )}

      <header className="prof__head">
        <div>
          <span className="text-meta">Account · Profile</span>
          <h1 className="text-h1">Your profile</h1>
          <p className="text-body">
            Manage how you show up in flashr. Changes sync instantly across every device you're signed in on.
          </p>
        </div>
      </header>

      {/* ── Identity card ── */}
      <section className="prof__section">
        <div className="prof__section-head">
          <h2 className="text-h2">Identity</h2>
          <p className="text-body">Your name, handle, and a short bio — shown on public collections.</p>
        </div>

        <div className="prof__card prof__identity">
          <div className="prof__avatar-col">
            <div
              className="prof__avatar"
              style={
                avatarPreview
                  ? { backgroundImage: `url(${avatarPreview})`, backgroundSize: "cover" }
                  : undefined
              }
            >
              {!avatarPreview && <span className="prof__avatar-initials">{initials}</span>}
              <button
                className="prof__avatar-edit"
                onClick={() => fileRef.current?.click()}
                title="Upload photo"
              >
                <Camera size={14} strokeWidth={2} />
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarPick}
              style={{ display: "none" }}
            />
            <div className="prof__avatar-actions">
              <button className="btn-ghost" onClick={() => fileRef.current?.click()}>
                <Camera size={13} strokeWidth={2} />
                {avatarPreview ? "Change" : "Upload"}
              </button>
              {avatarPreview && (
                <button
                  className="prof__remove"
                  onClick={() => setAvatarPreview(null)}
                  title="Remove photo"
                >
                  <Trash2 size={13} strokeWidth={2} />
                  Remove
                </button>
              )}
            </div>
            <p className="prof__avatar-hint">PNG or JPG, up to 4 MB. Square works best.</p>
          </div>

          <div className="prof__form">
            <div className="prof__row prof__row--split">
              <label className="prof__field">
                <span className="text-meta">First name</span>
                <input
                  className="input"
                  value={form.firstName}
                  onChange={(e) => update("firstName", e.target.value)}
                />
              </label>
              <label className="prof__field">
                <span className="text-meta">Last name</span>
                <input
                  className="input"
                  value={form.lastName}
                  onChange={(e) => update("lastName", e.target.value)}
                />
              </label>
            </div>

            <label className="prof__field">
              <span className="text-meta">Username</span>
              <div className="prof__input-prefix">
                <AtSign size={14} strokeWidth={1.8} />
                <input
                  className="input prof__input-inner"
                  value={form.username}
                  onChange={(e) => update("username", e.target.value.replace(/\s/g, ""))}
                />
                <span className="prof__input-suffix">flashr.io/{form.username}</span>
              </div>
            </label>

            <label className="prof__field">
              <span className="text-meta">Bio</span>
              <textarea
                className="input prof__textarea"
                rows={3}
                maxLength={160}
                value={form.bio}
                onChange={(e) => update("bio", e.target.value)}
              />
              <span className="prof__field-counter">{form.bio.length} / 160</span>
            </label>
          </div>
        </div>
      </section>

      {/* ── Contact & account ── */}
      <section className="prof__section">
        <div className="prof__section-head">
          <h2 className="text-h2">Contact & account</h2>
          <p className="text-body">Login info, plan, and how long you've been with us.</p>
        </div>

        <div className="prof__card prof__grid">
          <div className="prof__info">
            <div className="prof__info-icon">
              <Mail size={16} strokeWidth={1.8} />
            </div>
            <div className="prof__info-body">
              <span className="text-meta">Email</span>
              <div className="prof__info-val">
                {form.email}
                <span className="prof__verified">
                  <CheckCircle2 size={11} strokeWidth={2} /> verified
                </span>
              </div>
              <span className="prof__info-hint">
                Signed in via {form.oauthProvider === "google" ? "Google" : form.oauthProvider}. Change the
                linked account in Security.
              </span>
            </div>
          </div>

          <div className="prof__info">
            <div className="prof__info-icon prof__info-icon--accent">
              <Crown size={16} strokeWidth={1.8} />
            </div>
            <div className="prof__info-body">
              <span className="text-meta">Plan</span>
              <div className="prof__info-val prof__info-val--plan">
                <span className={`prof__plan-pill prof__plan-pill--${currentUser.plan}`}>
                  {currentUser.plan === "pro" ? "Pro" : "Free"}
                </span>
                {currentUser.plan === "pro" && currentUser.planExpiresAt && (
                  <span className="prof__info-hint prof__info-hint--flush">
                    cancels {new Date(currentUser.planExpiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </span>
                )}
              </div>
              {currentUser.plan === "pro" ? (
                <button
                  className="prof__link"
                  onClick={handleManageSubscription}
                  disabled={billingLoading}
                >
                  {currentUser.planExpiresAt ? "Reactivate subscription →" : "Manage subscription →"}
                </button>
              ) : (
                <button
                  className="btn-primary prof__upgrade-btn"
                  onClick={handleUpgrade}
                  disabled={billingLoading}
                >
                  <Crown size={13} strokeWidth={2} />
                  {billingLoading ? "Redirecting…" : "Upgrade to Pro"}
                </button>
              )}
              {billingError && (
                <span className="prof__billing-error">{billingError}</span>
              )}
              <p className="prof__support-hint">
                Questions? <a href="mailto:support@flashr.io" className="prof__support-link">support@flashr.io</a>
              </p>
            </div>
          </div>

          <div className="prof__info">
            <div className="prof__info-icon">
              <Shield size={16} strokeWidth={1.8} />
            </div>
            <div className="prof__info-body">
              <span className="text-meta">Member since</span>
              <div className="prof__info-val">{form.memberSince}</div>
              <span className="prof__info-hint">You've been building knowledge with us for 5 months.</span>
            </div>
          </div>

          <div className="prof__info">
            <div className="prof__info-icon">
              <Globe size={16} strokeWidth={1.8} />
            </div>
            <div className="prof__info-body">
              <span className="text-meta">Timezone</span>
              <select
                className="input prof__select"
                value={form.timezone}
                onChange={(e) => update("timezone", e.target.value)}
              >
                <option>Europe/Berlin</option>
                <option>Europe/London</option>
                <option>America/New_York</option>
                <option>America/Los_Angeles</option>
                <option>Asia/Tokyo</option>
              </select>
              <span className="prof__info-hint">Used for streaks and daily reset.</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Preferences ── */}
      <section className="prof__section">
        <div className="prof__section-head">
          <h2 className="text-h2">Learning preferences</h2>
          <p className="text-body">Shape your daily practice and the nudges you get from us.</p>
        </div>

        <div className="prof__card prof__card--stack">
          <label className="prof__field">
            <span className="text-meta">Daily goal</span>
            <div className="prof__slider-row">
              <input
                type="range"
                min={5}
                max={100}
                step={5}
                value={form.dailyGoal}
                onChange={(e) => update("dailyGoal", Number(e.target.value))}
                className="prof__slider"
              />
              <span className="prof__slider-val">
                <Flame size={13} strokeWidth={2} color="#ff9b4a" />
                {form.dailyGoal} cards / day
              </span>
            </div>
          </label>

          <div className="prof__toggle-row">
            <div className="prof__toggle-info">
              <Bell size={14} strokeWidth={1.8} className="prof__toggle-icon" />
              <div>
                <div className="prof__toggle-label">Daily study reminder</div>
                <div className="prof__toggle-hint">
                  {notifState.loading
                    ? (notifState.subscribed ? "Disabling…" : "Enabling…")
                    : notifState.permission === "denied"
                    ? "Notifications are blocked — allow them in your browser settings."
                    : notifState.permission === "unsupported"
                    ? "Push notifications aren't supported in this browser."
                    : "Browser push at your preferred time."}
                </div>
                {pushError && (
                  <div className="prof__toggle-error">{pushError}</div>
                )}
              </div>
            </div>
            <div className="prof__toggle-right">
              <input
                type="time"
                className="input prof__time-input"
                value={form.notificationTime}
                onChange={(e) => update("notificationTime", e.target.value)}
                disabled={notifState.loading}
              />
              <Switch
                checked={notifState.subscribed}
                onChange={handlePushToggle}
                disabled={
                  notifState.permission === "denied" ||
                  notifState.permission === "unsupported" ||
                  notifState.loading
                }
              />
            </div>
          </div>

          <div className="prof__toggle-row">
            <div>
              <div className="prof__toggle-label">Weekly digest</div>
              <div className="prof__toggle-hint">Sunday evening recap: cards learned, streak, top decks.</div>
            </div>
            <Switch
              checked={form.weeklyDigest}
              onChange={(v) => update("weeklyDigest", v)}
            />
          </div>
        </div>
      </section>

      {/* ── At a glance ── */}
      <section className="prof__glance">
        <div className="prof__glance-card">
          <Sparkles size={14} strokeWidth={2} color="var(--color-accent-light)" />
          <div>
            <div className="prof__glance-val">{totalCards}</div>
            <div className="prof__glance-lbl">cards total</div>
          </div>
        </div>
        <div className="prof__glance-card">
          <Flame size={14} strokeWidth={2} color="#ff9b4a" />
          <div>
            <div className="prof__glance-val">{knownCards}</div>
            <div className="prof__glance-lbl">cards mastered</div>
          </div>
        </div>
        <div className="prof__glance-card">
          <Crown size={14} strokeWidth={2} color="var(--color-accent)" />
          <div>
            <div className="prof__glance-val">{collectionsCount}</div>
            <div className="prof__glance-lbl">collections</div>
          </div>
        </div>
      </section>

      {/* ── Danger zone ── */}
      <section className="prof__section">
        <div className="prof__section-head">
          <h2 className="text-h2">Danger zone</h2>
          <p className="text-body">Both of these end your session — deleting your account is permanent.</p>
        </div>

        <div className="prof__card prof__danger">
          <div className="prof__danger-row">
            <div>
              <div className="prof__danger-title">Sign out</div>
              <div className="prof__danger-hint">You'll need to sign back in with {form.oauthProvider}.</div>
            </div>
            <button className="btn-ghost" onClick={handleSignOut}>
              <LogOut size={13} strokeWidth={2} />
              Sign out
            </button>
          </div>
          <div className="prof__danger-row prof__danger-row--hard">
            <div>
              <div className="prof__danger-title">Delete account</div>
              <div className="prof__danger-hint">
                Removes all your collections, cards, and history. This cannot be undone.
              </div>
            </div>
            <button className="prof__danger-btn" onClick={() => setDeleteConfirm(true)}>
              <AlertTriangle size={13} strokeWidth={2} />
              Delete account
            </button>
          </div>
        </div>
      </section>

      {/* ── Delete account confirmation modal ── */}
      {deleteConfirm && (
        <div className="prof__modal-backdrop" onClick={() => !deleteLoading && setDeleteConfirm(false)}>
          <div className="prof__modal" onClick={(e) => e.stopPropagation()}>
            <div className="prof__modal-icon">
              <AlertTriangle size={22} strokeWidth={2} />
            </div>
            <h2 className="text-h2">Delete your account?</h2>
            <p className="text-body">
              This permanently removes all your collections, cards, and history.
              There is no undo.
            </p>
            {deleteError && <p className="prof__modal-error">{deleteError}</p>}
            <div className="prof__modal-actions">
              <button
                className="btn-ghost"
                onClick={() => setDeleteConfirm(false)}
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                className="prof__danger-btn"
                onClick={handleDeleteAccount}
                disabled={deleteLoading}
              >
                <AlertTriangle size={13} strokeWidth={2} />
                {deleteLoading ? "Deleting…" : "Yes, delete everything"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sticky save bar ── */}
      {(dirty || saveError) && (
        <div className="prof__savebar fade-in">
          <div className="prof__savebar-summary">
            <span className="prof__savebar-dot" />
            {saveError ?? "Unsaved changes"}
          </div>
          <div className="prof__savebar-actions">
            <button className="btn-ghost" onClick={handleDiscard} disabled={saveLoading}>
              Discard
            </button>
            <button className="btn-primary" onClick={handleSave} disabled={saveLoading || !dirty}>
              <CheckCircle2 size={14} strokeWidth={2} />
              {saveLoading ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Switch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`prof__switch${disabled ? " prof__switch--disabled" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span />
    </label>
  );
}
