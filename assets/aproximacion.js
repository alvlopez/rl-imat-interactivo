/* ==========================================================================
   RL · IMAT — motor de aproximación de la función de valor (Tema 5)
   Sin dependencias del DOM. Módulo ES: se usa igual desde el navegador y
   desde `node --test`. NO TOCA EL DOM y ninguna de sus funciones llama al
   azar global del lenguaje: todo lo que consume azar recibe un `rng` de
   `generador(semilla)` de `nucleo.js`. (El nombre de esa función global no se
   escribe ni en los comentarios: el test T-1 del plan de QA busca la cadena
   en el fichero.)

   Por qué no cabe en ningún motor existente: `mdp.js`, `sinmodelo.js` y
   `npasos.js` representan los valores como ARRAYS INDEXADOS POR ESTADO. Aquí
   hay un VECTOR DE PESOS w y una función x(·) que convierte un estado —que
   puede ser continuo— en un vector de características. Ninguna firma de los
   motores anteriores admite ese cambio sin romperse, y el valor pedagógico del
   tema está justamente en esa diferencia. `bandits.js`, `mdp.js`, `dp.js`,
   `sinmodelo.js` y `npasos.js` NO se tocan: este fichero solo importa de
   `nucleo.js` (`generador`, `argmax`) y de `sinmodelo.js`
   (`promediarEjecuciones`).

   Diapositivas: 5_Tema_5_1#slide-1 a #slide-37 (MaterialAlvaro).
   Libro: Sutton & Barto, capítulos 9, 10 y 11; §16.5 para Q-learning
   semi-gradiente y DQN; capítulo 12 para las trazas (addenda del guion).

   ─────────────────────────────────────────────────────────────────────────
   SEIS DECISIONES QUE HAY QUE LEER ANTES DE TOCAR NADA

   1. EL ORDEN DE CONSUMO DEL `rng` ES CONTRATO.  Todas las cifras sembradas
      de `tema5.html` dependen de él. En control, por episodio y por paso el
      orden es EXACTAMENTE:
          inicio(rng)  →  [ε-greedy: 1 uniforme + (1 entero si explora)
                            + (1 entero si el argmax empata)]  →  paso (0)
          →  [ε-greedy del paso siguiente]  →  …
      La física de Mountain Car NO consume azar, la actualización de los pesos
      NO consume azar y LA TRAZA DE ELEGIBILIDAD NO CONSUME AZAR. Por eso
      `lambda: 0` reproduce bit a bit la ejecución del algoritmo de un paso
      (aserción T-1 de la addenda) y por eso con ε = 0 SARSA y Q-learning son
      la misma ejecución (aserción C5-12). Si alguien mueve una sola llamada
      al `rng`, cambian todas las cifras de las dos páginas.

   2. ÍNDICES DE ESTADO EN BASE 0.  El paseo de 1000 estados del Example 9.1
      ocupa los índices 0…999 (el «estado 500» del libro es el índice 499) y
      sus dos terminales viven FUERA: −1 por la izquierda y 1000 por la
      derecha. Las fórmulas del guion están escritas en base 1; la traducción
      está en un solo sitio (`paseoMil`) y se comenta allí.

   3. LOS ESTADOS TERMINALES VALEN 0 Y NO SE ACTUALIZAN NUNCA.  Ninguna
      representación ve jamás un estado terminal: los algoritmos comprueban
      `esTerminal` antes de llamar a `repr`. Es la trampa clásica del
      pseudocódigo de la p. 225 del libro.

   4. LAS REPRESENTACIONES SON BINARIAS SALVO UNA.  El interfaz común expone
      `activas(...)`, la lista de componentes a 1. `caracteristicasPorAccion`
      —la del problema del examen final— añade `valores(...)`: cuando existe,
      las componentes activas valen eso y no 1. Todo el motor pasa por
      `valoresDe()`, así que la extensión es transparente.

   5. UN EPISODIO TRUNCADO NO ES UN EPISODIO TERMINADO.  Todo corte por tope
      se marca en la salida (`truncado`, `topes`, `cortada`, `cortadaEn`) y
      nunca se silencia.

   6. LOS ÍNDICES DE ACCIÓN NO SON LOS IDENTIFICADORES DE ACCIÓN.  Las
      representaciones y las políticas trabajan con el ÍNDICE 0…|A|−1; el
      entorno recibe el IDENTIFICADOR (`entorno.acciones[indice]`, que en
      Mountain Car es −1, 0 o +1 porque entra en la física). Se traduce en un
      solo sitio, en los dos algoritmos de control.
   ========================================================================== */

import { argmax, generador } from "./nucleo.js";
import { promediarEjecuciones } from "./sinmodelo.js";

/** Tolerancia y tope de los barridos de programación dinámica (§0.3 del guion). */
const TOL_DP = 1e-12;
const MAX_BARRIDOS = 100000;

/** Umbral de poda del conjunto activo de la traza (addenda §2, punto 3). */
const PODA_TRAZA = 1e-8;

/** Los pesos por encima de esto se consideran reventados (M3 y M5, §6). */
const TOPE_PESOS = 1e6;

/* ----------------------------------------------------------------------- *
 * 0. Validación
 *
 * Se repiten aquí en vez de importarlas porque ni `sinmodelo.js` ni
 * `npasos.js` las exportan y no se tocan. Son cuatro líneas: menos deuda que
 * abrir su interfaz.
 * ----------------------------------------------------------------------- */

function validarFinito(x, nombre, fn) {
  if (!Number.isFinite(x)) {
    throw new Error(`${fn}: ${nombre} debe ser un número finito; recibido: ${x}`);
  }
}

function validarEnteroPositivo(x, nombre, fn) {
  if (!Number.isInteger(x) || x < 1) {
    throw new Error(`${fn}: ${nombre} debe ser un entero ≥ 1; recibido: ${x}`);
  }
}

function validarGamma(gamma, fn) {
  if (!Number.isFinite(gamma) || gamma < 0 || gamma > 1) {
    throw new Error(`${fn}: gamma debe estar en [0, 1]; recibido: ${gamma}`);
  }
}

function validarLambda(lambda, fn) {
  if (!Number.isFinite(lambda) || lambda < 0 || lambda > 1) {
    throw new Error(`${fn}: lambda debe estar en [0, 1]; recibido: ${lambda}`);
  }
}

function validarTraza(traza, fn) {
  if (traza !== "acumulativa" && traza !== "reemplazo") {
    throw new Error(`${fn}: traza debe ser "acumulativa" o "reemplazo"; recibido: ${traza}`);
  }
}

function validarRng(rng, fn) {
  if (!rng || typeof rng.uniforme !== "function" || typeof rng.entero !== "function") {
    throw new Error(`${fn}: hace falta un generador de nucleo.js (generador(semilla))`);
  }
}

/**
 * Un vector de pesos, no algo que lo contenga.
 *
 * Existe por un tropiezo real: `pesosOptimos` y `puntoFijoTD` devuelven
 * `{ w, ... }`, no el vector pelado, así que es fácil escribir
 * `errorVE(repr, pesosOptimos(...), ...)` en vez de `...pesosOptimos(...).w`.
 * Sin esta guarda eso no da error: da **NaN en silencio**, que acaba escrito
 * en una métrica de la pantalla y no lo detecta nadie.
 */
function validarPesos(w, repr, fn) {
  if (!w || typeof w.length !== "number") {
    const pista = w && typeof w === "object" && "w" in w
      ? ` — parece la salida de pesosOptimos/puntoFijoTD: pasa su campo .w`
      : "";
    throw new Error(`${fn}: w tiene que ser un vector de pesos${pista}`);
  }
  if (repr && w.length !== repr.d) {
    throw new Error(`${fn}: w tiene ${w.length} componentes y la representación pide ${repr.d}`);
  }
}

/* ----------------------------------------------------------------------- *
 * 1. Entornos
 *
 * Interfaz común de entorno con estado DISCRETO:
 *   { nEstados, inicio, gamma, paso(s, rng) -> {s2, r, fin}, esTerminal(s) }
 * y, si el modelo es conocido (lo necesita `matrizAb`):
 *   { transiciones(s) -> [{s2, p, r}] }
 *
 * Interfaz común de entorno con estado CONTINUO:
 *   { dimensiones, rangos, acciones, inicio(rng), paso(estado, a) -> {estado2, r, fin} }
 * ----------------------------------------------------------------------- */

/**
 * Sumas acumuladas de un vector: c[k] = Σ_{j<k} v[j], con c[0] = 0.
 *
 * Es lo que baja el coste de un barrido de programación dinámica sobre el
 * paseo de 1000 estados de O(|S|²) a O(|S|): la ventana de 200 vecinos se
 * resuelve con dos lecturas. PROHIBIDO quitarlo (§0.3 del guion: el módulo 1
 * tiene que responder al instante).
 *
 * @param {Float64Array} v Vector de entrada.
 * @returns {Float64Array} Vector de longitud v.length + 1.
 */
function sumasAcumuladas(v) {
  const c = new Float64Array(v.length + 1);
  for (let k = 0; k < v.length; k++) c[k + 1] = c[k] + v[k];
  return c;
}

/** Caché de v_π, η y μ del paseo de mil estados, por valor de γ. */
const CACHE_PASEO = new Map();
/** Cuántas veces se ha resuelto de verdad la programación dinámica (test T-4). */
let calculosPaseo = 0;

/**
 * Estadísticas de la caché del paseo de mil estados.
 *
 * Existe para que el test T-4 del plan de `ingeniero-qa` pueda comprobar que
 * una segunda llamada con el mismo γ NO vuelve a iterar.
 *
 * @returns {{entradas: number, calculos: number}} Número de valores de γ
 *   cacheados y número de resoluciones de la DP realizadas desde la carga.
 */
export function cachePaseoMil() {
  return { entradas: CACHE_PASEO.size, calculos: calculosPaseo };
}

/**
 * Resuelve v_π, η y μ del paseo de mil estados para un γ dado.
 *
 * v_π por evaluación iterativa de la política (S&B §4.1) en su forma de
 * Jacobi, y η por la recurrencia (9.2) del libro, las dos con sumas
 * acumuladas sobre la ventana de 200 vecinos. El descuento entra en las dos
 * recurrencias: el libro pide tratarlo como una forma de terminación
 * (nota de (9.2), p. 221; ambigüedad A14 del guion).
 *
 * @param {number} nEstados Número de estados no terminales.
 * @param {number} radio Anchura del salto a cada lado (100 en el Example 9.1).
 * @param {number} gamma Descuento.
 * @returns {{v: Float64Array, eta: Float64Array, mu: Float64Array, barridos: {v: number, eta: number}}}
 *   Valores verdaderos, visitas esperadas, distribución dentro de política y
 *   número de barridos que ha costado cada una.
 * @throws {Error} Si alguna de las dos iteraciones no converge en el tope.
 */
