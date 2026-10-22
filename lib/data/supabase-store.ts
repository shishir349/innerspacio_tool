import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_SETTINGS } from "@/lib/types";
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
import { refreshSignedPhotoUrl } from "@/lib/storage";

// ─────────────────────────── row <-> domain mapping ───────────────────────

type Row = Record<string, unknown>;

function mapBoqRow(row: Row): BoqRecord {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    leadId: (row.lead_id as string) ?? undefined,
    title: row.title as string,
    tier: row.tier as string,
    city: row.city as string,
    sheet: row.sheet as string,
    total: Number(row.total),
    payload: (row.payload as Record<string, unknown>) ?? {},
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapProjectRow(row: Row, rooms: Room[]): Project {
  return {
    id: row.id as string,
    title: row.title as string,
    clientName: row.client_name as string,
    clientPhone: (row.client_phone as string) ?? undefined,
    clientEmail: (row.client_email as string) ?? undefined,
    location: row.location as string,
    status: row.status as Project["status"],
    budgetRangeMin: (row.budget_range_min as number) ?? undefined,
    budgetRangeMax: (row.budget_range_max as number) ?? undefined,
    designPreferences: (row.design_preferences as string) ?? undefined,
    notes: (row.notes as string) ?? undefined,
    rooms,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapRoomRow(
  row: Row,
  photos: RoomPhoto[],
  concepts: DesignConcept[],
  analysis: RoomAnalysisRecord | undefined,
  estimate: Estimate | undefined
): Room {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    name: row.name as string,
    type: row.type as Room["type"],
    dimensions: {
      length: (row.dimension_length as number) ?? undefined,
      width: (row.dimension_width as number) ?? undefined,
      ceilingHeight: (row.dimension_ceiling_height as number) ?? undefined,
      unit: (row.dimension_unit as Room["dimensions"]["unit"]) ?? "ft",
    },
    photos,
    existingConditionNotes: (row.existing_condition_notes as string) ?? undefined,
    preferredStyle: (row.preferred_style as string) ?? undefined,
    preferredColorPalette: (row.preferred_color_palette as string) ?? undefined,
    storageRequirements: (row.storage_requirements as string) ?? undefined,
    materialPreferences: (row.material_preferences as string) ?? undefined,
    budget: (row.budget as number) ?? undefined,
    constraints: (row.constraints as string) ?? undefined,
    designBrief: (row.design_brief as RoomDesignBrief) ?? undefined,
    analysis,
    concepts,
    selectedConceptId: (row.selected_concept_id as string) ?? undefined,
    estimate,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapPhotoRow(row: Row): RoomPhoto {
  return {
    id: row.id as string,
    roomId: row.room_id as string,
    url: row.url as string,
    storagePath: (row.storage_path as string) ?? undefined,
    caption: (row.caption as string) ?? undefined,
    isPrimary: Boolean(row.is_primary),
    createdAt: row.created_at as string,
  };
}

function mapConceptRow(row: Row): DesignConcept {
  return {
    id: row.id as string,
    roomId: row.room_id as string,
    title: row.title as string,
    style: row.style as string,
    description: row.description as string,
    keyChanges: (row.key_changes as string[]) ?? [],
    imageUrl: row.image_url as string,
    storagePath: (row.storage_path as string) ?? undefined,
    provider: row.provider as string,
    status: row.status as DesignConcept["status"],
    isSelected: Boolean(row.is_selected),
    createdAt: row.created_at as string,
  };
}

function mapAnalysisRow(row: Row): RoomAnalysisRecord {
  return {
    id: row.id as string,
    roomId: row.room_id as string,
    analysis: row.analysis as RoomAnalysisRecord["analysis"],
    designerNotes: (row.designer_notes as string) ?? undefined,
    reviewedByDesigner: Boolean(row.reviewed_by_designer),
    createdAt: row.created_at as string,
  };
}

function mapEstimateRow(row: Row, lineItems: Row[]): Estimate {
  return {
    id: row.id as string,
    roomId: row.room_id as string,
    projectId: row.project_id as string,
    conceptId: (row.concept_id as string) ?? undefined,
    calculation: {
      lineItems: lineItems.map((li) => ({
        id: li.id as string,
        catalogueItemId: (li.catalogue_item_id as string) ?? "",
        name: li.name as string,
        unit: li.unit as string,
        baseCostPerUnit: li.base_cost_per_unit as number,
        quantity: li.quantity as number,
        lineDirectCost: li.line_direct_cost as number,
      })),
      additionalCosts: (row.additional_costs as Estimate["calculation"]["additionalCosts"]) ?? [],
      directCost: row.direct_cost as number,
      contingencyPercent: row.contingency_percent as number,
      contingencyAmount: row.contingency_amount as number,
      costBasis: row.cost_basis as number,
      targetGrossMarginPercent: row.target_gross_margin_percent as number,
      targetSellingSubtotal: row.target_selling_subtotal as number,
      grossProfit: row.gross_profit as number,
      actualGrossMarginPercent: row.actual_gross_margin_percent as number,
      gstPercent: row.gst_percent as number,
      gstAmount: row.gst_amount as number,
      totalClientEstimate: row.total_client_estimate as number,
    },
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapCatalogueRow(row: Row): CatalogueItem {
  return {
    id: row.id as string,
    name: row.name as string,
    category: row.category as CatalogueItem["category"],
    unit: row.unit as string,
    baseCostPerUnit: row.base_cost_per_unit as number,
    defaultQuantity: (row.default_quantity as number) ?? undefined,
    sellingDescription: (row.selling_description as string) ?? undefined,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function throwIfError(error: { message: string } | null, context: string): void {
  if (error) throw new RepositoryError(`${context}: ${error.message}`);
}

// ───────────────────────────────── repository ──────────────────────────────

export class SupabaseRepository implements Repository {
  readonly mode = "supabase" as const;

  constructor(private readonly client: SupabaseClient) {}

  private async hydrateRoom(roomRow: Row): Promise<Room> {
    const roomId = roomRow.id as string;
    const [{ data: photos, error: photosErr }, { data: concepts, error: conceptsErr }, { data: analyses, error: analysesErr }, { data: estimateRow, error: estimateErr }] =
      await Promise.all([
        this.client.from("room_photos").select("*").eq("room_id", roomId).order("created_at"),
        this.client.from("design_concepts").select("*").eq("room_id", roomId).order("created_at"),
        this.client
          .from("room_analyses")
          .select("*")
          .eq("room_id", roomId)
          .order("created_at", { ascending: false })
          .limit(1),
        this.client.from("estimates").select("*").eq("room_id", roomId).maybeSingle(),
      ]);
    throwIfError(photosErr, "Loading room photos");
    throwIfError(conceptsErr, "Loading design concepts");
    throwIfError(analysesErr, "Loading room analysis");
    throwIfError(estimateErr, "Loading estimate");

    let estimate: Estimate | undefined;
    if (estimateRow) {
      const { data: lineItems, error: lineItemsErr } = await this.client
        .from("estimate_line_items")
        .select("*")
        .eq("estimate_id", estimateRow.id);
      throwIfError(lineItemsErr, "Loading estimate line items");
      estimate = mapEstimateRow(estimateRow, lineItems ?? []);
    }

    const hydratedPhotos = await Promise.all(
      (photos ?? []).map(async (row) => {
        const photo = mapPhotoRow(row);
        if (photo.storagePath) {
          const fresh = await refreshSignedPhotoUrl(this.client, photo.storagePath);
          if (fresh) photo.url = fresh;
        }
        return photo;
      })
    );

    const hydratedConcepts = await Promise.all(
      (concepts ?? []).map(async (row) => {
        const concept = mapConceptRow(row);
        if (concept.storagePath) {
          const fresh = await refreshSignedPhotoUrl(this.client, concept.storagePath);
          if (fresh) concept.imageUrl = fresh;
        }
        return concept;
      })
    );

    return mapRoomRow(
      roomRow,
      hydratedPhotos,
      hydratedConcepts,
      analyses?.[0] ? mapAnalysisRow(analyses[0]) : undefined,
      estimate
    );
  }

  private async hydrateProject(projectRow: Row): Promise<Project> {
    const { data: roomRows, error } = await this.client
      .from("rooms")
      .select("*")
      .eq("project_id", projectRow.id)
      .order("created_at");
    throwIfError(error, "Loading rooms");
    const rooms = await Promise.all((roomRows ?? []).map((r) => this.hydrateRoom(r)));
    return mapProjectRow(projectRow, rooms);
  }

  async listProjects(): Promise<Project[]> {
    const { data, error } = await this.client
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    throwIfError(error, "Listing projects");
    return Promise.all((data ?? []).map((p) => this.hydrateProject(p)));
  }

  async listProjectSummaries(): Promise<ProjectSummary[]> {
    const q = this.client;
    const [projects, rooms, photos, concepts, analyses] = await Promise.all([
      q
        .from("projects")
        .select("id, title, client_name, location, status, budget_range_max, created_at, updated_at")
        .order("created_at", { ascending: false }),
      q.from("rooms").select("id, project_id, name, type, selected_concept_id").order("created_at"),
      q.from("room_photos").select("room_id"),
      q.from("design_concepts").select("room_id"),
      q.from("room_analyses").select("room_id"),
    ]);
    throwIfError(projects.error, "Listing projects");
    throwIfError(rooms.error, "Listing rooms");
    const count = (rows: { room_id: unknown }[] | null) => {
      const m = new Map<string, number>();
      for (const r of rows ?? []) m.set(r.room_id as string, (m.get(r.room_id as string) ?? 0) + 1);
      return m;
    };
    const nPhotos = count(photos.data);
    const nConcepts = count(concepts.data);
    const analyzed = count(analyses.data);
    return (projects.data ?? []).map((p) => ({
      id: p.id as string,
      title: p.title as string,
      clientName: p.client_name as string,
      location: p.location as string,
      status: p.status as Project["status"],
      budgetRangeMax: (p.budget_range_max as number) ?? undefined,
      createdAt: p.created_at as string,
      updatedAt: p.updated_at as string,
      rooms: (rooms.data ?? [])
        .filter((r) => r.project_id === p.id)
        .map((r) => ({
          id: r.id as string,
          name: r.name as string,
          type: r.type as Room["type"],
          photoCount: nPhotos.get(r.id as string) ?? 0,
          conceptCount: nConcepts.get(r.id as string) ?? 0,
          hasSelectedConcept: Boolean(r.selected_concept_id),
          analyzed: (analyzed.get(r.id as string) ?? 0) > 0,
        })),
    }));
  }

  async getProject(projectId: string): Promise<Project | null> {
    const { data, error } = await this.client
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .maybeSingle();
    throwIfError(error, "Loading project");
    if (!data) return null;
    return this.hydrateProject(data);
  }

  async createProject(input: NewProjectInput): Promise<Project> {
    const { data, error } = await this.client
      .from("projects")
      .insert({
        title: input.title,
        client_name: input.clientName,
        client_phone: input.clientPhone,
        client_email: input.clientEmail,
        location: input.location,
        status: input.status ?? "new",
        budget_range_min: input.budgetRangeMin,
        budget_range_max: input.budgetRangeMax,
        design_preferences: input.designPreferences,
        notes: input.notes,
      })
      .select("*")
      .single();
    throwIfError(error, "Creating project");
    return this.hydrateProject(data);
  }

  async updateProject(projectId: string, patch: UpdateProjectInput): Promise<Project> {
    const { data, error } = await this.client
      .from("projects")
      .update({
        title: patch.title,
        client_name: patch.clientName,
        client_phone: patch.clientPhone,
        client_email: patch.clientEmail,
        location: patch.location,
        status: patch.status,
        budget_range_min: patch.budgetRangeMin,
        budget_range_max: patch.budgetRangeMax,
        design_preferences: patch.designPreferences,
        notes: patch.notes,
      })
      .eq("id", projectId)
      .select("*")
      .single();
    throwIfError(error, "Updating project");
    return this.hydrateProject(data);
  }

  async deleteProject(projectId: string): Promise<void> {
    const { error } = await this.client.from("projects").delete().eq("id", projectId);
    throwIfError(error, "Deleting project");
  }

  private async assertProject(projectId: string): Promise<void> {
    const { data, error } = await this.client.from("projects").select("id").eq("id", projectId).maybeSingle();
    throwIfError(error, "Checking project");
    if (!data) throw new RepositoryError(`Project ${projectId} not found`, "not_found");
  }

  async listBoqs(projectId: string): Promise<BoqRecord[]> {
    const { data, error } = await this.client
      .from("boqs")
      .select("*")
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false });
    // Migration 0005 not applied yet: the project page still has to render.
    if (error && /does not exist|schema cache/i.test(error.message)) return [];
    throwIfError(error, "Listing BOQs");
    return (data ?? []).map(mapBoqRow);
  }

  async getBoq(projectId: string, boqId: string): Promise<BoqRecord | null> {
    const { data, error } = await this.client
      .from("boqs")
      .select("*")
      .eq("id", boqId)
      .eq("project_id", projectId)
      .maybeSingle();
    if (error && /does not exist|schema cache/i.test(error.message)) return null;
    throwIfError(error, "Loading BOQ");
    return data ? mapBoqRow(data) : null;
  }

  async findBoqByReading(hash: string): Promise<BoqRecord | null> {
    const { data, error } = await this.client
      .from("boqs")
      .select("*")
      .eq("payload->reading->>hash", hash)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error && /does not exist|schema cache/i.test(error.message)) return null;
    throwIfError(error, "Finding a stored plan reading");
    return data ? mapBoqRow(data) : null;
  }

  async saveBoq(projectId: string, input: SaveBoqInput): Promise<BoqRecord> {
    await this.assertProject(projectId);
    const row = {
      project_id: projectId,
      lead_id: input.leadId ?? null,
      title: input.title,
      tier: input.tier,
      city: input.city,
      sheet: input.sheet,
      total: input.total,
      payload: input.payload,
    };
    if (input.id) {
      const { data, error } = await this.client
        .from("boqs")
        .update(row)
        .eq("id", input.id)
        .eq("project_id", projectId)
        .select("*")
        .maybeSingle();
      throwIfError(error, "Saving BOQ");
      if (!data) throw new RepositoryError(`BOQ ${input.id} not found`, "not_found");
      return mapBoqRow(data);
    }
    const { data, error } = await this.client.from("boqs").insert(row).select("*").single();
    throwIfError(error, "Saving BOQ");
    return mapBoqRow(data as Row);
  }

  async deleteBoq(projectId: string, boqId: string): Promise<void> {
    const { error } = await this.client.from("boqs").delete().eq("id", boqId).eq("project_id", projectId);
    throwIfError(error, "Deleting BOQ");
  }

  async addRoom(projectId: string, input: NewRoomInput): Promise<Room> {
    const { data, error } = await this.client
      .from("rooms")
      .insert({
        project_id: projectId,
        name: input.name,
        type: input.type,
        dimension_length: input.dimensions?.length,
        dimension_width: input.dimensions?.width,
        dimension_ceiling_height: input.dimensions?.ceilingHeight,
        dimension_unit: input.dimensions?.unit ?? "ft",
        existing_condition_notes: input.existingConditionNotes,
        preferred_style: input.preferredStyle,
        preferred_color_palette: input.preferredColorPalette,
        storage_requirements: input.storageRequirements,
        material_preferences: input.materialPreferences,
        budget: input.budget,
        constraints: input.constraints,
        design_brief: input.designBrief,
      })
      .select("*")
      .single();
    throwIfError(error, "Adding room");
    return this.hydrateRoom(data);
  }

  async updateRoom(projectId: string, roomId: string, patch: UpdateRoomInput): Promise<Room> {
    const { data, error } = await this.client
      .from("rooms")
      .update({
        name: patch.name,
        type: patch.type,
        dimension_length: patch.dimensions?.length,
        dimension_width: patch.dimensions?.width,
        dimension_ceiling_height: patch.dimensions?.ceilingHeight,
        dimension_unit: patch.dimensions?.unit,
        existing_condition_notes: patch.existingConditionNotes,
        preferred_style: patch.preferredStyle,
        preferred_color_palette: patch.preferredColorPalette,
        storage_requirements: patch.storageRequirements,
        material_preferences: patch.materialPreferences,
        budget: patch.budget,
        constraints: patch.constraints,
        design_brief: patch.designBrief,
      })
      .eq("id", roomId)
      .eq("project_id", projectId)
      .select("*")
      .single();
    throwIfError(error, "Updating room");
    return this.hydrateRoom(data);
  }

  async deleteRoom(projectId: string, roomId: string): Promise<void> {
    const { error } = await this.client
      .from("rooms")
      .delete()
      .eq("id", roomId)
      .eq("project_id", projectId);
    throwIfError(error, "Deleting room");
  }

  async addRoomPhoto(
    projectId: string,
    roomId: string,
    photo: Omit<RoomPhoto, "id" | "roomId" | "createdAt">
  ): Promise<RoomPhoto> {
    await this.assertRoomInProject(projectId, roomId);

    const { error: clearPrimaryErr } = photo.isPrimary
      ? await this.client.from("room_photos").update({ is_primary: false }).eq("room_id", roomId)
      : { error: null };
    throwIfError(clearPrimaryErr, "Clearing previous primary photo");

    const { data, error } = await this.client
      .from("room_photos")
      .insert({
        room_id: roomId,
        url: photo.url,
        storage_path: photo.storagePath,
        caption: photo.caption,
        is_primary: photo.isPrimary,
      })
      .select("*")
      .single();
    throwIfError(error, "Adding room photo");
    return mapPhotoRow(data);
  }

  async removeRoomPhoto(projectId: string, roomId: string, photoId: string): Promise<void> {
    await this.assertRoomInProject(projectId, roomId);

    // Scoped to room_id (not just id) so a photoId from a different room can
    // never be deleted via this room's path. select() first so we can also
    // remove the underlying storage object, not just the DB row.
    const { data: photoRow, error: selectErr } = await this.client
      .from("room_photos")
      .select("id, storage_path")
      .eq("id", photoId)
      .eq("room_id", roomId)
      .maybeSingle();
    throwIfError(selectErr, "Loading room photo");
    if (!photoRow) {
      throw new RepositoryError(`Photo ${photoId} not found in room ${roomId}`, "not_found");
    }

    const { error } = await this.client
      .from("room_photos")
      .delete()
      .eq("id", photoId)
      .eq("room_id", roomId);
    throwIfError(error, "Removing room photo");

    if (photoRow.storage_path) {
      const { error: storageErr } = await this.client.storage
        .from("room-photos")
        .remove([photoRow.storage_path as string]);
      // Don't fail the whole operation if the storage object was already
      // gone — but never silently ignore any other kind of failure.
      if (storageErr && !/not.?found/i.test(storageErr.message)) {
        throwIfError(storageErr, "Removing room photo from storage");
      }
    }
  }

  async saveRoomAnalysis(
    projectId: string,
    roomId: string,
    record: Omit<RoomAnalysisRecord, "id" | "roomId" | "createdAt">
  ): Promise<Room> {
    await this.assertRoomInProject(projectId, roomId);

    const { error } = await this.client.from("room_analyses").insert({
      room_id: roomId,
      analysis: record.analysis,
      designer_notes: record.designerNotes,
      reviewed_by_designer: record.reviewedByDesigner,
    });
    throwIfError(error, "Saving room analysis");
    return this.getRoomOrThrow(projectId, roomId);
  }

  async addConcept(
    projectId: string,
    roomId: string,
    concept: Omit<DesignConcept, "id" | "roomId" | "createdAt" | "isSelected">
  ): Promise<Room> {
    await this.assertRoomInProject(projectId, roomId);

    const { error } = await this.client.from("design_concepts").insert({
      room_id: roomId,
      title: concept.title,
      style: concept.style,
      description: concept.description,
      key_changes: concept.keyChanges,
      image_url: concept.imageUrl,
      storage_path: concept.storagePath,
      provider: concept.provider,
      status: concept.status,
    });
    throwIfError(error, "Adding design concept");
    return this.getRoomOrThrow(projectId, roomId);
  }

  async deleteConcept(projectId: string, roomId: string, conceptId: string): Promise<Room> {
    await this.assertRoomInProject(projectId, roomId);

    // Scoped to room_id so a conceptId from a different room can never be
    // deleted via this room's path. select() first so we can also remove
    // the underlying storage object (real provider-generated images only —
    // demo placeholders have no storage_path, nothing to clean up).
    const { data: conceptRow, error: selectErr } = await this.client
      .from("design_concepts")
      .select("id, storage_path")
      .eq("id", conceptId)
      .eq("room_id", roomId)
      .maybeSingle();
    throwIfError(selectErr, "Loading design concept");
    if (!conceptRow) {
      throw new RepositoryError(`Concept ${conceptId} not found in room ${roomId}`, "not_found");
    }

    const { error: deleteErr } = await this.client
      .from("design_concepts")
      .delete()
      .eq("id", conceptId)
      .eq("room_id", roomId);
    throwIfError(deleteErr, "Deleting design concept");

    if (conceptRow.storage_path) {
      const { error: storageErr } = await this.client.storage
        .from("room-photos")
        .remove([conceptRow.storage_path as string]);
      if (storageErr && !/not.?found/i.test(storageErr.message)) {
        throwIfError(storageErr, "Removing concept image from storage");
      }
    }

    // Clear the room's selected concept if it pointed at the one we just deleted.
    const { error: clearSelectedErr } = await this.client
      .from("rooms")
      .update({ selected_concept_id: null })
      .eq("id", roomId)
      .eq("project_id", projectId)
      .eq("selected_concept_id", conceptId);
    throwIfError(clearSelectedErr, "Clearing deleted concept's selection");

    return this.getRoomOrThrow(projectId, roomId);
  }

  async selectConcept(projectId: string, roomId: string, conceptId: string): Promise<Room> {
    await this.assertRoomInProject(projectId, roomId);

    // Scoped to room_id so a conceptId from a different room can never be
    // selected via this room's path.
    const { data: conceptRow, error: conceptErr } = await this.client
      .from("design_concepts")
      .select("id")
      .eq("id", conceptId)
      .eq("room_id", roomId)
      .maybeSingle();
    throwIfError(conceptErr, "Loading design concept");
    if (!conceptRow) {
      throw new RepositoryError(`Concept ${conceptId} not found in room ${roomId}`, "not_found");
    }

    const { error: clearErr } = await this.client
      .from("design_concepts")
      .update({ is_selected: false })
      .eq("room_id", roomId);
    throwIfError(clearErr, "Clearing previous concept selection");

    const { error: setErr } = await this.client
      .from("design_concepts")
      .update({ is_selected: true })
      .eq("id", conceptId)
      .eq("room_id", roomId);
    throwIfError(setErr, "Selecting design concept");

    const { error: roomErr } = await this.client
      .from("rooms")
      .update({ selected_concept_id: conceptId })
      .eq("id", roomId)
      .eq("project_id", projectId);
    throwIfError(roomErr, "Updating room's selected concept");

    return this.getRoomOrThrow(projectId, roomId);
  }

  async saveEstimate(
    projectId: string,
    roomId: string,
    estimate: Omit<Estimate, "id" | "roomId" | "projectId" | "createdAt" | "updatedAt">
  ): Promise<Room> {
    await this.assertRoomInProject(projectId, roomId);

    const { data: estimateRow, error } = await this.client
      .from("estimates")
      .upsert(
        {
          room_id: roomId,
          project_id: projectId,
          concept_id: estimate.conceptId,
          additional_costs: estimate.calculation.additionalCosts,
          direct_cost: estimate.calculation.directCost,
          contingency_percent: estimate.calculation.contingencyPercent,
          contingency_amount: estimate.calculation.contingencyAmount,
          cost_basis: estimate.calculation.costBasis,
          target_gross_margin_percent: estimate.calculation.targetGrossMarginPercent,
          target_selling_subtotal: estimate.calculation.targetSellingSubtotal,
          gross_profit: estimate.calculation.grossProfit,
          actual_gross_margin_percent: estimate.calculation.actualGrossMarginPercent,
          gst_percent: estimate.calculation.gstPercent,
          gst_amount: estimate.calculation.gstAmount,
          total_client_estimate: estimate.calculation.totalClientEstimate,
        },
        { onConflict: "room_id" }
      )
      .select("*")
      .single();
    throwIfError(error, "Saving estimate");

    const { error: deleteErr } = await this.client
      .from("estimate_line_items")
      .delete()
      .eq("estimate_id", estimateRow.id);
    throwIfError(deleteErr, "Clearing previous estimate line items");

    if (estimate.calculation.lineItems.length > 0) {
      const { error: insertErr } = await this.client.from("estimate_line_items").insert(
        estimate.calculation.lineItems.map((li) => ({
          estimate_id: estimateRow.id,
          catalogue_item_id: li.catalogueItemId || null,
          name: li.name,
          unit: li.unit,
          base_cost_per_unit: li.baseCostPerUnit,
          quantity: li.quantity,
          line_direct_cost: li.lineDirectCost,
        }))
      );
      throwIfError(insertErr, "Inserting estimate line items");
    }

    return this.getRoomOrThrow(projectId, roomId);
  }

  /**
   * Verifies `roomId` actually belongs to `projectId` before any mutation.
   * Every room-scoped write path in this class calls this first — without
   * it, a caller could pass a valid roomId/photoId/conceptId that belongs
   * to a *different* project alongside an unrelated projectId in the URL,
   * and the mutation would still have gone through.
   */
  private async assertRoomInProject(projectId: string, roomId: string): Promise<void> {
    const { data, error } = await this.client
      .from("rooms")
      .select("id")
      .eq("id", roomId)
      .eq("project_id", projectId)
      .maybeSingle();
    throwIfError(error, "Verifying room ownership");
    if (!data) {
      throw new RepositoryError(`Room ${roomId} not found in project ${projectId}`, "not_found");
    }
  }

  private async getRoomOrThrow(projectId: string, roomId: string): Promise<Room> {
    const { data, error } = await this.client
      .from("rooms")
      .select("*")
      .eq("id", roomId)
      .eq("project_id", projectId)
      .single();
    throwIfError(error, "Loading room");
    return this.hydrateRoom(data);
  }

  async listCatalogueItems(): Promise<CatalogueItem[]> {
    const { data, error } = await this.client
      .from("cost_catalogue_items")
      .select("*")
      .order("category")
      .order("name");
    throwIfError(error, "Listing catalogue items");
    return (data ?? []).map(mapCatalogueRow);
  }

  async createCatalogueItem(input: NewCatalogueItemInput): Promise<CatalogueItem> {
    const { data, error } = await this.client
      .from("cost_catalogue_items")
      .insert({
        name: input.name,
        category: input.category,
        unit: input.unit,
        base_cost_per_unit: input.baseCostPerUnit,
        default_quantity: input.defaultQuantity,
        selling_description: input.sellingDescription,
        is_active: input.isActive ?? true,
      })
      .select("*")
      .single();
    throwIfError(error, "Creating catalogue item");
    return mapCatalogueRow(data);
  }

  async updateCatalogueItem(
    itemId: string,
    patch: UpdateCatalogueItemInput
  ): Promise<CatalogueItem> {
    const { data, error } = await this.client
      .from("cost_catalogue_items")
      .update({
        name: patch.name,
        category: patch.category,
        unit: patch.unit,
        base_cost_per_unit: patch.baseCostPerUnit,
        default_quantity: patch.defaultQuantity,
        selling_description: patch.sellingDescription,
        is_active: patch.isActive,
      })
      .eq("id", itemId)
      .select("*")
      .single();
    throwIfError(error, "Updating catalogue item");
    return mapCatalogueRow(data);
  }

  async deleteCatalogueItem(itemId: string): Promise<void> {
    const { error } = await this.client.from("cost_catalogue_items").delete().eq("id", itemId);
    throwIfError(error, "Deleting catalogue item");
  }

  async getSettings(): Promise<AppSettings> {
    const { data, error } = await this.client
      .from("app_settings")
      .select("*")
      .eq("id", "default")
      .maybeSingle();
    throwIfError(error, "Loading settings");
    if (!data) return DEFAULT_SETTINGS;
    return {
      targetGrossMarginPercent: data.target_gross_margin_percent,
      defaultContingencyPercent: data.default_contingency_percent,
      gstPercent: data.gst_percent,
      currency: data.currency,
      imageGenerationProvider: data.image_generation_provider,
    };
  }

  async updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    const { data, error } = await this.client
      .from("app_settings")
      .upsert(
        {
          id: "default",
          target_gross_margin_percent: patch.targetGrossMarginPercent,
          default_contingency_percent: patch.defaultContingencyPercent,
          gst_percent: patch.gstPercent,
          currency: patch.currency,
          image_generation_provider: patch.imageGenerationProvider,
        },
        { onConflict: "id" }
      )
      .select("*")
      .single();
    throwIfError(error, "Updating settings");
    return {
      targetGrossMarginPercent: data.target_gross_margin_percent,
      defaultContingencyPercent: data.default_contingency_percent,
      gstPercent: data.gst_percent,
      currency: data.currency,
      imageGenerationProvider: data.image_generation_provider,
    };
  }
}
