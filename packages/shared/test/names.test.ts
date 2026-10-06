import { describe, expect, it } from 'vitest';
import { cleanNickname, isOffensive, isValidNicknameLength, randomNickname, sanitizeColor, NAME_MAX } from '../src';

describe('nickname filter', () => {
  it('lets normal Turkish names through', () => {
    for (const n of ['Ayşe', 'Kemal', 'Işık', 'Samet', 'Ali Can', 'Zeynep_07', 'Malik', 'Sıla', 'Gökhan', 'Amine', 'Ebru', 'Selin']) {
      expect(isOffensive(n), n).toBe(false);
    }
  });

  it('catches profanity incl. leetspeak, separators, repeats and Turkish chars', () => {
    for (const n of ['amk', 'AQ', 's1kt1r', '0r0spu', 'o.r.o.s.p.u', 'Siiiktir', 'yavşak', 'şerefsiz', 'Mal', 'fuuuck', 'b1tch', 'ali amk', 'pi̇ç']) {
      expect(isOffensive(n), n).toBe(true);
    }
  });

  it('cleans and limits nicknames', () => {
    expect(cleanNickname('  Ali   Veli  ')).toBe('Ali Veli');
    expect(cleanNickname('<b>x</b>')).toBe('bxb');
    expect(cleanNickname('a'.repeat(40)).length).toBe(NAME_MAX);
    expect(cleanNickname(42)).toBe('');
    expect(isValidNicknameLength('A')).toBe(false);
  });

  it('random nicknames are valid and clean', () => {
    let seed = 3;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 50; i++) {
      const n = randomNickname(rnd);
      expect(isValidNicknameLength(n)).toBe(true);
      expect(isOffensive(n)).toBe(false);
    }
  });

  it('only palette colors are accepted', () => {
    expect(sanitizeColor('#3498db')).toBe('#3498db');
    expect(sanitizeColor('javascript:')).toBe('#e74c3c');
  });
});
