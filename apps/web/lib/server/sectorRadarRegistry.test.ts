import { describe, expect, it } from "vitest";
import { getSectorKeyByAliasName, normalizeSectorLabelForLookup } from "../sectorRadarRegistry.shared";

describe("sector radar anchor universe", () => {
  it("normalizes alias labels", () => {
    expect(normalizeSectorLabelForLookup("  조선/LNG/소재 ")).toBe("조선/lng/소재");
    expect(normalizeSectorLabelForLookup("ETF/인컴")).toBe("etf/인컴");
  });

  it("maps known aliases to stable sector keys", () => {
    expect(getSectorKeyByAliasName("조선/lng/소재")).toBe("shipping_lng_material");
    expect(getSectorKeyByAliasName("항공/여행")).toBe("airline_travel");
    expect(getSectorKeyByAliasName("사이버보안")).toBe("cybersecurity");
    expect(getSectorKeyByAliasName("etf/인컴")).toBe("etf_income");
  });
});
