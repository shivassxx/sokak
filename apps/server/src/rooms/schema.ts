import { MapSchema, Schema, type } from '@colyseus/schema';

export class PlayerState extends Schema {
  @type('string') id = '';
  @type('string') name = '';
  @type('string') color = '';
  @type('uint8') hat = 0;
  @type('uint8') hair = 0;
  @type('uint8') skin = 0;
  @type('boolean') isBot = false;
  @type('boolean') connected = true;
  /** none | ebe | hider | spectator */
  @type('string') role = 'none';
  /** none | hiding | spotted | caught | safe */
  @type('string') status = 'none';
  @type('int16') score = 0;
}

export class SaklambacState extends Schema {
  /** lobby | ebeSelection | counting | seeking | roundEnd */
  @type('string') phase = 'lobby';
  /** whole seconds left in the current timed phase */
  @type('uint16') timeLeft = 0;
  @type('uint16') round = 0;
  @type('string') ebeId = '';
  @type('string') hostId = '';
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
}
