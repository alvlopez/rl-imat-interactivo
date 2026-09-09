/* Tests del lienzo compartido: `graficaLineas` de assets/nucleo.js.
 *
 * Existe por un defecto que se coló en cinco páginas antes de que alguien lo
 * mirara: `yMin`/`yMax` eran un MARCO DURO, así que una serie que no cabía se
 * dibujaba fuera del recuadro, encima de las etiquetas del eje x, y —lo peor—
 * desaparecía de la vista sin decirlo. En el Tema 5 (cont.), el módulo 3 con
 * tope de 10 000 pasos dibujaba UNA de sus tres curvas mientras el texto de al
 * lado invitaba a compararlas.
 *
 * El invariante que fijan estos tests es el que caza ese fallo:
 * NINGÚN PUNTO DE UNA SERIE PUEDE QUEDAR FUERA DEL RECTÁNGULO DE DIBUJO.
 *
 * `nucleo.js` toca el DOM, así que aquí se le pone uno mínimo: los tres
 * métodos que usa `el()` y un `getComputedStyle` que devuelve cadenas vacías.
 * Sin dependencias, que es la regla del repositorio.
 */

import test from "node:test";
import assert from "node:assert/strict";

/* --- DOM mínimo, instalado antes de importar nucleo.js ------------------- */

class NodoFalso {
  constructor(etiqueta) {
    this.etiqueta = etiqueta;
    this.atributos = {};
    this.hijos = [];
    this.textContent = "";
  }

  setAttribute(clave, valor) { this.atributos[clave] = valor; }

  getAttribute(clave) { return this.atributos[clave]; }

  appendChild(hijo) { this.hijos.push(hijo); return hijo; }

  /** Todos los descendientes con una etiqueta dada, en profundidad. */
  buscar(etiqueta, salida = []) {
    for (const hijo of this.hijos) {
      if (hijo.etiqueta === etiqueta) salida.push(hijo);
      hijo.buscar(etiqueta, salida);
    }
    return salida;
  }
}

globalThis.document = {
  createElementNS: (_ns, etiqueta) => new NodoFalso(etiqueta),
  documentElement: {},
};
globalThis.getComputedStyle = () => ({ getPropertyValue: () => "" });

const { graficaLineas } = await import("../assets/nucleo.js");

/* --- ayudas ------------------------------------------------------------- */

/** Los márgenes del lienzo, tal y como los fija `graficaLineas`. */
const M = { i: 58, d: 14, s: 14, f: 42 };
const suelo = (alto) => alto - M.f;          // y máxima del rectángulo
const techo = M.s;                           // y mínima del rectángulo

/** Los pares (x, y) de un atributo `d` de <path>. */
function puntosDe(d) {
  const puntos = [];
  for (const trozo of String(d).matchAll(/[ML]([-\d.]+) ([-\d.]+)/g)) {
    puntos.push({ x: Number(trozo[1]), y: Number(trozo[2]) });
  }
  return puntos;
}

const caminos = (svg) => svg.buscar("path").filter((p) => p.atributos.d);

/* ===================================================================== *
 * El invariante: ninguna serie se sale del recuadro
 * ===================================================================== */

test("una serie que excede el yMin pedido NO se dibuja por debajo del suelo", () => {
  const alto = 320;
  /* −611 es el retorno medio real del módulo 3 con tope de 10 000 pasos, y
     −95 el suelo que pedía la Figura 13.1: el caso que destapó el defecto. */
  const svg = graficaLineas([{ color: "#000", y: [-90, -611, -300, -40] }], {
    alto, yMin: -95, yMax: -5,
  });
  const puntos = caminos(svg).flatMap((p) => puntosDe(p.atributos.d));
  assert.ok(puntos.length > 0, "no se ha dibujado ninguna serie");
  for (const punto of puntos) {
    assert.ok(
      punto.y <= suelo(alto) + 0.01,
      `un punto de la serie cae ${(punto.y - suelo(alto)).toFixed(1)} px por `
      + "debajo del suelo del recuadro",
    );
    assert.ok(punto.y >= techo - 0.01, "un punto de la serie cae por encima del techo");
  }
});

