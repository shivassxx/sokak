/**
 * Arkadaşlar: mutual friends without accounts. Each device wallet gets a public friend code
 * (never the secret device token). A asks B; when B asks A back (or accepts), they are friends
 * and see each other's salon. A one-sided request shows nothing about where the other one is.
 */
export const FRIEND_LIMIT = 50;
export const FRIEND_REQ_LIMIT = 20;

export interface FriendRow {
  code: string;
  name: string;
  /** where the friend is right now, or null when offline */
  online: { roomId: string; salon: string } | null;
}

export interface FriendsView {
  /** this device's own friend code */
  code: string;
  friends: FriendRow[];
  /** requests waiting for this device's answer */
  incoming: { code: string; name: string }[];
}

/** server → the asked player (in the same salon): somebody wants to be friends */
export interface FriendReqMsg {
  /** the asker's session id (answer with friendAdd { id }) */
  from: string;
  name: string;
}
