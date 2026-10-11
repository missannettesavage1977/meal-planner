import type { Allergen, BaseUnit, Category, DietLevel, IngredientDef } from "../domain/types";

/**
 * Canonical ingredient catalogue.
 *
 * Every ingredient has a stable id, a canonical base unit and the data needed to
 * convert between units *safely* (typical item weight, density, tin sizes).
 * Conversions not described here are never attempted.
 *
 * `demo` holds illustrative pack prices (in pence) for a mid-priced UK supermarket.
 * They are DEMONSTRATION DATA ONLY – hand-estimated, not checked against any
 * retailer – and are always labelled as such in the UI.
 */

type DemoPack = [size: number, label: string, pence: number];

interface Def {
  name: string;
  plural?: string;
  aliases?: string[];
  cat: Category;
  base: BaseUnit;
  itemLabel?: string;
  itemLabelPlural?: string;
  gpi?: number; // grams per item
  density?: number; // g per ml
  units?: Record<string, number>;
  allergens?: Allergen[];
  may?: Allergen[];
  diet?: DietLevel;
  tags?: string[];
  shelf: number;
  staple?: boolean;
  protein?: string;
  demo: DemoPack[];
  note?: string;
}

const GROUND_SPICE = 0.5; // g per ml (1 tsp ≈ 2.5 g)
const DRIED_HERB = 0.2; // g per ml (1 tsp ≈ 1 g)
const CHOPPED_HERB = 0.13; // g per ml of loosely packed chopped fresh herbs
const JAR = (g: number, pence = 95): DemoPack[] => [[g, `${g}g jar`, pence]];
const HERB_PACK: DemoPack[] = [[30, "30g pack", 75]];

