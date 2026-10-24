import khaoSoi from "../data/foods/khao-soi.json";
import padThai from "../data/foods/pad-thai.json";
import somTam from "../data/foods/som-tam.json";
import type { StoredFood } from "./schemas";

// Explicit imports keep filesystem access out of the Worker.
// validate:data checks this list against every file in data/foods.
export const catalogue: readonly StoredFood[] = [khaoSoi, padThai, somTam];
