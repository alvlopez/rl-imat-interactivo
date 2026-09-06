/* ==========================================================================
   RL · IMAT — motor de n pasos, retorno λ y trazas de elegibilidad (Tema 4b)
   Sin dependencias. Módulo ES: se usa igual desde el navegador y desde node.
   NO TOCA EL DOM: es matemática pura y testeable con `node --test`.

   Por qué no cabe en `sinmodelo.js`: aquel cubre los capítulos 5 y 6 —una
   transición o un episodio completo— y lo usa `tema4.html`, cuyos tests no se
   pueden romper. Todo lo de aquí necesita VENTANAS DE n PASOS y ESTADO QUE
   PERSISTE ENTRE PASOS (las sumas acumuladas y el vector de trazas), que es un
   cambio de firma en todo lo anterior. `sinmodelo.js` y `mdp.js` NO se tocan
   ni una línea: este fichero solo los importa.

   Diapositivas: 4_Tema4_2#slide-4 a #slide-15.
   Libro: Sutton & Barto §7.1, §7.2 (Example 7.1, figuras 7.2 y 7.4) y
   §12.1, §12.2, §12.6 (ecuaciones 12.2-12.7 y 12.12).

   ─────────────────────────────────────────────────────────────────────────
   TRES DECISIONES QUE HAY QUE LEER ANTES DE TOCAR NADA

   1. CONVENCIÓN DE TRUNCAMIENTO.  En (7.1), si la ventana llega a la
      terminación o la pasa —es decir, si τ + n ≥ T— NO se suma el término de
      arranque γⁿ V(S_{τ+n}) y el retorno a n pasos se define igual al retorno
      completo:  G_{τ:τ+n} ≐ G_τ.  Es la línea «Si τ + n < T» del pseudocódigo
      y el error de implementación más frecuente del capítulo 7: sin ella, n
      grande no es Monte Carlo sino una aproximación suya, y se cae la
      equivalencia que comprueban los tests. Vive en un solo sitio,
      `retornoDesde`, y todo lo demás pasa por ahí.

   2. LA FORMA TABULAR DE TD(λ) NO ESTÁ EN LA 2.ª EDICIÓN DEL LIBRO.  El
      capítulo 12 está escrito entero con aproximación de funciones: las
      ecuaciones (12.5)-(12.7) hablan de z_t ∈ ℝ^d y de ∇v̂(S_t, w_t). Lo que
      implementa `tdLambdaAtras` es la ADAPTACIÓN al caso tabular —el caso
      lineal con x(s) = e_s, donde el gradiente es el vector indicador y el «1»
      de la traza es exactamente ese gradiente—, que es la forma en que lo
      presenta la diapositiva `4_Tema4_2#slide-13`. Es legítima, pero no hay
      pseudocódigo tabular en el libro con el que contrastarla: se contrasta
      contra el caso lineal y contra la vista hacia adelante (§12.2).

   3. TRAZAS IMPLEMENTADAS.  La diapositiva escribe una sola,
      z_t(s) = γλ z_{t-1}(s) + 1(S_t = s), y no dice que sea una de tres ni le
      pone nombre: es la traza ACUMULATIVA. Aquí se implementa esa y, porque
      el módulo 2 la necesita como conmutador para enseñar que la elección no
      es un detalle, la de REEMPLAZO (§12.6, ec. 12.12; solo está definida en
      el caso tabular o con características binarias). La traza DUTCH —la de
      *true online* TD(λ), §12.5, ec. 12.11, la mejor fundamentada según el
      libro— queda FUERA: necesita la formulación con w del Tema 5.

   ─────────────────────────────────────────────────────────────────────────
   ALEATORIEDAD

   Ninguna función de este fichero llama al azar global del lenguaje. Es más:
   ninguna consume azar en absoluto. El módulo 1 recibe el lote de episodios
   YA GENERADO por `loteEpisodios` de `sinmodelo.js` (un solo generador para
   todo el lote, que es la condición del libro «los mismos caminos para todos
   los ajustes de parámetros») y el módulo 2 es determinista y cerrado.

   ─────────────────────────────────────────────────────────────────────────
   ÍNDICES

   Los estados van en BASE 0. El paseo aleatorio de 19 estados ocupa los
   índices 0…18 y sus dos terminales viven fuera, en 19 y 20. El guion del
   tema los escribe en base 1 (S₀ = 10 … S₉ = 19 para el camino directo); en
   base 0 eso es S₀ = 9 … S₉ = 18. Por eso `caminoDirectoDerecha` no cablea
   índices: los saca del entorno.
   ========================================================================== */

