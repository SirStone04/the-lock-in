# Consistency scoring

Each calendar date in America/New_York can earn at most 100 consistency XP:

- Up to 80 points for adherence to applicable meaningful missions.
- 10 points for explicitly marking the daily check-in complete.
- 10 points for recording a daily reflection.

Missions are grouped by life category so numerous small maintenance tasks do not overwhelm faith, study, employment, or recovery commitments. Importance 3 is highest. A completed mission earns its full share. Skipped and not-started missions earn none; legitimately excused, rescheduled, and unselected optional missions are excluded. A date without applicable missions does not receive automatic mission points.

For in-progress or partially completed missions, the app compares actual quantity with the target quantity and actual minutes with planned minutes. It uses the larger valid ratio, capped at 100%, and does not add the ratios. Quantities must use the same unit as that mission's target (for example, paid hours or chapters); durations use minutes. Thus 45 logged minutes of a 90-minute study mission earns half of its mission share even when an imported generic quantity target remains 1 and actual quantity remains 0. Extra hours or heavier weights never award bonus XP.

The XP ledger contains one recalculated award per date, with source record revisions. Editing an existing record replaces the date's award rather than adding another award. New missions first created after their local calendar date do not earn retroactive mission XP. Daily check-ins and reflections first entered more than seven days late earn no retroactive check-in or reflection XP. Historical records remain editable and reportable.

The ladder has 24 divisions: Recruit, Rookie, Veteran, Elite, Pro, Master, Grandmaster, and Legendary, each progressing III → II → I. Division index `k` requires cumulative XP of `500*k + 45*k*k` by default. An optional settings `rankThresholds` array must contain 24 strictly increasing nonnegative integer thresholds, beginning at 0.

Promotions require 70% rolling consistency as well as the XP threshold. Onboarding requires at least three eligible dates. Once 14 eligible tracking dates exist, promotion requires at least 14 eligible dates within the last 28 calendar days and 70% average consistency across applicable dates. Earned promotion history normally retains rank through difficult weeks; current form shows recent consistency separately. Career and financial achievements do not award rank XP.

Canonical mission schedule data uses `scheduledTime`; legacy `plannedTime` is supported by conflict detection and coaching.
