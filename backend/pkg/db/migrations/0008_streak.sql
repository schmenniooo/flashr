ALTER TABLE users
  ADD COLUMN daily_goal        INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN streak_updated_on DATE;

CREATE TABLE daily_reviews (
    user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date     DATE NOT NULL,
    count    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, date)
);