import { errorRMS, muestrearEpisodio } from "./sinmodelo.js";

/** Los diez valores de n de la figura 7.2, en potencias de 2. */
const NS_FIGURA = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512];

/** Los 21 valores de α del barrido: 0; 0,05; …; 1. Se calculan, no se listan. */
const ALPHAS_FIGURA = Array.from({ length: 21 }, (_, i) => i / 20);

/* ----------------------------------------------------------------------- *
 * 0. Validación
 *
 * Se repiten aquí en vez de importarlas porque `sinmodelo.js` no las exporta
 * y no se toca. Son cuatro líneas: menos deuda que abrir su interfaz.
 * ----------------------------------------------------------------------- */

function validarAlpha(alpha, nombre) {
  /* α = 0 es válido: es el primer punto del eje del barrido (V no cambia y el
     RMS se queda en el de la inicialización). No es un caso degenerado. */
  if (!Number.isFinite(alpha)) {
    throw new Error(`${nombre}: alpha debe ser un número finito; recibido: ${alpha}`);
  }
}

function validarN(n, nombre) {
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`${nombre}: n debe ser un entero ≥ 1; recibido: ${n}`);
  }
}

function validarLambda(lambda, nombre) {
  if (!Number.isFinite(lambda) || lambda < 0 || lambda > 1) {
    throw new Error(`${nombre}: lambda debe estar en [0, 1]; recibido: ${lambda}`);
  }
}

function validarTraza(traza, nombre) {
  if (traza !== "acumulativa" && traza !== "reemplazo") {
    throw new Error(`${nombre}: traza debe ser "acumulativa" o "reemplazo"; recibido: ${traza}`);
  }
}

/* ----------------------------------------------------------------------- *
 * 1. Retorno a n pasos y n-step TD  (S&B §7.1, ecuaciones 7.1 y 7.2)
 * ----------------------------------------------------------------------- */

/**
 * Sumas acumuladas de las recompensas: C_k = Σ_{j<k} R_{j+1}, con C_0 = 0.
 *
 * Con γ = 1 —que es el caso del paseo aleatorio y de todo el tema— la suma
 * Σ_{i=τ+1}^{mín(τ+n,T)} γ^{i−τ−1} R_i vale C_{mín(τ+n,T)} − C_τ. Es
 * ARITMÉTICAMENTE IDÉNTICA, no una aproximación, y baja el coste de cada
 * actualización de O(n) a O(1). Sin esto, el barrido con n = 512 no cabe en
 * el presupuesto de tiempo de la página.
 */
function sumasAcumuladas(recompensas) {
  const c = new Array(recompensas.length + 1).fill(0);
  for (let k = 0; k < recompensas.length; k++) c[k + 1] = c[k] + recompensas[k];
  return c;
}

/** Σ_{j=desde}^{hasta−1} γ^{j−desde} R_{j+1}, camino lento (γ ≠ 1). */
function sumaDescontada(recompensas, desde, hasta, gamma) {
  let suma = 0;
  let peso = 1;
  for (let j = desde; j < hasta; j++) {
    suma += peso * recompensas[j];
    peso *= gamma;
  }
  return suma;
}

/**
 * G_{τ:τ+n} genérico: el único sitio donde vive la ecuación (7.1).
 *
 * `valorDe(i)` devuelve la estimación del instante i con la que se arranca:
 * V(S_i) para predicción (7.1) y Q(S_i, A_i) para SARSA a n pasos (7.4). Así
 * la convención de truncamiento se escribe UNA vez y no se pueden desincronizar
 * la versión de estados y la de pares estado-acción.
 */
function retornoDesde(episodio, tau, n, gamma, acumuladas, valorDe) {
  const { recompensas, T } = episodio;
  const fin = Math.min(tau + n, T);
  let g = gamma === 1 && acumuladas
    ? acumuladas[fin] - acumuladas[tau]
    : sumaDescontada(recompensas, tau, fin, gamma);
  /* Truncamiento: si τ + n ≥ T no hay término de arranque y G_{τ:τ+n} = G_τ. */
  if (tau + n < T) g += gamma ** n * valorDe(tau + n);
  return g;
}

/**
 * Retorno a n pasos G_{τ:τ+n} — Sutton & Barto, ecuación (7.1).
 *
 * @param {object} episodio Episodio de `muestrearEpisodio`.
 * @param {number} tau Instante τ cuyo valor se va a actualizar, en [0, T).
 * @param {number} n Pasos de arranque.
 * @param {number[]} V Estimaciones EN EL MOMENTO de la llamada (no se copia).
 * @param {number} gamma Descuento.
 * @param {number[]|null} acumuladas Sumas acumuladas precalculadas (opcional,
 *   solo se usa con γ = 1; es la vía rápida que emplea `nStepTD`).
 * @returns {number} G_{τ:τ+n}, ya truncado si τ + n ≥ T.
 * @throws {Error} Si `n` no es un entero ≥ 1 o τ cae fuera de [0, T).
 */
