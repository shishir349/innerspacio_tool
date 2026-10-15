import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { buildSeedCatalogue } from "@/lib/catalogue/seed-data";
import { DEFAULT_SETTINGS } from "@/lib/types";
import type {
  AppSettings,
  BoqRecord,
  CatalogueItem,
  DesignConcept,
  Estimate,
  Project,
  Room,
  RoomAnalysisRecord,
  RoomPhoto,
} from "@/lib/types";
import type {
  NewCatalogueItemInput,
  NewProjectInput,
  NewRoomInput,
  Repository,
  SaveBoqInput,
  UpdateCatalogueItemInput,
  UpdateProjectInput,
  UpdateRoomInput,
} from "@/lib/data/types";
import { RepositoryError } from "@/lib/data/types";

interface DbShape {
  projects: Project[];
  boqs?: BoqRecord[];
  catalogue: CatalogueItem[];
  settings: AppSettings;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "demo-db.json");

function nowIso(): string {
  return new Date().toISOString();
}

function buildSampleProjects(now: string): Project[] {
  const kidsRoomId = "room-kids-1";
  const masterBathRoomId = "room-bath-1";
  const guestBathRoomId = "room-bath-2";

  const kidsRoom: Room = {
    id: kidsRoomId,
    projectId: "project-sharma",
    name: "Kids' Bedroom",
    type: "kids_bedroom",
    dimensions: { length: 11, width: 10, ceilingHeight: 9.5, unit: "ft" },
    photos: [],
    existingConditionNotes:
      "Existing bunk bed to be removed. Walls have minor dampness near the window.",
    preferredStyle: "Playful modern, pastel tones",
    preferredColorPalette: "Soft blue, mint green, white",
    storageRequirements: "Toy storage, study table with drawers, wardrobe for two children",
    materialPreferences: "Low-VOC paint, scratch-resistant laminate",
    budget: 350000,
    constraints: "One window with AC unit already installed — avoid relocating it.",
    concepts: [],
    createdAt: now,
    updatedAt: now,
  };

  const masterBath: Room = {
    id: masterBathRoomId,
    projectId: "project-sharma",
    name: "Master Bathroom",
    type: "bathroom",
    dimensions: { length: 8, width: 6, ceilingHeight: 9, unit: "ft" },
    photos: [],
    existingConditionNotes: "Old ceramic tiles, visible grout discoloration, functioning plumbing.",
    preferredStyle: "Spa-like minimal",
    preferredColorPalette: "Warm grey, matte black fixtures",
    storageRequirements: "Mirror cabinet, under-counter storage",
    materialPreferences: "Anti-skid tiles, quartz counter",
    budget: 280000,
    constraints: "Concealed plumbing condition unknown — flag for site inspection.",
    concepts: [],
    createdAt: now,
    updatedAt: now,
  };

  const guestBath: Room = {
    id: guestBathRoomId,
    projectId: "project-sharma",
    name: "Guest Bathroom",
    type: "bathroom",
    dimensions: { length: 7, width: 5, ceilingHeight: 9, unit: "ft" },
    photos: [],
    existingConditionNotes: "Compact layout, older fittings, no natural ventilation.",
    preferredStyle: "Clean contemporary",
    preferredColorPalette: "White, light beige",
    storageRequirements: "Compact wall-mounted storage",
    materialPreferences: "Budget-friendly tiles, standard sanitaryware",
    budget: 180000,
    constraints: "No window — exhaust fan is essential.",
    concepts: [],
    createdAt: now,
    updatedAt: now,
  };

  const sharmaProject: Project = {
    id: "project-sharma",
    title: "Sharma Residence — Full Home Refresh",
    clientName: "Rohit & Anjali Sharma",
    clientPhone: "+91 98765 43210",
    clientEmail: "rohit.sharma@example.com",
    location: "Sector 50, Noida",
    status: "in_progress",
    budgetRangeMin: 700000,
    budgetRangeMax: 1000000,
    designPreferences: "Warm, family-friendly, low-maintenance materials",
    notes: "Client prefers weekend site visits. Kids currently sharing a temporary room.",
    rooms: [kidsRoom, masterBath, guestBath],
    createdAt: now,
    updatedAt: now,
  };

  const livingRoomProject: Project = {
    id: "project-verma",
    title: "Verma Apartment — Living Room Makeover",
    clientName: "Priya Verma",
    clientPhone: "+91 91234 56789",
    clientEmail: "priya.verma@example.com",
    location: "DLF Phase 3, Gurugram",
    status: "new",
    budgetRangeMin: 300000,
    budgetRangeMax: 450000,
    designPreferences: "Minimal, lots of natural light, neutral palette",
    notes: "",
    rooms: [],
    createdAt: now,
    updatedAt: now,
  };

  return [sharmaProject, livingRoomProject];
}

