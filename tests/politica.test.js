/* Tests del motor de gradiente de política del Tema 5, 2.ª parte
 * (`assets/politica.js` + `assets/politica-worker.js`).
 *
 * No comprueban «que el código no falle»: comprueban que el motor REPRODUCE
 * el capítulo 13 de Sutton & Barto y el guion. Cada test lleva en el nombre el
 * identificador de la aserción —`C1-3`, `R4-6`, `Q-7`…— para que un fallo se
 * rastree en un segundo al párrafo que lo justifica:
 *
 *   C1-* … C6-*   → `Interactivo/T5b_recurso/guion-recurso.md`, §8a del módulo n
 *   R3-* … R6-*   → ídem, §8b
 *   Q-1 … Q-12    → ídem, §C4, «estructurales»
 *
 *   cd Interactivo/web && npm test
 *   cd Interactivo/web && node --test tests/politica.test.js
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DOS CLASES DE TEST, y cada `describe` dice de cuál es
 *
 *   [C] CONTRASTE. No dependen del azar: identidades algebraicas, valores
 *       publicados por el libro, límites y geometrías. Tolerancia estricta y
 *       la que fija el guion. SI UNO FALLA NO SE RELAJA: o está mal el motor
 *       o está mal el guion, y se decide mirando el libro.
 *
 *   [R] REPRODUCIBILIDAD. Promedios sembrados. Los valores los midió quien
 *       implementó el motor y están escritos en el guion con su configuración
 *       exacta; aquí se fijan con la tolerancia que el guion declara. Si uno
 *       no sale, se reporta y se corrige el guion — nunca el motor ni el
 *       número.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LAS DOS COSAS DELICADAS, CON TEST PROPIO Y NOMBRE QUE LO DICE
 *
 *   1. EL TOPE DE PASOS POR EPISODIO CAMBIA EL RESULTADO DEL LIBRO. Con tope
 *      500 la Figura 13.1 sale al decimal (−40,09 · −12,30 · −15,00, con
 *      2⁻¹³ la mejor); con tope 10 000 sale −611 · −112 · −15 y LA ORDENACIÓN
 *      DEL PIE DE LA FIGURA 13.2 SE INVIERTE. Es un parámetro con efecto, no
 *      un detalle de rendimiento, y aquí queda fijado (`R3-5`, y los tres
 *      tests marcados «tope»).
 *
 *   2. LA LÍNEA BASE POR ACCIÓN NO DEJA LA CURVA PLANA: LA DESTRUYE (mediana
 *      de p = 0,0000, G₀ = −470,71). Y ESO NO CONTRADICE `C4-9`, que dice que
 *      su gradiente ESPERADO es exactamente cero —sale a 4·10⁻¹⁴—: esperanza
 *      cero no es quieto, porque la varianza no se anula y los dos extremos
 *      son absorbentes. Los dos tests están escritos para leerse juntos:
 *      `C4-9` («la actualización esperada es cero») y `R4-6`/`R4-7` («y aun
 *      así la política se va al extremo»).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LO QUE NO HA SALIDO COMO LO ESCRIBE EL GUION  (se reporta, no se ajusta)
 *
 *   C6-10  El guion dice «con δ ≥ 10 la trayectoria con freno y la de sin
 *          freno son idénticas». CON EL α^θ POR OMISIÓN DEL MÓDULO (2⁻⁷) ES
 *          FALSO: la mayor D_KL de una actualización es 27,417 (R6-6), así que
 *          δ = 10 recorta. También es falso con 2⁻⁹, donde la mayor vale
 *          11,434 y la curva se separa en el episodio 203. La aserción es
 *          correcta en su INTENCIÓN —«con δ enorme el freno es la identidad»—
 *          y así se testea (δ = 10⁶, y δ = 10 con 2⁻¹², donde la mayor KL es
 *          0,211). El umbral «10» del guion hay que subirlo o atarlo al α.
 *
 *   R3-9   El guion dice que la media de las 94 ejecuciones no colapsadas es
 *          −11,97. Medida: −11,81. La diferencia es pequeña pero la que
 *          cuadra con el resto del guion es la medida: 0,94·(−11,81) +
 *          0,06·(−483,08) = −40,09, que es exactamente el R3-3 publicado;
 *          con −11,97 saldría −40,23. Se testea a ±0,5 alrededor del valor
 *          del guion, que la medida cumple, y se reporta.
 *
 *   ⚑⚑⚑   La nota del módulo 6 dice que con el incremento acumulado y 2⁻¹²
 *          «las VEINTE ejecuciones convergen a −11,68». Con 20 ejecuciones el
 *          valor es −11,98; −11,68 es el de 1000 × 100. El hecho que sostiene
 *          la nota —cero colapsos con el orden acumulado, seis de cien con el
 *          del libro— sí se reproduce y sí se testea.
 *
 *   R5-*   La «configuración común» del §8b del módulo 5 dice α^w = 2⁻⁴, pero
 *          LOS NUEVE VALORES DE R5-1 … R5-9 SON LOS DE α^w = 2⁻⁶ (se ha
 *          comprobado casilla a casilla contra la tabla ⚑ de ese mismo §8b).
 *          Se testea con 2⁻⁶, que es lo que reproduce los números, y se
 *          testea además la tabla ⚑ entera, que es la que sostiene la
 *          recomendación de subir el valor por omisión a 2⁻⁴.
 *
 *   R4-4/5 El guion dice «tope de 500 pasos» en la configuración común del
 *          módulo 4, pero el estudio del estimador con θ congelado solo
 *          reproduce sus cifras (51 656 · 21 272 · 0,412 · −0,17 σ) SIN TOPE
 *          efectivo (10 000). Con tope 500 salen 50 250 · 20 015 · 0,398 ·
 *          −0,20 σ. Se testea la configuración que reproduce el guion y se
 *          anota; la conclusión (cociente muy por debajo de 1, diferencia de
 *          medias compatible con cero) es la misma con las dos.
 *
 *   Q-11   «El barajado conserva la respuesta correcta en las 18 preguntas»
 *          NO SE PUEDE ESCRIBIR TODAVÍA y no es de este fichero: el banco vive
 *          en `assets/tema5b.js`, que hoy es un esqueleto de una línea, y el
 *          test es de `tests/quiz.test.js`, que este encargo no toca. Queda
 *          reportado, no escrito.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * COSTE. Las tandas se cachean por configuración: cada una se ejecuta UNA vez
 * aunque la usen seis tests. Las dos caras son `R3-3` con tope 10 000 (≈ 8 s:
 * seis ejecuciones colapsadas × 1000 episodios × 10 000 pasos) y la línea base
 * por acción de `R4-6`/`R4-7` (≈ 6 s: 93 350 episodios topados de 100 000).
 * Las dos son EL FENÓMENO, no un accidente del muestreo, y por eso están.
 */

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  /* entornos */
  pasilloCorto,
  rejillaCruz,
  construirEntorno,
  UMBRAL_COLAPSO,
  /* política */
  softmax,
  probabilidades,
  muestrearAccion,
  gradLogPi,
  pDeTheta,
  thetaDeP,
  /* solución exacta */
  J,
  optimoExacto,
  valoresExactos,
  gradienteJ,
  ladoDerechoTeorema,
  constanteProporcionalidad,
  mediaVarianzaTermino,
  actualizacionEsperada,
  /* episodios y algoritmos */
  episodio,
  retornos,
  reinforce,
  reinforceLineaBase,
  actorCritico,
  /* freno */
  klPolitica,
  recorteRegion,
  /* tandas */
  tanda,
  histograma,
} from "../assets/politica.js";

import { generador } from "../assets/nucleo.js";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..");

/* ===================================================================== *
 * Constantes del guion
 * ===================================================================== */

/** Semilla del sitio (guion §0, «Decisiones de partida»). */
const SEMILLA = 2026;

/** p₀ de los módulos 3 a 6: la ε-greedy hacia la izquierda del Ej. 13.1. */
const P0 = 0.05;

/** Los cuatro entornos: dos × alias. */
const PASILLO = pasilloCorto();
const PASILLO_DIST = pasilloCorto({ alias: false });
const CRUZ = rejillaCruz();
const CRUZ_DIST = rejillaCruz({ alias: false });
const CUATRO = [
  ["pasillo (alias)", PASILLO],
  ["pasillo (distinguibles)", PASILLO_DIST],
  ["cruz (alias)", CRUZ],
  ["cruz (distinguibles)", CRUZ_DIST],
];

/** p = 0,01 … 0,99 (99 puntos): el rango del deslizador del módulo 1. */
const P_M1 = Array.from({ length: 99 }, (_, i) => (i + 1) / 100);
/** p = 0,05 … 0,95 (91 puntos): el rango, más estrecho, del módulo 2. */
const P_M2 = Array.from({ length: 91 }, (_, i) => 0.05 + i * 0.01);

/** El óptimo del pasillo con *aliasing*: S&B p. 345 y Ejercicio 13.1. */
const P_ESTRELLA = 2 - Math.SQRT2;
/** v_*(s₀) dentro de la clase parametrizada: la línea de las Figs. 13.1-13.2. */
const V_ESTRELLA = -(6 + 4 * Math.SQRT2);

/* ===================================================================== *
 * Utilidades
 * ===================================================================== */

/** Comparación numérica con mensaje legible. */
function cerca(x, objetivo, tol, etiqueta) {
  assert.ok(
    Number.isFinite(x) && Math.abs(x - objetivo) <= tol,
    `${etiqueta}: ${x}, se esperaba ${objetivo} (tolerancia ${tol})`,
  );
}

/** Comparación con tolerancia RELATIVA (la que usan C1-1, C1-9, C2-1, C2-2). */
function cercaRel(x, objetivo, tolRel, etiqueta) {
  const tol = tolRel * Math.max(1, Math.abs(objetivo));
  assert.ok(
    Number.isFinite(x) && Math.abs(x - objetivo) <= tol,
    `${etiqueta}: ${x}, se esperaba ${objetivo} (tolerancia relativa ${tolRel})`,
  );
}

/** Comparación en fracción del objetivo (las de reproducibilidad en %). */
function cercaPorciento(x, objetivo, fraccion, etiqueta) {
  const tol = Math.abs(objetivo) * fraccion;
  assert.ok(
    Number.isFinite(x) && Math.abs(x - objetivo) <= tol,
    `${etiqueta}: ${x}, se esperaba ${objetivo} ± ${(fraccion * 100).toFixed(0)} % (± ${tol})`,
  );
}

/** Igualdad componente a componente, con tolerancia. */
function cercaVector(v, esperado, tol, etiqueta) {
  assert.equal(v.length, esperado.length, `${etiqueta}: longitud`);
  for (let i = 0; i < esperado.length; i++) cerca(v[i], esperado[i], tol, `${etiqueta}[${i}]`);
}

/** Igualdad EXACTA componente a componente (bit a bit). */
function identicos(v, u, etiqueta) {
  assert.equal(v.length, u.length, `${etiqueta}: longitud`);
  for (let i = 0; i < v.length; i++) {
    assert.equal(v[i], u[i], `${etiqueta}: la componente ${i} difiere (${v[i]} ≠ ${u[i]})`);
  }
}

/** Índice de la primera componente en que dos series difieren, o −1. */
function primeraDiferencia(v, u) {
  for (let i = 0; i < Math.min(v.length, u.length); i++) if (v[i] !== u[i]) return i;
  return v.length === u.length ? -1 : Math.min(v.length, u.length);
}

const media = (a) => Array.from(a).reduce((x, y) => x + y, 0) / a.length;

/** Desviación típica poblacional (÷ n), la misma que usa `histograma`. */
function desviacion(a) {
  const m = media(a);
  return Math.sqrt(Array.from(a).reduce((x, y) => x + (y - m) * (y - m), 0) / a.length);
}

/** Media de los últimos `k` elementos de una curva. */
const mediaFinal = (curva, k) => media(Array.from(curva).slice(curva.length - k));

/**
 * Primer episodio (1-based, como lo cuenta el guion) en que la curva media
 * supera un umbral; `null` si no lo supera nunca.
 */
function primerEpisodioPorEncima(curva, umbral) {
  for (let i = 0; i < curva.length; i++) if (curva[i] > umbral) return i + 1;
  return null;
}

/** Un generador que LANZA si alguien le pide azar. */
const RNG_PROHIBIDO = {
  uniforme() {
    throw new Error("se ha consumido azar donde el guion dice que no hay azar");
  },
  entero() {
    throw new Error("se ha consumido azar donde el guion dice que no hay azar");
  },
};

/** Episodios sembrados, para las aserciones que comparan sobre los MISMOS. */
function episodiosSembrados(entorno, theta, n, { semilla = SEMILLA, maxPasos = 10000 } = {}) {
  const rng = generador(semilla);
  const lista = [];
  for (let k = 0; k < n; k++) lista.push(episodio(entorno, theta, rng, { maxPasos }));
  return lista;
}

/* ===================================================================== *
 * Caché de tandas
 *
 * Una tanda por configuración, aunque la usen seis tests. Sin esto el
 * fichero tardaría cuatro veces más.
 * ===================================================================== */

const CACHE = new Map();

function tandaCache(config) {
  const clave = JSON.stringify(config);
  if (!CACHE.has(clave)) CACHE.set(clave, tanda(config));
  return CACHE.get(clave);
}

/** Módulo 3: 1000 × 100, semilla 2026, p₀ = 0,05. `exp` es −log₂ α^θ. */
const M3 = (exp, maxPasos = 500) => tandaCache({
  entorno: "pasilloCorto", algoritmo: "reinforce", episodios: 1000, ejecuciones: 100,
  semilla: SEMILLA, p0: P0, alphaTheta: Math.pow(2, -exp), maxPasos,
});

/** Módulo 4: 1000 × 100, tope 500. `base` ∈ {"cero","estado","accion"}. */
function M4(base) {
  const variante = base === "cero" ? "reinforce" : "reinforceLineaBase";
  const r = tandaCache({
    entorno: "pasilloCorto", algoritmo: variante, episodios: 1000, ejecuciones: 100,
    semilla: SEMILLA, p0: P0, maxPasos: 500,
    alphaTheta: base === "cero" ? Math.pow(2, -13) : Math.pow(2, -9),
    alphaW: base === "cero" ? 0 : Math.pow(2, -6),
    base,
  });
  return { r, variante, detalle: r.porEjecucion[variante] };
}