export function retornoNPasos(episodio, tau, n, V, gamma = 1, acumuladas = null) {
  validarN(n, "retornoNPasos");
  if (!Number.isInteger(tau) || tau < 0 || tau >= episodio.T) {
    throw new Error(`retornoNPasos: tau debe estar en [0, ${episodio.T}); recibido: ${tau}`);
  }
  return retornoDesde(episodio, tau, n, gamma, acumuladas, (i) => V[episodio.estados[i]]);
}

/**
 * TD a n pasos sobre un episodio ya muestreado — ecuación (7.2). Muta `V`.
 *
 * Recorre τ = 0 … T−1 en orden CRECIENTE con V viva, que es lo que hace que
 * V(S_τ) se actualice con V_{τ+n−1} y no con la V del principio del episodio.
 * El total es siempre T actualizaciones, sea cual sea n: lo que cambia es
 * cuándo se hacen (las n−1 primeras esperan, las n−1 últimas se hacen ya
 * terminado el episodio) y con qué objetivo.
 *
 * @param {number[]} V Vector de valores, se modifica in situ.
 * @param {object} episodio Episodio de `muestrearEpisodio`.
 * @param {object} opciones
 * @param {number} opciones.n Pasos de arranque.
 * @param {number} opciones.alpha Paso de aprendizaje.
 * @param {number} opciones.gamma Descuento.
 * @param {boolean} opciones.registro Si `true`, devuelve la traza detallada.
 * @returns {{actualizaciones: number, traza: Array<object>|null}} `traza` trae
 *   una entrada `{ t, tau, estado, G, antes, despues }` por actualización, con
 *   `t = τ + n − 1` el instante en el que se hace; `null` si `registro` es
 *   `false`. Es lo que consume el cronograma del módulo 1.
 * @throws {Error} Si `n` o `alpha` no son válidos.
 */
export function nStepTD(V, episodio, { n, alpha, gamma = 1, registro = false } = {}) {
  validarN(n, "nStepTD");
  validarAlpha(alpha, "nStepTD");
  const { estados, recompensas, T } = episodio;
  const acumuladas = gamma === 1 ? sumasAcumuladas(recompensas) : null;
  const valorDe = (i) => V[estados[i]];
  const traza = registro ? [] : null;

  for (let tau = 0; tau < T; tau++) {
    const s = estados[tau];
    const g = retornoDesde(episodio, tau, n, gamma, acumuladas, valorDe);
    const antes = V[s];
    V[s] = antes + alpha * (g - antes);
    if (registro) traza.push({ t: tau + n - 1, tau, estado: s, G: g, antes, despues: V[s] });
  }
  return { actualizaciones: T, traza };
}

/**
 * SARSA a n pasos sobre un episodio ya muestreado — ecuaciones (7.4) y (7.5).
 * Muta `Q`.
 *
 * Con n = 1 es exactamente `sarsaEpisodio` de `sinmodelo.js`, que es lo que
 * el libro rebautiza «SARSA a un paso» o «SARSA(0)».
 *
 * La política NO se mejora aquí: el episodio ya viene muestreado, así que esto
 * es la parte de evaluación del pseudocódigo (la línea «asegurar que π(·|S_τ)
 * es ε-greedy» la hace quien construye el bucle de control, no esta función).
 *
 * @param {Array<number[]>} Q Tabla de valores de acción, se modifica in situ.
 * @param {object} episodio Episodio con una acción por paso.
 * @param {object} opciones Iguales que en `nStepTD`.
 * @returns {{actualizaciones: number, traza: Array<object>|null}} Las entradas
 *   de `traza` llevan además `accion`.
 * @throws {Error} Si `n` o `alpha` no son válidos, o si faltan acciones.
 */
