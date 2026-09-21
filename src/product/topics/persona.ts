import { randomUUID } from "node:crypto";
import { getJson, putJson } from "../storage/object-store.js";
import type { ProductProjectFileStore } from "../projects/project-store.js";

// Who the question is being asked on behalf of. A market says where somebody
// is; a persona says what they are, which changes the answer more.

export class PersonaUnavailableError extends Error {}

export interface Persona {
  id: string;
  label: string;
  /** How the asker is described to the model, in its own words. */
  describedAs: string;
  /** False once retired, kept so past answers still resolve to a label. */
  tracked: boolean;
  addedAt: string;
}

export interface PersonaSet {
  projectId: string;
  personas: Persona[];
  updatedAt: string;
}

/** Nobody in particular. The default, and identical to how every run before
 * personas existed was asked, so the two stay comparable. */
export const NO_PERSONA: Persona = {
  id: "anyone",
  label: "No stated persona",
  describedAs: "",
  tracked: true,
  addedAt: "",
};

export function personaInstruction(row: Persona): string {
  return row.describedAs ? `The person asking is ${row.describedAs}. Answer for them.` : "";
}

export function personaFrom(set: PersonaSet | null, id: string): Persona | undefined {
  if (id === NO_PERSONA.id) return NO_PERSONA;
  return set?.personas.find((row) => row.id === id);
}

export function trackedPersonas(set: PersonaSet): Persona[] {
  return set.personas.filter((row) => row.tracked);
}

export class PersonaService {
  constructor(private readonly projects: ProductProjectFileStore) {}

  private key(projectId: string): string {
    return this.projects.keyFor(projectId, "personas", "set.json");
  }

  async get(projectId: string): Promise<PersonaSet> {
    const row = await getJson<PersonaSet>(this.projects.objects, this.key(projectId));
    return row && row.projectId === projectId ? row : { projectId, personas: [], updatedAt: new Date().toISOString() };
  }

  async add(projectId: string, input: { label: string; describedAs: string }): Promise<PersonaSet> {
    const label = input.label.trim();
    const describedAs = input.describedAs.trim();
    if (!label) throw new PersonaUnavailableError("A persona needs a name.");
    // Without a description the model is told nothing, and the run would be a
    // copy of the unstated one under a different label.
    if (!describedAs) throw new PersonaUnavailableError("A persona needs a description, or the model is told nothing about who is asking.");
    const set = await this.get(projectId);
    const already = set.personas.find((row) => row.label.toLocaleLowerCase() === label.toLocaleLowerCase());
    if (already) {
      already.tracked = true;
      already.describedAs = describedAs;
    } else {
      set.personas.push({ id: `persona-${randomUUID()}`, label, describedAs, tracked: true, addedAt: new Date().toISOString() });
    }
    set.updatedAt = new Date().toISOString();
    await putJson(this.projects.objects, this.key(projectId), set);
    return set;
  }

  async retire(projectId: string, personaIds: string[]): Promise<PersonaSet> {
    const set = await this.get(projectId);
    const wanted = new Set(personaIds);
    for (const row of set.personas) if (wanted.has(row.id)) row.tracked = false;
    set.updatedAt = new Date().toISOString();
    await putJson(this.projects.objects, this.key(projectId), set);
    return set;
  }
}