/** Módulo 5: 500 × 50, tope 1000, α^θ = 2⁻⁹. */
function M5(algoritmo, capacidad, expW = 6) {
  const r = tandaCache({
    entorno: "pasilloCorto", algoritmo, episodios: 500, ejecuciones: 50,
    semilla: SEMILLA, p0: P0, alphaTheta: Math.pow(2, -9), alphaW: Math.pow(2, -expW),
    capacidad, maxPasos: 1000,
  });
  return { r, detalle: r.porEjecucion[algoritmo] };
}

/** Módulo 6: 300 × 20, tope 1000, incremento acumulado por episodio. */
function M6(exp, freno = null, ejecuciones = 20, episodios = 300) {
  const r = tandaCache({
    entorno: "pasilloCorto", algoritmo: "reinforce", episodios, ejecuciones,
    semilla: SEMILLA, p0: P0, alphaTheta: Math.pow(2, -exp), maxPasos: 1000,
    acumularEpisodio: true, freno,
  });
  return { r, detalle: r.porEjecucion.reinforce };
}

/* ===================================================================== *
 * MÓDULO 1 · ¿Puede ser óptima una política estocástica?   [C]
 * Fuente: guion §8a del módulo 1; S&B p. 345 y Ejercicio 13.1
 * ===================================================================== */

describe("Módulo 1 · el óptimo estocástico del pasillo corto [C]", () => {
  test("C1-1: la forma cerrada de J y el sistema lineal de los n_i dan lo mismo en los 99 valores de p", () => {
    /* Dos caminos independientes: −(4−2p)/(p(1−p)) y la solución de
       (I − P)n = 1. Si coinciden, la forma cerrada del guion es correcta. */
    for (const p of P_M1) {
      cercaRel(valoresExactos(PASILLO, p).J, J(PASILLO, p), 1e-12, `pasillo J(p=${p})`);
      cercaRel(valoresExactos(CRUZ, p).J, J(CRUZ, p), 1e-12, `cruz J(p=${p})`);
    }
  });

  test("C1-2: el mejor p del pasillo es 2−√2 = 0,5857864… ([S&B] p. 345, «about 0.59»)", () => {
    const opt = optimoExacto(PASILLO);
    cerca(opt.p, P_ESTRELLA, 1e-10, "argmax_p J");
    assert.equal(opt.extremo, false, "el óptimo del pasillo con alias es interior");
    /* Y es un máximo de verdad: barrido fino alrededor. */
    for (const d of [-1e-3, -1e-4, 1e-4, 1e-3]) {
      assert.ok(J(PASILLO, P_ESTRELLA + d) < J(PASILLO, P_ESTRELLA), `J(p*+${d}) debería ser peor`);
    }
  });

  test("C1-3: max_p J = −(6+4√2) = −11,6569 ([S&B] p. 345, «about −11.6»)", () => {
    cerca(optimoExacto(PASILLO).J, V_ESTRELLA, 1e-10, "max J");
    cerca(J(PASILLO, P_ESTRELLA), V_ESTRELLA, 1e-10, "J(p*)");
  });

  test("C1-4: J(0,95) = −44,2105263… ([S&B] p. 345, «less than −44»)", () => {
    cerca(J(PASILLO, 0.95), -2.1 / 0.0475, 1e-10, "J(0,95)");
    cerca(J(PASILLO, 0.95), -44.21052631578947, 1e-10, "J(0,95)");
  });

  test("C1-5: J(0,05) = −82,1052631… ([S&B] p. 345, «and −82, respectively»)", () => {
    cerca(J(PASILLO, 0.05), -3.9 / 0.0475, 1e-10, "J(0,05)");
    cerca(J(PASILLO, 0.05), -82.10526315789474, 1e-10, "J(0,05)");
  });

  test("C1-6: J(0,5) = −12 exacto — el valor con θ = 0", () => {
    cerca(J(PASILLO, 0.5), -12, 1e-12, "J(0,5)");
    cerca(J(PASILLO, pDeTheta(PASILLO, new Float64Array(2))), -12, 1e-12, "J(θ=0)");
  });

  test("C1-7: J se dispara al menos como 1/min(p,1−p) en los extremos, y en p ∈ {0,1} vale −∞", () => {
    for (const p of [1e-3, 1e-6, 1 - 1e-3, 1 - 1e-6]) {
      const cota = 1 / Math.min(p, 1 - p);
      assert.ok(
        Math.abs(J(PASILLO, p)) >= cota,
        `|J(${p})| = ${Math.abs(J(PASILLO, p))} debería superar ${cota}`,
      );
    }
    assert.equal(J(PASILLO, 0), -Infinity, "J(0)");
    assert.equal(J(PASILLO, 1), -Infinity, "J(1)");
  });

  test("C1-8: con estados distinguibles el óptimo del pasillo es determinista y vale −3, y J_dist decrece", () => {
    const opt = optimoExacto(PASILLO_DIST);
    cerca(opt.J, -3, 1e-10, "supremo de J_dist");
    cerca(opt.p, 0, 1e-10, "p del supremo");
    assert.equal(opt.extremo, true, "el óptimo está en el borde del intervalo");
    for (let i = 1; i < P_M1.length; i++) {
      assert.ok(
        J(PASILLO_DIST, P_M1[i]) < J(PASILLO_DIST, P_M1[i - 1]),
        `J_dist debería decrecer entre ${P_M1[i - 1]} y ${P_M1[i]}`,
      );
    }
    /* Y el precio del aliasing: casi nueve pasos por episodio. */
    cerca(-3 - V_ESTRELLA, 8.65685424949238, 1e-10, "precio del aliasing");
  });

  test("C1-9: Σ_s η(s) es la longitud media del episodio y vale −J(p), en los 99 valores de p", () => {
    for (const p of P_M1) {
      const v = valoresExactos(PASILLO, p);
      cercaRel(v.longitudMedia, -J(PASILLO, p), 1e-12, `Σ η (p=${p})`);
    }
  });

  test("C1-10: μ del pasillo en p = 0,5 es (1/2, 1/3, 1/6)", () => {
    cercaVector(valoresExactos(PASILLO, 0.5).mu, [1 / 2, 1 / 3, 1 / 6], 1e-12, "μ(0,5)");
  });

  test("C1-11: μ(s₀) = 1/2 para TODO p — la mitad del tiempo se pasa en la primera celda", () => {
    for (const p of P_M1) cerca(valoresExactos(PASILLO, p).mu[0], 0.5, 1e-12, `μ(0) con p=${p}`);
  });

  test("C1-12: η en p* es (3+2√2, (4+3√2)/2, (2+√2)/2) y suma 6+4√2", () => {
    const v = valoresExactos(PASILLO, P_ESTRELLA);
    cercaVector(
      v.eta,
      [3 + 2 * Math.SQRT2, (4 + 3 * Math.SQRT2) / 2, (2 + Math.SQRT2) / 2],
      1e-10,
      "η(p*)",
    );
    cerca(v.longitudMedia, 6 + 4 * Math.SQRT2, 1e-10, "Σ η(p*)");
  });

  test("C1-13: en la rejilla en cruz el óptimo es p = 1/4 con J = −4 (entorno propio de la asignatura)", () => {
    const opt = optimoExacto(CRUZ);
    cerca(opt.p, 0.25, 1e-12, "argmax cruz");
    cerca(opt.J, -4, 1e-12, "max cruz");
    cerca(J(CRUZ, 0.25), -4, 1e-12, "J(1/4)");
    for (const d of [-0.01, 0.01]) {
      assert.ok(J(CRUZ, 0.25 + d) < -4, `J(1/4+${d}) debería ser peor que −4`);
    }
  });

  test("C1-14: μ de la cruz en p = 1/4 es la uniforme y η = (1,1,1,1)", () => {
    const v = valoresExactos(CRUZ, 0.25);
    cercaVector(v.mu, [0.25, 0.25, 0.25, 0.25], 1e-12, "μ cruz");
    cercaVector(v.eta, [1, 1, 1, 1], 1e-12, "η cruz");
  });

  test("C1-15: con brazos distinguibles el óptimo de la cruz es −1 en p = 1", () => {
    const opt = optimoExacto(CRUZ_DIST);
    cerca(opt.p, 1, 1e-12, "p del óptimo");
    cerca(opt.J, -1, 1e-12, "J del óptimo");
    assert.equal(opt.extremo, true, "está en el borde");
  });

  test("C1-16: la softmax suma exactamente 1 con ‖θ‖ hasta 10³ ([S&B] ec. 13.2) — obliga a restar el máximo", () => {
    const rng = generador(11);
    for (const [nombre, entorno] of CUATRO) {
      for (let k = 0; k < 250; k++) {
        const escala = Math.pow(10, 3 * rng.uniforme());
        const theta = new Float64Array(entorno.dPrima);
        for (let i = 0; i < theta.length; i++) theta[i] = escala * (2 * rng.uniforme() - 1);
        const pi = probabilidades(entorno, theta, 1);
        let suma = 0;
        for (const x of pi) {
          assert.ok(Number.isFinite(x) && x >= 0, `${nombre}: componente ${x} de π`);
          suma += x;
        }
        cerca(suma, 1, 1e-15, `${nombre}: Σ π con ‖θ‖ ≈ ${escala.toFixed(0)}`);
      }
    }
  });

  test("C1-17: con dos acciones la softmax ES la logística de la diferencia de preferencias ([S&B] Ej. 13.5a)", () => {
    const rng = generador(13);
    for (let k = 0; k < 200; k++) {
      const z = 20 * (2 * rng.uniforme() - 1);
      const theta = Float64Array.from([z / 2, -z / 2]);
      const logistica = 1 / (1 + Math.exp(-z));
      cerca(pDeTheta(PASILLO, theta), logistica, 1e-14, `σ(θ_r−θ_ℓ) con z=${z}`);
      cerca(softmax(theta)[0], logistica, 1e-14, `softmax con z=${z}`);
    }
    /* Y la vuelta: thetaDeP invierte la logística. */
    for (const p of P_M1) cerca(pDeTheta(PASILLO, thetaDeP(PASILLO, p)), p, 1e-14, `p→θ→p (${p})`);
  });

  test("módulo 1: es forma cerrada — ninguna de sus funciones toca el generador", () => {
    /* El guion (§8b del módulo 1) pide que dos semillas den lo mismo. Aquí es
       más fuerte: se les pasa un rng que LANZA, y ninguna lo llama. */
    assert.doesNotThrow(() => {
      J(PASILLO, 0.3);
      optimoExacto(PASILLO);
      valoresExactos(PASILLO, 0.3);
      probabilidades(PASILLO, thetaDeP(PASILLO, 0.3), 0);
      PASILLO.inicio(RNG_PROHIBIDO);
    });
  });
});

/* ===================================================================== *
 * MÓDULO 2 · El teorema del gradiente, término a término   [C]
 * Fuente: guion §8a del módulo 2; S&B ecs. (13.5) y (13.9), §9.2
 * ===================================================================== */

describe("Módulo 2 · el teorema del gradiente de la política [C]", () => {
  test("C2-1: ∇J(θ) por diferencias finitas = C · RHS de (13.5), en los 91 valores de p", () => {
    /* Los dos lados se calculan por caminos que no comparten nada: el
       izquierdo no usa μ, ni q_π, ni ∇π. La tolerancia 10⁻⁶ es la del método
       de diferencias finitas con h = 10⁻⁵, NO la del teorema. */
    for (const p of P_M2) {
      const theta = thetaDeP(PASILLO, p);
      const grad = gradienteJ(PASILLO, theta);
      const rhs = ladoDerechoTeorema(PASILLO, theta);
      const c = constanteProporcionalidad(PASILLO, theta);
      for (let i = 0; i < 2; i++) cercaRel(grad[i], c * rhs[i], 1e-6, `∇J[${i}] (p=${p})`);
    }
  });

  test("C2-2: el factor que separa los dos lados es exactamente Σ_s η(s) = −J(θ) ([S&B] §13.2)", () => {
    for (const p of P_M2) {
      const theta = thetaDeP(PASILLO, p);
      const cociente = gradienteJ(PASILLO, theta)[0] / ladoDerechoTeorema(PASILLO, theta)[0];
      cercaRel(cociente, constanteProporcionalidad(PASILLO, theta), 1e-6, `cociente (p=${p})`);
      cercaRel(constanteProporcionalidad(PASILLO, theta), -J(PASILLO, p), 1e-12, `Σ η (p=${p})`);
    }
  });

  test("C2-3: en p = 0,5 el gradiente vale [2, −2]", () => {
    cercaVector(gradienteJ(PASILLO, thetaDeP(PASILLO, 0.5)), [2, -2], 1e-6, "∇J(0,5)");
  });

  test("C2-4: en p = 0,5 el lado derecho de (13.5) vale [1/6, −1/6]", () => {
    cercaVector(
      ladoDerechoTeorema(PASILLO, thetaDeP(PASILLO, 0.5)),
      [1 / 6, -1 / 6],
      1e-12,
      "RHS(0,5)",
    );
  });

  test("C2-5: en p = 0,5 la constante de proporcionalidad vale 12 — los 12 pasos del episodio medio", () => {
    cerca(constanteProporcionalidad(PASILLO, thetaDeP(PASILLO, 0.5)), 12, 1e-12, "C");
    cerca(valoresExactos(PASILLO, 0.5).n[0], 12, 1e-12, "n₀");
  });

  test("C2-6: en p = 0,5 los seis q_π son (−11,−13), (−13,−7), (−1,−11)", () => {
    const v = valoresExactos(PASILLO, 0.5);
    cercaVector(v.q[0], [-11, -13], 1e-12, "q(0,·)");
    cercaVector(v.q[1], [-13, -7], 1e-12, "q(1,·)");
    cercaVector(v.q[2], [-1, -11], 1e-12, "q(2,·)");
    cercaVector(v.v, [-12, -10, -6], 1e-12, "v_π");
  });

  test("C2-7: en p = 0,5, Σ_s η(s)Δq(s) = 8 = J'(0,5)", () => {
    const v = valoresExactos(PASILLO, 0.5);
    let suma = 0;
    for (let s = 0; s < 3; s++) suma += v.eta[s] * (v.q[s][0] - v.q[s][1]);
    cerca(suma, 8, 1e-12, "Σ η Δq");
    const h = 1e-5;
    cerca((J(PASILLO, 0.5 + h) - J(PASILLO, 0.5 - h)) / (2 * h), 8, 1e-6, "J'(0,5)");
  });

  test("C2-8: la ec. (13.9) coincide con las diferencias finitas de ln π, en 91 p × 2 acciones", () => {
    const h = 1e-5;
    for (const p of P_M2) {
      const theta = thetaDeP(PASILLO, p);
      for (let a = 0; a < 2; a++) {
        const grad = gradLogPi(PASILLO, theta, 1, a);
        for (let i = 0; i < 2; i++) {
          const mas = Float64Array.from(theta); mas[i] += h;
          const menos = Float64Array.from(theta); menos[i] -= h;
          const fd = (Math.log(probabilidades(PASILLO, mas, 1)[a])
            - Math.log(probabilidades(PASILLO, menos, 1)[a])) / (2 * h);
          cerca(grad[i], fd, 1e-6, `∇lnπ(a=${a})[${i}] (p=${p})`);
        }
      }
    }
  });

  test("C2-9: ∇lnπ(der) = (1−p)[1,−1] y ∇lnπ(izq) = p[−1,1] — los dos múltiplos de [1,−1]", () => {
    for (const p of P_M2) {
      const theta = thetaDeP(PASILLO, p);
      for (let s = 0; s < 3; s++) {
        cercaVector(gradLogPi(PASILLO, theta, s, 0), [1 - p, -(1 - p)], 1e-14, `der en s=${s}, p=${p}`);
        cercaVector(gradLogPi(PASILLO, theta, s, 1), [-p, p], 1e-14, `izq en s=${s}, p=${p}`);
      }
    }
  });

  test("C2-10: Σ_a ∇π(a|s,θ) = [0,0] exacto — la identidad que sostiene la línea base ([S&B] §13.4)", () => {
    for (const p of P_M2) {
      const theta = thetaDeP(PASILLO, p);
      for (let s = 0; s < 3; s++) {
        const pi = probabilidades(PASILLO, theta, s);
        const suma = new Float64Array(2);
        for (let a = 0; a < 2; a++) {
          const g = gradLogPi(PASILLO, theta, s, a);
          for (let i = 0; i < 2; i++) suma[i] += pi[a] * g[i];
        }
        cercaVector(suma, [0, 0], 1e-15, `Σ_a ∇π (s=${s}, p=${p})`);
      }
    }
  });

  test("C2-11: θ_r + θ_ℓ es invariante bajo cualquier incremento de REINFORCE (1 000 incrementos)", () => {
    const rng = generador(17);
    for (let k = 0; k < 1000; k++) {
      const theta = Float64Array.from([6 * rng.uniforme() - 3, 6 * rng.uniforme() - 3]);
      const suma0 = theta[0] + theta[1];
      const s = rng.entero(3);
      const a = rng.entero(2);
      const G = -200 * rng.uniforme();
      const alpha = Math.pow(2, -9);
      const g = gradLogPi(PASILLO, theta, s, a);
      const nuevo = Float64Array.from([theta[0] + alpha * G * g[0], theta[1] + alpha * G * g[1]]);
      cerca(nuevo[0] + nuevo[1], suma0, 1e-12, `Σθ tras el incremento ${k}`);
    }
  });

  test("C2-12: ∇J(θ) = [0,0] en p = 2−√2 — el máximo, y coincide con C1-2", () => {
    cercaVector(gradienteJ(PASILLO, thetaDeP(PASILLO, P_ESTRELLA)), [0, 0], 1e-6, "∇J(p*)");
  });

  test("C2-13: Σ_s μ(s) = 1 en los 91 valores de p", () => {
    for (const p of P_M2) {
      cerca(media(valoresExactos(PASILLO, p).mu) * 3, 1, 1e-14, `Σ μ (p=${p})`);
    }
  });
});