test("y el eje se estira: el punto más bajo llega al suelo, no se recorta contra él", () => {
  const alto = 320;
  const svg = graficaLineas([{ color: "#000", y: [-90, -611, -300, -40] }], {
    alto, yMin: -95, yMax: -5,
  });
  const puntos = caminos(svg).flatMap((p) => puntosDe(p.atributos.d));
  const masBajo = Math.max(...puntos.map((p) => p.y));
  /* Si se recortara el dato, TODOS los puntos por debajo de −95 caerían en la
     misma ordenada y la curva se aplanaría contra el borde. Al estirar, el
     −611 toca el suelo y el −300 se queda a media altura. */
  assert.ok(Math.abs(masBajo - suelo(alto)) < 0.5, "el mínimo no llega al suelo");
  const alturas = new Set(puntos.map((p) => p.y.toFixed(1)));
  assert.equal(alturas.size, 4, "dos puntos distintos han caído en la misma altura");
});

test("con yMax pedido por debajo del dato, el eje también se estira hacia arriba", () => {
  const svg = graficaLineas([{ color: "#000", y: [1, 50, 3] }], { alto: 300, yMin: 0, yMax: 10 });
  const puntos = caminos(svg).flatMap((p) => puntosDe(p.atributos.d));
  for (const punto of puntos) {
    assert.ok(punto.y >= techo - 0.01 && punto.y <= suelo(300) + 0.01, "punto fuera del recuadro");
  }
});

test("si el dato cabe, el rango pedido se respeta exactamente (no hay regresión)", () => {
  const alto = 300;
  const svg = graficaLineas([{ color: "#000", y: [-50, -20, -10] }], {
    alto, yMin: -95, yMax: -5,
  });
  const puntos = puntosDe(caminos(svg)[0].atributos.d);
  /* −50 sobre el rango [−95, −5] cae justo a la mitad del recuadro. */
  const h = alto - M.s - M.f;
  assert.ok(Math.abs(puntos[0].y - (M.s + h - ((-50 + 95) / 90) * h)) < 0.01,
    "el rango pedido ha cambiado aunque el dato cabía");
});

test("`ventanaY` mantiene el marco duro, y aun así la serie se recorta al recuadro", () => {
  const alto = 320;
  /* El caso de la asíntota: J(p) del pasillo corto vale −800 en p = 0,005 y
     no tiene mínimo. Estirar dejaría el máximo aplastado contra el techo, así
     que el rango es una ventana deliberada… y la curva se corta en el borde. */
  const svg = graficaLineas([{ color: "#000", y: [-800, -12, -800] }], {
    alto, yMin: -100, yMax: 0, ventanaY: true,
  });
  const puntos = puntosDe(caminos(svg)[0].atributos.d);
  const h = alto - M.s - M.f;
  assert.ok(Math.abs(puntos[1].y - (M.s + h - ((-12 + 100) / 100) * h)) < 0.01,
    "con ventanaY el rango pedido tiene que respetarse");
  const grupo = svg.hijos.find((n) => n.etiqueta === "g" && n.atributos["clip-path"]);
  assert.ok(grupo, "las series tienen que ir en un grupo con clip-path");
});

test("las series van SIEMPRE dentro del grupo recortado, y el recorte es el recuadro", () => {
  const alto = 300;
  const svg = graficaLineas([{ color: "#000", y: [1, 2, 3] }], { alto });
  const grupo = svg.hijos.find((n) => n.etiqueta === "g" && n.atributos["clip-path"]);
  assert.ok(grupo, "no hay grupo recortado");
  assert.ok(grupo.buscar("path").length > 0, "la serie no está dentro del grupo recortado");
  const rect = svg.buscar("clipPath")[0].hijos[0];
  assert.equal(Number(rect.atributos.x), M.i);
  assert.equal(Number(rect.atributos.y), M.s);
  assert.equal(Number(rect.atributos.width), 660 - M.i - M.d);
  assert.equal(Number(rect.atributos.height), alto - M.s - M.f);
});