export function nStepSarsa(Q, episodio, { n, alpha, gamma = 1, registro = false } = {}) {
  validarN(n, "nStepSarsa");
  validarAlpha(alpha, "nStepSarsa");
  const { estados, acciones, recompensas, T } = episodio;
  if (T > 0 && acciones.length !== T) {
    throw new Error("nStepSarsa: el episodio no trae una acción por paso");
  }
  const acumuladas = gamma === 1 ? sumasAcumuladas(recompensas) : null;
  /* Q(terminal, ·) = 0: el episodio no incluye el terminal, así que el único
     modo de llegar aquí es con τ + n < T, y entonces S_{τ+n} no es terminal. */
  const valorDe = (i) => Q[estados[i]][acciones[i]];
  const traza = registro ? [] : null;

  for (let tau = 0; tau < T; tau++) {
    const s = estados[tau];
    const a = acciones[tau];
    const g = retornoDesde(episodio, tau, n, gamma, acumuladas, valorDe);
    const antes = Q[s][a];
    Q[s][a] = antes + alpha * (g - antes);
    if (registro) {
      traza.push({ t: tau + n - 1, tau, estado: s, accion: a, G: g, antes, despues: Q[s][a] });
    }
  }
  return { actualizaciones: T, traza };
}

/* ----------------------------------------------------------------------- *
 * 2. El barrido n × α  (reproducción de la figura 7.2)
 * ----------------------------------------------------------------------- */

/**
 * Barrido de los pares (n, α) sobre un lote de episodios ya generado.
 *
 * El lote se genera UNA sola vez fuera (con `loteEpisodios`) y se reproduce
 * entero para cada uno de los pares: es la condición literal del libro, «se
 * usaron los mismos conjuntos de caminos para todos los ajustes de
 * parámetros». Sin eso las curvas se cruzan por suerte y la conclusión del
 * módulo se invierte.
 *
 * La métrica es la del libro: el RMS sobre los estados no terminales medido
 * AL FINAL DE CADA EPISODIO, promediado sobre los `episodios` primeros
 * episodios y sobre todas las repeticiones.
 *
 * @param {Array<Array<object>>} lote Salida de `loteEpisodios`.
 * @param {object} opciones
 * @param {number[]} opciones.ns Valores de n a barrer.
 * @param {number[]} opciones.alphas Valores de α a barrer.
 * @param {number} opciones.episodios Episodios de cada repetición que se usan.
 * @param {number[]} opciones.vVerdadero v_π exacto, un valor por estado.
 * @param {number} opciones.valorInicial Valor con el que se reinicia V.
 * @param {number} opciones.nEstados Tamaño de V; por omisión, el de `vVerdadero`.
 * @param {number} opciones.gamma Descuento.
 * @param {Function|null} opciones.alProgresar Callback `(hechos, total)`.
 * @returns {{curvas: object, mejor: object, mejorPorN: object, ns: number[], alphas: number[]}}
 *   `curvas[n]` es el RMS medio para cada α, en el orden de `alphas`. En los
 *   empates gana el primero, es decir, el n y el α más pequeños.
 * @throws {Error} Si falta `vVerdadero`, el lote está vacío o no hay episodios
 *   suficientes en alguna repetición.
 */
export function barridoNAlpha(lote, {
  ns = NS_FIGURA,
  alphas = ALPHAS_FIGURA,
  episodios = 10,
  vVerdadero,
  valorInicial = 0,
  nEstados,
  gamma = 1,
  alProgresar = null,
} = {}) {
  if (!Array.isArray(lote) || lote.length === 0) {
    throw new Error("barridoNAlpha: el lote está vacío");
  }
  if (!Array.isArray(vVerdadero) || vVerdadero.length === 0) {
    throw new Error("barridoNAlpha: hace falta vVerdadero para medir el error");
  }
  for (const repeticion of lote) {
    if (repeticion.length < episodios) {
      throw new Error(
        `barridoNAlpha: cada repetición necesita al menos ${episodios} episodios; hay ${repeticion.length}`,
      );
    }
  }
  const tamano = nEstados ?? vVerdadero.length;
  const total = ns.length * alphas.length;

  const curvas = {};
  const mejorPorN = {};
  let mejor = { n: null, alpha: null, rms: Infinity };
  let hechos = 0;

  for (const n of ns) {
    validarN(n, "barridoNAlpha");
    const curva = [];
    let mejorDeN = { alpha: null, rms: Infinity };

    for (const alpha of alphas) {
      validarAlpha(alpha, "barridoNAlpha");
      let suma = 0;
      let medidas = 0;
      for (const repeticion of lote) {
        const V = new Array(tamano).fill(valorInicial);
        for (let e = 0; e < episodios; e++) {
          nStepTD(V, repeticion[e], { n, alpha, gamma });
          suma += errorRMS(V, vVerdadero);
          medidas++;
        }
      }
      const rms = suma / medidas;
      curva.push(rms);
      if (rms < mejorDeN.rms) mejorDeN = { alpha, rms };
      if (rms < mejor.rms) mejor = { n, alpha, rms };
      hechos++;
      if (alProgresar) alProgresar(hechos, total);
    }
    curvas[n] = curva;
    mejorPorN[n] = mejorDeN;
  }
  return { curvas, mejor, mejorPorN, ns: [...ns], alphas: [...alphas] };
}

