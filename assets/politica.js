/* ==========================================================================
   RL · IMAT — motor de métodos de gradiente de política (Tema 5, 2.ª parte)
   Sin dependencias del árbol de la página. Módulo ES: se usa igual desde el
   navegador y desde `node --test`. NO TOCA EL DOM y ninguna de sus funciones
   llama al azar global del lenguaje: todo lo que consume azar recibe un `rng`
   de `generador(semilla)` de `nucleo.js`. (Los nombres prohibidos no se
   escriben ni en los comentarios: el test Q-1 del plan de QA busca la cadena
   en el fichero.)

   Por qué no cabe en ningún motor existente: `mdp.js` y `dp.js` guardan la
   política como una TABLA DE PROBABILIDADES POR ESTADO, y `sinmodelo.js`,
   `npasos.js` y `aproximacion.js` la DERIVAN DE LOS VALORES DE ACCIÓN
   (ε-greedy sobre Q o sobre q̂). Aquí la política ES el objeto aprendido:
   tiene sus propios parámetros θ, su propio gradiente y su propia regla de
   actualización, y el valor —cuando lo hay— es un aproximador AUXILIAR con
   parámetros distintos (w). Ninguna firma existente admite ese cambio sin
   romperse. El más cercano es `bandits.js`, que tiene preferencias H y una
   softmax para el bandido de gradiente, pero sin estado, sin episodios y sin
   características: es el caso degenerado, y el bloque B3 de la página lo
   enlaza en vez de extenderlo.

   Este fichero solo importa `generador` de `nucleo.js`. `bandits.js`,
   `mdp.js`, `dp.js`, `sinmodelo.js`, `npasos.js` y `aproximacion.js` NO se
   tocan: sus tests dependen de ellos.

   Diapositivas: 5_Tema_5_2#slide-1 a #slide-20 (MaterialAlvaro).
   Libro: Sutton & Barto, capítulo 13 (ecuaciones 13.2, 13.5, 13.9, 13.10 y
   13.11; recuadros de las pp. 350, 352 y 354; Ejemplo 13.1, p. 345).
   Guion: `Interactivo/T5b_recurso/guion-recurso.md`, §C1 fija esta API.

   ─────────────────────────────────────────────────────────────────────────
   NOTACIÓN (guion §0.1, que sigue a `Teoria/referencia/notacion.md`)

     θ        parámetros de LA POLÍTICA        (d' componentes)
     w        pesos del CRÍTICO o de la LÍNEA BASE  (d componentes)
     α^θ, α^w los dos pasos, independientes.  NUNCA β: el β de
              5_Tema_5_2#slide-17 es notación importada sin armonizar.
     J(θ)     rendimiento; SE MAXIMIZA, por ASCENSO
     μ(s)     distribución dentro de política
     η(s)     visitas esperadas por episodio;  μ = η / Σ η
     δ        error TD en actor-crítico; error MONTE CARLO en REINFORCE con
              línea base. Mismo símbolo, dos objetos.
     I        acumulador de γ^t del recuadro de la p. 354. NO es la identidad.
     p        en esta página, π(derecha|s,θ) en el pasillo y π(este|s,θ) en la
              cruz. NO es la dinámica p(s',r|s,a), que no aparece en ninguna
              fórmula de este motor — que es justo lo que dice el teorema.

   ─────────────────────────────────────────────────────────────────────────
   SIETE DECISIONES QUE HAY QUE LEER ANTES DE TOCAR NADA

   1. EL ORDEN DE CONSUMO DEL `rng` ES CONTRATO. Por episodio:
        inicio(rng)  →  [un uniforme por acción muestreada] × T
      `pasilloCorto.inicio` NO consume azar (el inicio es fijo, el estado 0);
      `rejillaCruz.inicio` consume EXACTAMENTE UNO (inicio uniforme sobre los
      cuatro brazos). `muestrearAccion` consume EXACTAMENTE UNO, siempre,
      incluso cuando la acción está forzada (modo `alias: false`): así el
      consumo no depende del modo. La dinámica de los dos entornos es
      DETERMINISTA y no consume azar. Si alguien mueve una sola llamada al
      generador, cambian todas las cifras de reproducibilidad de la página.

   2. `nEstados` ES EL NÚMERO DE ESTADOS NO TERMINALES. El terminal vive
      fuera, en el índice `entorno.terminal` (3 en el pasillo, 4 en la cruz),
      y v̂(terminal, w) ≐ 0 SIEMPRE, en las dos capacidades. Es la línea del
      recuadro de la p. 354 que la versión de 5_Tema_5_2#slide-17 no tiene, y
      en el pasillo es la única transición que lleva información (módulo 5).

   3. NUNCA SE DIVIDE POR π. Se usa `gradLogPi` directamente, por la identidad
      ∇ln x = ∇x/x (ec. 13.9). Por eso NO HAY NINGUNA DIVISIÓN POR CERO en
      todo el motor, ni siquiera cuando la softmax devuelve un 0 exacto en
      doble precisión.

   4. `J` DEVUELVE -Infinity, NUNCA NaN, en p ≤ 0 y p ≥ 1 (guion §C1, regla 3,
      y prueba estructural Q-5). ⚠ En los dos modos «distinguibles» ese
      convenio NO es el límite de la forma cerrada: J_dist del pasillo tiende
      a −3 cuando p → 0⁺ y J_dist de la cruz vale −1 en p = 1. El límite lo da
      `optimoExacto`, que marca esos dos casos con `extremo: true`. Se sigue
      el convenio porque una política determinista NO ES ALCANZABLE bajo la
      softmax: p = 0 y p = 1 están fuera de la clase parametrizada.

   5. LAS CURVAS NO CONTIENEN NaN NI ±Infinity. Una ejecución cortada por
      desbordamiento (‖θ‖ > 1e6 o ‖w‖ > 1e9) se TRUNCA y se marca; nunca se
      rellena con el último valor ni se descarta en silencio.

   6. UN EPISODIO TRUNCADO NO ES UN EPISODIO TERMINADO. El tope por episodio
      es una SIMPLIFICACIÓN POR RENDIMIENTO, y el motor la declara: al cortar,
      el retorno se calcula sobre los pasos dados, así que queda SOBREESTIMADO
      (menos negativo del que le tocaría). Cada resultado lleva su contador de
      truncados y la interfaz lo rotula.

   7. LOS ÍNDICES DE ACCIÓN SON IDENTIFICADORES DEL MOTOR Y NO SE TRADUCEN.
      Pasillo: 0 = "derecha", 1 = "izquierda". Cruz: 0 = "norte", 1 = "sur",
      2 = "oeste", 3 = "este". La traducción es cosa de
      `nombreAccionPolitica()` en `tema5b.js`.
   ========================================================================== */

import { generador } from "./nucleo.js";

/** Los pesos de la política por encima de esto se consideran reventados. */
const TOPE_THETA = 1e6;

/** Los pesos del crítico o de la línea base por encima de esto, igual. */
const TOPE_W = 1e9;

/** Acotación de las probabilidades antes de tomar logaritmos en la KL. */
const EPS_KL = 1e-12;

/** Pasos de bisección del recorte de región de confianza (módulo 6, §6). */
const PASOS_BISECCION = 60;

/**
 * Umbrales del criterio de colapso del módulo 6.
 *
 * No son arbitrarios: son las dos políticas ε-greedy que Sutton & Barto marca
 * en la gráfica del Ejemplo 13.1 (p. 345), con J = −44,21 y J = −82,11.
 */
export const UMBRAL_COLAPSO = { alto: 0.95, bajo: 0.05 };

/* ======================================================================== *
 * ENTORNOS
 *
 * Interfaz común:
 *   { tipo, nEstados, nAcciones, acciones, terminal, inicial, gamma, dPrima,
 *     alias, accionMarcada,
 *     inicio(rng) -> s,
 *     paso(s, a) -> { s2, r, fin },      // DETERMINISTA: no recibe rng
 *     esTerminal(s) -> boolean,
 *     xSA(s, a) -> Int32Array,           // índices activos de x(s,a)
 *     politicaEfectiva(s) -> índice de acción forzada, o -1 si sigue a θ }
 *
 * Los dos entornos son deterministas: el azar está SOLO en la política (y en
 * el estado inicial de la cruz).
 * ======================================================================== */

/**
 * El pasillo corto de Sutton & Barto (Ejemplo 13.1, p. 345).
 *
 * Tres estados no terminales (0, 1, 2) y un terminal (3 = G). Dos acciones:
 * 0 = "derecha", 1 = "izquierda". En el estado 1 LAS ACCIONES ESTÁN
 * INVERTIDAS («in the second state they are reversed»). Recompensa −1 en cada
 * paso, incluido el que entra en G. γ = 1 (§13.2, p. 346).
 *
 * Características: x(s,derecha) = [1,0]ᵀ y x(s,izquierda) = [0,1]ᵀ, IGUALES
 * PARA LOS TRES ESTADOS, luego d' = 2 y hay UNA SOLA probabilidad p
 * compartida por los tres. Ese es el *aliasing* que hace estocástico el
 * óptimo, y es lo único que hace difícil el problema.
 *
 * @param {object} [opciones]
 * @param {boolean} [opciones.alias=true] `true` = las tres celdas comparten
 *   características (el entorno del libro). `false` = variante propia de esta
 *   página: los estados 0 y 2 toman siempre `derecha` y solo el 1 sigue a θ.
 *   NO cambia d'.
 * @param {number} [opciones.gamma=1] Descuento. El libro trabaja con γ = 1.
 * @returns {object} Entorno con la interfaz común.
 */
export function pasilloCorto({ alias = true, gamma = 1 } = {}) {
  /* TRANSICIONES[s][a] = estado siguiente. El 3 es G, terminal.
     (0,der)->1  (0,izq)->0 [pared]   (1,der)->0  (1,izq)->2 [INVERTIDO]
     (2,der)->3 [G]         (2,izq)->1                                  */
  const TRANSICIONES = [
    [1, 0],
    [0, 2],
    [3, 1],
  ];
  const X = [new Int32Array([0]), new Int32Array([1])];
  return {
    tipo: "pasilloCorto",
    nEstados: 3,
    nAcciones: 2,
    acciones: ["derecha", "izquierda"],
    terminal: 3,
    inicial: 0,
    gamma,
    dPrima: 2,
    alias,
    accionMarcada: 0,
    inicio() {
      /* No consume azar: el episodio empieza siempre en la S del dibujo. */
      return 0;
    },
    paso(s, a) {
      const s2 = TRANSICIONES[s][a];
      return { s2, r: -1, fin: s2 === 3 };
    },
    esTerminal(s) {
      return s === 3;
    },
    xSA(s, a) {
      return X[a];
    },
    politicaEfectiva(s) {
      /* Modo «distinguibles»: los estados 0 y 2 resuelven su parte y el
         deslizador gobierna solo el estado 1. Es variante de esta página, no
         del libro, y la página lo declara. */
      if (alias) return -1;
      return s === 1 ? -1 : 0;
    },
  };
}