function freshDb(): DbShape {
  const now = nowIso();
  return {
    projects: buildSampleProjects(now),
    catalogue: buildSeedCatalogue(now),
    settings: { ...DEFAULT_SETTINGS },
  };
}

let dbPromise: Promise<DbShape> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

async function loadDb(): Promise<DbShape> {
  try {
    const raw = await fs.readFile(DB_FILE, "utf-8");
    return JSON.parse(raw) as DbShape;
  } catch {
    const seeded = freshDb();
    await persist(seeded);
    return seeded;
  }
}

async function getDb(): Promise<DbShape> {
  if (!dbPromise) {
    dbPromise = loadDb();
  }
  return dbPromise;
}

async function persist(db: DbShape): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
  });
  await writeQueue;
}

async function mutate<T>(fn: (db: DbShape) => T): Promise<T> {
  const db = await getDb();
  const result = fn(db);
  await persist(db);
  return result;
}

function findProjectOrThrow(db: DbShape, projectId: string): Project {
  const project = db.projects.find((p) => p.id === projectId);
  if (!project) throw new RepositoryError(`Project ${projectId} not found`, "not_found");
  return project;
}

function findRoomOrThrow(project: Project, roomId: string): Room {
  const room = project.rooms.find((r) => r.id === roomId);
  if (!room) throw new RepositoryError(`Room ${roomId} not found`, "not_found");
  return room;
}

export class DemoRepository implements Repository {
  readonly mode = "demo" as const;

  async listProjects(): Promise<Project[]> {
    const db = await getDb();
    return db.projects;
  }

  async getProject(projectId: string): Promise<Project | null> {
    const db = await getDb();
    return db.projects.find((p) => p.id === projectId) ?? null;
  }

  async createProject(input: NewProjectInput): Promise<Project> {
    return mutate((db) => {
      const now = nowIso();
      const project: Project = {
        id: randomUUID(),
        title: input.title,
        clientName: input.clientName,
        clientPhone: input.clientPhone,
        clientEmail: input.clientEmail,
        location: input.location,
        status: input.status ?? "new",
        budgetRangeMin: input.budgetRangeMin,
        budgetRangeMax: input.budgetRangeMax,
        designPreferences: input.designPreferences,
        notes: input.notes,
        rooms: [],
        createdAt: now,
        updatedAt: now,
      };
      db.projects.unshift(project);
      return project;
    });
  }

  async updateProject(projectId: string, patch: UpdateProjectInput): Promise<Project> {
    return mutate((db) => {
      const project = findProjectOrThrow(db, projectId);
      Object.assign(project, patch, { updatedAt: nowIso() });
      return project;
    });
  }

  async deleteProject(projectId: string): Promise<void> {
    await mutate((db) => {
      db.projects = db.projects.filter((p) => p.id !== projectId);
      db.boqs = (db.boqs ?? []).filter((b) => b.projectId !== projectId);
    });
  }

