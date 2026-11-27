// Parties.
// Part of the game room (server/src/WorldRoom.ts), split out to keep each file to one job.
import { Client } from "colyseus";
import { isUnlocked, levelForXp } from "../../../shared/disciplines";
import { tileDistance } from "../../../shared/combat";
import { INVITE_MS, LEAD_STEP_XP, PARTY_CHAT_MAX, PARTY_MAX, PARTY_NEAR, groupBonus } from "../../../shared/party";
import { Player } from "./schema";
import type { WorldRoom } from "../WorldRoom";

export const partyMethods = {
  sidOf(this: WorldRoom, p: Player) {
    for (const [sid, o] of this.state.players) if (o === p) return sid;
    return "";
  },
  /** Your party members' session ids, not counting you. */
  partyMates(this: WorldRoom, p: Player): string[] {
    const party = this.parties.get(p.party);
    return party ? party.members.filter((sid) => this.state.players.get(sid) !== p) : [];
  },
  /** Members (not the leader) close enough to their leader to follow them. */
  nearLeader(this: WorldRoom, party: { leader: string; members: string[] }): string[] {
    const lead = this.state.players.get(party.leader);
    if (!lead) return [];
    return party.members.filter((sid) => sid !== party.leader && tileDistance(this.state.players.get(sid)!, lead) <= PARTY_NEAR);
  },
  /** The leader's group bonus to kill XP, for someone near them (with at least one other member near too). */
  groupBonusFor(this: WorldRoom, p: Player): number {
    const party = this.parties.get(p.party);
    if (!party || party.members.length < 2) return 0;
    const near = this.nearLeader(party);
    const sid = this.sidOf(p);
    if (!near.length || (sid !== party.leader && !near.includes(sid))) return 0;
    const lead = this.state.players.get(party.leader)!;
    return groupBonus(isUnlocked(lead.unlocked, "leadership") ? levelForXp(lead.skillXp.leadership) : 1);
  },
  /** A quest step finished in a party, with the leader (or another member, if you lead) close by: Leadership for the leader. */
  leadStep(this: WorldRoom, p: Player) {
    const party = this.parties.get(p.party);
    if (!party || party.members.length < 2) return;
    const lead = this.state.players.get(party.leader);
    if (!lead) return;
    const near = this.nearLeader(party);
    if (lead === p ? !near.length : !near.includes(this.sidOf(p))) return;
    this.addSkillXp(lead, this.clients.getById(party.leader), "leadership", LEAD_STEP_XP);
    this.saveSoon(lead);
  },
  /** Tell everyone in the party something. */
  partySay(this: WorldRoom, party: { members: string[] }, text: string, skip?: string) {
    for (const sid of party.members) if (sid !== skip) { const c = this.clients.getById(sid); if (c) this.say(c, text); }
  },
  partyInvite(this: WorldRoom, client: Client, id: string) {
    const p = this.state.players.get(client.sessionId);
    const o = this.state.players.get(id);
    if (!p || !o || o === p) return;
    const party = this.parties.get(p.party);
    if (party && party.leader !== client.sessionId) return this.say(client, "Only your party's leader (★) can invite people.");
    if (o.party && o.party === p.party) return this.say(client, `${o.name} is already in your party.`);
    if (o.party) return this.say(client, `${o.name} is already in a party.`);
    if (party && party.members.length >= PARTY_MAX) return this.say(client, `Your party is full (${PARTY_MAX} people at most).`);
    if (o.invite && o.invite.until > Date.now() && o.invite.from !== client.sessionId) return this.say(client, `${o.name} is thinking about another invite. Try again in a minute.`);
    o.invite = { from: client.sessionId, until: Date.now() + INVITE_MS };
    this.clients.getById(id)?.send("partyInvite", { from: p.name });
    this.say(client, `🚩 You invite ${o.name} to your party. Waiting for them to answer…`);
  },
  partyAnswer(this: WorldRoom, client: Client, yes: boolean) {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    const inv = p.invite;
    p.invite = null;
    const from = inv && inv.until > Date.now() ? this.state.players.get(inv.from) : undefined;
    const fromClient = inv ? this.clients.getById(inv.from) : undefined;
    if (!inv || !from) return this.say(client, "That invite has run out.");
    if (!yes) {
      if (fromClient) this.say(fromClient, `${p.name} said no thanks to your party invite.`);
      return;
    }
    if (p.party) return this.say(client, "You're already in a party. Leave it first.");
    let party = this.parties.get(from.party);
    if (party && party.leader !== inv.from) return this.say(client, `${from.name} isn't leading their party any more.`);
    if (!party) {
      const pid = `party${++this.partySeq}`;
      party = { leader: inv.from, members: [inv.from] };
      this.parties.set(pid, party);
      from.party = pid;
      from.partyLead = true;
    }
    if (party.members.length >= PARTY_MAX) return this.say(client, `${from.name}'s party is full.`);
    party.members.push(client.sessionId);
    p.party = from.party;
    p.partyLead = false;
    this.partySay(party, `🚩 ${p.name} joins the party.`, client.sessionId);
    this.say(client, `🚩 You join ${from.name}'s party. Kills count for everyone close by, and the 🚩 panel has party chat.`);
  },
  /** Leave (or be kicked from) your party. The next member leads if the leader goes; a party of one ends. */
  leaveParty(this: WorldRoom, sid: string, why: "left" | "kicked") {
    const p = this.state.players.get(sid);
    if (!p || !p.party) return;
    const pid = p.party;
    const party = this.parties.get(pid);
    p.party = "";
    p.partyLead = false;
    const c = this.clients.getById(sid);
    if (c) this.say(c, why === "kicked" ? "🚩 The leader took you out of the party." : "🚩 You leave the party.");
    if (!party) return;
    party.members = party.members.filter((m) => m !== sid);
    this.partySay(party, why === "kicked" ? `🚩 ${p.name} was taken out of the party.` : `🚩 ${p.name} left the party.`);
    if (party.members.length < 2) {
      for (const m of party.members) {
        const o = this.state.players.get(m);
        if (o) { o.party = ""; o.partyLead = false; }
        const oc = this.clients.getById(m);
        if (oc) this.say(oc, "🚩 The party has ended: you're the only one left.");
      }
      this.parties.delete(pid);
      return;
    }
    if (party.leader === sid) {
      party.leader = party.members[0];
      const lead = this.state.players.get(party.leader)!;
      lead.partyLead = true;
      this.partySay(party, `🚩 ${lead.name} leads the party now.`);
    }
  },
};

