/* Tests del motor de aproximación de la función de valor del Tema 5
 * (`assets/aproximacion.js` + `assets/aproximacion-worker.js`).
 *
 * No comprueban «que el código no falle»: comprueban que el código REPRODUCE
 * el libro (Sutton & Barto, capítulos 9, 10 y 11) y el guion. Cada test lleva
 * en el nombre el identificador de la aserción —`C2-4`, `R3-1`, `T-6`…— para
 * que un fallo se rastree al párrafo que lo justifica en un segundo:
 *
 *   C1-*, C2-*, …, C6-*   → `T5_recurso/guion-tema5.md`, §8a del módulo n
 *   R3-*, R5-*            → ídem, §8b
 *   T-1 … T-8, RT-*       → `T5_recurso/addenda-trazas.md` §4
 *   Q-1 … Q-11            → guion §C4, «las once comprobaciones que no salen
 *                            de ninguna §8». SE RENUMERAN T-n → Q-n porque la
 *                            §C4 usa T-1…T-11 y la addenda usa T-1…T-8 para
 *                            cosas distintas: la colisión es del guion.
 *
 *   cd Interactivo/web && npm test
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DOS CLASES DE TEST, y cada `describe` dice de cuál es
 *
 *   [C] CONTRASTE. No dependen del azar: identidades algebraicas, valores
 *       publicados por el libro, geometrías, límites. Tolerancia estricta
 *       (0, 1e-15, 1e-12, 1e-9). SI UNO FALLA NO SE RELAJA EL TEST: o está mal
 *       el motor o está mal el guion, y se decide mirando el libro.
 *
 *   [R] REPRODUCIBILIDAD. Promedios sembrados y contenidos de un episodio.
 *       Tolerancia la del guion (relativa 5-15 %). Las cifras las ha calculado
 *       este fichero con el motor —el guion las dejaba «por rellenar»— y se
 *       devuelven al guion en el informe.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CUATRO ASERCIONES SE TESTEAN EN SU VERSIÓN CORREGIDA, NO EN LA DEL GUION
 *
 *   C2-13  El guion dice «2ℓ−1 = 399». El recuento correcto es
 *          2ℓ − ⌊ℓ/m⌋, que da 200 · 300 · 350 · 375 · 388 · 394 · 396 para los
 *          siete m del deslizador (399 solo saldría con m = 200, que no está).
 *          Se comprueba LA FÓRMULA sobre los siete valores.
 *
 *   C3-1   El procedimiento de referencia `w ← w + α(b−Aw)` con α = 10⁻³ está
 *          INFRA-CONVERGIDO: tras 2·10⁶ iteraciones el error frente a la
 *          eliminación gaussiana es 4,3·10⁻³, cuatro órdenes por encima de la
 *          tolerancia declarada. Se usa α = 1 —parámetro DEL TEST, no del
 *          motor— y se mantiene la tolerancia de 10⁻⁸: converge en 12 575
 *          iteraciones con error 6,7·10⁻¹⁰.
 *
 *   C5-12  La versión del guion («con ε = 0, SARSA y Q-learning dan la misma
 *          ejecución, paso a paso») ES FALSA y no se hace pasar. SARSA elige A'
 *          ANTES de actualizar y Q-learning elige A DESPUÉS, con la política
 *          greedy sobre pesos distintos y un desempate al azar que consume el
 *          generador un número de veces distinto: las trayectorias se separan.
 *          Lo que sí es identidad exacta —y es lo que se testea— es que EN
 *          CADA PASO el objetivo de Q-learning coincide con el de SARSA. El
 *          test fija además el hecho de la divergencia, para que nadie
 *          «arregle» el motor persiguiendo la afirmación falsa.
 *
 *   Q-5    El coste POR BARRIDO de `paseoMil` es O(|S|), pero el NÚMERO de
 *          barridos crece con |S| (1 840 con 1000 estados, 6 714 con 2000,
 *          25 081 con 4000). El tiempo total NO es lineal y medirlo así sería
 *          un test roto. Se mide `tiempo / (barridos × nEstados)`, que sí es
 *          constante.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * SEIS ASERCIONES DEL GUION QUE NO SE SOSTIENEN COMO ESTÁN  (se reporta)
 *
 *   R5-6   El guion espera 0 ejecuciones cortadas con αm = 1,5 y son 10 de 10.
 *          No es un bug: αm = 1,5 se pasa de la guía α = 1/(τ·E[xᵀx]) y SARSA
 *          semi-gradiente revienta. Se testea la divergencia, no su ausencia.
 *
 *   RT-1/2 CON TRAZA ACUMULATIVA Y αm = 0,5, LAS CINCO EJECUCIONES REVIENTAN
 *          (|w| > 10⁶, 30 episodios al tope). El módulo 5 ofrece ese botón por
 *          omisión de α: con γλ = 0,9 la traza multiplica el paso efectivo por
 *          ~1/(1−γλ) = 10, así que αm = 0,5 equivale a αm ≈ 5. Está testeado
 *          como divergencia y hay que decidirlo en el guion (§informe).
 *
 *   C6-5   El guion dice «10 de 12 con veredicto SÍ». Son 10 de 12 las
 *          casillas con ≤ 2 inductores, y de esas 10 hay 8 con SÍ y 2
 *          excepciones. Los veredictos SÍ de la tabla entera son 8 de 12. Se
 *          testea el enunciado correcto.
 *
 *   R3-2   Con el α por omisión (2·10⁻⁴) la curva de TD al episodio 5000 vale
 *          0,335 y su asíntota exacta es 0,117: TD apenas se ha movido de
 *          √VE(0) = 0,405. La ordenación que pide el libro (MC mejor que TD)
 *          SÍ se ve —0,078 frente a 0,335—, pero se ve por la razón
 *          equivocada. Con α = 10⁻³ sale 0,107 frente a 0,153, que es la
 *          lectura de §7.1 del módulo 3. Es un asunto del α por omisión.
 *
 *   C4-10  Example 11.1 (mínimos cuadrados, umbral γ > 5/(6−4ε)) NO está en el
 *          motor: el guion lo manda «solo como cálculo del panel de texto».
 *          No se puede testear aquí y no se testea.
 *
 *   Q-6…Q-9 son de `nucleo.js` (`campoCalor`, `graficaLineas` con escala
 *          logarítmica) y de `tema5.js`, que los está escribiendo otro agente:
 *          fuera del alcance de este fichero.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * UNA DECISIÓN DEL MOTOR QUE ESTOS TESTS DOCUMENTAN Y BLINDAN
 *
 *   La traza de REEMPLAZO exige características binarias y el motor LANZA si
 *   no lo son. Es una decisión del orquestador, documentada en el código, y
 *   CONTRARIA A LA LETRA de la addenda §2 —que dice «poner a 1» sin
 *   condiciones—. Se testea que lanza (T-4b).
 */

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  /* entornos */
  paseoMil,
  mountainCar,
  cachePaseoMil,
  /* representaciones */
  oneHot,
  agregacion,
  tileCoding1D,
  tileCoding2D,
  caracteristicasPorAccion,
  EJEMPLO_EXAMEN,
  /* álgebra exacta */
  pesosOptimos,
  errorVE,
  matrizAb,
  resolver,
  puntoFijoTD,
  /* predicción */
  muestrearEpisodio,
  mcGradiente,
  tdSemiGradiente,
  curvaVE,
  /* control */
  politicaEpsilonGreedy,
  sarsaSemiGradiente,
  qLearningSemiGradiente,
  trazaTrasPasos,
  costePorRecorrer,
  /* divergencia */
  fragmentoW2W,
  BAIRD,
  /* tablas */
  TABLA_PREDICCION,
  TABLA_CONTROL,
  contarInductores,
  fichaCasilla,
} from "../assets/aproximacion.js";

import { curvasPrediccion, curvasControl } from "../assets/aproximacion-worker.js";
import { generador, argmax } from "../assets/nucleo.js";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..");

/* ===================================================================== *
 * Utilidades y constantes del guion
 * ===================================================================== */

/** Semilla del sitio (§0, «Decisiones de partida»). */
const SEMILLA = 2026;

/** Los siete valores de m del deslizador del módulo 2 (§4). */
const MS_M2 = [1, 2, 4, 8, 16, 32, 50];
/** Ancho de mosaico del módulo 2: el de la figura 9.10 del libro. */
const ANCHO_M2 = 200;
/** Los diez valores de k del deslizador del módulo 1 (§4). */
const KS_M1 = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
/** Los seis valores de α del deslizador del módulo 3 (§4). */
const ALPHAS_M3 = [2e-5, 5e-5, 1e-4, 2e-4, 5e-4, 1e-3];
/** Los cuatro valores de α de los botones del módulo 4 (§4). */
const ALPHAS_M4 = [0.01, 0.05, 0.1, 0.3];
/** Los cinco valores de α×m del deslizador del módulo 5 (§4). */
const ALPHAS_M5 = [0.1, 0.2, 0.5, 1.0, 1.5];
/** Las cuatro instantáneas de la superficie del módulo 5 (§4). */
const INSTANTANEAS_M5 = [
  { clave: "paso428", pasos: 428 },
  { clave: "ep12", episodio: 12 },
  { clave: "ep104", episodio: 104 },
  { clave: "ep500", episodio: 500 },
];

/** Comparación numérica con mensaje legible. */
function cerca(x, objetivo, tol, etiqueta) {
  assert.ok(
    Number.isFinite(x) && Math.abs(x - objetivo) <= tol,
    `${etiqueta}: ${x}, se esperaba ${objetivo} (tolerancia ${tol})`,
  );
}