/* ===================================================================== *
 * MÓDULO 3 · REINFORCE   [C]
 * Fuente: guion §8a del módulo 3; S&B p. 350
 * ===================================================================== */

describe("Módulo 3 · REINFORCE, el estimador correcto y lento [C]", () => {
  test("C3-1: E[G₀] con θ = 0 es J(0,5) = −12", () => {
    cerca(J(PASILLO, pDeTheta(PASILLO, new Float64Array(2))), -12, 1e-12, "E[G₀] con θ=0");
  });

  test("C3-2: G_t por suma acumulada = −(T−t), sobre 200 episodios sembrados (γ = 1, r = −1)", () => {
    const theta = thetaDeP(PASILLO, P0);
    for (const ep of episodiosSembrados(PASILLO, theta, 200, { maxPasos: 500 })) {
      const G = retornos(ep.recompensas, 1);
      for (let t = 0; t < ep.T; t++) cerca(G[t], -(ep.T - t), 1e-12, `G_${t} (T=${ep.T})`);
    }
  });

  test("C3-3: θ_r + θ_ℓ sigue valiendo 0 al final de las 100 ejecuciones, con las dos inicializaciones", () => {
    for (const p0 of [P0, 0.5]) {
      const r = tandaCache({
        entorno: "pasilloCorto", algoritmo: "reinforce", episodios: 1000, ejecuciones: 100,
        semilla: SEMILLA, p0, alphaTheta: Math.pow(2, -13), maxPasos: 500,
      });
      for (const theta of r.porEjecucion.reinforce.thetaFinal) {
        cerca(theta[0] + theta[1], 0, 1e-9, `Σθ final con p₀=${p0}`);
      }
    }
  });

  test("C3-4: p₀ = 0,05 corresponde a θ = [−½ln19, +½ln19] y produce exactamente 0,05", () => {
    const theta = thetaDeP(PASILLO, P0);
    cercaVector(theta, [-0.5 * Math.log(19), 0.5 * Math.log(19)], 1e-14, "θ₀");
    cercaVector(theta, [-1.4722194895832204, 1.4722194895832204], 1e-10, "θ₀ numérico");
    cerca(pDeTheta(PASILLO, theta), 0.05, 1e-14, "p(θ₀)");
    cerca(theta[0] + theta[1], 0, 1e-15, "es simétrica: Σθ = 0");
  });

  test("C3-5: E[G₀] con p₀ = 0,05 es J(0,05) = −82,105 ([S&B] p. 345)", () => {
    cerca(J(PASILLO, P0), -82.10526315789474, 1e-10, "J(0,05)");
  });

  test("C3-6: con γ = 1 llevar o no el factor γ^t da la MISMA trayectoria; con γ = 0,9, no ([S&B] p. 350)", () => {
    const theta0 = thetaDeP(PASILLO, P0);
    const eps = episodiosSembrados(PASILLO, theta0, 300, { maxPasos: 500 });
    const opciones = { alphaTheta: Math.pow(2, -13), base: "cero" };
    const con1 = reinforceLineaBase(PASILLO, theta0, eps, { ...opciones, gamma: 1, usarGammaT: true });
    const sin1 = reinforceLineaBase(PASILLO, theta0, eps, { ...opciones, gamma: 1, usarGammaT: false });
    identicos(con1.curvaP, sin1.curvaP, "γ = 1: la trayectoria de p");
    cercaVector(con1.theta, sin1.theta, 1e-15, "γ = 1: θ final");

    const con09 = reinforceLineaBase(PASILLO, theta0, eps, { ...opciones, gamma: 0.9, usarGammaT: true });
    const sin09 = reinforceLineaBase(PASILLO, theta0, eps, { ...opciones, gamma: 0.9, usarGammaT: false });
    assert.ok(
      Math.abs(con09.theta[0] - sin09.theta[0]) > 1e-6,
      `γ = 0,9: omitir γ^t da OTRO algoritmo, y aquí θ apenas difiere (${con09.theta[0]} vs ${sin09.theta[0]})`,
    );
  });

  test("C3-7: la softmax de dos acciones suma 1 sin NaN con |θ_r−θ_ℓ| hasta 10³", () => {
    const rng = generador(19);
    for (let k = 0; k < 500; k++) {
      const z = Math.pow(10, 3 * rng.uniforme()) * (rng.uniforme() < 0.5 ? -1 : 1);
      const pi = softmax(Float64Array.from([z / 2, -z / 2]));
      assert.ok(Number.isFinite(pi[0]) && Number.isFinite(pi[1]), `π con z=${z} no es finita`);
      cerca(pi[0] + pi[1], 1, 1e-15, `Σ π con z=${z}`);
    }
  });

  test("C3-8: dos tandas con la misma semilla y la misma configuración son idénticas bit a bit", () => {
    const config = {
      entorno: "pasilloCorto", algoritmo: "reinforce", episodios: 200, ejecuciones: 5,
      semilla: SEMILLA, p0: P0, alphaTheta: Math.pow(2, -12), maxPasos: 500,
    };
    const a = tanda(config);
    const b = tanda(config);
    identicos(a.curvas["reinforce.G0"], b.curvas["reinforce.G0"], "curva de G₀");
    identicos(a.curvas["reinforce.p"], b.curvas["reinforce.p"], "curva de p");
    assert.equal(a.truncados.reinforce, b.truncados.reinforce, "truncados");
  });
});

/* ===================================================================== *
 * MÓDULO 4 · La línea base   [C]
 * Fuente: guion §8a del módulo 4; S&B §13.4, p. 351
 * ===================================================================== */

describe("Módulo 4 · qué toca y qué no toca una línea base [C]", () => {
  test("C4-1: E[g] con b = 0 y con b = v_π(s) es la MISMA, en 3 estados × 91 valores de p ([S&B] §13.4)", () => {
    for (const p of P_M2) {
      const theta = thetaDeP(PASILLO, p);
      const v = valoresExactos(PASILLO, p);
      for (let s = 0; s < 3; s++) {
        const sin = mediaVarianzaTermino(PASILLO, theta, s, 0).media;
        const con = mediaVarianzaTermino(PASILLO, theta, s, v.v[s]).media;
        cerca(con, sin, 1e-13, `E[g] (s=${s}, p=${p})`);
      }
    }
  });

  test("C4-2: E[g] no depende de b: 20 constantes entre −100 y +100 dan la misma media", () => {
    const theta = thetaDeP(PASILLO, 0.35);
    for (let s = 0; s < 3; s++) {
      const referencia = mediaVarianzaTermino(PASILLO, theta, s, 0).media;
      for (let k = 0; k < 20; k++) {
        const b = -100 + (200 * k) / 19;
        cerca(mediaVarianzaTermino(PASILLO, theta, s, b).media, referencia, 1e-13, `E[g] con b=${b}`);
      }
    }
  });

  test("C4-3: Σ_a ∇π(a|s,θ) = [0,0] exacto — b(s)∇1 = 0 ([S&B] §13.4, p. 351)", () => {
    for (const p of [0.05, 0.5, P_ESTRELLA, 0.95]) {
      const theta = thetaDeP(PASILLO, p);
      for (let s = 0; s < 3; s++) {
        const pi = probabilidades(PASILLO, theta, s);
        const suma = new Float64Array(2);
        for (let a = 0; a < 2; a++) {
          const g = gradLogPi(PASILLO, theta, s, a);
          for (let i = 0; i < 2; i++) suma[i] += pi[a] * g[i];
        }
        cercaVector(suma, [0, 0], 1e-15, `Σ_a ∇π (s=${s}, p=${p})`);
      }
    }
  });

  test("C4-4: en p = 0,5 la varianza de g con b = 0 vale 36, 25 y 9", () => {
    const theta = thetaDeP(PASILLO, 0.5);
    const esperado = [36, 25, 9];
    for (let s = 0; s < 3; s++) {
      cerca(mediaVarianzaTermino(PASILLO, theta, s, 0).varianza, esperado[s], 1e-12, `Var (s=${s})`);
    }
  });

  test("C4-5: en p = 0,5 la varianza con b = v_π(s) es CERO en los tres estados", () => {
    /* Con p = 1/2 y dos acciones, v_π es la línea base óptima y hace g
       constante. La varianza sale 0 exacta, no «pequeña». */
    const theta = thetaDeP(PASILLO, 0.5);
    const v = valoresExactos(PASILLO, 0.5);
    for (let s = 0; s < 3; s++) {
      cerca(mediaVarianzaTermino(PASILLO, theta, s, v.v[s]).varianza, 0, 1e-12, `Var con b=v_π (s=${s})`);
    }
  });

  test("C4-6: en p = 0,5 la varianza media ponderada por μ vale 167/6 = 27,8333", () => {
    const theta = thetaDeP(PASILLO, 0.5);
    const v = valoresExactos(PASILLO, 0.5);
    let total = 0;
    for (let s = 0; s < 3; s++) total += v.mu[s] * mediaVarianzaTermino(PASILLO, theta, s, 0).varianza;
    cerca(total, 167 / 6, 1e-12, "Var ponderada");
  });

  test("C4-7: b*(s) = v_π(s) SOLO si p = 1/2 — en p = 2−√2 son distintos", () => {
    const v05 = valoresExactos(PASILLO, 0.5);
    const t05 = thetaDeP(PASILLO, 0.5);
    for (let s = 0; s < 3; s++) {
      cerca(mediaVarianzaTermino(PASILLO, t05, s, 0).bOptimo, v05.v[s], 1e-12, `b* en p=0,5 (s=${s})`);
    }
    const ve = valoresExactos(PASILLO, P_ESTRELLA);
    const te = thetaDeP(PASILLO, P_ESTRELLA);
    for (let s = 0; s < 3; s++) {
      const b = mediaVarianzaTermino(PASILLO, te, s, 0).bOptimo;
      assert.ok(
        Math.abs(b - ve.v[s]) > 1e-3,
        `b*(${s}) = ${b} y v_π(${s}) = ${ve.v[s]} deberían diferir en p = 2−√2`,
      );
    }
  });

  test("C4-8: una línea base que SÍ depende de la acción desplaza E[g] en −p(1−p)(b_der−b_izq)", () => {
    const rng = generador(23);
    for (let k = 0; k < 50; k++) {
      const bDer = -100 + 200 * rng.uniforme();
      const bIzq = -100 + 200 * rng.uniforme();
      const vector = Float64Array.from([bDer, bIzq]);
      for (const p of P_M2) {
        const theta = thetaDeP(PASILLO, p);
        for (let s = 0; s < 3; s++) {
          const sin = mediaVarianzaTermino(PASILLO, theta, s, 0).media;
          const con = mediaVarianzaTermino(PASILLO, theta, s, vector).media;
          cerca(con - sin, -p * (1 - p) * (bDer - bIzq), 1e-13, `desplazamiento (s=${s}, p=${p})`);
        }
      }
    }
  });

  test("C4-9: con la línea base POR ACCIÓN en su equilibrio, la actualización esperada es CERO para todo p", () => {
    /* La aserción central del módulo. Ojo: «esperada cero» NO es «quieta» —
       ver R4-6 y R4-7, que miden lo que hace de verdad. Los dos tests son
       compatibles y hay que leerlos juntos. */
    for (const p of P_M2) {
      const theta = thetaDeP(PASILLO, p);
      const { deltaTheta } = actualizacionEsperada(PASILLO, theta, { uso: "baseAccion", w: null });
      cercaVector(deltaTheta, [0, 0], 1e-11, `E[Δθ] con base por acción (p=${p})`);
    }
  });

  test("C4-10: con una línea base constante cualquiera, la actualización esperada es ∇J(θ) ([S&B] 13.10-13.11)", () => {
    for (const p of P_M2) {
      const theta = thetaDeP(PASILLO, p);
      const grad = gradienteJ(PASILLO, theta);
      for (const w of [0, -31 / 3, -80]) {
        const { deltaTheta } = actualizacionEsperada(PASILLO, theta, { uso: "lineaBase", w });
        for (let i = 0; i < 2; i++) cercaRel(deltaTheta[i], grad[i], 1e-6, `E[Δθ][${i}] (p=${p}, w=${w})`);
      }
    }
  });

  test("C4-11: el equilibrio de la línea base por acción en p = 0,5 es (−10, −32/3), diferencia 2/3", () => {
    const { wPuntoFijo } = actualizacionEsperada(PASILLO, thetaDeP(PASILLO, 0.5), { uso: "baseAccion" });
    cercaVector(wPuntoFijo, [-10, -32 / 3], 1e-12, "w por acción");
    cerca(wPuntoFijo[0] - wPuntoFijo[1], 2 / 3, 1e-12, "b(der) − b(izq)");
  });

  test("C4-12: el equilibrio de la línea base de ESTADO en p = 0,5 es Σμv = −31/3 (≠ −32/3 de C4-11)", () => {
    const { wPuntoFijo } = actualizacionEsperada(PASILLO, thetaDeP(PASILLO, 0.5), { uso: "lineaBase" });
    cerca(wPuntoFijo, -31 / 3, 1e-12, "w de estado");
    assert.ok(Math.abs(wPuntoFijo - (-32 / 3)) > 0.3, "no confundir −31/3 con −32/3");
  });

  test("C4-13: θ_r + θ_ℓ es invariante al final de cada ejecución en las TRES variantes", () => {
    for (const base of ["cero", "estado", "accion"]) {
      const { detalle } = M4(base);
      for (const theta of detalle.thetaFinal) {
        cerca(theta[0] + theta[1], 0, 1e-9, `Σθ final (base ${base})`);
      }
    }
  });

  test("C4-14: dos ejecuciones idénticas con la misma semilla dan curvas idénticas (no: los mismos episodios)", () => {
    /* ⚠ Lo que se comprueba es que la MISMA configuración con la MISMA semilla
       es determinista. NO se comprueba que dos variantes DISTINTAS vean los
       mismos episodios: eso es imposible en REINFORCE, porque los episodios
       los genera la política que se está actualizando. */
    const config = {
      entorno: "pasilloCorto", algoritmo: "reinforce", episodios: 300, ejecuciones: 4,
      semilla: SEMILLA, p0: P0, alphaTheta: Math.pow(2, -9), maxPasos: 500,
    };
    const a = tanda(config);
    const b = tanda(config);
    cercaVector(a.curvas["reinforce.G0"], b.curvas["reinforce.G0"], 1e-12, "curva de G₀");
    identicos(a.curvas["reinforce.p"], b.curvas["reinforce.p"], "curva de p");
  });
});

