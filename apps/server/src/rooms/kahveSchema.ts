import { ArraySchema, MapSchema, Schema, type } from '@colyseus/schema';

export class KPlayer extends Schema {
  @type('string') id = '';
  @type('string') name = '';
  @type('string') color = '';
  @type('uint8') hat = 0;
  @type('uint8') hair = 0;
  @type('uint8') skin = 0;
  @type('boolean') isBot = false;
  @type('boolean') connected = true;
  @type('int32') money = 0;
  @type('int8') table = -1;
  @type('int8') seat = -1;
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
}

export class KTable extends Schema {
  @type('uint8') id = 0;
  /** open | playing | between | result */
  @type('string') status = 'open';
  @type('uint16') bet = 0;
  @type('uint8') hands = 1;
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

export class KahveState extends Schema {
  /** salon name shown in the lobby and the HUD */
  @type('string') name = '';
  @type({ map: KPlayer }) players = new MapSchema<KPlayer>();
  @type([KTable]) tables = new ArraySchema<KTable>();
}