function resolverPaseo(nEstados, radio, gamma) {
  calculosPaseo += 1;
  const n = nEstados;
  const total = 2 * radio; // los 200 destinos equiprobables
  const inicio = Math.floor(n / 2) - 1; // el «estado 500» del libro, en base 0

  /* Recompensa esperada de un paso: −1 por cada destino que se sale por la
     izquierda y +1 por cada uno que se sale por la derecha, sobre los 200. */
  const rMedia = new Float64Array(n);
  const nIzq = new Float64Array(n);
  const nDch = new Float64Array(n);
  for (let s = 0; s < n; s++) {
    nIzq[s] = Math.max(0, radio - s);
    nDch[s] = Math.max(0, s - (n - 1 - radio));
    rMedia[s] = (nDch[s] - nIzq[s]) / total;
  }

  /* v(s) ← (1/200)[ γ Σ_{s' vecino} v(s') + n_dch(s) − n_izq(s) ] */
  let v = new Float64Array(n);
  let barridosV = 0;
  for (let iter = 0; iter < MAX_BARRIDOS; iter++) {
    const c = sumasAcumuladas(v);
    const siguiente = new Float64Array(n);
    let delta = 0;
    for (let s = 0; s < n; s++) {
      const desde = Math.max(0, s - radio);
      const hasta = Math.min(n - 1, s + radio);
      const sumaVecinos = c[hasta + 1] - c[desde] - v[s]; // el propio s no es destino
      siguiente[s] = (gamma * sumaVecinos) / total + rMedia[s];
      const d = Math.abs(siguiente[s] - v[s]);
      if (d > delta) delta = d;
    }
    v = siguiente;
    barridosV = iter + 1;
    if (delta < TOL_DP) break;
  }
  if (barridosV >= MAX_BARRIDOS) {
    /* Sin «v_π» en el mensaje: el test de i18n prohíbe los subíndices con
       guion bajo en el texto que puede acabar en pantalla. */
    throw new Error(`resolverPaseo: los valores verdaderos no han convergido en ${MAX_BARRIDOS} barridos (γ = ${gamma})`);
  }

  /* η(s) ← h(s) + γ Σ_{s̄} η(s̄) p(s|s̄), con h concentrada en el estado de
     inicio. La dinámica es simétrica —s es destino de s̄ si y solo si s̄ es
     destino de s—, así que sirve la misma ventana y la misma técnica. */
  let eta = new Float64Array(n);
  let barridosEta = 0;
  for (let iter = 0; iter < MAX_BARRIDOS; iter++) {
    const c = sumasAcumuladas(eta);
    const siguiente = new Float64Array(n);
    let delta = 0;
    for (let s = 0; s < n; s++) {
      const desde = Math.max(0, s - radio);
      const hasta = Math.min(n - 1, s + radio);
      const suma = c[hasta + 1] - c[desde] - eta[s];
      siguiente[s] = (s === inicio ? 1 : 0) + (gamma * suma) / total;
      const d = Math.abs(siguiente[s] - eta[s]);
      if (d > delta) delta = d;
    }
    eta = siguiente;
    barridosEta = iter + 1;
    if (delta < TOL_DP) break;
  }
  if (barridosEta >= MAX_BARRIDOS) {
    throw new Error(`resolverPaseo: η no ha convergido en ${MAX_BARRIDOS} barridos (γ = ${gamma})`);
  }

  let sumaEta = 0;
  for (let s = 0; s < n; s++) sumaEta += eta[s];
  const mu = new Float64Array(n);
  for (let s = 0; s < n; s++) mu[s] = eta[s] / sumaEta;

  return { v, eta, mu, barridos: { v: barridosV, eta: barridosEta } };
}

/**
 * Paseo aleatorio de 1000 estados — Example 9.1, S&B §9.1, p. 225.
 *
 * Proceso de recompensa de Markov SIN ACCIONES, como el paseo de 5 estados
 * del tema 4. Estados internos 0…999 (el «estado 1» del libro es el índice 0);
 * los terminales viven fuera: −1 por la izquierda y `nEstados` por la derecha.
 * Inicio determinista en el índice 499. Desde s se salta a uno de los 100
 * vecinos de la izquierda o de los 100 de la derecha, todos con probabilidad
 * 1/200; lo que se sale del rango TERMINA por ese lado, con recompensa −1 por
 * la izquierda y +1 por la derecha, y 0 en todo lo demás.
 *
 * γ = 1 por omisión: el libro NO lo dice en este ejemplo y se hereda del
 * Example 6.2 («Because this task is undiscounted», p. 147). Es la ambigüedad
 * A1 del guion y se declara en pantalla.
 *
 * v_π, η y μ se resuelven por programación dinámica —no se muestrean, porque
 * son la referencia de todos los errores de la página— y se CACHEAN por valor
 * de γ: los módulos 1, 2 y 3 comparten el cálculo.
 *
 * @param {object} [opciones]
 * @param {number} [opciones.gamma=1] Descuento.
 * @param {number} [opciones.nEstados=1000] Número de estados (2000 en el test
 *   de escalabilidad T-5; el Example 9.1 usa 1000).
 * @param {number} [opciones.radio=100] Vecinos alcanzables a cada lado.
 * @returns {object} Entorno discreto con `nEstados`, `inicio`, `gamma`,
 *   `paso`, `esTerminal`, `transiciones`, `destinos`, `valoresVerdaderos`,
 *   `eta`, `mu`, `recompensaMedia` y `barridos`.
 * @throws {Error} Si γ no está en [0, 1] o si la DP no converge.
 */
export function paseoMil({ gamma = 1, nEstados = 1000, radio = 100 } = {}) {
  validarGamma(gamma, "paseoMil");
  validarEnteroPositivo(nEstados, "nEstados", "paseoMil");
  validarEnteroPositivo(radio, "radio", "paseoMil");
  const n = nEstados;
  const total = 2 * radio;
  const inicio = Math.floor(n / 2) - 1; // índice 499 = «estado 500» del libro

  const clave = `${n}|${radio}|${gamma}`;
  if (!CACHE_PASEO.has(clave)) CACHE_PASEO.set(clave, resolverPaseo(n, radio, gamma));
  const datos = CACHE_PASEO.get(clave);

  const esTerminal = (s) => s < 0 || s >= n;

  /**
   * Los 200 destinos de s y los que caen fuera por cada lado.
   * Los destinos interiores son los índices de [desde, hasta] MENOS s.
   */
  const destinos = (s) => ({
    desde: Math.max(0, s - radio),
    hasta: Math.min(n - 1, s + radio),
    nIzq: Math.max(0, radio - s),
    nDch: Math.max(0, s - (n - 1 - radio)),
  });

  return {
    nEstados: n,
    radio,
    inicio,
    gamma,
    acciones: null, // no hay acciones: es un proceso de recompensa de Markov
    esTerminal,
    destinos,

    /**
     * Un paso del paseo. Consume EXACTAMENTE un `entero(200)` del generador.
     * j = 0…99 son los desplazamientos −100…−1 y j = 100…199 los +1…+100.
     */
    paso(s, rng) {
      const j = rng.entero(total);
      const desplazamiento = j < radio ? j - radio : j - radio + 1;
      const s2 = s + desplazamiento;
      if (s2 < 0) return { s2: -1, r: -1, fin: true };
      if (s2 >= n) return { s2: n, r: 1, fin: true };
      return { s2, r: 0, fin: false };
    },

    /** Modelo explícito de un estado: lo usa `matrizAb`. 202 entradas como mucho. */
    transiciones(s) {
      const p = 1 / total;
      const lista = [];
      const { desde, hasta, nIzq, nDch } = destinos(s);
      for (let s2 = desde; s2 <= hasta; s2++) {
        if (s2 !== s) lista.push({ s2, p, r: 0 });
      }
      if (nIzq > 0) lista.push({ s2: -1, p: nIzq * p, r: -1 });
      if (nDch > 0) lista.push({ s2: n, p: nDch * p, r: 1 });
      return lista;
    },

    /** Recompensa esperada de un paso desde s. */
    recompensaMedia(s) {
      const { nIzq, nDch } = destinos(s);
      return (nDch - nIzq) / total;
    },

    valoresVerdaderos: datos.v,
    eta: datos.eta,
    mu: datos.mu,
    barridos: datos.barridos,
  };
}

/**
 * Mountain Car — Example 10.1, S&B §10.1, pp. 266-268.
 *
 * Ecuaciones literales de la p. 267, con la posición escrita p en lugar de x
 * (§0.1 del guion, para no chocar con el vector de características):
 *
 *   ṗ_{t+1} = acotar[ ṗ_t + 0,001 A_t − 0,0025 cos(3 p_t) ]   con |ṗ| ≤ 0,07
 *   p_{t+1} = acotar[ p_t + ṗ_{t+1} ]                          con −1,2 ≤ p ≤ 0,5
 *
 * PRIMERO LA VELOCIDAD Y DESPUÉS LA POSICIÓN, y el cos(3p) usa la posición
 * ANTIGUA: el libro imprime las ecuaciones en el orden contrario, pero p_{t+1}
 * depende de ṗ_{t+1}. Al llegar al borde izquierdo la velocidad se pone a cero
 * —no se invierte— y el episodio NO termina; se termina SOLO por p ≥ 0,5. La
 * recompensa es −1 en todos los pasos, incluido el que termina.
 *
 * γ = 1: el libro no lo escribe (ambigüedad A2 del guion) y es lo único
 * coherente con que el coste por recorrer de la figura 10.1 llegue a 120.
 *
 * @returns {object} Entorno continuo con `dimensiones`, `rangos`, `acciones`,
 *   `gamma`, `inicio(rng)` y `paso(estado, a)`.
 */
export function mountainCar() {
  const P_MIN = -1.2;
  const P_MAX = 0.5;
  const V_MAX = 0.07;

  return {
    dimensiones: 2,
    rangos: [
      [P_MIN, P_MAX],
      [-V_MAX, V_MAX],
    ],
    /* Identificadores del motor, NO se traducen y NO son índices: entran en la
       física como A_t. El índice de la acción es su posición en este array. */
    acciones: [-1, 0, 1],
    gamma: 1,
    esTerminal: (estado) => estado.p >= P_MAX,

    /**
     * p ~ U[−0,6, −0,4) e ṗ = 0. Intervalo SEMIABIERTO, tal como lo escribe el
     * libro. Consume EXACTAMENTE un `uniforme()` del generador.
     */
    inicio(rng) {
      return { p: -0.6 + 0.2 * rng.uniforme(), v: 0 };
    },

    /**
     * Un paso de la física. NO consume azar.
     *
     * @param {{p: number, v: number}} estado Posición y velocidad.
     * @param {number} a Identificador de acción: −1, 0 o +1.
     * @returns {{estado2: {p: number, v: number}, p2: number, v2: number, r: number, fin: boolean}}
     *   El estado siguiente (en las dos formas que pide el guion), la
     *   recompensa (−1 siempre) y si el episodio ha terminado.
     */
    paso(estado, a) {
      let v2 = estado.v + 0.001 * a - 0.0025 * Math.cos(3 * estado.p);
      if (v2 > V_MAX) v2 = V_MAX;
      if (v2 < -V_MAX) v2 = -V_MAX;
      let p2 = estado.p + v2;
      if (p2 < P_MIN) {
        /* Borde izquierdo: la velocidad se RESETEA a cero (no se invierte) y
           el episodio NO termina. Literal de la p. 267. */
        p2 = P_MIN;
        v2 = 0;
      }
      if (p2 > P_MAX) p2 = P_MAX;
      const fin = p2 >= P_MAX;
      return { estado2: { p: p2, v: v2 }, p2, v2, r: -1, fin };
    },
  };
}

/* ----------------------------------------------------------------------- *
 * 2. Representaciones
 *
 * Interfaz común:
 *   { d, nActivas, activas(...) -> Int32Array, valor(w, ...) -> number,
 *     acumular(w, escala, ...) -> void }
 * `activas` recibe (s) en las de predicción y (s, a) en las de control, con
 * `a` el ÍNDICE de la acción. `acumular` suma `escala` a las componentes
 * activas: es la actualización lineal.
 *
 * Opcionalmente una representación puede exponer `valores(...)`, la lista de
 * VALORES de esas componentes. Si no la expone, valen 1 (características
 * binarias, que es el caso de todas menos `caracteristicasPorAccion`).
 * ----------------------------------------------------------------------- */

/** Los valores de las componentes activas; todo unos si la repr es binaria. */
function valoresDe(repr, args) {
  if (typeof repr.valores === "function") return repr.valores(...args);
  return null; // null = todas a 1, y se evita asignar un array por paso
}

/**
 * La traza de REEMPLAZO solo está definida con características binarias.
 *
 * DECISIÓN DEL ORQUESTADOR (2026-09-08), que CONTRADICE LA LETRA de la addenda
 * §2: la regla «z_t[i] = 1 para cada componente activa» presupone
 * x ∈ {0,1}^d. En *tile coding* lo es y la regla es correcta, pero con
 * características de valor real —el x(s,a) del ejemplo del examen, con 4,2 y
 * 33,7— poner esas componentes a 1 DESTRUIRÍA la información. Así que no se
 * silencia y no se configura: se comprueba el valor y se lanza. Con
 * características de valor real la que aplica es la ACUMULATIVA, y es lo que
 * dice `t5.b14b.texto3`.
 *
 * @param {Float64Array|null} valores Valores de las componentes activas.
 * @param {string} fn Nombre de la función que llama, para el mensaje.
 * @throws {Error} Si alguna componente activa no vale exactamente 1.
 */
function exigirBinaria(valores, fn) {
  if (valores === null) return; // representación binaria: todas valen 1
  for (let i = 0; i < valores.length; i++) {
    if (valores[i] !== 1) {
      throw new Error(
        `${fn}: la traza de reemplazo solo está definida con características binarias, `
        + `y esta representación tiene una componente activa que vale ${valores[i]}. `
        + "Con características de valor real hay que usar traza \"acumulativa\": poner a 1 "
        + "una componente que vale 4,2 destruiría la información (S&B §12.6 y guion §B14b).",
      );
    }
  }
}

/** x(s)ᵀ x(s), que es el denominador del perfil de generalización de M2. */
function normaCuadrado(repr, args) {
  const val = valoresDe(repr, args);
  if (val === null) return repr.activas(...args).length;
  let suma = 0;
  for (let i = 0; i < val.length; i++) suma += val[i] * val[i];
  return suma;
}

