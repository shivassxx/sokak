import { ArraySchema, MapSchema, Schema, type } from '@colyseus/schema';
import { TURN_SECONDS } from '@sokak/shared';

export class KPlayer extends Schema {
  @type('string') id = '';
  @type('string') name = '';
  @type('string') color = '';
  @type('uint8') hat = 0;
  @type('uint8') hair = 0;
  @type('uint8') skin = 0;
  /** index into AVATARS: which realistic character this player is */
  @type('uint8') avatar = 0;
  /** aksesuarlar: worn and owned sets (bitmasks over ACCESSORIES) */
  @type('uint16') acc = 0;
  @type('uint16') accOwned = 0;
  @type('boolean') isBot = false;
  @type('boolean') connected = true;
  @type('int32') money = 0;
  @type('int8') table = -1;
  @type('int8') seat = -1;
  /** tavla table index while seated at one (seat is then 0 or 1), −1 otherwise */
  @type('int8') tavla = -1;
  /** item in hand (market / simitçi), '' = nothing */
  @type('string') holding = '';
  @type('uint8') uses = 0;
  /** index into SIT_SPOTS while sitting on a bench / stool, −1 otherwise */
  @type('int8') spot = -1;
  /** opted into voice chat (peers only connect when both have it on) */
  @type('boolean') voice = false;
  /** fishing: 0 no line in the water, 1 waiting, 2 a bite — pull now! */
  @type('uint8') fish = 0;
  /** finished matches / wins (device wallet), the level is derived from them */
  @type('uint16') played = 0;
  @type('uint16') won = 0;
  /** today's mission progress, JSON MissionState */
  @type('string') missions = '';
  /** rank 1–3 on this week's leaderboard (🏆 on the name plate), 0 otherwise */
  @type('uint8') trophy = 0;
  /** riding the vapur (position is on its deck) */
  @type('boolean') aboard = false;
}

export class KTable extends Schema {
  @type('uint8') id = 0;
  /** open | playing | between | result */
  @type('string') status = 'open';
  @type('uint16') bet = 0;
  @type('uint8') hands = 1;
  /** eşli 101: seats 0+2 vs 1+3 */
  @type('boolean') partners = false;
  /** turn time in seconds (TURN_OPTIONS) */
  @type('uint8') turnSecs = TURN_SECONDS;
  @type('uint8') handNo = 0;
  @type(['string']) seats = new ArraySchema<string>('', '', '', '');
  @type('string') hostId = '';
  @type(['int32']) totals = new ArraySchema<number>(0, 0, 0, 0);
  @type('uint32') pot = 0;
  /** server time (ms) when the current turn times out */
  @type('float64') turnEndsAt = 0;
  /** JSON TableView (no hidden information) */
  @type('string') view = '';
  @type('string') lastHand = '';
  @type('string') lastMatch = '';
}

/** A two-seat tavla table (everything about a tavla game is public). */
export class TTable extends Schema {
  @type('uint8') id = 0;
  /** open | playing | between | result */
  @type('string') status = 'open';
  @type('uint16') bet = 0;
  /** points needed to win the match */
  @type('uint8') target = 1;
  /** game number within the match */
  @type('uint8') game = 0;
  @type(['string']) seats = new ArraySchema<string>('', '');
  @type('string') hostId = '';
  @type(['uint8']) score = new ArraySchema<number>(0, 0);
  @type('uint32') pot = 0;
  @type('float64') turnEndsAt = 0;
  /** JSON TavlaView */
  @type('string') view = '';
  @type('string') lastGame = '';
  @type('string') lastMatch = '';
}

export class KahveState extends Schema {
  /** salon name shown in the lobby and the HUD */
  @type('string') name = '';
  @type({ map: KPlayer }) players = new MapSchema<KPlayer>();
  @type([KTable]) tables = new ArraySchema<KTable>();
  @type([TTable]) tavla = new ArraySchema<TTable>();
  /** JSON TvBroadcast of the shared kıraathane TV, '' = normal programme */
  @type('string') tv = '';
}