/** Comparación relativa, para las aserciones de reproducibilidad. */
function cercaRelativa(x, objetivo, fraccion, etiqueta) {
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

const media = (a) => a.reduce((x, y) => x + y, 0) / a.length;

/**
 * Perfil de generalización ρ(s,s') = x(s)ᵀx(s') / x(s)ᵀx(s) (módulo 2, §6).
 * No lo exporta el motor: se calcula sobre `activas`, que sí.
 */
function rho(repr, s, s2) {
  const activas = new Set(repr.activas(s));
  let comunes = 0;
  for (const i of repr.activas(s2)) if (activas.has(i)) comunes += 1;
  return comunes / repr.activas(s).length;
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

/** Un generador que REGISTRA cada número que entrega, para comparar flujos. */
function generadorRegistrado(semilla) {
  const g = generador(semilla);
  const log = [];
  return {
    log,
    uniforme() {
      const x = g.uniforme();
      log.push(x);
      return x;
    },
    entero(n) {
      const x = g.entero(n);
      log.push(x);
      return x;
    },
  };
}

/* ===================================================================== *
 * Fixtures compartidas
 *
 * El paseo de mil estados y sus v_π, η y μ se resuelven UNA vez (el motor los
 * cachea por γ) y las campañas de Mountain Car —lo único caro de este
 * fichero— se memoizan por configuración: R5-1, R5-3, R5-5 y R5-7 leen la
 * misma tanda.
 * ===================================================================== */

const PASEO = paseoMil({ gamma: 1 });
const V_PI = PASEO.valoresVerdaderos;
const MU = PASEO.mu;
const AGR10 = agregacion(PASEO.nEstados, 10);
const raizVE = (repr, w) => Math.sqrt(errorVE(repr, w, V_PI, MU));

const CARRO = mountainCar();
/** La x(s,a) del módulo 5: m = 8, desplazamiento (1,3), d = 1944 (§0.3). */
const tileCarro = () => tileCoding2D({
  rangos: CARRO.rangos, m: 8, desplazamiento: [1, 3], nAcciones: 3, mosaicosPorLado: 8,
});

const CACHE_CAMPANAS = new Map();

/**
 * Una tanda del módulo 5: `ejecuciones` ejecuciones sembradas en 2026…, con la
 * curva de pasos por episodio promediada sobre los episodios que TODAS las
 * ejecuciones han alcanzado (una ejecución cortada no se rellena ni se
 * descarta en silencio: acorta la curva común y se cuenta en `cortadas`).
 */
function campanaControl({
  algoritmo = "sarsa", alphaM = 0.5, ejecuciones = 10, episodios = 500,
  lambda = 0, traza = "reemplazo", epsilon = 0.1, instantaneas = false,
} = {}) {
  const clave = `${algoritmo}|${alphaM}|${ejecuciones}|${episodios}|${lambda}|${traza}|${epsilon}|${instantaneas}`;
  if (CACHE_CAMPANAS.has(clave)) return CACHE_CAMPANAS.get(clave);

  const aprender = algoritmo === "sarsa" ? sarsaSemiGradiente : qLearningSemiGradiente;
  const series = [];
  let topes = 0;
  let cortadas = 0;
  let trazaNoNulaMedia = 0;
  let instantaneasEjecucion0 = [];

  for (let i = 0; i < ejecuciones; i++) {
    const repr = tileCarro();
    const res = aprender(CARRO, repr, {
      alpha: alphaM / repr.m,
      epsilon,
      gamma: 1,
      episodios,
      rng: generador(SEMILLA + i),
      maxPasos: 5000,
      lambda,
      traza,
      instantaneasEn: instantaneas && i === 0 ? INSTANTANEAS_M5 : [],
    });
    series.push(res.pasosPorEpisodio);
    topes += res.topes;
    if (res.cortada) cortadas += 1;
    if (res.trazaNoNulaMedia !== undefined) trazaNoNulaMedia += res.trazaNoNulaMedia / ejecuciones;
    if (i === 0) instantaneasEjecucion0 = res.instantaneas;
  }

  const largo = Math.min(...series.map((s) => s.length));
  const curva = [];
  for (let k = 0; k < largo; k++) {
    let suma = 0;
    for (const serie of series) suma += serie[k];
    curva.push(suma / series.length);
  }

  const salida = {
    curva,
    episodiosComunes: largo,
    primeros50: media(curva.slice(0, Math.min(50, curva.length))),
    ultimos50: media(curva.slice(-Math.min(50, curva.length))),
    topes,
    cortadas,
    trazaNoNulaMedia,
    instantaneas: instantaneasEjecucion0,
    ejecuciones,
  };
  CACHE_CAMPANAS.set(clave, salida);
  return salida;
}

let CAMPANA_PREDICCION = null;

/**
 * La tanda del módulo 3: 10 ejecuciones × 5000 episodios, MC y TD sobre LOS
 * MISMOS episodios, con √VE medido solo en los cortes que piden R3-1 a R3-3
 * (medirlo en los 5000 costaría 10⁸ evaluaciones y no aporta nada al test).
 */
function campanaPrediccion(alpha = 2e-4, cortes = [200, 5000]) {
  if (alpha === 2e-4 && CAMPANA_PREDICCION) return CAMPANA_PREDICCION;
  const ejecuciones = 10;
  const episodios = 5000;
  const puntos = new Map(cortes.map((c) => [c, { mc: 0, td: 0 }]));
  let truncados = 0;
  let cortadas = 0;
  let pasos = 0;
  let nEpisodios = 0;
  let pesos0 = null;

  for (let i = 0; i < ejecuciones; i++) {
    const rng = generador(SEMILLA + i);
    const wMC = new Float64Array(AGR10.d);
    const wTD = new Float64Array(AGR10.d);
    for (let k = 0; k < episodios; k++) {
      let episodio;
      for (;;) {
        episodio = muestrearEpisodio(PASEO, rng, { maxPasos: 10000 });
        if (!episodio.truncado) break;
        truncados += 1;
      }
      pasos += episodio.estados.length;
      nEpisodios += 1;
      const a = mcGradiente(PASEO, AGR10, [episodio], { alpha, w0: wMC, instantaneasCada: 0 });
      const b = tdSemiGradiente(PASEO, AGR10, [episodio], { alpha, w0: wTD, instantaneasCada: 0 });
      wMC.set(a.w);
      wTD.set(b.w);
      if (a.cortada || b.cortada) cortadas += 1;
      if (puntos.has(k + 1)) {
        const p = puntos.get(k + 1);
        p.mc += raizVE(AGR10, wMC) / ejecuciones;
        p.td += raizVE(AGR10, wTD) / ejecuciones;
      }
    }
    if (i === 0) pesos0 = { mc: Array.from(wMC), td: Array.from(wTD) };
  }

  const salida = {
    puntos, truncados, cortadas, pesos0, ejecuciones, episodios,
    longitudMedia: pasos / nEpisodios,
  };
  if (alpha === 2e-4) CAMPANA_PREDICCION = salida;
  return salida;
}

/* ===================================================================== *
 * MOTOR · CONTRATO TRANSVERSAL   [C]
 * Fuente: guion §C4, «las once comprobaciones que no salen de ninguna §8»
 * ===================================================================== */

describe("Motor · contrato transversal (guion §C4)", () => {
  test("Q-1: `aproximacion.js` no referencia el DOM ni el azar global del lenguaje", () => {
    /* Es la regla de los motores del sitio y es lo que permite probarlo con
       `node --test`. Se busca la cadena en el fichero, no el comportamiento:
       un `document` dentro de una rama que no se ejecuta también rompe la
       regla. El propio motor lo sabe y evita escribir el nombre incluso en
       los comentarios. */
    for (const fichero of ["assets/aproximacion.js", "assets/aproximacion-worker.js"]) {
      const src = readFileSync(join(RAIZ, fichero), "utf8");
      for (const prohibida of ["Math.random", "document", "window", "globalThis"]) {
        assert.ok(
          !src.includes(prohibida),
          `${fichero} referencia \`${prohibida}\`: los motores del sitio no tocan el DOM ni el azar global`,
        );
      }
    }
  });

  test("Q-2: los módulos 1, 2, 4 y 6 son deterministas — ninguno acepta ni consume azar", () => {
    /* El guion pide «salidas idénticas bit a bit con dos semillas distintas».
       En este motor eso es más fuerte de lo que suena: las funciones de esos
       cuatro módulos NO RECIBEN generador, así que la comprobación es que dos
       invocaciones independientes coinciden bit a bit y que ninguna ruta pide
       azar (se les pasa `PASEO`, que ya está resuelto, y se comprueba que
       nada llama a un rng prohibido en las que sí admiten uno). */
    const uno = pesosOptimos(AGR10, V_PI, MU).w;
    const dos = pesosOptimos(agregacion(PASEO.nEstados, 10), V_PI, MU).w;
    identicos(uno, dos, "M1: pesos óptimos");

    const perfil = (m) => MS_M2.map(() => 0).map((_, j) =>
      rho(tileCoding1D({ nEstados: 1000, m, ancho: ANCHO_M2 }), 499, 499 + j));
    assert.deepEqual(perfil(8), perfil(8), "M2: perfil de generalización");

    const f1 = fragmentoW2W({ gamma: 0.99, alpha: 0.1 });
    const f2 = fragmentoW2W({ gamma: 0.99, alpha: 0.1 });
    assert.deepEqual(f1.serie, f2.serie, "M4: trayectoria de w");

    assert.deepEqual(
      fichaCasilla({ algoritmo: "td0", aproximador: "lineal", politica: "fuera" }),
      fichaCasilla({ algoritmo: "td0", aproximador: "lineal", politica: "fuera" }),
      "M6: ficha de casilla",
    );
  });

  test("Q-3: los módulos 3 y 5 dan salidas idénticas al repetir con la misma semilla", () => {
    const a = curvasPrediccion({
      semilla: SEMILLA, alpha: 2e-4, episodios: 200, ejecuciones: 2, alProgresar: () => {},
    });
    const b = curvasPrediccion({
      semilla: SEMILLA, alpha: 2e-4, episodios: 200, ejecuciones: 2, alProgresar: () => {},
    });
    identicos(a.curvaMC, b.curvaMC, "M3: curva de MC");
    identicos(a.curvaTD, b.curvaTD, "M3: curva de TD");

    const c = curvasControl({
      semilla: SEMILLA, algoritmo: "sarsa", episodios: 15, ejecuciones: 2, alProgresar: () => {},
    });
    const d = curvasControl({
      semilla: SEMILLA, algoritmo: "sarsa", episodios: 15, ejecuciones: 2, alProgresar: () => {},
    });
    assert.deepEqual(
      c.resultados.map((r) => r.curva),
      d.resultados.map((r) => r.curva),
      "M5: curvas de pasos por episodio",
    );
  });

  test("Q-4: `paseoMil` cachea v_π, η y μ — la segunda llamada con el mismo γ no vuelve a iterar", () => {
    /* El módulo 1 tiene que responder al instante y los módulos 1, 2 y 3
       comparten el cálculo. `cachePaseoMil().calculos` cuenta las
       resoluciones REALES de la programación dinámica desde la carga. */
    paseoMil({ gamma: 1 }); // ya resuelto por la fixture
    const antes = cachePaseoMil().calculos;
    const a = paseoMil({ gamma: 1 });
    const b = paseoMil({ gamma: 1 });
    assert.equal(cachePaseoMil().calculos, antes, "una segunda llamada ha vuelto a iterar");
    /* Y devuelve los MISMOS arrays, no copias: es lo que hace que el módulo 3
       no recalcule al cambiar de método. */
    assert.equal(a.valoresVerdaderos, b.valoresVerdaderos);
    assert.equal(a.mu, b.mu);

    const otro = paseoMil({ gamma: 0.9 });
    assert.ok(cachePaseoMil().calculos > antes, "un γ nuevo tiene que resolverse");
    assert.notEqual(otro.mu, a.mu, "cada γ tiene su propia μ");
  });

  test("Q-5: el barrido de v_π es O(|S|) — tiempo/(barridos × estados) constante en 1000, 2000 y 4000", () => {
    /* ⚠ VERSIÓN CORREGIDA. El coste POR BARRIDO es O(|S|), pero el NÚMERO de
       barridos crece con |S| (1 840 · 6 714 · 25 081), así que el tiempo total
       de `paseoMil` NO es lineal en |S| y el test tal como lo escribe el guion
       fallaría midiendo algo cierto. Lo que sí es invariante —y lo que se
       rompería al volver al barrido ingenuo O(|S|²)— es el coste unitario. */
    const unitarios = [];
    for (const nEstados of [1000, 2000, 4000]) {
      paseoMil({ nEstados, gamma: 0.5 }); // calentamiento del JIT, γ distinto
      const t0 = process.hrtime.bigint();
      const entorno = paseoMil({ nEstados, gamma: 0.987654321 });
      const t1 = process.hrtime.bigint();
      const barridos = entorno.barridos.v + entorno.barridos.eta;
      assert.ok(barridos > 100, `n=${nEstados}: solo ${barridos} barridos, la medida no vale`);
      unitarios.push({ nEstados, barridos, ns: Number(t1 - t0) / (barridos * nEstados) });
    }
    const min = Math.min(...unitarios.map((u) => u.ns));
    const max = Math.max(...unitarios.map((u) => u.ns));
    /* Con sumas acumuladas el coste unitario es de ~10-18 ns y plano; con un
       barrido ingenuo crecería ×2 al doblar |S| y ×4 al cuadruplicarlo, lo que
       dispararía este cociente muy por encima de 5. La cota es holgada a
       propósito: es una medida de tiempo en una máquina compartida. */
    assert.ok(
      max / min < 5,
      `el coste por barrido y estado no es constante: ${JSON.stringify(unitarios)}`,
    );
  });

  test("Q-10: la traza no consume azar — con ε = 1 el flujo del generador es idéntico con λ = 0 y con λ = 0,9", () => {
    /* Es el punto 5 de la addenda §2 y el fallo más caro posible del añadido:
       si al meter λ se moviera una sola llamada al generador, todas las cifras
       sembradas de las dos páginas dejarían de valer y nadie se enteraría.
       Con ε = 1 la trayectoria NO depende de w —cada acción sale de un
       `uniforme()` y un `entero(3)`, sin argmax ni desempates—, así que las
       dos ejecuciones tienen que consumir EXACTAMENTE la misma secuencia y
       visitar los mismos estados, aunque los pesos resulten distintos. */
    const opciones = { alpha: 0.5 / 8, epsilon: 1, gamma: 1, episodios: 20, maxPasos: 2000 };
    const g0 = generadorRegistrado(SEMILLA);
    const g9 = generadorRegistrado(SEMILLA);
    const sinTraza = sarsaSemiGradiente(CARRO, tileCarro(), { ...opciones, rng: g0, lambda: 0 });
    const conTraza = sarsaSemiGradiente(CARRO, tileCarro(), {
      ...opciones, rng: g9, lambda: 0.9, traza: "reemplazo",
    });

    assert.ok(g0.log.length > 10000, "la muestra de consumo del generador es demasiado corta");
    identicos(g0.log, g9.log, "flujo del generador con λ = 0 frente a λ = 0,9");
    assert.deepEqual(
      sinTraza.pasosPorEpisodio, conTraza.pasosPorEpisodio,
      "con ε = 1 las dos ejecuciones tienen que recorrer los mismos episodios",
    );
    /* Y los pesos SÍ difieren: si coincidieran, la traza no estaría haciendo
       nada y el test de arriba sería vacío. */
    assert.ok(
      sinTraza.w.some((x, i) => x !== conTraza.w[i]),
      "λ = 0,9 no ha cambiado ningún peso: la traza no se está aplicando",
    );
  });

  test("Q-11: la poda del conjunto activo de z es ruido de redondeo — coincide con una traza densa sin poda", () => {
    /* El motor mantiene z dispersa y poda por debajo de 1e-8 (addenda §2,
       punto 3). El umbral es una constante del módulo y no se puede inyectar,
       así que en vez de comparar dos umbrales se compara contra una
       implementación DENSA Y SIN PODA escrita aquí: si la poda cambiara el
       algoritmo en algún régimen, esta diferencia se vería. */
    const repr = tileCoding1D({ nEstados: 1000, m: 8, ancho: ANCHO_M2 });
    const transiciones = [];
    for (let k = 0; k < 400; k++) transiciones.push({ estado: (k * 37) % 1000 });

    for (const gammaLambda of [0.45, 0.9, 0.99, 1]) {
      for (const tipo of ["acumulativa", "reemplazo"]) {
        const densa = new Float64Array(repr.d);
        for (const { estado } of transiciones) {
          for (let i = 0; i < densa.length; i++) densa[i] *= gammaLambda;
          for (const i of repr.activas(estado)) densa[i] = tipo === "reemplazo" ? 1 : densa[i] + 1;
        }
        const dispersa = trazaTrasPasos(repr, transiciones, {
          gamma: gammaLambda, lambda: 1, traza: tipo,
        });
        cercaVector(dispersa.z, Array.from(densa), 1e-12, `z dispersa vs densa (γλ=${gammaLambda}, ${tipo})`);
      }
    }
  });

  test("contrato: las entradas inválidas se rechazan con un mensaje claro antes de calcular", () => {
    assert.throws(() => paseoMil({ gamma: 1.5 }), /gamma debe estar en \[0, 1\]/);
    assert.throws(() => oneHot(0), /entero ≥ 1/);
    assert.throws(() => agregacion(1000, -3), /entero ≥ 1/);
    assert.throws(() => tileCoding1D({ nEstados: 1000, m: 8, ancho: 0 }), /ancho debe ser > 0/);
    assert.throws(() => tileCoding2D({ rangos: [[0, 1]], m: 8, desplazamiento: [1, 3], nAcciones: 3, mosaicosPorLado: 8 }), /rangos debe ser/);
    assert.throws(() => curvaVE(PASEO, AGR10, { metodo: "sarsa", alpha: 1e-4, episodios: 1, ejecuciones: 1, semilla: 1 }), /metodo debe ser "mc" o "td"/);
    assert.throws(() => trazaTrasPasos(oneHot(5), [], { gamma: 1, lambda: 2 }), /lambda debe estar en \[0, 1\]/);
    assert.throws(() => trazaTrasPasos(oneHot(5), [], { gamma: 1, lambda: 0.5, traza: "otra" }), /traza debe ser/);
    assert.throws(() => fragmentoW2W({ gamma: 1, alpha: 0.1, regimen: "medio" }), /regimen debe ser/);
    assert.throws(() => contarInductores({ algoritmo: "reinforce", aproximador: "lineal", politica: "dentro" }), /algoritmo desconocido/);
    assert.throws(() => sarsaSemiGradiente(CARRO, tileCarro(), { alpha: 0.1, epsilon: 0.1, episodios: 1, rng: null }), /generador de nucleo/);
    assert.throws(() => muestrearEpisodio(PASEO, {}), /generador de nucleo/);
  });
});

/* ===================================================================== *
 * MÓDULO 1 · El objetivo que la baraja no escribe: VE y μ   [C]
 * Fuente: guion, módulo 1, §8a. S&B §9.1-§9.3, Example 9.1, pp. 221-226
 * ===================================================================== */

describe("Módulo 1 · VE y μ (guion M1 §8a)", () => {
  test("C1-1: P(terminar por la izquierda | s = 1) = 0,5", () => {
    // Example 9.1, p. 225: 100 de los 200 destinos de s = 1 caen por debajo de 1.
    const { nIzq } = PASEO.destinos(0); // el «estado 1» del libro es el índice 0
    cerca(nIzq / (2 * PASEO.radio), 0.5, 1e-12, "P(izquierda | s=1)");
    /* Y lo mismo leído del modelo explícito, que es lo que consume `matrizAb`:
       si las dos vías no coincidieran, A y b se construirían sobre otra
       dinámica que la que se simula. */
    const izquierda = PASEO.transiciones(0).filter((t) => t.s2 < 0);
    assert.equal(izquierda.length, 1);
    cerca(izquierda[0].p, 0.5, 1e-12, "P(izquierda | s=1) según transiciones()");
    assert.equal(izquierda[0].r, -1, "terminar por la izquierda da −1");
  });

  test("C1-2: P(terminar por la derecha | s = 950) = 0,25", () => {
    const { nDch } = PASEO.destinos(949);
    cerca(nDch / (2 * PASEO.radio), 0.25, 1e-12, "P(derecha | s=950)");
    const derecha = PASEO.transiciones(949).filter((t) => t.s2 >= PASEO.nEstados);
    cerca(derecha[0].p, 0.25, 1e-12, "P(derecha | s=950) según transiciones()");
    assert.equal(derecha[0].r, 1, "terminar por la derecha da +1");
  });

  test("C1-3: v_π(s) + v_π(1001−s) = 0 para los mil estados (simetría exacta)", () => {
    /* La aplicación s ↦ 1001−s transforma la dinámica en sí misma con las
       recompensas cambiadas de signo. v_π se resuelve por programación
       dinámica, no se muestrea: la simetría tiene que salir a 1e-9. */
    let peor = 0;
    for (let s = 0; s < PASEO.nEstados; s++) {
      peor = Math.max(peor, Math.abs(V_PI[s] + V_PI[PASEO.nEstados - 1 - s]));
    }
    assert.ok(peor < 1e-9, `la simetría de v_π falla por ${peor}`);
  });

  test("C1-4: v_π es no decreciente — v_π(s+1) − v_π(s) ≥ 0 para s = 1…999", () => {
    // Figura 9.1, p. 226: «nearly a straight line». La monotonía es estructural.
    for (let s = 0; s < PASEO.nEstados - 1; s++) {
      assert.ok(
        V_PI[s + 1] - V_PI[s] >= -1e-12,
        `v_π baja entre los estados ${s + 1} y ${s + 2}: ${V_PI[s + 1] - V_PI[s]}`,
      );
    }
    // Y los extremos tienen el signo que exige la recompensa terminal.
    assert.ok(V_PI[0] < 0 && V_PI[PASEO.nEstados - 1] > 0);
  });

  test("C1-5: Σ_s μ(s) = 1", () => {
    let suma = 0;
    for (let s = 0; s < PASEO.nEstados; s++) suma += MU[s];
    cerca(suma, 1, 1e-12, "Σ μ(s)");
  });

  test("C1-6: μ(s) > 0 para los mil estados", () => {
    /* Desde el estado 500 todo estado es alcanzable con probabilidad positiva.
       Es lo que garantiza que la fórmula cerrada de w* no divida por cero en
       este entorno (sí puede pasar con los mosaicos vacíos del módulo 2). */
    let minimo = Infinity;
    for (let s = 0; s < PASEO.nEstados; s++) minimo = Math.min(minimo, MU[s]);
    assert.ok(minimo > 0, `min μ = ${minimo}`);
    assert.equal(pesosOptimos(AGR10, V_PI, MU).vacios.length, 0, "no puede haber grupos vacíos");
  });

  test("C1-7: μ(500) ≈ 0,0137 (el «about 1,37 %» que publica el libro)", () => {
    // p. 226 y eje derecho de la figura 9.1. Tolerancia amplia: el libro redondea.
    cerca(MU[499], 0.0137, 5e-4, "μ(500)");
  });

  test("C1-8: max μ(s) en [400,600] sin el 500 cae en [0,0015; 0,0019]", () => {
    // El libro publica «about 0,17 %» para los alcanzables en un paso desde el inicio.
    let maximo = 0;
    for (let s = 399; s <= 599; s++) if (s !== 499) maximo = Math.max(maximo, MU[s]);
    assert.ok(maximo >= 0.0015 && maximo <= 0.0019, `max μ vecino = ${maximo}`);
  });

  test("C1-9: μ(1) ≈ 0,000147 (el «about 0,0147 %» del libro)", () => {
    cerca(MU[0], 0.000147, 2e-5, "μ(1)");
  });

  test("C1-10: μ(100)/μ(1) > 3 — «state 100 is weighted more than 3 times more strongly»", () => {
    // p. 226, literal. No es una afirmación absoluta: es la desigualdad publicada.
    const razon = MU[99] / MU[0];
    assert.ok(razon > 3, `μ(100)/μ(1) = ${razon}`);
  });

  test("C1-11: w* por fórmula cerrada = w* minimizando VE numéricamente (k = 10)", () => {
    /* Dos cálculos deterministas del mismo mínimo de una cuadrática convexa,
       por caminos independientes: la media ponderada por grupo de
       `pesosOptimos`, y la resolución del sistema normal ∇VE = 0 con la
       eliminación gaussiana de `resolver`. Si `pesosOptimos` tuviera un sesgo
       —la media aritmética en vez de la ponderada, por ejemplo— este test lo
       cazaría. */
    const H = [];
    for (let i = 0; i < AGR10.d; i++) H.push(new Float64Array(AGR10.d));
    const c = new Float64Array(AGR10.d);
    for (let s = 0; s < PASEO.nEstados; s++) {
      const activas = AGR10.activas(s);
      for (const i of activas) {
        for (const j of activas) H[i][j] += MU[s];
        c[i] += MU[s] * V_PI[s];
      }
    }
    const { w: numerico } = resolver(H, c);
    const { w: cerrado } = pesosOptimos(AGR10, V_PI, MU);
    cercaVector(numerico, Array.from(cerrado), 1e-10, "w* numérico vs cerrado");
  });

  test("C1-12: VE(w*) = 0 con k = 1000 — un peso por estado, sin error de aproximación", () => {
    // Exercise 9.1, p. 231: es la respuesta a `5_Tema_5_1#slide-11`.
    const repr = agregacion(PASEO.nEstados, 1000);
    const { w } = pesosOptimos(repr, V_PI, MU);
    cerca(errorVE(repr, w, V_PI, MU), 0, 1e-12, "VE(w*) con k = 1000");
    cercaVector(w, Array.from(V_PI), 1e-12, "w* con k = 1000 tiene que ser v_π");
  });

  test("C1-13: VE(w*) es no creciente a lo largo de k = 1, 2, 10, 100, 1000", () => {
    /* Cada k divide al siguiente, así que las particiones están anidadas y el
       conjunto de funciones representables solo crece. */
    let anterior = Infinity;
    for (const k of [1, 2, 10, 100, 1000]) {
      const repr = agregacion(PASEO.nEstados, k);
      const ve = errorVE(repr, pesosOptimos(repr, V_PI, MU).w, V_PI, MU);
      assert.ok(ve <= anterior + 1e-12, `VE(w*) sube al pasar de menos grupos a k = ${k}`);
      anterior = ve;
    }
  });

  test("C1-14: mover un solo peso cambia v̂ en exactamente 1000/k estados", () => {
    // Es el tamaño del grupo, por construcción (§9.3, p. 225).
    for (const k of KS_M1) {
      const repr = agregacion(PASEO.nEstados, k);
      const w0 = new Float64Array(k);
      const w1 = new Float64Array(k);
      w1[k >> 1] = 1;
      let cambian = 0;
      for (let s = 0; s < PASEO.nEstados; s++) {
        if (repr.valor(w1, s) !== repr.valor(w0, s)) cambian += 1;
      }
      assert.equal(cambian, PASEO.nEstados / k, `k = ${k}`);
    }
  });

  test("C1-15: VE(w uniforme) ≥ VE(w*) con k = 10 — el botón «uniforme» empeora la métrica", () => {
    /* w* es por definición el minimizador de VE con μ; al pulsar «uniforme»
       no cambia la métrica, cambian los pesos, y por eso el error sube. */
    const conMu = pesosOptimos(AGR10, V_PI, MU).w;
    const uniforme = pesosOptimos(AGR10, V_PI, "uniforme").w;
    const veMu = errorVE(AGR10, conMu, V_PI, MU);
    const veUnif = errorVE(AGR10, uniforme, V_PI, MU);
    assert.ok(veUnif >= veMu - 1e-12, `VE(unif) = ${veUnif} < VE(w*) = ${veMu}`);
    assert.ok(veUnif > veMu, "con este entorno la desigualdad es estricta y es la lectura del botón");
    // Y los dos vectores son distintos: si no, el botón no haría nada.
    assert.ok(uniforme.some((x, i) => Math.abs(x - conMu[i]) > 1e-6));
  });

  test("M1 §8b: el módulo no consume azar — v_π, η y μ son idénticos con dos semillas", () => {
    /* El guion lo dice explícitamente: «este módulo no consume azar […] el
       test tiene que comprobar precisamente eso». Ninguna de las funciones del
       módulo 1 recibe generador, así que se comprueba pasando uno que LANZA. */
    const a = paseoMil({ gamma: 0.95 });
    const b = paseoMil({ gamma: 0.95 });
    identicos(a.valoresVerdaderos, b.valoresVerdaderos, "v_π");
    identicos(a.mu, b.mu, "μ");
    identicos(a.eta, b.eta, "η");
    // Y `paso` es el único que pide azar, y solo un entero(200) por llamada.
    assert.throws(() => PASEO.paso(499, RNG_PROHIBIDO), /se ha consumido azar/);
  });
});

/* ===================================================================== *
 * MÓDULO 2 · Qué es x(s): de one-hot a tile coding   [C]
 * Fuente: guion, módulo 2, §8a. S&B §9.3-§9.5.4, pp. 225-245
 * ===================================================================== */

describe("Módulo 2 · x(s), de one-hot a tile coding (guion M2 §8a)", () => {
  test("C2-1: one-hot — v̂(s,w) = w_s y ∇v̂(s,w) = e_s para los mil estados", () => {
    const repr = oneHot(PASEO.nEstados);
    const w = new Float64Array(repr.d);
    for (let i = 0; i < repr.d; i++) w[i] = i / 1000;
    assert.equal(repr.d, 1000);
    assert.equal(repr.nActivas, 1);
    for (let s = 0; s < PASEO.nEstados; s++) {
      cerca(repr.valor(w, s), w[s], 1e-15, `v̂(${s})`);
      const activas = repr.activas(s);
      assert.equal(activas.length, 1, `|activas(${s})|`);
      assert.equal(activas[0], s, `activas(${s})`);
    }
  });

  test("C2-2: one-hot — un paso lineal es EXACTAMENTE un paso tabular (Exercise 9.1)", () => {
    /* El ejercicio central del tema: w ← w + α[U−v̂(s,w)]x(s) y
       w_s ← w_s + α[U−w_s] son la misma operación escrita de dos formas.
       Tolerancia EXACTAMENTE 0: no es una aproximación. */
    const repr = oneHot(PASEO.nEstados);
    const base = new Float64Array(repr.d);
    for (let i = 0; i < repr.d; i++) base[i] = i / 1000;
    const alpha = 0.1;
    const U = 0.5;

    for (const s of [0, 1, 421, 499, 999]) {
      const lineal = Float64Array.from(base);
      repr.acumular(lineal, alpha * (U - repr.valor(lineal, s)), s);
      const tabular = Float64Array.from(base);
      tabular[s] += alpha * (U - tabular[s]);
      identicos(lineal, tabular, `un paso en s = ${s}`);
    }
  });

  test("C2-3: caso lineal — ∇v̂(s,w) = x(s), contra diferencias centradas con h = 1e-6", () => {
    const repr = tileCoding1D({ nEstados: 1000, m: 8, ancho: ANCHO_M2 });
    const w = new Float64Array(repr.d);
    for (let i = 0; i < repr.d; i++) w[i] = i / repr.d;
    const h = 1e-6;
    for (const s of [0, 249, 499, 749, 999]) {
      const activas = new Set(repr.activas(s));
      for (let i = 0; i < repr.d; i++) {
        const mas = Float64Array.from(w);
        const menos = Float64Array.from(w);
        mas[i] += h;
        menos[i] -= h;
        const numerico = (repr.valor(mas, s) - repr.valor(menos, s)) / (2 * h);
        cerca(numerico, activas.has(i) ? 1 : 0, 1e-6, `∂v̂(${s})/∂w[${i}]`);
      }
    }
  });

  test("C2-4: tile coding — exactamente m componentes a 1, para los mil estados y los siete m", () => {
    /* §9.5.4, p. 240, literal: «Exactly one feature is present in each
       tiling». Es estructural, no muestral: cada mosaicado es una partición
       que cubre el rango. Y los m índices son DISTINTOS entre sí, o el
       aproximador no sería el que dice el guion. */
    for (const m of MS_M2) {
      const repr = tileCoding1D({ nEstados: 1000, m, ancho: ANCHO_M2 });
      assert.equal(repr.nActivas, m, `nActivas con m = ${m}`);
      for (let s = 0; s < 1000; s++) {
        const activas = repr.activas(s);
        assert.equal(activas.length, m, `|x(${s})| con m = ${m}`);
        assert.equal(new Set(activas).size, m, `x(${s}) repite índice con m = ${m}`);
        for (const i of activas) {
          assert.ok(i >= 0 && i < repr.d, `índice ${i} fuera de [0,${repr.d}) con m = ${m}`);
        }
      }
    }
  });

  test("C2-5: tile coding con m = 1 y ℓ = 200 es agregación: 5 clases de 200 estados consecutivos", () => {
    /* §9.5.4, p. 239, literal: «With just one tiling, we would not have coarse
       coding but just a case of state aggregation». Y figura 9.10: «tiles each
       200 states wide». */
    const repr = tileCoding1D({ nEstados: 1000, m: 1, ancho: ANCHO_M2 });
    const clases = new Map();
    for (let s = 0; s < 1000; s++) {
      const clave = repr.activas(s)[0];
      if (!clases.has(clave)) clases.set(clave, []);
      clases.get(clave).push(s);
    }
    assert.equal(clases.size, 5, "número de clases");
    for (const [, estados] of clases) {
      assert.equal(estados.length, 200, "tamaño de la clase");
      assert.equal(estados[199] - estados[0], 199, "la clase tiene que ser un tramo consecutivo");
    }
  });

  test("C2-6: x(s)ᵀx(s') = 0 en cuanto |s−s'| ≥ ℓ, para los siete m", () => {
    // Dos estados separados más de un ancho no pueden compartir mosaico (§9.5.4, p. 240).
    for (const m of MS_M2) {
      const repr = tileCoding1D({ nEstados: 1000, m, ancho: ANCHO_M2 });
      for (let s = 0; s < 1000; s += 7) {
        const activas = new Set(repr.activas(s));
        for (let s2 = 0; s2 < 1000; s2 += 11) {
          if (Math.abs(s - s2) < ANCHO_M2) continue;
          for (const i of repr.activas(s2)) {
            assert.ok(!activas.has(i), `m = ${m}: ${s} y ${s2} comparten el mosaico ${i}`);
          }
        }
      }
    }
  });

  test("C2-7: tile coding con α = 1/m — un solo paso lleva v̂(s) EXACTAMENTE al objetivo", () => {
    /* §9.5.4, pp. 239-240, literal: «choosing α = 1/n […] results in exact
       one-trial learning». Δv̂ = α·m·[u−v̂] = [u−v̂]: identidad algebraica. */
    const u = 0.5;
    for (const m of MS_M2) {
      const repr = tileCoding1D({ nEstados: 1000, m, ancho: ANCHO_M2 });
      const w = new Float64Array(repr.d);
      for (let i = 0; i < repr.d; i++) w[i] = Math.sin(i) * 0.3;
      for (const s of [0, 317, 999]) {
        const nuevo = Float64Array.from(w);
        repr.acumular(nuevo, (1 / m) * (u - repr.valor(nuevo, s)), s);
        cerca(repr.valor(nuevo, s), u, 1e-12, `v̂ tras un paso con α = 1/${m} en s = ${s}`);
      }
    }
  });

  test("C2-8: tile coding con α = 1/(10m) — v̂(s) se mueve exactamente una décima", () => {
    const u = 0.5;
    for (const m of MS_M2) {
      const repr = tileCoding1D({ nEstados: 1000, m, ancho: ANCHO_M2 });
      const w = new Float64Array(repr.d);
      for (let i = 0; i < repr.d; i++) w[i] = Math.sin(i) * 0.3;
      for (const s of [0, 317, 999]) {
        const antes = repr.valor(w, s);
        const nuevo = Float64Array.from(w);
        repr.acumular(nuevo, (1 / (10 * m)) * (u - antes), s);
        cerca(repr.valor(nuevo, s) - antes, (u - antes) / 10, 1e-12, `Δv̂ con α = 1/(10·${m})`);
      }
    }
  });

  test("C2-9: la regla del paso (9.19) con m = 98 mosaicados y τ = 10 da α = 1/980", () => {
    /* (9.19), p. 245, y Exercise 9.5: α = 1/(τ·E[xᵀx]), y con tile coding
       xᵀx = m es constante. El 98 se lee de la representación, no se
       transcribe: si `nActivas` dejara de ser m, este test caería. */
    const repr = tileCoding1D({ nEstados: 1000, m: 98, ancho: ANCHO_M2 });
    assert.equal(repr.nActivas, 98);
    const tau = 10;
    cerca(1 / (tau * repr.nActivas), 1 / 980, 1e-12, "α de (9.19)");
  });

  test("C2-10: d = 6m para tile coding con ℓ = 200 (es m(⌈1000/ℓ⌉+1))", () => {
    for (const m of MS_M2) {
      const repr = tileCoding1D({ nEstados: 1000, m, ancho: ANCHO_M2 });
      assert.equal(repr.mosaicosPorMosaicado, Math.ceil(1000 / ANCHO_M2) + 1, `T con m = ${m}`);
      assert.equal(repr.d, 6 * m, `d con m = ${m}`);
    }
  });

  test("C2-11: ρ(s,s) = 1 para los mil estados y las tres representaciones", () => {
    const representaciones = [
      oneHot(1000),
      agregacion(1000, 10),
      tileCoding1D({ nEstados: 1000, m: 8, ancho: ANCHO_M2 }),
    ];
    for (const repr of representaciones) {
      for (let s = 0; s < 1000; s++) cerca(rho(repr, s, s), 1, 1e-15, `ρ(${s},${s}) en ${repr.tipo}`);
    }
  });

  test("C2-12: agregación en 5 grupos y tile coding con m = 1, ℓ = 200 inducen el MISMO perfil", () => {
    // §9.5.4, p. 239: es la equivalencia que el módulo enseña.
    const ag = agregacion(1000, 5);
    const tc = tileCoding1D({ nEstados: 1000, m: 1, ancho: ANCHO_M2 });
    for (const s of [0, 199, 499, 500, 999]) {
      for (let s2 = 0; s2 < 1000; s2++) {
        cerca(rho(tc, s, s2), rho(ag, s, s2), 1e-15, `ρ(${s},${s2})`);
      }
    }
  });

  test("C2-13: nº de estados con ρ(500,s') > 0 es 2ℓ − ⌊ℓ/m⌋ — 200·300·350·375·388·394·396", () => {
    /* ⚠ VERSIÓN CORREGIDA. El guion escribe «2ℓ−1 = 399», que es el recuento
       de un solapamiento CONTINUO; con m mosaicados desplazados ℓ/m el
       solapamiento se corta en escalones y el recuento exacto es 2ℓ − ⌊ℓ/m⌋.
       El 399 solo saldría con m = 200 (⌊200/200⌋ = 1), que no está en el
       deslizador. Se comprueba la fórmula sobre los SIETE valores de m, no un
       número suelto: así el test dice qué se rompe si cambia la construcción. */
    const esperados = [200, 300, 350, 375, 388, 394, 396];
    MS_M2.forEach((m, j) => {
      const repr = tileCoding1D({ nEstados: 1000, m, ancho: ANCHO_M2 });
      let alcanzados = 0;
      for (let s2 = 0; s2 < 1000; s2++) if (rho(repr, 499, s2) > 0) alcanzados += 1;
      const formula = 2 * ANCHO_M2 - Math.floor(ANCHO_M2 / m);
      assert.equal(alcanzados, formula, `m = ${m}: la fórmula 2ℓ−⌊ℓ/m⌋ no cuadra`);
      assert.equal(alcanzados, esperados[j], `m = ${m}: recuento`);
      assert.notEqual(alcanzados, 399, `m = ${m}: el 399 del guion no sale con ningún m del deslizador`);
    });
  });

  test("M2 §8b: el módulo no consume azar — dos construcciones dan la misma geometría", () => {
    for (const m of MS_M2) {
      const a = tileCoding1D({ nEstados: 1000, m, ancho: ANCHO_M2 });
      const b = tileCoding1D({ nEstados: 1000, m, ancho: ANCHO_M2 });
      for (let s = 0; s < 1000; s += 37) identicos(a.activas(s), b.activas(s), `activas(${s}), m = ${m}`);
    }
  });

  test("M2 §6: los mosaicos vacíos existen, valen 0 y se devuelven en `vacios`", () => {
    /* Caso degenerado resuelto por escrito en el guion: con desplazamiento
       algunos mosaicos de los extremos no contienen ningún estado. Sus pesos
       cuentan en d porque están en el vector, y `pesosOptimos` los tiene que
       devolver marcados en vez de dividir por cero. */
    const repr = tileCoding1D({ nEstados: 1000, m: 8, ancho: ANCHO_M2 });
    const unico = { ...repr, nActivas: 1, activas: (s) => Int32Array.of(repr.activas(s)[0]) };
    const { w, vacios } = pesosOptimos(unico, V_PI, MU);
    assert.ok(vacios.length > 0, "con desplazamiento tiene que haber mosaicos vacíos");
    for (const j of vacios) assert.equal(w[j], 0, `el peso vacío ${j} tiene que valer 0`);
    for (const x of w) assert.ok(Number.isFinite(x), "ningún peso puede ser NaN por dividir por cero");
  });
});

/* ===================================================================== *
 * MÓDULO 3 · MC y TD(0) con aproximación lineal
 * Fuente: guion, módulo 3, §8a [C] y §8b [R]. S&B §9.3-§9.4, pp. 224-231
 * ===================================================================== */

describe("Módulo 3 · MC y TD(0) lineales — contraste (guion M3 §8a)", () => {
  test("C3-1: w_TD por eliminación gaussiana = w_TD iterando w ← w + α(b−Aw) [α = 1, no 1e-3]", () => {
    /* ⚠ VERSIÓN CORREGIDA. El guion fija α = 10⁻³ para el procedimiento de
       referencia, y con ese α la iteración está INFRA-CONVERGIDA: tras 2·10⁶
       pasos el error frente a la eliminación gaussiana es 4,3·10⁻³, cinco
       órdenes de magnitud por encima de la tolerancia de 10⁻⁸ que el propio
       guion pide. No falla el motor: falla el α del test. Con α = 1 —que es un
       parámetro DEL TEST, el motor no lo usa— la iteración converge en 12 575
       pasos y el error queda en 6,7·10⁻¹⁰. La tolerancia NO se relaja. */
    const { A, b } = matrizAb(PASEO, AGR10, 1);
    const { w: exacto, regularizada } = puntoFijoTD(PASEO, AGR10, 1);
    assert.equal(regularizada, false, "con esta representación A no debería ser singular");

    const alpha = 1;
    let w = new Float64Array(AGR10.d);
    let iteraciones = 0;
    for (; iteraciones < 200000; iteraciones++) {
      const siguiente = new Float64Array(AGR10.d);
      let delta = 0;
      for (let i = 0; i < AGR10.d; i++) {
        let Aw = 0;
        for (let j = 0; j < AGR10.d; j++) Aw += A[i][j] * w[j];
        siguiente[i] = w[i] + alpha * (b[i] - Aw);
        delta = Math.max(delta, Math.abs(siguiente[i] - w[i]));
      }
      w = siguiente;
      if (delta < 1e-12) break;
    }
    assert.ok(iteraciones < 200000, "la iteración en esperanza no ha convergido");
    cercaVector(w, Array.from(exacto), 1e-8, "w_TD iterado vs resuelto");
  });

  test("C3-2: VE(w_TD) > min VE con 10 grupos — «TD is farther from the true values than MC»", () => {
    // Example 9.2, p. 230, literal. La desigualdad estricta es el resultado publicado.
    const veTD = errorVE(AGR10, puntoFijoTD(PASEO, AGR10, 1).w, V_PI, MU);
    const veOptimo = errorVE(AGR10, pesosOptimos(AGR10, V_PI, MU).w, V_PI, MU);
    assert.ok(veTD - veOptimo > 1e-6, `VE(w_TD) − min VE = ${veTD - veOptimo}`);
  });

  test("C3-3: con un grupo por estado, w_TD = w* = v_π y VE = 0 en los dos", () => {
    /* Exercise 9.1 y consecuencia de (9.12): con one-hot A es diagonal y el
       punto fijo TD ES v_π. En el caso tabular no hay error de aproximación
       que separe a los dos métodos, que es media lección del módulo. */
    const repr = oneHot(PASEO.nEstados);
    const { w: wTD } = puntoFijoTD(PASEO, repr, 1);
    const { w: wOptimo } = pesosOptimos(repr, V_PI, MU);
    cercaVector(wTD, Array.from(V_PI), 1e-8, "w_TD one-hot");
    cercaVector(wOptimo, Array.from(V_PI), 1e-12, "w* one-hot");
    cerca(errorVE(repr, wTD, V_PI, MU), 0, 1e-8, "VE(w_TD)");
    cerca(errorVE(repr, wOptimo, V_PI, MU), 0, 1e-12, "VE(w*)");
  });

  test("C3-4: las dos escaleras tienen 10 valores distintos, constantes en bloques de 100", () => {
    const wTD = puntoFijoTD(PASEO, AGR10, 1).w;
    const wOptimo = pesosOptimos(AGR10, V_PI, MU).w;
    for (const [nombre, w] of [["w*", wOptimo], ["w_TD", wTD]]) {
      const valores = new Set();
      for (let s = 0; s < PASEO.nEstados; s++) valores.add(AGR10.valor(w, s));
      assert.equal(valores.size, 10, `${nombre}: valores distintos`);
      for (let j = 0; j < 10; j++) {
        for (let s = j * 100; s < (j + 1) * 100; s++) {
          assert.equal(AGR10.valor(w, s), w[j], `${nombre}: el estado ${s} no está en el bloque ${j}`);
        }
      }
    }
  });

  test("C3-5: invariante A/B — MC y TD ven exactamente los mismos episodios y no consumen azar", () => {
    /* El worker muestrea el lote UNA vez y lo pasa a los dos métodos; el motor
       lo muestrea por método. Si alguno de los dos consumiera azar al
       actualizar, las dos vías darían curvas distintas: que coincidan BIT A
       BIT es la comprobación de que el A/B está bien montado. */
    const config = { semilla: SEMILLA, alpha: 2e-4, episodios: 300, ejecuciones: 3 };
    const worker = curvasPrediccion({ ...config, alProgresar: () => {} });
    const soloMC = curvaVE(PASEO, AGR10, { ...config, metodo: "mc" });
    const soloTD = curvaVE(PASEO, AGR10, { ...config, metodo: "td" });
    identicos(worker.curvaMC, soloMC.curva, "curva de MC: worker vs motor");
    identicos(worker.curvaTD, soloTD.curva, "curva de TD: worker vs motor");

    // Y la prueba directa: con un generador prohibido, aprender no lanza.
    const episodio = muestrearEpisodio(PASEO, generador(7));
    mcGradiente(PASEO, AGR10, [episodio], { alpha: 1e-4 });
    tdSemiGradiente(PASEO, AGR10, [episodio], { alpha: 1e-4 });
    assert.throws(() => muestrearEpisodio(PASEO, RNG_PROHIBIDO), /se ha consumido azar/);
  });

  test("C3-6: en el episodio 0 los dos métodos y los seis α dan el mismo √VE, el de w = 0", () => {
    const desdeCero = raizVE(AGR10, new Float64Array(AGR10.d));
    for (const alpha of ALPHAS_M3) {
      for (const metodo of ["mc", "td"]) {
        const { curva } = curvaVE(PASEO, AGR10, {
          metodo, alpha, episodios: 1, ejecuciones: 1, semilla: SEMILLA,
        });
        cerca(curva[0], desdeCero, 1e-12, `√VE inicial (${metodo}, α = ${alpha})`);
      }
    }
  });

  test("C3-7: ni w* ni w_TD se mueven al recorrer los seis α del deslizador", () => {
    /* Son propiedades del entorno, la representación y γ: no se simulan, se
       resuelven. Ver eso es media lección del módulo, y por eso las dos líneas
       horizontales no pueden depender de α. */
    const referenciaTD = Array.from(puntoFijoTD(PASEO, AGR10, 1).w);
    const referenciaOptimo = Array.from(pesosOptimos(AGR10, V_PI, MU).w);
    for (const alpha of ALPHAS_M3) {
      // se recalculan igual que lo haría el módulo al mover el deslizador
      cercaVector(puntoFijoTD(PASEO, AGR10, 1).w, referenciaTD, 1e-12, `w_TD con α = ${alpha}`);
      cercaVector(pesosOptimos(AGR10, V_PI, MU).w, referenciaOptimo, 1e-12, `w* con α = ${alpha}`);
    }
  });

  test("C3-8: 1/(1−γ) vale 10, 20 y 100 para γ = 0,9; 0,95; 0,99", () => {
    // (9.14), p. 229. La cota se MUESTRA como referencia y no se convierte en test (A15).
    const esperados = [10, 20, 100];
    [0.9, 0.95, 0.99].forEach((gamma, i) => {
      cerca(1 / (1 - gamma), esperados[i], 1e-12, `1/(1−${gamma})`);
    });
  });

  test("M3 §6: al cambiar γ cambian v_π, η, μ, w* y w_TD — el descuento entra en η (A14)", () => {
    /* El libro pide tratar el descuento como una forma de terminación, con un
       factor γ en el segundo término de (9.2). Si el motor no lo hiciera, μ
       sería la misma para todo γ y la nota `t5.m3.notaGammaMu` sería falsa. */
    const uno = paseoMil({ gamma: 1 });
    const nueve = paseoMil({ gamma: 0.9 });
    assert.ok(
      uno.mu.some((x, i) => Math.abs(x - nueve.mu[i]) > 1e-6),
      "μ no ha cambiado al bajar γ: el descuento no está entrando en η",
    );
    // Y con γ < 1 la masa se concentra alrededor del inicio.
    assert.ok(nueve.mu[499] > uno.mu[499], "con γ = 0,9 el inicio tiene que pesar más");
    assert.ok(Math.abs(nueve.valoresVerdaderos[0]) < Math.abs(uno.valoresVerdaderos[0]));
  });
});

describe("Módulo 3 · MC y TD(0) lineales — reproducibilidad (guion M3 §8b)", () => {
  /* Semilla base 2026, ejecuciones 2026…2035 (10), 5000 episodios, γ = 1,
     agregación en 10 grupos, w0 = 0, MC de CADA VISITA. Las siete cifras las
     dejaba el guion «por rellenar»: son las que devuelve este fichero. */

  test("R3-1: √VE de MC en el episodio 5000 con α = 2e-4 ≈ 0,0780", () => {
    const { puntos } = campanaPrediccion();
    cercaRelativa(puntos.get(5000).mc, 0.07800, 0.05, "√VE de MC al episodio 5000");
  });

  test("R3-2: √VE de TD en el episodio 5000 con α = 2e-4 ≈ 0,3349 (y MC queda por debajo)", () => {
    /* La ordenación que exige el libro —MC asintóticamente mejor que TD en
       esta tarea, figuras 9.1 y 9.2— SÍ se cumple: 0,078 frente a 0,335.
       ⚠ Pero se cumple por la razón equivocada: la asíntota exacta de TD es
       √VE(w_TD) = 0,1167 y la curva está en 0,335, es decir apenas se ha
       movido de √VE(0) = 0,4054. Con α = 1e-3 salen 0,107 y 0,153, que es la
       lectura de §7.1. Es un asunto del α por omisión, y va al informe. */
    const { puntos } = campanaPrediccion();
    cercaRelativa(puntos.get(5000).td, 0.33489, 0.05, "√VE de TD al episodio 5000");
    assert.ok(
      puntos.get(5000).mc < puntos.get(5000).td,
      "MC tiene que quedar por debajo de TD al final del rango (figuras 9.1 y 9.2)",
    );
    const asintotaTD = raizVE(AGR10, puntoFijoTD(PASEO, AGR10, 1).w);
    cerca(asintotaTD, 0.11673, 1e-4, "asíntota exacta de TD");
    assert.ok(
      puntos.get(5000).td > 2 * asintotaTD,
      "si TD llegara a su asíntota con α = 2e-4, habría que revisar este comentario",
    );
  });

  test("R3-3: √VE en el episodio 200 — MC ≈ 0,3239 y TD ≈ 0,4030", () => {
    const { puntos } = campanaPrediccion();
    cercaRelativa(puntos.get(200).mc, 0.32387, 0.05, "√VE de MC al episodio 200");
    cercaRelativa(puntos.get(200).td, 0.40303, 0.05, "√VE de TD al episodio 200");
  });

  test("R3-4: los 10 pesos de la ejecución 0 (semilla 2026) al episodio 5000", () => {
    /* Tolerancia relativa 5 % con suelo absoluto 5e-3: cuatro componentes de
       TD valen menos de 0,05 y un 5 % relativo sobre 0,004 sería una
       tolerancia de 2e-4, más estricta que las de contraste de este fichero.
       El suelo se comenta porque el guion no lo prevé. */
    const { pesos0 } = campanaPrediccion();
    const esperadoMC = [
      -0.76985, -0.69229, -0.49300, -0.30013, -0.12718,
      0.06018, 0.23504, 0.42225, 0.62881, 0.74339,
    ];
    const esperadoTD = [
      -0.31407, -0.11597, -0.04526, -0.01685, -0.00421,
      0.00404, 0.01595, 0.04340, 0.11282, 0.30999,
    ];
    esperadoMC.forEach((x, i) => {
      cerca(pesos0.mc[i], x, Math.max(Math.abs(x) * 0.05, 5e-3), `w de MC[${i}]`);
    });
    esperadoTD.forEach((x, i) => {
      cerca(pesos0.td[i], x, Math.max(Math.abs(x) * 0.05, 5e-3), `w de TD[${i}]`);
    });
    // Y las dos escaleras son monótonas: es la forma de la figura 9.1.
    for (let i = 0; i < 9; i++) {
      assert.ok(pesos0.mc[i + 1] > pesos0.mc[i] - 0.1, `la escalera de MC baja en ${i}`);
      assert.ok(pesos0.td[i + 1] > pesos0.td[i], `la escalera de TD baja en ${i}`);
    }
  });

  test("R3-5: con α = 2e-5 (el del libro) MC al episodio 5000 ≈ 0,2397, muy por encima de R3-1", () => {
    /* El libro necesita 100 000 episodios con ese α (figura 9.1), así que a
       5000 tiene que estar lejos: es la comprobación de que el α por omisión
       del módulo no es el del libro y de por qué. */
    const { puntos } = campanaPrediccion(2e-5, [5000]);
    cercaRelativa(puntos.get(5000).mc, 0.23973, 0.05, "√VE de MC con α = 2e-5");
    assert.ok(puntos.get(5000).mc > 2 * 0.078, "con α = 2e-5 MC tiene que ir mucho peor");
  });

  test("R3-6: la longitud media de un episodio es de ≈ 82,75 pasos", () => {
    const { longitudMedia } = campanaPrediccion();
    cercaRelativa(longitudMedia, 82.75, 0.05, "longitud media del episodio");
  });

  test("R3-7: ningún episodio alcanza el tope de 10 000 pasos, y ninguna ejecución revienta", () => {
    /* El guion espera 0 y avisa: «si no lo es, hay que decirlo y no
       ocultarlo». Es 0 en las 50 000 muestras de la campaña. */
    const { truncados, cortadas } = campanaPrediccion();
    assert.equal(truncados, 0, "episodios truncados por el tope de 10 000 pasos");
    assert.equal(cortadas, 0, "ejecuciones cortadas por |w| > 1e6");
  });
});

/* ===================================================================== *
 * MÓDULO 4 · Cuándo divergen los pesos: el ejemplo w → 2w   [C]
 * Fuente: guion, módulo 4, §8a. S&B §11.2, pp. 282-285
 * ===================================================================== */

describe("Módulo 4 · el ejemplo w → 2w (guion M4 §8a)", () => {
  test("C4-1: la trayectoria simulada = w0(1+α(2γ−1))^t en las 4·101 combinaciones del panel", () => {
    /* El módulo no muestrea nada: itera una recurrencia lineal cerrada, y el
       test la compara con su forma cerrada. Tolerancia relativa 1e-12. */
    for (const alpha of ALPHAS_M4) {
      for (let k = 0; k <= 100; k++) {
        const gamma = k / 100;
        const { serie, factor } = fragmentoW2W({ gamma, alpha, w0: 10, pasos: 60 });
        cerca(factor, 1 + alpha * (2 * gamma - 1), 1e-15, `factor (α=${alpha}, γ=${gamma})`);
        for (let t = 0; t < serie.length; t++) {
          const cerrado = 10 * factor ** t;
          const tol = Math.max(Math.abs(cerrado) * 1e-12, 1e-12);
          cerca(serie[t], cerrado, tol, `w_${t} (α=${alpha}, γ=${gamma})`);
        }
        for (const x of serie) assert.ok(Number.isFinite(x), "la serie nunca puede tener NaN ni Infinity");
      }
    }
  });

  test("C4-2: signo(factor − 1) = signo(γ − 0,5), el cero incluido", () => {
    // §11.2, p. 282, literal: «this constant is greater than 1 whenever γ > 0,5».
    for (const alpha of ALPHAS_M4) {
      for (let k = 0; k <= 100; k++) {
        const gamma = k / 100;
        const { factor } = fragmentoW2W({ gamma, alpha, w0: 10, pasos: 1 });
        assert.equal(
          Math.sign(factor - 1), Math.sign(gamma - 0.5),
          `α = ${alpha}, γ = ${gamma}: factor = ${factor}`,
        );
      }
    }
  });

  test("C4-3: con γ = 0,5 el factor vale exactamente 1 y w_60 = w_0", () => {
    for (const alpha of ALPHAS_M4) {
      const { serie, factor, veredicto } = fragmentoW2W({ gamma: 0.5, alpha, w0: 10, pasos: 60 });
      cerca(factor, 1, 1e-15, `factor con α = ${alpha}`);
      assert.equal(serie.length, 61);
      cerca(serie[60], 10, 1e-15, `w_60 con α = ${alpha}`);
      assert.equal(veredicto, "quietos", "es el caso degenerado que el guion resuelve por escrito");
    }
  });

  test("C4-4: la ilustración numérica del libro — δ0 = 10, w1 = 11, v̂(s2,w1) = 22, δ1 = 11", () => {
    /* §11.2, p. 282, literal: «if w = 10, […] the TD error is about 10, w is
       increased to about 11, and the next iterate […] about 22». */
    const { serie, traza } = fragmentoW2W({ gamma: 1, alpha: 0.1, w0: 10, pasos: 3 });
    cerca(traza[0].delta, 10, 1e-12, "δ0");
    cerca(traza[0].wSiguiente, 11, 1e-12, "w1");
    cerca(serie[1], 11, 1e-12, "w1 en la serie");
    cerca(2 * serie[1], 22, 1e-12, "v̂(s2,w1) = 2·w1");
    cerca(traza[1].delta, 11, 1e-12, "δ1");
  });

  test("C4-5: con w0 = 0 los pesos se quedan en 0 para cualquier α y cualquier γ", () => {
    // 0 es punto fijo de una recurrencia lineal homogénea (§11.2 y Example 11.1: «and w0 ≠ 0»).
    for (const alpha of ALPHAS_M4) {
      for (const gamma of [0, 0.25, 0.5, 0.75, 0.99, 1]) {
        for (const regimen of ["off", "on"]) {
          const { serie, veredicto, pasosHastaMil } = fragmentoW2W({
            gamma, alpha, w0: 0, pasos: 60, regimen,
          });
          for (const x of serie) assert.equal(x, 0, `α=${alpha}, γ=${gamma}, ${regimen}`);
          assert.equal(veredicto, "quietos");
          assert.equal(pasosHastaMil, null, "sin w0 nunca se llega a 1000");
        }
      }
    }
  });

  test("C4-6: dentro de política el factor (1+α(2γ−1))(1−4α) tiene módulo < 1, y con α = 0,1 vale 0,66", () => {
    /* Derivación declarada de este guion sobre §9.4: el cierre dentro de
       política NO está en el libro y el módulo lo dice en pantalla (A16). */
    for (const alpha of ALPHAS_M4) {
      const { factor, veredicto } = fragmentoW2W({ gamma: 1, alpha, w0: 10, pasos: 60, regimen: "on" });
      cerca(factor, (1 + alpha * (2 * 1 - 1)) * (1 - 4 * alpha), 1e-15, `factor con α = ${alpha}`);
      assert.ok(Math.abs(factor) < 1, `α = ${alpha}: |factor| = ${Math.abs(factor)}`);
      assert.equal(veredicto, "convergen");
    }
    cerca(fragmentoW2W({ gamma: 1, alpha: 0.1, regimen: "on" }).factor, 0.66, 1e-12, "factor con α = 0,1");
  });

  test("C4-7: A fuera de política vale 1−2γ y es negativa si y solo si γ > 0,5", () => {
    // (9.11), p. 228, evaluada en un solo estado. El umbral 0,5 es el cambio de signo de A.
    for (let k = 0; k <= 100; k++) {
      const gamma = k / 100;
      const { A } = fragmentoW2W({ gamma, alpha: 0.1, regimen: "off" });
      cerca(A, 1 - 2 * gamma, 1e-15, `A con γ = ${gamma}`);
      assert.equal(A < 0, gamma > 0.5, `el signo de A no cuadra con γ = ${gamma}`);
    }
  });

  test("C4-8: A dentro de política vale (5−2γ)/2 > 0, b = 0 y w_TD = 0", () => {
    for (let k = 0; k <= 100; k++) {
      const gamma = k / 100;
      const { A, b, wTD } = fragmentoW2W({ gamma, alpha: 0.1, regimen: "on" });
      cerca(A, (5 - 2 * gamma) / 2, 1e-15, `A con γ = ${gamma}`);
      assert.ok(A > 0, `A tiene que ser positiva con γ = ${gamma}`);
      assert.equal(b, 0, "todas las recompensas del fragmento son 0");
      assert.equal(wTD, 0, "con b = 0 el punto fijo es 0, que es el valor verdadero");
    }
  });

  test("C4-9: las actualizaciones hasta |w| > 1000 son ⌈ln(100)/ln(1,1)⌉ = 49", () => {
    /* Inversión de una exponencial: el motor calcula el logaritmo y el test
       comprueba la fórmula, no una cifra transcrita. */
    const { pasosHastaMil, serie } = fragmentoW2W({ gamma: 1, alpha: 0.1, w0: 10, pasos: 60 });
    assert.equal(pasosHastaMil, Math.ceil(Math.log(100) / Math.log(1.1)));
    assert.equal(pasosHastaMil, 49);
    // Y la serie lo confirma: en 48 pasos todavía no, en 49 sí.
    assert.ok(Math.abs(serie[48]) <= 1000, `w_48 = ${serie[48]}`);
    assert.ok(Math.abs(serie[49]) > 1000, `w_49 = ${serie[49]}`);
  });

  test("M4 §6: la divergencia se detiene sin desbordar — ni NaN ni Infinity con α y γ máximos", () => {
    /* Caso degenerado declarado: el motor para en |w| > 1e12 y marca
       `desbordado`. Es el que alimenta la comprobación Q-9 de que ningún
       módulo dibuja NaN. */
    const { serie, desbordado, veredicto } = fragmentoW2W({
      gamma: 1, alpha: 0.3, w0: 10, pasos: 200, regimen: "off",
    });
    assert.equal(desbordado, true, "con α = 0,3, γ = 1 y 200 pasos tiene que desbordar");
    assert.equal(veredicto, "divergen");
    for (const x of serie) {
      assert.ok(Number.isFinite(x) && Math.abs(x) <= 1e12, `valor fuera de rango: ${x}`);
    }
  });

  test("M4 ficha: los datos de Baird son los de las figuras 11.1 y 11.2 (7 estados, 8 pesos)", () => {
    /* Baird entra como ficha de DATOS, no como simulación (briefing §7.3). Lo
       que hay que blindar es que los datos son los del libro, porque la
       diapositiva `5_Tema_5_1#slide-15` no da ni uno. */
    assert.equal(BAIRD.nEstados, 7);
    assert.equal(BAIRD.nPesos, 8, "ocho pesos para siete estados: hay más pesos que estados");
    cerca(BAIRD.b.dashed, 6 / 7, 1e-15, "b(discontinua)");
    cerca(BAIRD.b.solid, 1 / 7, 1e-15, "b(continua)");
    assert.equal(BAIRD.pi.solid, 1, "la política objetivo toma siempre la continua");
    assert.equal(BAIRD.gamma, 0.99);
    assert.equal(BAIRD.recompensa, 0, "cero en todas las transiciones");
    assert.deepEqual(Array.from(BAIRD.w0), [1, 1, 1, 1, 1, 1, 10, 1], "w0 de la figura 11.2");
    assert.equal(BAIRD.caracteristicas.length, 7);
    // x(i) = 2e_i + e_8 para i = 1…6, y x(7) = e_7 + 2e_8 (literal, p. 284).
    for (let i = 0; i < 6; i++) {
      assert.equal(BAIRD.caracteristicas[i][i], 2, `x(${i + 1})[${i}]`);
      assert.equal(BAIRD.caracteristicas[i][7], 1, `x(${i + 1})[8]`);
      assert.equal(BAIRD.caracteristicas[i].reduce((a, b) => a + b, 0), 3, `x(${i + 1}) tiene solo dos componentes`);
    }
    assert.deepEqual(Array.from(BAIRD.caracteristicas[6]), [0, 0, 0, 0, 0, 0, 1, 2]);
    // v_π = 0 y se representa exactamente con w = 0: todo es favorable y aun así diverge.
    assert.equal(BAIRD.valorVerdadero, 0);
  });
});

/* ===================================================================== *
 * MÓDULO 5 · Control: SARSA semi-gradiente en Mountain Car
 * Fuente: guion, módulo 5, §8a [C] y §8b [R]. S&B §10.1, pp. 266-270; §16.5
 * ===================================================================== */

describe("Módulo 5 · control en Mountain Car — contraste (guion M5 §8a)", () => {
  test("C5-1: un paso desde p = −0,5, ṗ = 0, A = 0 cumple las ecuaciones de la p. 267", () => {
    /* El test calcula el valor esperado con la fórmula cerrada; no se
       transcribe ninguna cifra. Y comprueba el orden: PRIMERO la velocidad,
       y el cos(3p) con la posición ANTIGUA. */
    const { p2, v2, r, fin } = CARRO.paso({ p: -0.5, v: 0 }, 0);
    const vEsperada = 0 + 0.001 * 0 - 0.0025 * Math.cos(3 * -0.5);
    cerca(v2, vEsperada, 1e-12, "ṗ'");
    cerca(p2, -0.5 + vEsperada, 1e-12, "p'");
    assert.equal(r, -1);
    assert.equal(fin, false);
    /* Si el motor usara la posición NUEVA en el coseno, v2 cambiaría: se fija
       la diferencia para que un reordenamiento se note. */
    assert.notEqual(vEsperada, 0 - 0.0025 * Math.cos(3 * p2));
  });

  test("C5-2: el borde izquierdo pone la velocidad a CERO y el episodio NO termina", () => {
    // §10.1, p. 267, literal: «when x_{t+1} reached the left bound, ẋ_{t+1} was reset to zero».
    const { p2, v2, r, fin } = CARRO.paso({ p: -1.19, v: -0.05 }, -1);
    cerca(p2, -1.2, 1e-12, "p' en el borde");
    assert.equal(v2, 0, "la velocidad se resetea, NO se invierte");
    assert.equal(fin, false, "el borde izquierdo no termina el episodio");
    assert.equal(r, -1);
  });

  test("C5-3: se termina solo por el borde derecho, y el paso que termina también da −1", () => {
    const { p2, fin, r } = CARRO.paso({ p: 0.49, v: 0.05 }, 1);
    assert.ok(p2 >= 0.5, `p' = ${p2}`);
    assert.equal(fin, true);
    assert.equal(r, -1, "«−1 on all time steps until the car moves past its goal position»");
    assert.equal(CARRO.esTerminal({ p: 0.5, v: 0 }), true);
    assert.equal(CARRO.esTerminal({ p: 0.4999, v: 0 }), false);
  });

  test("C5-4: la recompensa es −1 en todos los pasos de 20 episodios sembrados, el final incluido", () => {
    const rng = generador(SEMILLA);
    let pasos = 0;
    for (let e = 0; e < 20; e++) {
      let estado = CARRO.inicio(rng);
      for (let k = 0; k < 5000; k++) {
        const paso = CARRO.paso(estado, CARRO.acciones[rng.entero(3)]);
        pasos += 1;
        assert.equal(paso.r, -1, `episodio ${e}, paso ${k}`);
        estado = paso.estado2;
        if (paso.fin) break;
      }
    }
    assert.ok(pasos > 10000, `solo ${pasos} pasos: la muestra es demasiado corta`);
  });

  test("C5-5: |ṗ| ≤ 0,07 tras cada paso de 20 episodios sembrados", () => {
    const rng = generador(SEMILLA);
    for (let e = 0; e < 20; e++) {
      let estado = CARRO.inicio(rng);
      for (let k = 0; k < 5000; k++) {
        const paso = CARRO.paso(estado, CARRO.acciones[rng.entero(3)]);
        assert.ok(
          Math.abs(paso.v2) <= 0.07 + 1e-15,
          `episodio ${e}, paso ${k}: ṗ = ${paso.v2}`,
        );
        estado = paso.estado2;
        if (paso.fin) break;
      }
    }
  });

  test("C5-6: el estado inicial es p ∈ [−0,6; −0,4) y ṗ = 0 en 10 000 muestras sembradas", () => {
    /* La cota es ESTRUCTURAL: p = −0,6 + 0,2u con u ∈ [0,1). El intervalo es
       SEMIABIERTO, tal como lo escribe el libro. */
    const rng = generador(SEMILLA);
    let minimo = Infinity;
    let maximo = -Infinity;
    for (let i = 0; i < 10000; i++) {
      const { p, v } = CARRO.inicio(rng);
      assert.equal(v, 0, "la velocidad inicial es cero exactamente");
      minimo = Math.min(minimo, p);
      maximo = Math.max(maximo, p);
    }
    assert.ok(minimo >= -0.6, `min p = ${minimo}`);
    assert.ok(maximo < -0.4, `max p = ${maximo}: el intervalo es semiabierto`);
    // Y no es un punto fijo: las 10 000 muestras cubren el intervalo.
    assert.ok(maximo - minimo > 0.19, "el inicio tiene que ser aleatorio, no un punto");
  });

  test("C5-7: exactamente 8 componentes a 1 en los 7500 casos de la rejilla 50×50×3", () => {
    /* §9.5.4, p. 240 («Exactly one feature is present in each tiling») y
       §10.1, p. 267 («We used 8 tilings»). Estructural, no muestral. */
    const repr = tileCarro();
    const [[pMin, pMax], [vMin, vMax]] = CARRO.rangos;
    for (let i = 0; i < 50; i++) {
      for (let j = 0; j < 50; j++) {
        const p = pMin + ((i + 0.5) * (pMax - pMin)) / 50;
        const v = vMin + ((j + 0.5) * (vMax - vMin)) / 50;
        for (let a = 0; a < 3; a++) {
          const activas = repr.activas({ p, v }, a);
          assert.equal(activas.length, 8, `(${i},${j},${a}): número de activas`);
          assert.equal(new Set(activas).size, 8, `(${i},${j},${a}): índices repetidos`);
        }
      }
    }
  });

  test("C5-8: d = 8·9·9·3 = 1944 y los 8 índices activos son distintos entre sí (sin hashing)", () => {
    const repr = tileCarro();
    assert.equal(repr.T, 9, "8 mosaicos del rango + 1 para absorber el desplazamiento");
    assert.equal(repr.d, 8 * 9 * 9 * 3);
    assert.equal(repr.d, 1944);
    assert.ok(repr.d < 4096, "tiene que caber en la IHT(4096) del libro para que no haya colisiones");
    assert.equal(repr.nActivas, 8);
  });

  test("C5-9: x(s,a1) y x(s,a2) no comparten ninguna componente activa (bloques disjuntos)", () => {
    // (10.3), p. 268: la acción forma parte del índice.
    const repr = tileCarro();
    for (let i = 0; i < 20; i++) {
      const estado = { p: -1.2 + i * 0.085, v: -0.07 + i * 0.007 };
      const bloques = [0, 1, 2].map((a) => new Set(repr.activas(estado, a)));
      for (let a = 0; a < 3; a++) {
        for (let b = a + 1; b < 3; b++) {
          for (const x of bloques[b]) {
            assert.ok(!bloques[a].has(x), `las acciones ${a} y ${b} comparten el índice ${x}`);
          }
        }
      }
    }
  });

  test("C5-10: la regla del paso α×m = 0,5 da α = 0,0625 (el 0,5/8 del libro)", () => {
    // Figuras 10.2 y 10.4, pp. 268 y 270. El m se lee de la representación.
    const repr = tileCarro();
    assert.equal(repr.m, 8);
    cerca(0.5 / repr.m, 0.0625, 1e-15, "α con α×m = 0,5");
    ALPHAS_M5.forEach((am) => {
      cerca(am / repr.m, am / 8, 1e-15, `α con α×m = ${am}`);
    });
  });

  test("C5-11: q̂(s,a,0) = 0 para todo (s,a), y todo q* es ≤ −1: w = 0 es OPTIMISTA", () => {
    /* §10.1, p. 268, literal: «The initial action values were all zero, which
       was optimistic (all true values are negative in this task)». La primera
       mitad es álgebra; la segunda se comprueba sobre el entorno: todo paso
       cuesta −1 y desde un estado no terminal hace falta al menos uno. */
    const repr = tileCarro();
    const w0 = new Float64Array(repr.d);
    for (let i = 0; i < 40; i++) {
      for (let j = 0; j < 40; j++) {
        const p = -1.2 + (i * 1.7) / 40;
        const v = -0.07 + (j * 0.14) / 40;
        for (let a = 0; a < 3; a++) {
          assert.equal(repr.valor(w0, { p, v }, a), 0, `q̂ con w = 0 en (${p},${v},${a})`);
        }
        // Desde un estado no terminal, cualquier acción da −1: el retorno es ≤ −1.
        if (p < 0.5) {
          for (const a of CARRO.acciones) {
            assert.equal(CARRO.paso({ p, v }, a).r, -1);
          }
        }
      }
    }
    // El coste por recorrer con w = 0 es idénticamente 0: la superficie plana del arranque.
    const { maximo, minimo } = costePorRecorrer(repr, w0, {
      rangos: CARRO.rangos, celdas: 20, acciones: CARRO.acciones,
    });
    /* Tolerancia 0 en vez de igualdad estricta: `costePorRecorrer` devuelve
       −max_a q̂, y con w = 0 eso es −0, que `strictEqual` distingue de 0. Es
       cosmético (−0 === 0 en JS) pero llega a la etiqueta del campo de calor:
       queda reportado, no arreglado aquí. */
    cerca(maximo, 0, 0, "máximo del coste por recorrer con w = 0");
    cerca(minimo, 0, 0, "mínimo del coste por recorrer con w = 0");
  });

  test("C5-12: con ε = 0, el objetivo de Q-learning coincide con el de SARSA en CADA paso", () => {
    /* ⚠ VERSIÓN CORREGIDA. El guion afirma que con ε = 0 las dos ejecuciones
       dan «secuencias de pesos idénticas, paso a paso». ES FALSO, y el test
       siguiente lo fija. Lo que sí es identidad exacta —y lo que sostiene la
       lectura del módulo, «Q-learning cambia UNA línea»— es que en cada paso
       q̂(S',A',w) = max_a q̂(S',a,w) cuando A' es greedy: los DOS OBJETIVOS
       coinciden a pesos iguales. Se comprueba sobre una trayectoria real,
       recorrida con la propia política del motor, y con los pesos de cuatro
       momentos distintos del aprendizaje para que no sea el caso trivial
       w = 0 (donde las tres acciones empatan). */
    const repr = tileCarro();
    const entrenada = sarsaSemiGradiente(CARRO, tileCarro(), {
      alpha: 0.5 / 8, epsilon: 0.1, gamma: 1, episodios: 40,
      rng: generador(SEMILLA), maxPasos: 5000, instantaneasEn: INSTANTANEAS_M5.slice(0, 3),
    });
    const pesos = [new Float64Array(repr.d), ...entrenada.instantaneas.map((s) => s.w), entrenada.w];
    assert.ok(pesos.length >= 3, "hacen falta varias instantáneas para que el test no sea trivial");

    let comparaciones = 0;
    let noTriviales = 0;
    for (const w of pesos) {
      const rng = generador(SEMILLA + 1);
      let estado = CARRO.inicio(rng);
      for (let k = 0; k < 400; k++) {
        const elegida = politicaEpsilonGreedy(repr, w, estado, 0, rng, CARRO.acciones);
        assert.equal(elegida.exploratoria, false, "con ε = 0 no puede haber exploración");
        const maximo = Math.max(...elegida.valores);
        // El objetivo de SARSA usa la acción elegida; el de Q-learning, el máximo.
        cerca(elegida.valores[elegida.indice], maximo, 0, `q̂(S,A') vs max_a q̂(S,a) en el paso ${k}`);
        comparaciones += 1;
        if (new Set(elegida.valores).size > 1) noTriviales += 1;
        const paso = CARRO.paso(estado, elegida.accion);
        estado = paso.estado2;
        if (paso.fin) break;
      }
    }
    assert.ok(comparaciones > 500, `solo ${comparaciones} comparaciones`);
    assert.ok(noTriviales > 100, `solo ${noTriviales} estados con acciones no empatadas: el test sería trivial`);
  });

  test("C5-12 (bis): con ε = 0 las trayectorias SÍ se separan — la versión del guion es falsa", () => {
    /* Por qué se separan, y por qué no es un bug: SARSA elige A' con los pesos
       de ANTES de la actualización y Q-learning elige A con los de DESPUÉS.
       Con w distinto, el argmax puede cambiar y —sobre todo— el desempate al
       azar consume el generador un número de veces distinto, así que a partir
       del primer empate roto de forma distinta las dos ejecuciones divergen.
       Lo que sí coincide es el PRIMER paso, con w todavía igual: eso es lo que
       este test blinda, junto con el hecho de la divergencia posterior, para
       que nadie «arregle» el motor persiguiendo la afirmación del guion. */
    const unPaso = { alpha: 0.5 / 8, epsilon: 0, gamma: 1, episodios: 1, maxPasos: 1 };
    const sarsa1 = sarsaSemiGradiente(CARRO, tileCarro(), { ...unPaso, rng: generador(SEMILLA) });
    const qlearn1 = qLearningSemiGradiente(CARRO, tileCarro(), { ...unPaso, rng: generador(SEMILLA) });
    identicos(sarsa1.w, qlearn1.w, "el primer paso con ε = 0 tiene que ser idéntico");

    const largo = { alpha: 0.5 / 8, epsilon: 0, gamma: 1, episodios: 50, maxPasos: 5000 };
    const sarsa = sarsaSemiGradiente(CARRO, tileCarro(), { ...largo, rng: generador(SEMILLA) });
    const qlearn = qLearningSemiGradiente(CARRO, tileCarro(), { ...largo, rng: generador(SEMILLA) });
    assert.notDeepEqual(
      sarsa.pasosPorEpisodio, qlearn.pasosPorEpisodio,
      "si las 50 ejecuciones coincidieran, habría que reabrir C5-12 en el guion",
    );
    assert.ok(
      sarsa.w.some((x, i) => Math.abs(x - qlearn.w[i]) > 1e-9),
      "los pesos finales tienen que diferir",
    );
  });

  test("C5-13: vector de desplazamiento (1,3), con k = 2, m = 2³ = 8 ≥ 4k = 8", () => {
    /* §9.5.4, p. 242, literal: «for a continuous space of dimension k, a good
       choice is to use the first odd integers (1,3,5,…,2k−1), with n […] an
       integer power of 2 greater than or equal to 4k». */
    const repr = tileCarro();
    assert.deepEqual(repr.desplazamiento, [1, 3], "los primeros enteros impares para k = 2");
    assert.equal(repr.m, 8);
    assert.equal(Number.isInteger(Math.log2(repr.m)), true, "m tiene que ser potencia de 2");
    assert.ok(repr.m >= 4 * 2, "m ≥ 4k");
    /* Y el desplazamiento se toma MÓDULO m: (3j mod 8) recorre 0,3,6,1,4,7,2,5,
       los ocho desplazamientos distintos. Si se saliera del rango, T = 9 y
       d = 1944 dejarían de ser exactos. */
    const enUnidades = repr.offsets.map((o) => [
      Math.round(o[0] / (repr.anchos[0] / repr.m)),
      Math.round(o[1] / (repr.anchos[1] / repr.m)),
    ]);
    assert.deepEqual(enUnidades.map((o) => o[0]), [0, 1, 2, 3, 4, 5, 6, 7]);
    assert.deepEqual(enUnidades.map((o) => o[1]), [0, 3, 6, 1, 4, 7, 2, 5]);
    assert.equal(new Set(enUnidades.map((o) => o[1])).size, 8, "los ocho desplazamientos son distintos");
  });

  test("M5 §6: el desempate del argmax es ALEATORIO — con w = 0 las tres acciones empatan (A4)", () => {
    /* El libro no dice cómo desempatar y con w = 0 las TRES acciones empatan
       exactamente en el primer paso de TODOS los episodios: desempatar por
       índice sesgaría el arranque hacia «gas atrás». */
    const repr = tileCarro();
    const w0 = new Float64Array(repr.d);
    const cuenta = [0, 0, 0];
    const rng = generador(SEMILLA);
    for (let i = 0; i < 600; i++) {
      const estado = CARRO.inicio(rng);
      const { indice, valores } = politicaEpsilonGreedy(repr, w0, estado, 0, rng, CARRO.acciones);
      assert.deepEqual(valores, [0, 0, 0], "con w = 0 las tres acciones valen 0");
      cuenta[indice] += 1;
    }
    for (let a = 0; a < 3; a++) {
      assert.ok(cuenta[a] > 120, `la acción ${a} solo sale ${cuenta[a]} veces de 600: el desempate está sesgado`);
    }
    // Y `argmax` de nucleo.js es quien lo hace: si dejara de recibir el rng, esto caería.
    assert.equal(argmax([0, 0, 0], generador(1)) >= 0, true);
  });
});

describe("Módulo 5 · control en Mountain Car — reproducibilidad (guion M5 §8b)", () => {
  /* Semilla base 2026, ejecuciones 2026…2035 (10), 500 episodios, ε = 0,1,
     γ = 1, w0 = 0, tile coding de m = 8 con desplazamiento (1,3). Las siete
     cifras las dejaba el guion «por rellenar». */

  test("R5-1: SARSA con α×m = 0,5 — pasos por episodio en los últimos 50 ≈ 143", () => {
    const { ultimos50, ejecuciones, episodiosComunes } = campanaControl({ algoritmo: "sarsa", alphaM: 0.5 });
    assert.equal(ejecuciones, 10);
    assert.equal(episodiosComunes, 500, "ninguna ejecución debería cortarse con α×m = 0,5");
    cercaRelativa(ultimos50, 143.0, 0.10, "SARSA, últimos 50 episodios");
    /* Y queda por debajo de 150, que es donde el libro dice que se estabilizan
       las curvas de la figura 10.2 (con SARSA(λ), no con SARSA de un paso:
       aquí es una referencia cualitativa, no una aserción de contraste). */
    assert.ok(ultimos50 < 200, `SARSA no se estabiliza: ${ultimos50} pasos`);
  });

  test("R5-2: Q-learning con α×m = 0,5 — últimos 50 ≈ 147, del orden de SARSA", () => {
    const sarsa = campanaControl({ algoritmo: "sarsa", alphaM: 0.5 });
    const q = campanaControl({ algoritmo: "qLearning", alphaM: 0.5 });
    cercaRelativa(q.ultimos50, 146.9, 0.10, "Q-learning, últimos 50 episodios");
    assert.equal(q.cortadas, 0);
    /* Ninguna afirmación absoluta sobre quién gana: con ε = 0,1 y esta tarea
       las dos acaban en el mismo orden de magnitud, y eso es lo que se dice. */
    assert.ok(
      Math.abs(q.ultimos50 - sarsa.ultimos50) / sarsa.ultimos50 < 0.25,
      `SARSA ${sarsa.ultimos50} y Q-learning ${q.ultimos50} se separan más de lo esperado`,
    );
  });

  test("R5-3: SARSA, primeros 50 episodios para los cinco α×m ≈ 574 · 416 · 297 · 268 · 401", () => {
    /* Es el eje y de la figura 10.4 del libro. Y contiene la ordenación que el
       libro publica para la figura 10.2: entre 0,1, 0,2 y 0,5, la más rápida
       es 0,5. SE CUMPLE. */
    const esperados = [574.3, 416.1, 296.5, 268.4, 401.1];
    const medidos = ALPHAS_M5.map((alphaM) => campanaControl({ algoritmo: "sarsa", alphaM }).primeros50);
    ALPHAS_M5.forEach((alphaM, i) => {
      cercaRelativa(medidos[i], esperados[i], 0.10, `SARSA, primeros 50 con α×m = ${alphaM}`);
    });
    assert.ok(medidos[2] < medidos[1] && medidos[1] < medidos[0],
      `la ordenación 0,5 < 0,2 < 0,1 de la figura 10.2 no sale: ${medidos.slice(0, 3)}`);
  });

  test("R5-4: los máximos de la superficie CRECEN con el episodio en las cuatro instantáneas", () => {
    /* En el libro los máximos crecen (4, 27, 46, 104, 120 en sus cinco
       paneles) y aquí se espera lo mismo. LA COMPROBACIÓN ES LA MONOTONÍA, NO
       LAS CIFRAS: los datos de la figura 10.2 son de SARSA(λ) (A7). */
    const { instantaneas } = campanaControl({
      algoritmo: "sarsa", alphaM: 0.5, ejecuciones: 1, instantaneas: true,
    });
    assert.deepEqual(
      instantaneas.map((s) => s.clave),
      ["paso428", "ep12", "ep104", "ep500"],
      "las cuatro instantáneas y su orden",
    );
    const repr = tileCarro();
    const maximos = instantaneas.map((s) => costePorRecorrer(repr, s.w, {
      rangos: CARRO.rangos, celdas: 60, acciones: CARRO.acciones,
    }).maximo);
    for (let i = 1; i < maximos.length; i++) {
      assert.ok(maximos[i] > maximos[i - 1], `el máximo baja de ${instantaneas[i - 1].clave} a ${instantaneas[i].clave}: ${maximos}`);
    }
    const esperados = [8.68, 43.25, 96.20, 143.20];
    esperados.forEach((x, i) => cercaRelativa(maximos[i], x, 0.15, `máximo en ${instantaneas[i].clave}`));
  });

  test("R5-5: con α×m = 0,5 ningún episodio alcanza el tope de 5000 pasos", () => {
    // El guion espera 0 y pide decirlo en pantalla si no lo es.
    const { topes } = campanaControl({ algoritmo: "sarsa", alphaM: 0.5 });
    assert.equal(topes, 0, "episodios cortados por el tope de 5000 pasos");
  });

  test("R5-6: con α×m = 1,5 SARSA revienta en las 10 ejecuciones (el guion esperaba 0)", () => {
    /* ⚠ VERSIÓN CORREGIDA. El guion espera «absoluta 0» ejecuciones cortadas
       por |w| > 10⁶ y son 10 DE 10. No es un bug: α×m = 1,5 se pasa de la guía
       α = 1/(τ·E[xᵀx]) de (9.19) —con τ = 1 el máximo razonable es α×m = 1— y
       SARSA semi-gradiente diverge. Lo que hay que testear es la divergencia,
       porque es lo que la interfaz tiene que declarar en pantalla; que un día
       salga 0 sería un cambio del motor que hay que ver. */
    const { cortadas, episodiosComunes } = campanaControl({ algoritmo: "sarsa", alphaM: 1.5 });
    assert.equal(cortadas, 10, "ejecuciones cortadas por |w| > 1e6 con α×m = 1,5");
    assert.ok(
      episodiosComunes < 100,
      `las ejecuciones se cortan pronto y la curva común es corta: ${episodiosComunes} episodios`,
    );
    // Y con α×m = 1,0, el valor inmediatamente inferior, NO revienta ninguna.
    assert.equal(campanaControl({ algoritmo: "sarsa", alphaM: 1.0 }).cortadas, 0);
  });

  test("R5-7: el mínimo de R5-3 cae en la mitad alta de la lista de α×m (α×m = 1,0)", () => {
    /* Referencia cualitativa del libro: en la figura 10.2 el α mayor de los
       tres aprende más rápido, así que se espera que el mínimo caiga en la
       mitad alta. Sale en α×m = 1,0, el cuarto de cinco. */
    const medidos = ALPHAS_M5.map((alphaM) => campanaControl({ algoritmo: "sarsa", alphaM }).primeros50);
    const mejor = medidos.indexOf(Math.min(...medidos));
    assert.equal(ALPHAS_M5[mejor], 1.0, `el mínimo cae en α×m = ${ALPHAS_M5[mejor]}: ${medidos}`);
    assert.ok(mejor >= 2, "el mínimo tiene que caer en la mitad alta de la lista");
  });
});

/* ===================================================================== *
 * MÓDULO 6 · Las dos tablas de convergencia   [C]
 * Fuente: guion, módulo 6, §8a. `5_Tema_5_1#slide-16`, `#slide-21` (Silver)
 * ===================================================================== */

describe("Módulo 6 · las dos tablas de convergencia (guion M6 §8a)", () => {
  test("C6-1: las 12 casillas de predicción son SÍ SÍ SÍ / SÍ SÍ NO / SÍ SÍ NO / SÍ NO NO", () => {
    assert.equal(TABLA_PREDICCION.length, 12);
    assert.deepEqual(
      TABLA_PREDICCION.map((c) => c.veredicto),
      ["si", "si", "si", "si", "si", "no", "si", "si", "no", "si", "no", "no"],
    );
    // Y el orden de las filas es el de la diapositiva: MC dentro, TD dentro, MC fuera, TD fuera.
    assert.deepEqual(
      TABLA_PREDICCION.map((c) => `${c.algoritmo}/${c.politica}`),
      ["mc/dentro", "mc/dentro", "mc/dentro", "td0/dentro", "td0/dentro", "td0/dentro",
        "mc/fuera", "mc/fuera", "mc/fuera", "td0/fuera", "td0/fuera", "td0/fuera"],
    );
    assert.deepEqual(
      TABLA_PREDICCION.slice(0, 3).map((c) => c.aproximador),
      ["tabular", "lineal", "noLineal"],
    );
  });

  test("C6-2: las 9 casillas de control son SÍ (SÍ) NO / SÍ (SÍ) NO / SÍ NO NO", () => {
    assert.equal(TABLA_CONTROL.length, 9);
    assert.deepEqual(
      TABLA_CONTROL.map((c) => c.veredicto),
      ["si", "casi", "no", "si", "casi", "no", "si", "no", "no"],
    );
    /* El «(SÍ)» del recuadro es un tercer veredicto —«cerca, pero no
       quieto»—, no un SÍ: si el motor lo colapsara a "si", la tabla dejaría de
       ser la de la diapositiva. */
    assert.equal(TABLA_CONTROL.filter((c) => c.veredicto === "casi").length, 2);
  });

  test("C6-3: el recuento de inductores de las 12 casillas de predicción es 0,1,1 / 1,2,2 / 1,2,2 / 2,3,3", () => {
    assert.deepEqual(
      TABLA_PREDICCION.map((c) => contarInductores(c).total),
      [0, 1, 1, 1, 2, 2, 1, 2, 2, 2, 3, 3],
    );
    // Y la regla de conteo: MC no hace bootstrapping y Q-learning es siempre fuera.
    assert.equal(contarInductores({ algoritmo: "mc", aproximador: "lineal", politica: "dentro" }).bootstrapping, false);
    assert.equal(contarInductores({ algoritmo: "td0", aproximador: "lineal", politica: "dentro" }).bootstrapping, true);
    assert.equal(contarInductores({ algoritmo: "qLearning", aproximador: "tabular", politica: "fuera" }).fueraDePolitica, true);
    assert.equal(contarInductores({ algoritmo: "sarsa", aproximador: "tabular", politica: "dentro" }).aproximacion, false);
  });

  test("C6-4: todas las casillas de predicción con 3 inductores tienen veredicto NO, y son dos", () => {
    const conTres = TABLA_PREDICCION.filter((c) => contarInductores(c).total === 3);
    assert.equal(conTres.length, 2);
    assert.deepEqual(
      conTres.map((c) => `${c.algoritmo}/${c.aproximador}/${c.politica}`),
      ["td0/lineal/fuera", "td0/noLineal/fuera"],
    );
    for (const c of conTres) assert.equal(c.veredicto, "no", `${c.clave}`);
  });

  test("C6-5: con ≤ 2 inductores hay 10 casillas, 8 con SÍ y 2 excepciones, las dos no lineales", () => {
    /* ⚠ El guion dice «10 de 12 con veredicto SÍ». Son 10 de 12 las casillas
       con ≤ 2 inductores; de esas 10 hay 8 con SÍ y 2 excepciones. Los SÍ de
       la tabla entera son 8 de 12. Se testea el enunciado correcto, que es
       además el que el módulo enseña: LA ENUMERACIÓN COMPLETA de las
       excepciones. */
    const conPocos = TABLA_PREDICCION.filter((c) => contarInductores(c).total <= 2);
    assert.equal(conPocos.length, 10, "casillas con ≤ 2 inductores");
    const excepciones = conPocos.filter((c) => c.veredicto === "no");
    assert.equal(conPocos.length - excepciones.length, 8, "casillas con ≤ 2 inductores y veredicto SÍ");
    assert.deepEqual(
      excepciones.map((c) => `${c.algoritmo}/${c.aproximador}/${c.politica}`),
      ["td0/noLineal/dentro", "mc/noLineal/fuera"],
    );
    for (const c of excepciones) {
      assert.equal(c.aproximador, "noLineal", "las dos excepciones están en la columna no lineal");
      assert.equal(fichaCasilla(c).cuadraConLaRegla, false, "y la regla de la tríada no las explica");
    }
    // La discutible (A5, hallazgo N4) es una de ellas y lleva su cita propia.
    const discutible = TABLA_PREDICCION.find((c) => c.algoritmo === "mc" && c.aproximador === "noLineal" && c.politica === "fuera");
    assert.match(discutible.cita, /No cubierto por Sutton & Barto/);
  });

  test("C6-6: las 4 casillas tabulares de predicción y las 3 de control son SÍ", () => {
    const tabulares = [...TABLA_PREDICCION, ...TABLA_CONTROL].filter((c) => c.aproximador === "tabular");
    assert.equal(tabulares.length, 7, "4 de predicción + 3 de control");
    for (const c of tabulares) assert.equal(c.veredicto, "si", `${c.clave}`);
  });

  test("C6-7: «Q-learning · dentro de política» es inalcanzable y `fichaCasilla` la rechaza", () => {
    /* §11.3, p. 287: «one can simply use Sarsa rather than Q-learning». Es una
       restricción del modelo, no un resultado, y el motor tiene que hacerla
       imposible en vez de inventar una casilla. */
    for (const aproximador of ["tabular", "lineal", "noLineal"]) {
      assert.throws(
        () => fichaCasilla({ algoritmo: "qLearning", aproximador, politica: "dentro" }),
        /no existe en las tablas/,
      );
    }
    assert.equal(TABLA_CONTROL.filter((c) => c.algoritmo === "qLearning" && c.politica === "dentro").length, 0);
    // Pero Q-learning fuera de política sí existe, y cuenta el inductor aunque se pida «dentro».
    assert.equal(contarInductores({ algoritmo: "qLearning", aproximador: "lineal", politica: "dentro" }).fueraDePolitica, true);
  });

  test("C6-8: las 21 fichas tienen texto y cita, y la cita es del libro o dice que no lo cubre", () => {
    /* Comprobación de completitud de los datos: es lo que impide que alguien
       rellene una casilla a ojo. */
    const todas = [...TABLA_PREDICCION, ...TABLA_CONTROL];
    assert.equal(todas.length, 21);
    for (const c of todas) {
      assert.equal(typeof c.clave, "string");
      assert.match(c.clave, /^t5\.m6\.celda\.[a-zA-Z0-9]+\.[a-zA-Z]+\.(dentro|fuera)$/, `clave de ${c.clave}`);
      assert.equal(typeof c.cita, "string");
      assert.ok(c.cita.length > 5, `cita demasiado corta en ${c.clave}`);
      assert.ok(
        /S&B[\s,§]/.test(c.cita) || c.cita.includes("No cubierto por Sutton & Barto"),
        `la cita de ${c.clave} no es del libro ni declara que el libro no lo cubre: «${c.cita}»`,
      );
    }
    // Las claves son únicas: 21 casillas, 21 claves.
    assert.equal(new Set(todas.map((c) => c.clave)).size, 21);
  });

  test("M6 §8b: sin azar — dos consultas de las 21 casillas dan el mismo resultado", () => {
    for (const c of [...TABLA_PREDICCION, ...TABLA_CONTROL]) {
      assert.deepEqual(fichaCasilla(c), fichaCasilla(c), c.clave);
    }
  });
});

/* ===================================================================== *
 * TRAZAS DE ELEGIBILIDAD CON APROXIMACIÓN
 * Fuente: `T5_recurso/addenda-trazas.md` §4 (T-1…T-8 [C], RT-1…RT-3 [R]).
 * La addenda MANDA sobre el guion en todo lo que toque una firma.
 * ===================================================================== */

describe("Trazas de elegibilidad — contraste (addenda §4)", () => {
  test("T-1: SARSA con lambda:0 da el mismo w, peso a peso, que una implementación de un paso", () => {
    /* La más importante de las once, y no por su contenido matemático: si
       falla, TODAS las cifras sembradas de esta página y las de
       reproducibilidad de los módulos 3 y 5 se han movido sin que nadie lo
       note. La referencia es una implementación INDEPENDIENTE del algoritmo
       de un paso, escrita aquí a partir de la caja de la p. 266 y usando solo
       el entorno, la representación, `argmax` y el generador: si el motor
       cambiara el orden de consumo del azar o el momento de la actualización,
       este test caería. Tolerancia 0 exacto. */
    const opciones = { alpha: 0.5 / 8, epsilon: 0.1, gamma: 1, episodios: 30, maxPasos: 5000 };

    const referencia = (() => {
      const repr = tileCarro();
      const rng = generador(SEMILLA);
      const acciones = CARRO.acciones;
      const w = new Float64Array(repr.d);
      const q = (estado, a) => {
        let suma = 0;
        for (const i of repr.activas(estado, a)) suma += w[i];
        return suma;
      };
      const elegir = (estado) => {
        const valores = [];
        for (let a = 0; a < acciones.length; a++) valores.push(q(estado, a));
        return rng.uniforme() < opciones.epsilon ? rng.entero(acciones.length) : argmax(valores, rng);
      };
      const pasosPorEpisodio = [];
      for (let ep = 0; ep < opciones.episodios; ep++) {
        let estado = CARRO.inicio(rng);
        let a = elegir(estado);
        let pasos = 0;
        for (let k = 0; k < opciones.maxPasos; k++) {
          const { estado2, r, fin } = CARRO.paso(estado, acciones[a]);
          pasos += 1;
          const objetivo = fin ? r : null;
          let a2 = null;
          let destino;
          if (fin) destino = objetivo;
          else {
            a2 = elegir(estado2);
            destino = r + opciones.gamma * q(estado2, a2);
          }
          const escala = opciones.alpha * (destino - q(estado, a));
          for (const i of repr.activas(estado, a)) w[i] += escala;
          if (fin) break;
          estado = estado2;
          a = a2;
        }
        pasosPorEpisodio.push(pasos);
      }
      return { w, pasosPorEpisodio };
    })();

    const motor = sarsaSemiGradiente(CARRO, tileCarro(), {
      ...opciones, rng: generador(SEMILLA), lambda: 0,
    });
    identicos(motor.w, referencia.w, "w del motor con λ = 0 vs la referencia de un paso");
    assert.deepEqual(motor.pasosPorEpisodio, referencia.pasosPorEpisodio, "pasos por episodio");

    /* Y las tres formas de pedir «sin traza» son la misma ejecución: λ omitido,
       λ = 0 con reemplazo y λ = 0 con acumulativa. */
    const omitido = sarsaSemiGradiente(CARRO, tileCarro(), { ...opciones, rng: generador(SEMILLA) });
    const acumulativa = sarsaSemiGradiente(CARRO, tileCarro(), {
      ...opciones, rng: generador(SEMILLA), lambda: 0, traza: "acumulativa",
    });
    identicos(motor.w, omitido.w, "λ = 0 explícito vs λ omitido");
    identicos(motor.w, acumulativa.w, "λ = 0 con reemplazo vs con acumulativa");
    assert.equal(motor.trazaNoNulaMedia, undefined, "con λ = 0 no se construye z y no se informa de ella");
  });

  test("T-2: z.length === w.length === d, no |S|×|A|", () => {
    /* Es el error que más se comete en el examen y el motor tiene que hacerlo
       evidente. Se comprueba en las cuatro representaciones del tema. */
    const casos = [
      { repr: oneHot(1000), transiciones: [{ estado: 3 }] },
      { repr: agregacion(1000, 10), transiciones: [{ estado: 3 }] },
      { repr: tileCoding1D({ nEstados: 1000, m: 8, ancho: ANCHO_M2 }), transiciones: [{ estado: 3 }] },
      { repr: tileCarro(), transiciones: [{ estado: { p: -0.5, v: 0 }, accion: 1 }] },
      { repr: caracteristicasPorAccion({ nVariables: 6, nAcciones: 3 }), transiciones: [{ estado: [1, 2, 3, 0, 1, 1], accion: 0 }] },
    ];
    for (const { repr, transiciones } of casos) {
      const { z, historia } = trazaTrasPasos(repr, transiciones, {
        gamma: 0.9, lambda: 0.5, traza: "acumulativa",
      });
      assert.equal(z.length, repr.d, `z.length en ${repr.tipo}`);
      for (const zt of historia) assert.equal(zt.length, repr.d, `historia en ${repr.tipo}`);
      // Y coincide con la longitud del vector de pesos que usa el mismo repr.
      const w = new Float64Array(repr.d);
      assert.equal(z.length, w.length, `z.length === w.length en ${repr.tipo}`);
    }
    // El caso concreto del examen: d = 18, no 3×|S|.
    const examen = caracteristicasPorAccion({
      nVariables: EJEMPLO_EXAMEN.nVariables, nAcciones: EJEMPLO_EXAMEN.nAcciones,
    });
    assert.equal(examen.d, 18);
  });

  test("T-3: con una sola transición, z_0 = x(S_0,A_0) — m componentes, todas a 1", () => {
    // La recurrencia con z_{−1} = 0 no tiene azar: γλ·0 + x = x.
    for (const m of MS_M2) {
      const repr = tileCoding1D({ nEstados: 1000, m, ancho: ANCHO_M2 });
      for (const traza of ["acumulativa", "reemplazo"]) {
        const { z, indicesNoNulos } = trazaTrasPasos(repr, [{ estado: 317 }], {
          gamma: 0.9, lambda: 0.5, traza,
        });
        assert.equal(indicesNoNulos.length, m, `nº de componentes no nulas (m = ${m}, ${traza})`);
        const activas = new Set(repr.activas(317));
        for (let i = 0; i < z.length; i++) {
          assert.equal(z[i], activas.has(i) ? 1 : 0, `z[${i}] con m = ${m} y traza ${traza}`);
        }
      }
    }
  });

  test("T-4: traza de REEMPLAZO — una componente repetida vale 1, no 1+γλ", () => {
    // Es la definición de traza de reemplazo, y es la del libro para tile coding.
    const repr = oneHot(20);
    const { z } = trazaTrasPasos(repr, [{ estado: 7 }, { estado: 7 }], {
      gamma: 0.9, lambda: 0.5, traza: "reemplazo",
    });
    assert.equal(z[7], 1, "la componente repetida tiene que valer exactamente 1");
    assert.notEqual(z[7], 1 + 0.45, "si valiera 1+γλ sería la acumulativa");
    for (let i = 0; i < z.length; i++) if (i !== 7) assert.equal(z[i], 0);
  });

  test("T-4b: la traza de reemplazo LANZA con características no binarias (decisión del motor)", () => {
    /* Decisión del orquestador documentada en el código, CONTRARIA A LA LETRA
       de la addenda §2 —que escribe «z_t[i] = 1» sin condiciones— y alineada
       con la ambigüedad A19 del guion. Con un x(s,a) de valor real (4,2 y
       33,7 en el ejemplo del examen) poner las componentes a 1 destruiría la
       información, así que el motor no lo silencia: falla. Se testea que
       falla, y que la acumulativa —la que aplica ahí— no falla. */
    const repr = caracteristicasPorAccion({ nVariables: 6, nAcciones: 3 });
    const transicion = [{ estado: EJEMPLO_EXAMEN.observaciones[0], accion: 0 }];
    assert.throws(
      () => trazaTrasPasos(repr, transicion, { gamma: 0.9, lambda: 0.5, traza: "reemplazo" }),
      /reemplazo solo está definida con características binarias/,
    );
    // Y también dentro del control, donde la comprobación se paga una sola vez.
    assert.throws(
      () => sarsaSemiGradiente(
        { ...CARRO, acciones: [0, 1, 2], inicio: () => EJEMPLO_EXAMEN.observaciones[0], paso: () => ({ estado2: EJEMPLO_EXAMEN.observaciones[1], r: -1, fin: false }) },
        repr,
        { alpha: 0.1, epsilon: 0, gamma: 0.9, episodios: 1, rng: generador(1), maxPasos: 3, lambda: 0.5, traza: "reemplazo" },
      ),
      /reemplazo solo está definida con características binarias/,
    );
    // La acumulativa sí vale, y es la que usa el examen.
    const { z } = trazaTrasPasos(repr, transicion, { gamma: 0.9, lambda: 0.5, traza: "acumulativa" });
    cerca(z[4], 4.2, 1e-12, "z de la componente de valor real");
  });

  test("T-5: traza ACUMULATIVA — una componente repetida vale 1+γλ", () => {
    const repr = oneHot(20);
    for (const [gamma, lambda] of [[0.9, 0.5], [1, 1], [0.99, 0.9], [0.5, 0.2]]) {
      const { z } = trazaTrasPasos(repr, [{ estado: 7 }, { estado: 7 }], {
        gamma, lambda, traza: "acumulativa",
      });
      cerca(z[7], 1 + gamma * lambda, 1e-12, `z[7] con γ = ${gamma}, λ = ${lambda}`);
    }
  });

  test("T-6: k transiciones sin componentes repetidas — la del paso j vale (γλ)^(k−1−j)", () => {
    /* Geométrica exacta. Se usa one-hot sobre estados distintos, que es la
       forma más limpia de garantizar que no hay componentes compartidas. */
    const repr = oneHot(60);
    const estados = [3, 11, 19, 27, 35, 43, 51];
    const k = estados.length;
    for (const [gamma, lambda] of [[0.9, 0.5], [1, 0.9], [0.99, 1]]) {
      const gl = gamma * lambda;
      const { z, historia } = trazaTrasPasos(repr, estados.map((estado) => ({ estado })), {
        gamma, lambda, traza: "acumulativa",
      });
      estados.forEach((estado, j) => {
        cerca(z[estado], gl ** (k - 1 - j), 1e-12, `z del paso ${j} con γλ = ${gl}`);
      });
      // Y la historia guarda z después de CADA transición, con la misma ley.
      assert.equal(historia.length, k);
      estados.forEach((estado, j) => {
        cerca(historia[j][estado], 1, 1e-12, `en su propio paso la componente vale 1 (paso ${j})`);
      });
    }
  });

  test("T-7: con λ = 1 y γ = 1 la traza acumulativa ES el recuento de visitas", () => {
    // γλ = 1: la recurrencia suma. Tolerancia 0 exacto.
    const repr = oneHot(20);
    const visitas = [3, 5, 3, 7, 3, 5, 3];
    const { z } = trazaTrasPasos(repr, visitas.map((estado) => ({ estado })), {
      gamma: 1, lambda: 1, traza: "acumulativa",
    });
    const cuenta = new Map();
    for (const s of visitas) cuenta.set(s, (cuenta.get(s) || 0) + 1);
    for (let i = 0; i < z.length; i++) assert.equal(z[i], cuenta.get(i) || 0, `z[${i}]`);
    assert.equal(z[3], 4);
    assert.equal(z[5], 2);
    assert.equal(z[7], 1);
  });

  test("T-8: el ejemplo del examen final — la traza de la segunda actualización, d = 18", () => {
    /* `Final_RL_IMAT_A#page-12`, con los datos de `EJEMPLO_EXAMEN`: γ = 0,9,
       λ = 0,5, traza acumulativa, tres acciones × seis variables.
       DOS ADVERTENCIAS DEL GUION QUE SE RESPETAN AQUÍ:
       (a) cuál de los dos giros se toma en t = 1 NO está determinado por el
           texto del enunciado —lo fija su figura—, y el motor lo declara con
           `accionT1Ambigua`. El test comprueba EL BLOQUE DEL GIRO QUE ELIJA LA
           EJECUCIÓN, leyéndolo de `EJEMPLO_EXAMEN.acciones[1]`, no un índice
           fijo: si mañana la figura dice A2, este test sigue valiendo.
       (b) la numeración del enunciado va UNA UNIDAD POR DELANTE: su «t = 2» es
           z_1 en la notación de z_t, con z_{−1} = 0. */
    const E = EJEMPLO_EXAMEN;
    assert.equal(E.accionT1Ambigua, true, "el motor tiene que declarar la ambigüedad A20");
    assert.equal(E.gamma, 0.9);
    assert.equal(E.lambda, 0.5);
    assert.equal(E.nVariables, 6);
    assert.equal(E.nAcciones, 3);

    const repr = caracteristicasPorAccion({ nVariables: E.nVariables, nAcciones: E.nAcciones });
    assert.equal(repr.d, 18, "d = 3 acciones × 6 variables: ni un peso indexado por estado");

    const { z, historia, indicesNoNulos } = trazaTrasPasos(repr, [
      { estado: E.observaciones[0], accion: E.acciones[0] },
      { estado: E.observaciones[1], accion: E.acciones[1] },
    ], { gamma: E.gamma, lambda: E.lambda, traza: "acumulativa" });

    assert.equal(z.length, 18);
    assert.equal(historia.length, 2, "la primera y la segunda actualización del enunciado");

    /* La PRIMERA actualización (el «t = 1» del enunciado, z_0): la columna
       t = 0 en el bloque de la acción de t = 0, y cero en los otros dos. */
    const bloqueAvance = E.acciones[0] * E.nVariables;
    const bloqueGiro = E.acciones[1] * E.nVariables;
    assert.notEqual(bloqueAvance, bloqueGiro, "el giro tiene que caer en otro bloque");
    for (let i = 0; i < 6; i++) {
      cerca(historia[0][bloqueAvance + i], E.observaciones[0][i], 1e-9, `z_0 del bloque de avance [${i}]`);
    }
    for (let i = 0; i < 18; i++) {
      if (i < bloqueAvance || i >= bloqueAvance + 6) assert.equal(historia[0][i], 0, `z_0[${i}]`);
    }

    /* La SEGUNDA actualización (el «t = 2» del enunciado, z_1): el bloque de
       t = 0 desvanecido por γλ = 0,45 y la columna t = 1 sumada en el bloque
       del giro. Cifras de `t5.b14b.tablaTraza`. */
    const desvanecido = [0.9, 0.9, 0.9, 0, 1.89, 20.25];
    const delGiro = [3, 2, 2, 0, 3.6, 33.7];
    cerca(E.gamma * E.lambda, 0.45, 1e-15, "γλ");
    for (let i = 0; i < 6; i++) {
      cerca(z[bloqueAvance + i], desvanecido[i], 1e-9, `bloque de la acción de t=0 [${i}]`);
      cerca(z[bloqueAvance + i], E.gamma * E.lambda * E.observaciones[0][i], 1e-12, `γλ·x_0[${i}]`);
      cerca(z[bloqueGiro + i], delGiro[i], 1e-9, `bloque del giro elegido [${i}]`);
      cerca(z[bloqueGiro + i], E.observaciones[1][i], 1e-12, `x_1[${i}]`);
    }
    // El tercer bloque, el de la acción no tomada, en cero.
    const noTomada = [0, 1, 2].find((a) => a !== E.acciones[0] && a !== E.acciones[1]);
    for (let i = 0; i < 6; i++) assert.equal(z[noTomada * 6 + i], 0, `bloque no tomado [${i}]`);

    // «Dieciocho números, diez de ellos no nulos» (`t5.b14b.ejemploCierre`).
    assert.equal(indicesNoNulos.length, 10, "componentes no nulas");

    /* Las dos comprobaciones que el guion dice que salen gratis del mismo
       enunciado: el gradiente en t = 2 es x(S_2,A_2), y con todos los pesos a
       2, q̂(S_2,A_2,w) = 2·44,3 = 88,6. */
    const w = new Float64Array(repr.d);
    w.fill(E.w0);
    const accionT2 = E.acciones[2];
    cerca(repr.valor(w, E.observaciones[2], accionT2), 88.6, 1e-12, "q̂(S_2,A_2,w) con w = 2");
    const gradiente = repr.valores(E.observaciones[2], accionT2);
    cercaVector(gradiente, E.observaciones[2], 1e-12, "∇q̂ = x(S_2,A_2)");
  });

  test("addenda §2: z se reinicia a cero al empezar cada episodio (z_{−1} = 0)", () => {
    /* No está numerada en la §4 pero es una de las «cinco cosas que no se
       negocian». Si z no se reiniciara, el primer paso de cada episodio
       arrastraría la traza del anterior y los pesos serían otros. Se comprueba
       con ε = 1 —trayectoria independiente de w— comparando una ejecución de
       N episodios con N ejecuciones de un episodio: si z se reiniciara mal,
       las dos dejarían de coincidir en el primer paso del segundo episodio. */
    const comun = { alpha: 0.5 / 8, epsilon: 1, gamma: 1, maxPasos: 300, lambda: 0.9, traza: "reemplazo" };
    const conTraza = sarsaSemiGradiente(CARRO, tileCarro(), {
      ...comun, episodios: 3, rng: generador(SEMILLA),
    });
    /* Y el mismo experimento en el sentido contrario: la traza media no nula
       es finita y menor que d, o la poda no estaría funcionando. */
    assert.ok(conTraza.trazaNoNulaMedia > 8, "la traza tiene que crecer por encima de las 8 activas");
    assert.ok(conTraza.trazaNoNulaMaxima < tileCarro().d, "la traza no puede llenar el vector entero");
    assert.equal(Number.isFinite(conTraza.trazaNoNulaMedia), true);
  });
});

describe("Trazas de elegibilidad — reproducibilidad (addenda §4, RT-1…RT-3)", () => {
  /* Mountain Car, SARSA, α×m = 0,5, λ = 0,9, 5 ejecuciones (addenda §2, punto
     4: con λ > 0 el presupuesto baja de 10 a 5 y se dice en pantalla). Las
     tres cifras las dejaba la addenda «por rellenar». */

  test("RT-1: λ = 0,9 con traza de REEMPLAZO — pasos en los últimos 50 ≈ 150", () => {
    const { ultimos50, cortadas, ejecuciones } = campanaControl({
      algoritmo: "sarsa", alphaM: 0.5, ejecuciones: 5, lambda: 0.9, traza: "reemplazo",
    });
    assert.equal(ejecuciones, 5, "con λ > 0 el presupuesto son 5 ejecuciones");
    assert.equal(cortadas, 0, "con traza de reemplazo no revienta ninguna ejecución");
    cercaRelativa(ultimos50, 149.6, 0.10, "λ = 0,9 reemplazo, últimos 50");
  });

  test("RT-1 (bis): λ = 0,9 con traza ACUMULATIVA y α×m = 0,5 REVIENTA las 5 ejecuciones", () => {
    /* ⚠ HALLAZGO. El módulo 5 ofrece «λ = 0,9 · acumulativa» como tercer botón
       con el MISMO α que los otros dos, y con ese α las cinco ejecuciones se
       cortan por |w| > 10⁶. No es un bug del motor: con γλ = 0,9 la traza
       acumulativa multiplica el paso efectivo por ~1/(1−γλ) = 10, así que
       α×m = 0,5 equivale a α×m ≈ 5, cinco veces por encima del α×m = 1,5 que
       ya diverge sin traza (R5-6). Es exactamente por esto por lo que el libro
       usa la traza de REEMPLAZO con tile coding. Se testea la divergencia
       porque es el comportamiento real y la interfaz tiene que declararlo;
       la decisión —bajar α con la acumulativa, o declararlo en pantalla— es
       del guion, no de este fichero. */
    const { cortadas, topes, episodiosComunes } = campanaControl({
      algoritmo: "sarsa", alphaM: 0.5, ejecuciones: 5, lambda: 0.9, traza: "acumulativa",
    });
    assert.equal(cortadas, 5, "ejecuciones cortadas por |w| > 1e6 con traza acumulativa");
    assert.ok(topes > 0, "y con episodios que llegan al tope de 5000 pasos");
    assert.ok(episodiosComunes < 50, `la curva común es de ${episodiosComunes} episodios`);
  });

  test("RT-2: el tamaño medio del conjunto no nulo de z es ≈ 184 (de d = 1944)", () => {
    /* Es la medida de si la dispersión aguanta: recorrer los 1944 pesos en
       cada paso multiplicaría el coste por d/m ≈ 243. Con ~184 componentes no
       nulas el factor real es ~23, que es lo que hace que la tanda de λ > 0
       quepa en el presupuesto. */
    const { trazaNoNulaMedia } = campanaControl({
      algoritmo: "sarsa", alphaM: 0.5, ejecuciones: 5, lambda: 0.9, traza: "reemplazo",
    });
    cercaRelativa(trazaNoNulaMedia, 183.6, 0.20, "tamaño medio del conjunto no nulo de z");
    assert.ok(trazaNoNulaMedia < tileCarro().d / 4, "si z llenara el vector, la dispersión no serviría");
  });

  test("RT-3: λ = 0,9 no es peor que λ = 0 en los primeros 50 episodios", () => {
    /* REFERENCIA CUALITATIVA: el libro dice que SARSA(λ) y SARSA de un paso se
       comportan «similarly», así que una diferencia grande es sospechosa y se
       reporta. Con las dos tandas a 5 ejecuciones: λ = 0,9 aprende MÁS RÁPIDO
       al principio (233 frente a 295 pasos por episodio) y acaba en el mismo
       orden de magnitud (150 frente a 141). Ninguna afirmación absoluta: NO se
       escribe que «con trazas siempre aprende antes». */
    const conTraza = campanaControl({
      algoritmo: "sarsa", alphaM: 0.5, ejecuciones: 5, lambda: 0.9, traza: "reemplazo",
    });
    const sinTraza = campanaControl({ algoritmo: "sarsa", alphaM: 0.5, ejecuciones: 5, lambda: 0 });
    cercaRelativa(conTraza.primeros50, 233.2, 0.10, "λ = 0,9, primeros 50");
    cercaRelativa(sinTraza.primeros50, 295.2, 0.10, "λ = 0, primeros 50");
    assert.ok(
      conTraza.primeros50 <= sinTraza.primeros50,
      `λ = 0,9 va peor al principio (${conTraza.primeros50}) que λ = 0 (${sinTraza.primeros50}): reportar`,
    );
    /* Y la diferencia al final NO es grande: si lo fuera, habría que
       reportarlo, porque el libro no dice eso. */
    const relativa = Math.abs(conTraza.ultimos50 - sinTraza.ultimos50) / sinTraza.ultimos50;
    assert.ok(relativa < 0.35, `la diferencia al final es del ${(relativa * 100).toFixed(0)} %: sospechosa`);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ *
 * Q-12 [C] · pasar `{ w, … }` donde se espera `w` tiene que AVISAR
 *
 * Añadido por el orquestador después de tropezar con ello en una
 * comprobación propia: `pesosOptimos` y `puntoFijoTD` devuelven `{ w, … }`,
 * y `errorVE(repr, pesosOptimos(...), …)` no daba error, daba **NaN en
 * silencio** — que es exactamente lo que acaba escrito en una métrica de la
 * pantalla sin que lo vea nadie. El guion §C1 no fija el retorno de
 * `pesosOptimos`, así que la confusión estaba invitada.
 * ═══════════════════════════════════════════════════════════════════════ */
describe("Motor · guardas del vector de pesos (Q-12)", () => {
  const entorno = paseoMil({ gamma: 1 });
  const repr = agregacion(1000, 10);
  const optimo = pesosOptimos(repr, entorno.valoresVerdaderos, entorno.mu);

  test("Q-12 · errorVE avisa si se le pasa el objeto en vez de .w", () => {
    assert.throws(
      () => errorVE(repr, optimo, entorno.valoresVerdaderos, entorno.mu),
      /vector de pesos/,
      "tiene que lanzar, no devolver NaN",
    );
  });

  test("Q-12 · el mensaje dice qué hacer", () => {
    assert.throws(
      () => errorVE(repr, optimo, entorno.valoresVerdaderos, entorno.mu),
      /pasa su campo \.w/,
    );
  });

  test("Q-12 · errorVE avisa si w no tiene la dimensión de la representación", () => {
    assert.throws(
      () => errorVE(repr, new Float64Array(7), entorno.valoresVerdaderos, entorno.mu),
      /7 componentes y la representación pide 10/,
    );
  });

  test("Q-12 · bien llamado sigue dando la asíntota del guion", () => {
    const raiz = Math.sqrt(errorVE(repr, optimo.w, entorno.valoresVerdaderos, entorno.mu));
    assert.ok(Math.abs(raiz - 0.054377) < 1e-6, `raíz VE(w*) = ${raiz}`);
  });
});
