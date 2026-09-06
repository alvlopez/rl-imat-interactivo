/* Tests del motor de n pasos, retorno λ y trazas de elegibilidad del Tema 4
 * (`assets/npasos.js`, segunda página del tema).
 *
 * Mismo criterio que `tests/sinmodelo.test.js`: no se comprueba «que el código
 * no falle», se comprueba que el código REPRODUCE el libro (Sutton & Barto §7.1,
 * §7.2, §12.1, §12.2, §12.6) y el material de clase. Cada test lleva el código
 * de la aserción del guion (`Interactivo/T4_recurso/guion-tema4b.md`, §8 de cada
 * módulo y §C4) para poder rastrear del número al párrafo que lo justifica.
 *
 *   cd Interactivo/web && npm test
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DOS CLASES DE TEST, y cada uno dice de cuál es
 *
 *   [C] CONTRASTE. No dependen del flujo aleatorio: equivalencias algebraicas,
 *       valores analíticos, aritmética cerrada. Tolerancia estricta (0, 1e-15 o
 *       1e-12), y si falla uno hay un error de fondo, no una fluctuación. Son
 *       las aserciones más valiosas de este motor: n = 1 ≡ TD(0), n ≥ T ≡ Monte
 *       Carlo, λ = 0 ≡ TD(0), (12.3) ≡ (12.2), las raíces del empate de trazas.
 *
 *   [R] REPRODUCIBILIDAD. Dependen del lote sembrado (semilla 2026, 100 × 10
 *       episodios). Tolerancia la que declare el guion.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ÍNDICES: BASE 0 EN EL MOTOR, BASE 1 EN EL GUION
 *
 * El motor numera los 19 estados no terminales del paseo como 0…18 (terminales
 * en 19 y 20). El guion los escribe en base 1 en M1-A8, en M1-A10 y en el
 * episodio de referencia (S₀ = 10 … S₉ = 19). La traducción es s_motor =
 * s_guion − 1, y está comentada en cada test que la usa: es el sitio más
 * probable de todo el módulo para un error de índice.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CUATRO ASERCIONES DEL GUION QUE NO SE SOSTIENEN TAL CUAL
 *
 *   M1-A10  EL EPISODIO DE REFERENCIA DEL GUION VA ESPEJADO. El guion (y la
 *           fila M1-A10 de §C4) dice que el episodio más corto del lote —rep.
 *           68, ep. 7— es «el camino directo del centro a la derecha», con
 *           `estados = [10,…,19]` y `recompensas = [0×9, 1]`. Es el más corto y
 *           está exactamente donde dice, pero VA A LA IZQUIERDA: en base 0,
 *           `estados = [9,8,…,0]`, R₁₀ = −1, T = 10. La convención de la moneda
 *           de `sinmodelo.js` («uniforme() < 0,5 ⇒ derecha») está fijada y no se
 *           toca; lo que hay que corregir es la redacción del guion. El test de
 *           abajo fija el hecho real.
 *
 *   M1-A7b  LOS 2,18·10⁻⁵ SON DE UNA V ÚNICA PARA LAS 1000, no de una V por
 *           repetición. Con una V por repetición (que es como mide el barrido)
 *           la diferencia máxima entre n = 512 y Monte Carlo es 4,72·10⁻², tres
 *           órdenes de magnitud mayor. La fila de §C4 dice «lote completo», así
 *           que la lectura correcta es la de la V única; el test comprueba LAS
 *           DOS y deja escritas las dos cifras.
 *
 *   M2-A4   k = 1 NO DEVUELVE 1,000000. La tabla de §8 del módulo 2 escribe
 *           «k = 1 → 1,000000 (no hay para λ < 1)»; el motor devuelve `null`, que
 *           es lo que pide §C4 y lo que la propia función documenta (devolver 1
 *           se leería como «empatan»). Se escribe `null`.
 *
 *   M2-A6   «V[TIMBRE] = −0,3 EXACTO» no es exacto en coma flotante: sale
 *           −0,30000000000000004. La aritmética es correcta (3 × 0,1 con α y λ
 *           en binario); el test usa tolerancia 1e-15 y lo documenta en vez de
 *           afirmar una igualdad bit a bit que ninguna implementación cumpliría.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DOS HECHOS QUE NO ESTÁN EN EL GUION Y QUE ESTOS TESTS FIJAN
 *
 *   1. LA EQUIVALENCIA ENTRE LAS DOS VISTAS ES MÁS DÉBIL DE LO QUE SUELE
 *      CONTARSE (ejercicio 12.4). Con V congelada coinciden a <1e-15; sobre
 *      episodios reales del paseo con V no uniforme se separan hasta 2,1·10⁻¹.
 *      Las dos mitades son el test: la salvedad es contenido de la página
 *      (`t4b.b9.p5`), no una tolerancia que haya que relajar.
 *
 *   2. LA TRAZA ACUMULATIVA CON λ = 1 EN LÍNEA DIVERGE. Sobre un episodio de
 *      300 pasos con α = 0,1, `tdLambdaAtras` llega a 7,4·10⁶ mientras la vista
 *      hacia adelante se queda en 4,15. No es un bug: es la razón de ser de las
 *      trazas de reemplazo y dutch (§12.6, §12.5). Se fija como hecho.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  paseoAleatorio,
  loteEpisodios,
  muestrearEpisodio,
  tdCero,
  mcConstante,
  sarsaEpisodio,
  errorRMS,
} from "../assets/sinmodelo.js";

import {
  retornoNPasos,
  nStepTD,
  nStepSarsa,
  barridoNAlpha,
  caminoDirectoDerecha,
  retornoLambda,
  pesosLambda,
  retornoLambdaFueraDeLinea,
  tdLambdaAtras,
  cadenaTimbreLuz,
  creditoPorLambda,
  cruceTrazas,
  TIMBRE,
  LUZ,
  DESCARGA,
} from "../assets/npasos.js";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..");

/* ===================================================================== *
 * Utilidades comunes y material compartido
 * ===================================================================== */

const GAMMA = 1; // fijo en todo el Tema 4

/** Comparación numérica con mensaje legible. */
function cerca(x, objetivo, tol, etiqueta) {
  assert.ok(
    Math.abs(x - objetivo) <= tol,
    `${etiqueta}: ${x}, se esperaba ${objetivo} (tolerancia ${tol})`,
  );
}

/** Comparación vectorial con mensaje legible. */
function cercaVector(v, esperado, tol, etiqueta) {
  assert.equal(v.length, esperado.length, `${etiqueta}: longitud`);
  esperado.forEach((x, i) => cerca(v[i], x, tol, `${etiqueta}[${i}]`));
}

/** máx_s |A(s) − B(s)|, la métrica de todas las equivalencias de este fichero. */
const maxDif = (A, B) => Math.max(...A.map((x, s) => Math.abs(x - B[s])));

/** El paseo de 19 estados del Example 7.1 y de la figura 7.2. */
const paseo19 = paseoAleatorio({
  nEstados: 19, recompensaIzquierda: -1, recompensaDerecha: 1, valorInicial: 0,
});

/**
 * EL LOTE. 100 repeticiones × 10 episodios, semilla 2026, un solo generador
 * para todo (condición del libro: «los mismos conjuntos de caminos para todos
 * los ajustes de parámetros»). Se genera UNA vez —cuesta ~10 ms— y lo comparten
 * todos los tests [R] del módulo 1.
 */
const LOTE = loteEpisodios(paseo19, null, null, {
  semilla: 2026, repeticiones: 100, episodios: 10,
});
const LONGITUDES = LOTE.flat().map((ep) => ep.T);

/** El episodio de referencia del cronograma: del centro a la derecha, T = 10. */
const REFERENCIA = caminoDirectoDerecha(paseo19);

/** Aplica `metodo` a todos los episodios del lote sobre una ÚNICA V. */
function pasadaUnicaV(metodo) {
  const V = new Array(19).fill(0);
  for (const repeticion of LOTE) for (const ep of repeticion) metodo(V, ep);
  return V;
}

/** máx sobre repeticiones de la diferencia final entre dos métodos, V por fila. */
function difPorRepeticion(metodoA, metodoB) {
  let peor = 0;
  for (const repeticion of LOTE) {
    const A = new Array(19).fill(0);
    const B = new Array(19).fill(0);
    for (const ep of repeticion) {
      metodoA(A, ep);
      metodoB(B, ep);
    }
    peor = Math.max(peor, maxDif(A, B));
  }
  return peor;
}

/* ===================================================================== *
 * EL ENTORNO Y EL LOTE  ·  M1-A1, M1-A2, M1-A10
 * Fuente: S&B Example 7.1 · guion §6 del módulo 1
 * ===================================================================== */

test("entorno [C]: el paseo de 19 estados arranca en el central y deja los terminales fuera de [0, 19)", () => {
  /* El guion escribe «estados 1…19, inicial el 10» (base 1). En base 0 son
     0…18 y el inicial es el ÍNDICE 9. Los dos terminales viven en 19 y 20, es
     decir, fuera del rango sobre el que se promedia el RMS: si ocuparan índice
     dentro, el error se promediaría sobre 21 estados y no sobre 19. */
  assert.equal(paseo19.nEstados, 19);
  assert.equal(paseo19.estadoInicial, 9); // el «10» del guion, en base 0
  assert.equal(paseo19.terminalIzquierda, 19);
  assert.equal(paseo19.terminalDerecha, 20);
  assert.equal(paseo19.valoresVerdaderos.length, 19);
  assert.equal(paseo19.nAcciones(0), 0, "es un proceso de recompensa: no hay decisiones");
  for (let s = 0; s < 19; s++) assert.equal(paseo19.esTerminal(s), false);
  assert.equal(paseo19.esTerminal(19), true);
  assert.equal(paseo19.esTerminal(20), true);
});

