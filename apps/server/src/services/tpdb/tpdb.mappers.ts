/**
 * Mapping utilities for converting ThePornDB API types to internal types
 */

import type { TPDBPerformer, TPDBScene, TPDBSite } from "@repo/shared-types";
import type { Performer, Scene, Studio } from "@repo/shared-types";
import type { Image } from "@repo/shared-types";
import { nanoid } from "nanoid";

/**
 * Map ThePornDB performer to internal Performer type
 */
export function mapTPDBPerformerToPerformer(tpdb: TPDBPerformer): Omit<Performer, "createdAt" | "updatedAt"> {
  const images: Image[] = [];
  // Only use TPDB-hosted posters to avoid auth issues with external URLs
  if (tpdb.posters && tpdb.posters.length > 0) {
    images.push(...tpdb.posters.map((p) => ({ url: p.url })));
  }

  // For search results, use TPDB ID as the primary ID
  // For database saves (subscriptions), use nanoid
  return {
    id: tpdb.id,
    externalIds: [{ source: 'tpdb', id: tpdb.id }],
    slug: tpdb.slug,
    name: tpdb.name,
    fullName: tpdb.full_name,
    disambiguation: tpdb.disambiguation,
    bio: tpdb.bio,
    rating: tpdb.rating || 0,
    aliases: tpdb.aliases || [],

    // Physical attributes
    gender: tpdb.extras.gender,
    birthdate: tpdb.extras.birthday,
    deathDate: tpdb.extras.deathday,
    birthplace: tpdb.extras.birthplace,
    birthplaceCode: tpdb.extras.birthplace_code,
    astrology: tpdb.extras.astrology,
    ethnicity: tpdb.extras.ethnicity,
    nationality: tpdb.extras.nationality,

    // Appearance
    hairColour: tpdb.extras.hair_colour,
    eyeColour: tpdb.extras.eye_colour,
    height: tpdb.extras.height,
    weight: tpdb.extras.weight,
    measurements: tpdb.extras.measurements,
    cupsize: tpdb.extras.cupsize,
    waist: tpdb.extras.waist,
    hips: tpdb.extras.hips,
    tattoos: tpdb.extras.tattoos,
    piercings: tpdb.extras.piercings,
    fakeBoobs: tpdb.extras.fake_boobs || false,

    // Career
    careerStartYear: tpdb.extras.career_start_year,
    careerEndYear: tpdb.extras.career_end_year,
    sameSexOnly: tpdb.extras.same_sex_only || false,

    // Media - use only TPDB-hosted posters
    images,
    thumbnail: (tpdb.posters && tpdb.posters.length > 0) ? tpdb.posters[0].url : null,
    poster: (tpdb.posters && tpdb.posters.length > 0) ? tpdb.posters[0].url : null,

    // External links
    links: tpdb.extras.links,
  };
}

/**
 * Map ThePornDB site to internal Studio type
 */
export function mapTPDBSiteToStudio(tpdb: TPDBSite): Omit<Studio, "createdAt" | "updatedAt"> {
  const images: Image[] = [];
  if (tpdb.poster) {
    images.push({ url: tpdb.poster });
  }
  if (tpdb.logo) {
    images.push({ url: tpdb.logo });
  }

  return {
    id: tpdb.uuid, // Use TPDB UUID directly for search results
    externalIds: [{ source: 'tpdb', id: tpdb.uuid }],
    name: tpdb.name,
    shortName: tpdb.short_name,
    slug: tpdb.name.toLowerCase().replace(/\s+/g, "-"),
    url: tpdb.url,
    description: tpdb.description,
    rating: tpdb.rating || 0,

    // Hierarchy
    parentStudioId: null,
    networkId: tpdb.network_id?.toString() || null,

    // Media
    images,
    logo: tpdb.logo,
    favicon: tpdb.favicon,
    poster: tpdb.poster,

    // External links
    links: null,
  };
}

/**
 * Map ThePornDB scene to internal Scene type
 */
export function mapTPDBSceneToScene(tpdb: TPDBScene): Omit<Scene, "createdAt" | "updatedAt"> {
  const images: Image[] = [];
  // Only use TPDB-hosted poster to avoid auth issues with external URLs
  // poster, background are TPDB CDN URLs that don't require auth
  if (tpdb.poster) {
    images.push({ url: tpdb.poster });
  }
  // Add background images if available (TPDB CDN)
  if (tpdb.background?.large) {
    images.push({ url: tpdb.background.large });
  }

  // Extract director IDs
  const directorIds = tpdb.directors && tpdb.directors.length > 0
    ? tpdb.directors.map(d => d.uuid)
    : [];

  // Determine content type
  let contentType: "scene" | "jav" | "movie" = "scene";
  if (tpdb.type) {
    const lowerType = tpdb.type.toLowerCase();
    if (lowerType === "jav" || lowerType === "movie") {
      contentType = lowerType as "jav" | "movie";
    }
  }

  // Extract hashes from TPDB for deduplication
  const hashes = tpdb.hashes && tpdb.hashes.length > 0
    ? tpdb.hashes.map(h => ({ hash: h.hash, type: h.type }))
    : [];

  return {
    id: tpdb.id, // Use TPDB ID directly for search results
    externalIds: [{ source: 'tpdb', id: tpdb.id }],
    slug: tpdb.slug,
    title: tpdb.title,
    description: tpdb.description,
    date: tpdb.date,

    // Content type
    contentType,

    // Media info
    duration: tpdb.duration,
    format: tpdb.format,

    // Identifiers
    externalId: tpdb.external_id,
    code: tpdb.sku,
    sku: tpdb.sku,
    url: tpdb.url,

    // Media - use only TPDB-hosted URLs
    images,
    poster: tpdb.poster, // TPDB CDN URL
    backImage: tpdb.background?.large || null,
    thumbnail: tpdb.poster, // Use poster as thumbnail to avoid external auth URLs
    trailer: tpdb.trailer,
    background: tpdb.background || null,

    // Metadata
    rating: tpdb.rating || 0,

    // Relations
    siteId: null, // Will be set separately
    directorIds,

    // Hashes for deduplication
    hashes,

    // External links
    links: tpdb.links,

    // System
    hasMetadata: true,
    inferredFromIndexers: false,
  } as any; // Type assertion needed since Scene type doesn't include hashes yet
}

/**
 * Map ThePornDB directors to internal Director type
 */
export function mapTPDBDirectorsToDirectors(tpdbDirectors: TPDBScene["directors"]): Array<{ id: string; externalIds: { source: string; id: string }[]; name: string; slug: string }> {
  if (!tpdbDirectors || tpdbDirectors.length === 0) {
    return [];
  }

  return tpdbDirectors.map((d) => ({
    id: d.uuid,
    externalIds: [{ source: 'tpdb', id: d.uuid }],
    name: d.name,
    slug: d.slug,
  }));
}