/**
 * La rejilla en cruz.
 *
 * ⚠ ENTORNO PROPIO DE LA ASIGNATURA. No está en Sutton & Barto ni en ninguna
 * de las dos barajas: se diseña en el guion (§0.3 B) y la página lo declara
 * como propio cada vez que aparece. Existe porque con un solo caso —el
 * pasillo, con sus acciones invertidas— es fácil pensar que el óptimo
 * estocástico es una rareza; aquí el mecanismo es la simetría y el resultado
 * es el mismo.
 *
 * Rejilla 3 × 3: las cuatro esquinas son muro, el centro (1,1) es la meta
 * terminal y los cuatro brazos son los estados. Índices internos:
 * 0 = brazo norte (0,1), 1 = brazo oeste (1,0), 2 = brazo este (1,2),
 * 3 = brazo sur (2,1), 4 = meta. Acciones: 0 = "norte", 1 = "sur",
 * 2 = "oeste", 3 = "este". Desde cada brazo, una sola acción lleva a la meta;
 * las otras tres chocan con el muro y NO mueven, pero el paso se cuenta.
 * Recompensa −1 por paso, γ = 1, inicio uniforme sobre los cuatro brazos.
 *
 * Los cuatro brazos comparten características (d' = 4): hay UNA distribución
 * sobre cuatro acciones para cuatro situaciones que piden cuatro acciones
 * distintas. Por eso el óptimo es la uniforme, con J = −4, y cualquier
 * política determinista deja tres brazos sin salida y da J = −∞.
 *
 * @param {object} [opciones]
 * @param {boolean} [opciones.alias=true] `true` = los cuatro brazos comparten
 *   características. `false` = los brazos 0, 2 y 3 usan su acción correcta y
 *   solo el 1 (oeste) sigue a θ.
 * @param {number} [opciones.gamma=1] Descuento.
 * @returns {object} Entorno con la interfaz común.
 */
export function rejillaCruz({ alias = true, gamma = 1 } = {}) {
  /* SALIDA[s] = la única acción que lleva a la meta desde el brazo s.
     norte necesita `sur` (1), oeste necesita `este` (3),
     este necesita `oeste` (2), sur necesita `norte` (0). */
  const SALIDA = [1, 3, 2, 0];
  const X = [
    new Int32Array([0]), new Int32Array([1]),
    new Int32Array([2]), new Int32Array([3]),
  ];
  return {
    tipo: "rejillaCruz",
    nEstados: 4,
    nAcciones: 4,
    acciones: ["norte", "sur", "oeste", "este"],
    terminal: 4,
    inicial: null,
    gamma,
    dPrima: 4,
    alias,
    accionMarcada: 3,
    inicio(rng) {
      /* Consume EXACTAMENTE UN uniforme. Contrato del §1 de la cabecera. */
      return rng.entero(4);
    },
    paso(s, a) {
      const s2 = a === SALIDA[s] ? 4 : s;
      return { s2, r: -1, fin: s2 === 4 };
    },
    esTerminal(s) {
      return s === 4;
    },
    xSA(s, a) {
      return X[a];
    },
    politicaEfectiva(s) {
      if (alias) return -1;
      return s === 1 ? -1 : SALIDA[s];
    },
  };
}

/**
 * Construye un entorno a partir de un descriptor serializable.
 *
 * Hace falta porque la configuración de una tanda cruza la frontera del Web
 * Worker, y una función no se puede clonar estructuradamente.
 *
 * @param {string|object} desc `"pasilloCorto"` | `"rejillaCruz"` |
 *   `{ tipo, alias, gamma }` | un entorno ya construido.
 * @returns {object} Entorno con la interfaz común.
 * @throws {Error} Si el tipo de entorno no existe.
 */
export function construirEntorno(desc) {
  if (desc && typeof desc.paso === "function") return desc;
  const { tipo, alias = true, gamma = 1 } = typeof desc === "string" ? { tipo: desc } : (desc || {});
  if (tipo === "pasilloCorto") return pasilloCorto({ alias, gamma });
  if (tipo === "rejillaCruz") return rejillaCruz({ alias, gamma });
  throw new Error(`Entorno desconocido: ${tipo}`);
}

/* ======================================================================== *
 * POLÍTICA
 * ======================================================================== */

/**
 * Softmax sobre preferencias de acción (S&B, ec. 13.2, p. 344).
 *
 * RESTA EL MÁXIMO antes de exponenciar. Sin eso, la aserción C1-16 falla con
 * ‖θ‖ ~ 1e3: `exp(1000)` es `Infinity` y el cociente sale `NaN`.
 *
 * @param {ArrayLike<number>} preferencias h(s,a,θ) para cada acción.
 * @returns {Float64Array} Distribución que suma 1.
 */
export function softmax(preferencias) {
  const n = preferencias.length;
  const salida = new Float64Array(n);
  let maximo = -Infinity;
  for (let i = 0; i < n; i++) if (preferencias[i] > maximo) maximo = preferencias[i];
  let suma = 0;
  for (let i = 0; i < n; i++) {
    const e = Math.exp(preferencias[i] - maximo);
    salida[i] = e;
    suma += e;
  }
  for (let i = 0; i < n; i++) salida[i] /= suma;
  return salida;
}

/**
 * Preferencias h(s,a,θ) = θᵀx(s,a) de todas las acciones en un estado.
 *
 * @param {object} entorno Entorno.
 * @param {ArrayLike<number>} theta Parámetros de la política.
 * @param {number} s Estado no terminal.
 * @param {Float64Array} salida Buffer de `nAcciones` (se sobrescribe).
 * @returns {Float64Array} El mismo buffer.
 */
function preferenciasEn(entorno, theta, s, salida) {
  for (let a = 0; a < entorno.nAcciones; a++) {
    const activas = entorno.xSA(s, a);
    let h = 0;
    for (let k = 0; k < activas.length; k++) h += theta[activas[k]];
    salida[a] = h;
  }
  return salida;
}

/**
 * π(·|s,θ) escrita en un buffer, sin reservar memoria.
 *
 * Respeta `politicaEfectiva`: en modo «distinguibles» los estados resueltos
 * devuelven una distribución degenerada (masa 1 en su acción correcta). Es lo
 * que hace que `valoresExactos` cumpla la ecuación de Bellman también en ese
 * modo (prueba estructural Q-9).
 *
 * @param {object} entorno Entorno.
 * @param {ArrayLike<number>} theta Parámetros de la política.
 * @param {number} s Estado no terminal.
 * @param {Float64Array} salida Buffer de `nAcciones`.
 * @param {Float64Array} scratch Buffer auxiliar de `nAcciones`.
 * @returns {Float64Array} El mismo buffer `salida`.
 */
function probabilidadesEn(entorno, theta, s, salida, scratch) {
  const forzada = entorno.politicaEfectiva(s);
  if (forzada >= 0) {
    salida.fill(0);
    salida[forzada] = 1;
    return salida;
  }
  preferenciasEn(entorno, theta, s, scratch);
  let maximo = -Infinity;
  for (let a = 0; a < entorno.nAcciones; a++) if (scratch[a] > maximo) maximo = scratch[a];
  let suma = 0;
  for (let a = 0; a < entorno.nAcciones; a++) {
    const e = Math.exp(scratch[a] - maximo);
    salida[a] = e;
    suma += e;
  }
  for (let a = 0; a < entorno.nAcciones; a++) salida[a] /= suma;
  return salida;
}

/**
 * π(·|s,θ): la distribución de la política sobre las acciones de un estado.
 *
 * @param {object} entorno Entorno.
 * @param {ArrayLike<number>} theta Parámetros de la política.
 * @param {number} s Estado no terminal.
 * @returns {Float64Array} Distribución de `nAcciones` componentes que suma 1.
 */
export function probabilidades(entorno, theta, s) {
  const salida = new Float64Array(entorno.nAcciones);
  return probabilidadesEn(entorno, theta, s, salida, new Float64Array(entorno.nAcciones));
}

/**
 * Muestrea una acción de π(·|s,θ).
 *
 * Categórica por suma acumulada, con UN SOLO uniforme y recorriendo las
 * acciones en orden fijo. Sin desempates: la política es una distribución, no
 * un argmax — en todo este tema no hay ningún argmax.
 *
 * @param {object} entorno Entorno.
 * @param {ArrayLike<number>} theta Parámetros de la política.
 * @param {number} s Estado no terminal.
 * @param {object} rng Generador de `generador(semilla)`.
 * @returns {number} Índice de la acción.
 */
export function muestrearAccion(entorno, theta, s, rng) {
  const pi = probabilidades(entorno, theta, s);
  return muestrearDe(pi, rng);
}

/**
 * Categórica sobre una distribución ya calculada. Un solo uniforme.
 *
 * @param {ArrayLike<number>} pi Distribución que suma 1.
 * @param {object} rng Generador.
 * @returns {number} Índice muestreado.
 */
function muestrearDe(pi, rng) {
  const x = rng.uniforme();
  let acumulado = 0;
  for (let a = 0; a < pi.length; a++) {
    acumulado += pi[a];
    if (x < acumulado) return a;
  }
  return pi.length - 1;
}

/**
 * ∇ln π(a|s,θ) escrito en un buffer (S&B, ec. 13.9; Ejercicio 13.3, p. 351).
 *
 *     ∇ln π(a|s,θ) = x(s,a) − Σ_{a'} π(a'|s,θ) x(s,a')
 *
 * «la característica de la acción tomada menos la característica media bajo
 * la política». Es el VECTOR DE ELEGIBILIDAD del libro (p. 349); en la
 * literatura y en las dos barajas se llama *score function*, y son el mismo
 * objeto. No confundir con las TRAZAS de elegibilidad del Tema 4: el vector
 * es un gradiente instantáneo, la traza es su acumulación descontada.
 *
 * En el pasillo, con x(s,der) = [1,0]ᵀ y x(s,izq) = [0,1]ᵀ, sale
 * (1−p)[1,−1]ᵀ y p[−1,1]ᵀ: LOS DOS SON MÚLTIPLOS DE [1,−1]ᵀ, luego
 * θ_r + θ_ℓ es invariante bajo cualquiera de los tres algoritmos.
 *
 * @param {object} entorno Entorno.
 * @param {ArrayLike<number>} theta Parámetros de la política.
 * @param {number} s Estado no terminal.
 * @param {number} a Índice de la acción tomada.
 * @param {Float64Array} salida Buffer de d' componentes (se sobrescribe).
 * @param {Float64Array} pi Distribución π(·|s,θ) ya calculada.
 * @returns {Float64Array} El mismo buffer.
 */