/**
 * Codificación *one-hot*: x(s) = e_s, d = |S|, una característica activa.
 *
 * Es el caso tabular escrito como aproximación lineal (Exercise 9.1, p. 231),
 * y el peldaño que hace visible que la regla lineal se reduce a
 * w_s ← w_s + α[U − w_s].
 *
 * @param {number} nEstados Número de estados.
 * @returns {object} Representación con d = nEstados y nActivas = 1.
 * @throws {Error} Si nEstados no es un entero ≥ 1.
 */
export function oneHot(nEstados) {
  validarEnteroPositivo(nEstados, "nEstados", "oneHot");
  return {
    tipo: "oneHot",
    d: nEstados,
    nActivas: 1,
    activas: (s) => Int32Array.of(s),
    valor: (w, s) => w[s],
    acumular: (w, escala, s) => {
      w[s] += escala;
    },
  };
}

/**
 * Agregación de estados en k grupos de |S|/k estados consecutivos.
 *
 * g(s) = ⌊s·k/|S|⌋ con s en base 0, que es el ⌊(s−1)k/1000⌋ del guion escrito
 * en base 1. x(s) = e_{g(s)}, d = k, una característica activa: es el
 * aproximador de la figura 9.1 del libro (§9.3, p. 225).
 *
 * @param {number} nEstados Número de estados.
 * @param {number} k Número de grupos.
 * @returns {object} Representación con d = k, nActivas = 1 y `grupo(s)`,
 *   `limites(j)`.
 * @throws {Error} Si nEstados o k no son enteros ≥ 1.
 */
export function agregacion(nEstados, k) {
  validarEnteroPositivo(nEstados, "nEstados", "agregacion");
  validarEnteroPositivo(k, "k", "agregacion");
  const grupo = (s) => Math.min(k - 1, Math.floor((s * k) / nEstados));
  return {
    tipo: "agregacion",
    d: k,
    nActivas: 1,
    nEstados,
    grupo,
    /** Primer y último estado (en base 0) del grupo j. */
    limites: (j) => ({
      desde: Math.ceil((j * nEstados) / k),
      hasta: Math.ceil(((j + 1) * nEstados) / k) - 1,
    }),
    activas: (s) => Int32Array.of(grupo(s)),
    valor: (w, s) => w[grupo(s)],
    acumular: (w, escala, s) => {
      w[grupo(s)] += escala;
    },
  };
}

/**
 * *Tile coding* de una dimensión: m mosaicados de ancho `ancho`, desplazados
 * uniformemente ancho/m entre sí.
 *
 * i_j(s) = ⌊(s + j·ancho/m)/ancho⌋ con s en base 0 —el ⌊(s−1+jℓ/m)/ℓ⌋ del
 * guion en base 1— y la componente activa del mosaicado j es j·T + i_j(s),
 * con T = ⌈|S|/ancho⌉ + 1 mosaicos por mosaicado. El +1 es el mosaico que
 * absorbe el desplazamiento y garantiza que TODO estado cae en exactamente un
 * mosaico de cada mosaicado (§9.5.4, p. 240: «Exactly one feature is present
 * in each tiling»). Con m = 1 esto degenera EXACTAMENTE en agregación, que es
 * la lectura del módulo 2.
 *
 * Algunos mosaicos de los extremos no contienen ningún estado: sus pesos
 * existen, valen 0, no se actualizan nunca y CUENTAN en d, porque están en el
 * vector. Se declara en pantalla.
 *
 * @param {object} opciones
 * @param {number} opciones.nEstados Número de estados del rango [0, nEstados).
 * @param {number} opciones.m Número de mosaicados.
 * @param {number} opciones.ancho Ancho de mosaico ℓ, en estados.
 * @returns {object} Representación con d = m·T, nActivas = m, `offset`,
 *   `mosaicosPorMosaicado` y `mosaico(j, s)`.
 * @throws {Error} Si algún parámetro no es válido.
 */
export function tileCoding1D({ nEstados, m, ancho }) {
  validarEnteroPositivo(nEstados, "nEstados", "tileCoding1D");
  validarEnteroPositivo(m, "m", "tileCoding1D");
  validarFinito(ancho, "ancho", "tileCoding1D");
  if (ancho <= 0) throw new Error(`tileCoding1D: ancho debe ser > 0; recibido: ${ancho}`);

  const T = Math.ceil(nEstados / ancho) + 1;
  const offset = ancho / m;
  const d = m * T;
  const mosaico = (j, s) => Math.floor((s + j * offset) / ancho);

  const indices = (s) => {
    const out = new Int32Array(m);
    for (let j = 0; j < m; j++) out[j] = j * T + mosaico(j, s);
    return out;
  };

  return {
    tipo: "tileCoding1D",
    d,
    nActivas: m,
    m,
    ancho,
    offset,
    mosaicosPorMosaicado: T,
    mosaico,
    activas: indices,
    valor: (w, s) => {
      let suma = 0;
      for (let j = 0; j < m; j++) suma += w[j * T + mosaico(j, s)];
      return suma;
    },
    acumular: (w, escala, s) => {
      for (let j = 0; j < m; j++) w[j * T + mosaico(j, s)] += escala;
    },
  };
}

/**
 * *Tile coding* de dos dimensiones con desplazamientos asimétricos, indexado
 * por par estado-acción: es la x(s,a) de Mountain Car (§10.1 y §9.5.4).
 *
 * Construcción de §0.3 del guion: m = 8 mosaicados, `mosaicosPorLado` = 8
 * mosaicos por dimensión dentro del rango (más uno para absorber el
 * desplazamiento, T = 9), vector de desplazamiento (1,3) —los primeros enteros
 * impares de la regla de Miller y Glanz para k = 2 dimensiones, con
 * m = 2³ = 8 ≥ 4k (p. 242)— y tres acciones con bloques DISJUNTOS. Sin
 * *hashing*: d = 8·9·9·3 = 1944 pesos, que caben de sobra en las 4096
 * posiciones de la `IHT(4096)` del libro, así que al no haber colisiones el
 * aproximador es EXACTAMENTE el mismo (ambigüedad A18).
 *
 * ⚠ EL DESPLAZAMIENTO SE TOMA MÓDULO m, y esto no es un detalle. Con
 * desplazamiento 3 y m = 8, el offset j·3·ℓ/8 del mosaicado j = 7 vale 2,625 ℓ
 * y se saldría de los 9 mosaicos por lado. La implementación del libro
 * (`tiles3.py`) calcula ⌊(q + b)/m⌋ con b = j·(2k−1), lo que equivale a tomar
 * el desplazamiento módulo m y sumar un entero al índice del mosaico: el
 * mosaico se RENOMBRA dentro de su mosaicado, pero la partición es la misma.
 * Como cada mosaicado tiene su propio bloque de pesos, el aproximador es
 * idéntico y así T = 9 y d = 1944 son exactos. Con m = 8 y desplazamiento 3,
 * (3j mod 8) recorre 0,3,6,1,4,7,2,5: los ocho desplazamientos distintos.
 *
 * @param {object} opciones
 * @param {number[][]} opciones.rangos [[min, max], …] por dimensión.
 * @param {number} opciones.m Número de mosaicados.
 * @param {number[]} opciones.desplazamiento Vector de desplazamiento, un
 *   entero impar por dimensión.
 * @param {number} opciones.nAcciones Número de acciones.
 * @param {number} opciones.mosaicosPorLado Mosaicos por dimensión dentro del rango.
 * @returns {object} Representación con d, nActivas = m, `anchos`, `T` y
 *   `activas(estado, a)`, donde `estado` es {p, v} o [x0, x1] y `a` un ÍNDICE.
 * @throws {Error} Si algún parámetro no es válido.
 */
export function tileCoding2D({ rangos, m, desplazamiento, nAcciones, mosaicosPorLado }) {
  validarEnteroPositivo(m, "m", "tileCoding2D");
  validarEnteroPositivo(nAcciones, "nAcciones", "tileCoding2D");
  validarEnteroPositivo(mosaicosPorLado, "mosaicosPorLado", "tileCoding2D");
  if (!Array.isArray(rangos) || rangos.length !== 2) {
    throw new Error("tileCoding2D: rangos debe ser [[min,max],[min,max]]");
  }
  if (!Array.isArray(desplazamiento) || desplazamiento.length !== 2) {
    throw new Error("tileCoding2D: desplazamiento debe tener una componente por dimensión");
  }

  const T = mosaicosPorLado + 1;
  const minimos = [rangos[0][0], rangos[1][0]];
  const anchos = [
    (rangos[0][1] - rangos[0][0]) / mosaicosPorLado,
    (rangos[1][1] - rangos[1][0]) / mosaicosPorLado,
  ];
  /* Desplazamiento del mosaicado j en cada dimensión, MÓDULO m (ver arriba). */
  const offsets = [];
  for (let j = 0; j < m; j++) {
    offsets.push([
      (((j * desplazamiento[0]) % m) * anchos[0]) / m,
      (((j * desplazamiento[1]) % m) * anchos[1]) / m,
    ]);
  }
  const d = nAcciones * m * T * T;

  const coordenadas = (estado) =>
    Array.isArray(estado) ? estado : [estado.p, estado.v];

  const indices = (estado, a) => {
    if (!Number.isInteger(a) || a < 0 || a >= nAcciones) {
      throw new Error(`tileCoding2D: a debe ser un índice de acción en [0, ${nAcciones}); recibido: ${a}`);
    }
    const c = coordenadas(estado);
    const out = new Int32Array(m);
    const base = a * m * T * T;
    for (let j = 0; j < m; j++) {
      let i0 = Math.floor((c[0] - minimos[0] + offsets[j][0]) / anchos[0]);
      let i1 = Math.floor((c[1] - minimos[1] + offsets[j][1]) / anchos[1]);
      /* Los índices no pueden salirse si el estado está dentro del rango
         acotado (aserción C5-7); el acotado está para que un estado en el
         borde exacto o un error de redondeo no escriba fuera del vector. */
      if (i0 < 0) i0 = 0;
      if (i0 >= T) i0 = T - 1;
      if (i1 < 0) i1 = 0;
      if (i1 >= T) i1 = T - 1;
      out[j] = base + (j * T + i0) * T + i1;
    }
    return out;
  };

  return {
    tipo: "tileCoding2D",
    d,
    nActivas: m,
    m,
    T,
    anchos,
    nAcciones,
    desplazamiento: desplazamiento.slice(),
    offsets,
    activas: indices,
    valor: (w, estado, a) => {
      const act = indices(estado, a);
      let suma = 0;
      for (let i = 0; i < act.length; i++) suma += w[act[i]];
      return suma;
    },
    acumular: (w, escala, estado, a) => {
      const act = indices(estado, a);
      for (let i = 0; i < act.length; i++) w[act[i]] += escala;
    },
  };
}

/**
 * Bloques disjuntos por acción sobre un vector de observación: la
 * representación del problema práctico del examen final.
 *
 * Es la construcción que el examen enuncia con palabras —«las variables serán
 * 0 para las acciones que no se han tomado y los valores de la tabla para la
 * acción elegida»— y la (10.3) del libro: x(s,a) coloca las `nVariables`
 * componentes de la observación en el bloque de la acción elegida y deja a
 * cero los otros bloques. d = nVariables · nAcciones.
 *
 * ES LA ÚNICA REPRESENTACIÓN NO BINARIA del motor, y por eso expone
 * `valores(...)`: sus componentes activas valen la observación, no 1. Existe
 * para poder contrastar la traza del apartado g) del examen (aserción T-8 de
 * la addenda) sin inventar datos.
 *
 * @param {object} opciones
 * @param {number} opciones.nVariables Número de variables de la observación.
 * @param {number} opciones.nAcciones Número de acciones.
 * @returns {object} Representación con d = nVariables·nAcciones,
 *   nActivas = nVariables, `activas(x, a)`, `valores(x, a)`.
 * @throws {Error} Si algún parámetro no es válido.
 */