/* ===================================================================== *
 * Rótulos que no se pisan ni se salen
 * ===================================================================== */

test("dos anotaciones verticales cercanas se escalonan en alturas distintas", () => {
  const svg = graficaLineas([{ color: "#000", x: [0, 100], y: [1, 2] }], {
    anotaciones: [{ x: 50, texto: "75,7" }, { x: 50.5, texto: "75,1" }],
  });
  const alturas = svg.buscar("text")
    .filter((n) => ["75,7", "75,1"].includes(n.textContent))
    .map((n) => Number(n.atributos.y));
  assert.equal(alturas.length, 2, "no se han dibujado las dos anotaciones");
  assert.notEqual(alturas[0], alturas[1], "los dos rótulos se imprimen a la misma altura");
});

test("dos anotaciones verticales lejanas comparten altura (no se escalona de más)", () => {
  const svg = graficaLineas([{ color: "#000", x: [0, 100], y: [1, 2] }], {
    anotaciones: [{ x: 5, texto: "a" }, { x: 95, texto: "b" }],
  });
  const alturas = svg.buscar("text")
    .filter((n) => ["a", "b"].includes(n.textContent))
    .map((n) => Number(n.atributos.y));
  assert.equal(alturas[0], alturas[1]);
});

test("una marca del eje x con rótulo largo no se sale del lienzo", () => {
  const ancho = 660;
  const svg = graficaLineas([{ color: "#000", x: [0, 748], y: [1, 2] }], {
    ancho,
    ticksX: [{ valor: 748, etiqueta: "≥ 748" }, { valor: 0, etiqueta: "≤ −597" }],
  });
  for (const nodo of svg.buscar("text")) {
    if (!["≥ 748", "≤ −597"].includes(nodo.textContent)) continue;
    const x = Number(nodo.atributos.x);
    const medio = nodo.textContent.length * 3.1;
    const borde = nodo.atributos["text-anchor"] === "end"
      ? x
      : (nodo.atributos["text-anchor"] === "start" ? x + medio * 2 : x + medio);
    assert.ok(borde <= ancho, `el rótulo «${nodo.textContent}» se sale por la derecha`);
    const izquierdo = nodo.atributos["text-anchor"] === "end"
      ? x - medio * 2
      : (nodo.atributos["text-anchor"] === "start" ? x : x - medio);
    assert.ok(izquierdo >= 0, `el rótulo «${nodo.textContent}» se sale por la izquierda`);
  }
});

test("un rótulo de eje con <sub> se compone con tspan, no con el guion bajo literal", () => {
  const svg = graficaLineas([{ color: "#000", y: [1, 2] }], {
    ejeY: "J(θ) = v<sub>π</sub>(s<sub>0</sub>)",
  });
  const textos = svg.buscar("text").filter((n) => n.hijos.some((h) => h.etiqueta === "tspan"));
  assert.equal(textos.length, 1, "el rótulo del eje y no se ha compuesto con tspan");
  const partes = textos[0].hijos.map((h) => h.textContent).join("");
  assert.equal(partes, "J(θ) = vπ(s0)");
  assert.ok(!partes.includes("_"), "ha quedado un guion bajo en crudo");
});

test("sin <sub>, el rótulo del eje sigue siendo un <text> plano", () => {
  const svg = graficaLineas([{ color: "#000", y: [1, 2] }], { ejeX: "Episodio" });
  const nodo = svg.buscar("text").find((n) => n.textContent === "Episodio");
  assert.ok(nodo, "no se ha dibujado el rótulo del eje x");
  assert.equal(nodo.hijos.length, 0, "un rótulo sin subíndices no debe llevar tspans");
});
