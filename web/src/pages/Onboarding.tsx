import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  ScrollText,
  School,
  Briefcase,
  BookOpen,
  Compass,
  Sparkles,
} from "lucide-react";
import { Wordmark } from "../lib/logo";
import { auth, useDb, selectCurrentUser } from "../lib/store";
import type { LearnerType } from "../types";
import "./Onboarding.css";

type Step = 0 | 1 | 2;

const LEARNER_OPTIONS: {
  value: LearnerType;
  label: string;
  hint: string;
  Icon: typeof GraduationCap;
}[] = [
  {
    value: "university",
    label: "University",
    hint: "Lectures, exams, semester goals.",
    Icon: GraduationCap,
  },
  {
    value: "certifications",
    label: "Certifications",
    hint: "AWS, CFA, language tests, you name it.",
    Icon: ScrollText,
  },
  {
    value: "school",
    label: "School",
    hint: "Middle school, high school, prep.",
    Icon: School,
  },
  {
    value: "professional",
    label: "Professional",
    hint: "On-the-job learning and upskilling.",
    Icon: Briefcase,
  },
  {
    value: "self-study",
    label: "Self-study",
    hint: "Curiosity-driven, your own pace.",
    Icon: BookOpen,
  },
  {
    value: "other",
    label: "Something else",
    hint: "Tell us later — we'll keep it flexible.",
    Icon: Compass,
  },
];

export function Onboarding() {
  const navigate = useNavigate();
  const user = useDb(selectCurrentUser);
  const [step, setStep] = useState<Step>(0);
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [age, setAge] = useState<string>(
    user?.age != null ? String(user.age) : "",
  );
  const [learnerTypes, setLearnerTypes] = useState<LearnerType[]>(
    user?.learnerTypes ?? [],
  );

  function toggleLearnerType(value: LearnerType) {
    setLearnerTypes((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  const ageNum = useMemo(() => {
    const n = Number(age);
    return Number.isFinite(n) ? Math.floor(n) : NaN;
  }, [age]);
  const ageValid = Number.isFinite(ageNum) && ageNum >= 5 && ageNum <= 120;

  const canContinue =
    (step === 0 && firstName.trim().length > 0) ||
    (step === 1 && ageValid) ||
    (step === 2 && learnerTypes.length > 0);

  function next() {
    if (!canContinue) return;
    if (step < 2) {
      setStep((s) => ((s + 1) as Step));
      return;
    }
    auth.completeOnboarding({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      age: ageNum,
      learnerTypes,
    });
    navigate("/app", { replace: true });
  }

  function back() {
    if (step === 0) return;
    setStep((s) => ((s - 1) as Step));
  }

  return (
    <div className="onb">
      <header className="onb__head">
        <Wordmark size={22} />
        <span className="onb__step-meta">
          Step {step + 1} of 3
        </span>
      </header>

      <div className="onb__progress" aria-hidden>
        <span
          className="onb__progress-fill"
          style={{ width: `${((step + 1) / 3) * 100}%` }}
        />
      </div>

      <main className="onb__panel">
        <div className="onb__intro">
          <span className="text-meta onb__pill">
            <Sparkles size={11} strokeWidth={2} />
            Welcome to flashr
          </span>
          <h1 className="text-h1">
            {step === 0 && "First — what should we call you?"}
            {step === 1 && "How old are you?"}
            {step === 2 && "What kind of learner are you?"}
          </h1>
          <p className="text-body onb__sub">
            {step === 0 &&
              "We'll use your name to make flashr feel a little more like yours."}
            {step === 1 &&
              "We tune the tone of AI-generated cards to match your stage of learning."}
            {step === 2 &&
              "Pick all that fit — most learners wear more than one hat. We'll use this to pick smart defaults."}
          </p>
        </div>

        {step === 0 && (
          <div className="onb__form">
            <label className="onb__field">
              <span className="text-meta">First name</span>
              <input
                className="onb__input"
                type="text"
                autoFocus
                placeholder="Jordan"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canContinue) next();
                }}
              />
            </label>
            <label className="onb__field">
              <span className="text-meta">Last name (optional)</span>
              <input
                className="onb__input"
                type="text"
                placeholder="Smith"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canContinue) next();
                }}
              />
            </label>
          </div>
        )}

        {step === 1 && (
          <div className="onb__form">
            <label className="onb__field">
              <span className="text-meta">Age</span>
              <input
                className="onb__input"
                type="number"
                inputMode="numeric"
                min={5}
                max={120}
                autoFocus
                placeholder="22"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canContinue) next();
                }}
              />
            </label>
            <p className="onb__hint">
              We never show this publicly — it's just used to pick the
              right vocabulary for AI-generated cards.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="onb__choices" role="group" aria-label="Learner types">
            {LEARNER_OPTIONS.map(({ value, label, hint, Icon }) => {
              const active = learnerTypes.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  role="checkbox"
                  aria-checked={active}
                  className={`onb__choice${active ? " active" : ""}`}
                  onClick={() => toggleLearnerType(value)}
                >
                  <Icon
                    size={18}
                    strokeWidth={1.8}
                    className="onb__choice-icon"
                  />
                  <div className="onb__choice-text">
                    <span className="onb__choice-label">{label}</span>
                    <span className="onb__choice-hint">{hint}</span>
                  </div>
                  {active && (
                    <CheckCircle2
                      size={16}
                      strokeWidth={2}
                      className="onb__choice-check"
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="onb__actions">
          <button
            type="button"
            className="btn-ghost onb__back"
            onClick={back}
            disabled={step === 0}
          >
            <ArrowLeft size={14} strokeWidth={2} />
            Back
          </button>
          <button
            type="button"
            className="btn-primary onb__next"
            onClick={next}
            disabled={!canContinue}
          >
            {step === 2 ? "Finish" : "Continue"}
            <ArrowRight size={14} strokeWidth={2} />
          </button>
        </div>
      </main>
    </div>
  );
}