test("M1-A1 [C]: v_π(s) = (s − 10)/10 en base 1 — de −0,9 a +0,9 en pasos de 0,1, con v_π = 0 en el centro", () => {
  /* Deducción del paseo simétrico: v_π(s) = P(salir derecha) − P(salir
     izquierda). El libro no los tabula (Example 7.1); aquí hacen falta para
     medir el error. En base 0 la fórmula es v_π(s) = (s − 9)/10. */
  const esperados = [];
  for (let s = 0; s < 19; s++) esperados.push((s - 9) / 10);
  cercaVector(paseo19.valoresVerdaderos, esperados, 1e-12, "M1-A1");
  cerca(paseo19.valoresVerdaderos[0], -0.9, 1e-12, "M1-A1: s = 1 del guion (índice 0)");
  cerca(paseo19.valoresVerdaderos[9], 0, 1e-12, "M1-A1: s = 10 del guion (índice 9)");
  cerca(paseo19.valoresVerdaderos[18], 0.9, 1e-12, "M1-A1: s = 19 del guion (índice 18)");
});

test("M1-A2 [C]: el RMS de la inicialización V ≡ 0 vale √0,3 = 0,5477225575", () => {
  /* Valor cerrado: la media de los cuadrados de (−0,9; −0,8; …; 0,9) es 0,3,
     así que el RMS es √0,3. Es lo que explica que el eje y de la figura 7.2
     llegue justo a 0,55, y es el ancla del punto α = 0 del barrido. */
  const rms = errorRMS(new Array(19).fill(0), paseo19.valoresVerdaderos);
  cerca(rms, Math.sqrt(0.3), 1e-12, "M1-A2 (valor cerrado)");
  cerca(rms, 0.5477225575, 1e-9, "M1-A2 (cifra del guion)");
});

test("M1-A10 [R]: el lote de 1000 episodios tiene T medio 102,25, mínimo 10, máximo 768 y mediana 82", () => {
  /* Fija el CONTRATO DE CONSUMO DEL rng con `sinmodelo.js`: si `muestrearEpisodio`
     cambiara el orden o el número de valores que consume, este test es el
     primero que se entera y con él se caen todos los números reproducibles de
     la página. Cuentas exactas sobre 1000 episodios sembrados, sin tolerancia. */
  assert.equal(LOTE.length, 100);
  assert.equal(LOTE.every((rep) => rep.length === 10), true);
  assert.equal(LONGITUDES.length, 1000);

  const ordenadas = [...LONGITUDES].sort((a, b) => a - b);
  const media = LONGITUDES.reduce((a, b) => a + b, 0) / LONGITUDES.length;
  cerca(media, 102.25, 1e-12, "M1-A10: T medio");
  assert.equal(ordenadas[0], 10, "M1-A10: T mínimo");
  assert.equal(ordenadas.at(-1), 768, "M1-A10: T máximo");
  // Mediana de 1000 valores: media de los dos centrales, que aquí valen 82 los dos.
  assert.equal((ordenadas[499] + ordenadas[500]) / 2, 82, "M1-A10: mediana");
  // La guardia `maxPasos = 100000` no se activa nunca con esta semilla.
  assert.equal(LOTE.flat().some((ep) => ep.truncado), false);
});