function gradLogPiEn(entorno, theta, s, a, salida, pi) {
  salida.fill(0);
  const activasA = entorno.xSA(s, a);
  for (let k = 0; k < activasA.length; k++) salida[activasA[k]] += 1;
  for (let b = 0; b < entorno.nAcciones; b++) {
    if (pi[b] === 0) continue;
    const activas = entorno.xSA(s, b);
    for (let k = 0; k < activas.length; k++) salida[activas[k]] -= pi[b];
  }
  return salida;
}

/**
 * ∇ln π(a|s,θ), el vector de elegibilidad de la ecuación (13.9).
 *
 * ⚠ En modo «distinguibles» los estados resueltos tienen una distribución
 * degenerada y su gradiente es el vector cero: no están parametrizados y no
 * aportan nada al aprendizaje. Es coherente y está anotado aquí.
 *
 * @param {object} entorno Entorno.
 * @param {ArrayLike<number>} theta Parámetros de la política.
 * @param {number} s Estado no terminal.
 * @param {number} a Índice de la acción.
 * @returns {Float64Array} Vector de d' componentes.
 */
export function gradLogPi(entorno, theta, s, a) {
  const pi = probabilidades(entorno, theta, s);
  return gradLogPiEn(entorno, theta, s, a, new Float64Array(entorno.dPrima), pi);
}

/**
 * La distribución parametrizada compartida, ignorando `politicaEfectiva`.
 *
 * Como x(s,a) = e_a para todo s en los dos entornos, la softmax de las
 * preferencias es la misma en todos los estados; esa es exactamente la
 * afirmación de *aliasing* del Ejemplo 13.1. Se usa para p y para la KL.
 *
 * @param {object} entorno Entorno.
 * @param {ArrayLike<number>} theta Parámetros de la política.
 * @returns {Float64Array} Distribución sobre las `nAcciones` acciones.
 */
function distribucionCompartida(entorno, theta) {
  const h = new Float64Array(entorno.nAcciones);
  /* El estado 1 es, en los dos entornos, el que sigue a θ también en modo
     «distinguibles»: el del medio del pasillo y el brazo oeste de la cruz. */
  preferenciasEn(entorno, theta, 1, h);
  return softmax(h);
}

/**
 * p: la probabilidad de la acción marcada (`derecha` en el pasillo, `este` en
 * la cruz) bajo la distribución parametrizada.
 *
 * @param {object} entorno Entorno.
 * @param {ArrayLike<number>} theta Parámetros de la política.
 * @returns {number} p ∈ (0,1).
 */
export function pDeTheta(entorno, theta) {
  return distribucionCompartida(entorno, theta)[entorno.accionMarcada];
}

/**
 * El θ que produce una p dada, con Σθ = 0.
 *
 * Con θ = z·(e_marcada − 1/|A|) las preferencias se diferencian en z y
 * π(marcada) = e^z / (|A|−1 + e^z), luego z = ln((|A|−1)p/(1−p)).
 *
 *   · Pasillo (|A| = 2): θ = [½ln(p/(1−p)), −½ln(p/(1−p))].
 *     Con p₀ = 0,05 sale θ = [−½ln19, +½ln19] (aserción C3-4), simétrica para
 *     que el invariante θ_r + θ_ℓ valga 0 igual que con θ = 0.
 *   · Cruz (|A| = 4): equivale a la forma del guion (θ_este = ln(3p/(1−p)) y
 *     las otras tres a cero) DESPLAZADA para que Σθ = 0, y la softmax es
 *     invariante a ese desplazamiento.
 *
 * ⚠ p se acota a [1e-12, 1−1e-12] para no devolver ±Infinity: p = 0 y p = 1
 * no son alcanzables bajo la softmax (decisión 4 de la cabecera).
 *
 * @param {object} entorno Entorno.
 * @param {number} p Probabilidad de la acción marcada.
 * @returns {Float64Array} θ de d' componentes con Σθ = 0.
 */
export function thetaDeP(entorno, p) {
  const nA = entorno.nAcciones;
  const q = Math.min(Math.max(p, 1e-12), 1 - 1e-12);
  const z = Math.log(((nA - 1) * q) / (1 - q));
  const theta = new Float64Array(entorno.dPrima);
  for (let a = 0; a < nA; a++) {
    const activas = entorno.xSA(0, a);
    const valor = z * ((a === entorno.accionMarcada ? 1 : 0) - 1 / nA);
    for (let k = 0; k < activas.length; k++) theta[activas[k]] += valor;
  }
  return theta;
}

/* ======================================================================== *
 * SOLUCIÓN EXACTA
 *
 * Sin muestreo. Sostienen los módulos 1, 2, 4 y 5 y casi todas las aserciones
 * de contraste. Nada de aquí depende de la semilla.
 * ======================================================================== */

/**
 * Resuelve A·x = b por eliminación gaussiana con pivoteo parcial.
 *
 * Los sistemas de esta página son de 3 × 3 o 4 × 4 y están bien
 * condicionados para todo p ∈ (0,1): el determinante se anula solo en los
 * extremos, que están fuera del rango de los deslizadores.
 *
 * @param {number[][]} A Matriz n × n (se copia; no se modifica la entrada).
 * @param {number[]} b Término independiente de n componentes.
 * @returns {Float64Array} Solución de n componentes.
 * @throws {Error} Si la matriz es singular a precisión de máquina.
 */
function resolverSistema(A, b) {
  const n = b.length;
  const M = A.map((fila, i) => Float64Array.from([...fila, b[i]]));
  for (let col = 0; col < n; col++) {
    let mejor = col;
    for (let f = col + 1; f < n; f++) {
      if (Math.abs(M[f][col]) > Math.abs(M[mejor][col])) mejor = f;
    }
    if (Math.abs(M[mejor][col]) < 1e-300) {
      throw new Error("Sistema singular: la política está en un extremo (p = 0 o p = 1)");
    }
    if (mejor !== col) {
      const tmp = M[col];
      M[col] = M[mejor];
      M[mejor] = tmp;
    }
    for (let f = col + 1; f < n; f++) {
      const factor = M[f][col] / M[col][col];
      if (factor === 0) continue;
      for (let c = col; c <= n; c++) M[f][c] -= factor * M[col][c];
    }
  }
  const x = new Float64Array(n);
  for (let f = n - 1; f >= 0; f--) {
    let suma = M[f][n];
    for (let c = f + 1; c < n; c++) suma -= M[f][c] * x[c];
    x[f] = suma / M[f][f];
  }
  return x;
}

/**
 * J(θ) = v_{π_θ}(s₀): el rendimiento, en forma cerrada.
 *
 * Las cuatro formas (guion §0.3; la del pasillo con *aliasing* está también
 * en `fuentes/ficha-teoria.md` §9.2, y el libro la pide como Ejercicio 13.1):
 *
 *   pasillo, alias:      −(4−2p) / (p(1−p))          óptimo 2−√2, −(6+4√2)
 *   pasillo, sin alias:  −(1 + 2/(1−p))              supremo −3 en p → 0⁺
 *   cruz, alias:         −(1/4)(1/p + 9/(1−p))       óptimo 1/4, −4
 *   cruz, sin alias:     −(1/4)(1/p + 3)             supremo −1 en p = 1
 *
 * ⚠ p ≤ 0 o p ≥ 1 devuelve `-Infinity`, NUNCA `NaN` (decisión 4).
 *
 * @param {object} entorno Entorno.
 * @param {number} p Probabilidad de la acción marcada.
 * @returns {number} J(p), o `-Infinity` en los extremos.
 */
export function J(entorno, p) {
  if (!(p > 0) || !(p < 1)) return -Infinity;
  if (entorno.tipo === "pasilloCorto") {
    return entorno.alias ? -(4 - 2 * p) / (p * (1 - p)) : -(1 + 2 / (1 - p));
  }
  return entorno.alias
    ? -0.25 * (1 / p + 9 / (1 - p))
    : -0.25 * (1 / p + 3);
}

/**
 * El óptimo dentro de la clase parametrizada, en forma cerrada.
 *
 * ⚠ `extremo: true` marca los dos casos en que el máximo está en el borde del
 * intervalo y la política óptima es DETERMINISTA: ahí el valor devuelto es el
 * LÍMITE de la forma cerrada, no `J(entorno, p)`, que por convenio devuelve
 * −∞ en los extremos. La interfaz lo rotula con `t5b.m1.notaExtremo`.
 *
 * @param {object} entorno Entorno.
 * @returns {{p: number, J: number, extremo: boolean}} Óptimo.
 */
export function optimoExacto(entorno) {
  if (entorno.tipo === "pasilloCorto") {
    if (entorno.alias) {
      return { p: 2 - Math.SQRT2, J: -(6 + 4 * Math.SQRT2), extremo: false };
    }
    /* J_dist = −(1 + 2/(1−p)) es estrictamente decreciente en (0,1): su
       supremo está en p → 0⁺ y vale −3, la política (derecha, izquierda,
       derecha), tres pasos. */
    return { p: 0, J: -3, extremo: true };
  }
  if (entorno.alias) return { p: 0.25, J: -4, extremo: false };
  /* J_dist = −(1/4)(1/p + 3) es creciente: máximo en p = 1 con valor −1. */
  return { p: 1, J: -1, extremo: true };
}

/**
 * La distribución inicial h(s) del entorno.
 *
 * @param {object} entorno Entorno.
 * @returns {Float64Array} h(s) sobre los estados no terminales.
 */
function distribucionInicial(entorno) {
  const h = new Float64Array(entorno.nEstados);
  if (entorno.tipo === "pasilloCorto") h[0] = 1;
  else h.fill(1 / entorno.nEstados);
  return h;
}