/**
 * El episodio de referencia del cronograma: el camino que va derecho del
 * centro hasta salir por la derecha.
 *
 * No cablea ni índices ni recompensas: SIMULA el entorno con un rng que
 * siempre saca cara de «derecha», así que sale correcto sea cual sea
 * `nEstados` y sin traducir de base 1 a base 0 a mano. Con el paseo de 19
 * estados da S₀ = 9 … S₉ = 18 y T = 10 (que el guion escribe, en base 1,
 * como S₀ = 10 … S₉ = 19).
 *
 * @param {object} entorno Paseo aleatorio de `paseoAleatorio`.
 * @returns {object} Episodio en el formato de `muestrearEpisodio`.
 * @throws {Error} Si el episodio resultante no es el camino directo, que es
 *   lo que pasaría si cambiase la convención de la moneda en `paso`.
 */
export function caminoDirectoDerecha(entorno) {
  /* `paso` del paseo va a la derecha cuando uniforme() < 0,5. */
  const siempreDerecha = { uniforme: () => 0 };
  const episodio = muestrearEpisodio(entorno, null, entorno.estadoInicial, siempreDerecha, {
    maxPasos: entorno.nEstados + 1,
  });
  const esperado = entorno.nEstados - entorno.estadoInicial;
  if (episodio.T !== esperado || episodio.estados[episodio.T - 1] !== entorno.nEstados - 1) {
    throw new Error(
      "caminoDirectoDerecha: el entorno no ha producido el camino directo a la derecha; "
      + "revisa la convención de la moneda en `paso`",
    );
  }
  return episodio;
}

/* ----------------------------------------------------------------------- *
 * 3. Retorno λ y la vista hacia adelante  (S&B §12.1, ecuaciones 12.2-12.4)
 * ----------------------------------------------------------------------- */

/**
 * Retorno λ, G_t^λ — Sutton & Barto, ecuación (12.3).
 *
 * Se usa la forma (12.3) y no la (12.2) porque en una tarea episódica todos
 * los retornos a n pasos posteriores a la terminación valen ya G_t: se
 * separan de la suma y se acumulan de golpe en la cola λ^{T−t−1} G_t. Los dos
 * extremos salen solos: λ = 0 deja G_{t:t+1} (TD(0)) y λ = 1 deja G_t (Monte
 * Carlo).
 *
 * @param {object} episodio Episodio de `muestrearEpisodio`.
 * @param {number} t Instante desde el que se mira, en [0, T).
 * @param {number} lambda Peso del desvanecimiento, en [0, 1].
 * @param {number[]} V Estimaciones con las que se arranca (no se copia).
 * @param {number} gamma Descuento.
 * @returns {number} G_t^λ.
 * @throws {Error} Si `lambda` sale de [0, 1] o `t` cae fuera de [0, T).
 */
export function retornoLambda(episodio, t, lambda, V, gamma = 1) {
  validarLambda(lambda, "retornoLambda");
  const { estados, recompensas, T } = episodio;
  if (!Number.isInteger(t) || t < 0 || t >= T) {
    throw new Error(`retornoLambda: t debe estar en [0, ${T}); recibido: ${t}`);
  }
  const acumuladas = gamma === 1 ? sumasAcumuladas(recompensas) : null;
  const valorDe = (i) => V[estados[i]];

  let suma = 0;
  let peso = 1; // λ^{n−1}
  for (let n = 1; n <= T - t - 1; n++) {
    suma += peso * retornoDesde(episodio, t, n, gamma, acumuladas, valorDe);
    peso *= lambda;
  }
  /* Cola: G_t es G_{t:t+n} con cualquier n ≥ T − t, por la convención de
     truncamiento. Se pide con n = T − t para no duplicar la fórmula. */
  const gt = retornoDesde(episodio, t, T - t, gamma, acumuladas, valorDe);
  return (1 - lambda) * suma + lambda ** (T - t - 1) * gt;
}

