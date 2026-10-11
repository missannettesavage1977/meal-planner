import { INGREDIENT_BY_ID } from "./ingredients";
import type { Cuisine, Equipment, MealSlot, Recipe } from "../domain/types";

/**
 * Seed recipe collection.
 *
 * All recipes are original to this project, written in plain home-cooking style
 * for a UK kitchen. Nutritional values are intentionally omitted: we do not have
 * lab-verified data and will not invent it.
 */

type Line = [id: string, qty: number, unit: string, note?: string, optional?: boolean];
type Sub = [ingredientId: string, alts: [altId: string | null, name: string, note?: string, ratio?: number][]];

interface R {
  id: string;
  name: string;
  desc: string;
  cuisine: Cuisine;
  meal?: MealSlot[];
  serves: number;
  prep: number;
  cook: number;
  emoji: string;
  hue: number;
  tags?: string[];
  eq?: Equipment[];
  level?: Recipe["difficulty"];
  keeps?: number;
  freeze?: boolean;
  storage?: string;
  ing: Line[];
  steps: string[];
  subs?: Sub[];
}

function build(r: R): Recipe {
  return {
    id: r.id,
    name: r.name,
    description: r.desc,
    cuisine: r.cuisine,
    mealTypes: r.meal ?? ["dinner"],
    servings: r.serves,
    prepMins: r.prep,
    cookMins: r.cook,
    ingredients: r.ing.map(([id, qty, unit, note, optional]) => {
      const def = INGREDIENT_BY_ID[id];
      if (!def) throw new Error(`Unknown ingredient ${id} in recipe ${r.id}`);
      return { ingredientId: id, name: def.name, quantity: qty, unit, note, optional };
    }),
    steps: r.steps,
    storage: r.storage,
    keepsDays: r.keeps ?? 0,
    freezable: r.freeze ?? false,
    substitutions: (r.subs ?? []).map(([ingredientId, alts]) => ({
      ingredientId,
      alternatives: alts.map(([altId, name, note, ratio]) => ({ ingredientId: altId, name, note, ratio: ratio ?? 1 })),
    })),
    tags: r.tags ?? [],
    equipment: r.eq ?? ["hob"],
    difficulty: r.level ?? "easy",
    emoji: r.emoji,
    hue: r.hue,
    source: "original",
  };
}

const FRIDGE_3 = "Cool quickly, then keep covered in the fridge for up to 3 days. Reheat until piping hot throughout.";
const FREEZE_3M = "Cool quickly and freeze in portions for up to 3 months. Defrost overnight in the fridge and reheat until piping hot.";
const RICE_SAFETY = "If keeping leftover rice, cool it within an hour, refrigerate and eat within 24 hours. Reheat only once, until steaming hot.";

