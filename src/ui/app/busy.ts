/** What each project has in flight, by kind. A slow action belongs to the project that started it,
 * so a switch neither shows it as busy on another project nor lets that one's own be refused. */
export class ProjectBusy {
  private readonly held = new Map<string, string[]>();

  start(projectId: string, kind: string): void {
    this.held.set(projectId, [...(this.held.get(projectId) || []), kind]);
  }

  /** Removes one of this kind only, so another action on the same project keeps its own. */
  end(projectId: string, kind: string): void {
    const kinds = [...(this.held.get(projectId) || [])];
    const at = kinds.indexOf(kind);
    if (at >= 0) kinds.splice(at, 1);
    if (kinds.length) this.held.set(projectId, kinds); else this.held.delete(projectId);
  }

  has(projectId: string, kind: string): boolean {
    return (this.held.get(projectId) || []).includes(kind);
  }

  kinds(projectId: string): string[] {
    return [...(this.held.get(projectId) || [])];
  }
}