/** The messages from players about this. */
export function registerParty(this: WorldRoom) {
    // Pick one of your earned titles to show over your head ("" for none).
    // ---- Parties (stage 13, shared/party.ts) ----
    this.onMessage("partyInvite", (client, msg: { id: string }) => this.partyInvite(client, String(msg?.id ?? "")));
    this.onMessage("partyAnswer", (client, msg: { yes: boolean }) => this.partyAnswer(client, !!msg?.yes));
    this.onMessage("partyLeave", (client) => this.leaveParty(client.sessionId, "left"));
    this.onMessage("partyKick", (client, msg: { id: string }) => {
      const p = this.state.players.get(client.sessionId);
      const o = this.state.players.get(String(msg?.id ?? ""));
      if (!p || !o || !p.partyLead || o.party !== p.party || o === p) return;
      this.leaveParty(String(msg.id), "kicked");
    });
    this.onMessage("partyChat", (client, msg: { text: string }) => {
      const p = this.state.players.get(client.sessionId);
      const party = p && this.parties.get(p.party);
      if (!p || !party) return;
      const text = String(msg?.text ?? "").replace(/\s+/g, " ").trim().slice(0, PARTY_CHAT_MAX);
      if (!text) return;
      for (const sid of party.members) this.clients.getById(sid)?.send("partyChat", { from: p.name, text });
    });
}