export function caracteristicasPorAccion({ nVariables, nAcciones }) {
  validarEnteroPositivo(nVariables, "nVariables", "caracteristicasPorAccion");
  validarEnteroPositivo(nAcciones, "nAcciones", "caracteristicasPorAccion");
  const d = nVariables * nAcciones;

  const indices = (x, a) => {
    if (!Number.isInteger(a) || a < 0 || a >= nAcciones) {
      throw new Error(`caracteristicasPorAccion: a debe ser un índice en [0, ${nAcciones}); recibido: ${a}`);
    }
    const out = new Int32Array(nVariables);
    for (let i = 0; i < nVariables; i++) out[i] = a * nVariables + i;
    return out;
  };

  return {
    tipo: "caracteristicasPorAccion",
    d,
    nActivas: nVariables,
    nVariables,
    nAcciones,
    activas: indices,
    valores: (x) => Float64Array.from(x),
    valor: (w, x, a) => {
      let suma = 0;
      for (let i = 0; i < nVariables; i++) suma += w[a * nVariables + i] * x[i];
      return suma;
    },
    acumular: (w, escala, x, a) => {
      for (let i = 0; i < nVariables; i++) w[a * nVariables + i] += escala * x[i];
    },
  };
}

/**
 * Datos del problema práctico del examen final de 2025 (`Final_RL_IMAT_A#page-12`).
 *
 * Solo DATOS, transcritos del enunciado, para que el test de la aserción T-8 y
 * el bloque de apuntes de las trazas no tengan que inventar nada.
 *
 * ⚠ La acción del instante t = 1 NO está determinada por el enunciado: las
 * seis variables de la observación son idénticas en t = 1 y en t = 2, lo que
 * es consistente con cualquiera de las dos rotaciones (A1 o A2), porque las
 * demoras están medidas respecto de un sistema de referencia ESTÁTICO y girar
 * el robot no las cambia. Aquí se toma A1 y se declara: para la traza solo
 * cambia en qué bloque cae el 1, no la aritmética de la recurrencia.
 */
export const EJEMPLO_EXAMEN = Object.freeze({
  cita: "Final_RL_IMAT_A#page-12, Problema 2",
  nVariables: 6,
  nAcciones: 3,
  gamma: 0.9,
  lambda: 0.5,
  alpha: 0.1,
  epsilon: 0.2,
  w0: 2,
  /** Observaciones de t = 0 a t = 3, una fila por instante. */
  observaciones: Object.freeze([
    Object.freeze([2, 2, 2, 0, 4.2, 45]),
    Object.freeze([3, 2, 2, 0, 3.6, 33.7]),
    Object.freeze([3, 2, 2, 0, 3.6, 33.7]),
    Object.freeze([3, 3, 1, 0, 2.8, 45]),
  ]),
  /** Acciones deducidas de la tabla: avanzar, rotar (ambigua), avanzar. */
  acciones: Object.freeze([0, 1, 0]),
  accionT1Ambigua: true,
});

/* ----------------------------------------------------------------------- *
 * 3. Álgebra exacta
 * ----------------------------------------------------------------------- */

/**
 * Mínimo de VE en forma cerrada, para representaciones de UNA SOLA
 * característica activa (one-hot, agregación, un único mosaicado).
 *
 * Derivando VE(w) respecto de w_j e igualando a cero sale la media de los
 * valores verdaderos del grupo PONDERADA por el peso de cada estado:
 *
 *   w*_j = Σ_{s∈G_j} μ(s) v_π(s) / Σ_{s∈G_j} μ(s)
 *
 * Un grupo con peso total 0 dividiría por cero: no ocurre en el paseo de mil
 * estados —μ(s) > 0 para los mil, aserción C1-6— pero sí en los mosaicos
 * vacíos del módulo 2, así que esos pesos se dejan en 0 y se devuelven en
 * `vacios` para poder dibujarlos atenuados.
 *
 * @param {object} repr Representación con nActivas = 1.
 * @param {Float64Array|number[]} valoresVerdaderos v_π, un valor por estado.
 * @param {Float64Array|number[]|string|null} [pesoEstado] μ, o "uniforme"/null
 *   para ponderación uniforme.
 * @returns {{w: Float64Array, vacios: number[]}} Pesos óptimos y los índices
 *   de peso cuyo grupo no tiene masa.
 * @throws {Error} Si la representación tiene más de una característica activa.
 */
export function pesosOptimos(repr, valoresVerdaderos, pesoEstado = null) {
  if (repr.nActivas !== 1) {
    throw new Error(
      `pesosOptimos: solo vale para representaciones de una característica activa; nActivas = ${repr.nActivas}`,
    );
  }
  const n = valoresVerdaderos.length;
  const uniforme = pesoEstado === null || pesoEstado === undefined || pesoEstado === "uniforme";
  const numerador = new Float64Array(repr.d);
  const denominador = new Float64Array(repr.d);

  for (let s = 0; s < n; s++) {
    const j = repr.activas(s)[0];
    const peso = uniforme ? 1 / n : pesoEstado[s];
    numerador[j] += peso * valoresVerdaderos[s];
    denominador[j] += peso;
  }

  const w = new Float64Array(repr.d);
  const vacios = [];
  for (let j = 0; j < repr.d; j++) {
    if (denominador[j] === 0) {
      w[j] = 0;
      vacios.push(j);
    } else {
      w[j] = numerador[j] / denominador[j];
    }
  }
  return { w, vacios };
}

/**
 * VE(w) = Σ_s μ(s) [v_π(s) − v̂(s,w)]², el error cuadrático medio de valor
 * ponderado, (9.1) del libro.
 *
 * DEVUELVE VE, NO SU RAÍZ. En los ejes se dibuja √VE, que es lo que usa el
 * libro en las figuras 9.5 y 9.10 («The square root of this measure, the root
 * VE […] is often used in plots», p. 221), y la raíz la toma quien dibuja.
 *
 * @param {object} repr Representación de predicción.
 * @param {Float64Array} w Vector de pesos.
 * @param {Float64Array|number[]} valoresVerdaderos v_π.
 * @param {Float64Array|number[]|null} [mu] Ponderación; uniforme si se omite.
 * @returns {number} VE(w).
 */
export function errorVE(repr, w, valoresVerdaderos, mu = null) {
  validarPesos(w, repr, "errorVE");
  const n = valoresVerdaderos.length;
  let suma = 0;
  for (let s = 0; s < n; s++) {
    const peso = mu === null ? 1 / n : mu[s];
    if (peso === 0) continue;
    const e = valoresVerdaderos[s] - repr.valor(w, s);
    suma += peso * e * e;
  }
  return suma;
}

/**
 * A y b del análisis de TD lineal, (9.11) del libro, construidos con la
 * dinámica EXACTA del entorno (no muestreados):
 *
 *   A = Σ_s μ(s) x(s)[x(s) − γ Σ_{s'} p(s'|s) x(s')]ᵀ
 *   b = Σ_s μ(s) [Σ_{s'} p(s'|s) r(s,s')] x(s)
 *
 * con x(terminal) = 0. Requiere que el entorno exponga `transiciones(s)` y
 * `mu`. Coste O(|S| · destinos · nActivas), no O(|S|²·d).
 *
 * @param {object} entorno Entorno discreto con modelo conocido.
 * @param {object} repr Representación de predicción.
 * @param {number} [gamma] Descuento; por omisión el del entorno.
 * @returns {{A: Float64Array[], b: Float64Array}} Matriz d×d por filas y vector d.
 * @throws {Error} Si el entorno no expone el modelo.
 */
export function matrizAb(entorno, repr, gamma = entorno.gamma) {
  if (typeof entorno.transiciones !== "function") {
    throw new Error("matrizAb: el entorno tiene que exponer transiciones(s) (modelo conocido)");
  }
  validarGamma(gamma, "matrizAb");
  const d = repr.d;
  const A = [];
  for (let i = 0; i < d; i++) A.push(new Float64Array(d));
  const b = new Float64Array(d);

  /* `esperado` acumula x(s) − γ E[x(s')] de forma dispersa: se tocan solo las
     componentes que aparecen y se limpian al acabar cada estado. */
  const esperado = new Float64Array(d);
  const tocados = [];
  const marcado = new Uint8Array(d);
  const tocar = (idx) => {
    if (!marcado[idx]) {
      marcado[idx] = 1;
      tocados.push(idx);
    }
  };

  for (let s = 0; s < entorno.nEstados; s++) {
    const mu = entorno.mu[s];
    if (mu === 0) continue;

    const act = repr.activas(s);
    const val = valoresDe(repr, [s]);
    for (let i = 0; i < act.length; i++) {
      tocar(act[i]);
      esperado[act[i]] += val === null ? 1 : val[i];
    }

    let rMedia = 0;
    for (const { s2, p, r } of entorno.transiciones(s)) {
      rMedia += p * r;
      if (entorno.esTerminal(s2)) continue; // x(terminal) = 0
      const act2 = repr.activas(s2);
      const val2 = valoresDe(repr, [s2]);
      for (let i = 0; i < act2.length; i++) {
        tocar(act2[i]);
        esperado[act2[i]] -= gamma * p * (val2 === null ? 1 : val2[i]);
      }
    }

    for (let i = 0; i < act.length; i++) {
      const fila = A[act[i]];
      const xi = val === null ? 1 : val[i];
      for (const j of tocados) fila[j] += mu * xi * esperado[j];
      b[act[i]] += mu * xi * rMedia;
    }

    for (const j of tocados) {
      esperado[j] = 0;
      marcado[j] = 0;
    }
    tocados.length = 0;
  }

  return { A, b };
}

/**
 * Resuelve A w = b por eliminación gaussiana con pivoteo parcial.
 *
 * Si el pivote máximo de una columna cae por debajo de 1e−12, el sistema se
 * considera casi singular: se resuelve (A + εI) w = b y se devuelve
 * `regularizada: true`, que es lo que hace LSTD y lo que la página muestra
 * como aviso —no como resultado— en `t5.m3.notaSingular`.
 *
 * @param {Float64Array[]|number[][]} A Matriz cuadrada por filas.
 * @param {Float64Array|number[]} b Término independiente.
 * @param {object} [opciones]
 * @param {number} [opciones.epsilon=1e-10] Regularización de Tíjonov.
 * @returns {{w: Float64Array, regularizada: boolean}} Solución y si se ha
 *   tenido que regularizar.
 * @throws {Error} Si A no es cuadrada o no cuadra con b.
 */
export function resolver(A, b, { epsilon = 1e-10 } = {}) {
  const d = b.length;
  if (A.length !== d) throw new Error(`resolver: A es ${A.length}×? y b tiene ${d} componentes`);

  const intentar = (reg) => {
    const M = [];
    for (let i = 0; i < d; i++) {
      const fila = new Float64Array(d + 1);
      for (let j = 0; j < d; j++) fila[j] = A[i][j];
      if (reg > 0) fila[i] += reg;
      fila[d] = b[i];
      M.push(fila);
    }
    for (let col = 0; col < d; col++) {
      let mejor = col;
      let mayor = Math.abs(M[col][col]);
      for (let i = col + 1; i < d; i++) {
        const v = Math.abs(M[i][col]);
        if (v > mayor) {
          mayor = v;
          mejor = i;
        }
      }
      if (mayor < 1e-12) return null; // casi singular
      if (mejor !== col) {
        const t = M[col];
        M[col] = M[mejor];
        M[mejor] = t;
      }
      const pivote = M[col][col];
      for (let i = col + 1; i < d; i++) {
        const factor = M[i][col] / pivote;
        if (factor === 0) continue;
        for (let j = col; j <= d; j++) M[i][j] -= factor * M[col][j];
      }
    }
    const w = new Float64Array(d);
    for (let i = d - 1; i >= 0; i--) {
      let suma = M[i][d];
      for (let j = i + 1; j < d; j++) suma -= M[i][j] * w[j];
      w[i] = suma / M[i][i];
    }
    return w;
  };

  const w = intentar(0);
  if (w !== null) return { w, regularizada: false };
  const wReg = intentar(epsilon);
  if (wReg === null) {
    throw new Error(`resolver: el sistema sigue siendo singular con ε = ${epsilon}`);
  }
  return { w: wReg, regularizada: true };
}

/**
 * Punto fijo TD, w_TD = A⁻¹b, (9.12) del libro.
 *
 * No se simula: se resuelve. Por eso no se mueve al cambiar α ni la semilla
 * (aserción C3-7): solo depende del entorno, de la representación y de γ.
 *
 * @param {object} entorno Entorno discreto con modelo conocido.
 * @param {object} repr Representación de predicción.
 * @param {number} [gamma] Descuento; por omisión el del entorno.
 * @returns {{w: Float64Array, A: Float64Array[], b: Float64Array, regularizada: boolean}}
 */
export function puntoFijoTD(entorno, repr, gamma = entorno.gamma) {
  const { A, b } = matrizAb(entorno, repr, gamma);
  const { w, regularizada } = resolver(A, b);
  return { w, A, b, regularizada };
}

/* ----------------------------------------------------------------------- *
 * 4. Predicción: MC gradiente y TD(0) semi-gradiente
 * ----------------------------------------------------------------------- */

