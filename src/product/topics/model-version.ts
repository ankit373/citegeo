import { wilsonInterval, type ProportionInterval } from "./proportion-interval.js";
import type { PromptAnswer } from "./prompt-run-schema.js";

// Every trend line in this category assumes the thing being measured held
// still while the brand changed. It did not. A model ships a new version and
// every figure taken across that day compares two different machines.
//
// Some providers name the version they actually ran and some echo back what
// was asked for. Those are different states and reading the second as "the
// version never changed" would invent the one fact this is for.

export const VERSION_CAVEAT = "A provider that names the version it ran makes a change visible. One that echoes back what it was asked says nothing either way, and that is reported as unconfirmed rather than as steady. A shift across a version boundary is not attributable to anything you did, and it is not evidence the new version is worse: the same questions put to a different machine are a different measurement.";

/** Below this an arm's rate is too thin for the shift across a boundary to
 * mean anything, however large the shift looks. */
export const MIN_EITHER_SIDE = 8;

export interface VersionSeen {
  version: string;
  /** Completed answers from this version. */
  answers: number;
  firstAt: string;
  lastAt: string;
  presence: ProportionInterval;
}

export interface VersionShift {
  modelId: string;
  from: VersionSeen;
  to: VersionSeen;
  /** Change in presence across the boundary. Null where either side is thin. */
  change: number | null;
  /** True where the two intervals do not overlap, so the shift is more than
   * the noise on either side of it. */
  separated: boolean | null;
}

export interface ModelVersions {
  modelId: string;
  /** False where the provider only ever echoed the model asked for, so no
   * change could have been seen whether or not one happened. */
  reported: boolean;
  versions: VersionSeen[];
  shifts: VersionShift[];
}

export interface VersionReport {
  models: ModelVersions[];
  /** Models whose provider never named a version, so a change there is
   * invisible rather than absent. */
  unconfirmed: string[];
  /** Boundaries where the presence moved and the two sides do not overlap. */
  separatedShifts: number;
  caveat: string;
}

function summarise(version: string, rows: PromptAnswer[]): VersionSeen {
  const times = rows.map((row) => row.createdAt).filter(Boolean).sort();
  const named = rows.filter((row) => row.mentions.some((mention) => mention.isTarget)).length;
  return {
    version,
    answers: rows.length,
    firstAt: times[0] || "",
    lastAt: times[times.length - 1] || "",
    presence: wilsonInterval(named, rows.length),
  };
}

export function buildVersionReport(answers: PromptAnswer[]): VersionReport {
  const byModel = new Map<string, PromptAnswer[]>();
  for (const answer of answers) {
    if (answer.status !== "completed") continue;
    const rows = byModel.get(answer.modelId) || [];
    rows.push(answer);
    byModel.set(answer.modelId, rows);
  }

  const models: ModelVersions[] = [];
  const unconfirmed: string[] = [];
  let separatedShifts = 0;

  for (const [modelId, rows] of byModel) {
    const byVersion = new Map<string, PromptAnswer[]>();
    for (const row of rows) {
      // No version recorded is not the same as the version asked for, and a
      // version equal to what was asked tells nothing either.
      const version = row.modelVersion;
      if (!version || version === modelId) continue;
      const seen = byVersion.get(version) || [];
      seen.push(row);
      byVersion.set(version, seen);
    }
    if (!byVersion.size) {
      unconfirmed.push(modelId);
      models.push({ modelId, reported: false, versions: [], shifts: [] });
      continue;
    }
    const versions = [...byVersion.entries()]
      .map(([version, seen]) => summarise(version, seen))
      .sort((left, right) => left.firstAt.localeCompare(right.firstAt));

    const shifts: VersionShift[] = [];
    for (let index = 1; index < versions.length; index += 1) {
      const from = versions[index - 1] as VersionSeen;
      const to = versions[index] as VersionSeen;
      const thin = from.answers < MIN_EITHER_SIDE || to.answers < MIN_EITHER_SIDE;
      const change = thin || from.presence.rate === null || to.presence.rate === null
        ? null
        : Math.round((to.presence.rate - from.presence.rate) * 1000) / 1000;
      // Separated means the ranges do not touch. Two rates that differ while
      // their ranges overlap have not been shown to differ at all.
      const separated = thin || from.presence.low === null || to.presence.low === null
        ? null
        : (to.presence.low as number) > (from.presence.high as number) || (to.presence.high as number) < (from.presence.low as number);
      if (separated) separatedShifts += 1;
      shifts.push({ modelId, from, to, change, separated });
    }
    models.push({ modelId, reported: true, versions, shifts });
  }

  models.sort((left, right) => right.shifts.length - left.shifts.length || left.modelId.localeCompare(right.modelId));
  return { models, unconfirmed, separatedShifts, caveat: VERSION_CAVEAT };
}