/**
 * Los valores exactos de una política, resolviendo los sistemas lineales.
 *
 * NO usa la forma cerrada de `J`: ese es justamente el contraste de la
 * aserción C1-1 (los dos caminos tienen que dar lo mismo a 1e-12 relativo).
 *
 *   n(s) = 1 + Σ_a π(a|s) n(s')          con n(terminal) = 0
 *   v(s) = −n(s)                          (γ = 1, r = −1 por paso)
 *   q(s,a) = −1 + v(s')                   (transiciones deterministas)
 *   η(s) = h(s) + Σ_{s̄} η(s̄) Σ_a π(a|s̄) p(s|s̄,a)     (S&B ec. 9.2)
 *   μ(s) = η(s) / Σ_{s'} η(s')
 *
 * Identidad que el motor respeta y el test comprueba (C1-9): Σ_s η(s) es la
 * LONGITUD MEDIA DEL EPISODIO, y vale −J(p). Es también la constante de
 * proporcionalidad del teorema del gradiente.
 *
 * ⚠ Con γ ≠ 1 estas fórmulas dejan de valer (n y v se separan). El entorno
 * del libro es sin descuento y los seis módulos usan γ = 1.
 *
 * @param {object} entorno Entorno.
 * @param {number} p Probabilidad de la acción marcada.
 * @returns {{n: Float64Array, v: Float64Array, q: Float64Array[],
 *   eta: Float64Array, mu: Float64Array, longitudMedia: number, J: number}}
 *   Valores exactos.
 */
export function valoresExactos(entorno, p) {
  return valoresDeTheta(entorno, thetaDeP(entorno, p));
}

/**
 * Los mismos valores exactos, a partir de θ en vez de p.
 *
 * Es la versión que usan `ladoDerechoTeorema`, `actualizacionEsperada` y
 * `mediaVarianzaTermino`: en la cruz, θ puede haberse desequilibrado durante
 * el aprendizaje y entonces la política ya no es la simétrica que describe p.
 *
 * @param {object} entorno Entorno.
 * @param {ArrayLike<number>} theta Parámetros de la política.
 * @returns {object} Igual que `valoresExactos`.
 */
function valoresDeTheta(entorno, theta) {
  const nS = entorno.nEstados;
  const nA = entorno.nAcciones;
  const gamma = entorno.gamma;
  const pi = [];
  const scratch = new Float64Array(nA);
  for (let s = 0; s < nS; s++) {
    pi.push(probabilidadesEn(entorno, theta, s, new Float64Array(nA), scratch));
  }

  /* n(s): pasos esperados hasta terminar. (I − γP)n = 1. */
  const An = [];
  const bn = [];
  for (let s = 0; s < nS; s++) {
    const fila = new Array(nS).fill(0);
    fila[s] += 1;
    for (let a = 0; a < nA; a++) {
      const { s2 } = entorno.paso(s, a);
      if (!entorno.esTerminal(s2)) fila[s2] -= gamma * pi[s][a];
    }
    An.push(fila);
    bn.push(1);
  }
  const n = resolverSistema(An, bn);

  const v = new Float64Array(nS);
  for (let s = 0; s < nS; s++) v[s] = -n[s];

  const q = [];
  for (let s = 0; s < nS; s++) {
    const fila = new Float64Array(nA);
    for (let a = 0; a < nA; a++) {
      const { s2, r } = entorno.paso(s, a);
      fila[a] = r + gamma * (entorno.esTerminal(s2) ? 0 : v[s2]);
    }
    q.push(fila);
  }

  /* η(s): visitas esperadas por episodio. (I − Pᵀ)η = h. */
  const h = distribucionInicial(entorno);
  const Ae = [];
  const be = [];
  for (let s = 0; s < nS; s++) {
    const fila = new Array(nS).fill(0);
    fila[s] += 1;
    for (let sb = 0; sb < nS; sb++) {
      for (let a = 0; a < nA; a++) {
        const { s2 } = entorno.paso(sb, a);
        if (s2 === s) fila[sb] -= pi[sb][a];
      }
    }
    Ae.push(fila);
    be.push(h[s]);
  }
  const eta = resolverSistema(Ae, be);

  let sumaEta = 0;
  for (let s = 0; s < nS; s++) sumaEta += eta[s];
  const mu = new Float64Array(nS);
  for (let s = 0; s < nS; s++) mu[s] = eta[s] / sumaEta;

  let jota = 0;
  for (let s = 0; s < nS; s++) jota += h[s] * v[s];

  return { n, v, q, eta, mu, longitudMedia: sumaEta, J: jota, pi };
}

/**
 * ∇J(θ) por diferencias finitas centradas sobre la forma cerrada de J.
 *
 * NO usa μ, ni q_π, ni ∇π: ese es el punto entero del módulo 2. «Si los dos
 * lados coinciden a seis decimales, no es porque se hayan calculado igual: es
 * porque el teorema es cierto.»
 *
 * Con h = 1e-5 el error del método es del orden de h² = 1e-10, y es por eso
 * que la aserción C2-1 se comprueba a 1e-6 y no a 1e-12: ESA TOLERANCIA ES LA
 * DEL MÉTODO, NO LA DEL TEOREMA.
 *
 * @param {object} entorno Entorno.
 * @param {ArrayLike<number>} theta Parámetros de la política.
 * @param {object} [opciones]
 * @param {number} [opciones.h=1e-5] Paso de la diferencia finita.
 * @returns {Float64Array} ∇J(θ) de d' componentes.
 */
export function gradienteJ(entorno, theta, { h = 1e-5 } = {}) {
  const grad = new Float64Array(entorno.dPrima);
  const mas = Float64Array.from(theta);
  const menos = Float64Array.from(theta);
  for (let i = 0; i < entorno.dPrima; i++) {
    mas[i] = theta[i] + h;
    menos[i] = theta[i] - h;
    const jMas = J(entorno, pDeTheta(entorno, mas));
    const jMenos = J(entorno, pDeTheta(entorno, menos));
    grad[i] = (jMas - jMenos) / (2 * h);
    mas[i] = theta[i];
    menos[i] = theta[i];
  }
  return grad;
}

/**
 * El lado derecho del teorema del gradiente (S&B, ec. 13.5, §13.2):
 *
 *     Σ_s μ(s) Σ_a q_π(s,a) ∇π(a|s,θ),    con ∇π = π · ∇ln π
 *
 * Lo que hay que ver es LO QUE NO ESTÁ: en el lado derecho no aparece ∇μ. Ese
 * es el logro del teorema, y por eso se puede estimar el gradiente sin
 * conocer la dinámica del entorno.
 *
 * En p = 0,5 sobre el pasillo vale [1/6, −1/6]ᵀ (aserción C2-4).
 *
 * @param {object} entorno Entorno.
 * @param {ArrayLike<number>} theta Parámetros de la política.
 * @returns {Float64Array} Vector de d' componentes.
 */
export function ladoDerechoTeorema(entorno, theta) {
  const vals = valoresDeTheta(entorno, theta);
  const rhs = new Float64Array(entorno.dPrima);
  const grad = new Float64Array(entorno.dPrima);
  for (let s = 0; s < entorno.nEstados; s++) {
    for (let a = 0; a < entorno.nAcciones; a++) {
      const peso = vals.mu[s] * vals.q[s][a] * vals.pi[s][a];
      if (peso === 0) continue;
      gradLogPiEn(entorno, theta, s, a, grad, vals.pi[s]);
      for (let i = 0; i < entorno.dPrima; i++) rhs[i] += peso * grad[i];
    }
  }
  return rhs;
}

/**
 * La constante de proporcionalidad del teorema, que es lo que esconde el ∝.
 *
 * En el caso episódico es LA LONGITUD MEDIA DEL EPISODIO, Σ_s η(s) = −J(θ);
 * en el continuado vale 1 y la relación es una igualdad. Para el algoritmo da
 * igual —se absorbe en α, que es arbitrario—, pero no da igual si lo que
 * quieres es comprobar el teorema con números. Con p = 0,5 vale 12.
 *
 * @param {object} entorno Entorno.
 * @param {ArrayLike<number>} theta Parámetros de la política.
 * @returns {number} Σ_s η(s).
 */
export function constanteProporcionalidad(entorno, theta) {
  return valoresDeTheta(entorno, theta).longitudMedia;
}

/**
 * Media y varianza exactas del término del gradiente en un estado.
 *
 * Sin muestreo: son esperanzas sobre la ELECCIÓN DE LA ACCIÓN con q_π
 * conocido. Con g(a) = (q_π(s,a) − b(a))·c(a), donde c(a) es la primera
 * componente de ∇ln π(a|s,θ) —en el pasillo, c(der) = 1−p y c(izq) = −p,
 * porque los dos gradientes son múltiplos de [1,−1]ᵀ—:
 *
 *     E[g]  = Σ_a π(a) g(a)
 *     E[g²] = Σ_a π(a) g(a)²
 *     Var   = E[g²] − E[g]²
 *
 * De la primera se lee todo el módulo 4: si b NO depende de la acción, sale
 * como factor común de Σ_a ∇π = ∇1 = 0 y LA MEDIA NO DEPENDE DE b. Si
 * depende, la media se desplaza en exactamente −p(1−p)(b(der) − b(izq)).
 *
 * `bOptimo` es la línea base que minimiza la varianza,
 * Σ_a π c² q / Σ_a π c², que para dos acciones vale
 * (1−p)q(s,der) + p·q(s,izq) — y ⚠ NO es v_π(s): coinciden solo si p = 1/2.
 * El libro no discute la línea base óptima; esto es derivación del guion.
 *
 * @param {object} entorno Entorno.
 * @param {ArrayLike<number>} theta Parámetros de la política.
 * @param {number} s Estado no terminal.
 * @param {number|ArrayLike<number>} b Línea base: un número (del estado) o un
 *   vector de `nAcciones` componentes (por acción).
 * @returns {{media: number, varianza: number, bOptimo: number|null}} Momentos.
 */
export function mediaVarianzaTermino(entorno, theta, s, b) {
  const vals = valoresDeTheta(entorno, theta);
  const pi = vals.pi[s];
  const grad = new Float64Array(entorno.dPrima);
  let media = 0;
  let segundo = 0;
  let numerador = 0;
  let denominador = 0;
  for (let a = 0; a < entorno.nAcciones; a++) {
    gradLogPiEn(entorno, theta, s, a, grad, pi);
    const c = grad[0];
    const ba = typeof b === "number" ? b : b[a];
    const g = (vals.q[s][a] - ba) * c;
    media += pi[a] * g;
    segundo += pi[a] * g * g;
    numerador += pi[a] * c * c * vals.q[s][a];
    denominador += pi[a] * c * c;
  }
  return {
    media,
    /* La resta puede dar un −1e-17 por redondeo cuando la varianza es cero
       exacta (aserción C4-5); se acota en 0 y no se devuelve un negativo. */
    varianza: Math.max(0, segundo - media * media),
    /* Sin división por cero: en un estado con política degenerada (modo
       «distinguibles») todos los c valen 0 y la línea base óptima no está
       definida. */
    bOptimo: denominador > 0 ? numerador / denominador : null,
  };
}