/**
 * Los pesos de la figura 12.2: cuánto pesa cada retorno a n pasos en G_t^λ.
 *
 * @param {number} lambda Peso del desvanecimiento, en [0, 1].
 * @param {number} pasosHastaFinal T − t, pasos que quedan hasta la terminación.
 * @returns {{pesos: number[], cola: number}} `pesos[n−1] = (1−λ)λ^{n−1}` para
 *   n = 1 … T−t−1, y `cola = λ^{T−t−1}` para el retorno real. Suman 1 exacto.
 * @throws {Error} Si `lambda` sale de [0, 1] o `pasosHastaFinal` no es ≥ 1.
 */
export function pesosLambda(lambda, pasosHastaFinal) {
  validarLambda(lambda, "pesosLambda");
  if (!Number.isInteger(pasosHastaFinal) || pasosHastaFinal < 1) {
    throw new Error(`pesosLambda: pasosHastaFinal debe ser un entero ≥ 1; recibido: ${pasosHastaFinal}`);
  }
  const pesos = [];
  let peso = 1 - lambda;
  for (let n = 1; n <= pasosHastaFinal - 1; n++) {
    pesos.push(peso);
    peso *= lambda;
  }
  return { pesos, cola: lambda ** (pasosHastaFinal - 1) };
}

/**
 * Algoritmo del retorno λ fuera de línea — ecuación (12.4), forma tabular.
 * Muta `V`.
 *
 * Es la VISTA HACIA ADELANTE, y es fuera de línea por definición: G_t^λ no se
 * conoce hasta que el episodio termina. Por eso todos los objetivos se
 * calculan con la V DE PARTIDA (congelada) y los incrementos se aplican
 * después, sumados. Ésa es exactamente la condición bajo la cual la
 * equivalencia con `tdLambdaAtras` es EXACTA (ejercicio 12.4 del libro); si
 * las actualizaciones se aplicaran sobre la marcha, las dos vistas se
 * separarían.
 *
 * @param {number[]} V Vector de valores, se modifica in situ.
 * @param {object} episodio Episodio de `muestrearEpisodio`.
 * @param {object} opciones
 * @param {number} opciones.lambda Peso del desvanecimiento.
 * @param {number} opciones.alpha Paso de aprendizaje.
 * @param {number} opciones.gamma Descuento.
 * @returns {{actualizaciones: Array<object>}} Una entrada
 *   `{ t, estado, objetivo, delta }` por instante, con `objetivo = G_t^λ` y
 *   `delta = α[G_t^λ − V(S_t)]` el incremento que se ha aplicado.
 * @throws {Error} Si `lambda` o `alpha` no son válidos.
 */
export function retornoLambdaFueraDeLinea(V, episodio, { lambda, alpha, gamma = 1 } = {}) {
  validarLambda(lambda, "retornoLambdaFueraDeLinea");
  validarAlpha(alpha, "retornoLambdaFueraDeLinea");
  const { estados, T } = episodio;
  const congelada = V.slice(); // la V del comienzo del episodio, intacta

  const actualizaciones = [];
  for (let t = 0; t < T; t++) {
    const estado = estados[t];
    const objetivo = retornoLambda(episodio, t, lambda, congelada, gamma);
    actualizaciones.push({ t, estado, objetivo, delta: alpha * (objetivo - congelada[estado]) });
  }
  for (const u of actualizaciones) V[u.estado] += u.delta;
  return { actualizaciones };
}

/* ----------------------------------------------------------------------- *
 * 4. Trazas de elegibilidad y la vista hacia atrás  (S&B §12.2 y §12.6)
 * ----------------------------------------------------------------------- */

/**
 * TD(λ) hacia atrás, forma tabular — ecuaciones (12.5), (12.6) y (12.7).
 * Muta `V`.
 *
 * Ojo con el punto 2 de la cabecera: esta forma tabular NO está en la 2.ª
 * edición del libro, que escribe el capítulo 12 entero con aproximación de
 * funciones. Es la adaptación al caso lineal con x(s) = e_s, donde ∇v̂ es el
 * vector indicador y de ahí sale el «1» que suma la traza.
 *
 * En cada paso: se desvanece TODA la traza por γλ, sube la del estado
 * visitado, se calcula δ_t con la V anterior a la actualización y se reparte
 * αδ_t z_t(s) entre TODOS los estados, no solo el visitado. Ése es el cambio
 * de mirada respecto de la vista hacia adelante.
 *
 * @param {number[]} V Vector de valores, se modifica in situ. Su longitud fija
 *   el tamaño del vector de trazas.
 * @param {object} episodio Episodio de `muestrearEpisodio`.
 * @param {object} opciones
 * @param {number} opciones.lambda Peso del desvanecimiento, en [0, 1].
 * @param {number} opciones.alpha Paso de aprendizaje.
 * @param {number} opciones.gamma Descuento.
 * @param {string} opciones.traza "acumulativa" (12.5) o "reemplazo" (12.12).
 * @param {boolean} opciones.registro Si `true`, guarda el historial completo.
 * @returns {{historialZ: Array<number[]>|null, actualizaciones: Array<object>|null}}
 *   `historialZ[t]` es una COPIA del vector z_t entero —lo que dibuja el
 *   diente de sierra del módulo 2— y `actualizaciones[t]` es
 *   `{ t, estado, delta, incrementos }` con el reparto αδ_t z_t(s).
 * @throws {Error} Si `lambda`, `alpha` o `traza` no son válidos.
 */
