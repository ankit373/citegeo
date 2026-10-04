import type { BrandTier } from "../topics/visibility-tier.js";
export type ProductProjectStatus = "draft" | "active" | "archived" | "deleted";

export type RestorableProductProjectStatus = "draft" | "active" | "archived";

export interface ProductProject {
  id: string;
  name: string;
  primaryDomain: string;
  normalizedDomain: string;
  brandName: string;
  aliases: string[];
  defaultLanguage: string;
  /** The kind of brand this is, declared so a visibility figure can be read
   * against what that kind tends to get. Absent until somebody says. */
  tier?: BrandTier | undefined;
  activeBaselineId?: string | undefined;
  status: ProductProjectStatus;
  statusBeforeArchive?: "draft" | "active" | undefined;
  statusBeforeDelete?: RestorableProductProjectStatus | undefined;
  archivedAt?: string | undefined;
  deletedAt?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductProjectInput {
  primaryDomain: string;
  name?: string | undefined;
  brandName?: string | undefined;
  aliases?: string[] | undefined;
  defaultLanguage?: string | undefined;
  tier?: BrandTier | undefined;
}

export interface UpdateProductProjectInput {
  primaryDomain?: string | undefined;
  name?: string | undefined;
  brandName?: string | undefined;
  aliases?: string[] | undefined;
  defaultLanguage?: string | undefined;
  tier?: BrandTier | undefined;
}

export interface ProductProjectListOptions {
  includeArchived?: boolean | undefined;
  includeDeleted?: boolean | undefined;
}
