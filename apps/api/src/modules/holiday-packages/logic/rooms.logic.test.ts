import { describe, expect, it } from 'vitest';
import type { Room } from '../../catalog/catalog.schemas';
import { roomsNeeded } from './rooms.logic';

const room = (maxAdults: number, maxChildren: number): Room => ({
  room_id: 'RM-1',
  hotel_id: 'HTL-1',
  room_type: 'ANY',
  name: 'Room',
  max_adults: maxAdults,
  max_children: maxChildren,
  price_per_night: { amount: 1000, currency: 'INR' },
  refundable: true,
});

describe('roomsNeeded', () => {
  it('fits 2 adults and a child in 1 family room or 2 twin rooms (the statement example)', () => {
    const party = { adults: 2, children: 1 };
    expect(roomsNeeded(room(2, 2), party)).toBe(1);
    expect(roomsNeeded(room(2, 0), party)).toBe(2);
  });

  it('never uses more rooms than there are adults', () => {
    expect(roomsNeeded(room(1, 0), { adults: 2, children: 1 })).toBeNull();
    expect(roomsNeeded(room(2, 0), { adults: 1, children: 2 })).toBeNull();
  });
});
