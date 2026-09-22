import { describe, expect, it } from "vitest";
import { parsearPayloadFlight, parsearProducto } from "./instaleap";

const TIENDA = "La Economía";
const ORIGEN = "https://www.droguerialaeconomia.com";

describe("parsearPayloadFlight + parsearProducto", () => {
  it("extrae un producto de un payload de Next.js flight, resolviendo la foto por referencia", () => {
    const payload = [
      'a:I[4707,[],""]', // ref de componente: debe ignorarse
      'b9:T509,texto largo de descripcion sin comillas', // chunk de texto: debe ignorarse
      'd6:["https://services.droguerialaeconomia.com/economia/site/img/1x/402046.jpg"]',
      'd5:{"name":"AMOXICILINA 500 MG CAJA X 100","price":39400,"sku":"402046","stock":14,"isAvailable":true,"slug":"amoxicilina-500-mg-caja-x-100-402046","brand":"","photosUrl":"$d6","index":0}',
    ].join("\n");

    const mapa = parsearPayloadFlight(payload);
    const producto = mapa.get("d5") as Parameters<typeof parsearProducto>[0];

    expect(parsearProducto(producto, mapa, TIENDA, ORIGEN)).toEqual({
      tienda: "La Economía",
      nombre: "AMOXICILINA 500 MG CAJA X 100",
      precio: 39400,
      disponible: true,
      marca: "",
      url: "https://www.droguerialaeconomia.com/p/amoxicilina-500-mg-caja-x-100-402046",
      imagen: "https://services.droguerialaeconomia.com/economia/site/img/1x/402046.jpg",
    });
  });

  it("usa el precio promocional solo cuando es menor que el precio normal", () => {
    const conPromoValida = {
      name: "X",
      sku: "1",
      price: 17100,
      promotionPricePerSubUnit: 10300,
    };
    const conPromoInvalida = {
      name: "X",
      sku: "1",
      price: 17100,
      promotionPricePerSubUnit: 20000,
    };
    const mapa = new Map<string, unknown>();

    expect(parsearProducto(conPromoValida, mapa, TIENDA, ORIGEN).precio).toBe(
      10300,
    );
    expect(parsearProducto(conPromoInvalida, mapa, TIENDA, ORIGEN).precio).toBe(
      17100,
    );
  });

  it("no confunde una referencia de chunk inexistente con una imagen real", () => {
    const producto = {
      name: "Y",
      sku: "2",
      price: 1000,
      photosUrl: "$noexiste",
    };
    const mapa = new Map<string, unknown>();

    expect(
      parsearProducto(producto, mapa, TIENDA, ORIGEN).imagen,
    ).toBeUndefined();
  });

  it("elige la categoría más específica (la de path con más segmentos) entre varias no ordenadas", () => {
    const payload = [
      'cat1:{"name":"Mercado y Alimentos","path":"/CP_01"}',
      'cat2:{"name":"Aceites","path":"/CP_01/CP_01_02/CP_01_02_01"}',
      'cat3:{"name":"Despensa","path":"/CP_01/CP_01_02"}',
      'cats:["$cat1","$cat2","$cat3"]',
      'p1:{"name":"ACEITE DE OLIVA 500ML","price":18000,"sku":"1","categories":"$cats"}',
    ].join("\n");

    const mapa = parsearPayloadFlight(payload);
    const producto = mapa.get("p1") as Parameters<typeof parsearProducto>[0];

    expect(parsearProducto(producto, mapa, TIENDA, ORIGEN).categoria).toBe(
      "Aceites",
    );
  });

  it("no falla cuando el producto no trae categorías", () => {
    const producto = { name: "Z", sku: "3", price: 1000 };
    const mapa = new Map<string, unknown>();

    expect(
      parsearProducto(producto, mapa, TIENDA, ORIGEN).categoria,
    ).toBeUndefined();
  });
});
