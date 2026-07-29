-- Migration: add_duration_hours_to_events
ALTER TABLE events
ADD COLUMN duration_hours integer;
