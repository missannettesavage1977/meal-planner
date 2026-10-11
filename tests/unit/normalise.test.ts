import { describe, expect, it } from "vitest";
import { matchIngredient, singularise } from "@/lib/engine/normalise";

const id = (s: string) => matchIngredient(s)?.id ?? null;

describe("ingredient name normalisation", () => {
  it("singularises plurals", () => {
    expect(singularise("tomatoes")).toBe("tomato");
    expect(singularise("chillies")).toBe("chilli");
    expect(singularise("berries")).toBe("berry");
    expect(singularise("radishes")).toBe("radish");
    expect(singularise("couscous")).toBe("couscous");
    expect(singularise("onions")).toBe("onion");
  });

  it("matches singular and plural forms to the same id", () => {
    expect(id("onion")).toBe("onion");
    expect(id("Onions")).toBe("onion");
    expect(id("2 large onions, finely chopped")).toBe("onion");
    expect(id("carrots")).toBe("carrot");
  });

  it("understands UK and international names", () => {
    expect(id("zucchini")).toBe("courgette");
    expect(id("courgettes")).toBe("courgette");
    expect(id("cilantro")).toBe("fresh-coriander");
    expect(id("scallions")).toBe("spring-onion");
    expect(id("ground beef")).toBe("beef-mince");
    expect(id("shrimp")).toBe("prawns");
    expect(id("crème fraîche")).toBe("creme-fraiche");
  });

  it("keeps different forms of the same plant apart", () => {
    expect(id("fresh coriander")).toBe("fresh-coriander");
    expect(id("ground coriander")).toBe("ground-coriander");
    expect(id("dried oregano")).toBe("dried-oregano");
    expect(id("fresh basil")).toBe("fresh-basil");
    expect(id("red pepper")).toBe("bell-pepper");
    expect(id("black pepper")).toBe("black-pepper");
    expect(id("chilli powder")).toBe("chilli-powder");
    expect(id("red chilli")).toBe("red-chilli");
    expect(id("sesame oil")).toBe("sesame-oil");
    expect(id("olive oil")).toBe("olive-oil");
  });

  it("returns null for unknown ingredients rather than guessing", () => {
    expect(id("dragon fruit")).toBeNull();
    expect(id("tahini")).toBeNull();
  });
});