const defs: Record<string, Def> = {
  /* ---------------- Fruit & veg ---------------- */
  onion: { name: "onion", plural: "onions", aliases: ["brown onion", "white onion", "yellow onion", "cooking onion"], cat: "Fruit & veg", base: "item", gpi: 150, shelf: 30, demo: [[1, "loose", 18], [7, "1kg bag (about 7)", 89]] },
  "red-onion": { name: "red onion", plural: "red onions", aliases: ["purple onion"], cat: "Fruit & veg", base: "item", gpi: 150, shelf: 30, demo: [[1, "loose", 25], [3, "3 pack", 85]] },
  garlic: { name: "garlic", aliases: ["garlic clove", "clove of garlic", "cloves garlic"], cat: "Fruit & veg", base: "item", itemLabel: "clove", itemLabelPlural: "cloves", gpi: 5, units: { clove: 1, bulb: 10, head: 10 }, shelf: 30, demo: [[10, "bulb (about 10 cloves)", 35], [40, "4 bulbs", 99]] },
  ginger: { name: "fresh ginger", aliases: ["ginger", "root ginger", "ginger root"], cat: "Fruit & veg", base: "g", units: { cm: 5, thumb: 15, "thumb-sized piece": 15 }, density: 0.6, shelf: 21, demo: [[100, "piece (about 100g)", 55]] },
  carrot: { name: "carrot", plural: "carrots", cat: "Fruit & veg", base: "item", gpi: 80, shelf: 21, demo: [[1, "loose", 8], [12, "1kg bag (about 12)", 65]] },
  celery: { name: "celery", aliases: ["celery stick", "celery sticks", "stick of celery", "sticks celery"], cat: "Fruit & veg", base: "item", itemLabel: "stick", itemLabelPlural: "sticks", gpi: 40, units: { stick: 1, head: 9 }, allergens: ["celery"], shelf: 14, demo: [[9, "head (about 9 sticks)", 69]] },
  "bell-pepper": { name: "pepper", plural: "peppers", aliases: ["red pepper", "green pepper", "yellow pepper", "orange pepper", "bell pepper", "sweet pepper", "capsicum", "mixed pepper"], cat: "Fruit & veg", base: "item", gpi: 160, shelf: 10, demo: [[1, "loose", 55], [3, "3 pack mixed", 125]] },
  broccoli: { name: "broccoli", aliases: ["broccoli head", "head of broccoli", "broccoli floret", "tenderstem"], cat: "Fruit & veg", base: "g", units: { head: 350 }, gpi: 350, shelf: 6, demo: [[350, "head (about 350g)", 69]] },
  spinach: { name: "spinach", aliases: ["baby spinach", "spinach leaf", "fresh spinach"], cat: "Fruit & veg", base: "g", units: { handful: 30 }, shelf: 4, demo: [[240, "240g bag", 115]] },
  "spring-onion": { name: "spring onion", plural: "spring onions", aliases: ["scallion", "green onion", "salad onion"], cat: "Fruit & veg", base: "item", gpi: 15, units: { bunch: 8 }, shelf: 7, demo: [[8, "bunch (about 8)", 55]] },
  mushrooms: { name: "mushrooms", aliases: ["mushroom", "button mushroom", "chestnut mushroom", "closed cup mushroom"], cat: "Fruit & veg", base: "g", gpi: 20, shelf: 5, demo: [[300, "300g punnet", 95], [500, "500g pack", 145]] },
  courgette: { name: "courgette", plural: "courgettes", aliases: ["zucchini"], cat: "Fruit & veg", base: "item", gpi: 250, shelf: 7, demo: [[1, "loose", 45], [3, "3 pack", 119]] },
  leek: { name: "leek", plural: "leeks", cat: "Fruit & veg", base: "item", gpi: 200, shelf: 10, demo: [[1, "loose", 55], [3, "500g pack (about 3)", 99]] },
  potatoes: { name: "potatoes", aliases: ["potato", "white potato", "maris piper", "maris piper potato", "floury potato", "king edward"], cat: "Fruit & veg", base: "g", gpi: 175, shelf: 21, demo: [[2000, "2kg bag", 135], [2500, "2.5kg bag", 165]] },
  "new-potatoes": { name: "new potatoes", aliases: ["new potato", "baby potato", "baby new potato", "salad potato"], cat: "Fruit & veg", base: "g", gpi: 40, shelf: 10, demo: [[1000, "1kg bag", 115]] },
  "baking-potato": { name: "baking potato", plural: "baking potatoes", aliases: ["jacket potato"], cat: "Fruit & veg", base: "item", gpi: 250, shelf: 21, demo: [[1, "loose", 30], [4, "4 pack", 99]] },
  "sweet-potato": { name: "sweet potatoes", aliases: ["sweet potato"], cat: "Fruit & veg", base: "g", gpi: 300, shelf: 14, demo: [[1000, "1kg bag", 125]] },
  "butternut-squash": { name: "butternut squash", aliases: ["squash"], cat: "Fruit & veg", base: "g", gpi: 1000, shelf: 30, demo: [[1000, "whole squash (about 1kg)", 110]] },
  cauliflower: { name: "cauliflower", plural: "cauliflowers", cat: "Fruit & veg", base: "item", gpi: 700, units: { head: 1 }, shelf: 7, demo: [[1, "whole", 99]] },
  "green-beans": { name: "green beans", aliases: ["green bean", "fine bean", "fine green bean", "french bean"], cat: "Fruit & veg", base: "g", shelf: 5, demo: [[220, "220g pack", 99]] },
  "cherry-tomatoes": { name: "cherry tomatoes", aliases: ["cherry tomato", "baby plum tomato"], cat: "Fruit & veg", base: "g", gpi: 15, shelf: 7, demo: [[250, "250g punnet", 85]] },
  tomato: { name: "tomato", plural: "tomatoes", aliases: ["salad tomato", "vine tomato", "large tomato", "fresh tomato"], cat: "Fruit & veg", base: "item", gpi: 85, shelf: 7, demo: [[1, "loose", 17], [6, "6 pack", 75]] },
  "little-gem": { name: "little gem lettuce", plural: "little gem lettuces", aliases: ["little gem", "baby gem", "gem lettuce", "lettuce", "romaine"], cat: "Fruit & veg", base: "item", gpi: 90, shelf: 6, demo: [[2, "2 pack", 75]] },
  "salad-leaves": { name: "mixed salad leaves", aliases: ["salad leaf", "mixed leaf", "mixed salad", "salad", "rocket"], cat: "Fruit & veg", base: "g", units: { handful: 20, bag: 120 }, shelf: 4, demo: [[120, "120g bag", 89]] },
  cucumber: { name: "cucumber", plural: "cucumbers", cat: "Fruit & veg", base: "item", gpi: 350, shelf: 7, demo: [[1, "whole", 65]] },
  lemon: { name: "lemon", plural: "lemons", aliases: ["lemon juice", "juice of lemon", "lemon zest"], cat: "Fruit & veg", base: "item", gpi: 100, units: { tbsp: 0.5, tsp: 0.17 }, shelf: 21, demo: [[1, "loose", 30], [4, "4 pack", 99]], note: "1 lemon gives roughly 2 tbsp juice. Bottled lemon juice can stand in at about 2 tbsp per lemon." },
  lime: { name: "lime", plural: "limes", aliases: ["lime juice", "juice of lime"], cat: "Fruit & veg", base: "item", gpi: 70, units: { tbsp: 0.75, tsp: 0.25 }, shelf: 21, demo: [[1, "loose", 28], [4, "4 pack", 89]] },
  banana: { name: "banana", plural: "bananas", cat: "Fruit & veg", base: "item", gpi: 120, shelf: 5, demo: [[1, "loose", 15], [5, "5 pack", 79]] },
  "red-chilli": { name: "red chilli", plural: "red chillies", aliases: ["fresh chilli", "chilli", "fresh red chilli", "green chilli"], cat: "Fruit & veg", base: "item", gpi: 10, shelf: 10, demo: [[5, "50g pack (about 5)", 60]] },
  avocado: { name: "avocado", plural: "avocados", cat: "Fruit & veg", base: "item", gpi: 170, shelf: 4, demo: [[1, "loose", 69], [2, "2 pack", 129]] },
  apple: { name: "apple", plural: "apples", aliases: ["eating apple", "braeburn", "gala apple"], cat: "Fruit & veg", base: "item", gpi: 150, shelf: 21, demo: [[1, "loose", 30], [6, "6 pack", 125]] },

  /* ---------------- Fresh herbs (never merged with dried) ---------------- */
  "fresh-coriander": { name: "fresh coriander", aliases: ["coriander", "coriander leaf", "cilantro", "fresh cilantro", "coriander bunch"], cat: "Fresh herbs", base: "g", density: CHOPPED_HERB, units: { bunch: 30, handful: 10, sprig: 1 }, shelf: 5, demo: HERB_PACK },
  "fresh-parsley": { name: "fresh flat-leaf parsley", aliases: ["parsley", "flat leaf parsley", "flat-leaf parsley", "fresh parsley", "curly parsley"], cat: "Fresh herbs", base: "g", density: CHOPPED_HERB, units: { bunch: 30, handful: 10, sprig: 1 }, shelf: 5, demo: HERB_PACK },
  "fresh-basil": { name: "fresh basil", aliases: ["basil", "basil leaf", "basil leaves"], cat: "Fresh herbs", base: "g", density: CHOPPED_HERB, units: { bunch: 30, handful: 10, sprig: 1 }, shelf: 5, demo: HERB_PACK },
  "fresh-mint": { name: "fresh mint", aliases: ["mint", "mint leaf"], cat: "Fresh herbs", base: "g", density: CHOPPED_HERB, units: { bunch: 30, handful: 10, sprig: 1 }, shelf: 5, demo: HERB_PACK },

  /* ---------------- Meat & poultry ---------------- */
  "chicken-breast": { name: "chicken breast fillets", aliases: ["chicken breast", "chicken breast fillet", "skinless chicken breast", "chicken fillet"], cat: "Meat & poultry", base: "g", gpi: 160, diet: "meat", protein: "chicken", shelf: 3, demo: [[300, "300g pack (2)", 275], [650, "650g pack", 485], [1000, "1kg pack", 650]] },
  "chicken-thighs": { name: "boneless chicken thighs", aliases: ["chicken thigh", "chicken thigh fillet", "boneless skinless chicken thigh", "chicken thigh fillets"], cat: "Meat & poultry", base: "g", gpi: 85, diet: "meat", protein: "chicken", shelf: 3, demo: [[500, "500g pack", 329], [1000, "1kg pack", 575]] },
  "beef-mince": { name: "beef mince", aliases: ["minced beef", "lean beef mince", "ground beef", "steak mince"], cat: "Meat & poultry", base: "g", diet: "meat", tags: ["beef"], protein: "beef", shelf: 3, demo: [[500, "500g pack", 325], [750, "750g pack", 459], [1000, "1kg pack", 590]] },
  "lamb-mince": { name: "lamb mince", aliases: ["minced lamb", "ground lamb"], cat: "Meat & poultry", base: "g", diet: "meat", protein: "lamb", shelf: 3, demo: [[500, "500g pack", 450]] },
  "pork-mince": { name: "pork mince", aliases: ["minced pork", "ground pork"], cat: "Meat & poultry", base: "g", diet: "meat", tags: ["pork"], protein: "pork", shelf: 3, demo: [[500, "500g pack", 299]] },
  "pork-sausages": { name: "pork sausages", aliases: ["sausage", "pork sausage", "cumberland sausage", "lincolnshire sausage"], cat: "Meat & poultry", base: "item", itemLabel: "sausage", itemLabelPlural: "sausages", gpi: 57, diet: "meat", tags: ["pork"], protein: "pork", allergens: ["gluten", "sulphites"], shelf: 5, demo: [[6, "6 pack", 175], [8, "8 pack", 210]], note: "Most sausages contain wheat rusk and sulphites – check the label." },
  "diced-beef": { name: "diced stewing beef", aliases: ["stewing beef", "braising steak", "diced beef", "beef chunk"], cat: "Meat & poultry", base: "g", diet: "meat", tags: ["beef"], protein: "beef", shelf: 3, demo: [[400, "400g pack", 425], [800, "800g pack", 799]] },
  bacon: { name: "smoked back bacon", aliases: ["bacon", "back bacon", "streaky bacon", "bacon rasher", "smoked bacon", "lardon"], cat: "Meat & poultry", base: "item", itemLabel: "rasher", itemLabelPlural: "rashers", gpi: 25, units: { rasher: 1 }, diet: "meat", tags: ["pork"], protein: "pork", allergens: [], shelf: 7, demo: [[10, "300g pack (about 10 rashers)", 225]] },

  /* ---------------- Fish & seafood ---------------- */
  "salmon-fillets": { name: "salmon fillets", aliases: ["salmon fillet", "salmon", "skin-on salmon fillet"], cat: "Fish & seafood", base: "g", gpi: 120, diet: "pescatarian", protein: "fish", allergens: ["fish"], shelf: 3, demo: [[240, "2 fillets (240g)", 399], [480, "4 fillets (480g)", 725]] },
  "fish-fingers": { name: "fish fingers", aliases: ["fish finger"], cat: "Frozen", base: "item", gpi: 28, diet: "pescatarian", protein: "fish", allergens: ["fish", "gluten"], shelf: 180, demo: [[10, "10 pack", 135], [20, "20 pack", 250]] },
  tuna: { name: "tinned tuna", aliases: ["tuna", "tuna chunk", "tuna in spring water", "canned tuna", "tin of tuna"], cat: "Tins & jars", base: "g", units: { tin: 102, can: 102 }, diet: "pescatarian", protein: "fish", allergens: ["fish"], shelf: 730, demo: [[102, "145g tin (102g drained)", 99], [408, "4 × 145g tins", 349]] },
  prawns: { name: "frozen raw king prawns", aliases: ["king prawn", "prawn", "raw prawn", "shrimp", "raw king prawn"], cat: "Frozen", base: "g", diet: "pescatarian", protein: "seafood", allergens: ["crustaceans"], shelf: 180, demo: [[250, "250g bag", 375]] },
  "fish-pie-mix": { name: "fish pie mix", aliases: ["fish pie fish", "fish pie mix fillet"], cat: "Fish & seafood", base: "g", diet: "pescatarian", protein: "fish", allergens: ["fish"], shelf: 3, demo: [[320, "320g pack", 400]] },

  /* ---------------- Dairy, eggs & chilled ---------------- */
  eggs: { name: "eggs", aliases: ["egg", "free range egg", "large egg", "medium egg", "egg yolk", "beaten egg"], cat: "Dairy & eggs", base: "item", gpi: 58, diet: "vegetarian", allergens: ["eggs"], shelf: 21, demo: [[6, "6 medium free range", 145], [12, "12 medium free range", 275]] },
  milk: { name: "milk", aliases: ["semi-skimmed milk", "whole milk", "skimmed milk", "semi skimmed milk"], cat: "Dairy & eggs", base: "ml", density: 1.03, units: { pint: 568 }, diet: "vegetarian", allergens: ["milk"], shelf: 7, demo: [[1136, "2 pints", 115], [2272, "4 pints", 165]] },
  butter: { name: "butter", aliases: ["unsalted butter", "salted butter", "knob of butter"], cat: "Dairy & eggs", base: "g", density: 0.91, units: { knob: 15 }, diet: "vegetarian", allergens: ["milk"], shelf: 45, demo: [[250, "250g block", 199]] },
  cheddar: { name: "mature cheddar", aliases: ["cheddar", "cheddar cheese", "grated cheddar", "cheese", "grated cheese", "mature cheddar cheese"], cat: "Dairy & eggs", base: "g", units: { handful: 30 }, density: 0.4, diet: "vegetarian", allergens: ["milk"], shelf: 28, demo: [[200, "200g block", 199], [400, "400g block", 315]] },
  mozzarella: { name: "mozzarella", aliases: ["mozzarella ball", "mozzarella cheese"], cat: "Dairy & eggs", base: "g", units: { ball: 125 }, diet: "vegetarian", allergens: ["milk"], shelf: 10, demo: [[125, "125g ball", 65]] },
  parmesan: { name: "parmesan", aliases: ["parmigiano reggiano", "parmigiano", "grana padano"], cat: "Dairy & eggs", base: "g", density: 0.35, diet: "pescatarian", allergens: ["milk"], shelf: 30, demo: [[100, "100g wedge", 199]], note: "Parmesan and Grana Padano are made with animal rennet, so are not vegetarian." },
  "veggie-hard-cheese": { name: "vegetarian Italian-style hard cheese", aliases: ["vegetarian hard cheese", "italian hard cheese", "vegetarian parmesan", "hard cheese"], cat: "Dairy & eggs", base: "g", density: 0.35, diet: "vegetarian", allergens: ["milk"], shelf: 30, demo: [[150, "150g wedge", 189]] },
  halloumi: { name: "halloumi", aliases: ["halloumi cheese"], cat: "Dairy & eggs", base: "g", diet: "vegetarian", allergens: ["milk"], shelf: 30, demo: [[225, "225g block", 225]] },
  feta: { name: "feta", aliases: ["feta cheese", "greek salad cheese"], cat: "Dairy & eggs", base: "g", diet: "vegetarian", allergens: ["milk"], shelf: 21, demo: [[200, "200g block", 149]] },
  "creme-fraiche": { name: "half-fat crème fraîche", aliases: ["creme fraiche", "crème fraîche", "half fat creme fraiche", "half-fat creme fraiche"], cat: "Dairy & eggs", base: "ml", density: 1, diet: "vegetarian", allergens: ["milk"], shelf: 10, demo: [[300, "300ml pot", 105]] },
  yoghurt: { name: "natural yoghurt", aliases: ["yoghurt", "yogurt", "plain yoghurt", "natural yogurt", "greek yoghurt", "greek yogurt", "greek style yoghurt"], cat: "Dairy & eggs", base: "g", density: 1.05, diet: "vegetarian", allergens: ["milk"], shelf: 10, demo: [[500, "500g pot", 99]] },
  "soured-cream": { name: "soured cream", aliases: ["sour cream"], cat: "Dairy & eggs", base: "ml", density: 1, diet: "vegetarian", allergens: ["milk"], shelf: 10, demo: [[300, "300ml pot", 95]] },
  tofu: { name: "firm tofu", aliases: ["tofu", "extra firm tofu"], cat: "Chilled", base: "g", diet: "vegan", protein: "tofu", allergens: ["soya"], shelf: 14, demo: [[280, "280g block", 150]] },
  hummus: { name: "houmous", aliases: ["hummus", "houmous", "humous"], cat: "Chilled", base: "g", density: 1.05, diet: "vegan", allergens: ["sesame"], shelf: 7, demo: [[200, "200g pot", 89]] },

  /* ---------------- Bakery ---------------- */
  "tortilla-wraps": { name: "plain tortilla wraps", aliases: ["tortilla", "tortilla wrap", "wrap", "flour tortilla", "plain wrap", "soft tortilla"], cat: "Bakery", base: "item", gpi: 62, diet: "vegan", allergens: ["gluten"], shelf: 14, demo: [[8, "8 pack", 115]] },
  bread: { name: "wholemeal bread", aliases: ["bread", "sliced bread", "wholemeal loaf", "slice of bread", "toast", "brown bread", "bread slice"], cat: "Bakery", base: "item", itemLabel: "slice", itemLabelPlural: "slices", gpi: 40, units: { slice: 1, loaf: 20 }, diet: "vegan", allergens: ["gluten"], may: ["sesame", "soya"], shelf: 6, demo: [[20, "800g loaf (about 20 slices)", 125]] },
  naan: { name: "plain naan breads", aliases: ["naan", "naan bread", "nan bread"], cat: "Bakery", base: "item", gpi: 130, diet: "vegetarian", allergens: ["gluten", "milk"], shelf: 7, demo: [[2, "2 pack", 99]] },
  "puff-pastry": { name: "ready-rolled puff pastry", aliases: ["puff pastry", "ready rolled puff pastry", "puff pastry sheet"], cat: "Chilled", base: "g", units: { sheet: 320 }, diet: "vegan", allergens: ["gluten"], shelf: 14, demo: [[320, "320g sheet", 125]] },
  breadcrumbs: { name: "dried breadcrumbs", aliases: ["breadcrumb", "panko", "panko breadcrumb"], cat: "Baking & cereals", base: "g", density: 0.45, diet: "vegan", allergens: ["gluten"], shelf: 180, demo: [[200, "200g pack", 85]] },

  /* ---------------- Pasta, rice & grains ---------------- */
  spaghetti: { name: "dried spaghetti", aliases: ["spaghetti", "linguine", "dried linguine", "tagliatelle"], cat: "Pasta, rice & grains", base: "g", diet: "vegan", allergens: ["gluten"], shelf: 365, demo: [[500, "500g pack", 75], [1000, "1kg pack", 135]] },
  pasta: { name: "dried pasta shapes", aliases: ["pasta", "penne", "fusilli", "rigatoni", "macaroni", "pasta shape", "dried pasta", "conchiglie", "orzo", "small pasta shape"], cat: "Pasta, rice & grains", base: "g", density: 0.5, diet: "vegan", allergens: ["gluten"], shelf: 365, demo: [[500, "500g pack", 70], [1000, "1kg pack", 125]] },
  "egg-noodles": { name: "medium egg noodles", aliases: ["egg noodle", "noodle", "noodles", "dried egg noodle"], cat: "World foods", base: "g", units: { nest: 50 }, diet: "vegetarian", allergens: ["gluten", "eggs"], shelf: 365, demo: [[300, "300g pack", 110]] },
  "rice-noodles": { name: "flat rice noodles", aliases: ["rice noodle", "rice noodles", "flat rice noodle"], cat: "World foods", base: "g", diet: "vegan", shelf: 365, demo: [[250, "250g pack", 150]] },
  rice: { name: "basmati rice", aliases: ["rice", "long grain rice", "basmati", "white rice", "cooked rice"], cat: "Pasta, rice & grains", base: "g", density: 0.85, diet: "vegan", shelf: 730, demo: [[500, "500g bag", 115], [1000, "1kg bag", 199]] },
  "arborio-rice": { name: "risotto rice", aliases: ["arborio rice", "arborio", "risotto rice", "carnaroli"], cat: "Pasta, rice & grains", base: "g", density: 0.85, diet: "vegan", shelf: 730, demo: [[500, "500g bag", 155]] },
  couscous: { name: "couscous", aliases: ["cous cous"], cat: "Pasta, rice & grains", base: "g", density: 0.7, diet: "vegan", allergens: ["gluten"], shelf: 365, demo: [[500, "500g bag", 99]] },
  "red-lentils": { name: "dried red lentils", aliases: ["red lentil", "split red lentil", "dried red lentil"], cat: "Pasta, rice & grains", base: "g", density: 0.8, diet: "vegan", protein: "lentils", shelf: 730, demo: [[500, "500g bag", 125], [1000, "1kg bag", 215]] },
  oats: { name: "porridge oats", aliases: ["oat", "rolled oat", "porridge oat", "jumbo oat"], cat: "Baking & cereals", base: "g", density: 0.4, diet: "vegan", allergens: ["gluten"], shelf: 365, demo: [[1000, "1kg bag", 89]], note: "Oats are listed with gluten-containing cereals; gluten-free oats exist." },
  "plain-flour": { name: "plain flour", aliases: ["flour", "all-purpose flour", "plain white flour"], cat: "Baking & cereals", base: "g", density: 0.53, diet: "vegan", allergens: ["gluten"], shelf: 365, demo: [[1500, "1.5kg bag", 89]] },
  "baking-powder": { name: "baking powder", cat: "Baking & cereals", base: "g", density: 0.9, diet: "vegan", shelf: 365, demo: [[170, "170g tub", 95]] },

  /* ---------------- Tins & jars ---------------- */
  "chopped-tomatoes": { name: "chopped tomatoes", aliases: ["tinned tomatoes", "tinned chopped tomatoes", "canned tomatoes", "chopped tomato", "plum tomatoes", "tin of chopped tomatoes"], cat: "Tins & jars", base: "g", units: { tin: 400, can: 400 }, density: 1.03, diet: "vegan", shelf: 730, demo: [[400, "400g tin", 45], [1600, "4 × 400g tins", 175]] },
  passata: { name: "passata", aliases: ["sieved tomatoes", "tomato passata"], cat: "Tins & jars", base: "g", density: 1.03, units: { carton: 500, jar: 500 }, diet: "vegan", shelf: 365, demo: [[500, "500g carton", 65]] },
  "tomato-puree": { name: "tomato purée", aliases: ["tomato puree", "tomato paste", "double concentrate tomato puree"], cat: "Tins & jars", base: "g", density: 1.1, units: { tube: 200 }, diet: "vegan", shelf: 365, demo: [[200, "200g tube", 70]] },
  "kidney-beans": { name: "tinned red kidney beans", aliases: ["kidney bean", "red kidney bean"], cat: "Tins & jars", base: "g", units: { tin: 240, can: 240 }, diet: "vegan", protein: "beans", shelf: 730, demo: [[240, "400g tin (240g drained)", 50]] },
  "black-beans": { name: "tinned black beans", aliases: ["black bean", "black turtle bean"], cat: "Tins & jars", base: "g", units: { tin: 240, can: 240 }, diet: "vegan", protein: "beans", shelf: 730, demo: [[240, "400g tin (240g drained)", 70]] },
  chickpeas: { name: "tinned chickpeas", aliases: ["chickpea", "chick pea", "garbanzo"], cat: "Tins & jars", base: "g", units: { tin: 240, can: 240 }, diet: "vegan", protein: "chickpeas", shelf: 730, demo: [[240, "400g tin (240g drained)", 59]] },
  "cannellini-beans": { name: "tinned cannellini beans", aliases: ["cannellini bean", "white bean", "butter bean", "haricot bean"], cat: "Tins & jars", base: "g", units: { tin: 240, can: 240 }, diet: "vegan", protein: "beans", shelf: 730, demo: [[240, "400g tin (240g drained)", 59]] },
  "green-lentils": { name: "tinned green lentils", aliases: ["green lentil", "tinned lentil", "puy lentil", "brown lentil"], cat: "Tins & jars", base: "g", units: { tin: 265, can: 265 }, diet: "vegan", protein: "lentils", shelf: 730, demo: [[265, "400g tin (265g drained)", 75]] },
  sweetcorn: { name: "tinned sweetcorn", aliases: ["sweetcorn", "corn", "sweetcorn kernel", "frozen sweetcorn"], cat: "Tins & jars", base: "g", units: { tin: 198, can: 198 }, density: 0.7, diet: "vegan", shelf: 730, demo: [[198, "326g tin (198g drained)", 59]] },
  "coconut-milk": { name: "coconut milk", aliases: ["tinned coconut milk", "light coconut milk", "reduced fat coconut milk"], cat: "World foods", base: "ml", units: { tin: 400, can: 400 }, density: 1, diet: "vegan", shelf: 730, demo: [[400, "400ml tin", 115]] },
  "peanut-butter": { name: "peanut butter", aliases: ["smooth peanut butter", "crunchy peanut butter"], cat: "Tins & jars", base: "g", density: 1.05, diet: "vegan", allergens: ["peanuts"], shelf: 180, demo: [[340, "340g jar", 165]] },
  honey: { name: "clear honey", aliases: ["honey", "runny honey"], cat: "Tins & jars", base: "g", density: 1.4, diet: "vegetarian", shelf: 730, demo: [[340, "340g jar", 149]], note: "Honey is not vegan – maple syrup works instead." },
  "maple-syrup": { name: "maple syrup", aliases: ["maple syrup"], cat: "Tins & jars", base: "ml", density: 1.32, diet: "vegan", shelf: 365, demo: [[250, "250ml bottle", 325]] },
  pesto: { name: "green pesto", aliases: ["pesto", "basil pesto", "pesto alla genovese"], cat: "Tins & jars", base: "g", density: 1, diet: "pescatarian", allergens: ["milk", "tree-nuts"], may: ["peanuts"], shelf: 21, demo: [[190, "190g jar", 150]], note: "Most green pesto contains cheese made with animal rennet and pine nuts or cashews." },
  "thai-green-curry-paste": { name: "Thai green curry paste", aliases: ["green curry paste", "thai curry paste"], cat: "World foods", base: "g", density: 1, diet: "pescatarian", may: ["crustaceans", "fish"], shelf: 30, demo: [[190, "190g jar", 160]], note: "Many curry pastes contain shrimp paste or fish sauce – check the label." },
  "jerk-seasoning": { name: "jerk seasoning", aliases: ["jerk spice", "jerk marinade", "jerk paste"], cat: "Herbs & spices", base: "g", density: GROUND_SPICE, diet: "vegan", may: ["mustard", "celery"], shelf: 365, demo: JAR(50, 99) },
  "dried-apricots": { name: "dried apricots", aliases: ["dried apricot", "soft dried apricot"], cat: "Baking & cereals", base: "g", gpi: 8, diet: "vegan", allergens: ["sulphites"], shelf: 365, demo: [[250, "250g bag", 155]] },
  "veg-stock-cube": { name: "vegetable stock cubes", aliases: ["vegetable stock", "veg stock", "vegetable stock cube", "veg stock cube", "vegetable stock pot", "vegetable bouillon"], cat: "Oils, sauces & condiments", base: "item", itemLabel: "cube", itemLabelPlural: "cubes", units: { cube: 1, pot: 1 }, diet: "vegan", allergens: ["celery"], may: ["gluten"], shelf: 365, staple: true, demo: [[10, "10 cubes", 85]] },
  "chicken-stock-cube": { name: "chicken stock cubes", aliases: ["chicken stock", "chicken stock cube", "chicken stock pot"], cat: "Oils, sauces & condiments", base: "item", itemLabel: "cube", itemLabelPlural: "cubes", units: { cube: 1, pot: 1 }, diet: "meat", allergens: ["celery"], may: ["gluten"], shelf: 365, demo: [[12, "12 cubes", 85]] },
  "beef-stock-cube": { name: "beef stock cubes", aliases: ["beef stock", "beef stock cube", "beef stock pot"], cat: "Oils, sauces & condiments", base: "item", itemLabel: "cube", itemLabelPlural: "cubes", units: { cube: 1, pot: 1 }, diet: "meat", tags: ["beef"], allergens: ["celery"], may: ["gluten"], shelf: 365, demo: [[12, "12 cubes", 85]] },
  "gravy-granules": { name: "gravy granules", aliases: ["gravy", "onion gravy granules", "gravy granule"], cat: "Oils, sauces & condiments", base: "g", density: 0.6, diet: "vegan", may: ["gluten", "celery", "sulphites"], shelf: 365, demo: [[170, "170g tub", 99]] },
  "soy-sauce": { name: "soy sauce", aliases: ["light soy sauce", "dark soy sauce", "soy", "reduced salt soy sauce"], cat: "World foods", base: "ml", density: 1.15, diet: "vegan", allergens: ["soya", "gluten"], shelf: 365, demo: [[150, "150ml bottle", 99]], note: "Use tamari for a gluten-free alternative." },
  tamari: { name: "tamari", aliases: ["gluten free soy sauce", "gluten-free soy sauce"], cat: "World foods", base: "ml", density: 1.15, diet: "vegan", allergens: ["soya"], shelf: 365, demo: [[150, "150ml bottle", 225]] },
  "worcestershire-sauce": { name: "Worcestershire sauce", aliases: ["worcester sauce", "worcestershire"], cat: "Oils, sauces & condiments", base: "ml", density: 1.1, diet: "pescatarian", allergens: ["fish", "gluten"], shelf: 365, demo: [[150, "150ml bottle", 99]], note: "Contains anchovies and malt vinegar." },
  mayonnaise: { name: "mayonnaise", aliases: ["mayo", "light mayonnaise"], cat: "Oils, sauces & condiments", base: "g", density: 0.92, diet: "vegetarian", allergens: ["eggs"], may: ["mustard"], shelf: 60, demo: [[400, "400g jar", 145]] },
  "sesame-oil": { name: "toasted sesame oil", aliases: ["sesame oil"], cat: "World foods", base: "ml", density: 0.92, diet: "vegan", allergens: ["sesame"], shelf: 365, demo: [[150, "150ml bottle", 175]] },
  "vegetable-oil": { name: "vegetable oil", aliases: ["oil", "sunflower oil", "rapeseed oil", "cooking oil", "groundnut oil"], cat: "Oils, sauces & condiments", base: "ml", density: 0.92, diet: "vegan", shelf: 365, staple: true, demo: [[1000, "1 litre bottle", 165]] },
  "olive-oil": { name: "olive oil", aliases: ["extra virgin olive oil", "light olive oil", "evoo"], cat: "Oils, sauces & condiments", base: "ml", density: 0.92, diet: "vegan", shelf: 365, staple: true, demo: [[500, "500ml bottle", 425]] },
  "wine-vinegar": { name: "red wine vinegar", aliases: ["vinegar", "white wine vinegar", "red wine vinegar", "cider vinegar"], cat: "Oils, sauces & condiments", base: "ml", density: 1, diet: "vegan", allergens: ["sulphites"], shelf: 365, demo: [[350, "350ml bottle", 85]] },
  sugar: { name: "sugar", aliases: ["caster sugar", "granulated sugar", "brown sugar", "light brown sugar", "soft brown sugar"], cat: "Baking & cereals", base: "g", density: 0.85, diet: "vegan", shelf: 730, staple: true, demo: [[1000, "1kg bag", 119]] },
  salt: { name: "salt", aliases: ["sea salt", "table salt", "salt and pepper", "pinch of salt"], cat: "Herbs & spices", base: "g", density: 1.2, units: { pinch: 0.4 }, diet: "vegan", shelf: 3650, staple: true, demo: [[750, "750g tub", 65]] },
  "black-pepper": { name: "ground black pepper", aliases: ["black pepper", "pepper", "ground pepper", "freshly ground black pepper", "cracked black pepper"], cat: "Herbs & spices", base: "g", density: GROUND_SPICE, units: { pinch: 0.3 }, diet: "vegan", shelf: 730, staple: true, demo: JAR(100, 140) },

  /* ---------------- Dried herbs & spices ---------------- */
  "ground-cumin": { name: "ground cumin", aliases: ["cumin", "cumin powder"], cat: "Herbs & spices", base: "g", density: GROUND_SPICE, units: { pinch: 0.3 }, diet: "vegan", shelf: 730, demo: JAR(38) },
  "cumin-seeds": { name: "cumin seeds", aliases: ["cumin seed", "whole cumin"], cat: "Herbs & spices", base: "g", density: 0.45, diet: "vegan", shelf: 730, demo: JAR(40) },
  turmeric: { name: "ground turmeric", aliases: ["turmeric", "turmeric powder"], cat: "Herbs & spices", base: "g", density: GROUND_SPICE, units: { pinch: 0.3 }, diet: "vegan", shelf: 730, demo: JAR(40) },
  "garam-masala": { name: "garam masala", cat: "Herbs & spices", base: "g", density: GROUND_SPICE, units: { pinch: 0.3 }, diet: "vegan", shelf: 730, demo: JAR(40) },
  "curry-powder": { name: "mild curry powder", aliases: ["curry powder", "medium curry powder"], cat: "Herbs & spices", base: "g", density: GROUND_SPICE, diet: "vegan", may: ["mustard", "celery"], shelf: 730, demo: JAR(40) },
  "smoked-paprika": { name: "smoked paprika", aliases: ["paprika", "sweet smoked paprika", "pimenton"], cat: "Herbs & spices", base: "g", density: GROUND_SPICE, units: { pinch: 0.3 }, diet: "vegan", shelf: 730, demo: JAR(42, 99) },
  "chilli-powder": { name: "mild chilli powder", aliases: ["chilli powder", "hot chilli powder", "medium chilli powder"], cat: "Herbs & spices", base: "g", density: GROUND_SPICE, units: { pinch: 0.3 }, diet: "vegan", shelf: 730, demo: JAR(45) },
  "chilli-flakes": { name: "dried chilli flakes", aliases: ["chilli flake", "crushed chilli", "red chilli flakes", "crushed red pepper"], cat: "Herbs & spices", base: "g", density: 0.35, units: { pinch: 0.3 }, diet: "vegan", shelf: 730, demo: JAR(35) },
  cinnamon: { name: "ground cinnamon", aliases: ["cinnamon", "cinnamon powder"], cat: "Herbs & spices", base: "g", density: GROUND_SPICE, units: { pinch: 0.3 }, diet: "vegan", shelf: 730, demo: JAR(39) },
  "dried-oregano": { name: "dried oregano", aliases: ["oregano"], cat: "Herbs & spices", base: "g", density: DRIED_HERB, units: { pinch: 0.2 }, diet: "vegan", shelf: 730, demo: JAR(14) },
  "dried-thyme": { name: "dried thyme", aliases: ["thyme"], cat: "Herbs & spices", base: "g", density: DRIED_HERB, units: { pinch: 0.2 }, diet: "vegan", shelf: 730, demo: JAR(14) },
  "dried-mixed-herbs": { name: "dried mixed herbs", aliases: ["mixed herbs", "italian herbs", "herbes de provence", "dried italian herbs"], cat: "Herbs & spices", base: "g", density: DRIED_HERB, units: { pinch: 0.2 }, diet: "vegan", shelf: 730, demo: JAR(14) },
  "dried-rosemary": { name: "dried rosemary", aliases: ["rosemary"], cat: "Herbs & spices", base: "g", density: DRIED_HERB, units: { pinch: 0.2 }, diet: "vegan", shelf: 730, demo: JAR(18) },
  "ground-coriander": { name: "ground coriander", aliases: ["coriander powder"], cat: "Herbs & spices", base: "g", density: GROUND_SPICE, units: { pinch: 0.3 }, diet: "vegan", shelf: 730, demo: JAR(36) },

  /* ---------------- Frozen ---------------- */
  "frozen-peas": { name: "frozen peas", aliases: ["pea", "peas", "garden peas", "petit pois", "frozen pea"], cat: "Frozen", base: "g", density: 0.6, diet: "vegan", shelf: 180, demo: [[900, "900g bag", 135]] },
  "frozen-berries": { name: "frozen mixed berries", aliases: ["mixed berries", "frozen berry", "frozen fruit", "berry", "berries", "blueberry", "raspberry"], cat: "Frozen", base: "g", density: 0.6, diet: "vegan", shelf: 180, demo: [[500, "500g bag", 225]] },
  "frozen-spinach": { name: "frozen spinach", aliases: ["frozen chopped spinach", "frozen spinach portion"], cat: "Frozen", base: "g", diet: "vegan", shelf: 180, demo: [[900, "900g bag", 135]] },
};