export function tdLambdaAtras(V, episodio, {
  lambda, alpha, gamma = 1, traza = "acumulativa", registro = false,
} = {}) {
  validarLambda(lambda, "tdLambdaAtras");
  validarAlpha(alpha, "tdLambdaAtras");
  validarTraza(traza, "tdLambdaAtras");
  const { estados, recompensas, T } = episodio;
  const z = new Array(V.length).fill(0); // z_{−1} = 0
  const historialZ = registro ? [] : null;
  const actualizaciones = registro ? [] : null;

  for (let t = 0; t < T; t++) {
    const s = estados[t];
    for (let i = 0; i < z.length; i++) z[i] *= gamma * lambda;
    /* Acumulativa: la visita SUMA 1, así que la frecuencia cuenta y la traza
       puede pasar de 1. De reemplazo (12.12): la FIJA en 1, y entonces solo
       cuenta cuánto hace de la última visita. No es un detalle de
       implementación: cambia qué heurística implementa el algoritmo. */
    if (traza === "acumulativa") z[s] += 1;
    else z[s] = 1;

    const vSiguiente = t + 1 < T ? V[estados[t + 1]] : 0; // V(terminal) = 0
    const delta = recompensas[t] + gamma * vSiguiente - V[s];
    for (let i = 0; i < z.length; i++) {
      if (z[i] !== 0) V[i] += alpha * delta * z[i];
    }
    if (registro) {
      historialZ.push([...z]);
      actualizaciones.push({ t, estado: s, delta, incrementos: z.map((zi) => alpha * delta * zi) });
    }
  }
  return { historialZ, actualizaciones };
}

/* ----------------------------------------------------------------------- *
 * 5. El episodio de juguete del módulo 2: el timbre y la luz
 *
 * El ejemplo de David Silver que proyecta `4_Tema4_2#slide-14` cuenta la
 * historia y no da un solo número. Los números —cuántos timbres, qué
 * recompensa, qué α— son APORTACIÓN DEL RECURSO y se declaran en pantalla.
 * ----------------------------------------------------------------------- */

/** Índices de estado del episodio de juguete. DESCARGA es el terminal. */
export const TIMBRE = 0;
export const LUZ = 1;
export const DESCARGA = 2;

/**
 * El episodio del timbre y la luz, determinista.
 *
 * Suena el timbre `timbres` veces, se enciende la luz y en el paso siguiente
 * llega la descarga: R = −1 y fin. Con V ≡ 0 y γ = 1 el error TD vale 0 en
 * todos los pasos menos en el último, donde vale −1; todo el reparto de culpa
 * ocurre de golpe al final y lo decide únicamente la traza de cada estado en
 * ese momento. Por eso el módulo 2 no necesita simular nada ni promediar.
 *
 * DESCARGA no aparece en `estados`: como en todo el motor, el episodio no
 * incluye el estado terminal, y de ahí sale V(terminal) = 0 sin escribirlo.
 *
 * @param {object} opciones
 * @param {number} opciones.timbres Veces que suena el timbre, k ≥ 1.
 * @param {number} opciones.recompensaDescarga Recompensa terminal.
 * @returns {{episodio: object, nEstados: number, etiquetas: string[]}} El
 *   episodio va en el formato de `muestrearEpisodio` (con `acciones` vacío,
 *   porque no hay nada que decidir) para que lo acepten `tdCero`,
 *   `mcConstante`, `nStepTD` y `tdLambdaAtras` sin adaptadores.
 * @throws {Error} Si `timbres` no es un entero ≥ 1.
 */
export function cadenaTimbreLuz({ timbres = 3, recompensaDescarga = -1 } = {}) {
  if (!Number.isInteger(timbres) || timbres < 1) {
    throw new Error(`cadenaTimbreLuz: timbres debe ser un entero ≥ 1; recibido: ${timbres}`);
  }
  const estados = new Array(timbres).fill(TIMBRE);
  estados.push(LUZ);
  const recompensas = new Array(timbres).fill(0);
  recompensas.push(recompensaDescarga);
  return {
    episodio: { estados, acciones: [], recompensas, T: timbres + 1, truncado: false },
    nEstados: 2,
    etiquetas: ["timbre", "luz"],
  };
}