  async listBoqs(projectId: string): Promise<BoqRecord[]> {
    const db = await getDb();
    return (db.boqs ?? []).filter((b) => b.projectId === projectId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getBoq(projectId: string, boqId: string): Promise<BoqRecord | null> {
    const db = await getDb();
    return (db.boqs ?? []).find((b) => b.id === boqId && b.projectId === projectId) ?? null;
  }

  async saveBoq(projectId: string, input: SaveBoqInput): Promise<BoqRecord> {
    return mutate((db) => {
      findProjectOrThrow(db, projectId);
      db.boqs ??= [];
      const now = nowIso();
      const existing = input.id ? db.boqs.find((b) => b.id === input.id && b.projectId === projectId) : undefined;
      if (input.id && !existing) throw new RepositoryError(`BOQ ${input.id} not found`, "not_found");
      if (existing) {
        Object.assign(existing, { ...input, id: existing.id, projectId, updatedAt: now });
        return existing;
      }
      const rec: BoqRecord = { ...input, id: randomUUID(), projectId, createdAt: now, updatedAt: now };
      db.boqs.unshift(rec);
      return rec;
    });
  }

  async deleteBoq(projectId: string, boqId: string): Promise<void> {
    await mutate((db) => {
      findProjectOrThrow(db, projectId);
      db.boqs = (db.boqs ?? []).filter((b) => !(b.id === boqId && b.projectId === projectId));
    });
  }

  async addRoom(projectId: string, input: NewRoomInput): Promise<Room> {
    return mutate((db) => {
      const project = findProjectOrThrow(db, projectId);
      const now = nowIso();
      const room: Room = {
        id: randomUUID(),
        projectId,
        name: input.name,
        type: input.type,
        dimensions: input.dimensions ?? { unit: "ft" },
        photos: [],
        existingConditionNotes: input.existingConditionNotes,
        preferredStyle: input.preferredStyle,
        preferredColorPalette: input.preferredColorPalette,
        storageRequirements: input.storageRequirements,
        materialPreferences: input.materialPreferences,
        budget: input.budget,
        constraints: input.constraints,
        designBrief: input.designBrief,
        concepts: [],
        createdAt: now,
        updatedAt: now,
      };
      project.rooms.push(room);
      project.updatedAt = now;
      return room;
    });
  }

  async updateRoom(projectId: string, roomId: string, patch: UpdateRoomInput): Promise<Room> {
    return mutate((db) => {
      const project = findProjectOrThrow(db, projectId);
      const room = findRoomOrThrow(project, roomId);
      Object.assign(room, patch, { updatedAt: nowIso() });
      project.updatedAt = nowIso();
      return room;
    });
  }

  async deleteRoom(projectId: string, roomId: string): Promise<void> {
    await mutate((db) => {
      const project = findProjectOrThrow(db, projectId);
      project.rooms = project.rooms.filter((r) => r.id !== roomId);
      project.updatedAt = nowIso();
    });
  }

  async addRoomPhoto(
    projectId: string,
    roomId: string,
    photo: Omit<RoomPhoto, "id" | "roomId" | "createdAt">
  ): Promise<RoomPhoto> {
    return mutate((db) => {
      const project = findProjectOrThrow(db, projectId);
      const room = findRoomOrThrow(project, roomId);
      const newPhoto: RoomPhoto = {
        id: randomUUID(),
        roomId,
        createdAt: nowIso(),
        ...photo,
      };
      if (newPhoto.isPrimary) {
        room.photos.forEach((p) => (p.isPrimary = false));
      } else if (room.photos.length === 0) {
        newPhoto.isPrimary = true;
      }
      room.photos.push(newPhoto);
      room.updatedAt = nowIso();
      return newPhoto;
    });
  }

  async removeRoomPhoto(projectId: string, roomId: string, photoId: string): Promise<void> {
    await mutate((db) => {
      const project = findProjectOrThrow(db, projectId);
      const room = findRoomOrThrow(project, roomId);
      room.photos = room.photos.filter((p) => p.id !== photoId);
      room.updatedAt = nowIso();
    });
  }

  async saveRoomAnalysis(
    projectId: string,
    roomId: string,
    record: Omit<RoomAnalysisRecord, "id" | "roomId" | "createdAt">
  ): Promise<Room> {
    return mutate((db) => {
      const project = findProjectOrThrow(db, projectId);
      const room = findRoomOrThrow(project, roomId);
      room.analysis = {
        id: randomUUID(),
        roomId,
        createdAt: nowIso(),
        ...record,
      };
      room.updatedAt = nowIso();
      return room;
    });
  }

  async addConcept(
    projectId: string,
    roomId: string,
    concept: Omit<DesignConcept, "id" | "roomId" | "createdAt" | "isSelected">
  ): Promise<Room> {
    return mutate((db) => {
      const project = findProjectOrThrow(db, projectId);
      const room = findRoomOrThrow(project, roomId);
      const newConcept: DesignConcept = {
        id: randomUUID(),
        roomId,
        createdAt: nowIso(),
        isSelected: false,
        ...concept,
      };
      room.concepts.push(newConcept);
      room.updatedAt = nowIso();
      return room;
    });
  }

  async selectConcept(projectId: string, roomId: string, conceptId: string): Promise<Room> {
    return mutate((db) => {
      const project = findProjectOrThrow(db, projectId);
      const room = findRoomOrThrow(project, roomId);
      const concept = room.concepts.find((c) => c.id === conceptId);
      if (!concept) throw new RepositoryError(`Concept ${conceptId} not found`, "not_found");
      room.concepts.forEach((c) => (c.isSelected = c.id === conceptId));
      room.selectedConceptId = conceptId;
      room.updatedAt = nowIso();
      return room;
    });
  }

  async deleteConcept(projectId: string, roomId: string, conceptId: string): Promise<Room> {
    return mutate((db) => {
      const project = findProjectOrThrow(db, projectId);
      const room = findRoomOrThrow(project, roomId);
      const existed = room.concepts.some((c) => c.id === conceptId);
      if (!existed) throw new RepositoryError(`Concept ${conceptId} not found`, "not_found");
      room.concepts = room.concepts.filter((c) => c.id !== conceptId);
      if (room.selectedConceptId === conceptId) room.selectedConceptId = undefined;
      room.updatedAt = nowIso();
      return room;
    });
  }

  async saveEstimate(
    projectId: string,
    roomId: string,
    estimate: Omit<Estimate, "id" | "roomId" | "projectId" | "createdAt" | "updatedAt">
  ): Promise<Room> {
    return mutate((db) => {
      const project = findProjectOrThrow(db, projectId);
      const room = findRoomOrThrow(project, roomId);
      const now = nowIso();
      room.estimate = {
        id: room.estimate?.id ?? randomUUID(),
        roomId,
        projectId,
        createdAt: room.estimate?.createdAt ?? now,
        updatedAt: now,
        ...estimate,
      };
      room.updatedAt = now;
      return room;
    });
  }

  async listCatalogueItems(): Promise<CatalogueItem[]> {
    const db = await getDb();
    return db.catalogue;
  }

  async createCatalogueItem(input: NewCatalogueItemInput): Promise<CatalogueItem> {
    return mutate((db) => {
      const now = nowIso();
      const item: CatalogueItem = {
        id: randomUUID(),
        isActive: input.isActive ?? true,
        createdAt: now,
        updatedAt: now,
        ...input,
      };
      db.catalogue.push(item);
      return item;
    });
  }

  async updateCatalogueItem(
    itemId: string,
    patch: UpdateCatalogueItemInput
  ): Promise<CatalogueItem> {
    return mutate((db) => {
      const item = db.catalogue.find((i) => i.id === itemId);
      if (!item) throw new RepositoryError(`Catalogue item ${itemId} not found`, "not_found");
      Object.assign(item, patch, { updatedAt: nowIso() });
      return item;
    });
  }

  async deleteCatalogueItem(itemId: string): Promise<void> {
    await mutate((db) => {
      db.catalogue = db.catalogue.filter((i) => i.id !== itemId);
    });
  }

  async getSettings(): Promise<AppSettings> {
    const db = await getDb();
    return db.settings;
  }

  async updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    return mutate((db) => {
      db.settings = { ...db.settings, ...patch };
      return db.settings;
    });
  }
}