export const INGREDIENTS: IngredientDef[] = Object.entries(defs).map(([id, d]) => ({
  id,
  name: d.name,
  plural: d.plural,
  aliases: d.aliases ?? [],
  category: d.cat,
  baseUnit: d.base,
  itemLabel: d.itemLabel,
  itemLabelPlural: d.itemLabelPlural,
  gramsPerItem: d.gpi,
  density: d.density,
  customUnits: d.units,
  allergens: d.allergens ?? [],
  mayContain: d.may,
  diet: d.diet ?? "vegan",
  tags: d.tags,
  shelfLifeDays: d.shelf,
  staple: d.staple,
  protein: d.protein,
  packs: d.demo.map(([size, label]) => ({ size, label })),
  note: d.note,
}));

export const INGREDIENT_BY_ID: Record<string, IngredientDef> = Object.fromEntries(
  INGREDIENTS.map((i) => [i.id, i]),
);

/** Baseline demonstration pack prices (pence) – see file header. */
export const DEMO_PACK_PRICES: Record<string, DemoPack[]> = Object.fromEntries(
  Object.entries(defs).map(([id, d]) => [id, d.demo]),
);

export function getIngredient(id: string | null | undefined): IngredientDef | undefined {
  return id ? INGREDIENT_BY_ID[id] : undefined;
}
