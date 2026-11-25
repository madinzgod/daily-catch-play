// The menu of The Daily Catch, a harbour kitchen: what the bins hand out, what the
// chopping board and the heat do to it, and the plates the plating counter can build
// by combining pieces in different ways. A dish is a small route through the kitchen.

/** Raw things the bins hand out. */
export const INGREDIENTS = {
  bun: { name: 'Bread roll' },
  fillet_raw: { name: 'Raw fillet' },
  prawns_raw: { name: 'Raw prawns' },
  tomato: { name: 'Tomato' },
  lettuce: { name: 'Lettuce' },
  potato: { name: 'Potato' },
  fillet_grilled: { name: 'Grilled fillet' },
  fillet_burnt: { name: 'Burnt fillet' },
  prawns_grilled: { name: 'Grilled prawns' },
  prawns_burnt: { name: 'Burnt prawns' },
  tomato_cut: { name: 'Tomato slices' },
  lettuce_cut: { name: 'Cut lettuce' },
  potato_cut: { name: 'Cut potato' },
  fries: { name: 'Chips' },
  fries_burnt: { name: 'Burnt chips' },
};

/** Presses needed on the chopping board, and what a finished chop is called. */
export const CHOPS = {
  tomato: { presses: 3, makes: 'tomato_cut' },
  lettuce: { presses: 2, makes: 'lettuce_cut' },
  potato: { presses: 3, makes: 'potato_cut' },
};

/** What heat does: which machine an item belongs on, what it becomes, what it burns into. */
export const COOKED = {
  fillet_raw: { machine: 'grill', makes: 'fillet_grilled', burnt: 'fillet_burnt' },
  prawns_raw: { machine: 'grill', makes: 'prawns_grilled', burnt: 'prawns_burnt' },
  potato_cut: { machine: 'fryer', makes: 'fries', burnt: 'fries_burnt' },
};

/** Dishes built on a plate at the plating counter, from the pieces listed. */
export const RECIPES = [
  { id: 'fillet', name: 'Grilled Fillet', items: ['fillet_grilled'], price: 9 },
  { id: 'salad', name: 'Garden Salad', items: ['lettuce_cut', 'tomato_cut'], price: 8 },
  { id: 'butty', name: 'Fish Butty', items: ['bun', 'fillet_grilled', 'lettuce_cut'], price: 12 },
  { id: 'harbour', name: 'Harbour Plate', items: ['fillet_grilled', 'lettuce_cut', 'tomato_cut'], price: 13 },
  { id: 'prawns', name: 'Prawn Greens', items: ['prawns_grilled', 'lettuce_cut', 'tomato_cut'], price: 14 },
];

/** Chips never touch a plate: they come out of the fryer ready to serve. */
export const FRIES = { id: 'fries', name: 'Chips', price: 6 };

/** Every servable dish by id, plated recipes and chips together. */
export const DISHES = {};
for (const recipe of RECIPES) DISHES[recipe.id] = recipe;
DISHES[FRIES.id] = FRIES;

export function isDish(id) {
  return Object.prototype.hasOwnProperty.call(DISHES, id);
}

/**
 * The shift's featured dish — today's catch. Derived from the shift's seed
 * by its own hash, never from the ticket RNG: the stream of tickets a seed
 * deals must stay exactly the stream it always was, or every measured
 * number in the difficulty audit moves. Same seed, same special, all shift.
 */
export function dailySpecial(seed) {
  const ids = [...RECIPES.map((r) => r.id), FRIES.id];
  let h = (seed >>> 0) || 1;
  h = (h * 2654435761) >>> 0;
  h ^= h >>> 13;
  return ids[(h >>> 0) % ids.length];
}

/** The recipe whose pieces are exactly the multiset on the plate, or null. */
export function recipeForStack(stack) {
  for (const recipe of RECIPES) {
    if (recipe.items.length !== stack.length) continue;
    const want = [...recipe.items].sort();
    const got = [...stack].sort();
    if (want.every((item, i) => item === got[i])) return recipe;
  }
  return null;
}

/** True while the plate's pieces could still grow into at least one recipe. */
export function stackCanGrow(stack) {
  return RECIPES.some((recipe) => {
    if (stack.length >= recipe.items.length) return false;
    const pool = [...recipe.items];
    return stack.every((item) => {
      const at = pool.indexOf(item);
      if (at === -1) return false;
      pool.splice(at, 1);
      return true;
    });
  });
}

/**
 * Deal one order ticket. `heat` is how deep into the shift we are (0..1): it unlocks the
 * bigger plates, the chips-on-the-side combos and shorter tempers — more pressure,
 * never new chores.
 */
export function makeTicket(rng, heat, id) {
  const pool = RECIPES.filter((r) => r.items.length <= 2 + Math.floor(heat * 3.2));
  const main = pool[Math.floor(rng() * pool.length)];
  const items = [{ dish: main.id, done: false }];
  let price = main.price;
  if (heat > 0.25 && rng() < 0.22 + heat * 0.3) {
    items.push({ dish: FRIES.id, done: false });
    price += FRIES.price;
  }
  const seconds = Math.round((64 + main.items.length * 7) * (1 - heat * 0.18));
  return { id, items, price, timeLeft: seconds, timeTotal: seconds };
}