/* ===================================================================== *
 * MÓDULO 5 · Actor-crítico   [C]
 * Fuente: guion §8a del módulo 5; S&B §13.5, pp. 353-354
 * ===================================================================== */

describe("Módulo 5 · el mismo número, como línea base y como crítico [C]", () => {
  test("C5-1: como LÍNEA BASE, la actualización esperada es ∇J(θ) sea cual sea w (20 w × 91 p)", () => {
    for (const p of P_M2) {
      const theta = thetaDeP(PASILLO, p);
      const grad = gradienteJ(PASILLO, theta);
      for (let k = 0; k < 20; k++) {
        const w = -100 + (100 * k) / 19;
        const { deltaTheta } = actualizacionEsperada(PASILLO, theta, { uso: "lineaBase", w });
        for (let i = 0; i < 2; i++) cercaRel(deltaTheta[i], grad[i], 1e-6, `E[Δθ][${i}] (p=${p}, w=${w})`);
      }
    }
  });

  test("C5-2: como CRÍTICO con d = 1, la actualización esperada es (1−p)(−w)[1,−1] (91 p × 20 w)", () => {
    for (const p of P_M2) {
      const theta = thetaDeP(PASILLO, p);
      for (let k = 0; k < 20; k++) {
        const w = -100 + (100 * k) / 19;
        const { deltaTheta } = actualizacionEsperada(PASILLO, theta, { uso: "critico", w });
        cercaVector(deltaTheta, [(1 - p) * -w, -((1 - p) * -w)], 1e-11, `E[Δθ] (p=${p}, w=${w})`);
      }
    }
  });

  test("C5-3: el punto fijo del crítico con d = 1 es w = J(p) = −n₀; en p = 0,5 vale −12", () => {
    for (const p of P_M2) {
      const { wPuntoFijo } = actualizacionEsperada(PASILLO, thetaDeP(PASILLO, p), { uso: "critico" });
      cercaRel(wPuntoFijo, J(PASILLO, p), 1e-10, `w* (p=${p})`);
    }
    cerca(
      actualizacionEsperada(PASILLO, thetaDeP(PASILLO, 0.5), { uso: "critico" }).wPuntoFijo,
      -12, 1e-10, "w* en p=0,5",
    );
  });

  test("C5-4: con el crítico de un número en su punto fijo, la actualización esperada SUBE p en los 91 puntos", () => {
    /* Consecuencia algebraica de C5-2 y C5-3, no una observación empírica:
       (1−p) > 0 y −w = n₀ > 0. No hay punto fijo conjunto. */
    for (const p of P_M2) {
      const { deltaTheta } = actualizacionEsperada(PASILLO, thetaDeP(PASILLO, p), { uso: "critico", w: null });
      assert.ok(deltaTheta[0] > 0, `E[Δθ]₁ = ${deltaTheta[0]} debería ser positiva (p=${p})`);
      assert.ok(deltaTheta[1] < 0, `E[Δθ]₂ = ${deltaTheta[1]} debería ser negativa (p=${p})`);
    }
  });

  test("C5-5: con un peso por estado en su punto fijo, la actualización esperada vuelve a ser ∇J(θ)", () => {
    for (const p of P_M2) {
      const theta = thetaDeP(PASILLO, p);
      const v = valoresExactos(PASILLO, p);
      const grad = gradienteJ(PASILLO, theta);
      const { deltaTheta } = actualizacionEsperada(PASILLO, theta, { uso: "critico", w: v.v });
      for (let i = 0; i < 2; i++) cercaRel(deltaTheta[i], grad[i], 1e-6, `E[Δθ][${i}] (p=${p})`);
    }
    /* Y se anula en 2−√2, como ∇J. */
    const ve = valoresExactos(PASILLO, P_ESTRELLA);
    const de = actualizacionEsperada(PASILLO, thetaDeP(PASILLO, P_ESTRELLA), { uso: "critico", w: ve.v });
    cercaVector(de.deltaTheta, [0, 0], 1e-6, "E[Δθ] en p*");
  });

  test("C5-6: el punto fijo de TD(0) con one-hot es v_π = (−12,−10,−6) en p = 0,5", () => {
    const { wPuntoFijo } = actualizacionEsperada(PASILLO, thetaDeP(PASILLO, 0.5), {
      uso: "critico", w: new Float64Array(3),
    });
    cercaVector(wPuntoFijo, [-12, -10, -6], 1e-9, "w* por estado");
    for (const p of [0.2, 0.5, P_ESTRELLA, 0.8]) {
      const v = valoresExactos(PASILLO, p);
      const fijo = actualizacionEsperada(PASILLO, thetaDeP(PASILLO, p), {
        uso: "critico", w: new Float64Array(3),
      }).wPuntoFijo;
      cercaVector(fijo, Array.from(v.v), 1e-9, `w* = v_π (p=${p})`);
    }
  });

  test("C5-7: con γ = 1 el acumulador I no cambia nada; con γ = 0,9 sí ([S&B] recuadro p. 354)", () => {
    const theta0 = thetaDeP(PASILLO, P0);
    const opciones = { alphaTheta: Math.pow(2, -9), alphaW: Math.pow(2, -6), maxPasos: 1000 };
    const conI = actorCritico(PASILLO, theta0, 200, { ...opciones, gamma: 1, usarI: true, rng: generador(SEMILLA) });
    const sinI = actorCritico(PASILLO, theta0, 200, { ...opciones, gamma: 1, usarI: false, rng: generador(SEMILLA) });
    identicos(conI.curvaP, sinI.curvaP, "γ = 1: trayectoria de p");
    cercaVector(conI.theta, sinI.theta, 1e-15, "γ = 1: θ final");

    const conI9 = actorCritico(PASILLO, theta0, 200, { ...opciones, gamma: 0.9, usarI: true, rng: generador(SEMILLA) });
    const sinI9 = actorCritico(PASILLO, theta0, 200, { ...opciones, gamma: 0.9, usarI: false, rng: generador(SEMILLA) });
    assert.ok(
      Math.abs(conI9.theta[0] - sinI9.theta[0]) > 1e-6,
      `γ = 0,9: con y sin I deberían separarse (${conI9.theta[0]} vs ${sinI9.theta[0]})`,
    );
  });

  test("C5-8: con d = 1 y γ = 1, δ vale −1 en toda transición salvo (estado 2, derecha), donde vale −1−w", () => {
    /* Es la observación que explica el módulo entero: el único paso que lleva
       información es el que entra en la meta, y lo hace porque v̂(terminal) ≐ 0. */
    for (const w of [-12, -82.1, 0, -5]) {
      for (let s = 0; s < 3; s++) {
        for (let a = 0; a < 2; a++) {
          const { s2, r } = PASILLO.paso(s, a);
          const delta = r + (PASILLO.esTerminal(s2) ? 0 : w) - w;
          const esperado = (s === 2 && a === 0) ? -1 - w : -1;
          cerca(delta, esperado, 1e-12, `δ(s=${s}, a=${a}, w=${w})`);
        }
      }
    }
  });

  test("C5-9: v̂(terminal, w) ≐ 0 en las dos capacidades — el terminal vive fuera del vector de pesos", () => {
    assert.equal(PASILLO.nEstados, 3, "nEstados cuenta solo los NO terminales");
    assert.equal(PASILLO.terminal, 3, "el terminal del pasillo es el índice 3");
    assert.equal(CRUZ.nEstados, 4, "nEstados de la cruz");
    assert.equal(CRUZ.terminal, 4, "el terminal de la cruz");
    const porEstado = actorCritico(PASILLO, thetaDeP(PASILLO, P0), 20, {
      alphaTheta: Math.pow(2, -9), alphaW: Math.pow(2, -4), capacidad: "porEstado",
      rng: generador(SEMILLA), maxPasos: 1000,
    });
    assert.equal(porEstado.w.length, 3, "el crítico por estado tiene 3 pesos, no 4");
    /* Si v̂(terminal) no fuese 0, C5-2 no saldría: se comprueba ahí. */
    const { deltaTheta } = actualizacionEsperada(PASILLO, thetaDeP(PASILLO, 0.4), { uso: "critico", w: -20 });
    cercaVector(deltaTheta, [0.6 * 20, -0.6 * 20], 1e-11, "E[Δθ] depende de v̂(terminal)=0");
  });

  test("C5-10: con el crítico de un número y w = 0, la actualización esperada es [0,0]", () => {
    for (const p of [0.05, 0.3, 0.5, P_ESTRELLA, 0.9]) {
      const { deltaTheta } = actualizacionEsperada(PASILLO, thetaDeP(PASILLO, p), { uso: "critico", w: 0 });
      cercaVector(deltaTheta, [0, 0], 1e-12, `E[Δθ] con w=0 (p=${p})`);
    }
  });

  test("C5-11: θ_r + θ_ℓ es invariante en las cuatro combinaciones (uso × capacidad)", () => {
    for (const algoritmo of ["lineaBase", "actorCritico"]) {
      for (const capacidad of ["unNumero", "porEstado"]) {
        const { detalle } = M5(algoritmo, capacidad);
        for (const theta of detalle.thetaFinal) {
          cerca(theta[0] + theta[1], 0, 1e-9, `Σθ final (${algoritmo}, ${capacidad})`);
        }
      }
    }
  });

  test("C5-12: con α^w = 0 y w₀ = 0 las dos variantes NO son iguales, y difieren como predice §6", () => {
    /* Con w congelado en 0 la línea base da REINFORCE puro, y el crítico da
       δ = −1 en cada paso: esperanza cero (C5-10) pero muestra a muestra no. */
    const theta0 = thetaDeP(PASILLO, P0);
    const opciones = { alphaTheta: Math.pow(2, -9), alphaW: 0, w0: 0, maxPasos: 1000 };
    const lb = reinforceLineaBase(PASILLO, theta0, 200, { ...opciones, base: "estado", rng: generador(SEMILLA) });
    const ac = actorCritico(PASILLO, theta0, 200, { ...opciones, rng: generador(SEMILLA) });
    assert.notEqual(
      primeraDiferencia(lb.curvaP, ac.curvaP), -1,
      "con w congelado en 0 las dos variantes deberían separarse",
    );
    /* La esperanza del incremento del crítico es cero… */
    cercaVector(
      actualizacionEsperada(PASILLO, theta0, { uso: "critico", w: 0 }).deltaTheta,
      [0, 0], 1e-12, "E[Δθ] del crítico con w=0",
    );
    /* …y aun así θ se mueve, en la dirección [1,−1] como todo incremento. */
    assert.ok(Math.abs(ac.theta[0] - theta0[0]) > 1e-12, "el crítico con w = 0 no se queda quieto");
    cerca(ac.theta[0] + ac.theta[1], 0, 1e-9, "y lo hace conservando Σθ");
  });
});

/* ===================================================================== *
 * MÓDULO 6 · El colapso y el freno   [C]
 * Fuente: guion §8a del módulo 6, derivaciones de su §6
 * ===================================================================== */