/**
 * La actualización ESPERADA del actor por episodio, en forma cerrada.
 *
 * Es la pieza que convierte el módulo 5 en un argumento y no en una anécdota:
 * para cada variante, hacia dónde empuja la actualización esperada con la p
 * actual. No simula nada.
 *
 *     E[Δθ] = Σ_s η(s) Σ_a f(s,a) ∇π(a|s,θ)
 *
 * con f según el uso del número aprendido:
 *
 *   · "lineaBase"  f = q_π(s,a) − b(s).  Como Σ_a b(s)∇π(a|s,θ) = b(s)∇1 = 0,
 *     el resultado es Σ_s η(s) Σ_a q_π ∇π = C·RHS = ∇J(θ) EXACTAMENTE, sea
 *     cual sea w (aserciones C4-10 y C5-1).
 *   · "baseAccion" f = q_π(s,a) − b(a).  Aquí b NO sale factor común y la
 *     media se desplaza. En su equilibrio, b(a) = Σ_s μ(s) q_π(s,a), y el
 *     desplazamiento CANCELA EL GRADIENTE ENTERO para cualquier p (C4-9),
 *     porque Σ_s η(s)Δq(s) = (Σ_s η(s)) Σ_s μ(s)Δq(s).
 *   · "critico"    f = E[δ|s,a] = r + γ v̂(s') − v̂(s), con v̂(terminal) ≐ 0.
 *     Con v̂(s,w) = w constante y γ = 1, δ vale −1 en TODA transición que no
 *     termine —y un δ igual para las dos acciones no mueve nada, porque
 *     Σ_a ∇π = 0—; el único paso distinto es el que entra en la meta, donde
 *     δ = −1−w. Sale E[Δθ] = (1−p)(−w)[1,−1]ᵀ (C5-2), y como el punto fijo
 *     del crítico es w = J(p) < 0, la actualización esperada SUBE p para
 *     cualquier p ∈ (0,1): no hay punto fijo conjunto y la política se va a
 *     p = 1, donde J = −∞. Con un peso por estado, el punto fijo de TD(0) es
 *     v_π y E[Δθ] vuelve a ser ∇J(θ) (C5-5): el sesgo entra por el
 *     *bootstrap* y su tamaño lo decide la calidad del crítico.
 *
 * ⚠ El resultado va SIN α^θ (equivale a α^θ = 1). El guion escribe C5-2 con
 * α^θ delante y C5-1 sin él; se ha unificado sin el paso, que es lo único
 * compatible con las dos a la vez.
 *
 * @param {object} entorno Entorno.
 * @param {ArrayLike<number>} theta Parámetros de la política.
 * @param {object} opciones
 * @param {string} [opciones.uso="lineaBase"] `"lineaBase"` | `"baseAccion"` |
 *   `"critico"`.
 * @param {number|ArrayLike<number>|null} [opciones.w=null] El número
 *   aprendido: un escalar (d = 1), un vector de `nEstados` (un peso por
 *   estado) o, con `"baseAccion"`, un vector de `nAcciones`. Con `null` se
 *   usa su punto fijo.
 * @returns {{deltaTheta: Float64Array, wPuntoFijo: number|Float64Array}}
 *   Actualización esperada y punto fijo del número aprendido.
 * @throws {Error} Si el uso no es uno de los tres.
 */
export function actualizacionEsperada(entorno, theta, { uso = "lineaBase", w = null } = {}) {
  if (uso !== "lineaBase" && uso !== "baseAccion" && uso !== "critico") {
    throw new Error(`Uso desconocido del valor aprendido: ${uso}`);
  }
  const vals = valoresDeTheta(entorno, theta);
  const nS = entorno.nEstados;
  const nA = entorno.nAcciones;
  const gamma = entorno.gamma;

  /* Punto fijo del número aprendido. */
  const esVector = Array.isArray(w) || ArrayBuffer.isView(w);
  const porEstado = esVector && w.length === nS;
  let wPuntoFijo;
  if (uso === "baseAccion") {
    wPuntoFijo = new Float64Array(nA);
    for (let a = 0; a < nA; a++) {
      let acumulado = 0;
      for (let s = 0; s < nS; s++) acumulado += vals.mu[s] * vals.q[s][a];
      wPuntoFijo[a] = acumulado;
    }
  } else if (porEstado) {
    /* Un peso por estado: Monte Carlo y TD(0) tabulares convergen a v_π. */
    wPuntoFijo = Float64Array.from(vals.v);
  } else if (uso === "critico") {
    /* Σ_t δ_t telescopa a −T − w por episodio, luego w → −E[T] = J(p). */
    wPuntoFijo = vals.J;
  } else {
    /* Línea base de un solo número aprendida por Monte Carlo: converge a la
       media de v_π ponderada por μ (aserción C4-12). */
    let acumulado = 0;
    for (let s = 0; s < nS; s++) acumulado += vals.mu[s] * vals.v[s];
    wPuntoFijo = acumulado;
  }

  const wUsado = w === null ? wPuntoFijo : w;
  const valorDe = (s) => {
    if (typeof wUsado === "number") return wUsado;
    return wUsado[s];
  };

  const deltaTheta = new Float64Array(entorno.dPrima);
  const grad = new Float64Array(entorno.dPrima);
  for (let s = 0; s < nS; s++) {
    for (let a = 0; a < nA; a++) {
      let f;
      if (uso === "lineaBase") {
        f = vals.q[s][a] - valorDe(s);
      } else if (uso === "baseAccion") {
        f = vals.q[s][a] - wUsado[a];
      } else {
        const { s2, r } = entorno.paso(s, a);
        const vSiguiente = entorno.esTerminal(s2) ? 0 : valorDe(s2);
        f = r + gamma * vSiguiente - valorDe(s);
      }
      const peso = vals.eta[s] * vals.pi[s][a] * f;
      if (peso === 0) continue;
      gradLogPiEn(entorno, theta, s, a, grad, vals.pi[s]);
      for (let i = 0; i < entorno.dPrima; i++) deltaTheta[i] += peso * grad[i];
    }
  }
  return { deltaTheta, wPuntoFijo };
}

/* ======================================================================== *
 * EPISODIOS
 * ======================================================================== */

/**
 * Genera un episodio siguiendo π(·|·,θ).
 *
 * @param {object} entorno Entorno.
 * @param {ArrayLike<number>} theta Parámetros de la política.
 * @param {object} rng Generador de `generador(semilla)`.
 * @param {object} [opciones]
 * @param {number} [opciones.maxPasos=10000] Tope de pasos. Hace falta porque
 *   la longitud del episodio NO está acotada: J(p) → −∞ en los extremos y una
 *   política colapsada produce episodios arbitrariamente largos. Es una
 *   simplificación por rendimiento y se declara en pantalla.
 * @returns {{estados: Int32Array, acciones: Int32Array,
 *   recompensas: Float64Array, T: number, truncado: boolean}}
 *   `estados` tiene T+1 componentes: S₀ … S_{T−1} y el estado final
 *   (terminal, o aquel en que se cortó). `acciones` y `recompensas` tienen T.
 */
export function episodio(entorno, theta, rng, { maxPasos = 10000 } = {}) {
  const estados = [];
  const acciones = [];
  const recompensas = [];
  const pi = new Float64Array(entorno.nAcciones);
  const scratch = new Float64Array(entorno.nAcciones);
  let s = entorno.inicio(rng);
  let truncado = false;
  while (true) {
    if (acciones.length >= maxPasos) {
      truncado = true;
      break;
    }
    estados.push(s);
    probabilidadesEn(entorno, theta, s, pi, scratch);
    const a = muestrearDe(pi, rng);
    const { s2, r, fin } = entorno.paso(s, a);
    acciones.push(a);
    recompensas.push(r);
    s = s2;
    if (fin) break;
  }
  estados.push(s);
  return {
    estados: Int32Array.from(estados),
    acciones: Int32Array.from(acciones),
    recompensas: Float64Array.from(recompensas),
    T: acciones.length,
    truncado,
  };
}

/**
 * Los retornos G_t de un episodio, por suma acumulada hacia atrás.
 *
 *     G_t = Σ_{k=t+1}^{T} γ^{k−t−1} R_k
 *
 * Con γ = 1 y r = −1 esto es −(T−t), pero el motor NO usa ese atajo: calcula
 * la suma, para que el mismo código sirva con γ ≠ 1 y para que la aserción
 * C3-2 tenga algo que comprobar.
 *
 * @param {ArrayLike<number>} recompensas R₁ … R_T.
 * @param {number} gamma Descuento.
 * @returns {Float64Array} G₀ … G_{T−1}.
 */
export function retornos(recompensas, gamma) {
  const T = recompensas.length;
  const G = new Float64Array(T);
  let acumulado = 0;
  for (let t = T - 1; t >= 0; t--) {
    acumulado = recompensas[t] + gamma * acumulado;
    G[t] = acumulado;
  }
  return G;
}

/* ======================================================================== *
 * FRENO: DIVERGENCIA KL Y RECORTE DE REGIÓN DE CONFIANZA
 * ======================================================================== */

/**
 * D_KL(π_ant ‖ π) entre dos políticas del mismo entorno.
 *
 * En general habría que promediar sobre los estados con μ(s); en estos dos
 * entornos NO HACE FALTA, porque todos los estados comparten la política y la
 * divergencia es la misma en todos, con Σ_s μ(s) = 1 (aserción C6-9). Con dos
 * acciones se reduce a la fórmula del panel del módulo 6:
 *
 *     D_KL = p_ant·ln(p_ant/p) + (1−p_ant)·ln((1−p_ant)/(1−p))
 *
 * ⚠ Las probabilidades se acotan a [1e-12, 1−1e-12] ANTES de tomar
 * logaritmos, así que la salida es SIEMPRE FINITA. Esa acotación es solo para
 * la KL: la política usa la softmax con resta del máximo, y ahí un 0 exacto
 * es correcto.
 *
 * @param {object} entorno Entorno.
 * @param {ArrayLike<number>} thetaAnt Política anterior.
 * @param {ArrayLike<number>} theta Política nueva.
 * @returns {number} Divergencia, finita y no negativa.
 */