/** Pesos iniciales: acepta un vector, un escalar o nada (ceros). */
function pesosIniciales(d, w0) {
  const w = new Float64Array(d);
  if (w0 === null || w0 === undefined) return w;
  if (typeof w0 === "number") {
    w.fill(w0);
    return w;
  }
  if (w0.length !== d) throw new Error(`pesosIniciales: w0 tiene ${w0.length} componentes y d = ${d}`);
  w.set(w0);
  return w;
}

/** ¿Se ha reventado el vector de pesos? (M3 y M5, §6: tope 1e6). */
function pesosReventados(w) {
  for (let i = 0; i < w.length; i++) {
    if (!Number.isFinite(w[i]) || Math.abs(w[i]) > TOPE_PESOS) return true;
  }
  return false;
}

/**
 * Un episodio del entorno discreto sin acciones, muestreado con el generador.
 *
 * Consume UN `entero(200)` por paso y ninguno más. Los estados devueltos son
 * los NO TERMINALES visitados, S_0 … S_{T−1}, y las recompensas R_1 … R_T, de
 * modo que las dos series tienen la misma longitud.
 *
 * @param {object} entorno Entorno discreto.
 * @param {object} rng Generador de `generador(semilla)`.
 * @param {object} [opciones]
 * @param {number} [opciones.maxPasos=10000] Tope de pasos del episodio.
 * @returns {{estados: Int32Array, recompensas: Float64Array, truncado: boolean}}
 *   `truncado` es true si el episodio ha alcanzado el tope sin terminar: un
 *   episodio truncado NO es un episodio terminado.
 * @throws {Error} Si falta el generador.
 */
export function muestrearEpisodio(entorno, rng, { maxPasos = 10000 } = {}) {
  validarRng(rng, "muestrearEpisodio");
  const estados = [];
  const recompensas = [];
  let s = entorno.inicio;
  let truncado = true;

  for (let k = 0; k < maxPasos; k++) {
    const { s2, r, fin } = entorno.paso(s, rng);
    estados.push(s);
    recompensas.push(r);
    s = s2;
    if (fin) {
      truncado = false;
      break;
    }
  }

  return {
    estados: Int32Array.from(estados),
    recompensas: Float64Array.from(recompensas),
    truncado,
  };
}

/**
 * Monte Carlo gradiente, DE CADA VISITA (caja de S&B p. 224).
 *
 * Por cada episodio ya muestreado y para t = 0 … T−1:
 *   w ← w + α[G_t − v̂(S_t,w)] x(S_t)
 *
 * De cada visita, no de primera visita: la caja del libro recorre todos los t
 * sin comprobar si el estado ya había aparecido, y en este paseo los estados
 * se repiten sin parar (ambigüedad A13 del guion). Los retornos se calculan
 * hacia atrás y las actualizaciones se aplican hacia adelante, como la caja.
 *
 * NO CONSUME AZAR: recibe los episodios ya generados, que es lo que garantiza
 * el invariante A/B del módulo 3 (aserción C3-5).
 *
 * @param {object} entorno Entorno discreto (para `esTerminal` y γ).
 * @param {object} repr Representación de predicción.
 * @param {Array<{estados: Int32Array, recompensas: Float64Array}>} episodios
 *   Episodios YA MUESTREADOS, para que MC y TD vean exactamente los mismos.
 * @param {object} opciones
 * @param {number} opciones.alpha Paso de aprendizaje.
 * @param {number} [opciones.gamma] Descuento; por omisión el del entorno.
 * @param {Float64Array|number} [opciones.w0] Pesos iniciales; ceros por omisión.
 * @param {number} [opciones.instantaneasCada=1] Cada cuántos episodios se
 *   guarda una copia de w; 0 desactiva las instantáneas.
 * @returns {{w: Float64Array, instantaneas: Float64Array[], cortada: boolean, episodiosHechos: number}}
 *   `instantaneas[0]` es w antes de aprender nada. `cortada` marca que los
 *   pesos han pasado de 1e6 y la ejecución se ha detenido ahí.
 * @throws {Error} Si α no es finito.
 */
export function mcGradiente(entorno, repr, episodios, { alpha, gamma = entorno.gamma, w0 = null, instantaneasCada = 1 } = {}) {
  validarFinito(alpha, "alpha", "mcGradiente");
  validarGamma(gamma, "mcGradiente");
  const w = pesosIniciales(repr.d, w0);
  const instantaneas = instantaneasCada > 0 ? [Float64Array.from(w)] : [];
  let cortada = false;
  let hechos = 0;

  for (const episodio of episodios) {
    const { estados, recompensas } = episodio;
    const T = estados.length;
    const G = new Float64Array(T);
    let acumulado = 0;
    for (let t = T - 1; t >= 0; t--) {
      acumulado = recompensas[t] + gamma * acumulado;
      G[t] = acumulado;
    }
    for (let t = 0; t < T; t++) {
      const s = estados[t];
      repr.acumular(w, alpha * (G[t] - repr.valor(w, s)), s);
    }
    hechos += 1;
    if (instantaneasCada > 0 && hechos % instantaneasCada === 0) instantaneas.push(Float64Array.from(w));
    if (pesosReventados(w)) {
      cortada = true;
      break;
    }
  }

  return { w, instantaneas, cortada, episodiosHechos: hechos };
}

/**
 * TD(0) semi-gradiente (caja de S&B p. 225).
 *
 * En cada transición:  w ← w + α[R + γ v̂(S',w) − v̂(S,w)] x(S)
 *
 * v̂(terminal,w) = 0 SIEMPRE y los terminales no se actualizan nunca: es la
 * trampa clásica de este pseudocódigo y aquí está en una sola línea.
 * NO CONSUME AZAR.
 *
 * @param {object} entorno Entorno discreto (para `esTerminal` y γ).
 * @param {object} repr Representación de predicción.
 * @param {Array<{estados: Int32Array, recompensas: Float64Array}>} episodios
 *   Los MISMOS episodios que ve `mcGradiente`.
 * @param {object} opciones Iguales que en `mcGradiente`.
 * @returns {{w: Float64Array, instantaneas: Float64Array[], cortada: boolean, episodiosHechos: number}}
 * @throws {Error} Si α no es finito.
 */
export function tdSemiGradiente(entorno, repr, episodios, { alpha, gamma = entorno.gamma, w0 = null, instantaneasCada = 1 } = {}) {
  validarFinito(alpha, "alpha", "tdSemiGradiente");
  validarGamma(gamma, "tdSemiGradiente");
  const w = pesosIniciales(repr.d, w0);
  const instantaneas = instantaneasCada > 0 ? [Float64Array.from(w)] : [];
  let cortada = false;
  let hechos = 0;

  for (const episodio of episodios) {
    const { estados, recompensas } = episodio;
    const T = estados.length;
    for (let t = 0; t < T; t++) {
      const s = estados[t];
      /* El estado siguiente es el S_{t+1} de la lista, y si t es el último
         paso del episodio es TERMINAL: valor 0, sin término de continuación. */
      const siguienteEsTerminal = t === T - 1;
      const vSiguiente = siguienteEsTerminal ? 0 : repr.valor(w, estados[t + 1]);
      const delta = recompensas[t] + gamma * vSiguiente - repr.valor(w, s);
      repr.acumular(w, alpha * delta, s);
    }
    hechos += 1;
    if (instantaneasCada > 0 && hechos % instantaneasCada === 0) instantaneas.push(Float64Array.from(w));
    if (pesosReventados(w)) {
      cortada = true;
      break;
    }
  }

  return { w, instantaneas, cortada, episodiosHechos: hechos };
}

/**
 * Un episodio no truncado, descartando los que alcanzan el tope.
 *
 * El guion (M3 §6) pide descartar el episodio y generar otro con el MISMO
 * generador: el tope está para que el bucle termine, no para recortar nada.
 * La longitud típica es dos órdenes de magnitud menor, así que no se espera
 * que ocurra; se cuenta cuántas veces ocurre y se devuelve.
 */
function episodioCompleto(entorno, rng, maxPasos, contador) {
  for (let intento = 0; intento < 100; intento++) {
    const episodio = muestrearEpisodio(entorno, rng, { maxPasos });
    if (!episodio.truncado) return episodio;
    contador.truncados += 1;
  }
  throw new Error(`episodioCompleto: 100 intentos sin bajar de ${maxPasos} pasos`);
}

/**
 * Curva de √VE frente a episodios, promediada sobre ejecuciones sembradas.
 *
 * ⚠ LA CURVA QUE DEVUELVE ES √VE, NO VE: es lo que dibuja el eje del módulo 3
 * y lo que usa el libro en sus figuras (p. 221). `errorVE` sí devuelve VE.
 *
 * La ejecución i usa `generador(semilla + i)`, igual que en el tema 4. Si una
 * ejecución revienta (|w| > 1e6) se marca en `cortadas`, se anota el episodio
 * en `cortadaEn` y el resto de la serie se rellena con el último valor válido:
 * el promedio a partir de ahí NO es comparable y quien dibuje TIENE QUE cortar
 * en `cortadaEn` (`t5.m3.notaDivergencia`).
 *
 * @param {object} entorno Entorno discreto con `valoresVerdaderos` y `mu`.
 * @param {object} repr Representación de predicción.
 * @param {object} opciones
 * @param {string} opciones.metodo "mc" | "td".
 * @param {number} opciones.alpha Paso de aprendizaje.
 * @param {number} [opciones.gamma] Descuento; por omisión el del entorno.
 * @param {number} opciones.episodios Episodios por ejecución.
 * @param {number} opciones.ejecuciones Ejecuciones a promediar.
 * @param {number} opciones.semilla Semilla base.
 * @param {number} [opciones.maxPasos=10000] Tope de pasos por episodio.
 * @param {Function} [opciones.alProgresar] `(fraccion) => void`.
 * @returns {{curva: number[], ejecuciones: number, truncados: number, cortadas: number, cortadaEn: number|null, instantaneas: Float64Array[]}}
 *   `instantaneas` son las de la ejecución 0, una por episodio.
 * @throws {Error} Si el método no es "mc" ni "td".
 */
export function curvaVE(entorno, repr, {
  metodo, alpha, gamma = entorno.gamma, episodios, ejecuciones, semilla,
  maxPasos = 10000, alProgresar = null,
} = {}) {
  if (metodo !== "mc" && metodo !== "td") {
    throw new Error(`curvaVE: metodo debe ser "mc" o "td"; recibido: ${metodo}`);
  }
  validarEnteroPositivo(episodios, "episodios", "curvaVE");
  validarEnteroPositivo(ejecuciones, "ejecuciones", "curvaVE");
  const verdaderos = entorno.valoresVerdaderos;
  const mu = entorno.mu;
  const aprender = metodo === "mc" ? mcGradiente : tdSemiGradiente;

  const contador = { truncados: 0 };
  let cortadas = 0;
  let cortadaEn = null;
  let instantaneasEjecucion0 = null;

  const { media } = promediarEjecuciones((rng, i) => {
    const lote = [];
    for (let k = 0; k < episodios; k++) lote.push(episodioCompleto(entorno, rng, maxPasos, contador));

    /* Se aprende episodio a episodio para poder medir √VE después de cada uno
       sin reprocesar el lote: el motor mantiene w y avanza. */
    const w = new Float64Array(repr.d);
    const serie = [Math.sqrt(errorVE(repr, w, verdaderos, mu))];
    const instantaneas = [Float64Array.from(w)];
    let cortada = false;
    for (let k = 0; k < episodios; k++) {
      if (!cortada) {
        const paso = aprender(entorno, repr, [lote[k]], { alpha, gamma, w0: w, instantaneasCada: 0 });
        w.set(paso.w);
        if (paso.cortada) {
          cortada = true;
          cortadas += 1;
          if (cortadaEn === null || k < cortadaEn) cortadaEn = k;
        }
      }
      serie.push(Math.sqrt(errorVE(repr, w, verdaderos, mu)));
      if (i === 0) instantaneas.push(Float64Array.from(w));
    }
    if (i === 0) instantaneasEjecucion0 = instantaneas;
    if (alProgresar) alProgresar((i + 1) / ejecuciones);
    return serie;
  }, { ejecuciones, semilla });

  return {
    curva: media,
    ejecuciones,
    truncados: contador.truncados,
    cortadas,
    cortadaEn,
    instantaneas: instantaneasEjecucion0,
  };
}

/* ----------------------------------------------------------------------- *
 * 5. Control: SARSA y Q-learning semi-gradientes, con y sin traza
 * ----------------------------------------------------------------------- */