describe("Módulo 6 · el colapso de la política, y el freno [C]", () => {
  test("C6-1: D_KL(p ‖ p) = 0 en los 91 valores de p", () => {
    for (const p of P_M2) {
      const theta = thetaDeP(PASILLO, p);
      cerca(klPolitica(PASILLO, theta, theta), 0, 1e-14, `D_KL(p‖p) (p=${p})`);
    }
  });

  test("C6-2: D_KL crece estrictamente a lo largo del rayo θ_ant + τΔθ — es lo que valida la bisección", () => {
    const rng = generador(29);
    for (let k = 0; k < 50; k++) {
      const thetaAnt = Float64Array.from([6 * rng.uniforme() - 3, 6 * rng.uniforme() - 3]);
      const delta = Float64Array.from([20 * rng.uniforme() - 10, 20 * rng.uniforme() - 10]);
      let anterior = -1;
      for (let i = 0; i <= 200; i++) {
        const tau = i / 200;
        const candidato = Float64Array.from([
          thetaAnt[0] + tau * delta[0], thetaAnt[1] + tau * delta[1],
        ]);
        const kl = klPolitica(PASILLO, thetaAnt, candidato);
        assert.ok(kl >= anterior - 1e-15, `D_KL cae de ${anterior} a ${kl} en τ=${tau} (caso ${k})`);
        anterior = kl;
      }
    }
  });

  test("C6-3: cuando hay que recortar, la bisección devuelve τ con D_KL(τ) = δ (50 casos)", () => {
    const rng = generador(31);
    let recortados = 0;
    for (let k = 0; k < 50; k++) {
      const thetaAnt = Float64Array.from([3 * rng.uniforme() - 1.5, 3 * rng.uniforme() - 1.5]);
      const escala = 5 + 50 * rng.uniforme();
      const delta = Float64Array.from([escala, -escala]);
      const r = recorteRegion(PASILLO, thetaAnt, delta, 1e-2);
      if (!r.recortado) continue;
      recortados += 1;
      cerca(r.kl, 1e-2, 1e-10, `D_KL(τ) (caso ${k})`);
      assert.ok(r.tau > 0 && r.tau < 1, `τ = ${r.tau} debería estar en (0,1)`);
    }
    assert.ok(recortados >= 45, `se esperaban recortes en casi todos los casos, hubo ${recortados}`);
  });

  test("C6-4: si el paso entero ya cabe, τ = 1 EXACTO y no se cuenta como recorte", () => {
    const thetaAnt = thetaDeP(PASILLO, 0.4);
    const minimo = Float64Array.from([1e-6, -1e-6]);
    const r = recorteRegion(PASILLO, thetaAnt, minimo, 1e-2);
    assert.equal(r.tau, 1, "τ debería ser 1 exacto");
    assert.equal(r.recortado, false, "no se cuenta como recorte");
    const nulo = recorteRegion(PASILLO, thetaAnt, new Float64Array(2), 1e-2);
    assert.equal(nulo.tau, 1, "con Δθ = 0, τ = 1");
    assert.equal(nulo.kl, 0, "con Δθ = 0, D_KL = 0");
    assert.equal(nulo.recortado, false, "con Δθ = 0 no hay recorte");
  });

  test("C6-5: Σ_t |G_t| = T(T+1)/2 con γ = 1 y r = −1, sobre 500 episodios sembrados", () => {
    const theta0 = thetaDeP(PASILLO, P0);
    for (const ep of episodiosSembrados(PASILLO, theta0, 500, { maxPasos: 1000 })) {
      const G = retornos(ep.recompensas, 1);
      let suma = 0;
      for (let t = 0; t < ep.T; t++) suma += Math.abs(G[t]);
      cerca(suma, (ep.T * (ep.T + 1)) / 2, 1e-12, `Σ|G_t| (T=${ep.T})`);
    }
  });

  test("C6-6: ‖Δθ‖ ≤ α^θ √2 T(T+1)/2 en los 500 episodios — desigualdad, no «casi siempre»", () => {
    const theta0 = thetaDeP(PASILLO, P0);
    const alpha = Math.pow(2, -7);
    for (const ep of episodiosSembrados(PASILLO, theta0, 500, { maxPasos: 1000 })) {
      const G = retornos(ep.recompensas, 1);
      const inc = new Float64Array(2);
      for (let t = 0; t < ep.T; t++) {
        const g = gradLogPi(PASILLO, theta0, ep.estados[t], ep.acciones[t]);
        for (let i = 0; i < 2; i++) inc[i] += alpha * G[t] * g[i];
      }
      const norma = Math.hypot(inc[0], inc[1]);
      const cota = alpha * Math.SQRT2 * ((ep.T * (ep.T + 1)) / 2);
      assert.ok(norma <= cota + 1e-12, `‖Δθ‖ = ${norma} supera la cota ${cota} (T=${ep.T})`);
    }
  });

  test("C6-7: ‖∇lnπ(der)‖ = √2(1−p) y ‖∇lnπ(izq)‖ = √2 p, en los 91 valores de p", () => {
    for (const p of P_M2) {
      const theta = thetaDeP(PASILLO, p);
      const der = gradLogPi(PASILLO, theta, 1, 0);
      const izq = gradLogPi(PASILLO, theta, 1, 1);
      cerca(Math.hypot(der[0], der[1]), Math.SQRT2 * (1 - p), 1e-13, `‖∇lnπ(der)‖ (p=${p})`);
      cerca(Math.hypot(izq[0], izq[1]), Math.SQRT2 * p, 1e-13, `‖∇lnπ(izq)‖ (p=${p})`);
    }
  });

  test("C6-8: los umbrales de colapso son las dos ε-greedy del libro: J(0,95) = −44,21 y J(0,05) = −82,11", () => {
    assert.equal(UMBRAL_COLAPSO.alto, 0.95, "umbral alto");
    assert.equal(UMBRAL_COLAPSO.bajo, 0.05, "umbral bajo");
    cerca(J(PASILLO, UMBRAL_COLAPSO.alto), -44.21052631578947, 1e-10, "J(0,95)");
    cerca(J(PASILLO, UMBRAL_COLAPSO.bajo), -82.10526315789474, 1e-10, "J(0,05)");
  });

  test("C6-9: promediar la D_KL sobre los tres estados con μ(s) da lo mismo que un solo estado", () => {
    const rng = generador(37);
    for (let k = 0; k < 50; k++) {
      const pAnt = 0.05 + 0.9 * rng.uniforme();
      const pNueva = 0.05 + 0.9 * rng.uniforme();
      const thetaAnt = thetaDeP(PASILLO, pAnt);
      const theta = thetaDeP(PASILLO, pNueva);
      const v = valoresExactos(PASILLO, pAnt);
      let promedio = 0;
      for (let s = 0; s < 3; s++) {
        const piAnt = probabilidades(PASILLO, thetaAnt, s);
        const piNueva = probabilidades(PASILLO, theta, s);
        let kls = 0;
        for (let a = 0; a < 2; a++) kls += piAnt[a] * Math.log(piAnt[a] / piNueva[a]);
        promedio += v.mu[s] * kls;
      }
      cerca(promedio, klPolitica(PASILLO, thetaAnt, theta), 1e-14, `D_KL promediada (caso ${k})`);
    }
  });

  test("C6-10: con δ enorme el freno es la identidad — misma semilla, misma trayectoria", () => {
    /* ⚠ El guion escribe «δ ≥ 10». Con el α^θ por omisión del módulo (2⁻⁷) eso
       es FALSO: la mayor D_KL de una actualización es 27,417 (R6-6). Se testea
       la intención de la aserción con δ = 10⁶, y con δ = 10 en el α donde sí
       vale (2⁻¹², mayor KL = 0,211). El caso en que δ = 10 SÍ recorta está
       fijado en el test siguiente, para que no se pierda el hallazgo. */
    const sin = M6(7, null).r;
    const con = M6(7, { delta: 1e6 }).r;
    identicos(sin.curvas["reinforce.G0"], con.curvas["reinforce.G0"], "δ = 10⁶: curva de G₀");
    identicos(sin.curvas["reinforce.p"], con.curvas["reinforce.p"], "δ = 10⁶: curva de p");
    assert.equal(con.recortes.reinforce, 0, "δ = 10⁶ no debería recortar nada");

    const sin12 = M6(12, null).r;
    const con12 = M6(12, { delta: 10 }).r;
    identicos(sin12.curvas["reinforce.p"], con12.curvas["reinforce.p"], "2⁻¹² con δ = 10: curva de p");
    assert.equal(con12.recortes.reinforce, 0, "con 2⁻¹² el δ = 10 no llega a recortar");
  });

  test("C6-10 (hallazgo): con el α por omisión, δ = 10 SÍ recorta — la letra del guion no se sostiene", () => {
    /* No es un fallo del motor: es que la mayor D_KL de una actualización con
       2⁻⁷ vale 27,417 y con 2⁻⁹ vale 11,434, las dos por encima de 10. */
    for (const exp of [7, 9]) {
      const sin = M6(exp, null).r;
      const con = M6(exp, { delta: 10 }).r;
      assert.ok(
        con.recortes.reinforce > 0,
        `con 2⁻${exp} y δ = 10 se esperaba al menos un recorte (D_KL máxima = ${sin.klMax.reinforce})`,
      );
      assert.notEqual(
        primeraDiferencia(sin.curvas["reinforce.p"], con.curvas["reinforce.p"]), -1,
        `con 2⁻${exp} y δ = 10 las dos curvas deberían separarse`,
      );
      assert.ok(sin.klMax.reinforce > 10, `la mayor D_KL con 2⁻${exp} es ${sin.klMax.reinforce}, y debe superar 10`);
    }
  });

  test("C6-11: θ_r + θ_ℓ es invariante con y sin freno — el recorte es un escalar", () => {
    for (const freno of [null, { delta: 1e-2 }]) {
      const { detalle } = M6(7, freno);
      for (const theta of detalle.thetaFinal) {
        cerca(theta[0] + theta[1], 0, 1e-9, `Σθ final (${freno ? "con" : "sin"} freno)`);
      }
    }
  });

  test("C6-12: la D_KL es finita incluso con p o p_ant numéricamente 0 o 1", () => {
    const extremos = [
      Float64Array.from([600, -600]),
      Float64Array.from([-600, 600]),
      new Float64Array(2),
    ];
    for (const a of extremos) {
      for (const b of extremos) {
        const kl = klPolitica(PASILLO, a, b);
        assert.ok(Number.isFinite(kl) && kl >= 0, `D_KL = ${kl} debería ser finita y ≥ 0`);
      }
    }
    /* Y la política sí puede dar 0 y 1 exactos: la acotación es solo de la KL. */
    const pi = probabilidades(PASILLO, extremos[0], 0);
    assert.equal(pi[0], 1, "la softmax satura a 1 en doble precisión");
    assert.equal(pi[1], 0, "y a 0, y eso es correcto: no se divide por π en ningún sitio");
  });
});

/* ===================================================================== *
 * ESTRUCTURALES · el contrato del motor   [C]
 * Fuente: guion §C4, «sin ellas el motor puede mentir»
 * ===================================================================== */