export function klPolitica(entorno, thetaAnt, theta) {
  const ant = distribucionCompartida(entorno, thetaAnt);
  const nueva = distribucionCompartida(entorno, theta);
  let kl = 0;
  for (let a = 0; a < entorno.nAcciones; a++) {
    const pa = Math.min(Math.max(ant[a], EPS_KL), 1 - EPS_KL);
    const pn = Math.min(Math.max(nueva[a], EPS_KL), 1 - EPS_KL);
    kl += pa * Math.log(pa / pn);
  }
  return kl;
}

/**
 * El recorte de región de confianza del módulo 6:
 *
 *     θ ← θ_ant + τ·Δθ,   τ = max{ τ ∈ (0,1] : D_KL(π_ant ‖ π_{θ_ant+τΔθ}) ≤ δ }
 *
 * Es la otra cara de la idea de `5_Tema_5_2#slide-19`, y la que el examen
 * llama ESTRATEGIA DE REGIÓN DE CONFIANZA: se calcula el paso y, si mueve la
 * política más de lo permitido, se recorta hasta que quepa.
 *
 * ⚠ Por qué la bisección es válida: a lo largo del rayo θ_ant + τΔθ la
 * divergencia es ESTRICTAMENTE CRECIENTE en τ, porque
 * dD_KL/dτ = Δz·(p(τ) − p_ant) y p(τ) se aleja de p_ant en el sentido de Δz
 * (derivación del guion, aserción C6-2). Se biseca 60 veces, lo que fija τ
 * con error menor que 2⁻⁶⁰.
 *
 * @param {object} entorno Entorno.
 * @param {ArrayLike<number>} thetaAnt Política anterior.
 * @param {ArrayLike<number>} deltaTheta Incremento propuesto.
 * @param {number} delta Límite δ de divergencia por actualización.
 * @returns {{tau: number, recortado: boolean, kl: number}} Factor de recorte
 *   (siempre en (0,1]), si se ha recortado y la divergencia resultante.
 */
export function recorteRegion(entorno, thetaAnt, deltaTheta, delta) {
  const d = thetaAnt.length;
  const candidato = new Float64Array(d);
  const klEn = (tau) => {
    for (let i = 0; i < d; i++) candidato[i] = thetaAnt[i] + tau * deltaTheta[i];
    return klPolitica(entorno, thetaAnt, candidato);
  };
  const klEntero = klEn(1);
  /* Si ya cabe, τ = 1 exacto y NO se cuenta como recorte (aserción C6-4).
     Incluye el caso Δθ = 0, donde la divergencia es cero. */
  if (!(klEntero > delta)) return { tau: 1, recortado: false, kl: klEntero };
  let bajo = 0;
  let alto = 1;
  for (let i = 0; i < PASOS_BISECCION; i++) {
    const medio = 0.5 * (bajo + alto);
    if (klEn(medio) <= delta) bajo = medio;
    else alto = medio;
  }
  /* `bajo` solo podría quedarse en 0 si ni siquiera 2⁻⁶⁰ cupiera, lo que
     exigiría un Δθ astronómico; el respaldo mantiene el contrato τ ∈ (0,1]
     de la prueba estructural Q-10. */
  const tau = bajo > 0 ? bajo : Math.pow(2, -PASOS_BISECCION);
  return { tau, recortado: true, kl: klEn(tau) };
}

/* ======================================================================== *
 * ALGORITMOS
 * ======================================================================== */

/** Norma euclídea de un vector. */
function norma(v) {
  let suma = 0;
  for (let i = 0; i < v.length; i++) suma += v[i] * v[i];
  return Math.sqrt(suma);
}

/**
 * El tamaño del vector de pesos del valor según la capacidad y la línea base.
 *
 * @param {object} entorno Entorno.
 * @param {string} base `"cero"` | `"estado"` | `"accion"`.
 * @param {string} capacidad `"unNumero"` | `"porEstado"`.
 * @returns {number} d.
 */
function dimensionW(entorno, base, capacidad) {
  if (base === "cero") return 0;
  if (base === "accion") return entorno.nAcciones;
  return capacidad === "porEstado" ? entorno.nEstados : 1;
}

/**
 * Prepara el vector de pesos inicial.
 *
 * @param {number} d Dimensión.
 * @param {number|ArrayLike<number>|null} w0 Valor inicial; por omisión 0, que
 *   es el «e.g., to 0» de los recuadros del libro.
 * @returns {Float64Array} Pesos iniciales.
 */
function pesosIniciales(d, w0) {
  const w = new Float64Array(d);
  if (w0 === null || w0 === undefined) return w;
  if (typeof w0 === "number") w.fill(w0);
  else for (let i = 0; i < d && i < w0.length; i++) w[i] = w0[i];
  return w;
}

/**
 * REINFORCE con línea base opcional: el recuadro de S&B p. 350 (sin línea
 * base) y el de la p. 352 (con ella), sin recortes.
 *
 * ```
 * Para cada episodio:
 *     Generar S_0, A_0, R_1, …, S_{T−1}, A_{T−1}, R_T siguiendo π(·|·,θ)
 *     Para cada paso t = 0, 1, …, T−1:
 *         G  ←  Σ_{k=t+1}^{T} γ^{k−t−1} R_k
 *         δ  ←  G − b(S_t)                       (δ = G sin línea base)
 *         w  ←  w + α^w · δ · ∇v̂(S_t,w)
 *         θ  ←  θ + α^θ · γ^t · δ · ∇ln π(A_t|S_t,θ)
 * ```
 *
 * Tres cosas que el motor respeta al pie de la letra:
 *
 *   · EL FACTOR γ^t se lleva escrito aunque con γ = 1 valga siempre 1 y
 *     desaparezca. Con γ < 1, omitirlo da OTRO ALGORITMO, no una
 *     simplificación (aserción C3-6).
 *   · LAS T ACTUALIZACIONES DE UN EPISODIO se aplican UNA A UNA y en orden
 *     creciente de t, cada una sobre el θ ya actualizado por la anterior. Es
 *     lo que hace el recuadro del libro y no es lo mismo que acumular el
 *     incremento y aplicarlo al final (para eso está `acumularEpisodio`).
 *   · G_t se calcula con las recompensas YA OBSERVADAS: REINFORCE es Monte
 *     Carlo y todas sus actualizaciones se hacen en retrospectiva. Por eso es
 *     DENTRO DE POLÍTICA y FUERA DE LÍNEA.
 *
 * @param {object} entorno Entorno.
 * @param {ArrayLike<number>} theta0 θ inicial (se copia).
 * @param {number|Array<object>} episodios Número de episodios a muestrear con
 *   `opciones.rng`, o una lista de episodios YA MUESTREADOS.
 *   ⚠ Pasar episodios ya muestreados solo es fiel a REINFORCE si esos
 *   episodios los generó la política que va evolucionando; se usa con θ
 *   CONGELADO (módulo 4, Viz 2) y en las aserciones que comparan dos variantes
 *   sobre las mismas trayectorias (C3-6, C5-7, C6-5, C6-6).
 * @param {object} opciones
 * @param {number} opciones.alphaTheta Paso de la política α^θ.
 * @param {number} [opciones.alphaW=0] Paso del valor α^w.
 * @param {number} [opciones.gamma] Descuento; por omisión el del entorno.
 * @param {number} [opciones.maxPasos=10000] Tope de pasos por episodio.
 * @param {object} [opciones.rng] Generador; obligatorio si `episodios` es un
 *   número.
 * @param {number|ArrayLike<number>|null} [opciones.w0=null] w inicial.
 * @param {string} [opciones.base="cero"] `"cero"` | `"estado"` | `"accion"`.
 * @param {string} [opciones.capacidad="unNumero"] Capacidad del aproximador
 *   de valor con `base: "estado"`: `"unNumero"` (v̂(s,w) = w, d = 1, el de la
 *   Figura 13.2) o `"porEstado"` (un peso por estado, d = |S|).
 * @param {object|null} [opciones.freno=null] `{ delta }` para recortar cada
 *   actualización a D_KL ≤ δ. Exige `acumularEpisodio`.
 * @param {boolean} [opciones.acumularEpisodio=false] `true` acumula el
 *   incremento del episodio y lo aplica de una vez, con ∇ln π evaluado en la
 *   política ANTERIOR. Hace falta para poder medir el salto (módulo 6) y la
 *   página declara la diferencia con el orden del libro.
 * @param {boolean} [opciones.congelarTheta=false] `true` calcula el
 *   incremento y NO lo aplica: mide EL ESTIMADOR, no el algoritmo (módulo 4,
 *   Viz 2).
 * @param {boolean} [opciones.medirSalto] Mide el salto de p y la KL de cada
 *   actualización aplicada; por omisión, solo con `acumularEpisodio`.
 * @param {boolean} [opciones.usarGammaT=true] `false` omite el factor γ^t.
 *   Existe solo para la aserción C3-6: con γ = 1 las dos trayectorias son
 *   idénticas, y con γ = 0,9 NO lo son — omitirlo da otro algoritmo.
 * @returns {object} `{ theta, w, curvaG0, curvaP, incrementos, truncados,
 *   recortes, actualizaciones, cortada, cortadaEn, saltoMaxP, klMax }`.
 * @throws {Error} Si falta el generador o la línea base no existe.
 */