test("M1-A10 bis [R]: el episodio más corto está en la rep. 68 / ep. 7 y va a la IZQUIERDA, no a la derecha", () => {
  /* CORRECCIÓN DEL GUION. M1-A10 y la fila de §C4 dicen que ese episodio es «el
     camino directo del centro a la derecha», `estados = [10,…,19]` y
     `recompensas = [0×9, 1]` (base 1). Es el más corto y está donde dice, pero
     el camino REAL es el espejo: en base 0, `estados = [9,8,…,0]` —el guion lo
     escribiría [10,9,…,1]— y R₁₀ = −1, no +1.
     La convención de la moneda de `sinmodelo.js` («uniforme() < 0,5 ⇒ derecha»)
     está fijada y no se toca: lo que hay que corregir es la frase del guion. */
  const corto = LOTE[68][7];
  assert.equal(corto.T, 10);
  assert.deepEqual(corto.estados, [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
  assert.deepEqual(corto.recompensas, [0, 0, 0, 0, 0, 0, 0, 0, 0, -1]);

  // Y es el ÚNICO de longitud 10 en las 1000: la localización del guion es buena.
  const deDiez = [];
  LOTE.forEach((rep, i) => rep.forEach((ep, j) => {
    if (ep.T === 10) deDiez.push({ repeticion: i, episodio: j });
  }));
  assert.deepEqual(deDiez, [{ repeticion: 68, episodio: 7 }]);

  // Ningún episodio del lote es el camino directo a la DERECHA (T = 10 y R = +1).
  const aLaDerecha = LOTE.flat().filter((ep) => ep.T === 10 && ep.recompensas.at(-1) === 1);
  assert.equal(aLaDerecha.length, 0);
});

test("M1-A10 ter [R]: solo DOS de los 1000 episodios pasan de 512 pasos — son los de T = 554 y T = 768", () => {
  /* Es el hecho que explica el 2,18·10⁻⁵ de M1-A7b: con n = 512 casi todas las
     ventanas se truncan y el retorno a n pasos ES el retorno real; las dos
     únicas excepciones están en las repeticiones 90 y 99. */
  const largos = [];
  LOTE.forEach((rep, i) => rep.forEach((ep, j) => {
    if (ep.T > 512) largos.push({ repeticion: i, episodio: j, T: ep.T });
  }));
  assert.deepEqual(largos, [
    { repeticion: 90, episodio: 3, T: 768 },
    { repeticion: 99, episodio: 5, T: 554 },
  ]);
  assert.equal(LONGITUDES.filter((T) => T > 1024).length, 0, "ninguno pasa de 1024");
});

test("episodio de referencia [C]: `caminoDirectoDerecha` da S₀ = 9 … S₉ = 18, R₁₀ = +1 y T = 10", () => {
  /* El guion lo escribe en base 1 como S₀ = 10 … S₉ = 19. La función NO cablea
     índices: simula el entorno con un rng que siempre saca «derecha», así que
     sale correcto sea cual sea `nEstados` y sin traducir de base a mano. */
  assert.equal(REFERENCIA.T, 10);
  assert.deepEqual(REFERENCIA.estados, [9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
  assert.deepEqual(REFERENCIA.recompensas, [0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
  assert.deepEqual(REFERENCIA.acciones, [], "el paseo no tiene acciones");

  // Y es genérico: en el paseo de 5 estados sale el camino de 3 pasos desde C.
  const corto = caminoDirectoDerecha(paseoAleatorio());
  assert.deepEqual(corto.estados, [2, 3, 4]);
  assert.deepEqual(corto.recompensas, [0, 0, 1]);
});

test("episodio de referencia [C]: si la convención de la moneda se invirtiera, la función lanzaría", () => {
  /* La guardia existe porque todo el módulo 1 se apoya en ese episodio: un
     cambio silencioso en `paso` mandaría al alumno el cronograma espejado. Se
     comprueba con un entorno que delega en el paseo real con la moneda al revés. */
  const espejado = Object.create(paseo19);
  espejado.paso = (s, a) => paseo19.paso(s, a, { uniforme: () => 0.9 });
  assert.throws(
    () => caminoDirectoDerecha(espejado),
    /no ha producido el camino directo a la derecha/,
  );
});

/* ===================================================================== *
 * EL RETORNO A n PASOS  ·  ecuación (7.1) y la convención de truncamiento
 * Fuente: S&B §7.1 · guion §6 del módulo 1 · N-A1
 * ===================================================================== */

/* Episodio de juguete para la aritmética a mano:
   S = [0, 1, 0], R = [1, 2, 3], T = 3, γ = 1. */
const JUGUETE = { estados: [0, 1, 0], acciones: [0, 1, 0], recompensas: [1, 2, 3], T: 3 };

test("retornoNPasos [C]: (7.1) con aritmética a mano, incluido el término de arranque γⁿ V(S_{τ+n})", () => {
  /* Con V = [10, 20]:
       G_{0:1} = R₁ + V(S₁) = 1 + 20 = 21
       G_{0:2} = R₁ + R₂ + V(S₂) = 1 + 2 + 10 = 13
     Y con γ = 0,5: G_{0:2} = 1 + 0,5·2 + 0,25·V(S₂) = 4,5, que es el camino
     lento (sin sumas acumuladas). Los dos comparten `retornoDesde`. */
  const V = [10, 20];
  assert.equal(retornoNPasos(JUGUETE, 0, 1, V, GAMMA), 21);
  assert.equal(retornoNPasos(JUGUETE, 0, 2, V, GAMMA), 13);
  cerca(retornoNPasos(JUGUETE, 0, 2, V, 0.5), 4.5, 1e-12, "γ = 0,5");
});

test("retornoNPasos [C]: la convención de truncamiento — si τ + n ≥ T no hay arranque y G_{τ:τ+n} = G_τ", () => {
  /* «Es el error de implementación más frecuente del capítulo 7»: sin esta
     línea, n grande no es Monte Carlo sino una aproximación suya y se cae la
     equivalencia de M1-A7. G_0 = 1 + 2 + 3 = 6 con γ = 1, y NO se le suma V. */
  const V = [10, 20];
  for (const n of [3, 4, 9, 1024]) {
    assert.equal(retornoNPasos(JUGUETE, 0, n, V, GAMMA), 6, `n = ${n} debe dar G_0`);
  }
  // El último instante siempre está truncado, sea cual sea n.
  assert.equal(retornoNPasos(JUGUETE, 2, 1, V, GAMMA), 3);
});

test("N-A1 [C]: sobre el episodio de referencia y V ≡ 0, G_{0:n} vale 0 para n < 10 y 1 para n ≥ 10", () => {
  /* Es (7.1) más el truncamiento leídos de un tirón: mientras la ventana no
     alcance la terminación el objetivo es puro arranque —y V ≡ 0—, y en cuanto
     la alcanza aparece la recompensa terminal +1. */
  const V = new Array(19).fill(0);
  for (const n of [1, 2, 5, 9]) {
    assert.equal(retornoNPasos(REFERENCIA, 0, n, V, GAMMA), 0, `N-A1: n = ${n}`);
  }
  for (const n of [10, 11, 16, 1024]) {
    assert.equal(retornoNPasos(REFERENCIA, 0, n, V, GAMMA), 1, `N-A1: n = ${n}`);
  }
});

/* ===================================================================== *
 * LAS EQUIVALENCIAS ALGEBRAICAS DE n PASOS  [C]
 * M1-A6 (n = 1 ≡ TD(0)) · M1-A7 (n ≥ T ≡ MC) · N-A2 (SARSA)
 *
 * Son las aserciones más valiosas del motor: no dependen del azar, y si una
 * falla es que se ha roto (7.1) o la convención de truncamiento.
 * ===================================================================== */

test("M1-A6 [C]: n = 1 es EXACTAMENTE TD(0) — diferencia 0 en los 19 estados, sobre las 100 repeticiones", () => {
  /* Identidad: (7.1) con n = 1 es G_{τ:τ+1} = R_{τ+1} + γV(S_{τ+1}), que es el
     objetivo de (6.2). Se comprueba contra `tdCero` de `sinmodelo.js`, que es
     otra implementación: la coincidencia es bit a bit, no numérica. */
  const dif = difPorRepeticion(
    (V, ep) => nStepTD(V, ep, { n: 1, alpha: 0.3, gamma: GAMMA }),
    (V, ep) => tdCero(V, ep, { alpha: 0.3, gamma: GAMMA }),
  );
  assert.equal(dif, 0, `M1-A6: máx|V_nStepTD − V_tdCero| = ${dif}, debe ser 0 exacto`);
});

test("M1-A7a [C]: n = 1024 > máx T = 768 es EXACTAMENTE Monte Carlo de cada visita — diferencia 0", () => {
  /* Consecuencia directa de la convención de truncamiento: si ninguna ventana
     cabe dentro del episodio, TODOS los objetivos son el retorno real y (7.2)
     se convierte en (6.1) de cada visita con α constante. Se compara sobre el
     LOTE COMPLETO con una V única, que es como lo mide §C4. */
  const conN = pasadaUnicaV((V, ep) => nStepTD(V, ep, { n: 1024, alpha: 0.1, gamma: GAMMA }));
  const conMC = pasadaUnicaV((V, ep) => mcConstante(V, ep, { alpha: 0.1, gamma: GAMMA, primeraVisita: false }));
  const dif = maxDif(conN, conMC);
  assert.equal(dif, 0, `M1-A7a: máx|V_1024 − V_MC| = ${dif}, debe ser 0 exacto`);

  // Y también repetición a repetición, que es como lo usa el barrido.
  assert.equal(difPorRepeticion(
    (V, ep) => nStepTD(V, ep, { n: 1024, alpha: 0.1, gamma: GAMMA }),
    (V, ep) => mcConstante(V, ep, { alpha: 0.1, gamma: GAMMA, primeraVisita: false }),
  ), 0);
});

test("M1-A7b [R]: con n = 512 la diferencia con MC es 2,18·10⁻⁵ (V única) y 4,72·10⁻² (V por repetición)", () => {
  /* Es el detalle fino del guion, y es el test, no un estorbo: la diferencia no
     es 0 PORQUE 2 de los 1000 episodios pasan de 512 pasos (T = 554 y T = 768,
     localizados en M1-A10 ter). Si fuera 0, es que el truncamiento se está
     aplicando cuando no toca.

     PRECISIÓN SOBRE EL GUION: el 2,18·10⁻⁵ solo sale con una V ÚNICA para las
     1000 (la lectura literal de «lote completo» en §C4). Con una V por
     repetición —que es como mide `barridoNAlpha`— la diferencia es 4,72·10⁻²,
     tres órdenes de magnitud mayor, porque las dos repeticiones afectadas no se
     diluyen en el promedio. Se fijan las dos cifras. */
  const conN = pasadaUnicaV((V, ep) => nStepTD(V, ep, { n: 512, alpha: 0.1, gamma: GAMMA }));
  const conMC = pasadaUnicaV((V, ep) => mcConstante(V, ep, { alpha: 0.1, gamma: GAMMA, primeraVisita: false }));
  const difUnica = maxDif(conN, conMC);
  assert.ok(difUnica > 0, "M1-A7b: si la diferencia fuera 0, el truncamiento estaría mal");
  assert.ok(difUnica < 1e-4, `M1-A7b: ${difUnica} debería ser < 1e-4`);
  cerca(difUnica, 2.18e-5, 1e-7, "M1-A7b (V única, cifra del guion)");

  const difPorFila = difPorRepeticion(
    (V, ep) => nStepTD(V, ep, { n: 512, alpha: 0.1, gamma: GAMMA }),
    (V, ep) => mcConstante(V, ep, { alpha: 0.1, gamma: GAMMA, primeraVisita: false }),
  );
  cerca(difPorFila, 4.716943e-2, 1e-7, "M1-A7b (V por repetición, valor del motor)");
});

test("M1-A7c [C]: con n = 768 = máx T ya coincide con Monte Carlo — el umbral es n ≥ T, no n ≫ T", () => {
  /* Cierra la lectura del módulo: no hace falta un n «muy grande», basta con
     que la ventana llegue a la terminación. Con n = 768 (la longitud del
     episodio más largo) la diferencia vuelve a ser 0 exacto. */
  assert.equal(difPorRepeticion(
    (V, ep) => nStepTD(V, ep, { n: 768, alpha: 0.1, gamma: GAMMA }),
    (V, ep) => mcConstante(V, ep, { alpha: 0.1, gamma: GAMMA, primeraVisita: false }),
  ), 0);
});

test("N-A2 [C]: `nStepSarsa` con n = 1 es EXACTAMENTE `sarsaEpisodio` de `sinmodelo.js` — diferencia 0", () => {
  /* (7.4) con n = 1 es G_{τ:τ+1} = R_{τ+1} + γQ(S_{τ+1}, A_{τ+1}), el objetivo
     de (6.7). El libro llama a eso «SARSA a un paso» o «SARSA(0)». Se comprueba
     contra la otra implementación, sobre un episodio con estados repetidos para
     que la V viva importe. */
  const Qa = [[0, 0], [0, 0]];
  const Qb = [[0, 0], [0, 0]];
  nStepSarsa(Qa, JUGUETE, { n: 1, alpha: 0.3, gamma: GAMMA });
  sarsaEpisodio(Qb, JUGUETE, { alpha: 0.3, gamma: GAMMA });
  assert.deepEqual(Qa, Qb);

  // Con episodios reales del paseo, dándoles una acción ficticia por paso.
  const conAcciones = LOTE[0].map((ep) => ({ ...ep, acciones: ep.estados.map((_, t) => t % 2) }));
  const Q1 = Array.from({ length: 19 }, () => [0, 0]);
  const Q2 = Array.from({ length: 19 }, () => [0, 0]);
  for (const ep of conAcciones) {
    nStepSarsa(Q1, ep, { n: 1, alpha: 0.2, gamma: GAMMA });
    sarsaEpisodio(Q2, ep, { alpha: 0.2, gamma: GAMMA });
  }
  assert.deepEqual(Q1, Q2);
});

test("N-A2 bis [C]: `nStepSarsa` con n = 2 reparte el crédito según (7.4), a mano", () => {
  /* Episodio S = [0,1,0], A = [0,1,0], R = [1,2,3], Q ≡ 0, α = 1, γ = 1:
       τ=0: 0+2 < 3 ⇒ G = R₁+R₂+Q(S₂,A₂) = 1+2+0 = 3 ⇒ Q(0,0) = 3
       τ=1: 1+2 ≥ 3 ⇒ G = R₂+R₃ = 5 (truncado)      ⇒ Q(1,1) = 5
       τ=2: G = R₃ = 3, y Q(0,0) ya vale 3          ⇒ se queda en 3
     Las actualizaciones se anotan en t = τ + n − 1: 1, 2 y 3. */
  const Q = [[0, 0], [0, 0]];
  const { actualizaciones, traza } = nStepSarsa(Q, JUGUETE, {
    n: 2, alpha: 1, gamma: GAMMA, registro: true,
  });
  assert.deepEqual(Q, [[3, 0], [0, 5]]);
  assert.equal(actualizaciones, 3);
  assert.deepEqual(traza.map((u) => u.t), [1, 2, 3]);
  assert.deepEqual(traza.map((u) => u.G), [3, 5, 3]);
  assert.deepEqual(traza.map((u) => u.accion), [0, 1, 0]);
});

/* ===================================================================== *
 * EL CRONOGRAMA  ·  M1-A8 y M1-A9
 * Fuente: S&B §7.1, «no changes at all are made during the first n − 1 steps»
 * ===================================================================== */

test("M1-A8 [C]: una pasada con α = 0,4 mueve los mín(n, 10) ÚLTIMOS estados, todos a 0,400", () => {
  /* OJO CON LA BASE. El guion escribe los conjuntos en base 1:
       n=1→{19} · n=2→{18,19} · n=4→{16,…,19} · n=8→{12,…,19} · n≥10→{10,…,19}
     En base 0 hay que restar 1 a cada índice, que es la lista de abajo.
     Todos valen 0,400 porque parten de V ≡ 0 y su objetivo es el retorno real
     (la recompensa terminal +1): V ← 0 + 0,4·(1 − 0) = 0,4. Los demás siguen en
     0 EXACTO, sin tolerancia: si alguno se moviera, la ventana estaría mal. */
  const esperados = {
    1: [18], //            guion {19}
    2: [17, 18], //        guion {18,19}
    4: [15, 16, 17, 18], // guion {16,…,19}
    8: [11, 12, 13, 14, 15, 16, 17, 18], // guion {12,…,19}
    10: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18], // guion {10,…,19}
    16: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18], // idem: n ≥ T ya no añade nada
  };
  for (const [n, movidos] of Object.entries(esperados)) {
    const V = new Array(19).fill(0);
    nStepTD(V, REFERENCIA, { n: Number(n), alpha: 0.4, gamma: GAMMA });
    const cambiados = V.map((x, s) => [s, x]).filter(([, x]) => x !== 0).map(([s]) => s);
    assert.deepEqual(cambiados, movidos, `M1-A8: n = ${n}, estados movidos (base 0)`);
    for (const s of movidos) cerca(V[s], 0.4, 1e-12, `M1-A8: n = ${n}, V[${s}]`);
    assert.equal(cambiados.length, Math.min(Number(n), 10));
  }
});

test("M1-A9 [C]: el total es SIEMPRE T = 10 actualizaciones; lo que cambia es cuándo se hacen", () => {
  /* S&B §7.1. Tres cuentas por cada n:
       · primera actualización en t = n − 1;
       · dentro del episodio: máx(T − n + 1, 0);
       · ya terminado (t ≥ T): mín(n − 1, T);
     y la suma es T sea cual sea n. Es la respuesta a la pregunta 1 del quiz. */
  const T = 10;
  for (const n of [1, 2, 3, 4, 8, 10, 16, 512]) {
    const V = new Array(19).fill(0);
    const { actualizaciones, traza } = nStepTD(V, REFERENCIA, {
      n, alpha: 0.4, gamma: GAMMA, registro: true,
    });
    assert.equal(actualizaciones, T, `M1-A9: total con n = ${n}`);
    assert.equal(traza.length, T, `M1-A9: entradas de la traza con n = ${n}`);
    assert.equal(traza[0].t, n - 1, `M1-A9: primera actualización con n = ${n}`);
    const dentro = traza.filter((u) => u.t < T).length;
    const despues = traza.filter((u) => u.t >= T).length;
    assert.equal(dentro, Math.max(T - n + 1, 0), `M1-A9: dentro del episodio, n = ${n}`);
    assert.equal(despues, Math.min(n - 1, T), `M1-A9: tras terminar, n = ${n}`);
    assert.equal(dentro + despues, T);
    // τ recorre 0…T−1 en orden creciente: es lo que hace que V esté viva.
    assert.deepEqual(traza.map((u) => u.tau), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.deepEqual(traza.map((u) => u.estado), REFERENCIA.estados);
  }
});

test("M1-A9 bis [C]: con n = 10 no se actualiza NADA durante los nueve primeros pasos", () => {
  /* La frase literal de la lectura del módulo, y la pregunta 1 del quiz: la
     primera vez que se puede formar G_{0:10} es en t = 9. */
  const V = new Array(19).fill(0);
  const { traza } = nStepTD(V, REFERENCIA, { n: 10, alpha: 0.4, gamma: GAMMA, registro: true });
  assert.equal(traza.filter((u) => u.t < 9).length, 0);
  assert.equal(traza[0].t, 9);
  assert.equal(traza.filter((u) => u.t >= 10).length, 9);
});

/* ===================================================================== *
 * EL BARRIDO n × α  ·  reproducción de la figura 7.2
 * M1-A3, M1-A4, M1-A5, M1-A11   [R]
 *
 * El barrido completo (10 n × 21 α × 1000 episodios) cuesta ~260 ms: se ejecuta
 * UNA vez y lo comparten los cuatro tests.
 * ===================================================================== */

const BARRIDO = barridoNAlpha(LOTE, {
  vVerdadero: paseo19.valoresVerdaderos,
  nEstados: 19,
  valorInicial: 0,
  episodios: 10,
  gamma: GAMMA,
});

test("M1-A3 [R]: el mejor punto del barrido es n = 4 con α = 0,40 y RMS = 0,257285", () => {
  /* Semilla 2026, 100 repeticiones × 10 episodios. El libro dibuja el mínimo en
     n = 4-8 con α ≈ 0,2-0,4 y error ≈ 0,27 (figura 7.2), así que la
     reproducción cae donde debe. Tolerancia 5e-4, la del guion, y además el
     valor del motor con 1e-6 para que una regresión pequeña también se note. */
  assert.equal(BARRIDO.mejor.n, 4);
  assert.equal(BARRIDO.mejor.alpha, 0.4);
  cerca(BARRIDO.mejor.rms, 0.2573, 5e-4, "M1-A3 (cifra del guion)");
  cerca(BARRIDO.mejor.rms, 0.2572847, 1e-6, "M1-A3 (valor del motor)");
});

test("M1-A4 [R]: los diez pares (n, mejor α, RMS) de la tabla del guion, cifra a cifra", () => {
  // Tolerancia 5e-4 en el RMS (la del guion) y exacta en el α, que es de rejilla.
  const esperados = {
    1: [0.8, 0.3432],
    2: [0.6, 0.2722],
    4: [0.4, 0.2573],
    8: [0.25, 0.2717],
    16: [0.15, 0.3077],
    32: [0.1, 0.3611],
    64: [0.05, 0.4165],
    128: [0.05, 0.4724],
    256: [0.05, 0.5042],
    512: [0.05, 0.5085],
  };
  assert.deepEqual(BARRIDO.ns, [1, 2, 4, 8, 16, 32, 64, 128, 256, 512]);
  assert.equal(BARRIDO.alphas.length, 21);
  for (const [n, [alpha, rms]] of Object.entries(esperados)) {
    assert.equal(BARRIDO.mejorPorN[n].alpha, alpha, `M1-A4: mejor α para n = ${n}`);
    cerca(BARRIDO.mejorPorN[n].rms, rms, 5e-4, `M1-A4: RMS de n = ${n}`);
  }
});

test("M1-A5 [R]: el mejor α es monótono NO CRECIENTE en n, y para n ≥ 64 cae en 0,05", () => {
  /* La lectura del módulo: el α óptimo no existe por separado del n. Con n
     grande el objetivo lleva dentro muchas recompensas reales —mucha varianza—
     y un paso grande la vuelca sobre la estimación. */
  const alphas = BARRIDO.ns.map((n) => BARRIDO.mejorPorN[n].alpha);
  for (let i = 1; i < alphas.length; i++) {
    assert.ok(
      alphas[i] <= alphas[i - 1],
      `M1-A5: el α óptimo sube al pasar de n = ${BARRIDO.ns[i - 1]} a ${BARRIDO.ns[i]}`,
    );
  }
  for (const n of [64, 128, 256, 512]) {
    assert.equal(BARRIDO.mejorPorN[n].alpha, BARRIDO.alphas[1], `M1-A5: n = ${n} en el extremo`);
    assert.equal(BARRIDO.mejorPorN[n].alpha, 0.05);
  }
  /* La frase de la lectura del módulo, con números: α = 0,80 es EL mejor para
     n = 1 (RMS 0,3432) y para n = 64 da 0,7404 — un 78 % peor que su propio
     óptimo (0,4165) y peor incluso que no aprender nada, porque supera el RMS
     de la inicialización, √0,3 = 0,5477. */
  const iOchenta = BARRIDO.alphas.indexOf(0.8);
  cerca(BARRIDO.curvas[1][iOchenta], BARRIDO.mejorPorN[1].rms, 1e-15, "M1-A5: α = 0,80 es el óptimo de n = 1");
  cerca(BARRIDO.curvas[64][iOchenta], 0.740367, 1e-5, "M1-A5: n = 64 con α = 0,80");
  assert.ok(BARRIDO.curvas[64][iOchenta] > 1.7 * BARRIDO.mejorPorN[64].rms);
  assert.ok(BARRIDO.curvas[64][iOchenta] > Math.sqrt(0.3), "peor que la inicialización");
});

test("M1-A5 bis [C]: con α = 0 ninguna curva se mueve: las diez valen √0,3, el RMS de la inicialización", () => {
  /* Primer punto del eje del barrido y ancla visual de la gráfica. No es un caso
     degenerado: V no cambia, así que el error se queda en el de la inicialización
     (M1-A2) y es el MISMO para los diez valores de n. */
  for (const n of BARRIDO.ns) {
    cerca(BARRIDO.curvas[n][0], Math.sqrt(0.3), 1e-9, `M1-A5 bis: α = 0 con n = ${n}`);
  }
});

test("M1-A11 [R]: dos barridos con el mismo lote dan resultados idénticos, y el lote se reproduce", () => {
  /* Reproducibilidad del sitio. Se usa un barrido reducido (3 n × 21 α, ~80 ms)
     en vez de repetir el completo, y además se comprueba que sus curvas COINCIDEN
     con las del barrido completo: un subconjunto de n no puede dar otro número,
     porque el lote es el mismo y `barridoNAlpha` no consume azar. */
  const ns = [1, 4, 512];
  const opciones = {
    ns, vVerdadero: paseo19.valoresVerdaderos, nEstados: 19, valorInicial: 0, episodios: 10, gamma: GAMMA,
  };
  const uno = barridoNAlpha(LOTE, opciones);
  const dos = barridoNAlpha(LOTE, opciones);
  assert.deepEqual(uno, dos);
  for (const n of ns) assert.deepEqual(uno.curvas[n], BARRIDO.curvas[n]);

  // Y el lote entero se regenera igual con la misma semilla.
  assert.deepEqual(
    loteEpisodios(paseo19, null, null, { semilla: 2026, repeticiones: 3, episodios: 10 })[0],
    LOTE[0],
  );
});

test("barrido [C]: `alProgresar` se llama una vez por par y en orden, con el total correcto", () => {
  const llamadas = [];
  barridoNAlpha(LOTE, {
    ns: [1, 2],
    alphas: [0.1, 0.2, 0.3],
    vVerdadero: paseo19.valoresVerdaderos,
    nEstados: 19,
    episodios: 10,
    alProgresar: (hechos, total) => llamadas.push([hechos, total]),
  });
  assert.deepEqual(llamadas, [[1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 6]]);
});

/* ===================================================================== *
 * EL RETORNO λ Y LA VISTA HACIA ADELANTE  ·  ecuaciones (12.2) a (12.4)  [C]
 * ===================================================================== */

test("pesosLambda [C]: pesos[n−1] = (1−λ)λ^{n−1}, cola = λ^{T−t−1} y Σ pesos + cola = 1", () => {
  /* Figura 12.2: el reparto tiene que sumar 1 o G_t^λ no sería una media
     ponderada de los G_{t:t+n} y λ = 1 no daría Monte Carlo. */
  const { pesos, cola } = pesosLambda(0.9, 12);
  assert.equal(pesos.length, 11, "hay T−t−1 pesos, uno por n = 1…11");
  cerca(pesos[0], 0.1, 1e-15, "pesosLambda: (1−λ)");
  cerca(pesos[2], 0.1 * 0.9 ** 2, 1e-15, "pesosLambda: (1−λ)λ²");
  cerca(cola, 0.9 ** 11, 1e-15, "pesosLambda: cola");
  cerca(pesos.reduce((a, b) => a + b, 0) + cola, 1, 1e-12, "pesosLambda: Σ pesos + cola");

  // Los dos extremos: λ = 0 pone todo el peso en n = 1, λ = 1 todo en la cola.
  const cero = pesosLambda(0, 12);
  assert.equal(cero.pesos[0], 1);
  assert.equal(cero.cola, 0);
  const uno = pesosLambda(1, 12);
  assert.equal(uno.cola, 1);
  assert.equal(uno.pesos.every((w) => w === 0), true);
  // Con un solo paso hasta el final no hay suma: todo es cola.
  assert.deepEqual(pesosLambda(0.5, 1), { pesos: [], cola: 1 });
});

test("(12.3) ≡ (12.2) [C]: `retornoLambda` = Σ pesosLambda·G_{t:t+n} + cola·G_t, sobre un episodio de 170 pasos", () => {
  /* LA COMPROBACIÓN CENTRAL DEL RETORNO λ: la forma (12.3) que implementa el
     motor —con la cola separada— tiene que reconstruir la suma infinita (12.2)
     término a término. Se hace con `pesosLambda` y `retornoNPasos`, es decir,
     por un camino independiente del de `retornoLambda`, y sobre TODOS los
     instantes de un episodio real con V no uniforme. */
  const ep = LOTE[0][0];
  const V = paseo19.valoresVerdaderos;
  let peor = 0;
  for (const lambda of [0, 0.1, 0.5, 0.9, 0.99, 1]) {
    for (let t = 0; t < ep.T; t++) {
      const { pesos, cola } = pesosLambda(lambda, ep.T - t);
      let suma = 0;
      pesos.forEach((w, k) => { suma += w * retornoNPasos(ep, t, k + 1, V, GAMMA); });
      suma += cola * retornoNPasos(ep, t, ep.T - t, V, GAMMA);
      peor = Math.max(peor, Math.abs(suma - retornoLambda(ep, t, lambda, V, GAMMA)));
    }
  }
  assert.equal(ep.T, 170, "el episodio elegido tiene 170 pasos");
  assert.ok(peor < 1e-12, `(12.3) ≡ (12.2): máxima discrepancia ${peor}`);
});

test("retornoLambda [C]: λ = 0 da G_{t:t+1} (TD(0)) y λ = 1 da G_t (Monte Carlo), exactos", () => {
  /* «Los dos extremos salen solos» — §12.1. Se comprueba en los 170 instantes
     de un episodio real, no en uno de juguete. */
  const ep = LOTE[0][0];
  const V = paseo19.valoresVerdaderos;
  for (let t = 0; t < ep.T; t++) {
    assert.equal(
      retornoLambda(ep, t, 0, V, GAMMA),
      retornoNPasos(ep, t, 1, V, GAMMA),
      `λ = 0 en t = ${t}`,
    );
    assert.equal(
      retornoLambda(ep, t, 1, V, GAMMA),
      retornoNPasos(ep, t, ep.T - t, V, GAMMA),
      `λ = 1 en t = ${t}`,
    );
  }
});

test("retornoLambdaFueraDeLinea [C]: con λ = 1 es Monte Carlo de cada visita con V CONGELADA", () => {
  /* (12.4) con λ = 1: el objetivo es G_t para todo t, así que el incremento de
     cada visita es α[G_t − V(S_t)] con la V de partida. Se contrasta con el
     cálculo directo, escrito aquí a mano. */
  const ep = LOTE[0][0];
  const V0 = paseo19.valoresVerdaderos;
  const conMotor = V0.slice();
  retornoLambdaFueraDeLinea(conMotor, ep, { lambda: 1, alpha: 0.1, gamma: GAMMA });

  const G = ep.recompensas.reduce((a, b) => a + b, 0); // γ = 1
  const aMano = V0.slice();
  ep.estados.forEach((s) => { aMano[s] += 0.1 * (G - V0[s]); });
  assert.ok(maxDif(conMotor, aMano) < 1e-12, "λ = 1 fuera de línea debe ser MC congelado");
});

/* ===================================================================== *
 * MÓDULO 2 · TRAZAS DE ELEGIBILIDAD  ·  M2-A1 a M2-A9   [C, todo cerrado]
 * Fuente: S&B §12.2 (ecs. 12.5-12.7) y §12.6 (ec. 12.12) · 4_Tema4_2#slide-14
 *
 * Aritmética cerrada: no interviene la semilla en ningún test de esta sección.
 * ===================================================================== */

test("cadenaTimbreLuz [C]: k timbres, luego la luz, luego la descarga con R = −1 y T = k + 1", () => {
  /* El episodio es APORTACIÓN DEL RECURSO (la diapositiva cuenta la historia y
     no da un número). El terminal DESCARGA no aparece en `estados`: de ahí sale
     V(terminal) = 0 sin escribirlo. */
  const { episodio, nEstados, etiquetas } = cadenaTimbreLuz({ timbres: 3 });
  assert.deepEqual(episodio.estados, [TIMBRE, TIMBRE, TIMBRE, LUZ]);
  assert.deepEqual(episodio.recompensas, [0, 0, 0, -1]);
  assert.equal(episodio.T, 4);
  assert.deepEqual(episodio.acciones, []);
  assert.equal(nEstados, 2);
  assert.deepEqual(etiquetas, ["timbre", "luz"]);
  assert.deepEqual([TIMBRE, LUZ, DESCARGA], [0, 1, 2]);
  assert.equal(episodio.estados.includes(DESCARGA), false, "el terminal no va en el episodio");

  const { episodio: uno } = cadenaTimbreLuz({ timbres: 1 });
  assert.deepEqual(uno.estados, [TIMBRE, LUZ]);
  assert.equal(uno.T, 2);
});

test("M2-A1 [C]: con traza acumulativa, z_k(timbre) = λ + λ² + λ³ y z_k(luz) = 1, para cinco λ", () => {
  /* Ecuación (12.5) aplicada al episodio de §6: la traza del timbre es la suma
     de sus tres visitas ya desvanecidas y la de la luz vale 1 porque acaba de
     visitarse. Se compara con la fórmula cerrada, que es un camino
     independiente del bucle del motor. */
  for (const lambda of [0, 0.25, 0.5, 0.9, 1]) {
    const { episodio } = cadenaTimbreLuz({ timbres: 3 });
    const { historialZ } = tdLambdaAtras([0, 0], episodio, {
      lambda, alpha: 0, gamma: GAMMA, registro: true,
    });
    const z = historialZ[3]; // t = k = 3, el instante de la descarga
    assert.equal(historialZ.length, 4);
    cerca(z[TIMBRE], lambda + lambda ** 2 + lambda ** 3, 1e-12, `M2-A1: z(timbre) con λ = ${lambda}`);
    assert.equal(z[LUZ], 1, `M2-A1: z(luz) con λ = ${lambda}`);
  }
  // Y la fórmula general Σ_{j=1}^{k} λ^j, para varios k.
  for (const k of [1, 2, 4, 7]) {
    const { episodio } = cadenaTimbreLuz({ timbres: k });
    const { historialZ } = tdLambdaAtras([0, 0], episodio, {
      lambda: 0.8, alpha: 0, gamma: GAMMA, registro: true,
    });
    let cerrada = 0;
    for (let j = 1; j <= k; j++) cerrada += 0.8 ** j;
    cerca(historialZ[k][TIMBRE], cerrada, 1e-12, `M2-A1: Σλ^j con k = ${k}`);
  }
});

test("M2-A2 [C]: con k = 3 y λ = 0,9 el timbre se lleva 2,439 de traza: ΔV(timbre) = −0,2439", () => {
  /* Todo el cambio ocurre en t = k: δ_t = 0 hasta el final porque V ≡ 0 y
     R₁ = R₂ = R₃ = 0, y δ_3 = −1 + V(terminal) − V(luz) = −1. */
  const { episodio } = cadenaTimbreLuz({ timbres: 3 });
  const V = [0, 0];
  const { actualizaciones } = tdLambdaAtras(V, episodio, {
    lambda: 0.9, alpha: 0.1, gamma: GAMMA, registro: true,
  });
  cerca(V[TIMBRE], -0.2439, 1e-12, "M2-A2: ΔV(timbre)");
  cerca(V[LUZ], -0.1, 1e-12, "M2-A2: ΔV(luz)");
  assert.deepEqual(actualizaciones.map((u) => u.delta), [0, 0, 0, -1]);
  // Gana el timbre: 2,439 veces más culpa que la luz.
  cerca(Math.abs(V[TIMBRE] / V[LUZ]), 2.439, 1e-12, "M2-A2: cociente de culpas");
});

test("M2-A3 [C]: con λ = 0,5 la traza del timbre vale 0,875 < 1 y gana la LUZ", () => {
  /* Que el timbre haya sonado tres veces no basta si λ es pequeño: es la
     respuesta a la pregunta 1 del quiz. */
  const { episodio } = cadenaTimbreLuz({ timbres: 3 });
  const V = [0, 0];
  const { historialZ } = tdLambdaAtras(V, episodio, {
    lambda: 0.5, alpha: 0.1, gamma: GAMMA, registro: true,
  });
  cerca(historialZ[3][TIMBRE], 0.875, 1e-12, "M2-A3: z(timbre)");
  assert.ok(historialZ[3][TIMBRE] < historialZ[3][LUZ], "M2-A3: debe ganar la luz");
  cerca(V[TIMBRE], -0.0875, 1e-12, "M2-A3: ΔV(timbre)");
  cerca(V[LUZ], -0.1, 1e-12, "M2-A3: ΔV(luz)");
});

test("M2-A4 [C]: los λ de empate son null, 0,618034, 0,543689, 0,518790 y 0,508660 para k = 1…5", () => {
  /* LAS RAÍCES SE COMPRUEBAN CONTRA LA ECUACIÓN, no solo contra la constante:
     λ* es la raíz en (0,1) de Σ_{j=1}^{k} λ^j = 1, así que se sustituye y se
     exige que la suma valga 1. Así el test detecta un cambio de DEFINICIÓN de
     la traza (por ejemplo, empezar la suma en j = 0), no solo un cambio de
     número. La de k = 2 es la razón áurea (√5 − 1)/2. */
  const esperados = { 1: null, 2: 0.6180340, 3: 0.5436890, 4: 0.5187900, 5: 0.5086603 };
  for (const [k, objetivo] of Object.entries(esperados)) {
    const lambda = cruceTrazas({ timbres: Number(k), gamma: GAMMA });
    if (objetivo === null) {
      /* k = 1: z_k(timbre) = λ ≤ 1 = z_k(luz), con igualdad solo en λ = 1, así
         que no hay cruce DENTRO de [0,1) y la función devuelve `null`.
         La tabla de §8 del guion escribe «1,000000» en esta casilla; el valor
         correcto —y el que pide §C4— es `null`: un 1 se leería como «empatan». */
      assert.equal(lambda, null, "M2-A4: k = 1 no tiene empate para λ < 1");
      continue;
    }
    cerca(lambda, objetivo, 1e-6, `M2-A4: λ* con k = ${k} (cifra del guion)`);
    // Contra la ecuación: Σ_{j=1}^{k} (λ*)^j = 1.
    let suma = 0;
    for (let j = 1; j <= Number(k); j++) suma += lambda ** j;
    cerca(suma, 1, 1e-12, `M2-A4: Σλ^j con la raíz de k = ${k}`);
  }
  // k = 2: la razón áurea, a precisión de doble.
  cerca(cruceTrazas({ timbres: 2 }), (Math.sqrt(5) - 1) / 2, 1e-12, "M2-A4: razón áurea");
  // La sucesión de raíces decrece hacia 1/2: más timbres, antes empatan.
  const raices = [2, 3, 4, 5].map((k) => cruceTrazas({ timbres: k }));
  for (let i = 1; i < raices.length; i++) assert.ok(raices[i] < raices[i - 1]);
  assert.ok(raices.at(-1) > 0.5);
});

test("M2-A4 bis [C]: a la izquierda del empate gana la luz y a la derecha gana el timbre", () => {
  /* Comprueba que λ* es de verdad un cambio de signo del motor y no un número
     que la bisección ha devuelto por su cuenta. */
  const lambda = cruceTrazas({ timbres: 3 });
  const z = (l) => {
    const { episodio } = cadenaTimbreLuz({ timbres: 3 });
    const { historialZ } = tdLambdaAtras([0, 0], episodio, {
      lambda: l, alpha: 0, gamma: GAMMA, registro: true,
    });
    return historialZ[3];
  };
  const antes = z(lambda - 0.01);
  const despues = z(lambda + 0.01);
  assert.ok(antes[TIMBRE] < antes[LUZ], "por debajo del empate gana la luz");
  assert.ok(despues[TIMBRE] > despues[LUZ], "por encima del empate gana el timbre");
});

test("M2-A5 [C]: λ = 0 es EXACTAMENTE TD(0) — diferencia 0, en el juguete y en el paseo", () => {
  /* S&B §12.2: «si λ = 0… se reduce a la regla TD simple (6.2) en el caso
     tabular». Con λ = 0 la traza solo vale 1 en el estado visitado, así que
     αδ_t z_t(s) solo toca ese estado. Se contrasta contra `tdCero` de
     `sinmodelo.js`, que es otra implementación. */
  const { episodio } = cadenaTimbreLuz({ timbres: 3 });
  const A = [0, 0];
  const B = [0, 0];
  tdLambdaAtras(A, episodio, { lambda: 0, alpha: 0.1, gamma: GAMMA });
  tdCero(B, episodio, { alpha: 0.1, gamma: GAMMA });
  assert.deepEqual(A, B);
  assert.deepEqual(A, [0, -0.1], "solo cambia la luz, en −0,1");

  // Y sobre 10 repeticiones de episodios reales del paseo, que sí revisitan.
  const dif = difPorRepeticion(
    (V, ep) => tdLambdaAtras(V, ep, { lambda: 0, alpha: 0.1, gamma: GAMMA }),
    (V, ep) => tdCero(V, ep, { alpha: 0.1, gamma: GAMMA }),
  );
  assert.equal(dif, 0, `M2-A5: máx|V_TD(0) − V_tdCero| = ${dif}, debe ser 0 exacto`);
});

test("M2-A6 [C]: λ = 1 con γ = 1 y k = 3 da z = 3 y ΔV(timbre) = −0,300 (a 1e-15, no bit a bit)", () => {
  /* TD(1): la traza no decae y el reparto es proporcional al número de visitas,
     que es Monte Carlo de cada visita con los valores congelados.
     PRECISIÓN SOBRE EL GUION: la tabla dice «−0,300 exacto»; en coma flotante
     sale −0,30000000000000004, porque 3 × 0,1 no es representable en binario.
     La aritmética es correcta; se usa tolerancia 1e-15 en vez de afirmar una
     igualdad bit a bit que ninguna implementación cumpliría. */
  const { episodio } = cadenaTimbreLuz({ timbres: 3 });
  const V = [0, 0];
  const { historialZ } = tdLambdaAtras(V, episodio, {
    lambda: 1, alpha: 0.1, gamma: GAMMA, registro: true,
  });
  assert.equal(historialZ[3][TIMBRE], 3, "la traza sí es 3 exacto");
  cerca(V[TIMBRE], -0.3, 1e-15, "M2-A6: ΔV(timbre)");
  cerca(V[LUZ], -0.1, 1e-15, "M2-A6: ΔV(luz)");
  assert.notEqual(V[TIMBRE], -0.3, "documentado: no es igualdad bit a bit");
});

test("M2-A7 [C]: Monte Carlo de cada visita SOBRE LA MARCHA da −0,271, distinto del −0,300 de TD(1)", () => {
  /* ES LA COMPROBACIÓN NUMÉRICA DE LA SALVEDAD de la equivalencia (ejercicio
     12.4), y es contenido de la página, no un residuo: −0,100, −0,090, −0,081
     suman −0,271 porque la segunda y la tercera visita ya usan un V modificado.
     La diapositiva dice «son fórmulas equivalentes»; lo son con V congelada. */
  const { episodio } = cadenaTimbreLuz({ timbres: 3 });
  const V = [0, 0];
  mcConstante(V, episodio, { alpha: 0.1, gamma: GAMMA, primeraVisita: false });
  cerca(V[TIMBRE], -0.271, 1e-12, "M2-A7: MC sobre la marcha");
  cerca(V[LUZ], -0.1, 1e-12, "M2-A7: ΔV(luz)");
  assert.ok(Math.abs(V[TIMBRE] - (-0.3)) > 0.028, "M2-A7: tiene que ser distinto de −0,300");

  // Los tres incrementos, uno a uno: −0,1 · (1 − 0,1)^j.
  const pasos = [-0.1, -0.09, -0.081];
  cerca(pasos.reduce((a, b) => a + b, 0), -0.271, 1e-12, "M2-A7: la suma de los tres");
});

test("M2-A9 [C]: con traza de reemplazo z_k(timbre) = λ para TODO k, y `cruceTrazas` devuelve null", () => {
  /* Ecuación (12.12): la visita FIJA la traza en 1 en vez de sumar, así que solo
     cuenta cuánto hace de la última visita —y aquí siempre es un paso—. La
     frecuencia desaparece y la luz gana siempre. Es la pregunta 2 del quiz. */
  for (const k of [1, 2, 3, 4, 5, 9]) {
    for (const lambda of [0, 0.3, 0.7, 0.9, 1]) {
      const { episodio } = cadenaTimbreLuz({ timbres: k });
      const { historialZ } = tdLambdaAtras([0, 0], episodio, {
        lambda, alpha: 0, gamma: GAMMA, traza: "reemplazo", registro: true,
      });
      const z = historialZ[k];
      cerca(z[TIMBRE], lambda, 1e-15, `M2-A9: z(timbre) con k = ${k}, λ = ${lambda}`);
      assert.equal(z[LUZ], 1, `M2-A9: z(luz) con k = ${k}, λ = ${lambda}`);
      assert.ok(z[TIMBRE] <= z[LUZ], "la del timbre nunca supera a la de la luz");
    }
    assert.equal(cruceTrazas({ timbres: k, traza: "reemplazo" }), null, `M2-A9: cruce con k = ${k}`);
  }
});

test("M2-A9 bis [C]: subir k de 3 a 5 no mueve el crédito con reemplazo y sí lo mueve con acumulativa", () => {
  /* El contraste que sostiene el conmutador del módulo 2: la elección de traza
     no es un detalle de implementación, cambia qué heurística se implementa. */
  const conTraza = (k, traza) => {
    const { episodio } = cadenaTimbreLuz({ timbres: k });
    const V = [0, 0];
    tdLambdaAtras(V, episodio, { lambda: 0.8, alpha: 0.1, gamma: GAMMA, traza });
    return V[TIMBRE];
  };
  cerca(conTraza(3, "reemplazo"), conTraza(5, "reemplazo"), 1e-15, "M2-A9 bis: reemplazo");
  cerca(conTraza(3, "reemplazo"), -0.08, 1e-15, "M2-A9 bis: −α·λ = −0,08");
  assert.ok(
    conTraza(5, "acumulativa") < conTraza(3, "acumulativa") - 0.05,
    "M2-A9 bis: con la acumulativa, cinco timbres se llevan bastante más culpa",
  );
});

test("creditoPorLambda [C]: la curva de la luz es plana en 0,1 y la del timbre crece de 0 a α·k", () => {
  /* Es la gráfica del módulo. Se calcula EJECUTANDO el motor, así que aquí se
     contrasta contra la fórmula cerrada, que es el camino independiente. */
  const { lambdas, timbre, luz } = creditoPorLambda({
    timbres: 3, traza: "acumulativa", alpha: 0.1, gamma: GAMMA, puntos: 101,
  });
  assert.equal(lambdas.length, 101);
  assert.equal(timbre[0], 0, "λ = 0: el timbre no se lleva nada");
  cerca(timbre[100], 0.3, 1e-15, "λ = 1: α·k = 0,3");
  for (let i = 0; i < 101; i++) {
    const l = lambdas[i];
    cerca(timbre[i], 0.1 * (l + l ** 2 + l ** 3), 1e-12, `creditoPorLambda: timbre en λ = ${l}`);
    cerca(luz[i], 0.1, 1e-15, `creditoPorLambda: luz en λ = ${l}`);
  }
  // Con reemplazo, la del timbre es la recta 0,1·λ.
  const reemplazo = creditoPorLambda({ timbres: 5, traza: "reemplazo", alpha: 0.1, puntos: 11 });
  reemplazo.lambdas.forEach((l, i) => cerca(reemplazo.timbre[i], 0.1 * l, 1e-15, `reemplazo λ = ${l}`));
});

/* ===================================================================== *
 * LAS DOS VISTAS DE TD(λ)  ·  M2-A8 y la salvedad del ejercicio 12.4  [C]
 *
 * LAS DOS MITADES SON EL TEST. La diapositiva dice que adelante y atrás «son
 * fórmulas equivalentes»; la afirmación del libro es más débil, y este par de
 * tests mide exactamente dónde deja de valer.
 * ===================================================================== */

test("M2-A8 [C]: con V congelada las dos vistas coinciden a <1e-15, para seis valores de λ", () => {
  /* Ejercicio 12.4. En el episodio del timbre y la luz V está congelada de
     hecho: δ_t = 0 hasta el final, así que las actualizaciones intermedias no
     mueven nada y la suma de la vista hacia atrás es la de la vista hacia
     adelante, término a término. */
  for (const lambda of [0, 0.25, 0.5, 0.75, 0.9, 1]) {
    const { episodio } = cadenaTimbreLuz({ timbres: 3 });
    const adelante = [0, 0];
    const atras = [0, 0];
    retornoLambdaFueraDeLinea(adelante, episodio, { lambda, alpha: 0.1, gamma: GAMMA });
    tdLambdaAtras(atras, episodio, { lambda, alpha: 0.1, gamma: GAMMA });
    const dif = maxDif(adelante, atras);
    assert.ok(dif < 1e-15, `M2-A8: con λ = ${lambda} las dos vistas difieren en ${dif}`);
    // Y el valor cerrado del guion: G_t^λ = −λ^{T−t−1} con V ≡ 0.
    cerca(adelante[TIMBRE], -0.1 * (lambda + lambda ** 2 + lambda ** 3), 1e-15, `M2-A8: λ = ${lambda}`);
  }
});

test("M2-A8 bis [C]: también coinciden en un episodio REAL sin revisitas, con V no uniforme", () => {
  /* El episodio [68][7] del lote recorre 9,8,…,0 sin repetir estado, así que
     ninguna actualización en línea llega a tiempo de contaminar un δ posterior:
     V está congelada DE FACTO y la equivalencia vuelve a ser exacta (5,6·10⁻¹⁷)
     aunque V no sea uniforme y los δ_t no sean cero. Aísla la causa: lo que
     rompe la equivalencia son las REVISITAS, no el valor de V. */
  const ep = LOTE[68][7];
  assert.equal(new Set(ep.estados).size, ep.T, "el episodio no revisita ningún estado");
  for (const lambda of [0, 0.25, 0.5, 0.75, 0.9, 1]) {
    const adelante = paseo19.valoresVerdaderos.slice();
    const atras = paseo19.valoresVerdaderos.slice();
    retornoLambdaFueraDeLinea(adelante, ep, { lambda, alpha: 0.1, gamma: GAMMA });
    tdLambdaAtras(atras, ep, { lambda, alpha: 0.1, gamma: GAMMA });
    const dif = maxDif(adelante, atras);
    assert.ok(dif < 1e-15, `M2-A8 bis: con λ = ${lambda} difieren en ${dif}`);
  }
});

test("M2-A8 ter [C]: en episodios reales CON revisitas las dos vistas se separan hasta 2,1·10⁻¹", () => {
  /* LA OTRA MITAD, y es contenido de la página (`t4b.b9.p5`): la equivalencia
     del libro es más débil de lo que suele contarse. Configuración cerrada:
     los 10 episodios de la repetición 0, V₀ = v_π (no uniforme), α = 0,1,
     λ ∈ {0; 0,25; 0,5; 0,75; 0,9}. La peor separación es 0,211773, en λ = 0,9
     sobre el episodio 6 (T = 300), y crece con λ porque la traza arrastra más
     lejos las actualizaciones ya contaminadas.
     No se relaja el umbral: se afirma que las dos vistas SÍ se separan, con la
     cifra. */
  const LAMBDAS = [0, 0.25, 0.5, 0.75, 0.9];
  const peorPorLambda = {};
  let peor = 0;
  for (const lambda of LAMBDAS) {
    let m = 0;
    for (const ep of LOTE[0]) {
      const adelante = paseo19.valoresVerdaderos.slice();
      const atras = paseo19.valoresVerdaderos.slice();
      retornoLambdaFueraDeLinea(adelante, ep, { lambda, alpha: 0.1, gamma: GAMMA });
      tdLambdaAtras(atras, ep, { lambda, alpha: 0.1, gamma: GAMMA });
      m = Math.max(m, maxDif(adelante, atras));
    }
    peorPorLambda[lambda] = m;
    peor = Math.max(peor, m);
  }
  cerca(peor, 0.211773, 1e-5, "M2-A8 ter: peor separación (valor del motor)");
  assert.ok(peor > 0.1, "las dos vistas se separan en el orden de 10⁻¹, no de 10⁻¹²");
  /* Y la separación crece con λ a partir de 0,25 (0,0443 → 0,0527 → 0,0848 →
     0,2118): más traza, más lejos llegan las actualizaciones ya contaminadas.
     Entre λ = 0 y λ = 0,25 baja un poco, así que la monotonía se afirma desde
     0,25, que es donde de verdad la hay. */
  const crecientes = [0.25, 0.5, 0.75, 0.9];
  for (let i = 1; i < crecientes.length; i++) {
    assert.ok(
      peorPorLambda[crecientes[i]] > peorPorLambda[crecientes[i - 1]],
      `M2-A8 ter: la separación no crece al pasar de λ = ${crecientes[i - 1]} a ${crecientes[i]}`,
    );
  }
  cerca(peorPorLambda[0.25], 0.044315, 1e-5, "M2-A8 ter: λ = 0,25");
  cerca(peorPorLambda[0.9], 0.211773, 1e-5, "M2-A8 ter: λ = 0,90");
});

test("M2-A8 quater [C]: la separación entre las dos vistas es O(α²) y se desvanece al bajar el paso", () => {
  /* Cierra el argumento del ejercicio 12.4: la equivalencia es exacta «con α
     óptimo o menor», y aquí se ve el mecanismo — la discrepancia la crean las
     actualizaciones en línea, que son de tamaño α, así que su realimentación
     es de tamaño α². Episodio [1][1] del lote (T = 300), λ = 0,9:
         α = 0,1   → 2,747·10⁻¹
         α = 0,01  → 5,975·10⁻³   (÷10 en α ⇒ ÷46 en la separación)
         α = 0,001 → 6,585·10⁻⁵   (÷10 ⇒ ÷91)
         α = 10⁻⁶  → 6,658·10⁻¹¹
     Los cocientes tienden a 100, que es el ÷α² esperado. */
  const ep = LOTE[1][1];
  /* Cada evaluación cuesta O(T²) por la vista hacia adelante, así que se
     calculan las cuatro una sola vez (el episodio tiene 300 pasos). */
  const dif = {};
  for (const alpha of [0.1, 0.01, 0.001, 1e-6]) {
    const adelante = paseo19.valoresVerdaderos.slice();
    const atras = paseo19.valoresVerdaderos.slice();
    retornoLambdaFueraDeLinea(adelante, ep, { lambda: 0.9, alpha, gamma: GAMMA });
    tdLambdaAtras(atras, ep, { lambda: 0.9, alpha, gamma: GAMMA });
    dif[alpha] = maxDif(adelante, atras);
  }
  cerca(dif[0.1], 0.2746662, 1e-6, "α = 0,1");
  cerca(dif[0.01], 0.005974625, 1e-8, "α = 0,01");
  cerca(dif[0.001], 6.585018e-5, 1e-10, "α = 0,001");
  assert.ok(dif[1e-6] < 1e-9, `con α = 10⁻⁶ la separación es ${dif[1e-6]}`);
  // Cada división de α por 10 divide la separación por bastante más de 10.
  assert.ok(dif[0.01] / dif[0.001] > 50, "la separación no baja como α, baja más deprisa");
  assert.ok(dif[0.001] / dif[1e-6] > 1e5, "y con α → 0 tiende a la igualdad exacta");
});

test("traza acumulativa [C]: con λ = 1 en línea DIVERGE (7,4·10⁶) mientras la vista adelante se queda en 4,15", () => {
  /* NO ES UN BUG DEL MOTOR: es la inestabilidad conocida de la traza
     acumulativa con λ = 1 y α no pequeño, y es la razón de ser de las trazas de
     reemplazo (§12.6) y dutch (§12.5). Sobre el episodio [1][1] del lote
     (T = 300) con α = 0,1, `tdLambdaAtras` explota y `retornoLambdaFueraDeLinea`
     —que es fuera de línea por definición— no. Se fija como hecho para que un
     cambio del motor que lo altere se note. */
  const ep = LOTE[1][1];
  assert.equal(ep.T, 300);
  const adelante = paseo19.valoresVerdaderos.slice();
  const atras = paseo19.valoresVerdaderos.slice();
  retornoLambdaFueraDeLinea(adelante, ep, { lambda: 1, alpha: 0.1, gamma: GAMMA });
  tdLambdaAtras(atras, ep, { lambda: 1, alpha: 0.1, gamma: GAMMA });
  assert.ok(Math.max(...adelante.map(Math.abs)) < 10, "la vista hacia adelante se queda acotada");
  assert.ok(Math.max(...atras.map(Math.abs)) > 1e6, "la vista hacia atrás con λ = 1 diverge");
  // Con la traza de reemplazo, el mismo episodio no explota.
  const conReemplazo = paseo19.valoresVerdaderos.slice();
  tdLambdaAtras(conReemplazo, ep, { lambda: 1, alpha: 0.1, gamma: GAMMA, traza: "reemplazo" });
  assert.ok(Math.max(...conReemplazo.map(Math.abs)) < 10, "la de reemplazo se mantiene acotada");
});

/* ===================================================================== *
 * CONTRATO DEL MOTOR  ·  M1-A11 y M2-A10
 * ===================================================================== */

const FUENTE = readFileSync(join(RAIZ, "assets", "npasos.js"), "utf8");

test("contrato [C]: `npasos.js` no usa el azar global del lenguaje ni consume azar en absoluto", () => {
  /* El módulo 1 recibe el lote YA GENERADO y el módulo 2 es determinista y
     cerrado. La cadena se compone para que este test no se autodelate. */
  assert.equal(FUENTE.includes(["Math", "random"].join(".")), false);
  // M2-A10: un rng que revienta si alguien lo toca, pasado donde podría colarse.
  const rngInerte = new Proxy({}, {
    get() {
      return () => {
        throw new Error("el motor ha consumido azar");
      };
    },
  });
  const { episodio } = cadenaTimbreLuz({ timbres: 3 });
  tdLambdaAtras([0, 0], episodio, { lambda: 0.5, alpha: 0.1, rng: rngInerte });
  creditoPorLambda({ timbres: 3, puntos: 11 });
  cruceTrazas({ timbres: 3 });
  nStepTD(new Array(19).fill(0), REFERENCIA, { n: 4, alpha: 0.1 });
  barridoNAlpha(LOTE.slice(0, 2), {
    ns: [1], alphas: [0.1], vVerdadero: paseo19.valoresVerdaderos, nEstados: 19, episodios: 10,
  });
});

test("contrato [C]: `npasos.js` no toca el DOM — es matemática pura y testeable", () => {
  for (const prohibida of ["document", "window", "SVG", "createElement"]) {
    assert.equal(
      FUENTE.includes(prohibida),
      false,
      `contrato: el motor menciona «${prohibida}»; debe seguir siendo puro`,
    );
  }
});

test("M2-A10 [C]: el módulo 2 es determinista — dos ejecuciones dan exactamente lo mismo", () => {
  const dosVeces = (f) => assert.deepEqual(f(), f());
  dosVeces(() => creditoPorLambda({ timbres: 3, puntos: 101 }));
  dosVeces(() => creditoPorLambda({ timbres: 5, traza: "reemplazo", puntos: 51 }));
  dosVeces(() => [1, 2, 3, 4, 5].map((k) => cruceTrazas({ timbres: k })));
  dosVeces(() => {
    const { episodio } = cadenaTimbreLuz({ timbres: 4 });
    const V = [0, 0];
    const { historialZ } = tdLambdaAtras(V, episodio, {
      lambda: 0.7, alpha: 0.1, registro: true,
    });
    return { V, historialZ };
  });
});

test("contrato [C]: `nStepTD` y `nStepSarsa` no dejan huella en el episodio ni en `historialZ`", () => {
  /* `historialZ[t]` tiene que ser una COPIA del vector z, no una referencia
     viva: si no, el diente de sierra del módulo 2 saldría plano (todas las
     entradas iguales a la última). */
  const { episodio } = cadenaTimbreLuz({ timbres: 3 });
  const copia = JSON.parse(JSON.stringify(episodio));
  const { historialZ } = tdLambdaAtras([0, 0], episodio, {
    lambda: 0.5, alpha: 0.1, registro: true,
  });
  assert.deepEqual(episodio, copia, "el episodio no se modifica");
  assert.equal(new Set(historialZ.map((z) => z.join(","))).size, 4, "los cuatro z_t son distintos");
  cercaVector(historialZ[0], [1, 0], 1e-15, "z_0");
  cercaVector(historialZ[1], [1.5, 0], 1e-15, "z_1");
  cercaVector(historialZ[2], [1.75, 0], 1e-15, "z_2");
  cercaVector(historialZ[3], [0.875, 1], 1e-15, "z_3");
});

test("contrato [C]: sin `registro` no se construye ninguna traza, y con él vienen todos los campos", () => {
  const V = new Array(19).fill(0);
  const sin = nStepTD(V, REFERENCIA, { n: 2, alpha: 0.1 });
  assert.equal(sin.traza, null);
  const { traza } = nStepTD(new Array(19).fill(0), REFERENCIA, { n: 2, alpha: 0.1, registro: true });
  assert.deepEqual(Object.keys(traza[0]).sort(), ["G", "antes", "despues", "estado", "t", "tau"]);

  const { historialZ, actualizaciones } = tdLambdaAtras([0, 0], cadenaTimbreLuz().episodio, {
    lambda: 0.5, alpha: 0.1,
  });
  assert.equal(historialZ, null);
  assert.equal(actualizaciones, null);
});

test("contrato [C]: las entradas inválidas se rechazan con un mensaje claro, antes de calcular", () => {
  const { episodio } = cadenaTimbreLuz({ timbres: 3 });
  assert.throws(() => retornoNPasos(episodio, 0, 0, [0, 0]), /n debe ser un entero ≥ 1/);
  assert.throws(() => retornoNPasos(episodio, 0, 2.5, [0, 0]), /n debe ser un entero ≥ 1/);
  assert.throws(() => retornoNPasos(episodio, 9, 1, [0, 0]), /tau debe estar en \[0, 4\)/);
  assert.throws(() => retornoNPasos(episodio, -1, 1, [0, 0]), /tau debe estar en \[0, 4\)/);
  assert.throws(() => nStepTD([0, 0], episodio, { n: 0, alpha: 0.1 }), /n debe ser un entero ≥ 1/);
  assert.throws(() => nStepTD([0, 0], episodio, { n: 1, alpha: NaN }), /alpha debe ser un número finito/);
  assert.throws(
    () => nStepSarsa([[0], [0]], episodio, { n: 1, alpha: 0.1 }),
    /no trae una acción por paso/,
  );
  assert.throws(() => retornoLambda(episodio, 0, 1.5, [0, 0]), /lambda debe estar en \[0, 1\]/);
  assert.throws(() => retornoLambda(episodio, 0, -0.1, [0, 0]), /lambda debe estar en \[0, 1\]/);
  assert.throws(() => retornoLambda(episodio, 4, 0.5, [0, 0]), /t debe estar en \[0, 4\)/);
  assert.throws(() => pesosLambda(0.5, 0), /pasosHastaFinal debe ser un entero ≥ 1/);
  assert.throws(
    () => tdLambdaAtras([0, 0], episodio, { lambda: 0.5, alpha: 0.1, traza: "dutch" }),
    /traza debe ser "acumulativa" o "reemplazo"/,
  );
  assert.throws(
    () => retornoLambdaFueraDeLinea([0, 0], episodio, { lambda: 2, alpha: 0.1 }),
    /lambda debe estar en \[0, 1\]/,
  );
  assert.throws(() => cadenaTimbreLuz({ timbres: 0 }), /timbres debe ser un entero ≥ 1/);
  assert.throws(() => cadenaTimbreLuz({ timbres: 2.5 }), /timbres debe ser un entero ≥ 1/);
  assert.throws(() => creditoPorLambda({ puntos: 1 }), /puntos debe ser un entero ≥ 2/);
  assert.throws(() => cruceTrazas({ traza: "dutch" }), /traza debe ser "acumulativa" o "reemplazo"/);
  assert.throws(() => barridoNAlpha([], { vVerdadero: [0] }), /el lote está vacío/);
  assert.throws(() => barridoNAlpha(LOTE, { vVerdadero: [] }), /hace falta vVerdadero/);
  assert.throws(
    () => barridoNAlpha([[LOTE[0][0]]], { vVerdadero: paseo19.valoresVerdaderos, episodios: 10 }),
    /cada repetición necesita al menos 10 episodios/,
  );
});

test("contrato [C]: `muestrearEpisodio` sigue dando el formato que consume `npasos.js`", () => {
  /* El contrato con `sinmodelo.js` (ficha `contrato-motores.md` §2.2): el
     episodio NO incluye el estado terminal, y de ahí salen V(S_T) = 0 y
     Q(S_T,·) = 0 sin escribirlos en ninguna parte del motor de n pasos. */
  const rngDerecha = { uniforme: () => 0.1 }; // < 0,5 ⇒ derecha
  const ep = muestrearEpisodio(paseo19, null, null, rngDerecha);
  assert.equal(ep.estados.length, ep.T);
  assert.equal(ep.recompensas.length, ep.T);
  assert.equal(ep.estados.includes(19), false, "el terminal izquierdo no va dentro");
  assert.equal(ep.estados.includes(20), false, "el terminal derecho no va dentro");
  assert.deepEqual(ep.estados, REFERENCIA.estados);
});
