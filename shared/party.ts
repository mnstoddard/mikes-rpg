// Parties (stage 13): play together.
//
// - Click another player to invite them. Up to 4 in a party (Charisma may
//   raise it later). The one who invites leads; if they leave, the next
//   member takes over.
// - Everyone in the party sees each other's health, and can talk in party chat.
// - A monster's kill XP is split by how much of its health each person took.
//   Its drops go to whoever did the most damage.
// - Quest kills count for everyone in the party who's close by, so a group
//   quest finishes for all of them, and each gets the full quest reward.
// - Leadership (a Charisma skill): the leader earns it when the party finishes
//   quest steps and defeats monsters together. Party members near the leader
//   get a small XP bonus from it.

export const PARTY_MAX = 4;
/** How close (in tiles) party members must be to share quest kills, and to get the leader's bonus. */
export const PARTY_NEAR = 15;
/** An invite lasts this long (ms). */
export const INVITE_MS = 60_000;
/** Leadership XP for the leader when anyone in the party finishes a quest step. */
export const LEAD_STEP_XP = 15;
/** Leadership XP for the leader for each monster the party defeats, per member close by. */
export const LEAD_KILL_XP = 1;
/** Kill XP bonus for party members near the leader: 2%, plus 1% per 10 Leadership levels, up to 10%. */
export const groupBonus = (leadership: number) => Math.min(0.1, 0.02 + Math.floor(leadership / 10) * 0.01);
export const PARTY_CHAT_MAX = 120;
