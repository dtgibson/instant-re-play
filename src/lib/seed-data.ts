import type { PlayInput } from "./play";

/**
 * A realistic serious-theatregoer log (London West End) that exercises every
 * state: repeated venues (Duke of York's ×3, Wyndham's ×2) and directors
 * (Sam Mendes ×3, Rebecca Frecknall ×2) make click-to-filter connections
 * meaningful, plus the deliberate edge cases — The Pillowman (no director),
 * The Hills of California (no date), Waiting for Godot (future-dated →
 * "Upcoming"), and A Midsummer Night's Dream (name only). Matches the approved
 * mockup's seed set exactly. Loaded by `npm run seed`; the app ships empty.
 */
export const SEED_PLAYS: PlayInput[] = [
  {
    name: "Waiting for Godot",
    date: "2026-09-16",
    venue: "Theatre Royal Haymarket",
    playwright: "Samuel Beckett",
    director: "James Macdonald",
    actors: ["Ben Whishaw", "Lucian Msamati"],
  },
  {
    name: "An Enemy of the People",
    date: "2024-02-20",
    venue: "Duke of York's Theatre",
    playwright: "Henrik Ibsen",
    director: "Thomas Ostermeier",
    actors: ["Matt Smith"],
  },
  {
    name: "Long Day's Journey Into Night",
    date: "2024-03-27",
    venue: "Wyndham's Theatre",
    playwright: "Eugene O'Neill",
    director: "Jeremy Herrin",
    actors: ["Brian Cox"],
  },
  {
    name: "A Streetcar Named Desire",
    date: "2024-01-12",
    venue: "Almeida Theatre",
    playwright: "Tennessee Williams",
    director: "Rebecca Frecknall",
    actors: ["Paul Mescal", "Patsy Ferran", "Anjana Vasan"],
  },
  {
    name: "Vanya",
    date: "2024-01-13",
    venue: "Duke of York's Theatre",
    playwright: "Anton Chekhov",
    director: "Sam Yates",
    actors: ["Andrew Scott"],
  },
  {
    name: "The Pillowman",
    date: "2023-08-30",
    venue: "Duke of York's Theatre",
    playwright: "Martin McDonagh",
    director: "",
    actors: ["David Tennant", "Lily Allen"],
  },
  {
    name: "Sunset Boulevard",
    date: "2023-10-07",
    venue: "Savoy Theatre",
    playwright: "Christopher Hampton & Don Black",
    director: "Jamie Lloyd",
    actors: ["Nicole Scherzinger", "Tom Francis"],
  },
  {
    name: "The Motive and the Cue",
    date: "2023-05-04",
    venue: "Noël Coward Theatre",
    playwright: "Jack Thorne",
    director: "Sam Mendes",
    actors: ["Mark Gatiss", "Johnny Flynn"],
  },
  {
    name: "Oklahoma!",
    date: "2023-03-02",
    venue: "Wyndham's Theatre",
    playwright: "Oscar Hammerstein II",
    director: "Daniel Fish",
    actors: [],
  },
  {
    name: "Cabaret",
    date: "2022-12-15",
    venue: "Kit Kat Club, Playhouse Theatre",
    playwright: "Joe Masteroff",
    director: "Rebecca Frecknall",
    actors: ["Eddie Redmayne", "Jessie Buckley"],
  },
  {
    name: "Prima Facie",
    date: "2022-05-10",
    venue: "Harold Pinter Theatre",
    playwright: "Suzie Miller",
    director: "Justin Martin",
    actors: ["Jodie Comer"],
  },
  {
    name: "The Lehman Trilogy",
    date: "2019-07-18",
    venue: "Gillian Lynne Theatre",
    playwright: "Stefano Massini",
    director: "Sam Mendes",
    actors: ["Simon Russell Beale", "Adam Godley", "Ben Miles"],
  },
  {
    name: "The Hills of California",
    date: "",
    venue: "Harold Pinter Theatre",
    playwright: "Jez Butterworth",
    director: "Sam Mendes",
    actors: ["Laura Donnelly"],
  },
  {
    name: "A Midsummer Night's Dream",
    date: "",
    venue: "",
    director: "",
    actors: [],
  },
];