/**
 * Política ε-greedy sobre q̂(S,·,w), con DESEMPATE ALEATORIO uniforme.
 *
 * ⚠ ORDEN DE CONSUMO DEL GENERADOR, QUE ES CONTRATO:
 *   1. un `uniforme()` SIEMPRE, para decidir si explora —también con ε = 0, y
 *      por eso ε = 0 no cambia la secuencia de consumo, solo la decisión;
 *   2. si explora, un `entero(|A|)`;
 *   3. si no explora, un `entero(k)` SOLO si hay k > 1 acciones empatadas
 *      (lo decide `argmax` de `nucleo.js`).
 * El desempate al azar no es un detalle: con w = 0 las TRES acciones empatan
 * exactamente en el primer paso de todos los episodios, y desempatar por
 * índice sesgaría el arranque hacia «gas atrás» (ambigüedad A4 del guion; el
 * libro no dice qué hace).
 *
 * @param {object} repr Representación de control.
 * @param {Float64Array} w Vector de pesos.
 * @param {*} estado Estado del entorno.
 * @param {number} epsilon Probabilidad de explorar.
 * @param {object} rng Generador de `generador(semilla)`.
 * @param {Array} acciones Identificadores de acción del entorno.
 * @returns {{indice: number, accion: *, exploratoria: boolean, valores: number[]}}
 *   El ÍNDICE elegido, su identificador (`acciones[indice]`), si ha salido de
 *   la exploración y los q̂ de las acciones.
 * @throws {Error} Si ε no está en [0, 1] o falta el generador.
 */
export function politicaEpsilonGreedy(repr, w, estado, epsilon, rng, acciones) {
  validarPesos(w, repr, "politicaEpsilonGreedy");
  validarRng(rng, "politicaEpsilonGreedy");
  if (!Number.isFinite(epsilon) || epsilon < 0 || epsilon > 1) {
    throw new Error(`politicaEpsilonGreedy: epsilon debe estar en [0, 1]; recibido: ${epsilon}`);
  }
  const nA = acciones.length;
  const valores = new Array(nA);
  for (let a = 0; a < nA; a++) valores[a] = repr.valor(w, estado, a);

  const explora = rng.uniforme() < epsilon;
  const indice = explora ? rng.entero(nA) : argmax(valores, rng);
  return { indice, accion: acciones[indice], exploratoria: explora, valores };
}

/** max_a q̂(s,a,w) sobre los índices de acción. */
function maximoValor(repr, w, estado, nA) {
  let mejor = -Infinity;
  for (let a = 0; a < nA; a++) {
    const v = repr.valor(w, estado, a);
    if (v > mejor) mejor = v;
  }
  return mejor;
}

/**
 * Estado de la traza de elegibilidad z, con conjunto activo disperso.
 *
 * z vive en el ESPACIO DE LOS PESOS: dimensión d, no |S|×|A|. Es el error que
 * más se comete en el examen y el motor lo hace evidente:
 * `z.length === w.length`.
 *
 * Recorrer los d pesos en cada paso multiplicaría el coste por d/m
 * (1944/8 ≈ 243) y reventaría el presupuesto, así que se mantiene una lista de
 * índices no nulos y se poda por debajo de 1e−8 en valor absoluto: con
 * γλ ≤ 0,99 eso es ruido de redondeo frente a la magnitud de la actualización
 * (addenda §2, punto 3). NO CONSUME AZAR.
 */
function crearTraza(d) {
  return {
    z: new Float64Array(d),
    /* El conjunto activo se guarda como un Int32Array con contador propio y se
       compacta EN EL SITIO: sin `push`, sin arrays nuevos por paso y sin
       iteradores. Es implementación, no matemática, pero es la diferencia entre
       que la tanda de λ > 0 del módulo 5 quepa en el presupuesto y que no. */
    indices: new Int32Array(d),
    n: 0,
    marcado: new Uint8Array(d),
    /** Suma de tamaños del conjunto NO NULO y número de pasos, para medirlo. */
    sumaActivas: 0,
    pasos: 0,
    maximoActivas: 0,

    /** z ← 0 al empezar cada episodio (z_{−1} = 0). */
    reiniciar() {
      for (let k = 0; k < this.n; k++) {
        const i = this.indices[k];
        this.z[i] = 0;
        this.marcado[i] = 0;
      }
      this.n = 0;
    },

    /**
     * z_t = γλ z_{t−1} + x(S_t,A_t)   (acumulativa)
     * z_t = γλ z_{t−1}, y después z_t[i] = x_i para las activas  (reemplazo)
     */
    avanzar(gammaLambda, activas, valores, tipo) {
      if (gammaLambda === 0) {
        this.reiniciar();
      } else {
        let escribe = 0;
        for (let k = 0; k < this.n; k++) {
          const i = this.indices[k];
          const v = this.z[i] * gammaLambda;
          if (v < PODA_TRAZA && v > -PODA_TRAZA) {
            this.z[i] = 0;
            this.marcado[i] = 0;
          } else {
            this.z[i] = v;
            this.indices[escribe++] = i;
          }
        }
        this.n = escribe;
      }
      const reemplaza = tipo === "reemplazo";
      let ceros = 0;
      for (let k = 0; k < activas.length; k++) {
        const i = activas[k];
        const x = valores === null ? 1 : valores[k];
        if (!this.marcado[i]) {
          this.marcado[i] = 1;
          this.indices[this.n++] = i;
        }
        if (reemplaza) this.z[i] = x;
        else this.z[i] += x;
        if (this.z[i] === 0) ceros += 1;
      }
      /* Una componente activa puede valer 0 —x₃ del ejemplo del examen— y
         estar en el conjunto sin estar en la traza: se cuentan las NO NULAS.
         Tras la poda, todo lo que quedaba del paso anterior es no nulo, así que
         basta descontar los ceros que acaban de entrar: no hace falta un tercer
         recorrido del conjunto activo. */
      const noNulas = this.n - ceros;
      this.sumaActivas += noNulas;
      this.pasos += 1;
      if (noNulas > this.maximoActivas) this.maximoActivas = noNulas;
    },

    /** w ← w + α δ z, recorriendo solo el conjunto activo. */
    aplicar(w, escala) {
      for (let k = 0; k < this.n; k++) {
        const i = this.indices[k];
        w[i] += escala * this.z[i];
      }
    },

    /** Los índices con traza NO NULA, ordenados. */
    noNulos() {
      const salida = [];
      for (let k = 0; k < this.n; k++) if (this.z[this.indices[k]] !== 0) salida.push(this.indices[k]);
      return salida.sort((x, y) => x - y);
    },
  };
}

/**
 * La recurrencia de la traza de elegibilidad, y NADA MÁS.
 *
 * Sin azar, sin política y sin pesos: es la que se contrasta contra el
 * apartado g) del problema práctico del examen final y la que alimenta el
 * bloque de apuntes. Con aproximación lineal ∇q̂(s,a,w) = x(s,a), así que:
 *
 *   acumulativa: z_t = γλ z_{t−1} + x(S_t,A_t)
 *   reemplazo:   z_t = γλ z_{t−1}, y después z_t[i] = 1 para cada componente
 *                activa i de x(S_t,A_t)  (la del libro para *tile coding*)
 *
 * con z_{−1} = 0. Con una representación NO BINARIA —la del examen— la traza
 * de reemplazo no está definida en el libro; aquí la componente se pone al
 * VALOR de la característica, que con características binarias es 1 y por
 * tanto coincide con la definición del libro.
 *
 * @param {object} repr Representación de control.
 * @param {Array<{estado: *, accion: number}>} transiciones Pares (S_t, A_t) en
 *   orden; `accion` es el ÍNDICE de la acción.
 * @param {object} opciones
 * @param {number} opciones.gamma Descuento.
 * @param {number} opciones.lambda Parámetro de la traza.
 * @param {string} [opciones.traza="reemplazo"] "reemplazo" | "acumulativa".
 * @returns {{z: Float64Array, indicesNoNulos: Int32Array, historia: Float64Array[]}}
 *   La traza final, sus índices no nulos ordenados y una copia de z después de
 *   cada transición.
 * @throws {Error} Si γ, λ o el tipo de traza no son válidos.
 */
export function trazaTrasPasos(repr, transiciones, { gamma, lambda, traza = "reemplazo" } = {}) {
  validarGamma(gamma, "trazaTrasPasos");
  validarLambda(lambda, "trazaTrasPasos");
  validarTraza(traza, "trazaTrasPasos");
  if (!Array.isArray(transiciones)) {
    throw new Error("trazaTrasPasos: transiciones debe ser un array de {estado, accion}");
  }

  const estado = crearTraza(repr.d);
  const gl = gamma * lambda;
  const historia = [];

  for (const { estado: s, accion: a } of transiciones) {
    const args = a === undefined || a === null ? [s] : [s, a];
    const valores = valoresDe(repr, args);
    if (traza === "reemplazo") exigirBinaria(valores, "trazaTrasPasos");
    estado.avanzar(gl, repr.activas(...args), valores, traza);
    historia.push(Float64Array.from(estado.z));
  }

  /* Sólo los índices con valor NO NULO: una componente activa puede valer 0
     —x₃ del ejemplo del examen vale 0 en los cuatro instantes— y estar en el
     conjunto activo sin estar en la traza. */
  const indicesNoNulos = Int32Array.from(estado.noNulos());
  return { z: estado.z, indicesNoNulos, historia };
}

/**
 * Núcleo común de SARSA y Q-learning semi-gradientes.
 *
 * La ÚNICA diferencia entre los dos es el objetivo —q̂(S',A',w), la acción
 * realmente elegida, frente a max_a q̂(S',a,w)—, y eso es lo que convierte a
 * Q-learning en fuera de política. Aquí es literalmente un `if`.
 *
 * ⚠ ORDEN DE CONSUMO DEL GENERADOR. Los dos algoritmos consumen el azar en el
 * MISMO orden: `inicio` una vez por episodio, y una elección de acción por
 * paso. En SARSA la elección de A' se hace al final del paso y en Q-learning
 * la de A al principio del siguiente, así que la SECUENCIA de llamadas es la
 * misma; por eso con ε = 0 las dos ejecuciones coinciden peso a peso
 * (aserción C5-12). La traza NO consume azar, así que `lambda: 0` da la misma
 * secuencia que el algoritmo de un paso (aserción T-1 de la addenda). No
 * mover ni una llamada al `rng`: cambian todas las cifras sembradas.
 */