export function reinforceLineaBase(entorno, theta0, episodios, opciones = {}) {
  const {
    alphaTheta, alphaW = 0, gamma = entorno.gamma, maxPasos = 10000, rng = null,
    w0 = null, base = "cero", capacidad = "unNumero", freno = null,
    acumularEpisodio = false, congelarTheta = false, medirSalto = acumularEpisodio,
    usarGammaT = true,
  } = opciones;
  if (base !== "cero" && base !== "estado" && base !== "accion") {
    throw new Error(`Línea base desconocida: ${base}`);
  }
  const lista = Array.isArray(episodios) ? episodios : null;
  const nEpisodios = lista ? lista.length : episodios;
  if (!lista && !rng) throw new Error("Hacen falta episodios ya muestreados o un generador");
  if (freno && !acumularEpisodio) {
    throw new Error("El freno de región de confianza exige `acumularEpisodio: true`");
  }

  const dPrima = entorno.dPrima;
  const theta = Float64Array.from(theta0);
  const thetaAnt = new Float64Array(dPrima);
  const incremento = new Float64Array(dPrima);
  const grad = new Float64Array(dPrima);
  const pi = new Float64Array(entorno.nAcciones);
  const scratch = new Float64Array(entorno.nAcciones);
  const w = pesosIniciales(dimensionW(entorno, base, capacidad), w0);

  const curvaG0 = [];
  const curvaP = [];
  const incrementos = [];
  let truncados = 0;
  let recortes = 0;
  let actualizaciones = 0;
  let cortada = false;
  let cortadaEn = null;
  let saltoMaxP = 0;
  let klMax = 0;

  /* v̂(s,w) y su gradiente según la línea base elegida. Con base "accion" el
     índice es la ACCIÓN, no el estado: son dos números, la media de los
     retornos observados tras cada una. Esa variante NO es del libro ni de las
     diapositivas —es la construcción más natural de línea base por acción, y
     está aquí porque es la que el examen usa como distractor—, y la página lo
     declara. */
  const indiceW = (s, a) => {
    if (base === "accion") return a;
    return capacidad === "porEstado" ? s : 0;
  };

  for (let k = 0; k < nEpisodios; k++) {
    const ep = lista ? lista[k] : episodio(entorno, theta, rng, { maxPasos });
    if (ep.truncado) truncados += 1;
    const G = retornos(ep.recompensas, gamma);
    const T = ep.acciones.length;
    curvaG0.push(T > 0 ? G[0] : 0);

    thetaAnt.set(theta);
    incremento.fill(0);
    let primeraComponente = 0;
    let descuento = 1;

    for (let t = 0; t < T; t++) {
      const s = ep.estados[t];
      const a = ep.acciones[t];
      const base0 = base === "cero" ? 0 : w[indiceW(s, a)];
      const delta = G[t] - base0;
      if (base !== "cero" && alphaW !== 0) {
        /* ∇v̂ = 1 en la componente que representa a este estado (o a esta
           acción): el aproximador es lineal con característica indicadora. */
        w[indiceW(s, a)] += alphaW * delta;
      }
      const referencia = acumularEpisodio ? thetaAnt : theta;
      probabilidadesEn(entorno, referencia, s, pi, scratch);
      gradLogPiEn(entorno, referencia, s, a, grad, pi);
      const factor = (usarGammaT ? descuento : 1) * delta;
      primeraComponente += factor * grad[0];
      if (acumularEpisodio || congelarTheta) {
        for (let i = 0; i < dPrima; i++) incremento[i] += alphaTheta * factor * grad[i];
      } else {
        for (let i = 0; i < dPrima; i++) theta[i] += alphaTheta * factor * grad[i];
      }
      descuento *= gamma;
    }

    /* El incremento se anota SIN α^θ, que es la forma en que lo escribe el
       guion del módulo 4 (§5, Viz 2): así la comparación entre líneas base no
       depende del paso elegido. */
    incrementos.push(primeraComponente);

    if (!congelarTheta) {
      if (acumularEpisodio) {
        let tau = 1;
        if (freno) {
          const recorte = recorteRegion(entorno, thetaAnt, incremento, freno.delta);
          tau = recorte.tau;
          if (recorte.recortado) recortes += 1;
        }
        for (let i = 0; i < dPrima; i++) theta[i] = thetaAnt[i] + tau * incremento[i];
      }
      actualizaciones += acumularEpisodio ? 1 : T;
      if (medirSalto) {
        const salto = Math.abs(pDeTheta(entorno, theta) - pDeTheta(entorno, thetaAnt));
        if (salto > saltoMaxP) saltoMaxP = salto;
        const kl = klPolitica(entorno, thetaAnt, theta);
        if (kl > klMax) klMax = kl;
      }
    }

    curvaP.push(pDeTheta(entorno, theta));

    if (norma(theta) > TOPE_THETA || (w.length > 0 && norma(w) > TOPE_W)) {
      cortada = true;
      cortadaEn = k;
      break;
    }
  }

  return {
    theta,
    w,
    curvaG0: Float64Array.from(curvaG0),
    curvaP: Float64Array.from(curvaP),
    incrementos: Float64Array.from(incrementos),
    truncados,
    recortes,
    actualizaciones,
    cortada,
    cortadaEn,
    saltoMaxP,
    klMax,
  };
}

/**
 * REINFORCE a secas: el recuadro de S&B p. 350, sin línea base.
 *
 * Es `reinforceLineaBase` con `base: "cero"`; como la línea base puede ser
 * idénticamente cero, aquella es una generalización estricta de esta.
 *
 * @param {object} entorno Entorno.
 * @param {ArrayLike<number>} theta0 θ inicial.
 * @param {number|Array<object>} episodios Episodios o número de episodios.
 * @param {object} opciones Las de `reinforceLineaBase`; `base` se ignora.
 * @returns {object} Igual que `reinforceLineaBase`.
 */
export function reinforce(entorno, theta0, episodios, opciones = {}) {
  return reinforceLineaBase(entorno, theta0, episodios, { ...opciones, base: "cero" });
}

/**
 * Actor-crítico a un paso, episódico: el recuadro de S&B p. 354, íntegro.
 *
 * ```
 * Para cada episodio:
 *     Inicializar S (primer estado del episodio)
 *     I ← 1
 *     Mientras S no sea terminal:
 *         A ~ π(·|S,θ)
 *         Tomar A, observar S', R
 *         δ ← R + γ·v̂(S',w) − v̂(S,w)      (si S' es terminal, v̂(S',w) ≐ 0)
 *         w ← w + α^w · δ · ∇v̂(S,w)
 *         θ ← θ + α^θ · I · δ · ∇ln π(A|S,θ)
 *         I ← γ·I
 *         S ← S'
 * ```
 *
 * ⚠ SE EJECUTA LA VERSIÓN DEL LIBRO, no la de `5_Tema_5_2#slide-17` (van
 * Hasselt / Silver), que es continuada, usa β para el paso del crítico, no
 * lleva el acumulador I, no dice qué hacer en el estado terminal y no
 * inicializa w. No son incompatibles —son el mismo algoritmo en variante
 * continuada y episódica— pero no se pueden mezclar, y en este entorno la
 * línea del terminal es LA ÚNICA QUE LLEVA INFORMACIÓN. La página muestra las
 * dos enfrentadas y dice cuál corre (guion §0.4).
 *
 * ⚠ I NO ES LA IDENTIDAD: es el γ^t llevado incrementalmente. Con γ = 1 vale
 * siempre 1 y desaparece (aserción C5-7).
 *
 * ⚠ Este algoritmo NO acepta episodios ya muestreados: cambia la política
 * DENTRO del episodio, así que no puede reutilizar una trayectoria generada
 * por otra variante. Lo que se comparte con las demás variantes de una tanda
 * es LA SEMILLA, no la trayectoria (módulo 5, §10).
 *
 * ⚠ Al truncar por el tope de pasos, la última transición NO se trata como
 * terminal: v̂ del estado siguiente entra normalmente. Es importante, porque
 * tratarla como terminal introduciría una sorpresa positiva que no existe.
 *
 * @param {object} entorno Entorno.
 * @param {ArrayLike<number>} theta0 θ inicial (se copia).
 * @param {number} episodios Número de episodios.
 * @param {object} opciones
 * @param {number} opciones.alphaTheta Paso de la política α^θ.
 * @param {number} opciones.alphaW Paso del crítico α^w.
 * @param {object} opciones.rng Generador.
 * @param {number} [opciones.gamma] Descuento; por omisión el del entorno.
 * @param {number} [opciones.maxPasos=1000] Tope de pasos por episodio.
 * @param {number|ArrayLike<number>|null} [opciones.w0=null] w inicial.
 * @param {string} [opciones.capacidad="unNumero"] `"unNumero"`
 *   (v̂(s,w) = w, d = 1) o `"porEstado"` (one-hot, d = |S|).
 * @param {boolean} [opciones.usarI=true] `false` omite el acumulador I; solo
 *   para la aserción C5-7.
 * @returns {object} `{ theta, w, curvaG0, curvaP, truncados, actualizaciones,
 *   cortada, cortadaEn, recortes, saltoMaxP, klMax }`.
 * @throws {Error} Si falta el generador.
 */
export function actorCritico(entorno, theta0, episodios, opciones = {}) {
  const {
    alphaTheta, alphaW, gamma = entorno.gamma, maxPasos = 1000, rng = null,
    w0 = null, capacidad = "unNumero", usarI = true,
  } = opciones;
  if (!rng) throw new Error("`actorCritico` necesita un generador: no acepta episodios ya muestreados");

  const dPrima = entorno.dPrima;
  const theta = Float64Array.from(theta0);
  const grad = new Float64Array(dPrima);
  const pi = new Float64Array(entorno.nAcciones);
  const scratch = new Float64Array(entorno.nAcciones);
  const d = capacidad === "porEstado" ? entorno.nEstados : 1;
  const w = pesosIniciales(d, w0);
  const indice = (s) => (capacidad === "porEstado" ? s : 0);

  const curvaG0 = [];
  const curvaP = [];
  let truncados = 0;
  let actualizaciones = 0;
  let cortada = false;
  let cortadaEn = null;

  for (let k = 0; k < episodios; k++) {
    let s = entorno.inicio(rng);
    let I = 1;
    let descuento = 1;
    let G0 = 0;
    let pasos = 0;
    while (!entorno.esTerminal(s) && pasos < maxPasos) {
      probabilidadesEn(entorno, theta, s, pi, scratch);
      const a = muestrearDe(pi, rng);
      const { s2, r } = entorno.paso(s, a);
      const vSiguiente = entorno.esTerminal(s2) ? 0 : w[indice(s2)];
      const delta = r + gamma * vSiguiente - w[indice(s)];
      w[indice(s)] += alphaW * delta;
      gradLogPiEn(entorno, theta, s, a, grad, pi);
      const factor = alphaTheta * (usarI ? I : 1) * delta;
      for (let i = 0; i < dPrima; i++) theta[i] += factor * grad[i];
      I *= gamma;
      G0 += descuento * r;
      descuento *= gamma;
      s = s2;
      pasos += 1;
      actualizaciones += 1;
    }
    if (!entorno.esTerminal(s)) truncados += 1;
    curvaG0.push(G0);
    curvaP.push(pDeTheta(entorno, theta));
    if (norma(theta) > TOPE_THETA || norma(w) > TOPE_W) {
      cortada = true;
      cortadaEn = k;
      break;
    }
  }

  return {
    theta,
    w,
    curvaG0: Float64Array.from(curvaG0),
    curvaP: Float64Array.from(curvaP),
    incrementos: new Float64Array(0),
    truncados,
    recortes: 0,
    actualizaciones,
    cortada,
    cortadaEn,
    saltoMaxP: 0,
    klMax: 0,
  };
}

