import { notFound } from "next/navigation";
import { PresentationExperience } from "@/components/present/presentation-experience";
import { QuoteResultView } from "@/components/quote/result-view";
import { SmoothScroll } from "@/components/motion/smooth-scroll";
import type { ClientLinkProject } from "@/lib/presentation/client-dto";
import type { QuoteResult } from "@/lib/leads/service";

export const dynamic = "force-dynamic";

/** A quiet little room drawn as SVG so the harness needs no photo files. */
function room(a: string, b: string, accent: string) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 1000'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient></defs><rect width='1600' height='1000' fill='url(#g)'/><rect x='1040' y='140' width='360' height='440' fill='#fff7e0' opacity='.85'/><rect x='180' y='560' width='760' height='230' rx='36' fill='${accent}'/><rect x='150' y='520' width='140' height='290' rx='40' fill='${accent}' opacity='.9'/><rect x='830' y='520' width='140' height='290' rx='40' fill='${accent}' opacity='.9'/><rect x='0' y='840' width='1600' height='160' fill='#00000022'/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const before = room("#d8cdbb", "#b9ab92", "#8d8068");
const after1 = room("#f3d9a6", "#a8643a", "#5e6a3f");
const after2 = room("#e9dfc9", "#6e5a49", "#c9763f");

const presentation: ClientLinkProject = {
  projectTitle: "The Agarwal Residence",
  clientFirstName: "Smriti",
  location: "Greater Noida",
  rooms: [
    {
      roomId: "r1",
      roomName: "Living Room",
      roomType: "living_room",
      dimensions: { length: 28, width: 24, ceilingHeight: 10, unit: "ft" },
      originalPhotoUrl: before,
      concepts: [
        { id: "c1", title: "Warm Modern Luxury", style: "Gold accents, glass and mirror", description: "A rich contemporary living space with a louvred feature wall behind the sofa, concealed LED profiles and brass inlays.", keyChanges: ["WPC louvre feature wall", "Concealed LED profiles", "Quartz-topped console"], imageUrl: after1, status: "generated" as never, isSelected: true, isApproved: false },
        { id: "c2", title: "Quiet Earth", style: "Muted, tactile", description: "Soft plaster, oak and deep olive for a calmer room.", keyChanges: ["Limewash walls", "Oak panelling"], imageUrl: after2, status: "generated" as never, isSelected: false, isApproved: false },
      ],
    },
    { roomId: "r2", roomName: "Master Bedroom", roomType: "master_bedroom", dimensions: { length: 14, width: 21, ceilingHeight: 10, unit: "ft" }, originalPhotoUrl: before, concepts: [{ id: "c3", title: "Evening Suite", style: "French moulding, wallpaper", description: "A layered bedroom with moulded feature wall and a dressing lounge.", keyChanges: ["French moulding wall"], imageUrl: after2, status: "generated" as never, isSelected: false, isApproved: false }] },
  ],
};

const result: QuoteResult = {
  name: "Smriti Agarwal",
  city: "Noida",
  selectedTier: "premium",
  estimate: { lowLakh: 38.5, highLakh: 46.2 },
  tiers: [
    { tier: "essential", lowLakh: 18, highLakh: 21.5 },
    { tier: "premium", lowLakh: 38.5, highLakh: 46.2 },
    { tier: "luxury", lowLakh: 62, highLakh: 76 },
  ] as QuoteResult["tiers"],
  breakdown: {
    totalLakh: 41.2,
    byTrade: [
      { label: "Modular woodwork", lakh: 16.4, pct: 40 },
      { label: "Wall panelling", lakh: 7.4, pct: 18 },
      { label: "Paint & polish", lakh: 4.9, pct: 12 },
      { label: "Mirrors, glass & metal", lakh: 4.1, pct: 10 },
      { label: "Loose furniture", lakh: 8.4, pct: 20 },
    ],
    byRoom: [
      { label: "Living", lakh: 9.2 },
      { label: "Kitchen", lakh: 14.1 },
      { label: "Master Bedroom", lakh: 11.6 },
    ],
    highlights: [{ room: "Kitchen", text: "U-shaped modular kitchen with island" }],
    assumptions: ["Quantities use standard room sizes until a site visit.", "Rates are InnerSpacio published rates."],
  } as unknown as QuoteResult["breakdown"],
  status: "generated",
  rooms: [
    { id: "q1", label: "Living Room", roomType: "living_room", ideas: "Warm wood, more storage, a reading corner by the window", beforeUrl: before, concept: { url: after1, isDemo: true } as never },
    { id: "q2", label: "Master Bedroom", roomType: "bedroom", ideas: null, beforeUrl: before, concept: { url: after2, isDemo: true } as never },
  ],
};

/** Development-only harness: renders the client-facing views with sample data. 404 in production. */
export default async function ShowroomHarness({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { v } = await searchParams;
  if (v === "result") {
    return (
      <SmoothScroll>
        <QuoteResultView result={result} token="dev" />
      </SmoothScroll>
    );
  }
  return <PresentationExperience token="dev" data={presentation} readOnly />;
}
