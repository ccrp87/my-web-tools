import { describe, expect, it } from "vitest";
import { precioFlatsome } from "./flatsome";

describe("precioFlatsome", () => {
  it("extrae el monto de un precio simple con entidad HTML", () => {
    const html =
      '<span class="woocommerce-Price-amount amount"><bdi>' +
      '<span class="woocommerce-Price-currencySymbol">&#36;</span>5.600</bdi></span>';
    expect(precioFlatsome(html)).toBe(5600);
  });

  it("usa el precio con oferta (<ins>), no el tachado (<del>)", () => {
    const html =
      '<del aria-hidden="true"><span class="woocommerce-Price-amount amount">' +
      '<bdi><span class="woocommerce-Price-currencySymbol">&#36;</span>8.800</bdi></span></del> ' +
      '<ins aria-hidden="true"><span class="woocommerce-Price-amount amount">' +
      '<bdi><span class="woocommerce-Price-currencySymbol">&#36;</span>7.500</bdi></span></ins>';
    expect(precioFlatsome(html)).toBe(7500);
  });

  it("devuelve null si no hay precio", () => {
    expect(precioFlatsome(undefined)).toBeNull();
  });
});