function controlSemiGradiente(nombre, entorno, repr, {
  alpha, epsilon, gamma = entorno.gamma, episodios, rng, maxPasos = 5000,
  instantaneasEn = [], lambda = 0, traza = "reemplazo", w0 = null,
}) {
  validarFinito(alpha, "alpha", nombre);
  validarGamma(gamma, nombre);
  validarLambda(lambda, nombre);
  validarTraza(traza, nombre);
  validarEnteroPositivo(episodios, "episodios", nombre);
  validarEnteroPositivo(maxPasos, "maxPasos", nombre);
  validarRng(rng, nombre);

  const acciones = entorno.acciones;
  const nA = acciones.length;
  const w = pesosIniciales(repr.d, w0);
  const usaTraza = lambda > 0;
  const trazaZ = usaTraza ? crearTraza(repr.d) : null;
  const gl = gamma * lambda;

  const pasosPorEpisodio = [];
  const instantaneas = [];
  const pendientesPaso = instantaneasEn.filter((x) => Number.isInteger(x.pasos));
  const pendientesEpisodio = instantaneasEn.filter((x) => Number.isInteger(x.episodio));
  let topes = 0;
  let cortada = false;
  let pasosTotales = 0;
  /* La comprobación de «reemplazo ⟹ características binarias» se paga UNA sola
     vez por ejecución, en el primer paso, y no en cada actualización. */
  let binariaComprobada = !usaTraza || traza !== "reemplazo";

  for (let ep = 0; ep < episodios; ep++) {
    let estado = entorno.inicio(rng);
    let elegida = politicaEpsilonGreedy(repr, w, estado, epsilon, rng, acciones);
    if (usaTraza) trazaZ.reiniciar(); // z ← 0 al empezar cada episodio
    let pasos = 0;
    let tope = true;

    for (let k = 0; k < maxPasos; k++) {
      const { estado2, r, fin } = entorno.paso(estado, elegida.accion);
      pasos += 1;
      pasosTotales += 1;

      const qActual = repr.valor(w, estado, elegida.indice);
      let siguiente = null;
      let objetivo;
      if (fin) {
        /* Línea propia del caso terminal, sin término de continuación: es
           explícito en la caja del libro y es donde más se falla. */
        objetivo = r;
      } else if (nombre === "sarsaSemiGradiente") {
        siguiente = politicaEpsilonGreedy(repr, w, estado2, epsilon, rng, acciones);
        objetivo = r + gamma * repr.valor(w, estado2, siguiente.indice);
      } else {
        objetivo = r + gamma * maximoValor(repr, w, estado2, nA);
      }
      const delta = objetivo - qActual;

      if (usaTraza) {
        const args = [estado, elegida.indice];
        const valores = valoresDe(repr, args);
        if (!binariaComprobada) {
          exigirBinaria(valores, nombre);
          binariaComprobada = true;
        }
        trazaZ.avanzar(gl, repr.activas(...args), valores, traza);
        trazaZ.aplicar(w, alpha * delta);
      } else {
        /* Ruta λ = 0: la de siempre, sin construir z. El resultado es
           idéntico peso a peso al de la ruta con traza y λ = 0 (T-1). */
        repr.acumular(w, alpha * delta, estado, elegida.indice);
      }

      for (const marca of pendientesPaso) {
        if (pasosTotales === marca.pasos) instantaneas.push({ clave: marca.clave, w: Float64Array.from(w) });
      }

      if (fin) {
        tope = false;
        break;
      }
      estado = estado2;
      /* En Q-learning la acción del paso siguiente se elige AQUÍ, al principio
         del paso siguiente, no antes: es lo que mantiene idéntica la secuencia
         de consumo del generador en los dos algoritmos. */
      elegida = siguiente === null
        ? politicaEpsilonGreedy(repr, w, estado, epsilon, rng, acciones)
        : siguiente;
    }

    /* Un episodio truncado no es un episodio terminado: se cuenta como
       `maxPasos` pasos —no se descarta, porque descartarlo falsearía la
       curva— y se informa del número de veces. */
    if (tope) topes += 1;
    pasosPorEpisodio.push(pasos);

    for (const marca of pendientesEpisodio) {
      if (ep + 1 === marca.episodio) instantaneas.push({ clave: marca.clave, w: Float64Array.from(w) });
    }

    if (pesosReventados(w)) {
      cortada = true;
      break;
    }
  }

  const salida = {
    w,
    pasosPorEpisodio,
    instantaneas,
    topes,
    cortada,
    episodiosHechos: pasosPorEpisodio.length,
    pasosTotales,
  };
  if (usaTraza) {
    /* Nombre del campo fijado por el guion v2 (§C1): `trazaNoNulaMedia`.
       Alimenta la métrica `t5.m5.mTraza` y la aserción RT-2. */
    salida.trazaNoNulaMedia = trazaZ.pasos === 0 ? 0 : trazaZ.sumaActivas / trazaZ.pasos;
    salida.trazaNoNulaMaxima = trazaZ.maximoActivas;
  }
  return salida;
}

/**
 * SARSA semi-gradiente episódico (caja de S&B p. 266), con traza opcional.
 *
 *   w ← w + α[R + γ q̂(S',A',w) − q̂(S,A,w)] x(S,A)
 *   w ← w + α[R − q̂(S,A,w)] x(S,A)                    si S' es terminal
 *
 * y con λ > 0, w ← w + α δ z_t, con z_t la traza de la addenda y el MISMO δ.
 *
 * @param {object} entorno Entorno con `acciones`, `inicio(rng)` y `paso`.
 * @param {object} repr Representación de control.
 * @param {object} opciones
 * @param {number} opciones.alpha Paso de aprendizaje.
 * @param {number} opciones.epsilon Exploración.
 * @param {number} [opciones.gamma] Descuento; por omisión el del entorno.
 * @param {number} opciones.episodios Episodios a correr.
 * @param {object} opciones.rng Generador de `generador(semilla)`.
 * @param {number} [opciones.maxPasos=5000] Tope de pasos por episodio.
 * @param {Array<{clave: string, pasos?: number, episodio?: number}>} [opciones.instantaneasEn]
 *   Momentos en los que guardar una copia de w.
 * @param {number} [opciones.lambda=0] 0 = el algoritmo de un paso, sin traza.
 * @param {string} [opciones.traza="reemplazo"] "reemplazo" | "acumulativa",
 *   solo si lambda > 0.
 * @param {Float64Array|number} [opciones.w0] Pesos iniciales; ceros por omisión.
 * @returns {{w: Float64Array, pasosPorEpisodio: number[], instantaneas: Array<{clave: string, w: Float64Array}>, topes: number, cortada: boolean, trazaNoNulaMedia?: number, trazaNoNulaMaxima?: number}}
 *   `topes` cuenta los episodios cortados por `maxPasos` y `cortada` marca que
 *   los pesos han pasado de 1e6. `trazaNoNulaMedia` —solo con λ > 0— es el
 *   tamaño medio del conjunto no nulo de z, que alimenta la métrica
 *   `t5.m5.mTraza` y la aserción RT-2.
 * @throws {Error} Si algún parámetro no es válido.
 */
export function sarsaSemiGradiente(entorno, repr, opciones) {
  return controlSemiGradiente("sarsaSemiGradiente", entorno, repr, opciones);
}

/**
 * Q-learning semi-gradiente (§16.5, ecuación (16.3)), con traza opcional.
 *
 *   w ← w + α[R + γ max_a q̂(S',a,w) − q̂(S,A,w)] x(S,A)
 *
 * con la MISMA línea especial para el caso terminal, sin el término del
 * máximo. El libro no da caja de pseudocódigo para él: se compone de (16.3)
 * más la estructura de la caja de SARSA, y se declara.
 *
 * ⚠ La traza con λ > 0 aquí es la traza «ingenua» —la misma recurrencia, sin
 * cortarla al explorar—, que es lo que pide el examen y lo que escribe la
 * addenda. El libro discute las variantes de Watkins y Peng para Q(λ) en
 * §12.10, que queda FUERA de alcance.
 *
 * @param {object} entorno Igual que en `sarsaSemiGradiente`.
 * @param {object} repr Igual que en `sarsaSemiGradiente`.
 * @param {object} opciones Los mismos que en `sarsaSemiGradiente`.
 * @returns {object} Lo mismo que `sarsaSemiGradiente`.
 * @throws {Error} Si algún parámetro no es válido.
 */
export function qLearningSemiGradiente(entorno, repr, opciones) {
  return controlSemiGradiente("qLearningSemiGradiente", entorno, repr, opciones);
}

/**
 * Coste por recorrer, −max_a q̂(s,a,w), sobre una rejilla del espacio de
 * estados: es la superficie de la figura 10.1 del libro.
 *
 * @param {object} repr Representación de control.
 * @param {Float64Array} w Vector de pesos.
 * @param {object} opciones
 * @param {number[][]} opciones.rangos [[minX, maxX], [minY, maxY]].
 * @param {number} [opciones.celdas=60] Celdas por lado.
 * @param {Array} opciones.acciones Identificadores de acción (solo su número
 *   importa: la representación indexa por índice).
 * @returns {{valores: Float64Array, maximo: number, minimo: number, celdas: number}}
 *   `valores` en orden FILA-MAYOR con la fila = eje y (velocidad) y la
 *   columna = eje x (posición), que es lo que espera `campoCalor`. Los puntos
 *   son los CENTROS de las celdas.
 * @throws {Error} Si celdas no es un entero ≥ 1.
 */
export function costePorRecorrer(repr, w, { rangos, celdas = 60, acciones }) {
  validarPesos(w, repr, "costePorRecorrer");
  validarEnteroPositivo(celdas, "celdas", "costePorRecorrer");
  const nA = acciones.length;
  const [[xMin, xMax], [yMin, yMax]] = rangos;
  const dx = (xMax - xMin) / celdas;
  const dy = (yMax - yMin) / celdas;
  const valores = new Float64Array(celdas * celdas);
  let maximo = -Infinity;
  let minimo = Infinity;

  for (let iy = 0; iy < celdas; iy++) {
    const v = yMin + (iy + 0.5) * dy;
    for (let ix = 0; ix < celdas; ix++) {
      const p = xMin + (ix + 0.5) * dx;
      const coste = -maximoValor(repr, w, { p, v }, nA);
      valores[iy * celdas + ix] = coste;
      if (coste > maximo) maximo = coste;
      if (coste < minimo) minimo = coste;
    }
  }

  return { valores, maximo, minimo, celdas };
}

/* ----------------------------------------------------------------------- *
 * 6. Divergencia: el fragmento w → 2w
 * ----------------------------------------------------------------------- */

/**
 * El fragmento de MDP de dos estados y UN SOLO PESO de S&B §11.2, p. 282.
 *
 * x(s₁) = 1, x(s₂) = 2, R = 0 en las dos transiciones y v̂(terminal,w) = 0.
 *
 * FUERA DE POLÍTICA (el ejemplo del libro): se actualiza una y otra vez la
 * misma transición s₁ → s₂, con ρ = 1 porque de s₁ sale una única acción:
 *   δ_t = 0 + γ·2w_t − w_t = (2γ−1)w_t
 *   w_{t+1} = (1 + α(2γ−1)) w_t
 * y el factor pasa de 1 exactamente cuando γ > 0,5, PARA CUALQUIER α > 0.
 *
 * DENTRO DE POLÍTICA (cierre añadido por el recurso, NO está en el libro y se
 * declara en pantalla): el episodio completo es s₁ → s₂ → terminal, y por
 * episodio w'' = (1 + α(2γ−1))(1 − 4α) w.
 *
 * No se muestrea nada: se itera una recurrencia lineal cerrada. Si |w| pasa de
 * 1e12 se detiene, se marca `desbordado` y NO se devuelve NaN ni Infinity.
 *
 * @param {object} opciones
 * @param {number} opciones.gamma Descuento.
 * @param {number} opciones.alpha Paso de aprendizaje.
 * @param {number} [opciones.w0=10] Peso inicial (el de la ilustración del libro).
 * @param {number} [opciones.pasos=60] Iteraciones a devolver.
 * @param {string} [opciones.regimen="off"] "off" (solo s₁→s₂, repetida) |
 *   "on" (episodio completo con terminal).
 * @returns {{serie: number[], factor: number, veredicto: string, pasosHastaMil: number|null, A: number, b: number, wTD: number, desbordado: boolean, traza: Array}}
 *   `veredicto` es "divergen" | "convergen" | "quietos", las claves i18n del
 *   módulo 4. `traza` son las primeras iteraciones con su δ y su Δw.
 * @throws {Error} Si el régimen no es "off" ni "on".
 */
export function fragmentoW2W({ gamma, alpha, w0 = 10, pasos = 60, regimen = "off" } = {}) {
  validarGamma(gamma, "fragmentoW2W");
  validarFinito(alpha, "alpha", "fragmentoW2W");
  validarFinito(w0, "w0", "fragmentoW2W");
  validarEnteroPositivo(pasos, "pasos", "fragmentoW2W");
  if (regimen !== "off" && regimen !== "on") {
    throw new Error(`fragmentoW2W: regimen debe ser "off" u "on"; recibido: ${regimen}`);
  }

  const factorPrimera = 1 + alpha * (2 * gamma - 1);
  const factorSalida = 1 - 4 * alpha;
  const factor = regimen === "off" ? factorPrimera : factorPrimera * factorSalida;

  /* A y b de (9.11)-(9.12) evaluados a mano sobre este fragmento:
       fuera de política, μ concentrada en s₁:  A = 1·(1 − 2γ),  b = 0
       dentro de política, μ = (1/2, 1/2):      A = ((1−2γ) + 4)/2 = (5−2γ)/2,
                                                b = 0 (todas las recompensas son 0)
     Con b = 0 el punto fijo es w_TD = 0 siempre que A ≠ 0. */
  const A = regimen === "off" ? 1 - 2 * gamma : (5 - 2 * gamma) / 2;
  const b = 0;
  const wTD = 0;

  const serie = [w0];
  const traza = [];
  let w = w0;
  let desbordado = false;
  for (let t = 0; t < pasos; t++) {
    const deltaPrimera = (2 * gamma - 1) * w;
    const wIntermedio = w + alpha * deltaPrimera;
    let wSiguiente = wIntermedio;
    let deltaSalida = null;
    if (regimen === "on") {
      deltaSalida = -2 * wIntermedio; // 0 + γ·0 − 2w'
      wSiguiente = wIntermedio + alpha * deltaSalida * 2; // ∇v̂(s₂) = x(s₂) = 2
    }
    if (traza.length < 6) {
      traza.push({
        t,
        w,
        delta: deltaPrimera,
        deltaW: alpha * deltaPrimera,
        wSiguiente,
        deltaSalida,
      });
    }
    if (Math.abs(wSiguiente) > 1e12) {
      desbordado = true;
      break;
    }
    w = wSiguiente;
    serie.push(w);
  }

  /* Actualizaciones hasta |w| > 1000: se invierte la exponencial, no se
     transcribe ninguna cifra (aserción C4-9). */
  let pasosHastaMil = null;
  const objetivo = 1000;
  if (Math.abs(w0) > objetivo) {
    pasosHastaMil = 0;
  } else if (w0 !== 0 && Math.abs(factor) > 1) {
    pasosHastaMil = Math.ceil(Math.log(objetivo / Math.abs(w0)) / Math.log(Math.abs(factor)));
  }

  let veredicto = "quietos";
  if (w0 !== 0 && Math.abs(factor) > 1) veredicto = "divergen";
  else if (w0 !== 0 && Math.abs(factor) < 1) veredicto = "convergen";

  return { serie, factor, veredicto, pasosHastaMil, A, b, wTD, desbordado, traza };
}

