import { festivalAt, festivalById, type FestivalId } from '@sokak/shared';

/**
 * Which festival dresses up the kahvehane: the calendar's, unless the owner set one by hand
 * from the admin panel ('none' switches decorations off). Shared by every salon.
 */
export class FestivalControl {
  /** undefined = follow the calendar */
  private override: FestivalId | 'none' | undefined;

  constructor(private now: () => number = () => Date.now()) {}

  current(): FestivalId | null {
    if (this.override === 'none') return null;
    return this.override ?? festivalAt(this.now());
  }

  /** what the owner set: a festival, 'none', or undefined for the calendar */
  get manual(): FestivalId | 'none' | undefined {
    return this.override;
  }

  /** returns false for an unknown id */
  set(id: string | null | undefined): boolean {
    if (id === null || id === undefined || id === '' || id === 'auto') this.override = undefined;
    else if (id === 'none') this.override = 'none';
    else if (festivalById(id)) this.override = id as FestivalId;
    else return false;
    return true;
  }
}
