import { isFake, isJoker, rawFace, type OkeyCtx } from '@sokak/okey';

const COLOR_CLASS = ['red', 'yellow', 'blue', 'black'];

/** A 101 tile: cream face, coloured number; okey gets a star, sahte okey a clover. */
export function Tile({
  id,
  ctx,
  small,
  selected,
  dim,
  isNew,
  onClick,
  onPointerDown,
}: {
  id: number;
  ctx: OkeyCtx | null;
  small?: boolean;
  selected?: boolean;
  dim?: boolean;
  /** the tile just taken from the left (it may be put back) */
  isNew?: boolean;
  onClick?: () => void;
  onPointerDown?: (e: React.PointerEvent) => void;
}) {
  const cls = `tile ${small ? 'sm' : ''} ${selected ? 'sel' : ''} ${dim ? 'dim' : ''} ${isNew ? 'new' : ''}`;
  if (isFake(id)) {
    return (
      <div className={`${cls} fake`} onClick={onClick} onPointerDown={onPointerDown} data-tile={id}>
        <span className="num">♣</span>
      </div>
    );
  }
  const f = rawFace(id);
  const joker = ctx ? isJoker(id, ctx) : false;
  return (
    <div className={`${cls} ${COLOR_CLASS[f.color]} ${joker ? 'joker' : ''}`} onClick={onClick} onPointerDown={onPointerDown} data-tile={id}>
      <span className="num">{f.num}</span>
      <span className="dot" />
      {joker && <span className="star">★</span>}
    </div>
  );
}