describe("Motor · contrato transversal (guion §C4) [C]", () => {
  test("Q-1: ninguna función de `politica.js` llama al azar global del lenguaje", () => {
    /* Se busca la cadena en el fuente, no el comportamiento: una llamada
       dentro de una rama que no se ejecuta también rompe la regla. El propio
       motor lo sabe y no escribe el nombre ni en los comentarios. */
    for (const fichero of ["assets/politica.js", "assets/politica-worker.js"]) {
      const src = readFileSync(join(RAIZ, fichero), "utf8");
      assert.ok(
        !src.includes("Math.random"),
        `${fichero} llama al azar global: todo el azar tiene que entrar por un \`rng\` de \`generador(semilla)\``,
      );
    }
  });

  test("Q-2: `politica.js` no toca el DOM", () => {
    for (const fichero of ["assets/politica.js", "assets/politica-worker.js"]) {
      const src = readFileSync(join(RAIZ, fichero), "utf8");
      for (const prohibida of ["document", "window", "navigator", "globalThis"]) {
        assert.ok(
          !src.includes(prohibida),
          `${fichero} referencia \`${prohibida}\`: los motores del sitio no tocan el DOM`,
        );
      }
    }
  });

  test("Q-3: dos tandas con la misma configuración y semilla devuelven arrays idénticos elemento a elemento", () => {
    const config = {
      entorno: "pasilloCorto", algoritmo: ["lineaBase", "actorCritico"], episodios: 150,
      ejecuciones: 5, semilla: SEMILLA, p0: P0, alphaTheta: Math.pow(2, -9),
      alphaW: Math.pow(2, -6), capacidad: "unNumero", maxPasos: 1000,
    };
    const a = tanda(config);
    const b = tanda(config);
    for (const clave of Object.keys(a.curvas)) {
      identicos(a.curvas[clave], b.curvas[clave], `curva ${clave}`);
    }
    assert.deepEqual(a.truncados, b.truncados, "truncados por variante");
    assert.deepEqual(a.colapsadas, b.colapsadas, "colapsadas por variante");
  });

  test("Q-4: ninguna curva de las configuraciones por omisión contiene NaN ni ±Infinity", () => {
    const tandas = [
      ["M3 · 2⁻¹³", M3(13)],
      ["M3 · 2⁻¹²", M3(12)],
      ["M4 · sin línea base", M4("cero").r],
      ["M4 · línea base de estado", M4("estado").r],
      ["M4 · línea base por acción", M4("accion").r],
      ["M5 · línea base d=1", M5("lineaBase", "unNumero").r],
      ["M5 · crítico d=1", M5("actorCritico", "unNumero").r],
      ["M5 · crítico d=3", M5("actorCritico", "porEstado").r],
      ["M6 · sin freno", M6(7, null).r],
      ["M6 · con freno", M6(7, { delta: 1e-2 }).r],
    ];
    for (const [nombre, r] of tandas) {
      for (const clave of Object.keys(r.curvas)) {
        for (const x of r.curvas[clave]) {
          assert.ok(Number.isFinite(x), `${nombre} · ${clave}: valor no finito (${x})`);
        }
      }
    }
  });

  test("Q-5: J devuelve −Infinity (no NaN) en p = 0 y p = 1, en los cuatro entornos", () => {
    for (const [nombre, entorno] of CUATRO) {
      for (const p of [0, 1, -0.5, 1.5, -0]) {
        const valor = J(entorno, p);
        assert.equal(valor, -Infinity, `${nombre}: J(${p}) = ${valor}`);
        assert.ok(!Number.isNaN(valor), `${nombre}: J(${p}) no puede ser NaN`);
      }
    }
  });

  test("Q-6: `probabilidades` suma 1 y no tiene componentes negativas para 1 000 θ de norma hasta 10³", () => {
    const rng = generador(41);
    for (let k = 0; k < 1000; k++) {
      const entorno = k % 2 === 0 ? PASILLO : CRUZ;
      const escala = Math.pow(10, 3 * rng.uniforme());
      const theta = new Float64Array(entorno.dPrima);
      for (let i = 0; i < theta.length; i++) theta[i] = escala * (2 * rng.uniforme() - 1);
      const pi = probabilidades(entorno, theta, 1);
      let suma = 0;
      for (const x of pi) {
        assert.ok(x >= 0 && Number.isFinite(x), `componente ${x} con ‖θ‖ ≈ ${escala}`);
        suma += x;
      }
      cerca(suma, 1, 1e-15, `Σ π (caso ${k})`);
    }
  });

  test("Q-7: `muestrearAccion` consume exactamente un uniforme por llamada", () => {
    let cuenta = 0;
    const rngContador = {
      uniforme() { cuenta += 1; return 0.42; },
      entero(n) { cuenta += 1; return Math.floor(0.42 * n); },
    };
    for (const [nombre, entorno] of CUATRO) {
      const theta = thetaDeP(entorno, 0.3);
      for (let s = 0; s < entorno.nEstados; s++) {
        cuenta = 0;
        muestrearAccion(entorno, theta, s, rngContador);
        assert.equal(cuenta, 1, `${nombre}, s=${s}: consumo del generador`);
      }
    }
    /* Y el consumo no depende del modo: en «distinguibles» la acción está
       forzada y aun así se consume uno (contrato §1 de la cabecera). */
    cuenta = 0;
    muestrearAccion(PASILLO_DIST, thetaDeP(PASILLO_DIST, 0.3), 0, rngContador);
    assert.equal(cuenta, 1, "modo distinguibles, estado forzado");
  });

  test("Q-8: los índices de acción y su orden son los de §C1 en los dos entornos", () => {
    assert.deepEqual(PASILLO.acciones, ["derecha", "izquierda"], "acciones del pasillo");
    assert.deepEqual(CRUZ.acciones, ["norte", "sur", "oeste", "este"], "acciones de la cruz");
    assert.equal(PASILLO.accionMarcada, 0, "la p del pasillo es π(derecha)");
    assert.equal(CRUZ.accionMarcada, 3, "la p de la cruz es π(este)");
    /* Las transiciones del Ejemplo 13.1, incluida la inversión del estado 1. */
    assert.deepEqual({ ...PASILLO.paso(0, 0) }, { s2: 1, r: -1, fin: false }, "(0, derecha)");
    assert.deepEqual({ ...PASILLO.paso(0, 1) }, { s2: 0, r: -1, fin: false }, "(0, izquierda) choca");
    assert.deepEqual({ ...PASILLO.paso(1, 0) }, { s2: 0, r: -1, fin: false }, "(1, derecha) INVERTIDA");
    assert.deepEqual({ ...PASILLO.paso(1, 1) }, { s2: 2, r: -1, fin: false }, "(1, izquierda) INVERTIDA");
    assert.deepEqual({ ...PASILLO.paso(2, 0) }, { s2: 3, r: -1, fin: true }, "(2, derecha) termina");
    assert.deepEqual({ ...PASILLO.paso(2, 1) }, { s2: 1, r: -1, fin: false }, "(2, izquierda)");
    /* La cruz: una acción sale, las otras tres chocan y cuentan el paso. */
    const salidas = [1, 3, 2, 0];
    for (let s = 0; s < 4; s++) {
      for (let a = 0; a < 4; a++) {
        const { s2, r, fin } = CRUZ.paso(s, a);
        assert.equal(r, -1, `recompensa (s=${s}, a=${a})`);
        assert.equal(fin, a === salidas[s], `terminar desde s=${s} con a=${a}`);
        assert.equal(s2, a === salidas[s] ? 4 : s, `sucesor (s=${s}, a=${a})`);
      }
    }
    assert.equal(construirEntorno("pasilloCorto").tipo, "pasilloCorto", "descriptor por cadena");
    assert.equal(construirEntorno({ tipo: "rejillaCruz", alias: false }).alias, false, "descriptor por objeto");
    assert.throws(() => construirEntorno("noExiste"), /Entorno desconocido/, "entorno inexistente");
  });

  test("Q-9: `valoresExactos` cumple v_π(s) = Σ_a π(a|s) q_π(s,a) en los 4 entornos y 91 valores de p", () => {
    for (const [nombre, entorno] of CUATRO) {
      for (const p of P_M2) {
        const v = valoresExactos(entorno, p);
        for (let s = 0; s < entorno.nEstados; s++) {
          let suma = 0;
          for (let a = 0; a < entorno.nAcciones; a++) suma += v.pi[s][a] * v.q[s][a];
          cercaRel(suma, v.v[s], 1e-12, `${nombre}: Bellman en s=${s}, p=${p}`);
        }
      }
    }
  });

  test("Q-10: `recorteRegion` devuelve τ ∈ (0,1] y kl finita incluso con ‖Δθ‖ = 10⁶", () => {
    for (const escala of [1e-9, 1, 1e3, 1e6]) {
      for (const p of [0.05, 0.5, 0.95]) {
        const thetaAnt = thetaDeP(PASILLO, p);
        for (const signo of [1, -1]) {
          const delta = Float64Array.from([signo * escala, -signo * escala]);
          const r = recorteRegion(PASILLO, thetaAnt, delta, 1e-2);
          assert.ok(r.tau > 0 && r.tau <= 1, `τ = ${r.tau} fuera de (0,1] (escala ${escala}, p=${p})`);
          assert.ok(Number.isFinite(r.kl), `kl = ${r.kl} no es finita (escala ${escala})`);
          if (r.recortado) cerca(r.kl, 1e-2, 1e-9, `kl recortada (escala ${escala}, p=${p})`);
        }
      }
    }
  });

  /* Q-11 (el barajado conserva la correcta en las 18 preguntas) es de
     `tests/quiz.test.js` y necesita el banco de `assets/tema5b.js`, que hoy es
     un esqueleto. No se escribe aquí; queda reportado. */

  test("Q-12: `histograma` conserva las muestras: Σ frecuencias + colaIzq + colaDch = n", () => {
    const rng = generador(43);
    for (let k = 0; k < 20; k++) {
      const n = 100 + rng.entero(500);
      const muestras = new Float64Array(n);
      for (let i = 0; i < n; i++) muestras[i] = -300 + 600 * rng.uniforme();
      const h = histograma(muestras, { min: -200, max: 200, nIntervalos: 40 });
      let suma = 0;
      for (const f of h.frecuencias) suma += f;
      assert.equal(suma + h.colaIzq + h.colaDch, n, `conservación de muestras (caso ${k})`);
      assert.equal(h.n, n, "n devuelto");
      cerca(media(h.relativas) * 40 + (h.colaIzq + h.colaDch) / n, 1, 1e-12, "relativas");
      cerca(h.media, media(muestras), 1e-12, "media");
      cerca(h.desviacion, desviacion(muestras), 1e-12, "desviación");
    }
    assert.throws(() => histograma([1], { min: 0, max: 0, nIntervalos: 10 }), /max > min/);
    assert.throws(() => histograma([1], { min: 0, max: 1, nIntervalos: 0 }), /al menos un intervalo/);
  });
});

/* ===================================================================== *
 * MÓDULO 3 · reproducibilidad   [R]
 * Configuración común: pasillo, γ = 1, p₀ = 0,05, 1000 × 100, semilla 2026,
 * tope 500 (guion §8b del módulo 3)
 * ===================================================================== */

describe("Módulo 3 · la Figura 13.1, reproducida [R]", () => {
  test("R3-1: con α = 2⁻¹³ el G₀ medio de los últimos 100 episodios es −12,30 (Fig. 13.1 roza v_*(s₀))", () => {
    cerca(mediaFinal(M3(13).curvas["reinforce.G0"], 100), -12.30, 1.0, "G₀ final con 2⁻¹³");
  });

  test("R3-2: con α = 2⁻¹³ la media cruza −15 en el episodio 282", () => {
    const ep = primerEpisodioPorEncima(M3(13).curvas["reinforce.G0"], -15);
    assert.ok(ep !== null, "la curva de 2⁻¹³ debería cruzar −15 en 1000 episodios");
    cerca(ep, 282, 50, "primer episodio por encima de −15");
  });

  test("R3-3: con α = 2⁻¹² la curva se estanca en −40,09 — el «around −40» del libro, al decimal", () => {
    cerca(mediaFinal(M3(12).curvas["reinforce.G0"], 100), -40.09, 2.0, "G₀ final con 2⁻¹²");
  });

  test("R3-4: con α = 2⁻¹⁴ el G₀ medio final es −15,00, y esa tanda no trunca ni un episodio", () => {
    cerca(mediaFinal(M3(14).curvas["reinforce.G0"], 100), -15.00, 1.0, "G₀ final con 2⁻¹⁴");
    assert.equal(M3(14).truncados.reinforce, 0, "truncados con 2⁻¹⁴");
    /* Idéntica con los dos topes, justamente porque no trunca. */
    cerca(mediaFinal(M3(14, 10000).curvas["reinforce.G0"], 100), -15.00, 1.0, "G₀ final con tope 10 000");
  });

  test("R3-5: con tope 500, 2⁻¹³ es el mejor de los tres — el pie de la Figura 13.2, confirmado", () => {
    const a12 = mediaFinal(M3(12).curvas["reinforce.G0"], 100);
    const a13 = mediaFinal(M3(13).curvas["reinforce.G0"], 100);
    const a14 = mediaFinal(M3(14).curvas["reinforce.G0"], 100);
    assert.ok(a13 > a14, `2⁻¹³ (${a13}) debería ser mejor que 2⁻¹⁴ (${a14})`);
    assert.ok(a14 > a12, `2⁻¹⁴ (${a14}) debería ser mejor que 2⁻¹² (${a12})`);
  });

  test("R3-5 (tope): con tope 10 000 la ordenación del pie de la Figura 13.2 SE INVIERTE", () => {
    /* Este test existe para que nadie cambie el tope sin enterarse. El tope
       NO es una simplificación neutra: es la ordenada de la curva que se
       estanca, y con 10 000 la figura del libro deja de reproducirse. */
    const a13 = mediaFinal(M3(13, 10000).curvas["reinforce.G0"], 100);
    const a14 = mediaFinal(M3(14, 10000).curvas["reinforce.G0"], 100);
    cerca(a13, -112.19, 12.0, "G₀ final con 2⁻¹³ y tope 10 000");
    cerca(a14, -15.00, 1.0, "G₀ final con 2⁻¹⁴ y tope 10 000");
    assert.ok(
      a14 > a13,
      `con tope 10 000, 2⁻¹⁴ (${a14}) pasa a ser mejor que 2⁻¹³ (${a13}): la ordenación se invierte`,
    );
    /* Y el tope cambia la MISMA configuración en un orden de magnitud. */
    const conTope500 = mediaFinal(M3(13).curvas["reinforce.G0"], 100);
    assert.ok(
      conTope500 - a13 > 50,
      `el tope cambia el resultado de 2⁻¹³ de ${conTope500} a ${a13}: no es un detalle`,
    );
  });

  test("R3-5 (tope): con tope 10 000 y α = 2⁻¹² la media se hunde a −611,25", () => {
    /* ≈ 8 s: son seis ejecuciones colapsadas × 1000 episodios × 10 000 pasos.
       Es el tercer punto de la nota ⚑ del guion y el más caro del fichero. */
    cerca(mediaFinal(M3(12, 10000).curvas["reinforce.G0"], 100), -611.25, 60.0, "G₀ final con 2⁻¹² y tope 10 000");
  });

  test("R3-6: la σ de G₀ en los episodios 901-1000 con 2⁻¹³ es 9,75 — casi tanto como el retorno medio", () => {
    const curvas = M3(13).porEjecucion.reinforce.curvaG0;
    const ultimos = [];
    for (const c of curvas) for (let i = 900; i < 1000; i++) ultimos.push(c[i]);
    assert.equal(ultimos.length, 10000, "10 000 valores: 100 ejecuciones × 100 episodios");
    cercaPorciento(desviacion(ultimos), 9.75, 0.15, "σ de G₀ (901-1000)");
    /* El coeficiente de variación final, que es lo que sostiene la lectura. */
    cercaPorciento(desviacion(ultimos) / Math.abs(media(ultimos)), 0.79, 0.20, "coeficiente de variación");
  });

  test("R3-7: la σ NO «apenas cambia»: pasa de 52,89 a 9,75, cociente 0,184", () => {
    /* ⚠ Este número obligó a reescribir la lectura 1 del módulo 3: lo que hace
       lento a REINFORCE no es que la dispersión no baje, sino que σ = 9,75
       sigue siendo casi tan grande como el retorno medio (−12,30). */
    const curvas = M3(13).porEjecucion.reinforce.curvaG0;
    const primeros = [];
    const ultimos = [];
    for (const c of curvas) {
      for (let i = 0; i < 100; i++) primeros.push(c[i]);
      for (let i = 900; i < 1000; i++) ultimos.push(c[i]);
    }
    cercaPorciento(desviacion(primeros), 52.89, 0.15, "σ de G₀ (1-100)");
    cercaPorciento(desviacion(ultimos) / desviacion(primeros), 0.184, 0.20, "cociente de σ");
  });

  test("R3-8: la p media final con 2⁻¹³ es 0,4856: se acerca a 2−√2 sin llegar en 1000 episodios", () => {
    const pFinal = M3(13).porEjecucion.reinforce.pFinal;
    cerca(media(pFinal), 0.4856, 0.03, "p media final");
    cercaPorciento(desviacion(pFinal), 0.0513, 0.25, "σ de p entre ejecuciones");
    assert.ok(media(pFinal) < P_ESTRELLA, "todavía no ha llegado a 2−√2");
  });

  test("R3-9: el estancamiento de la Figura 13.1 con 2⁻¹² es un COLAPSO de 6 ejecuciones de 100, las seis hacia p→1", () => {
    /* Hallazgo del motor, confirmado: no es una deriva global. La mediana de
       las 100 acaba casi en el óptimo, y son seis ejecuciones colapsadas las
       que hunden la media a −40,09. */
    const r = M3(12);
    const detalle = r.porEjecucion.reinforce;
    const pFinal = Array.from(detalle.pFinal);
    const colapsadas = pFinal.filter((p) => p >= UMBRAL_COLAPSO.alto || p <= UMBRAL_COLAPSO.bajo);
    assert.equal(colapsadas.length, 6, "ejecuciones colapsadas de 100");
    assert.equal(r.colapsadas.reinforce, 6, "el contador del motor dice lo mismo");
    for (const p of colapsadas) assert.ok(p >= UMBRAL_COLAPSO.alto, `colapso hacia p→1, no hacia 0 (p=${p})`);

    const ordenadas = pFinal.slice().sort((a, b) => a - b);
    const mediana = (ordenadas[49] + ordenadas[50]) / 2;
    cerca(mediana, 0.578, 0.02, "mediana de p (casi el óptimo)");

    const sanas = [];
    pFinal.forEach((p, i) => {
      if (p < UMBRAL_COLAPSO.alto && p > UMBRAL_COLAPSO.bajo) {
        sanas.push(mediaFinal(detalle.curvaG0[i], 100));
      }
    });
    assert.equal(sanas.length, 94, "ejecuciones sanas");
    /* El guion escribe −11,97; lo medido es −11,81, que es el valor que cuadra
       con el −40,09 de R3-3 (0,94·(−11,81) + 0,06·(−483,08) = −40,09). */
    cerca(media(sanas), -11.97, 0.5, "G₀ final de las 94 sanas ≈ v_*(s₀)");
  });

  test("R3-9 (segunda mitad): con el incremento acumulado por episodio, con 2⁻¹² NO colapsa ninguna", () => {
    /* El estancamiento de la Figura 13.1 lo produce el ORDEN de actualización
       del recuadro del libro, paso a paso dentro del episodio. Con el orden
       acumulado del módulo 6 y el mismo paso, el colapso desaparece.
       ⚠ El guion dice «las veinte convergen a −11,68»; con 20 ejecuciones el
       valor es −11,98 (−11,68 es el de 100 ejecuciones). */
    const r = tandaCache({
      entorno: "pasilloCorto", algoritmo: "reinforce", episodios: 1000, ejecuciones: 20,
      semilla: SEMILLA, p0: P0, alphaTheta: Math.pow(2, -12), maxPasos: 500,
      acumularEpisodio: true,
    });
    assert.equal(r.colapsadas.reinforce, 0, "con el orden acumulado no colapsa ninguna de 20");
    cerca(mediaFinal(r.curvas["reinforce.G0"], 100), -11.68, 0.5, "G₀ final acumulado");
  });

  test("R3-10: los episodios truncados no son cero y se cuentan: 6005 · 22 · 0 de 100 000", () => {
    assert.equal(M3(12).truncados.reinforce, 6005, "truncados con 2⁻¹²");
    assert.equal(M3(13).truncados.reinforce, 22, "truncados con 2⁻¹³");
    assert.equal(M3(14).truncados.reinforce, 0, "truncados con 2⁻¹⁴");
    for (const exp of [12, 13, 14]) {
      assert.equal(M3(exp).cortadas.reinforce, 0, `ejecuciones cortadas por desbordamiento con 2⁻${exp}`);
    }
  });
});