/* ======================================================================== *
 * TANDAS Y PROMEDIOS
 * ======================================================================== */

/** Las variantes que `tanda` sabe ejecutar. */
const VARIANTES = {
  reinforce: { fn: "mc", base: "cero" },
  reinforceLineaBase: { fn: "mc", base: null },
  lineaBase: { fn: "mc", base: "estado" },
  actorCritico: { fn: "ac", base: null },
};

/**
 * Una tanda: varias ejecuciones independientes de una o varias variantes,
 * promediadas episodio a episodio.
 *
 * La usa el Web Worker. La ejecución k de CADA variante usa
 * `generador(semilla + k)`, igual que el resto del sitio.
 *
 * ⚠ QUÉ SE COMPARTE ENTRE VARIANTES. El guion habla en varios sitios de «los
 * mismos episodios para las dos curvas». Eso NO ES POSIBLE en REINFORCE: los
 * episodios los genera la política que se está actualizando, así que en
 * cuanto los θ de dos variantes divergen —y divergen desde la primera
 * actualización si el paso o la línea base son distintos—, las trayectorias
 * dejan de coincidir. Lo que comparten es LA SEMILLA de cada ejecución y el
 * orden de consumo del generador, que es exactamente lo que hace falta para
 * que dos variantes IDÉNTICAS den curvas idénticas (aserciones C4-14 y C6-10)
 * y para que la comparación no esté contaminada por semillas distintas. El
 * único sitio donde los episodios sí se comparten literalmente es el estudio
 * del estimador con θ congelado del módulo 4, que se hace fuera de `tanda`
 * pasando una lista de episodios a `reinforceLineaBase`.
 *
 * @param {object} config
 * @param {string|object} config.entorno Descriptor o entorno.
 * @param {string|string[]} config.algoritmo Variante o variantes:
 *   `"reinforce"`, `"reinforceLineaBase"`, `"lineaBase"`, `"actorCritico"`.
 * @param {number} config.episodios Episodios por ejecución.
 * @param {number} config.ejecuciones Ejecuciones a promediar.
 * @param {number} config.semilla Semilla base.
 * @param {number} [config.p0] p inicial; por omisión 0,05, la ε-greedy hacia
 *   la izquierda del Ejemplo 13.1. ⚠ El libro NO declara la inicialización de
 *   sus Figuras 13.1 y 13.2, y el «e.g., to 0» de su pseudocódigo (que da
 *   p = 0,5 y E[G₀] = −12) es incompatible con el arranque de esas figuras,
 *   que está en torno a −90. La página elige y lo dice.
 * @param {ArrayLike<number>} [config.theta0] θ inicial explícito; tiene
 *   prioridad sobre `p0`.
 * @param {object} [opciones]
 * @param {Function} [opciones.alProgresar] `(fraccion) => void`, llamada al
 *   terminar cada ejecución de cada variante.
 * @returns {object} `{ variantes, curvas, porEjecucion, ejecuciones,
 *   episodios, semilla, truncados, cortadas, recortes, colapsadas,
 *   saltoMaxP, klMax, ejecucionesPorEpisodio }`. Las curvas medias van en
 *   `curvas["<variante>.G0"]` y `curvas["<variante>.p"]`.
 * @throws {Error} Si alguna variante no existe.
 */
export function tanda(config, { alProgresar = null } = {}) {
  const {
    entorno: descEntorno, algoritmo, episodios, ejecuciones, semilla,
    p0 = 0.05, theta0 = null, alphaTheta, alphaW = 0, gamma = null,
    maxPasos = 10000, w0 = null, base = "estado", capacidad = "unNumero",
    freno = null, acumularEpisodio = false,
  } = config;
  const entorno = construirEntorno(descEntorno);
  const variantes = Array.isArray(algoritmo) ? algoritmo : [algoritmo];
  for (const v of variantes) {
    if (!VARIANTES[v]) throw new Error(`Variante desconocida: ${v}`);
  }
  const theta0Real = theta0 ? Float64Array.from(theta0) : thetaDeP(entorno, p0);
  const gammaReal = gamma === null ? entorno.gamma : gamma;

  const curvas = {};
  const porEjecucion = {};
  const truncados = {};
  const cortadas = {};
  const recortes = {};
  const colapsadas = {};
  const saltoMaxP = {};
  const klMax = {};
  const ejecucionesPorEpisodio = {};
  const total = variantes.length * ejecuciones;
  let hechas = 0;

  for (const variante of variantes) {
    const spec = VARIANTES[variante];
    const baseReal = spec.base === null ? base : spec.base;
    const sumaG0 = new Float64Array(episodios);
    const sumaP = new Float64Array(episodios);
    const vivas = new Float64Array(episodios);
    const detalle = {
      curvaG0: [], curvaP: [], pFinal: [], thetaFinal: [], wFinal: [], cortadaEn: [],
    };
    truncados[variante] = 0;
    cortadas[variante] = 0;
    recortes[variante] = 0;
    colapsadas[variante] = 0;
    saltoMaxP[variante] = 0;
    klMax[variante] = 0;

    for (let k = 0; k < ejecuciones; k++) {
      const rng = generador(semilla + k);
      const comunes = {
        alphaTheta, alphaW, gamma: gammaReal, maxPasos, rng, w0, capacidad,
      };
      const res = spec.fn === "ac"
        ? actorCritico(entorno, theta0Real, episodios, comunes)
        : reinforceLineaBase(entorno, theta0Real, episodios, {
          ...comunes, base: baseReal, freno, acumularEpisodio,
        });

      for (let e = 0; e < res.curvaG0.length; e++) {
        sumaG0[e] += res.curvaG0[e];
        sumaP[e] += res.curvaP[e];
        vivas[e] += 1;
      }
      detalle.curvaG0.push(res.curvaG0);
      detalle.curvaP.push(res.curvaP);
      const pFinal = res.curvaP.length > 0 ? res.curvaP[res.curvaP.length - 1] : pDeTheta(entorno, theta0Real);
      detalle.pFinal.push(pFinal);
      detalle.thetaFinal.push(res.theta);
      detalle.wFinal.push(res.w);
      detalle.cortadaEn.push(res.cortadaEn);
      truncados[variante] += res.truncados;
      recortes[variante] += res.recortes;
      if (res.cortada) cortadas[variante] += 1;
      if (pFinal >= UMBRAL_COLAPSO.alto || pFinal <= UMBRAL_COLAPSO.bajo) colapsadas[variante] += 1;
      if (res.saltoMaxP > saltoMaxP[variante]) saltoMaxP[variante] = res.saltoMaxP;
      if (res.klMax > klMax[variante]) klMax[variante] = res.klMax;

      hechas += 1;
      if (alProgresar) alProgresar(hechas / total);
    }

    /* Se promedia SOLO sobre las ejecuciones vivas en cada episodio: una
       ejecución cortada por desbordamiento no se rellena con su último valor
       ni se descarta en silencio. `ejecucionesPorEpisodio` dice cuántas son. */
    const mediaG0 = new Float64Array(episodios);
    const mediaP = new Float64Array(episodios);
    for (let e = 0; e < episodios; e++) {
      if (vivas[e] > 0) {
        mediaG0[e] = sumaG0[e] / vivas[e];
        mediaP[e] = sumaP[e] / vivas[e];
      }
    }
    curvas[`${variante}.G0`] = mediaG0;
    curvas[`${variante}.p`] = mediaP;
    porEjecucion[variante] = detalle;
    ejecucionesPorEpisodio[variante] = vivas;
  }

  return {
    variantes, curvas, porEjecucion, ejecuciones, episodios, semilla,
    truncados, cortadas, recortes, colapsadas, saltoMaxP, klMax,
    ejecucionesPorEpisodio,
  };
}

/**
 * Binado de una muestra para los polígonos de frecuencias de los módulos 3
 * y 4. Sin dependencias del árbol de la página.
 *
 * ⚠ `frecuencias` cuenta SOLO los valores dentro de [min, max]; los de fuera
 * van a `colaIzq` y `colaDch`. Así se cumple la prueba estructural Q-12:
 * Σ frecuencias + colaIzq + colaDch = número de muestras. La interfaz puede
 * sumar la cola al primer o al último intervalo para dibujarla, y rotularlo
 * («≤ −200»), que es lo que pide el módulo 3.
 *
 * @param {ArrayLike<number>} muestras Valores.
 * @param {object} opciones
 * @param {number} opciones.min Extremo inferior del rango.
 * @param {number} opciones.max Extremo superior del rango.
 * @param {number} opciones.nIntervalos Número de intervalos.
 * @returns {{centros: Float64Array, frecuencias: Float64Array,
 *   relativas: Float64Array, media: number, desviacion: number,
 *   colaIzq: number, colaDch: number, n: number}} Histograma.
 * @throws {Error} Si el rango o el número de intervalos no son válidos.
 */
export function histograma(muestras, { min, max, nIntervalos }) {
  if (!(max > min)) throw new Error("El rango del histograma exige max > min");
  if (!(nIntervalos >= 1)) throw new Error("Hace falta al menos un intervalo");
  const ancho = (max - min) / nIntervalos;
  const centros = new Float64Array(nIntervalos);
  const frecuencias = new Float64Array(nIntervalos);
  for (let i = 0; i < nIntervalos; i++) centros[i] = min + ancho * (i + 0.5);
  let colaIzq = 0;
  let colaDch = 0;
  let suma = 0;
  let suma2 = 0;
  const n = muestras.length;
  for (let i = 0; i < n; i++) {
    const x = muestras[i];
    suma += x;
    suma2 += x * x;
    if (x < min) {
      colaIzq += 1;
    } else if (x > max) {
      colaDch += 1;
    } else {
      const j = Math.min(nIntervalos - 1, Math.floor((x - min) / ancho));
      frecuencias[j] += 1;
    }
  }
  const media = n > 0 ? suma / n : 0;
  /* Desviación típica poblacional (÷ n): con las muestras de esta página
     —10 000 episodios, 100 ejecuciones— la diferencia con ÷(n−1) está muy por
     debajo de las tolerancias del guion, y las medidas que la usan son
     cocientes en los que se cancela. */
  const desviacion = n > 0 ? Math.sqrt(Math.max(0, suma2 / n - media * media)) : 0;
  const relativas = new Float64Array(nIntervalos);
  if (n > 0) for (let i = 0; i < nIntervalos; i++) relativas[i] = frecuencias[i] / n;
  return { centros, frecuencias, relativas, media, desviacion, colaIzq, colaDch, n };
}
