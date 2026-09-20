import { CronExpressionParser } from "cron-parser";
import type { MonitoringScheduleRule } from "./schedule-schema.js";

// The rule evaluator, shared. It used to be private to the measurement
// scheduler, so scheduling anything else meant reimplementing timezone-aware
// next-occurrence maths, which is exactly the code nobody should write twice.

function validInteger(value: number | undefined, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum;
}

export function cronFor(rule: MonitoringScheduleRule): string {
  const hour = rule.hour === undefined ? 9 : rule.hour;
  const minute = rule.minute === undefined ? 0 : rule.minute;
  if (!validInteger(hour, 0, 23) || !validInteger(minute, 0, 59)) throw new Error("Schedule hour and minute are invalid.");
  if (rule.frequency === "daily") return `0 ${minute} ${hour} * * *`;
  if (rule.frequency === "weekly") {
    if (!validInteger(rule.weekday, 0, 6)) throw new Error("Weekly schedule weekday is invalid.");
    return `0 ${minute} ${hour} * * ${rule.weekday}`;
  }
  if (rule.frequency === "monthly") {
    if (!validInteger(rule.dayOfMonth, 1, 31)) throw new Error("Monthly schedule day is invalid.");
    return `0 ${minute} ${hour} ${rule.dayOfMonth} * *`;
  }
  if (!rule.cron?.trim()) throw new Error("A custom Cron expression is required.");
  return rule.cron.trim();
}

export function nextDates(rule: MonitoringScheduleRule, after: Date, count: number): Date[] {
  const expression = CronExpressionParser.parse(cronFor(rule), { currentDate: after, tz: rule.timezone });
  const values: Date[] = [];
  for (let index = 0; index < count; index += 1) values.push(expression.next().toDate());
  return values;
}

export function nextRunAt(rule: MonitoringScheduleRule, after: Date = new Date()): string | null {
  return nextDates(rule, after, 1)[0]?.toISOString() || null;
}

export function dateKey(value: Date, timezone: string): string {
  const pieces = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const byType = new Map(pieces.map((item) => [item.type, item.value]));
  return `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}`;
}
