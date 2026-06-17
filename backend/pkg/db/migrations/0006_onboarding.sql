ALTER TABLE users
  ADD COLUMN onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN age                  INTEGER,
  ADD COLUMN learner_types        TEXT[]  NOT NULL DEFAULT '{}';

-- All pre-existing users are already using the app — treat them as done.
UPDATE users SET onboarding_completed = TRUE;
