"""A small, dependency-free cron expression parser.

Five fields, UTC, standard semantics:

    minute  hour  day-of-month  month  day-of-week
    0-59    0-23  1-31          1-12   0-6 (Sunday = 0, and 7 is also Sunday)

Supports ``*``, ``a-b`` ranges, ``a,b,c`` lists, ``*/n`` and ``a-b/n`` steps,
and the usual ``@hourly`` / ``@daily`` / ``@weekly`` / ``@monthly`` aliases.

Written here rather than pulled in as a dependency because the platform needs
exactly this and nothing more, and a scheduler whose behaviour you cannot read
in one sitting is a scheduler you cannot debug at 3am.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

#: Inclusive bounds per field, in cron order.
_BOUNDS = [(0, 59), (0, 23), (1, 31), (1, 12), (0, 6)]
_NAMES = ["minute", "hour", "day of month", "month", "day of week"]

ALIASES = {
    "@yearly": "0 0 1 1 *",
    "@annually": "0 0 1 1 *",
    "@monthly": "0 0 1 * *",
    "@weekly": "0 0 * * 0",
    "@daily": "0 0 * * *",
    "@midnight": "0 0 * * *",
    "@hourly": "0 * * * *",
}

#: How far ahead to search before giving up. A little over four years, which
#: covers every satisfiable expression including "29 February".
_MAX_LOOKAHEAD_MINUTES = 366 * 4 * 24 * 60


class CronError(ValueError):
    """The expression is not valid cron."""


def _parse_field(spec: str, index: int) -> set[int]:
    low, high = _BOUNDS[index]
    allowed: set[int] = set()

    for part in spec.split(","):
        part = part.strip()
        if not part:
            raise CronError(f"Empty value in the {_NAMES[index]} field.")

        step = 1
        if "/" in part:
            part, _, step_text = part.partition("/")
            if not step_text.isdigit() or int(step_text) < 1:
                raise CronError(
                    f"Step must be a positive whole number in the {_NAMES[index]} field, "
                    f"got {step_text!r}."
                )
            step = int(step_text)

        if part == "*":
            start, end = low, high
        elif "-" in part.lstrip("-"):
            start_text, _, end_text = part.partition("-")
            start, end = _to_int(start_text, index), _to_int(end_text, index)
            if start > end:
                raise CronError(
                    f"Range {part!r} in the {_NAMES[index]} field runs backwards."
                )
        else:
            start = end = _to_int(part, index)

        allowed.update(range(start, end + 1, step))

    # Cron treats 7 as Sunday, same as 0.
    if index == 4 and 7 in allowed:
        allowed.discard(7)
        allowed.add(0)

    if not allowed:
        raise CronError(f"The {_NAMES[index]} field matches nothing.")
    return allowed


def _to_int(text: str, index: int) -> int:
    low, high = _BOUNDS[index]
    text = text.strip()
    # Day-of-week also accepts 7 for Sunday, which is outside the stated bounds.
    ceiling = 7 if index == 4 else high
    if not text.isdigit():
        raise CronError(f"{text!r} is not a number in the {_NAMES[index]} field.")
    value = int(text)
    if not (low <= value <= ceiling):
        raise CronError(
            f"{value} is out of range for the {_NAMES[index]} field ({low}-{high})."
        )
    return value


class CronSchedule:
    """A parsed cron expression that can report its next firing time."""

    def __init__(self, expression: str) -> None:
        self.expression = expression.strip()
        text = ALIASES.get(self.expression.lower(), self.expression)

        fields = text.split()
        if len(fields) != 5:
            raise CronError(
                f"Expected 5 fields (minute hour day month weekday), got {len(fields)}: "
                f"{expression!r}"
            )

        self.minutes = _parse_field(fields[0], 0)
        self.hours = _parse_field(fields[1], 1)
        self.days = _parse_field(fields[2], 2)
        self.months = _parse_field(fields[3], 3)
        self.weekdays = _parse_field(fields[4], 4)

        #: Cron's day fields are OR'd when both are restricted — the classic
        #: quirk. "0 0 1 * 1" means the 1st *or* any Monday, not their overlap.
        self._day_restricted = fields[2].strip() != "*"
        self._weekday_restricted = fields[4].strip() != "*"

    def matches(self, moment: datetime) -> bool:
        if moment.minute not in self.minutes:
            return False
        if moment.hour not in self.hours:
            return False
        if moment.month not in self.months:
            return False

        # Python's weekday() is Monday=0; cron is Sunday=0.
        weekday = (moment.weekday() + 1) % 7
        day_ok = moment.day in self.days
        weekday_ok = weekday in self.weekdays

        if self._day_restricted and self._weekday_restricted:
            return day_ok or weekday_ok
        if self._day_restricted:
            return day_ok
        if self._weekday_restricted:
            return weekday_ok
        return True

    def next_after(self, after: datetime | None = None) -> datetime | None:
        """The first firing strictly after `after`, or None if unsatisfiable."""
        moment = (after or datetime.now(timezone.utc)).astimezone(timezone.utc)
        # Start at the next whole minute: cron has minute resolution.
        moment = moment.replace(second=0, microsecond=0) + timedelta(minutes=1)

        for _ in range(_MAX_LOOKAHEAD_MINUTES):
            if self.matches(moment):
                return moment
            moment += timedelta(minutes=1)
        return None


def validate(expression: str) -> CronSchedule:
    """Parse an expression, raising CronError with a readable message if invalid."""
    return CronSchedule(expression)


def next_run(expression: str, after: datetime | None = None) -> datetime | None:
    return CronSchedule(expression).next_after(after)


def describe(expression: str) -> str:
    """A short plain-English gloss, for confirming a schedule reads as intended."""
    text = ALIASES.get(expression.strip().lower(), expression.strip())
    fields = text.split()
    if len(fields) != 5:
        return expression

    minute, hour, day, month, weekday = fields

    if text == "* * * * *":
        return "Every minute"
    if minute.startswith("*/") and hour == "*":
        return f"Every {minute[2:]} minutes"
    if hour.startswith("*/") and minute.isdigit():
        return f"Every {hour[2:]} hours, at {int(minute)} past"
    if minute.isdigit() and hour == "*":
        return f"Hourly, at {int(minute)} past"
    if minute.isdigit() and hour.isdigit():
        when = f"{int(hour):02d}:{int(minute):02d} UTC"
        if day == "*" and month == "*" and weekday == "*":
            return f"Daily at {when}"
        if weekday != "*" and day == "*":
            names = {
                "0": "Sunday", "1": "Monday", "2": "Tuesday", "3": "Wednesday",
                "4": "Thursday", "5": "Friday", "6": "Saturday", "7": "Sunday",
            }
            days = ", ".join(names.get(d, d) for d in weekday.split(","))
            return f"Every {days} at {when}"
        if day != "*" and month == "*":
            return f"Day {day} of each month at {when}"
    return expression