/** z_t en el instante de la descarga (t = k), calculado con el motor. */
function trazaEnLaDescarga(lambda, timbres, traza, gamma) {
  const { episodio } = cadenaTimbreLuz({ timbres });
  /* α = 0: aquí solo interesan las trazas, así que V no se mueve. */
  const { historialZ } = tdLambdaAtras([0, 0], episodio, {
    lambda, alpha: 0, gamma, traza, registro: true,
  });
  return historialZ[historialZ.length - 1];
}

/**
 * Cuánta culpa se lleva cada estado al llegar la descarga, para cada λ.
 *
 * Se calcula EJECUTANDO `tdLambdaAtras`, no con la fórmula cerrada
 * z_k(timbre) = Σ_{j=1}^{k} λ^j: así la gráfica del módulo mide el mismo
 * motor que se está explicando, y la fórmula cerrada queda libre para que la
 * usen los tests como contraste independiente.
 *
 * @param {object} opciones
 * @param {number} opciones.timbres k, veces que suena el timbre.
 * @param {string} opciones.traza "acumulativa" o "reemplazo".
 * @param {number} opciones.alpha Paso de aprendizaje.
 * @param {number} opciones.gamma Descuento.
 * @param {number} opciones.puntos Valores de λ, repartidos de 0 a 1.
 * @returns {{lambdas: number[], timbre: number[], luz: number[]}} |ΔV(s)| de
 *   cada estado tras el único episodio.
 * @throws {Error} Si `puntos` no es un entero ≥ 2.
 */
export function creditoPorLambda({
  timbres = 3, traza = "acumulativa", alpha = 0.1, gamma = 1, puntos = 101,
} = {}) {
  if (!Number.isInteger(puntos) || puntos < 2) {
    throw new Error(`creditoPorLambda: puntos debe ser un entero ≥ 2; recibido: ${puntos}`);
  }
  const { episodio } = cadenaTimbreLuz({ timbres });
  const lambdas = [];
  const timbre = [];
  const luz = [];
  for (let i = 0; i < puntos; i++) {
    const lambda = i / (puntos - 1);
    const V = [0, 0];
    tdLambdaAtras(V, episodio, { lambda, alpha, gamma, traza });
    lambdas.push(lambda);
    timbre.push(Math.abs(V[TIMBRE]));
    luz.push(Math.abs(V[LUZ]));
  }
  return { lambdas, timbre, luz };
}

/**
 * El λ en el que empatan las dos heurísticas: z_k(timbre) = z_k(luz).
 *
 * Con la traza acumulativa y γ = 1 es la raíz en (0,1) de Σ_{j=1}^{k} λ^j = 1
 * —la razón áurea con k = 2— y no hay fórmula cerrada a partir de k = 3, así
 * que se busca por bisección. 60 iteraciones sobre [0,1] agotan la precisión
 * del doble, que sobra: el módulo muestra cuatro decimales.
 *
 * @param {object} opciones
 * @param {number} opciones.timbres k, veces que suena el timbre.
 * @param {string} opciones.traza "acumulativa" o "reemplazo".
 * @param {number} opciones.gamma Descuento.
 * @returns {number|null} λ*, o `null` si no hay cruce en [0,1): pasa con k = 1
 *   y con la traza de reemplazo para cualquier k, donde la traza del timbre
 *   nunca supera el 1 de la luz y solo lo iguala en λ = 1.
 * @throws {Error} Si `timbres` o `traza` no son válidos.
 */
export function cruceTrazas({ timbres = 3, traza = "acumulativa", gamma = 1 } = {}) {
  validarTraza(traza, "cruceTrazas");
  const diferencia = (lambda) => {
    const z = trazaEnLaDescarga(lambda, timbres, traza, gamma);
    return z[TIMBRE] - z[LUZ];
  };
  /* En λ = 0 la diferencia vale −1 siempre. Si en λ = 1 sigue sin ser
     positiva, no hay cruce dentro de [0,1) y se dice, en vez de devolver un 1
     que se leería como «empatan». */
  if (diferencia(1) <= 0) return null;

  let bajo = 0;
  let alto = 1;
  for (let i = 0; i < 60; i++) {
    const medio = (bajo + alto) / 2;
    if (diferencia(medio) < 0) bajo = medio;
    else alto = medio;
  }
  return (bajo + alto) / 2;
}
