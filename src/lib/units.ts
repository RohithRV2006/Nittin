import { UnitType } from "@prisma/client";
import Decimal from "decimal.js";
import { qty, toDec } from "./decimal";

const MASS_TO_GRAMS: Partial<Record<UnitType, Decimal>> = {
  GRAM: new Decimal(1),
  KG: new Decimal(1000),
};

const VOL_TO_ML: Partial<Record<UnitType, Decimal>> = {
  ML: new Decimal(1),
  LITRE: new Decimal(1000),
};

export interface UnitConversionContext {
  unitsPerCarton?: number | null;
}

/**
 * Deterministically converts a physical quantity from `fromUnit` into `toUnit`.
 * Throws an explicit error if the units are dimensionally incompatible.
 */
export function convertUnit(
  value: Decimal | string | number,
  fromUnit: UnitType,
  toUnit: UnitType,
  ctx?: UnitConversionContext
): Decimal {
  const amount = toDec(value);
  if (fromUnit === toUnit) {
    return qty(amount);
  }

  // Mass conversion: KG <-> GRAM
  const fromMass = MASS_TO_GRAMS[fromUnit];
  const toMass = MASS_TO_GRAMS[toUnit];
  if (fromMass && toMass) {
    return qty(amount.mul(fromMass).div(toMass));
  }

  // Volume conversion: LITRE <-> ML
  const fromVol = VOL_TO_ML[fromUnit];
  const toVol = VOL_TO_ML[toUnit];
  if (fromVol && toVol) {
    return qty(amount.mul(fromVol).div(toVol));
  }

  // Packaging / Count conversion: CARTON <-> PACKET / PIECE
  if (
    fromUnit === UnitType.CARTON &&
    (toUnit === UnitType.PACKET || toUnit === UnitType.PIECE)
  ) {
    const perCarton = ctx?.unitsPerCarton;
    if (!perCarton || perCarton <= 0) {
      throw new Error("unitsPerCarton must be configured to convert CARTON to PACKET/PIECE");
    }
    return qty(amount.mul(perCarton));
  }

  if (
    (fromUnit === UnitType.PACKET || fromUnit === UnitType.PIECE) &&
    toUnit === UnitType.CARTON
  ) {
    const perCarton = ctx?.unitsPerCarton;
    if (!perCarton || perCarton <= 0) {
      throw new Error("unitsPerCarton must be configured to convert PACKET/PIECE to CARTON");
    }
    return qty(amount.div(perCarton));
  }

  // PIECE <-> PACKET equivalence when 1:1 count
  if (
    (fromUnit === UnitType.PIECE && toUnit === UnitType.PACKET) ||
    (fromUnit === UnitType.PACKET && toUnit === UnitType.PIECE)
  ) {
    return qty(amount);
  }

  throw new Error(`Incompatible unit conversion: ${fromUnit} -> ${toUnit}`);
}

/**
 * Computes pack-size scaling ratio when cloning a BOM from one pack weight to another.
 * Example: 200 g -> 500 g yields 2.500x ingredient scaling.
 */
export function computePackScaleFactor(
  sourcePackGrams: Decimal | string | number,
  targetPackGrams: Decimal | string | number
): Decimal {
  const src = toDec(sourcePackGrams);
  const tgt = toDec(targetPackGrams);
  if (src.lte(0) || tgt.lte(0)) {
    throw new Error("Pack weights must be positive for BOM scaling");
  }
  return tgt.div(src).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
}