/* ===================================================================== *
 * MÓDULO 4 · reproducibilidad   [R]
 * Configuración común: 1000 × 100, semilla 2026, p₀ = 0,05, w₀ = 0, tope 500
 * ===================================================================== */

describe("Módulo 4 · la Figura 13.2 y el estimador [R]", () => {
  test("R4-1: con línea base (α^θ = 2⁻⁹, α^w = 2⁻⁶) la media cruza −15 en el episodio 60", () => {
    const { r, variante } = M4("estado");
    const ep = primerEpisodioPorEncima(r.curvas[`${variante}.G0`], -15);
    assert.ok(ep !== null, "la curva con línea base debería cruzar −15");
    cerca(ep, 60, 30, "primer episodio por encima de −15 (con línea base)");
  });

  test("R4-2: sin línea base (α = 2⁻¹³) la media cruza −15 en el episodio 282", () => {
    const { r, variante } = M4("cero");
    const ep = primerEpisodioPorEncima(r.curvas[`${variante}.G0`], -15);
    assert.ok(ep !== null, "la curva sin línea base debería cruzar −15");
    cerca(ep, 282, 80, "primer episodio por encima de −15 (sin línea base)");
  });

  test("R4-3: la línea base acelera 4,7 veces — el número que la diapositiva afirma sin medir", () => {
    const sin = primerEpisodioPorEncima(M4("cero").r.curvas["reinforce.G0"], -15);
    const con = primerEpisodioPorEncima(M4("estado").r.curvas["reinforceLineaBase.G0"], -15);
    cercaPorciento(sin / con, 4.70, 0.30, "cociente de episodios");
  });

  test("R4-4: con θ y w congelados, la línea base recorta la varianza del estimador al 0,412", () => {
    /* Mide EL ESTIMADOR, no el algoritmo: θ congelado en θ₀ y w congelada en
       su punto fijo Σμv = −71,592, sobre los MISMOS 10 000 episodios. Es el
       único sitio del recurso donde los episodios se comparten de verdad. */
    const e = estimadorCongelado();
    cercaPorciento(e.varianzaConBase / e.varianzaSinBase, 0.412, 0.20, "cociente de varianzas");
    cercaPorciento(e.varianzaSinBase, 51656, 0.20, "varianza sin línea base");
    cercaPorciento(e.varianzaConBase, 21272, 0.20, "varianza con línea base");
  });

  test("R4-5: y NO sesga: la diferencia de medias es −0,17 errores típicos (C4-1, comprobado con muestras)", () => {
    const e = estimadorCongelado();
    const z = (e.mediaConBase - e.mediaSinBase) / e.errorTipico;
    assert.ok(Math.abs(z) < 2, `la diferencia de medias son ${z} errores típicos: debería ser compatible con cero`);
    cerca(z, -0.17, 0.6, "diferencia de medias en errores típicos");
    /* Las dos medias rondan [∇J(θ₀)]₁ = 75,90, que es lo que estiman. */
    const objetivo = gradienteJ(PASILLO, thetaDeP(PASILLO, P0))[0];
    cercaPorciento(objetivo, 75.90, 0.01, "[∇J(θ₀)]₁");
    cercaPorciento(e.mediaSinBase, 76.42, 0.10, "media sin línea base");
    cercaPorciento(e.mediaConBase, 75.95, 0.10, "media con línea base");
  });

  test("R4-6: la línea base POR ACCIÓN no deja la curva plana en −82,11: la hunde a −470,71", () => {
    /* ⚠ Léase junto a C4-9, que NO se contradice con esto: la actualización
       ESPERADA es exactamente cero (sale a 4·10⁻¹⁴), pero su VARIANZA no, y
       con la deriva anulada θ hace un paseo aleatorio sobre una J que cae a
       −∞ en los dos lados. Esperanza cero no es quieto. */
    const { r, variante } = M4("accion");
    const g0 = mediaFinal(r.curvas[`${variante}.G0`], 100);
    cercaPorciento(g0, -470.71, 0.20, "G₀ final con línea base por acción");
    assert.ok(g0 < J(PASILLO, P0) * 3, `−470 es cinco veces peor que J(0,05) = ${J(PASILLO, P0)}, no «plano»`);
  });

  test("R4-7: y la política se va al extremo: mediana de p = 0,0000 y 94 de 100 ejecuciones con p ≤ 0,01", () => {
    const { detalle } = M4("accion");
    const pFinal = Array.from(detalle.pFinal);
    cerca(media(pFinal), 0.0325, 0.05, "p media final");
    const ordenadas = pFinal.slice().sort((a, b) => a - b);
    cerca((ordenadas[49] + ordenadas[50]) / 2, 0, 1e-3, "mediana de p");
    const bajas = pFinal.filter((p) => p <= 0.01).length;
    cerca(bajas, 94, 5, "ejecuciones con p ≤ 0,01");
  });

  test("R4-8: la w de la línea base de estado acaba en −9,17, un 9 % por debajo de Σμv en la p final", () => {
    const { detalle } = M4("estado");
    const ws = detalle.wFinal.map((w) => w[0]);
    cercaPorciento(media(ws), -9.17, 0.15, "w final media");
    cercaPorciento(desviacion(ws), 2.81, 0.25, "σ de w entre ejecuciones");
    const pMedia = media(detalle.pFinal);
    const v = valoresExactos(PASILLO, pMedia);
    let objetivo = 0;
    for (let s = 0; s < 3; s++) objetivo += v.mu[s] * v.v[s];
    cercaPorciento(objetivo, -10.09, 0.05, "Σμv en la p final (0,5796)");
    cercaPorciento(media(ws), objetivo, 0.15, "w final frente a su punto fijo");
  });

  test("R4-9: truncados por variante: 162 con línea base de estado · 22 sin línea base · 93 350 por acción", () => {
    assert.equal(M4("estado").r.truncados.reinforceLineaBase, 162, "truncados con línea base de estado");
    assert.equal(M4("cero").r.truncados.reinforce, 22, "truncados sin línea base");
    assert.equal(M4("accion").r.truncados.reinforceLineaBase, 93350, "truncados con línea base por acción");
    for (const base of ["cero", "estado", "accion"]) {
      const { r, variante } = M4(base);
      assert.equal(r.cortadas[variante], 0, `cortadas por desbordamiento (base ${base})`);
    }
  });
});

/**
 * El estudio del estimador con θ congelado (R4-4 y R4-5), memoizado.
 *
 * ⚠ Los 10 000 episodios se muestrean SIN tope efectivo (10 000 pasos), que es
 * lo único que reproduce las cifras del guion. Con tope 500 el cociente sale
 * 0,398 y la z −0,20: la conclusión no cambia, los números sí.
 */
let ESTIMADOR = null;
function estimadorCongelado() {
  if (ESTIMADOR) return ESTIMADOR;
  const theta0 = thetaDeP(PASILLO, P0);
  const v = valoresExactos(PASILLO, P0);
  let wFijo = 0;
  for (let s = 0; s < 3; s++) wFijo += v.mu[s] * v.v[s];
  const eps = episodiosSembrados(PASILLO, theta0, 10000, { maxPasos: 10000 });
  const sin = reinforceLineaBase(PASILLO, theta0, eps, {
    alphaTheta: 1, congelarTheta: true, base: "cero",
  });
  const con = reinforceLineaBase(PASILLO, theta0, eps, {
    alphaTheta: 1, congelarTheta: true, base: "estado", alphaW: 0, w0: wFijo,
  });
  const varianza = (a) => desviacion(a) ** 2;
  ESTIMADOR = {
    wFijo,
    mediaSinBase: media(sin.incrementos),
    mediaConBase: media(con.incrementos),
    varianzaSinBase: varianza(sin.incrementos),
    varianzaConBase: varianza(con.incrementos),
    errorTipico: Math.sqrt((varianza(sin.incrementos) + varianza(con.incrementos)) / 10000),
  };
  return ESTIMADOR;
}

/* ===================================================================== *
 * MÓDULO 5 · reproducibilidad   [R]
 * Configuración: 500 × 50, semilla 2026, p₀ = 0,05, α^θ = 2⁻⁹, tope 1000.
 * ⚠ α^w = 2⁻⁶: es el que reproduce los nueve valores del guion, aunque su
 * «configuración común» diga 2⁻⁴ (se reporta).
 * ===================================================================== */