const R: R[] = [
  /* ============================ DINNERS ============================ */
  {
    id: "spaghetti-bolognese", name: "Weeknight spaghetti bolognese", cuisine: "italian", serves: 4, prep: 15, cook: 40, emoji: "🍝", hue: 12,
    desc: "A rich beef and tomato ragù with hidden veg. Makes a generous batch that freezes well.",
    tags: ["family-friendly", "batch-cook", "comfort"], keeps: 3, freeze: true, storage: `${FRIDGE_3} ${FREEZE_3M}`,
    ing: [["vegetable-oil", 1, "tbsp"], ["onion", 1, "item", "finely chopped"], ["carrot", 1, "item", "finely chopped"], ["celery", 1, "stick", "finely chopped"], ["garlic", 2, "clove", "crushed"], ["beef-mince", 500, "g"], ["tomato-puree", 2, "tbsp"], ["chopped-tomatoes", 2, "tin"], ["beef-stock-cube", 1, "cube", "made up with 200ml water"], ["dried-oregano", 1, "tsp"], ["spaghetti", 320, "g"], ["cheddar", 40, "g", "grated, to serve", true]],
    steps: ["Heat the oil in a large pan and soften the onion, carrot and celery for 8–10 minutes.", "Add the garlic for 1 minute, then the mince. Brown it, breaking it up with a spoon.", "Stir in the tomato purée, chopped tomatoes, stock and oregano. Simmer gently, partly covered, for 30 minutes until thick.", "Meanwhile cook the spaghetti in salted boiling water according to the pack. Drain, keeping a splash of the water.", "Season the sauce, loosen with a little pasta water if needed and serve over the spaghetti with cheese."],
    subs: [["beef-mince", [["green-lentils", "Tinned green lentils (2 tins) for a veggie version", "Add with the tomatoes and simmer 15 minutes.", 1.06], ["pork-mince", "Pork mince"]]], ["beef-stock-cube", [["veg-stock-cube", "Vegetable stock cube"]]], ["spaghetti", [[null, "Gluten-free spaghetti", "Check the label."]]]],
  },
  {
    id: "chilli-con-carne", name: "Smoky chilli con carne", cuisine: "mexican", serves: 4, prep: 15, cook: 45, emoji: "🌶️", hue: 5,
    desc: "Beef and kidney bean chilli with smoked paprika and cumin. Even better the next day.",
    tags: ["batch-cook", "comfort"], keeps: 3, freeze: true, storage: `${FRIDGE_3} ${FREEZE_3M} ${RICE_SAFETY}`,
    ing: [["vegetable-oil", 1, "tbsp"], ["onion", 1, "item", "chopped"], ["bell-pepper", 1, "item", "chopped"], ["garlic", 2, "clove", "crushed"], ["beef-mince", 500, "g"], ["chilli-powder", 2, "tsp"], ["ground-cumin", 1, "tsp"], ["smoked-paprika", 1, "tsp"], ["tomato-puree", 2, "tbsp"], ["chopped-tomatoes", 1, "tin"], ["kidney-beans", 1, "tin", "drained"], ["beef-stock-cube", 1, "cube", "made up with 250ml water"], ["rice", 280, "g"], ["soured-cream", 4, "tbsp", "to serve", true]],
    steps: ["Soften the onion and pepper in the oil for 5 minutes. Add the garlic for 1 minute.", "Add the mince and brown well. Stir in the spices and tomato purée and cook for 1 minute.", "Add the tomatoes, beans and stock. Simmer for 35–40 minutes, stirring now and then, until thick.", "Cook the rice according to the pack.", "Season the chilli and serve with rice and a spoonful of soured cream."],
    subs: [["beef-mince", [["black-beans", "Extra tin of black beans plus 250g mushrooms for veggie chilli", undefined, 0.48]]], ["soured-cream", [["yoghurt", "Natural yoghurt"]]]],
  },
  {
    id: "sweet-potato-black-bean-chilli", name: "Sweet potato & black bean chilli", cuisine: "mexican", serves: 4, prep: 15, cook: 35, emoji: "🫘", hue: 25,
    desc: "A hearty vegan chilli with sweet potato chunks, black beans and a hint of cinnamon.",
    tags: ["batch-cook", "healthy", "budget"], keeps: 3, freeze: true, storage: `${FRIDGE_3} ${FREEZE_3M}`,
    ing: [["olive-oil", 1, "tbsp"], ["onion", 1, "item", "chopped"], ["bell-pepper", 1, "item", "chopped"], ["garlic", 3, "clove", "crushed"], ["chilli-powder", 2, "tsp"], ["ground-cumin", 2, "tsp"], ["cinnamon", 0.5, "tsp"], ["sweet-potato", 600, "g", "peeled and cut into 2cm chunks"], ["chopped-tomatoes", 2, "tin"], ["black-beans", 2, "tin", "drained"], ["veg-stock-cube", 1, "cube", "made up with 300ml water"], ["lime", 1, "item"], ["fresh-coriander", 10, "g", "to serve", true], ["rice", 280, "g"]],
    steps: ["Soften the onion and pepper in the oil for 5 minutes, then add the garlic and spices for 1 minute.", "Add the sweet potato, tomatoes and stock. Cover and simmer for 20 minutes.", "Stir in the beans and simmer uncovered for 10 minutes until the sweet potato is tender and the sauce is thick.", "Meanwhile cook the rice.", "Squeeze in the lime juice, season, and scatter with coriander."],
    subs: [["sweet-potato", [["butternut-squash", "Butternut squash"]]], ["black-beans", [["kidney-beans", "Kidney beans"]]]],
  },
  {
    id: "chickpea-spinach-curry", name: "Chickpea & spinach curry", cuisine: "indian", serves: 4, prep: 10, cook: 25, emoji: "🍛", hue: 40,
    desc: "A creamy coconut curry that comes together from cupboard staples and a bag of spinach.",
    tags: ["healthy", "budget", "one-pot"], keeps: 3, freeze: true, storage: `${FRIDGE_3} ${RICE_SAFETY}`,
    ing: [["vegetable-oil", 1, "tbsp"], ["onion", 1, "item", "chopped"], ["garlic", 3, "clove", "crushed"], ["ginger", 15, "g", "grated"], ["garam-masala", 2, "tsp"], ["ground-cumin", 1, "tsp"], ["turmeric", 1, "tsp"], ["chopped-tomatoes", 1, "tin"], ["coconut-milk", 1, "tin"], ["chickpeas", 2, "tin", "drained"], ["spinach", 200, "g"], ["rice", 280, "g"], ["fresh-coriander", 10, "g", "chopped", true]],
    steps: ["Fry the onion in the oil for 6–8 minutes until golden. Add the garlic, ginger and spices and stir for 1 minute.", "Pour in the tomatoes and coconut milk, add the chickpeas and simmer for 15 minutes.", "Cook the rice according to the pack.", "Stir the spinach into the curry until wilted. Season and scatter with coriander."],
    subs: [["spinach", [["frozen-spinach", "Frozen spinach (add straight from frozen)"]]], ["coconut-milk", [["yoghurt", "Natural yoghurt, stirred in off the heat", "Not vegan.", 0.5]]]],
  },
  {
    id: "red-lentil-dhal", name: "Red lentil dhal", cuisine: "indian", serves: 4, prep: 10, cook: 30, emoji: "🥣", hue: 45,
    desc: "Comforting, very cheap and freezer-friendly. Brilliant with rice or naan.",
    tags: ["budget", "healthy", "batch-cook", "one-pot"], keeps: 4, freeze: true, storage: `Keeps 4 days in the fridge; thickens as it cools, so loosen with water when reheating. ${FREEZE_3M}`,
    ing: [["vegetable-oil", 1, "tbsp"], ["onion", 1, "item", "finely chopped"], ["garlic", 3, "clove", "crushed"], ["ginger", 15, "g", "grated"], ["cumin-seeds", 1, "tsp"], ["turmeric", 1, "tsp"], ["garam-masala", 1, "tsp"], ["red-lentils", 250, "g", "rinsed"], ["chopped-tomatoes", 1, "tin"], ["veg-stock-cube", 1, "cube", "made up with 800ml water"], ["spinach", 100, "g"], ["lemon", 0.5, "item"], ["naan", 2, "item", "to serve", true]],
    steps: ["Fry the cumin seeds in the oil for 30 seconds, then add the onion and cook for 8 minutes.", "Add the garlic, ginger, turmeric and garam masala for 1 minute.", "Add the lentils, tomatoes and stock. Simmer for 20–25 minutes, stirring often, until the lentils collapse.", "Stir in the spinach to wilt, add a squeeze of lemon and season. Serve with warm naan or rice."],
    subs: [["naan", [["bread", "Wholemeal bread (2 slices per naan)", undefined, 2]]]],
  },
  {
    id: "chicken-veg-stir-fry", name: "Chicken & veg stir-fry with noodles", cuisine: "chinese", serves: 4, prep: 15, cook: 12, emoji: "🥢", hue: 30,
    desc: "Fast, fresh and crunchy. Ready in under half an hour.",
    tags: ["family-friendly", "healthy"],
    ing: [["egg-noodles", 250, "g"], ["vegetable-oil", 1, "tbsp"], ["chicken-breast", 400, "g", "sliced"], ["bell-pepper", 2, "item", "sliced"], ["broccoli", 200, "g", "small florets"], ["spring-onion", 4, "item", "sliced"], ["garlic", 2, "clove", "sliced"], ["ginger", 10, "g", "grated"], ["soy-sauce", 3, "tbsp"], ["honey", 1, "tbsp"], ["sesame-oil", 1, "tsp", undefined, true]],
    steps: ["Cook the noodles according to the pack, drain and toss with a little oil.", "Stir-fry the chicken in the oil over a high heat for 5 minutes until cooked through. Remove.", "Stir-fry the peppers and broccoli for 3 minutes, then add the garlic, ginger and most of the spring onions for 1 minute.", "Return the chicken with the noodles, soy sauce and honey. Toss until hot and glossy, drizzle with sesame oil and top with the remaining spring onions."],
    subs: [["chicken-breast", [["tofu", "Firm tofu, pressed and cubed", undefined, 0.7], ["prawns", "Raw king prawns"]]], ["soy-sauce", [["tamari", "Tamari (gluten-free)"]]], ["egg-noodles", [["rice-noodles", "Rice noodles (gluten-free)"]]], ["honey", [["maple-syrup", "Maple syrup (vegan)"]]]],
  },
  {
    id: "egg-fried-rice", name: "Veggie egg fried rice", cuisine: "chinese", serves: 4, prep: 10, cook: 15, emoji: "🍳", hue: 50,
    desc: "Turns leftover or cooked-and-cooled rice into a quick dinner. Add any veg you need to use up.",
    tags: ["quick", "budget", "use-it-up"],
    ing: [["rice", 300, "g", "cooked the day before and chilled, or use 750g cooked rice"], ["vegetable-oil", 2, "tbsp"], ["eggs", 4, "item", "beaten"], ["frozen-peas", 150, "g"], ["carrot", 2, "item", "finely diced"], ["spring-onion", 4, "item", "sliced"], ["garlic", 2, "clove", "crushed"], ["soy-sauce", 3, "tbsp"], ["sesame-oil", 1, "tsp", undefined, true]],
    steps: ["If not using leftovers, cook the rice, spread it on a tray to cool quickly, and chill.", "Heat half the oil in a wok, scramble the eggs until just set, then remove.", "Add the rest of the oil and stir-fry the carrot for 3 minutes, then the garlic, peas and most of the spring onions for 2 minutes.", "Add the cold rice and stir-fry until piping hot, about 5 minutes. Stir in the egg, soy sauce and sesame oil and scatter with spring onions."],
    subs: [["eggs", [["tofu", "Crumbled firm tofu (vegan)", undefined, 60]]], ["soy-sauce", [["tamari", "Tamari (gluten-free)"]]]],
  },
  {
    id: "shepherds-pie", name: "Classic shepherd's pie", cuisine: "british", serves: 4, prep: 25, cook: 60, emoji: "🥧", hue: 32,
    desc: "Lamb mince in a rich gravy topped with buttery mash. A Sunday favourite that reheats beautifully.",
    tags: ["family-friendly", "comfort", "batch-cook"], eq: ["hob", "oven"], level: "medium", keeps: 3, freeze: true, storage: `${FRIDGE_3} ${FREEZE_3M}`,
    ing: [["vegetable-oil", 1, "tbsp"], ["onion", 1, "item", "chopped"], ["carrot", 2, "item", "diced"], ["lamb-mince", 500, "g"], ["plain-flour", 1, "tbsp"], ["tomato-puree", 2, "tbsp"], ["worcestershire-sauce", 1, "tbsp"], ["beef-stock-cube", 1, "cube", "made up with 400ml water"], ["dried-thyme", 1, "tsp"], ["frozen-peas", 100, "g"], ["potatoes", 1000, "g", "peeled and chunked"], ["butter", 30, "g"], ["milk", 100, "ml"]],
    steps: ["Boil the potatoes for 15–20 minutes until tender. Drain and mash with the butter and milk. Season.", "Meanwhile soften the onion and carrot in the oil for 8 minutes. Add the lamb and brown well.", "Stir in the flour and tomato purée, then the Worcestershire sauce, stock and thyme. Simmer for 20 minutes until thick, then add the peas.", "Heat the oven to 200°C (180°C fan). Spoon the lamb into a baking dish, top with mash and rough up with a fork.", "Bake for 25–30 minutes until golden and bubbling."],
    subs: [["lamb-mince", [["beef-mince", "Beef mince (makes it a cottage pie)"]]], ["worcestershire-sauce", [["soy-sauce", "Soy sauce (no fish; contains soya and gluten)"]]]],
  },
  {
    id: "lentil-cottage-pie", name: "Lentil & mushroom cottage pie", cuisine: "british", serves: 4, prep: 20, cook: 50, emoji: "🥔", hue: 28,
    desc: "A vegan take on the classic with green lentils and mushrooms under a golden mash.",
    tags: ["batch-cook", "healthy", "comfort"], eq: ["hob", "oven"], keeps: 3, freeze: true, storage: `${FRIDGE_3} ${FREEZE_3M}`,
    ing: [["olive-oil", 2, "tbsp"], ["onion", 1, "item", "chopped"], ["carrot", 2, "item", "diced"], ["celery", 2, "stick", "diced"], ["mushrooms", 250, "g", "chopped"], ["garlic", 2, "clove", "crushed"], ["tomato-puree", 2, "tbsp"], ["green-lentils", 2, "tin", "drained"], ["veg-stock-cube", 1, "cube", "made up with 300ml water"], ["dried-thyme", 1, "tsp"], ["potatoes", 1000, "g", "peeled and chunked"], ["frozen-peas", 100, "g"]],
    steps: ["Boil the potatoes until tender, drain and mash with 1 tbsp of the oil and a splash of the cooking water. Season.", "Soften the onion, carrot and celery in the remaining oil for 8 minutes, then add the mushrooms and garlic for 5 minutes.", "Stir in the tomato purée, lentils, stock and thyme and simmer for 10 minutes. Add the peas.", "Heat the oven to 200°C (180°C fan). Tip into a dish, top with the mash and bake for 25 minutes until golden."],
    subs: [["green-lentils", [["red-lentils", "Dried red lentils (150g) – add 300ml extra water and simmer 20 mins", undefined, 0.3]]]],
  },
  {
    id: "sausage-mash-onion-gravy", name: "Sausages, mash & onion gravy", cuisine: "british", serves: 4, prep: 10, cook: 30, emoji: "🌭", hue: 22,
    desc: "Proper comfort food with sticky onion gravy and peas.",
    tags: ["family-friendly", "comfort"], eq: ["hob", "oven"],
    ing: [["pork-sausages", 8, "item"], ["potatoes", 1000, "g", "peeled and chunked"], ["butter", 30, "g"], ["milk", 100, "ml"], ["onion", 2, "item", "thinly sliced"], ["vegetable-oil", 1, "tbsp"], ["gravy-granules", 4, "tbsp"], ["frozen-peas", 300, "g"]],
    steps: ["Heat the oven to 200°C (180°C fan) and roast the sausages for 25–30 minutes, turning once.", "Boil the potatoes for 15–20 minutes. Drain and mash with the butter and milk.", "Meanwhile cook the onions slowly in the oil for 15 minutes until soft and golden. Make up the gravy granules with 400ml boiling water and stir into the onions.", "Cook the peas and serve everything together."],
    subs: [["pork-sausages", [[null, "Vegetarian sausages", "Check the label for allergens."]]], ["gravy-granules", [[null, "Gluten-free gravy granules", "Check the label."]]]],
  },
  {
    id: "salmon-traybake", name: "Lemony salmon & new potato traybake", cuisine: "british", serves: 4, prep: 10, cook: 35, emoji: "🐟", hue: 15,
    desc: "One tray, minimal washing up. Salmon roasted over crispy new potatoes and green beans.",
    tags: ["healthy", "one-pot"], eq: ["oven"],
    ing: [["new-potatoes", 750, "g", "halved"], ["olive-oil", 2, "tbsp"], ["salmon-fillets", 480, "g", "4 fillets"], ["green-beans", 200, "g", "trimmed"], ["lemon", 1, "item", "sliced"], ["garlic", 2, "clove", "sliced"], ["fresh-parsley", 10, "g", "chopped", true]],
    steps: ["Heat the oven to 200°C (180°C fan). Toss the potatoes with the oil and seasoning in a large roasting tin and roast for 20 minutes.", "Add the green beans and garlic, toss, then nestle in the salmon and lay lemon slices on top.", "Roast for 12–15 minutes until the salmon flakes easily.", "Scatter with parsley and squeeze over any juices from the lemon."],
    subs: [["salmon-fillets", [[null, "Any firm white fish fillets"], ["chicken-thighs", "Chicken thighs (roast with the potatoes for the full time)"]]], ["green-beans", [["broccoli", "Broccoli florets"]]]],
  },
  {
    id: "fish-finger-wraps", name: "Crispy fish finger wraps", cuisine: "british", serves: 4, prep: 10, cook: 15, emoji: "🌯", hue: 45,
    desc: "A family-friendly Friday treat with crunchy lettuce and lemony mayo.",
    tags: ["family-friendly", "quick"], eq: ["oven"],
    ing: [["fish-fingers", 12, "item"], ["tortilla-wraps", 4, "item"], ["little-gem", 1, "item", "shredded"], ["cucumber", 0.5, "item", "sliced"], ["mayonnaise", 4, "tbsp"], ["lemon", 0.5, "item"], ["frozen-peas", 200, "g", "to serve", true]],
    steps: ["Cook the fish fingers according to the pack (oven or air fryer).", "Mix the mayonnaise with a squeeze of lemon and some black pepper.", "Warm the wraps, spread with the lemon mayo, add lettuce and cucumber and top with 3 fish fingers each.", "Roll up and serve with peas if you like."],
    subs: [["mayonnaise", [["yoghurt", "Natural yoghurt"]]]],
  },
  {
    id: "tuna-sweetcorn-jackets", name: "Jacket potatoes with tuna & sweetcorn", cuisine: "british", meal: ["dinner", "lunch"], serves: 4, prep: 10, cook: 70, emoji: "🥔", hue: 40,
    desc: "A low-effort classic. Use the microwave to speed things up.",
    tags: ["budget", "family-friendly"], eq: ["oven", "microwave"],
    ing: [["baking-potato", 4, "item"], ["tuna", 2, "tin", "drained"], ["sweetcorn", 1, "tin", "drained"], ["mayonnaise", 4, "tbsp"], ["cheddar", 60, "g", "grated"], ["salad-leaves", 80, "g", "to serve"]],
    steps: ["Prick the potatoes and bake at 200°C (180°C fan) for 1 hour–1 hour 15 minutes until soft. (Or microwave for 8–10 minutes, then crisp in the oven for 15 minutes.)", "Mix the tuna, sweetcorn and mayonnaise and season with black pepper.", "Split the potatoes, fill with the tuna mix and top with cheese. Serve with salad."],
    subs: [["tuna", [["chickpeas", "Mashed chickpeas (vegetarian)", undefined, 1.2]]]],
  },
  {
    id: "tomato-mozzarella-pasta-bake", name: "Tomato & mozzarella pasta bake", cuisine: "italian", serves: 4, prep: 10, cook: 30, emoji: "🧀", hue: 8,
    desc: "Bubbling, cheesy and loved by kids. Uses store-cupboard basics.",
    tags: ["family-friendly", "budget", "comfort"], eq: ["hob", "oven"], keeps: 2, storage: "Keeps 2 days in the fridge. Reheat until piping hot.",
    ing: [["pasta", 350, "g"], ["olive-oil", 1, "tbsp"], ["onion", 1, "item", "chopped"], ["garlic", 2, "clove", "crushed"], ["chopped-tomatoes", 2, "tin"], ["dried-oregano", 1, "tsp"], ["spinach", 100, "g", undefined, true], ["mozzarella", 1, "ball", "torn"], ["cheddar", 50, "g", "grated"], ["fresh-basil", 10, "g", undefined, true]],
    steps: ["Heat the oven to 200°C (180°C fan). Cook the pasta for 2 minutes less than the pack says, then drain.", "Soften the onion in the oil for 5 minutes, add the garlic, then the tomatoes and oregano. Simmer for 10 minutes. Stir in the spinach to wilt.", "Mix the pasta with the sauce and tip into a baking dish. Top with mozzarella and cheddar.", "Bake for 15–20 minutes until golden. Scatter with basil."],
  },
  {
    id: "creamy-mushroom-spinach-pasta", name: "Creamy mushroom & spinach pasta", cuisine: "italian", serves: 4, prep: 10, cook: 15, emoji: "🍄", hue: 35,
    desc: "A 25-minute vegetarian pasta with garlic, lemon and crème fraîche.",
    tags: ["quick"],
    ing: [["pasta", 350, "g"], ["olive-oil", 1, "tbsp"], ["mushrooms", 300, "g", "sliced"], ["garlic", 3, "clove", "crushed"], ["creme-fraiche", 200, "ml"], ["spinach", 100, "g"], ["lemon", 0.5, "item", "zest and juice"], ["veggie-hard-cheese", 40, "g", "grated"]],
    steps: ["Cook the pasta according to the pack. Keep a mugful of the cooking water.", "Fry the mushrooms in the oil over a high heat for 6–8 minutes until golden. Add the garlic for 1 minute.", "Stir in the crème fraîche and a splash of pasta water, then the spinach until wilted.", "Toss with the pasta, lemon and most of the cheese, loosening with pasta water. Season and serve with the rest of the cheese."],
    subs: [["creme-fraiche", [[null, "Oat-based crème fraîche alternative (dairy-free)", "Check the label."]]], ["veggie-hard-cheese", [["parmesan", "Parmesan (not vegetarian)"]]]],
  },
  {
    id: "chicken-fajitas", name: "Sizzling chicken fajitas", cuisine: "mexican", serves: 4, prep: 15, cook: 12, emoji: "🌮", hue: 18,
    desc: "Build-your-own wraps with smoky spiced chicken and peppers.",
    tags: ["family-friendly", "quick"],
    ing: [["chicken-breast", 450, "g", "cut into strips"], ["bell-pepper", 2, "item", "sliced"], ["red-onion", 1, "item", "sliced"], ["smoked-paprika", 2, "tsp"], ["ground-cumin", 1, "tsp"], ["chilli-powder", 1, "tsp"], ["vegetable-oil", 1, "tbsp"], ["lime", 1, "item"], ["tortilla-wraps", 8, "item"], ["soured-cream", 100, "ml"], ["cheddar", 60, "g", "grated"], ["little-gem", 1, "item", "shredded", true]],
    steps: ["Toss the chicken with the spices, half the oil and a pinch of salt.", "Stir-fry the peppers and onion in the rest of the oil over a high heat for 5 minutes. Remove.", "Cook the chicken for 5–6 minutes until cooked through, return the veg and squeeze over the lime.", "Warm the wraps and serve with the chicken, soured cream, cheese and lettuce."],
    subs: [["chicken-breast", [["halloumi", "Halloumi strips (vegetarian)", undefined, 0.6], ["black-beans", "Black beans (vegan, skip the dairy)", undefined, 0.53]]]],
  },
  {
    id: "thai-green-chicken-curry", name: "Thai green chicken curry", cuisine: "thai", serves: 4, prep: 10, cook: 20, emoji: "🥥", hue: 95,
    desc: "Fragrant and creamy with green beans and peppers. A jar of paste keeps it simple.",
    tags: ["quick"], keeps: 2, storage: `Keeps 2 days in the fridge. ${RICE_SAFETY}`,
    ing: [["vegetable-oil", 1, "tbsp"], ["thai-green-curry-paste", 3, "tbsp"], ["chicken-thighs", 500, "g", "cut into chunks"], ["coconut-milk", 1, "tin"], ["green-beans", 150, "g", "halved"], ["bell-pepper", 1, "item", "sliced"], ["lime", 1, "item"], ["rice", 280, "g"], ["fresh-coriander", 10, "g", undefined, true]],
    steps: ["Fry the curry paste in the oil for 1 minute, then add the chicken and stir to coat.", "Pour in the coconut milk and 100ml water. Simmer for 10 minutes.", "Add the green beans and pepper and simmer for 5–6 minutes until the chicken is cooked through.", "Meanwhile cook the rice. Squeeze lime into the curry and scatter with coriander."],
    subs: [["chicken-thighs", [["tofu", "Firm tofu (check paste is vegan)"], ["prawns", "Raw king prawns (add for the last 4 minutes)"]]]],
  },
  {
    id: "halloumi-veg-couscous", name: "Roasted veg & halloumi couscous", cuisine: "middle-eastern", serves: 4, prep: 15, cook: 30, emoji: "🫑", hue: 55,
    desc: "Colourful traybake veg tossed with fluffy couscous, mint and golden halloumi.",
    tags: ["healthy"], eq: ["oven", "hob"], keeps: 2, storage: "The couscous and veg keep 2 days in the fridge – good for packed lunches.",
    ing: [["courgette", 2, "item", "chunked"], ["bell-pepper", 2, "item", "chunked"], ["red-onion", 1, "item", "wedges"], ["olive-oil", 2, "tbsp"], ["ground-cumin", 1, "tsp"], ["couscous", 250, "g"], ["veg-stock-cube", 1, "cube", "made up with 300ml boiling water"], ["halloumi", 225, "g", "sliced"], ["lemon", 1, "item"], ["fresh-mint", 10, "g", "chopped", true]],
    steps: ["Heat the oven to 200°C (180°C fan). Toss the veg with the oil and cumin and roast for 25–30 minutes.", "Pour the hot stock over the couscous, cover and leave for 5 minutes, then fluff up with a fork.", "Fry the halloumi in a dry pan for 2 minutes each side until golden.", "Toss the couscous with the veg, lemon juice and mint and top with halloumi."],
    subs: [["halloumi", [["chickpeas", "Roasted chickpeas (vegan)", undefined, 1]]], ["couscous", [["rice", "Rice (gluten-free)"]]]],
  },
  {
    id: "minestrone", name: "Big-batch minestrone soup", cuisine: "italian", meal: ["dinner", "lunch"], serves: 6, prep: 15, cook: 35, emoji: "🥣", hue: 20,
    desc: "A thick vegetable, bean and pasta soup. Makes enough for lunches too.",
    tags: ["batch-cook", "healthy", "budget", "use-it-up"], keeps: 4, freeze: true, storage: "Keeps 4 days in the fridge. Freeze without the pasta for best results.",
    ing: [["olive-oil", 2, "tbsp"], ["onion", 1, "item", "chopped"], ["carrot", 2, "item", "diced"], ["celery", 2, "stick", "diced"], ["garlic", 2, "clove", "crushed"], ["courgette", 1, "item", "diced"], ["chopped-tomatoes", 1, "tin"], ["veg-stock-cube", 2, "cube", "made up with 1.2 litres water"], ["cannellini-beans", 1, "tin", "drained"], ["pasta", 100, "g", "small shapes"], ["spinach", 100, "g"], ["dried-mixed-herbs", 1, "tsp"], ["bread", 6, "slice", "to serve", true]],
    steps: ["Soften the onion, carrot and celery in the oil for 10 minutes.", "Add the garlic, courgette and herbs for 2 minutes, then the tomatoes and stock. Simmer for 15 minutes.", "Add the beans and pasta and simmer for 10 minutes until the pasta is tender.", "Stir in the spinach, season well and serve with crusty bread."],
  },
  {
    id: "leek-potato-soup", name: "Leek & potato soup", cuisine: "british", meal: ["lunch", "dinner"], serves: 4, prep: 10, cook: 30, emoji: "🥬", hue: 75,
    desc: "Silky, simple and cheap. Blitz smooth or leave chunky.",
    tags: ["budget", "batch-cook", "comfort"], eq: ["hob", "blender"], keeps: 3, freeze: true, storage: `${FRIDGE_3} ${FREEZE_3M}`,
    ing: [["butter", 25, "g"], ["leek", 3, "item", "sliced"], ["onion", 1, "item", "chopped"], ["potatoes", 500, "g", "peeled and diced"], ["veg-stock-cube", 1, "cube", "made up with 1 litre water"], ["milk", 150, "ml"], ["bread", 4, "slice", "to serve", true]],
    steps: ["Melt the butter and gently cook the leeks and onion with a lid on for 10 minutes until soft.", "Add the potatoes and stock and simmer for 20 minutes until the potatoes are very tender.", "Blend until smooth, stir in the milk, and season well. Serve with bread."],
    subs: [["butter", [["olive-oil", "Olive oil (dairy-free)", undefined, 1]]], ["milk", [[null, "Unsweetened oat drink (dairy-free)"]]]],
  },
  {
    id: "chicken-leek-pie", name: "Chicken, leek & mushroom pie", cuisine: "british", serves: 4, prep: 20, cook: 40, emoji: "🥧", hue: 38,
    desc: "A creamy pie filling under a puff pastry lid – cosy, but not complicated.",
    tags: ["comfort", "family-friendly"], eq: ["hob", "oven"], level: "medium", keeps: 2, storage: "Keeps 2 days in the fridge. Reheat in the oven until piping hot.",
    ing: [["vegetable-oil", 1, "tbsp"], ["chicken-thighs", 500, "g", "chunked"], ["leek", 2, "item", "sliced"], ["mushrooms", 200, "g", "quartered"], ["plain-flour", 2, "tbsp"], ["chicken-stock-cube", 1, "cube", "made up with 300ml water"], ["creme-fraiche", 150, "ml"], ["dried-thyme", 1, "tsp"], ["puff-pastry", 1, "sheet"], ["eggs", 1, "item", "beaten, to glaze"], ["green-beans", 200, "g", "to serve", true]],
    steps: ["Heat the oven to 200°C (180°C fan). Brown the chicken in the oil, then add the leeks and mushrooms and cook for 5 minutes.", "Stir in the flour, then gradually add the stock. Simmer for 5 minutes until thick, then stir in the crème fraîche and thyme. Season.", "Tip into a pie dish, top with the pastry, trim, and brush with egg. Cut a steam hole.", "Bake for 25–30 minutes until puffed and golden. Serve with green veg."],
  },
  {
    id: "pork-meatballs-tomato", name: "Pork meatballs in tomato sauce", cuisine: "italian", serves: 4, prep: 20, cook: 25, emoji: "🧆", hue: 10,
    desc: "Tender herby meatballs simmered in passata, served with spaghetti.",
    tags: ["family-friendly", "batch-cook"], keeps: 3, freeze: true, storage: `${FRIDGE_3} ${FREEZE_3M}`,
    ing: [["pork-mince", 500, "g"], ["breadcrumbs", 40, "g"], ["eggs", 1, "item"], ["onion", 1, "item", "very finely chopped"], ["garlic", 2, "clove", "crushed"], ["dried-mixed-herbs", 1, "tsp"], ["olive-oil", 1, "tbsp"], ["passata", 500, "g"], ["spaghetti", 320, "g"], ["fresh-basil", 10, "g", undefined, true], ["veggie-hard-cheese", 30, "g", "grated", true]],
    steps: ["Mix the pork, breadcrumbs, egg, half the onion, half the garlic and the herbs. Season and roll into 20 meatballs.", "Brown the meatballs in the oil for 5 minutes, then remove.", "Soften the remaining onion and garlic, add the passata and simmer for 5 minutes. Return the meatballs and simmer for 15 minutes until cooked through.", "Cook the spaghetti and serve topped with meatballs, sauce, basil and cheese."],
    subs: [["pork-mince", [["beef-mince", "Beef mince"]]], ["breadcrumbs", [[null, "Gluten-free breadcrumbs"]]]],
  },
  {
    id: "honey-soy-salmon", name: "Honey-soy salmon with broccoli rice", cuisine: "chinese", serves: 4, prep: 10, cook: 20, emoji: "🍣", hue: 20,
    desc: "Sticky glazed salmon with garlicky broccoli and fluffy rice.",
    tags: ["healthy", "quick"], eq: ["oven", "hob"],
    ing: [["salmon-fillets", 480, "g", "4 fillets"], ["soy-sauce", 3, "tbsp"], ["honey", 2, "tbsp"], ["garlic", 2, "clove", "crushed"], ["ginger", 10, "g", "grated"], ["rice", 280, "g"], ["broccoli", 350, "g", "florets"], ["spring-onion", 3, "item", "sliced"], ["sesame-oil", 1, "tsp", undefined, true]],
    steps: ["Heat the oven to 200°C (180°C fan). Mix the soy, honey, garlic and ginger.", "Put the salmon in a lined tin, spoon over half the glaze and bake for 12–15 minutes.", "Cook the rice; steam or boil the broccoli for the last 4 minutes.", "Spoon the remaining glaze over the salmon and serve with rice, broccoli and spring onions."],
    subs: [["soy-sauce", [["tamari", "Tamari (gluten-free)"]]], ["salmon-fillets", [["chicken-thighs", "Chicken thighs (bake 25 minutes)"]]]],
  },
  {
    id: "bean-cheese-quesadillas", name: "Bean & cheese quesadillas", cuisine: "mexican", meal: ["dinner", "lunch"], serves: 4, prep: 10, cook: 15, emoji: "🫓", hue: 42,
    desc: "Crisp tortillas stuffed with spiced black beans, sweetcorn and melting cheese.",
    tags: ["quick", "budget", "family-friendly"],
    ing: [["black-beans", 1, "tin", "drained"], ["sweetcorn", 1, "tin", "drained"], ["spring-onion", 3, "item", "sliced"], ["ground-cumin", 1, "tsp"], ["smoked-paprika", 1, "tsp"], ["cheddar", 150, "g", "grated"], ["tortilla-wraps", 8, "item"], ["salad-leaves", 80, "g", "to serve"], ["soured-cream", 100, "ml", "to serve", true]],
    steps: ["Roughly mash the beans with the spices, then stir in the sweetcorn and spring onions.", "Spread over 4 tortillas, scatter with cheese and top with the remaining tortillas.", "Cook in a dry frying pan for 2–3 minutes each side until crisp and melted.", "Cut into wedges and serve with salad and soured cream."],
  },
  {
    id: "mushroom-risotto", name: "Mushroom risotto", cuisine: "italian", serves: 4, prep: 10, cook: 30, emoji: "🍚", hue: 36,
    desc: "Creamy, savoury and worth the stirring.",
    tags: ["comfort"], level: "medium",
    ing: [["butter", 30, "g"], ["olive-oil", 1, "tbsp"], ["onion", 1, "item", "finely chopped"], ["garlic", 2, "clove", "crushed"], ["mushrooms", 300, "g", "sliced"], ["arborio-rice", 300, "g"], ["veg-stock-cube", 2, "cube", "made up with 1.2 litres hot water"], ["veggie-hard-cheese", 50, "g", "grated"], ["fresh-parsley", 10, "g", "chopped", true]],
    steps: ["Fry the mushrooms in the oil and half the butter until golden. Remove half for the top.", "Add the onion and cook gently for 5 minutes, then the garlic and rice for 1 minute.", "Add the hot stock a ladle at a time, stirring, letting each be absorbed before adding the next – about 20 minutes, until the rice is just tender.", "Stir in the remaining butter and the cheese, season, and serve topped with the reserved mushrooms and parsley."],
  },
  {
    id: "tuna-pasta-bake", name: "Cheesy tuna & sweetcorn pasta bake", cuisine: "british", serves: 4, prep: 15, cook: 25, emoji: "🧀", hue: 48,
    desc: "A creamy, crowd-pleasing bake made from cupboard ingredients.",
    tags: ["family-friendly", "budget", "comfort"], eq: ["hob", "oven"], keeps: 2, storage: "Keeps 2 days in the fridge. Reheat until piping hot.",
    ing: [["pasta", 350, "g"], ["butter", 40, "g"], ["plain-flour", 40, "g"], ["milk", 600, "ml"], ["cheddar", 120, "g", "grated"], ["tuna", 2, "tin", "drained"], ["sweetcorn", 1, "tin", "drained"], ["frozen-peas", 100, "g"]],
    steps: ["Heat the oven to 200°C (180°C fan). Cook the pasta for 2 minutes less than the pack says, adding the peas for the last minute. Drain.", "Melt the butter, stir in the flour for 1 minute, then whisk in the milk gradually. Simmer, stirring, until thick. Stir in two-thirds of the cheese.", "Mix the sauce with the pasta, peas, tuna and sweetcorn. Tip into a dish and top with the rest of the cheese.", "Bake for 15–20 minutes until golden."],
  },
  {
    id: "roast-chicken-traybake", name: "Herby chicken & root veg traybake", cuisine: "british", serves: 4, prep: 15, cook: 45, emoji: "🍗", hue: 30,
    desc: "A low-effort roast dinner on one tray with crispy potatoes and sweet carrots.",
    tags: ["family-friendly", "one-pot"], eq: ["oven"], keeps: 3, storage: "Leftover chicken keeps 3 days in the fridge – great in wraps.",
    ing: [["chicken-thighs", 700, "g"], ["potatoes", 800, "g", "chunked"], ["carrot", 4, "item", "chunked"], ["red-onion", 2, "item", "wedges"], ["garlic", 4, "clove", "whole, bashed"], ["olive-oil", 2, "tbsp"], ["dried-rosemary", 1, "tsp"], ["dried-thyme", 1, "tsp"], ["broccoli", 300, "g", "to serve"]],
    steps: ["Heat the oven to 200°C (180°C fan). Toss the potatoes, carrots, onions and garlic with the oil, herbs and seasoning in a large roasting tin.", "Nestle in the chicken thighs, season, and roast for 40–45 minutes, turning the veg halfway, until the chicken is cooked through and golden.", "Boil or steam the broccoli for the last 5 minutes and serve."],
  },
  {
    id: "slow-cooker-beef-stew", name: "Slow-cooker beef & carrot stew", cuisine: "british", serves: 6, prep: 20, cook: 480, emoji: "🍲", hue: 18,
    desc: "Put it on in the morning, come home to tender beef in rich gravy. Freezes brilliantly.",
    tags: ["batch-cook", "comfort"], eq: ["slow-cooker", "hob"], keeps: 3, freeze: true, storage: `${FRIDGE_3} ${FREEZE_3M}`,
    ing: [["diced-beef", 800, "g"], ["plain-flour", 2, "tbsp"], ["vegetable-oil", 1, "tbsp"], ["onion", 2, "item", "chunked"], ["carrot", 4, "item", "thick slices"], ["celery", 2, "stick", "sliced"], ["potatoes", 600, "g", "chunked"], ["tomato-puree", 2, "tbsp"], ["beef-stock-cube", 2, "cube", "made up with 600ml water"], ["worcestershire-sauce", 1, "tbsp"], ["dried-thyme", 1, "tsp"], ["bread", 6, "slice", "to serve", true]],
    steps: ["Toss the beef in the flour and seasoning. Brown in batches in the oil in a frying pan.", "Put everything except the bread into the slow cooker and stir.", "Cook on low for 8 hours (or high for 5) until the beef is very tender.", "Season and serve with crusty bread."],
    subs: [["worcestershire-sauce", [["soy-sauce", "Soy sauce (fish-free)"]]]],
  },
  {
    id: "squash-chickpea-tagine", name: "Butternut squash & chickpea tagine", cuisine: "moroccan", serves: 4, prep: 15, cook: 35, emoji: "🎃", hue: 30,
    desc: "Warmly spiced and gently sweet with apricots. Served with herby couscous.",
    tags: ["healthy", "batch-cook"], keeps: 3, freeze: true, storage: `${FRIDGE_3} ${FREEZE_3M}`,
    ing: [["olive-oil", 1, "tbsp"], ["onion", 1, "item", "chopped"], ["garlic", 2, "clove", "crushed"], ["ground-cumin", 2, "tsp"], ["cinnamon", 1, "tsp"], ["smoked-paprika", 1, "tsp"], ["butternut-squash", 700, "g", "peeled and chunked"], ["chopped-tomatoes", 1, "tin"], ["chickpeas", 1, "tin", "drained"], ["dried-apricots", 80, "g", "chopped"], ["veg-stock-cube", 1, "cube", "made up with 400ml water"], ["couscous", 250, "g"], ["fresh-coriander", 15, "g", "chopped", true]],
    steps: ["Soften the onion in the oil for 5 minutes, then add the garlic and spices for 1 minute.", "Add the squash, tomatoes, chickpeas, apricots and stock. Cover and simmer for 25 minutes until the squash is tender.", "Pour 300ml boiling water over the couscous, cover for 5 minutes and fluff up.", "Season the tagine and serve over couscous with coriander."],
    subs: [["butternut-squash", [["sweet-potato", "Sweet potato"]]], ["couscous", [["rice", "Rice (gluten-free)"]]]],
  },
  {
    id: "garlic-prawn-linguine", name: "Garlic prawn & cherry tomato linguine", cuisine: "italian", serves: 4, prep: 10, cook: 15, emoji: "🦐", hue: 8,
    desc: "Fresh, zingy and on the table in 25 minutes.",
    tags: ["quick"],
    ing: [["spaghetti", 320, "g", "linguine or spaghetti"], ["olive-oil", 2, "tbsp"], ["garlic", 3, "clove", "sliced"], ["chilli-flakes", 0.5, "tsp"], ["cherry-tomatoes", 250, "g", "halved"], ["prawns", 250, "g", "defrosted"], ["lemon", 1, "item"], ["fresh-parsley", 15, "g", "chopped"]],
    steps: ["Cook the pasta according to the pack. Keep a mugful of cooking water.", "Gently cook the garlic and chilli in the oil for 1 minute, then add the tomatoes for 3 minutes until softening.", "Add the prawns and cook for 3–4 minutes until pink all the way through.", "Toss with the pasta, lemon juice, parsley and a splash of pasta water."],
  },
  {
    id: "spanish-tortilla", name: "Spanish potato tortilla", cuisine: "spanish", meal: ["dinner", "lunch"], serves: 4, prep: 15, cook: 30, emoji: "🥚", hue: 50,
    desc: "Thick potato and onion omelette, good hot or cold the next day.",
    tags: ["budget"], level: "medium", keeps: 2, storage: "Keeps 2 days in the fridge. Lovely cold in a lunchbox.",
    ing: [["olive-oil", 4, "tbsp"], ["potatoes", 600, "g", "peeled and thinly sliced"], ["onion", 1, "item", "thinly sliced"], ["eggs", 6, "item"], ["salad-leaves", 100, "g", "to serve"], ["cherry-tomatoes", 150, "g", "to serve", true]],
    steps: ["Gently cook the potatoes and onion in the oil in a non-stick frying pan, covered, for 15–20 minutes until tender but not browned.", "Beat the eggs with seasoning, add the potatoes and onion and leave for 5 minutes.", "Return to the pan over a low heat and cook for 8 minutes until almost set.", "Flip onto a plate and slide back in to cook the other side for 3 minutes (or finish under the grill). Serve with salad."],
  },
  {
    id: "pesto-pasta-peas", name: "Pesto pasta with peas & green beans", cuisine: "italian", serves: 4, prep: 5, cook: 12, emoji: "🌿", hue: 100,
    desc: "The ultimate 15-minute dinner.",
    tags: ["quick", "family-friendly"],
    ing: [["pasta", 350, "g"], ["green-beans", 150, "g", "halved"], ["frozen-peas", 150, "g"], ["pesto", 120, "g"], ["lemon", 0.5, "item"], ["parmesan", 30, "g", "grated", true]],
    steps: ["Cook the pasta according to the pack, adding the green beans for the last 4 minutes and the peas for the last 2.", "Drain, keeping a splash of water. Stir through the pesto, lemon juice and a little pasta water.", "Serve with grated cheese."],
    subs: [["pesto", [[null, "Vegan pesto (check for nuts)"]]], ["parmesan", [["veggie-hard-cheese", "Vegetarian hard cheese"]]]],
  },
  {
    id: "peanut-tofu-noodles", name: "Peanut tofu noodles", cuisine: "thai", serves: 4, prep: 15, cook: 15, emoji: "🥜", hue: 32,
    desc: "Crispy tofu and crunchy veg in a creamy lime-peanut sauce.",
    tags: ["healthy"],
    ing: [["tofu", 280, "g", "pressed and cubed"], ["vegetable-oil", 2, "tbsp"], ["rice-noodles", 250, "g"], ["peanut-butter", 4, "tbsp"], ["soy-sauce", 3, "tbsp"], ["lime", 1, "item"], ["maple-syrup", 1, "tbsp"], ["garlic", 1, "clove", "crushed"], ["bell-pepper", 1, "item", "sliced"], ["carrot", 2, "item", "cut into matchsticks"], ["spring-onion", 3, "item", "sliced"]],
    steps: ["Fry the tofu in the oil for 8–10 minutes until golden on all sides.", "Soak or cook the noodles according to the pack.", "Whisk the peanut butter, soy sauce, lime juice, maple syrup and garlic with 4 tbsp hot water.", "Stir-fry the pepper and carrot for 2 minutes, add the noodles, tofu and sauce, and toss. Top with spring onions."],
    subs: [["soy-sauce", [["tamari", "Tamari (gluten-free)"]]], ["peanut-butter", [[null, "Sunflower seed butter (peanut-free)", "Check the label for cross-contamination."]]]],
  },
  {
    id: "jerk-chicken-rice-peas", name: "Jerk chicken with rice & peas", cuisine: "caribbean", serves: 4, prep: 15, cook: 35, emoji: "🍗", hue: 15,
    desc: "Spicy roast jerk chicken with coconut rice and kidney beans.",
    tags: ["family-friendly"], eq: ["oven", "hob"],
    ing: [["chicken-thighs", 700, "g"], ["jerk-seasoning", 2, "tbsp"], ["lime", 1, "item"], ["vegetable-oil", 1, "tbsp"], ["rice", 280, "g"], ["coconut-milk", 1, "tin"], ["kidney-beans", 1, "tin", "drained"], ["spring-onion", 4, "item", "sliced"], ["dried-thyme", 1, "tsp"], ["salad-leaves", 80, "g", "to serve", true]],
    steps: ["Rub the chicken with the jerk seasoning, oil and lime juice. Marinate for as long as you have.", "Roast at 200°C (180°C fan) for 30–35 minutes until cooked through and charred.", "Put the rice, coconut milk, 250ml water, kidney beans, thyme and half the spring onions in a pan. Bring to the boil, cover and simmer gently for 15–18 minutes until the liquid is absorbed.", "Serve the chicken with the rice and peas, scattered with the remaining spring onions."],
  },
  {
    id: "fish-pie", name: "Easy fish pie", cuisine: "british", serves: 4, prep: 20, cook: 40, emoji: "🐠", hue: 205,
    desc: "Flaky fish in a creamy parsley sauce under cheesy mash.",
    tags: ["family-friendly", "comfort"], eq: ["hob", "oven"], level: "medium", keeps: 2, storage: "Keeps 2 days in the fridge. Reheat until piping hot.",
    ing: [["potatoes", 900, "g", "chunked"], ["butter", 50, "g"], ["milk", 500, "ml"], ["plain-flour", 30, "g"], ["fish-pie-mix", 320, "g"], ["frozen-peas", 150, "g"], ["fresh-parsley", 10, "g", "chopped"], ["cheddar", 40, "g", "grated"], ["lemon", 0.5, "item"]],
    steps: ["Boil the potatoes until tender, then mash with a third of the butter and a splash of the milk.", "Melt the remaining butter, stir in the flour, then whisk in the rest of the milk. Simmer until thick. Add parsley, lemon and seasoning.", "Heat the oven to 200°C (180°C fan). Put the fish and peas in a baking dish, pour over the sauce and top with mash and cheese.", "Bake for 30 minutes until golden and bubbling, and the fish is cooked through."],
  },
  {
    id: "cauliflower-cheese-bake", name: "Cauliflower & broccoli cheese", cuisine: "british", serves: 4, prep: 15, cook: 30, emoji: "🥦", hue: 52,
    desc: "Golden cheesy veg bake – lovely as a veggie main with crusty bread.",
    tags: ["comfort", "family-friendly"], eq: ["hob", "oven"],
    ing: [["cauliflower", 1, "item", "florets"], ["broccoli", 350, "g", "florets"], ["butter", 40, "g"], ["plain-flour", 40, "g"], ["milk", 600, "ml"], ["cheddar", 150, "g", "grated"], ["breadcrumbs", 30, "g"], ["bread", 4, "slice", "to serve", true]],
    steps: ["Heat the oven to 200°C (180°C fan). Boil the cauliflower and broccoli for 5 minutes, then drain well.", "Melt the butter, stir in the flour, then whisk in the milk. Simmer until thick, then stir in most of the cheese.", "Put the veg in a baking dish, pour over the sauce and top with breadcrumbs and the remaining cheese.", "Bake for 20–25 minutes until golden."],
  },
  {
    id: "bacon-pea-orzo", name: "Bacon, pea & spinach orzo", cuisine: "italian", serves: 4, prep: 5, cook: 20, emoji: "🥓", hue: 5,
    desc: "One-pan pasta that cooks in its own stock – creamy without any cream.",
    tags: ["quick", "one-pot"],
    ing: [["bacon", 6, "rasher", "chopped"], ["onion", 1, "item", "finely chopped"], ["garlic", 2, "clove", "crushed"], ["pasta", 300, "g", "orzo"], ["chicken-stock-cube", 1, "cube", "made up with 900ml water"], ["frozen-peas", 200, "g"], ["spinach", 100, "g"], ["veggie-hard-cheese", 40, "g", "grated"], ["lemon", 0.5, "item"]],
    steps: ["Fry the bacon in a deep frying pan until crisp, then add the onion for 5 minutes and the garlic for 1 minute.", "Add the orzo and stock. Simmer for 10–12 minutes, stirring often, until the orzo is tender and most of the liquid is absorbed.", "Stir in the peas and spinach for 2 minutes, then the cheese and lemon juice. Season and serve."],
  },
  {
    id: "chicken-tikka-traybake", name: "Yoghurt-spiced chicken tikka traybake", cuisine: "indian", serves: 4, prep: 15, cook: 35, emoji: "🍢", hue: 10,
    desc: "Tandoori-style chicken and veg roasted together, with naan and cooling yoghurt.",
    tags: ["family-friendly"], eq: ["oven"],
    ing: [["chicken-thighs", 600, "g"], ["yoghurt", 150, "g"], ["garam-masala", 2, "tsp"], ["turmeric", 1, "tsp"], ["chilli-powder", 1, "tsp"], ["garlic", 2, "clove", "crushed"], ["ginger", 10, "g", "grated"], ["bell-pepper", 2, "item", "chunked"], ["red-onion", 2, "item", "wedges"], ["cauliflower", 0.5, "item", "florets"], ["vegetable-oil", 1, "tbsp"], ["naan", 4, "item"], ["cucumber", 0.5, "item", "to serve"], ["fresh-mint", 10, "g", undefined, true]],
    steps: ["Mix half the yoghurt with the spices, garlic and ginger. Coat the chicken and marinate for at least 15 minutes.", "Heat the oven to 220°C (200°C fan). Toss the veg with the oil on a large tray and add the chicken.", "Roast for 30–35 minutes until the chicken is cooked through and charred at the edges.", "Mix the remaining yoghurt with grated cucumber and mint. Serve with warm naan."],
  },

  /* ============================ LUNCHES ============================ */
  {
    id: "hummus-veg-wraps", name: "Houmous & crunchy veg wraps", cuisine: "middle-eastern", meal: ["lunch"], serves: 2, prep: 10, cook: 0, emoji: "🥙", hue: 90,
    desc: "No-cook lunch that's endlessly adaptable.",
    tags: ["quick", "healthy", "no-cook"], eq: [],
    ing: [["tortilla-wraps", 2, "item"], ["hummus", 100, "g"], ["carrot", 1, "item", "grated"], ["cucumber", 0.25, "item", "sliced"], ["salad-leaves", 40, "g"], ["bell-pepper", 0.5, "item", "sliced"]],
    steps: ["Spread each wrap with houmous.", "Layer with the leaves, carrot, cucumber and pepper, season, and roll up tightly."],
  },
  {
    id: "tuna-sweetcorn-sandwich", name: "Tuna sweetcorn sandwiches", cuisine: "british", meal: ["lunch"], serves: 2, prep: 10, cook: 0, emoji: "🥪", hue: 45,
    desc: "A lunchbox classic.",
    tags: ["quick", "budget", "no-cook"], eq: [],
    ing: [["bread", 4, "slice"], ["tuna", 1, "tin", "drained"], ["sweetcorn", 0.5, "tin", "drained"], ["mayonnaise", 2, "tbsp"], ["little-gem", 0.5, "item", "shredded"]],
    steps: ["Mix the tuna, sweetcorn and mayo with some black pepper.", "Fill the bread with the tuna mix and lettuce."],
  },
  {
    id: "leftover-chicken-caesar-wraps", name: "Chicken Caesar-style wraps", cuisine: "american", meal: ["lunch"], serves: 2, prep: 10, cook: 0, emoji: "🌯", hue: 70,
    desc: "Uses up leftover roast chicken in a crunchy, creamy wrap.",
    tags: ["quick", "use-it-up"], eq: [],
    ing: [["chicken-breast", 150, "g", "cooked, shredded"], ["tortilla-wraps", 2, "item"], ["little-gem", 1, "item", "shredded"], ["mayonnaise", 2, "tbsp"], ["lemon", 0.25, "item"], ["veggie-hard-cheese", 15, "g", "grated"]],
    steps: ["Mix the mayo with a squeeze of lemon, the cheese and plenty of black pepper.", "Toss with the lettuce and chicken and pile into the wraps. Roll up."],
  },
  {
    id: "cheese-tomato-toastie", name: "Cheese & tomato toasties", cuisine: "british", meal: ["lunch"], serves: 2, prep: 5, cook: 8, emoji: "🥪", hue: 40,
    desc: "Golden, oozy and ready in ten minutes.",
    tags: ["quick", "family-friendly"],
    ing: [["bread", 4, "slice"], ["cheddar", 80, "g", "grated"], ["tomato", 1, "item", "sliced"], ["butter", 15, "g", "softened"]],
    steps: ["Butter the outsides of the bread. Fill with cheese and tomato.", "Cook in a frying pan over a medium heat for 3–4 minutes each side, pressing down, until golden and melted."],
  },
  {
    id: "spiced-lentil-soup", name: "Spiced carrot & lentil soup", cuisine: "middle-eastern", meal: ["lunch", "dinner"], serves: 4, prep: 10, cook: 25, emoji: "🥕", hue: 28,
    desc: "Thick, warming and very cheap. A great freezer standby.",
    tags: ["budget", "healthy", "batch-cook"], eq: ["hob", "blender"], keeps: 4, freeze: true, storage: `Keeps 4 days in the fridge. ${FREEZE_3M}`,
    ing: [["olive-oil", 1, "tbsp"], ["onion", 1, "item", "chopped"], ["carrot", 4, "item", "grated"], ["cumin-seeds", 1, "tsp"], ["chilli-flakes", 0.25, "tsp"], ["red-lentils", 140, "g"], ["veg-stock-cube", 1, "cube", "made up with 1 litre water"], ["yoghurt", 4, "tbsp", "to serve", true], ["bread", 4, "slice", "to serve", true]],
    steps: ["Toast the cumin seeds and chilli in the oil for 30 seconds, then add the onion for 5 minutes.", "Add the carrots, lentils and stock. Simmer for 20 minutes until the lentils are soft.", "Blend until smooth, season, and serve with a swirl of yoghurt and bread."],
  },

  /* ============================ BREAKFASTS ============================ */
  {
    id: "banana-honey-porridge", name: "Banana & honey porridge", cuisine: "british", meal: ["breakfast"], serves: 2, prep: 2, cook: 6, emoji: "🥣", hue: 45,
    desc: "Creamy oats topped with sliced banana and a drizzle of honey.",
    tags: ["quick", "budget", "healthy"],
    ing: [["oats", 100, "g"], ["milk", 500, "ml"], ["banana", 1, "item", "sliced"], ["honey", 2, "tsp"], ["cinnamon", 1, "pinch", undefined, true]],
    steps: ["Put the oats and milk in a pan with a pinch of salt and bring to the boil.", "Simmer for 4–5 minutes, stirring, until thick and creamy.", "Top with banana, honey and a pinch of cinnamon."],
    subs: [["milk", [[null, "Oat or soya drink (dairy-free)"]]], ["honey", [["maple-syrup", "Maple syrup (vegan)"]]]],
  },
  {
    id: "berry-overnight-oats", name: "Berry overnight oats", cuisine: "british", meal: ["breakfast"], serves: 2, prep: 5, cook: 0, emoji: "🫐", hue: 260,
    desc: "Make the night before for a grab-and-go breakfast.",
    tags: ["quick", "healthy", "no-cook"], eq: [], keeps: 2, storage: "Keeps 2 days in the fridge.",
    ing: [["oats", 80, "g"], ["yoghurt", 150, "g"], ["milk", 150, "ml"], ["frozen-berries", 120, "g"], ["honey", 2, "tsp", undefined, true]],
    steps: ["Mix the oats, yoghurt and milk and divide between two jars.", "Top with the frozen berries (they'll defrost overnight) and chill.", "Drizzle with honey in the morning."],
  },
  {
    id: "scrambled-eggs-toast", name: "Scrambled eggs on toast", cuisine: "british", meal: ["breakfast", "lunch"], serves: 2, prep: 2, cook: 5, emoji: "🍳", hue: 50,
    desc: "Soft, creamy eggs on buttered wholemeal toast.",
    tags: ["quick"],
    ing: [["eggs", 4, "item"], ["butter", 15, "g"], ["milk", 2, "tbsp"], ["bread", 4, "slice"], ["cherry-tomatoes", 100, "g", "to serve", true]],
    steps: ["Beat the eggs with the milk and seasoning.", "Melt half the butter in a pan over a low heat, add the eggs and stir gently until just set.", "Serve on buttered toast with tomatoes."],
  },
  {
    id: "banana-pancakes", name: "Fluffy banana pancakes", cuisine: "american", meal: ["breakfast"], serves: 4, prep: 10, cook: 15, emoji: "🥞", hue: 38,
    desc: "A weekend treat that uses up ripe bananas.",
    tags: ["family-friendly", "use-it-up"],
    ing: [["plain-flour", 150, "g"], ["baking-powder", 2, "tsp"], ["eggs", 1, "item"], ["milk", 200, "ml"], ["banana", 2, "item", "very ripe, mashed"], ["vegetable-oil", 1, "tbsp"], ["frozen-berries", 150, "g", "to serve", true], ["maple-syrup", 2, "tbsp", "to serve", true]],
    steps: ["Whisk the flour and baking powder with the egg, milk and mashed banana to a thick batter.", "Heat a little oil in a non-stick pan and cook ladlefuls for 2 minutes each side until golden.", "Serve with berries and maple syrup."],
  },
  {
    id: "shakshuka", name: "Shakshuka", cuisine: "middle-eastern", meal: ["breakfast", "lunch", "dinner"], serves: 2, prep: 10, cook: 20, emoji: "🍅", hue: 5,
    desc: "Eggs gently cooked in a spiced pepper and tomato sauce. Great for brunch or a light dinner.",
    tags: ["healthy", "budget", "one-pot"],
    ing: [["olive-oil", 1, "tbsp"], ["onion", 1, "item", "sliced"], ["bell-pepper", 1, "item", "sliced"], ["garlic", 2, "clove", "crushed"], ["ground-cumin", 1, "tsp"], ["smoked-paprika", 1, "tsp"], ["chopped-tomatoes", 1, "tin"], ["eggs", 4, "item"], ["feta", 50, "g", "crumbled", true], ["fresh-coriander", 5, "g", undefined, true], ["bread", 2, "slice", "to serve"]],
    steps: ["Soften the onion and pepper in the oil for 8 minutes, then add the garlic and spices for 1 minute.", "Add the tomatoes and simmer for 8 minutes until thickened. Season.", "Make four wells and crack in the eggs. Cover and cook gently for 6–8 minutes until the whites are set.", "Scatter with feta and coriander and serve with bread."],
  },
];

export const SEED_RECIPES: Recipe[] = R.map(build);
