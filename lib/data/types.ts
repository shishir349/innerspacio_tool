import type {
  AppSettings,
  BoqRecord,
  CatalogueItem,
  DesignConcept,
  Estimate,
  Project,
  ProjectSummary,
  Room,
  RoomAnalysisRecord,
  RoomDesignBrief,
  RoomPhoto,
} from "@/lib/types";

export type NewProjectInput = {
  title: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  location: string;
  status?: Project["status"];
  budgetRangeMin?: number;
  budgetRangeMax?: number;
  designPreferences?: string;
  notes?: string;
};

export type UpdateProjectInput = Partial<NewProjectInput>;

export type NewRoomInput = {
  name: string;
  type: Room["type"];
  dimensions?: Room["dimensions"];
  existingConditionNotes?: string;
  preferredStyle?: string;
  preferredColorPalette?: string;
  storageRequirements?: string;
  materialPreferences?: string;
  budget?: number;
  constraints?: string;
  designBrief?: RoomDesignBrief;
};

export type UpdateRoomInput = Partial<NewRoomInput>;

export type SaveBoqInput = {
  /** Present = update that BOQ; absent = create. */
  id?: string;
  leadId?: string;
  title: string;
  tier: string;
  city: string;
  sheet: string;
  total: number;
  payload: Record<string, unknown>;
};

export type NewCatalogueItemInput = {
  name: string;
  category: CatalogueItem["category"];
  unit: string;
  baseCostPerUnit: number;
  defaultQuantity?: number;
  sellingDescription?: string;
  isActive?: boolean;
};

export type UpdateCatalogueItemInput = Partial<NewCatalogueItemInput>;

/**
 * Persistence boundary. Implemented by both a local JSON-file demo store
 * (used automatically when Supabase is not configured) and a Supabase-backed
 * store. The rest of the app only depends on this interface.
 */
export interface Repository {
  readonly mode: "demo" | "supabase";

  listProjects(): Promise<Project[]>;
  /** Cheap list for dashboards and indexes. Use listProjects only when photos, concepts or estimates are needed. */
  listProjectSummaries(): Promise<ProjectSummary[]>;
  getProject(projectId: string): Promise<Project | null>;
  createProject(input: NewProjectInput): Promise<Project>;
  updateProject(projectId: string, patch: UpdateProjectInput): Promise<Project>;
  deleteProject(projectId: string): Promise<void>;

  addRoom(projectId: string, input: NewRoomInput): Promise<Room>;
  updateRoom(projectId: string, roomId: string, patch: UpdateRoomInput): Promise<Room>;
  deleteRoom(projectId: string, roomId: string): Promise<void>;

  addRoomPhoto(
    projectId: string,
    roomId: string,
    photo: Omit<RoomPhoto, "id" | "roomId" | "createdAt">
  ): Promise<RoomPhoto>;
  removeRoomPhoto(projectId: string, roomId: string, photoId: string): Promise<void>;

  saveRoomAnalysis(
    projectId: string,
    roomId: string,
    record: Omit<RoomAnalysisRecord, "id" | "roomId" | "createdAt">
  ): Promise<Room>;

  addConcept(
    projectId: string,
    roomId: string,
    concept: Omit<DesignConcept, "id" | "roomId" | "createdAt" | "isSelected">
  ): Promise<Room>;
  selectConcept(projectId: string, roomId: string, conceptId: string): Promise<Room>;
  /** Ownership-checked deletion. Also clears `room.selectedConceptId` if it pointed at the deleted concept, and removes the stored image (if any) from storage. */
  deleteConcept(projectId: string, roomId: string, conceptId: string): Promise<Room>;

  saveEstimate(
    projectId: string,
    roomId: string,
    estimate: Omit<Estimate, "id" | "roomId" | "projectId" | "createdAt" | "updatedAt">
  ): Promise<Room>;

  listCatalogueItems(): Promise<CatalogueItem[]>;
  createCatalogueItem(input: NewCatalogueItemInput): Promise<CatalogueItem>;
  updateCatalogueItem(itemId: string, patch: UpdateCatalogueItemInput): Promise<CatalogueItem>;
  deleteCatalogueItem(itemId: string): Promise<void>;

  /** BOQs live under a project; every method verifies the project first. */
  listBoqs(projectId: string): Promise<BoqRecord[]>;
  getBoq(projectId: string, boqId: string): Promise<BoqRecord | null>;
  saveBoq(projectId: string, input: SaveBoqInput): Promise<BoqRecord>;
  /** The newest BOQ whose stored AI reading has this hash (see lib/boq/provenance.ts), across projects. */
  findBoqByReading(hash: string): Promise<BoqRecord | null>;
  deleteBoq(projectId: string, boqId: string): Promise<void>;

  getSettings(): Promise<AppSettings>;
  updateSettings(patch: Partial<AppSettings>): Promise<AppSettings>;
}

export class RepositoryError extends Error {
  constructor(message: string, public readonly code: "not_found" | "invalid" = "invalid") {
    super(message);
  }
}