describe("Módulo 5 · línea base contra crítico [R]", () => {
  test("R5-1: con la línea base y d = 1, la p media final es 0,5923 ≈ 2−√2", () => {
    const { detalle } = M5("lineaBase", "unNumero");
    cerca(media(detalle.pFinal), 0.5923, 0.05, "p media final");
    cerca(media(detalle.pFinal), P_ESTRELLA, 0.05, "distancia a 2−√2");
  });

  test("R5-2: con el CRÍTICO de un número la política se va a p→1: 0,9816, y las 50 ejecuciones con p ≥ 0,95", () => {
    /* Es lo que predicen C5-2 a C5-4, sin excepciones: no hay punto fijo
       conjunto y la actualización esperada sube p para cualquier p. */
    const { r, detalle } = M5("actorCritico", "unNumero");
    cerca(media(detalle.pFinal), 0.9816, 0.05, "p media final");
    assert.equal(r.colapsadas.actorCritico, 50, "las 50 ejecuciones colapsan");
    assert.ok(Math.min(...detalle.pFinal) >= 0.95, `la peor de las 50 acaba en ${Math.min(...detalle.pFinal)}`);
  });

  test("R5-3: con un peso por estado el colapso desaparece: p media final 0,5804", () => {
    const { r, detalle } = M5("actorCritico", "porEstado");
    cerca(media(detalle.pFinal), 0.5804, 0.05, "p media final");
    assert.equal(r.colapsadas.actorCritico, 0, "ninguna ejecución colapsa");
  });

  test("R5-4: G₀ medio de los últimos 50: −11,80 · −96,37 · −11,28 (las dos que llegan, en v_*(s₀))", () => {
    cerca(mediaFinal(M5("lineaBase", "unNumero").r.curvas["lineaBase.G0"], 50), -11.80, 5.0, "línea base d=1");
    cerca(mediaFinal(M5("actorCritico", "unNumero").r.curvas["actorCritico.G0"], 50), -96.37, 5.0, "crítico d=1");
    cerca(mediaFinal(M5("actorCritico", "porEstado").r.curvas["actorCritico.G0"], 50), -11.28, 5.0, "crítico d=3");
    /* Las dos buenas están donde tienen que estar; la del crítico de un
       número, ocho veces peor. */
    assert.ok(
      Math.abs(mediaFinal(M5("actorCritico", "porEstado").r.curvas["actorCritico.G0"], 50) - V_ESTRELLA) < 1.5,
      "el crítico con un peso por estado llega a v_*(s₀)",
    );
  });

  test("R5-5: la w del crítico d = 1 acaba en −80,95, un 28 % por encima de J(p) — va POR DETRÁS de la política", () => {
    /* ⚠ Fuera del ±20 % del guion, y no es un fallo: el crítico persigue una
       J(p) que empeora todo el rato, así que la sigue con retraso. Se testea
       el hecho, no la tolerancia que no se cumple. */
    const { detalle } = M5("actorCritico", "unNumero");
    const ws = detalle.wFinal.map((w) => w[0]);
    cercaPorciento(media(ws), -80.95, 0.15, "w final del crítico d=1");
    const objetivo = J(PASILLO, media(detalle.pFinal));
    assert.ok(media(ws) > objetivo, `w = ${media(ws)} va por detrás de J(p) = ${objetivo}`);
    cercaPorciento(objetivo, -112.90, 0.15, "J(p final)");
  });

  test("R5-6: la w del crítico d = 3 acaba en (−11,68, −9,85, −5,00) ≈ v_π en la p final (error < 3,2 %)", () => {
    const { detalle } = M5("actorCritico", "porEstado");
    const ws = [0, 1, 2].map((i) => media(detalle.wFinal.map((w) => w[i])));
    cercaVector(ws, [-11.68, -9.85, -5.00], 0.5, "w final por estado");
    const v = valoresExactos(PASILLO, media(detalle.pFinal));
    for (let s = 0; s < 3; s++) cercaPorciento(ws[s], v.v[s], 0.15, `w[${s}] frente a v_π`);
  });

  test("R5-7: la curva de p del crítico d = 1 cruza 0,9 en el episodio 223", () => {
    const ep = primerEpisodioPorEncima(M5("actorCritico", "unNumero").r.curvas["actorCritico.p"], 0.9);
    assert.ok(ep !== null, "la curva del crítico debería cruzar 0,9");
    cerca(ep, 223, 40, "episodio del cruce");
  });

  test("R5-8: la variante que colapsa NO trunca ni un episodio: 4 · 0 · 0 de 25 000", () => {
    /* ⚠ Contradice lo que esperaba el guion («en la del crítico se esperan
       muchos»): el colapso se para en p ≈ 0,98, donde el episodio dura 104
       pasos de media, muy por debajo del tope de 1000. */
    assert.equal(M5("lineaBase", "unNumero").r.truncados.lineaBase, 4, "truncados con línea base d=1");
    assert.equal(M5("actorCritico", "unNumero").r.truncados.actorCritico, 0, "truncados con crítico d=1");
    assert.equal(M5("actorCritico", "porEstado").r.truncados.actorCritico, 0, "truncados con crítico d=3");
    cercaPorciento(-J(PASILLO, 0.9816), 104, 0.15, "longitud media del episodio con p = 0,9816");
  });

  test("R5-9: el objetivo a un paso tiene 3,7 veces menos varianza que el retorno completo (cociente 0,267)", () => {
    /* La única medida del módulo que respalda la mitad BUENA de la afirmación
       de `5_Tema_5_2#slide-14`. θ congelado en θ₀, w en su punto fijo,
       10 039 pasos sembrados con la semilla 2026. */
    const theta0 = thetaDeP(PASILLO, P0);
    const v = valoresExactos(PASILLO, P0);
    let wLineaBase = 0;
    for (let s = 0; s < 3; s++) wLineaBase += v.mu[s] * v.v[s];
    const wCritico = J(PASILLO, P0);
    const rng = generador(SEMILLA);
    const terminosLB = [];
    const terminosAC = [];
    let pasos = 0;
    while (pasos < 10000) {
      const ep = episodio(PASILLO, theta0, rng, { maxPasos: 10000 });
      const G = retornos(ep.recompensas, 1);
      for (let t = 0; t < ep.T; t++) {
        const s = ep.estados[t];
        const a = ep.acciones[t];
        const c = gradLogPi(PASILLO, theta0, s, a)[0];
        terminosLB.push((G[t] - wLineaBase) * c);
        const { s2, r } = PASILLO.paso(s, a);
        terminosAC.push((r + (PASILLO.esTerminal(s2) ? 0 : wCritico) - wCritico) * c);
      }
      pasos += ep.T;
    }
    assert.equal(pasos, 10039, "pasos sembrados");
    const varLB = desviacion(terminosLB) ** 2;
    const varAC = desviacion(terminosAC) ** 2;
    cercaPorciento(varAC, 75.90, 0.20, "varianza del término del crítico");
    cercaPorciento(varLB, 284.17, 0.20, "varianza del término de la línea base");
    cercaPorciento(varAC / varLB, 0.267, 0.20, "cociente de varianzas");
  });

  test("R5-⚑: la tabla de las cuatro combinaciones × dos α^w, que sostiene la recomendación de subir a 2⁻⁴", () => {
    /* Con α^w = 2⁻⁶ la casilla «línea base + un peso por estado» se rompe
       (−170,60 y 7 de 50 colapsadas); con 2⁻⁴ las cuatro casillas cuentan la
       historia del módulo sin ruido. El motor no cambia el valor por omisión:
       lo dice el guion y aquí quedan fijados los dos juegos de números. */
    const casilla = (alg, cap, expW) => mediaFinal(M5(alg, cap, expW).r.curvas[`${alg}.G0`], 50);
    cerca(casilla("lineaBase", "unNumero", 4), -11.47, 1.0, "2⁻⁴ · línea base d=1");
    cerca(casilla("lineaBase", "porEstado", 4), -11.80, 1.0, "2⁻⁴ · línea base d=3");
    cerca(casilla("actorCritico", "unNumero", 4), -147.08, 15.0, "2⁻⁴ · crítico d=1");
    cerca(casilla("actorCritico", "porEstado", 4), -11.49, 1.0, "2⁻⁴ · crítico d=3");
    cerca(casilla("lineaBase", "porEstado", 6), -170.60, 20.0, "2⁻⁶ · línea base d=3 (la casilla que se rompe)");
    assert.equal(M5("actorCritico", "unNumero", 4).r.colapsadas.actorCritico, 50, "2⁻⁴ · crítico d=1: 50/50");
    /* ⚠ El guion dice «7 de 50 colapsadas» en esta casilla. Por el criterio
       del §6 del módulo 6 —p ≥ 0,95 O p ≤ 0,05, que es el que implementa
       `UMBRAL_COLAPSO`— son OCHO: siete hacia p→1 y una hacia p→0
       (p = 1,8·10⁻⁶). El 7 del guion cuenta solo el lado alto. */
    const rota = M5("lineaBase", "porEstado", 6);
    assert.equal(rota.r.colapsadas.lineaBase, 8, "2⁻⁶ · línea base d=3: colapsadas por el criterio del motor");
    assert.equal(
      Array.from(rota.detalle.pFinal).filter((p) => p >= UMBRAL_COLAPSO.alto).length, 7,
      "2⁻⁶ · línea base d=3: de las ocho, siete se van hacia p→1",
    );
    for (const cap of ["unNumero", "porEstado"]) {
      assert.equal(M5("lineaBase", cap, 4).r.colapsadas.lineaBase, 0, `2⁻⁴ · línea base ${cap}`);
    }
  });
});

/* ===================================================================== *
 * MÓDULO 6 · reproducibilidad   [R]
 * Configuración común: 300 × 20, semilla 2026, p₀ = 0,05, tope 1000,
 * incremento acumulado por episodio, δ = 10⁻².
 * ⚠ α^θ por omisión = 2⁻⁷ (subido de 2⁻⁹ por R6-4). Los valores de 2⁻⁹ se
 * conservan porque son los que sostienen la comparación de R6-4.
 * ===================================================================== */

describe("Módulo 6 · el colapso de la política, y el freno [R]", () => {
  test("R6-1: con α^θ = 2⁻⁷ y sin freno colapsan 8 de 20 ejecuciones", () => {
    assert.equal(M6(7, null).r.colapsadas.reinforce, 8, "colapsadas sin freno con 2⁻⁷");
    /* Y con 2⁻⁹ —el antiguo valor por omisión— no colapsa ninguna: es lo que
       obligó a subir el deslizador. */
    assert.equal(M6(9, null).r.colapsadas.reinforce, 0, "colapsadas sin freno con 2⁻⁹");
  });

  test("R6-2: con freno (δ = 10⁻²) no colapsa ninguna: 8 → 0", () => {
    assert.equal(M6(7, { delta: 1e-2 }).r.colapsadas.reinforce, 0, "colapsadas con freno con 2⁻⁷");
    assert.equal(M6(9, { delta: 1e-2 }).r.colapsadas.reinforce, 0, "colapsadas con freno con 2⁻⁹");
  });

  test("R6-3: G₀ medio de los últimos 30 episodios: −408,44 sin freno y −13,02 con freno", () => {
    const sin = mediaFinal(M6(7, null).r.curvas["reinforce.G0"], 30);
    const con = mediaFinal(M6(7, { delta: 1e-2 }).r.curvas["reinforce.G0"], 30);
    cerca(sin, -408.44, 40.0, "G₀ final sin freno (2⁻⁷)");
    cerca(con, -13.02, 8.0, "G₀ final con freno (2⁻⁷)");
    assert.ok(con > sin + 100, `con freno (${con}) debería ser muchísimo mejor que sin él (${sin})`);
    /* Con 2⁻⁹ el freno también mejora, pero por poco: no hay nada que frenar. */
    const sin9 = mediaFinal(M6(9, null).r.curvas["reinforce.G0"], 30);
    const con9 = mediaFinal(M6(9, { delta: 1e-2 }).r.curvas["reinforce.G0"], 30);
    cerca(sin9, -12.07, 8.0, "G₀ final sin freno (2⁻⁹)");
    cerca(con9, -11.27, 8.0, "G₀ final con freno (2⁻⁹)");
  });

  test("R6-4: la frontera del colapso está en 2⁻⁸ — tres potencias por encima de lo que el guion suponía", () => {
    /* El barrido completo de las ocho posiciones del deslizador. Es lo que
       fijó el valor por omisión en 2⁻⁷, donde el fenómeno se ve sin ser
       total (8 de 20 colapsan, 12 no). */
    const esperado = { 14: 0, 13: 0, 12: 0, 11: 0, 10: 0, 9: 0, 8: 2, 7: 8 };
    for (const exp of [14, 13, 12, 11, 10, 9, 8, 7]) {
      assert.equal(
        M6(exp, null).r.colapsadas.reinforce, esperado[exp],
        `colapsadas de 20 con α^θ = 2⁻${exp}`,
      );
    }
  });

  test("R6-5: una sola actualización puede mover p 0,9936 — de un extremo al otro", () => {
    cercaPorciento(M6(7, null).r.saltoMaxP.reinforce, 0.9936, 0.20, "mayor salto de p sin freno (2⁻⁷)");
    cercaPorciento(M6(9, null).r.saltoMaxP.reinforce, 0.9500, 0.20, "mayor salto de p sin freno (2⁻⁹)");
    cercaPorciento(M6(7, { delta: 1e-2 }).r.saltoMaxP.reinforce, 0.0707, 0.20, "mayor salto de p con freno");
  });

  test("R6-6: la mayor D_KL de una actualización sin freno es 27,417: tres órdenes por encima de δ = 10⁻²", () => {
    cercaPorciento(M6(7, null).r.klMax.reinforce, 27.417, 0.25, "mayor D_KL sin freno (2⁻⁷)");
    cercaPorciento(M6(9, null).r.klMax.reinforce, 11.434, 0.25, "mayor D_KL sin freno (2⁻⁹)");
    const conFreno = M6(7, { delta: 1e-2 }).r.klMax.reinforce;
    assert.ok(conFreno <= 1e-2 + 1e-9, `con freno la mayor D_KL es ${conFreno} y no puede pasar de δ`);
  });

  test("R6-7: el freno recorta el 21,2 % de las actualizaciones con δ = 10⁻² (1 272 de 6 000)", () => {
    const actualizaciones = 300 * 20;
    assert.equal(M6(7, { delta: 1e-2 }).r.recortes.reinforce, 1272, "recortes con 2⁻⁷ y δ = 10⁻²");
    cercaPorciento(1272 / actualizaciones, 0.212, 0.10 / 0.212, "porcentaje recortado");
    assert.equal(M6(9, { delta: 1e-2 }).r.recortes.reinforce, 198, "recortes con 2⁻⁹ y δ = 10⁻²");
    assert.equal(M6(7, { delta: 1e-3 }).r.recortes.reinforce, 3048, "recortes con 2⁻⁷ y δ = 10⁻³");
    assert.equal(M6(9, { delta: 1e-3 }).r.recortes.reinforce, 1217, "recortes con 2⁻⁹ y δ = 10⁻³");
  });

  test("R6-8: con freno la p media final es 0,5197 — el freno evita el desastre, no recupera el óptimo", () => {
    /* ⚠ Declarado en el guion: con 2⁻⁷ el freno pasa de 8 colapsos a 0 y de
       −408 a −13, pero la política se queda en 0,52 frente a 2−√2 = 0,5858.
       Con 2⁻⁹, donde no había nada que frenar, acababa en 0,5833. */
    const con = M6(7, { delta: 1e-2 }).detalle.pFinal;
    const sin = M6(7, null).detalle.pFinal;
    cerca(media(con), 0.5197, 0.08, "p media final con freno (2⁻⁷)");
    cercaPorciento(desviacion(con), 0.1772, 0.25, "σ de p con freno");
    cerca(media(sin), 0.4263, 0.08, "p media final sin freno (2⁻⁷)");
    cercaPorciento(desviacion(sin), 0.3443, 0.25, "σ de p sin freno");
    assert.ok(media(con) > media(sin), "con freno la política acaba mejor que sin él");
    assert.ok(Math.abs(media(con) - P_ESTRELLA) > 0.05, "pero no llega a 2−√2: el freno no recupera el óptimo");
    cerca(media(M6(9, { delta: 1e-2 }).detalle.pFinal), 0.5833, 0.08, "p media final con freno (2⁻⁹)");
  });

  test("R6-9: el freno elimina POR COMPLETO los episodios que topan: 1 471 sin freno · 0 con freno", () => {
    assert.equal(M6(7, null).r.truncados.reinforce, 1471, "truncados sin freno (2⁻⁷)");
    assert.equal(M6(7, { delta: 1e-2 }).r.truncados.reinforce, 0, "truncados con freno (2⁻⁷)");
    assert.equal(M6(9, null).r.truncados.reinforce, 204, "truncados sin freno (2⁻⁹)");
    assert.equal(M6(9, { delta: 1e-2 }).r.truncados.reinforce, 0, "truncados con freno (2⁻⁹)");
  });

  test("R6-10: ninguna ejecución se corta por desbordamiento de θ, en ninguna de las ocho posiciones", () => {
    /* El colapso satura la softmax mucho antes de que ‖θ‖ llegue a 10⁶. */
    for (const exp of [14, 13, 12, 11, 10, 9, 8, 7]) {
      assert.equal(M6(exp, null).r.cortadas.reinforce, 0, `cortadas sin freno con 2⁻${exp}`);
    }
    for (const exp of [7, 9]) {
      assert.equal(M6(exp, { delta: 1e-2 }).r.cortadas.reinforce, 0, `cortadas con freno con 2⁻${exp}`);
    }
  });

  test("el freno exige `acumularEpisodio: true` — el motor lanza si no", () => {
    assert.throws(
      () => reinforce(PASILLO, thetaDeP(PASILLO, P0), 10, {
        alphaTheta: Math.pow(2, -7), rng: generador(SEMILLA), freno: { delta: 1e-2 },
      }),
      /acumularEpisodio/,
      "sin acumular no hay UNA actualización por episodio que recortar",
    );
  });
});