/**
 * Contraejemplo de Baird — SOLO DATOS (S&B §11.2, pp. 283-285).
 *
 * No hay simulación de Baird en este motor: el guion decidió contarlo con
 * texto, figura y ficha de datos, y explicar el mecanismo con el ejemplo
 * mínimo w → 2w. Los pesos se escriben w y w⁻ y no θ: `notacion.md` reserva θ
 * para los parámetros de la política del tema 6, y la figura 11.2 del libro
 * usa θ sin avisar (erratum E5 del guion).
 */
export const BAIRD = Object.freeze({
  nEstados: 7,
  nPesos: 8,
  acciones: Object.freeze(["dashed", "solid"]),
  /** b(dashed|·) = 6/7 y b(solid|·) = 1/7, que hace uniforme el estado siguiente. */
  b: Object.freeze({ dashed: 6 / 7, solid: 1 / 7 }),
  /** π(solid|·) = 1: la política objetivo siempre toma la acción sólida. */
  pi: Object.freeze({ dashed: 0, solid: 1 }),
  gamma: 0.99,
  alpha: 0.01,
  recompensa: 0,
  /** w₀ de la figura 11.2, literal de la p. 284. */
  w0: Object.freeze([1, 1, 1, 1, 1, 1, 10, 1]),
  /** x(i) = 2e_i + e₈ para i = 1…6, y x(7) = e₇ + 2e₈ (literal, p. 284). */
  caracteristicas: Object.freeze([
    Object.freeze([2, 0, 0, 0, 0, 0, 0, 1]),
    Object.freeze([0, 2, 0, 0, 0, 0, 0, 1]),
    Object.freeze([0, 0, 2, 0, 0, 0, 0, 1]),
    Object.freeze([0, 0, 0, 2, 0, 0, 0, 1]),
    Object.freeze([0, 0, 0, 0, 2, 0, 0, 1]),
    Object.freeze([0, 0, 0, 0, 0, 2, 0, 1]),
    Object.freeze([0, 0, 0, 0, 0, 0, 1, 2]),
  ]),
  /** v_π(s) = 0 para todo s, y se puede representar exactamente con w = 0. */
  valorVerdadero: 0,
  cita: "S&B §11.2, figuras 11.1 y 11.2, pp. 283-285",
});

/* ----------------------------------------------------------------------- *
 * 7. Las dos tablas de convergencia
 *
 * ⚠ LAS DOS TABLAS NO SON DEL LIBRO: son de las diapositivas de David Silver
 * (UCL), y `5_Tema_5_1#slide-2` declara la fuente. Se atribuyen en pantalla
 * (ambigüedad A8 del guion). Aquí son DATOS transcritos, no un cálculo: el
 * único cálculo es la regla de conteo de inductores.
 * ----------------------------------------------------------------------- */

const ALGORITMOS_PREDICCION = ["mc", "td0"];
const ALGORITMOS_CONTROL = ["mcControl", "sarsa", "qLearning"];
const APROXIMADORES = ["tabular", "lineal", "noLineal"];

/** Los algoritmos que hacen *bootstrapping*: usan estimaciones en su objetivo. */
const CON_BOOTSTRAPPING = new Set(["td0", "sarsa", "qLearning"]);

/**
 * Los tres inductores de inestabilidad de una combinación (§11.3, p. 286).
 *
 * · aproximación: presente si el aproximador es lineal o no lineal.
 * · bootstrapping: presente en TD(0), SARSA y Q-learning; ausente en MC.
 * · fuera de política: presente si el interruptor lo dice y SIEMPRE en
 *   Q-learning.
 *
 * Y la regla del libro: con los tres, los pesos pueden divergir; con dos o
 * menos, la inestabilidad se puede evitar.
 *
 * @param {object} casilla
 * @param {string} casilla.algoritmo "mc" | "td0" | "mcControl" | "sarsa" | "qLearning".
 * @param {string} casilla.aproximador "tabular" | "lineal" | "noLineal".
 * @param {string} casilla.politica "dentro" | "fuera".
 * @returns {{aproximacion: boolean, bootstrapping: boolean, fueraDePolitica: boolean, total: number}}
 * @throws {Error} Si algún identificador no existe.
 */
export function contarInductores({ algoritmo, aproximador, politica }) {
  if (!ALGORITMOS_PREDICCION.includes(algoritmo) && !ALGORITMOS_CONTROL.includes(algoritmo)) {
    throw new Error(`contarInductores: algoritmo desconocido: ${algoritmo}`);
  }
  if (!APROXIMADORES.includes(aproximador)) {
    throw new Error(`contarInductores: aproximador desconocido: ${aproximador}`);
  }
  if (politica !== "dentro" && politica !== "fuera") {
    throw new Error(`contarInductores: politica debe ser "dentro" o "fuera"; recibido: ${politica}`);
  }
  const aproximacion = aproximador !== "tabular";
  const bootstrapping = CON_BOOTSTRAPPING.has(algoritmo);
  const fueraDePolitica = politica === "fuera" || algoritmo === "qLearning";
  return {
    aproximacion,
    bootstrapping,
    fueraDePolitica,
    total: (aproximacion ? 1 : 0) + (bootstrapping ? 1 : 0) + (fueraDePolitica ? 1 : 0),
  };
}

/** Monta una casilla con su clave i18n canónica. */
function casilla(algoritmo, aproximador, politica, veredicto, cita) {
  return Object.freeze({
    algoritmo,
    aproximador,
    politica,
    veredicto,
    clave: `t5.m6.celda.${algoritmo}.${aproximador}.${politica}`,
    cita,
  });
}

/** La marca explícita de las casillas que el libro no cubre (aserción C6-8). */
const NO_CUBIERTO = "No cubierto por Sutton & Barto";

/**
 * Tabla de convergencia de PREDICCIÓN: 12 casillas.
 *
 * El orden de las filas es el de la diapositiva —MC dentro, TD(0) dentro, MC
 * fuera, TD(0) fuera— y las columnas tabular / lineal / no lineal, de modo que
 * los veredictos leídos por filas son `SÍ SÍ SÍ / SÍ SÍ NO / SÍ SÍ NO /
 * SÍ NO NO` (aserción C6-1).
 *
 * `veredicto`: "si" | "no". En la columna lineal «no» es «hay contraejemplo de
 * divergencia»; en la no lineal es «sin garantía», que NO es lo mismo
 * (ambigüedad A6).
 */
export const TABLA_PREDICCION = Object.freeze([
  casilla("mc", "tabular", "dentro", "si", "S&B, capítulo 5; Exercise 9.1"),
  casilla("mc", "lineal", "dentro", "si", "S&B §9.4, p. 227"),
  casilla("mc", "noLineal", "dentro", "si", "S&B §9.3, p. 224, y §9.2, p. 222"),
  casilla("td0", "tabular", "dentro", "si", "S&B §6.2"),
  casilla("td0", "lineal", "dentro", "si", "S&B §9.4, pp. 228-229, ecuaciones (9.12) y (9.14)"),
  casilla("td0", "noLineal", "dentro", "no", "S&B §9.7, p. 250"),
  casilla("mc", "tabular", "fuera", "si", "S&B §5.5 y §11.10, p. 306"),
  casilla("mc", "lineal", "fuera", "si", "S&B §11.3, p. 286"),
  casilla("mc", "noLineal", "fuera", "no", `${NO_CUBIERTO}; para la varianza, S&B §5.5, Example 5.5`),
  casilla("td0", "tabular", "fuera", "si", "S&B §6.5 y §11.3, p. 286"),
  casilla("td0", "lineal", "fuera", "no", "S&B §11.2, figuras 11.1 y 11.2, p. 284"),
  casilla("td0", "noLineal", "fuera", "no", "S&B §11.2, pp. 284-285, y §9.7, p. 250"),
]);

/**
 * Tabla de convergencia de CONTROL: 9 casillas.
 *
 * Veredictos por filas: `SÍ (SÍ) NO / SÍ (SÍ) NO / SÍ NO NO` (aserción C6-2).
 * `veredicto`: "si" | "casi" | "no", donde "casi" es el «(SÍ)» del recuadro
 * —«cerca, pero no quieto»—, que no es por la aproximación en sí, sino porque
 * la política cambia: la garantía de la predicción está enunciada para
 * política constante.
 *
 * La tabla NO separa dentro y fuera de política: MC control y SARSA son dentro
 * de política por construcción y Q-learning es fuera. La combinación
 * «Q-learning · dentro de política» NO EXISTE y `fichaCasilla` la rechaza
 * (aserción C6-7).
 */
export const TABLA_CONTROL = Object.freeze([
  casilla("mcControl", "tabular", "dentro", "si", "S&B §5.3 y §5.4"),
  casilla("mcControl", "lineal", "dentro", "casi", "S&B §10.1, p. 266, y nota bibliográfica 10.1, p. 278"),
  casilla("mcControl", "noLineal", "dentro", "no", `${NO_CUBIERTO}; S&B §9.7, p. 250`),
  casilla("sarsa", "tabular", "dentro", "si", "S&B §6.4"),
  casilla("sarsa", "lineal", "dentro", "casi", "S&B, nota bibliográfica 10.1, p. 278 (Gordon, 1996a, 2001); §10.1, p. 266"),
  casilla("sarsa", "noLineal", "dentro", "no", `${NO_CUBIERTO}; S&B §9.7, p. 250`),
  casilla("qLearning", "tabular", "fuera", "si", "S&B §6.5; §11.2, p. 285"),
  casilla("qLearning", "lineal", "fuera", "no", "S&B §11.2, p. 285, y nota bibliográfica 11.2, p. 307"),
  casilla("qLearning", "noLineal", "fuera", "no", "S&B §11.2, pp. 284-285; §16.5, p. 462"),
]);

/**
 * La ficha de evidencia de una casilla: veredicto, clave del texto, cita,
 * recuento de inductores y si la regla de la tríada la explica.
 *
 * `cuadraConLaRegla` es false en exactamente dos de las doce casillas de
 * predicción —«TD(0) · no lineal · dentro» y «MC · no lineal · fuera»—, y las
 * dos están en la columna no lineal: es la enumeración completa de las
 * excepciones, que es lo que enseña el módulo 6 (aserciones C6-4 y C6-5).
 *
 * @param {object} consulta
 * @param {string} consulta.algoritmo Identificador del algoritmo.
 * @param {string} consulta.aproximador Identificador del aproximador.
 * @param {string} consulta.politica "dentro" | "fuera".
 * @returns {{veredicto: string, clave: string, cita: string, inductores: object, cuadraConLaRegla: boolean, tabla: string}}
 * @throws {Error} Si la combinación no existe en ninguna de las dos tablas
 *   (en particular, «Q-learning · dentro de política»).
 */
export function fichaCasilla({ algoritmo, aproximador, politica }) {
  const buscar = (tabla) =>
    tabla.find((c) => c.algoritmo === algoritmo && c.aproximador === aproximador && c.politica === politica);
  const enPrediccion = buscar(TABLA_PREDICCION);
  const encontrada = enPrediccion || buscar(TABLA_CONTROL);
  if (!encontrada) {
    throw new Error(
      `fichaCasilla: la combinación ${algoritmo} · ${aproximador} · ${politica} no existe en las tablas`,
    );
  }
  const inductores = contarInductores({ algoritmo, aproximador, politica });
  const cuadraConLaRegla = inductores.total === 3
    ? encontrada.veredicto === "no"
    : encontrada.veredicto !== "no";
  return {
    veredicto: encontrada.veredicto,
    clave: encontrada.clave,
    cita: encontrada.cita,
    inductores,
    cuadraConLaRegla,
    tabla: enPrediccion ? "prediccion" : "control",
  };
}
