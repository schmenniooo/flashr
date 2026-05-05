import { useMemo, useRef, useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { auth, billingApi, selectCollections, selectCurrentUser, useDb } from "../lib/store";
import "./Profile.css";

export function Profile() {
  const navigate = useNavigate();
  const currentUser = useDb(selectCurrentUser);
  const collections = useDb(selectCollections);

  const [form, setForm] = useState(currentUser);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    currentUser?.avatarUrl ?? null,
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const [prevUserId, setPrevUserId] = useState(currentUser?.id);
  if (prevUserId !== currentUser?.id) {
    setPrevUserId(currentUser?.id);
    if (currentUser) {
      setForm(currentUser);
      setAvatarPreview(currentUser.avatarUrl);
    }
  }

  const dirty = useMemo(() => {
    if (!currentUser || !form) return false;
    return (
      form.firstName !== currentUser.firstName ||
      form.lastName !== currentUser.lastName ||
      form.username !== currentUser.username ||
      form.bio !== currentUser.bio ||
      form.timezone !== currentUser.timezone ||
      form.dailyGoal !== currentUser.dailyGoal ||
      form.emailReminders !== currentUser.emailReminders ||
      form.weeklyDigest !== currentUser.weeklyDigest ||
      avatarPreview !== currentUser.avatarUrl
    );
  }, [form, avatarPreview, currentUser]);

  if (!currentUser || !form) return <Navigate to="/login" replace />;

  const totalCards = collections.reduce((s, c) => s + c.cards.length, 0);
  const knownCards = collections.reduce(
    (s, c) => s + c.cards.filter((k) => k.mastery === "known").length,
    0,
  );

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
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleDiscard() {
    if (!currentUser) return;
    setForm(currentUser);
    setAvatarPreview(currentUser.avatarUrl);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleSave() {
    if (!form) return;
    auth.updateProfile({
      firstName: form.firstName,
      lastName: form.lastName,
      username: form.username,
      bio: form.bio,
      timezone: form.timezone,
      dailyGoal: form.dailyGoal,
      emailReminders: form.emailReminders,
      weeklyDigest: form.weeklyDigest,
      avatarUrl: avatarPreview,
    });
  }

  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromCheckout = params.get("checkout") === "success";
    const fromPortal = params.get("portal") === "return";
    if (fromCheckout || fromPortal) {
      window.history.replaceState({}, "", window.location.pathname);
      void auth.refreshUser();
      if (fromCheckout) {
        setCheckoutSuccess(true);
        setTimeout(() => setCheckoutSuccess(false), 5000);
      }
    }
  }, []);

  const [billingLoading, setBillingLoading] = useState(false);

  async function handleUpgrade() {
    if (!currentUser) return;
    setBillingLoading(true);
    try {
      await billingApi.checkout(currentUser.email);
    } finally {
      setBillingLoading(false);
    }
  }

  async function handleManageSubscription() {
    setBillingLoading(true);
    try {
      await billingApi.portal();
    } finally {
      setBillingLoading(false);
    }
  }

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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

  function handleSignOut() {
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
          <h1 className="text-h1" style={{ marginTop: 8 }}>Your profile</h1>
          <p className="text-body" style={{ marginTop: 4, maxWidth: 520 }}>
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
                  <span className="prof__info-hint" style={{ margin: 0 }}>
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
            <div>
              <div className="prof__toggle-label">Daily study reminder</div>
              <div className="prof__toggle-hint">Gentle email at 8 AM if you haven't studied yet.</div>
            </div>
            <Switch
              checked={form.emailReminders}
              onChange={(v) => update("emailReminders", v)}
            />
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
            <div className="prof__glance-val">{collections.length}</div>
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
      {dirty && (
        <div className="prof__savebar fade-in">
          <div className="prof__savebar-summary">
            <span className="prof__savebar-dot" />
            Unsaved changes
          </div>
          <div className="prof__savebar-actions">
            <button className="btn-ghost" onClick={handleDiscard}>
              Discard
            </button>
            <button className="btn-primary" onClick={handleSave}>
              <CheckCircle2 size={14} strokeWidth={2} />
              Save changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="prof__switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </label>
  );
}
