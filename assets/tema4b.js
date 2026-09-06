/* ==========================================================================
   RL · IMAT — Tema 4 (continuación): fórmulas intermedias entre MC y TD
   Comportamiento de los dos módulos de tema4b.html y de las dos figuras
   estáticas de los bloques de estudio (B2 y B7).

   Motor separado de interfaz: toda la matemática vive en assets/npasos.js y
   en assets/sinmodelo.js (que no tocan el DOM y se testean desde node). Aquí
   solo se pinta y se escucha.

   DOS DECISIONES DE ESTE FICHERO QUE CONVIENE LEER ANTES DE TOCAR NADA

   1. LA FAMILIA λ DEL MÓDULO 1 USA TD(λ) HACIA ATRÁS, NO EL RETORNO λ FUERA
      DE LÍNEA.  El guion proponía `retornoLambdaFueraDeLinea` (figura 12.3);
      medido sobre este lote cuesta 27 s, porque calcular G_t^λ para los T
      instantes de un episodio es O(T²) y aquí hay episodios de 768 pasos.
      `tdLambdaAtras` es O(T·|S|), cuesta 445 ms, es la figura 12.6 del libro
      —la misma tarea y los mismos ejes— y además es EL ALGORITMO QUE SE
      PRESENTA EN CLASE (`4_Tema4_2#slide-13`), que es el que la afirmación de
      `#slide-17` necesita respaldar. Se declara en el título de la gráfica.

   2. LAS CURVAS NO SELECCIONADAS SE PINTAN CON UN TINTE, NO CON `opacidad`.
      `graficaLineas` de nucleo.js no acepta hoy un parámetro de opacidad (el
      guion §C2 lo proponía) y nucleo.js no se toca. La atenuación se consigue
      pasando el color ya convertido a `rgba(...)`, que es lo mismo que se
      vería con el parámetro.

   Diapositivas: 4_Tema4_2#slide-2 a #slide-17.
   Libro: Sutton & Barto §7.1, §7.2, §12.1, §12.2 y §12.6.
   ========================================================================== */

import {
  iniciarPagina, rejilla, graficaLineas, crearQuiz, pintar,
  num, numMat, tono, el, textoSobre, alCambiarTema, renderizarMatematicas,
  leyenda, deslizador, COLORES_SERIE,
} from "./nucleo.js";

import { t } from "./i18n.js";

import { paseoAleatorio, loteEpisodios, errorRMS } from "./sinmodelo.js";

import {
  nStepTD, barridoNAlpha, caminoDirectoDerecha, pesosLambda, tdLambdaAtras,
  cadenaTimbreLuz, creditoPorLambda, cruceTrazas, TIMBRE, LUZ,
} from "./npasos.js";

iniciarPagina();

/* ======================================================================= *
 * 0. Utilidades comunes
 * ======================================================================= */

const $ = (sel) => document.querySelector(sel);

/** Repintar los SVG cuando cambia el tema (llevan colores ya resueltos). */
const repintadores = [];
alCambiarTema(() => repintadores.forEach((fn) => fn()));

/* --- semilla de la página: solo la consume el módulo 1 ------------------ */

const entradaSemilla = $("#semilla");
const oyentesSemilla = [];
const semillaActual = () => {
  const n = parseInt(entradaSemilla.value, 10);
  return Number.isFinite(n) && n > 0 ? n : 2026;
};
entradaSemilla.addEventListener("change", () => oyentesSemilla.forEach((fn) => fn()));

/* --- construcción de interfaz ------------------------------------------ */

/** Caja `.viz` con su título; devuelve el cuerpo donde va la visualización. */
function caja(zona, tituloHtml) {
  const div = document.createElement("div");
  div.className = "viz";
  let titulo = null;
  if (tituloHtml) {
    titulo = document.createElement("p");
    titulo.className = "viz-titulo";
    titulo.innerHTML = tituloHtml;
    div.appendChild(titulo);
    renderizarMatematicas(titulo);
  }
  const cuerpo = document.createElement("div");
  div.appendChild(cuerpo);
  zona.appendChild(div);
  return { cuerpo, titulo, caja: div };
}

/** Párrafo suelto con clase; devuelve el nodo para poder actualizarlo. */
function parrafo(zona, clase, html) {
  const p = document.createElement("p");
  p.className = clase;
  p.innerHTML = html;
  zona.appendChild(p);
  renderizarMatematicas(p);
  return p;
}

/** Recuadro con la pregunta que lanza la diapositiva y de dónde sale. */
function preguntaDiapo(zona, textoHtml, deDonde) {
  const div = document.createElement("div");
  div.className = "pregunta-diapo";
  div.innerHTML = `<p>${textoHtml}</p><span class="de-donde">${deDonde}</span>`;
  zona.appendChild(div);
  renderizarMatematicas(div);
  return div;
}

/** Fila `.controles` vacía. */
function panelControles(zona) {
  const div = document.createElement("div");
  div.className = "controles";
  zona.appendChild(div);
  return div;
}

/** Control con deslizador y su valor al lado. */
function controlDeslizador(panel, opciones) {
  const {
    etiqueta, min, max, paso = 1, valor,
    formato = (v) => String(v), alCambiar = () => {},
  } = opciones;

  const div = document.createElement("div");
  div.className = "control";
  const label = document.createElement("label");
  label.className = "literal";
  const texto = document.createElement("span");
  texto.innerHTML = etiqueta;
  const salida = document.createElement("span");
  salida.className = "valor";
  label.append(texto, document.createTextNode(" "), salida);

  const input = document.createElement("input");
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.step = String(paso);
  input.value = String(valor);

  div.append(label, input);
  panel.appendChild(div);
  renderizarMatematicas(label);

  deslizador(input, salida, alCambiar, formato);

  return {
    input,
    fijar(v) {
      input.value = String(v);
      salida.textContent = formato(v);
    },
    /* Los dos deslizadores del módulo 1 conviven, pero solo uno manda según
       la familia elegida: el que no manda se deshabilita en vez de esconderse,
       para que la fila de controles no salte de sitio al conmutar. */
    habilitar(activo) {
      input.disabled = !activo;
      div.style.opacity = activo ? "1" : "0.45";
    },
  };
}

/** Grupo de botones que se comporta como un grupo de radio. */
function grupoRadio(panel, etiqueta, opciones, valorInicial, alElegir) {
  const div = document.createElement("div");
  div.className = "control";
  const label = document.createElement("label");
  label.className = "literal";
  label.innerHTML = etiqueta;
  const fila = document.createElement("div");
  fila.className = "grupo-botones";
  div.append(label, fila);
  panel.appendChild(div);
  renderizarMatematicas(label);

  const botones = opciones.map((op) => {
    const b = document.createElement("button");
    b.type = "button";
    if (op.html) b.innerHTML = op.texto;
    else b.textContent = op.texto;
    if (op.titulo) b.title = op.titulo;
    b.addEventListener("click", () => {
      marcar(op.valor);
      alElegir(op.valor);
    });
    fila.appendChild(b);
    return { boton: b, valor: op.valor };
  });

  function marcar(valor) {
    botones.forEach((x) => x.boton.setAttribute("aria-pressed", String(x.valor === valor)));
  }
  marcar(valorInicial);
  renderizarMatematicas(fila);
  return marcar;
}

/** Botón suelto dentro de su propio `.control` (para alinearlo con el resto). */
function botonControl(panel, etiqueta, alPulsar) {
  const div = document.createElement("div");
  div.className = "control";
  const label = document.createElement("label");
  label.innerHTML = "&nbsp;";
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = etiqueta;
  b.addEventListener("click", alPulsar);
  div.append(label, b);
  panel.appendChild(div);
  return b;
}

/** Bloque `.metricas`; devuelve un objeto id → nodo de la cifra. */
function metricas(zona, lista) {
  const div = document.createElement("div");
  div.className = "metricas";
  const cifras = {};
  for (const m of lista) {
    const c = document.createElement("div");
    c.className = "metrica";
    const e = document.createElement("div");
    e.className = "etiq literal";
    e.innerHTML = m.etiqueta;
    const v = document.createElement("div");
    v.className = "cifra";
    v.textContent = "—";
    c.append(e, v);
    div.appendChild(c);
    cifras[m.id] = v;
  }
  zona.appendChild(div);
  renderizarMatematicas(div);
  return cifras;
}

/** Cifra de métrica que lleva notación: hay que tipografiarla, no volcarla. */
function fijarCifra(nodo, html) {
  nodo.innerHTML = html;
  renderizarMatematicas(nodo);
}

/** Leyenda de series con sus fórmulas ya tipografiadas por KaTeX. */
function conLeyenda(zona, series) {
  const bloque = leyenda(series);
  zona.appendChild(bloque);
  renderizarMatematicas(bloque);
  return bloque;
}

/**
 * El mismo color, con transparencia.
 *
 * Es el sustituto del parámetro `opacidad` que el guion proponía añadir a
 * `graficaLineas`: como el color de la serie se pasa tal cual al atributo
 * `stroke`, un `rgba(...)` produce exactamente el mismo resultado sin tocar
 * nucleo.js. Acepta las dos formas en las que llegan los tokens del tema:
 * hexadecimal (`--serie-1`) y `rgb(...)` (lo que devuelve `colorCalor`).
 */
function conAlfa(color, alfa) {
  const limpio = String(color || "").trim();
  if (limpio.startsWith("#")) {
    const cuerpo = limpio.slice(1);
    const completo = cuerpo.length === 3
      ? cuerpo.split("").map((c) => c + c).join("")
      : cuerpo;
    const n = parseInt(completo, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alfa})`;
  }
  const numeros = limpio.match(/\d+(\.\d+)?/g);
  if (numeros && numeros.length >= 3) {
    return `rgba(${numeros[0]},${numeros[1]},${numeros[2]},${alfa})`;
  }
  return limpio;
}

/**
 * Color de texto legible sobre un fondo dado.
 *
 * `textoSobre()` espera "rgb(...)"; los tokens semánticos del tema llegan en
 * hexadecimal, así que se convierten antes. Sin esto, el blanco fijo sobre
 * `--exito` deja de leerse al pasar al tema oscuro, donde ese verde es claro.
 */
function textoContraste(color) {
  if (!color || !color.startsWith("#")) return textoSobre(color || "");
  const cuerpo = color.slice(1);
  const completo = cuerpo.length === 3 ? cuerpo.split("").map((c) => c + c).join("") : cuerpo;
  const n = parseInt(completo, 16);
  return textoSobre(`rgb(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255})`);
}

/* ======================================================================= *
 * 1. Constantes del experimento del módulo 1
 *
 * Example 7.1: paseo aleatorio de 19 estados, −1 por la izquierda, +1 por la
 * derecha, V ≡ 0 y γ = 1. Los índices del motor van en BASE 0 (0…18); el
 * guion y la pantalla los escriben en BASE 1 (1…19), así que al rotular se
 * suma 1. Nunca al revés.
 * ======================================================================= */

const ENTORNO = paseoAleatorio({
  nEstados: 19, recompensaIzquierda: -1, recompensaDerecha: 1, valorInicial: 0,
});

/** Los diez valores de n de la figura 7.2. */
const NS = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512];
/** Los ocho valores de λ de la figura 12.3. */
const LAMBDAS = [0, 0.4, 0.8, 0.9, 0.95, 0.975, 0.99, 1];
/** Los 21 valores de α: 0; 0,05; …; 1. Se indexan, para no arrastrar el 0,35000000000000003. */
const ALPHAS = Array.from({ length: 21 }, (_, i) => i / 20);

const REPETICIONES = 100;
const EPISODIOS = 10;
const GAMMA = 1;

/* Eje y del libro. Las curvas que se salen se recortan al borde, como en la
   figura 7.2, en vez de dibujarse fuera del marco. */
const Y_MIN = 0.25;
const Y_MAX = 0.55;

/* El rótulo de un estado sale del motor, que es la única fuente: con 19
   estados son «1»…«19» (el centro, el 10) y con 5 son «A»…«E», los del
   Example 6.2. La página NO traduce índices por su cuenta — hacerlo era un
   error de base 1 esperando a ocurrir. */
const rotuloEstado = (s) => ENTORNO.etiquetas[s] ?? String(s);

/**
 * Decimales justos de un valor de λ: 0 → «0», 0,9 → «0,9», 0,975 → «0,975».
 *
 * Con un número fijo de decimales la rejilla de λ sale como «0,900» y
 * «1,000», que se leen como una precisión que no existe: los ocho valores son
 * exactos, no medidos.
 */
function decimalesDe(valor) {
  if (Math.abs(valor * 1000 - Math.round(valor * 100) * 10) > 1e-9) return 3;
  if (Math.abs(valor * 100 - Math.round(valor * 10) * 10) > 1e-9) return 2;
  return Math.abs(valor * 10 - Math.round(valor) * 10) > 1e-9 ? 1 : 0;
}

/** λ en texto plano y λ dentro de LaTeX, con los decimales justos. */
const textoLambda = (valor) => num(valor, decimalesDe(valor));
const matLambda = (valor) => numMat(valor, decimalesDe(valor));

/**
 * Barrido de los pares (λ, α), gemelo de `barridoNAlpha` para la familia λ.
 *
 * Vive aquí y no en npasos.js porque npasos.js está cerrado; y hace
 * exactamente lo mismo que `barridoNAlpha` —mismo lote, mismo orden, misma
 * métrica— cambiando `nStepTD` por `tdLambdaAtras`. Si algún día npasos.js
 * exporta un `barridoLambdaAlpha`, esta función se borra y se sustituye por
 * la llamada.
 *
 * @param {Array<Array<object>>} lote Lote de `loteEpisodios`, el MISMO que
 *   consume el barrido en n: es la condición del libro de usar los mismos
 *   caminos para todos los ajustes de parámetros.
 * @param {string} traza "acumulativa" (12.5) o "reemplazo" (12.12).
 * @returns {{curvas: object, mejor: object, mejorPorLambda: object}}
 */
function barridoLambdaAlpha(lote, traza = "acumulativa") {
  const curvas = {};
  const mejorPorLambda = {};
  let mejor = { lambda: null, alpha: null, rms: Infinity };

  for (const lambda of LAMBDAS) {
    const curva = [];
    let mejorDeLambda = { alpha: null, rms: Infinity };
    for (const alpha of ALPHAS) {
      let suma = 0;
      let medidas = 0;
      for (const repeticion of lote) {
        const V = new Array(ENTORNO.nEstados).fill(0);
        for (let e = 0; e < EPISODIOS; e++) {
          tdLambdaAtras(V, repeticion[e], { lambda, alpha, gamma: GAMMA, traza });
          suma += errorRMS(V, ENTORNO.vVerdadero);
          medidas++;
        }
      }
      const rms = suma / medidas;
      curva.push(rms);
      if (rms < mejorDeLambda.rms) mejorDeLambda = { alpha, rms };
      if (rms < mejor.rms) mejor = { lambda, alpha, rms };
    }
    curvas[lambda] = curva;
    mejorPorLambda[lambda] = mejorDeLambda;
  }
  return { curvas, mejor, mejorPorLambda };
}

/* ======================================================================= *
 * MÓDULO 1 — el continuo en n (y en λ)
 * ======================================================================= */

function modulo1() {
  const zonaControles = $("#m1-controles");
  const zonaGrafica = $("#m1-grafica");
  const zonaMetricas = $("#m1-metricas");
  const zonaCrono = $("#m1-cronograma");

  /* --- estado del módulo --- */
  let familia = "ambas";          // "n" · "lambda" · "ambas"
  let iN = 9;                 // NS[2] = 4
  let iL = 3;                 // LAMBDAS[3] = 0,9
  let iA = 8;                 // ALPHAS[8] = 0,40
  let lote = null;
  let barridoN = null;
  let barridoL = null;

  const n = () => NS[iN];
  const lambda = () => LAMBDAS[iL];
  const alpha = () => ALPHAS[iA];

  /* --- textos de encuadre --- */

  parrafo(zonaControles, "explicacion", t("t4b.m1.explicacion",
    "Éste es el experimento que proyecta la diapositiva, con el mando puesto. Un camino "
    + "aleatorio de <strong>19 estados</strong>: se empieza en el central, a cada paso se va a "
    + "izquierda o derecha con probabilidad \\(\\tfrac12\\), y el episodio acaba al salir por un "
    + "extremo, con recompensa \\(-1\\) por la izquierda y \\(+1\\) por la derecha. Todos los "
    + "valores empiezan en <strong>0</strong> y no hay descuento (\\(\\gamma=1\\)). Se miden los "
    + "primeros <strong>10 episodios</strong> y se promedia sobre <strong>100 "
    + "repeticiones</strong>, siempre con <strong>las mismas trayectorias</strong> para todos "
    + "los valores de los parámetros: si una curva queda por debajo de otra, no es porque haya "
    + "tenido suerte."));

  preguntaDiapo(zonaControles,
    t("t4b.m1.pregunta",
      "La diapositiva se titula <em>«¿Hay un valor óptimo de \\(n\\)?»</em> y no lo responde; la "
      + "anterior pregunta <em>«supón que tomamos \\(n=10\\), ¿qué pasa al principio de un "
      + "episodio?»</em> y pasa a otra cosa. Las dos se contestan aquí."),
    t("t4b.m1.pregunta.dedonde", "4_Tema4_2#slide-4 y #slide-5."));

  /* --- controles --- */

  const panel = panelControles(zonaControles);
  let desN = null;
  let desL = null;

  const marcarFamilia = grupoRadio(panel, t("t4b.m1.familiaLabel", "Qué familia de curvas"), [
    { valor: "n", texto: t("t4b.m1.familiaN", "Pasos de arranque (n)") },
    { valor: "lambda", texto: t("t4b.m1.familiaLambda", "Retorno λ") },
    { valor: "ambas", texto: t("t4b.m1.familiaAmbas", "Las dos, superpuestas") },
  ], familia, (valor) => {
    familia = valor;
    sincronizarControles();
    dibujar();
  });

  desN = controlDeslizador(panel, {
    etiqueta: t("t4b.m1.nLabel", "Pasos de arranque (\\(n\\))"),
    min: 0, max: NS.length - 1, valor: iN,
    formato: (i) => t("t4b.m1.nValor", "n = {n}", { n: NS[i] }),
    alCambiar: (i) => { iN = i; dibujar(); },
  });

  desL = controlDeslizador(panel, {
    etiqueta: t("t4b.m1.lambdaLabel", "Retorno \\(\\lambda\\)"),
    min: 0, max: LAMBDAS.length - 1, valor: iL,
    formato: (i) => t("t4b.m1.lambdaValor", "λ = {lambda}", { lambda: textoLambda(LAMBDAS[i]) }),
    alCambiar: (i) => { iL = i; dibujar(); },
  });

  const desA = controlDeslizador(panel, {
    etiqueta: t("t4b.m1.alphaLabel", "Tasa de aprendizaje (\\(\\alpha\\))"),
    min: 0, max: ALPHAS.length - 1, valor: iA,
    formato: (i) => t("t4b.m1.alphaValor", "α = {alpha}", { alpha: num(ALPHAS[i], 2) }),
    alCambiar: (i) => { iA = i; dibujar(); },
  });

  botonControl(panel, t("t4b.m1.reiniciar", "Reiniciar con la semilla"), () => {
    familia = "n";
    iN = 2;
    iL = 3;
    iA = 8;
    marcarFamilia("n");
    desN.fijar(iN);
    desL.fijar(iL);
    desA.fijar(iA);
    sincronizarControles();
    dibujar();
  });

  function sincronizarControles() {
    desN.habilitar(familia !== "lambda");
    desL.habilitar(familia !== "n");
  }
  sincronizarControles();

  parrafo(zonaControles, "explicacion nota", t("t4b.m1.gamma",
    "\\(\\gamma = 1\\) y \\(V(s)=0\\) de partida: fijos, son el enunciado del experimento. El "
    + "único azar es el de los caminos, y lo fija la semilla de la página."));

  /* --- viz 1: el barrido --------------------------------------------- */

  const { cuerpo: cuerpoGrafica, titulo: tituloGrafica } = caja(zonaGrafica, "&nbsp;");
  const notaBarrido = parrafo(zonaGrafica, "explicacion siempre", "");

  const cifras = metricas(zonaMetricas, [
    { id: "actual", etiqueta: t("t4b.m1.mActual", "Error con los parámetros actuales") },
    { id: "mejorAlpha", etiqueta: t("t4b.m1.mMejorAlpha", "Mejor \\(\\alpha\\) para esta curva") },
    { id: "mejorN", etiqueta: t("t4b.m1.mMejorGlobal", "Mejor punto del barrido en \\(n\\)") },
    { id: "mejorL", etiqueta: t("t4b.m1.mMejorLambda", "Mejor punto del barrido en \\(\\lambda\\)") },
  ]);

  /* --- viz 2: el cronograma ------------------------------------------- */

  const EPISODIO = caminoDirectoDerecha(ENTORNO);
  const T = EPISODIO.T;
  const COLUMNAS = 11;

  const { cuerpo: cuerpoCrono } = caja(zonaCrono, t("t4b.m1.viz2.titulo",
    "Un episodio, paso a paso: el camino directo del centro a la derecha (\\(T\\) = {T})",
    { T }));
  const notaCorte = parrafo(zonaCrono, "suave", "");
  parrafo(zonaCrono, "explicacion", t("t4b.m1.viz2.episodio",
    "El episodio de referencia es <strong>fijo y determinista</strong>: el camino que va derecho "
    + "del centro hasta salir por la derecha, \\(S_0=10,\\;S_1=11,\\;\\ldots,\\;S_9=19\\), con "
    + "\\(R_1=\\cdots=R_9=0\\) y \\(R_{10}=+1\\); \\(T=10\\). Es el caso que el libro describe "
    + "con palabras en el Example 7.1 para explicar a cuántos estados llega una sola muestra de "
    + "experiencia. En el lote de la semilla 2026 el episodio más corto de los 1000 (repetición "
    + "68, episodio 7) también dura 10 pasos, pero <strong>va hacia la izquierda</strong>: es la "
    + "imagen especular de éste, no éste."));
  parrafo(zonaCrono, "explicacion nota", t("t4b.m1.determinista",
    "El cronograma es determinista: no depende de la semilla."));

  const cifrasCrono = metricas(zonaCrono, [
    { id: "primera", etiqueta: t("t4b.m1.mPrimera", "Primera actualización") },
    { id: "dentro", etiqueta: t("t4b.m1.mDentro", "Actualizaciones durante el episodio") },
    { id: "cola", etiqueta: t("t4b.m1.mCola", "Actualizaciones después de terminar") },
    { id: "tocados", etiqueta: t("t4b.m1.mTocados", "Estados que cambian de valor") },
  ]);
  const notaCrono = parrafo(zonaCrono, "explicacion siempre", "");
  parrafo(zonaCrono, "explicacion", t("t4b.m1.cierre",
    "Elegir \\(n\\) obliga a acertar con dos números a la vez, \\(n\\) y \\(\\alpha\\), y a "
    + "tirar todo lo que aportan los demás \\(n\\). El bloque siguiente pregunta lo obvio: si "
    + "cualquier media de retornos es válida, ¿por qué elegir uno?"));

  /* --- cálculo -------------------------------------------------------- */

  function asegurarLote() {
    if (!lote) {
      lote = loteEpisodios(ENTORNO, null, null, {
        semilla: semillaActual(), repeticiones: REPETICIONES, episodios: EPISODIOS,
      });
    }
  }

  function calcularN() {
    asegurarLote();
    barridoN = barridoNAlpha(lote, {
      ns: NS, alphas: ALPHAS, episodios: EPISODIOS,
      vVerdadero: ENTORNO.vVerdadero, valorInicial: 0, gamma: GAMMA,
    });
  }

  function calcularLambda() {
    asegurarLote();
    barridoL = barridoLambdaAlpha(lote);
  }

  function invalidar() {
    lote = null;
    barridoN = null;
    barridoL = null;
  }

  /**
   * Muestra el mensaje de «calculando» y deja al navegador pintarlo.
   *
   * Los dos barridos se calculan juntos y de entrada, aunque la vista por
   * omisión solo enseñe el de n: la lectura numérica compara los dos mejores
   * puntos, y una métrica que dijera «—» hasta que alguien conmute sería
   * peor que los 450 ms de más. Juntos son ~730 ms medidos en node v22.
   */
  function conCalculo(hecho) {
    const faltaN = !barridoN;
    const faltaL = !barridoL;
    if (!faltaN && !faltaL) { hecho(); return; }
    cuerpoGrafica.replaceChildren(graficaLineas([], {
      mensaje: t("t4b.m1.viz1.vacio",
        "Calculando los dos barridos: 10 valores de n y 8 de λ, × 21 de α × 100 repeticiones…"),
    }));
    setTimeout(() => {
      if (faltaN) calcularN();
      if (faltaL) calcularLambda();
      hecho();
    }, 20);
  }

  /* --- pintado de la gráfica ------------------------------------------ */

  /** Recorta al marco: como la figura del libro, que no dibuja fuera de él. */
  const recortar = (v) => (Number.isFinite(v) ? Math.min(v, Y_MAX) : Y_MAX);

  function seriesDeN({ tinte, resaltar }) {
    return NS.map((valor, i) => {
      const activo = resaltar && i === iN;
      return {
        nombre: t("t4b.m1.serieN", "\\(n = {n}\\)", { n: valor }),
        color: activo ? tono(COLORES_SERIE[0]) : conAlfa(tono(tinte), 0.3),
        grosor: activo ? 3 : 1.2,
        x: ALPHAS,
        y: barridoN.curvas[valor].map(recortar),
      };
    });
  }

  function seriesDeLambda({ tinte, resaltar }) {
    return LAMBDAS.map((valor, i) => {
      const activo = resaltar && i === iL;
      return {
        nombre: t("t4b.m1.serieLambda", "\\(\\lambda = {lambda}\\)", { lambda: matLambda(valor) }),
        color: activo ? tono(COLORES_SERIE[1]) : conAlfa(tono(tinte), 0.3),
        grosor: activo ? 3 : 1.2,
        x: ALPHAS,
        y: barridoL.curvas[valor].map(recortar),
      };
    });
  }

  function dibujarGrafica() {
    const series = [];
    if (familia === "n") series.push(...seriesDeN({ tinte: "--texto-suave", resaltar: true }));
    else if (familia === "lambda") {
      series.push(...seriesDeLambda({ tinte: "--texto-suave", resaltar: true }));
    } else {
      series.push(...seriesDeN({ tinte: COLORES_SERIE[0], resaltar: true }));
      series.push(...seriesDeLambda({ tinte: COLORES_SERIE[1], resaltar: true }));
    }

    cuerpoGrafica.replaceChildren(graficaLineas(series, {
      ejeX: t("t4b.m1.ejeX", "Tasa de aprendizaje (α)"),
      ejeY: t("t4b.m1.ejeY", "Error RMS medio"),
      yMin: Y_MIN, yMax: Y_MAX,
      formatoY: (v) => num(v, 2),
      ticksX: [0, 0.2, 0.4, 0.6, 0.8, 1].map((v) => ({ valor: v, etiqueta: num(v, 1) })),
      anotaciones: [{
        x: alpha(),
        texto: t("t4b.m1.anotAlpha", "α = {alpha}", { alpha: num(alpha(), 2) }),
      }],
      mensaje: t("t4b.m1.viz1.vacio",
        "Calculando los dos barridos: 10 valores de n y 8 de λ, × 21 de α × 100 repeticiones…"),
    }));

    /* Leyenda compacta: con 18 curvas en pantalla, una entrada por curva es
       ilegible. Se nombra lo que el alumno controla y el resto en bloque. */
    const entradas = [];
    if (familia !== "lambda") {
      entradas.push({
        nombre: t("t4b.m1.serieN", "\\(n = {n}\\)", { n: n() }),
        color: tono(COLORES_SERIE[0]),
      }, {
        nombre: t("t4b.m1.serieOtrasN", "los otros nueve valores de \\(n\\)"),
        color: conAlfa(tono(familia === "ambas" ? COLORES_SERIE[0] : "--texto-suave"), 0.45),
      });
    }
    if (familia !== "n") {
      entradas.push({
        nombre: t("t4b.m1.serieLambda", "\\(\\lambda = {lambda}\\)", { lambda: matLambda(lambda()) }),
        color: tono(COLORES_SERIE[1]),
      }, {
        nombre: t("t4b.m1.serieOtrasLambda", "los otros siete valores de \\(\\lambda\\)"),
        color: conAlfa(tono(familia === "ambas" ? COLORES_SERIE[1] : "--texto-suave"), 0.45),
      });
    }
    conLeyenda(cuerpoGrafica, entradas);

    const recorte = t("t4b.m1.recorte",
      "El eje llega hasta {tope} y las curvas que se salen se recortan al borde, igual que en la "
      + "figura del libro.", { tope: num(Y_MAX, 2) });
    parrafo(cuerpoGrafica, "suave", familia === "n" ? recorte : `${recorte} ${t("t4b.m1.recorteLambda",
      "Con \\(\\alpha\\) por encima del óptimo, TD(\\(\\lambda\\)) no solo empeora: llega a "
      + "diverger, y por eso sus curvas se pegan al borde superior.")}`);

    const semilla = semillaActual();
    tituloGrafica.innerHTML = familia === "n"
      ? t("t4b.m1.viz1.titulo",
        "TD a \\(n\\) pasos · error RMS sobre los 19 estados tras 10 episodios · promedio de "
        + "<strong>100 repeticiones</strong> (semilla {semilla})", { semilla })
      : (familia === "lambda"
        ? t("t4b.m1.viz1.tituloLambda",
          "TD(\\(\\lambda\\)) hacia atrás · error RMS sobre los 19 estados tras 10 episodios · "
          + "promedio de <strong>100 repeticiones</strong> (semilla {semilla})", { semilla })
        : t("t4b.m1.viz1.tituloAmbas",
          "\\(n\\) pasos frente a TD(\\(\\lambda\\)), <strong>sobre el mismo lote</strong> · "
          + "promedio de <strong>100 repeticiones</strong> (semilla {semilla})", { semilla }));
    renderizarMatematicas(tituloGrafica);
  }

  function dibujarMetricas() {
    const iAlpha = iA;
    const rmsN = barridoN.curvas[n()][iAlpha];
    const rmsL = barridoL ? barridoL.curvas[lambda()][iAlpha] : null;

    if (familia === "lambda") {
      fijarCifra(cifras.actual, num(rmsL, 4));
      const m = barridoL.mejorPorLambda[lambda()];
      fijarCifra(cifras.mejorAlpha, t("t4b.m1.valorConRms", "{a} <span class=\"suave\">({rms})</span>",
        { a: num(m.alpha, 2), rms: num(m.rms, 4) }));
    } else {
      fijarCifra(cifras.actual, num(rmsN, 4));
      const m = barridoN.mejorPorN[n()];
      fijarCifra(cifras.mejorAlpha, t("t4b.m1.valorConRms", "{a} <span class=\"suave\">({rms})</span>",
        { a: num(m.alpha, 2), rms: num(m.rms, 4) }));
    }

    fijarCifra(cifras.mejorN, t("t4b.m1.mejorNTexto",
      "\\(n={n}\\), \\(\\alpha={a}\\) <span class=\"suave\">({rms})</span>", {
        n: barridoN.mejor.n, a: numMat(barridoN.mejor.alpha, 2), rms: num(barridoN.mejor.rms, 4),
      }));
    fijarCifra(cifras.mejorL, barridoL
      ? t("t4b.m1.mejorLambdaTexto",
        "\\(\\lambda={l}\\), \\(\\alpha={a}\\) <span class=\"suave\">({rms})</span>", {
          l: matLambda(barridoL.mejor.lambda), a: numMat(barridoL.mejor.alpha, 2),
          rms: num(barridoL.mejor.rms, 4),
        })
      : t("t4b.m1.sinLambda", "—"));
  }

  function dibujarNotaBarrido() {
    let html;
    if (familia === "ambas") {
      const dN = barridoN.mejor.rms;
      const dL = barridoL.mejor.rms;
      html = t("t4b.m1.notaAmbas",
        "Las dos familias corren <strong>sobre el mismo lote</strong>. Y aquí conviene ser "
        + "honesto con la afirmación de cierre de la baraja —<em>«con \\(\\lambda\\) podemos "
        + "acelerar el aprendizaje, especialmente en las etapas iniciales»</em>, "
        + "4_Tema4_2#slide-17—: en <strong>este</strong> experimento no gana, "
        + "<strong>empata</strong>. El mejor punto en \\(n\\) da {dn} y el mejor en "
        + "\\(\\lambda\\) da {dl}, indistinguibles. Lo que sí compra \\(\\lambda\\) es que un "
        + "<strong>solo número continuo</strong> recorre toda la familia y que se puede calcular "
        + "en línea con una traza, en vez de guardar los últimos \\(n\\) pasos.",
        { dn: num(dN, 4), dl: num(dL, 4) });
    } else if (familia === "lambda") {
      html = t("t4b.m1.notaLambda",
        "Misma tarea, mismos ejes y mismo lote que el barrido en \\(n\\): lo único que cambia es "
        + "el algoritmo, TD(\\(\\lambda\\)) hacia atrás. La forma de campana se repite, con el "
        + "mismo compromiso: \\(\\lambda\\) grande exige \\(\\alpha\\) pequeño. Y aparece algo "
        + "que la familia de \\(n\\) no enseña: con \\(\\lambda\\ge0{,}9\\) y \\(\\alpha\\) por "
        + "encima del óptimo, TD(\\(\\lambda\\)) <strong>diverge</strong> — es la inestabilidad "
        + "que el libro advierte en §12.2 y que el bloque B9 de esta página ya anunciaba.");
    } else if (n() <= 2) {
      html = t("t4b.m1.notaPequeno",
        "Con \\(n\\) pequeño la curva es <strong>plana y alta</strong>: el objetivo depende "
        + "demasiado de una estimación que todavía vale 0, así que aprende poco aunque se suba "
        + "mucho \\(\\alpha\\).");
    } else if (n() <= 16) {
      html = t("t4b.m1.notaMedio",
        "Aquí está el punto dulce: suficientes recompensas reales dentro del objetivo para no "
        + "depender de la estimación, y no tantas como para que la varianza domine.");
    } else {
      html = t("t4b.m1.notaGrande",
        "Con \\(n\\) grande la curva <strong>se dispara</strong>: el objetivo es casi el retorno "
        + "completo, con toda su varianza, y solo tolera \\(\\alpha\\) muy pequeños. Con "
        + "\\(n=512\\) esto es, a efectos prácticos, Monte Carlo con \\(\\alpha\\) constante.");
    }
    notaBarrido.innerHTML = html;
    renderizarMatematicas(notaBarrido);
  }

  /* --- pintado del cronograma ----------------------------------------- */

  function dibujarCronograma() {
    const paso = n();

    /* Los G de cada actualización salen de ejecutar el algoritmo, no de una
       fórmula reescrita aquí: `registro` da una entrada por actualización, con
       el instante `t = τ + n − 1` en el que se hace. */
    const V = new Array(ENTORNO.nEstados).fill(0);
    const { traza } = nStepTD(V, EPISODIO, {
      n: paso, alpha: alpha(), gamma: GAMMA, registro: true,
    });
    const porInstante = new Map(traza.map((u) => [u.t, u]));

    /* La tira tiene dos tramos: los T instantes del episodio y, detrás, las
       actualizaciones de vaciado, que son las que ocurren en t ≥ T. NO se
       dibujan los instantes intermedios en los que el bucle gira sin hacer
       nada: con n = 512 serían quinientos huecos vacíos. Se dice en la nota. */
    const instantes = [];
    for (let inst = 0; inst < T; inst++) instantes.push(inst);
    for (const u of traza) if (u.t >= T) instantes.push(u.t);

    const dentro = Math.max(T - paso + 1, 0);
    const colaReal = Math.min(paso - 1, T);
    const tocados = Math.min(paso, T);

    const celdas = instantes.map((inst, indice) => {
      const tau = inst - paso + 1;
      const u = porInstante.get(inst);
      const color = u ? tono("--exito") : tono("--superficie");
      return {
        fila: Math.floor(indice / COLUMNAS),
        col: indice % COLUMNAS,
        esquina: `t=${inst}`,
        etiqueta: inst < T
          ? rotuloEstado(EPISODIO.estados[inst])
          : t("t4b.m1.celdaFin", "—"),
        subetiqueta: tau >= 0 ? `τ=${tau}` : t("t4b.m1.celdaSinTau", "τ<0"),
        mono: true,
        tamano: 15,
        color,
        textoColor: u ? textoContraste(color) : null,
        atenuada: !u,
        titulo: u
          ? t("t4b.m1.celdaTitulo",
            "t={t}: se actualiza el valor del estado visitado en τ={tau} hacia el retorno a n "
            + "pasos, que vale {G}", { t: inst, tau, G: num(u.G, 3) })
          : t("t4b.m1.celdaTituloVacio",
            "t={t}: todavía no hay recompensas suficientes para formar el retorno a n pasos",
            { t: inst }),
      };
    });

    /* Bandas: un rótulo sobre el tramo mudo del principio y otro sobre el
       vaciado de la cola. Se parten por filas porque la tira se dobla; el
       texto va en un solo trozo, el que no se pisa con las celdas de al lado. */
    const bandas = [];
    const bandaPara = (desde, hasta, texto, arriba) => {
      if (desde >= hasta) return;
      const trozos = [];
      for (let i = desde; i < hasta;) {
        const fila = Math.floor(i / COLUMNAS);
        const finFila = Math.min(hasta, (fila + 1) * COLUMNAS);
        trozos.push({ fila, col: i % COLUMNAS, ancho: finFila - i });
        i = finFila;
      }
      const conTexto = arriba ? trozos[0] : trozos[trozos.length - 1];
      for (const trozo of trozos) {
        bandas.push({
          ...trozo,
          alto: 1,
          color: "transparent",
          texto: trozo === conTexto ? texto : null,
          textoArriba: arriba,
          textoColor: tono("--texto-suave"),
        });
      }
    };
    bandaPara(0, Math.min(paso - 1, T), t("t4b.m1.banda1", "sin actualizar"), true);
    bandaPara(T, instantes.length, t("t4b.m1.banda2", "vaciado de la cola"), false);

    pintar(cuerpoCrono, rejilla({ celdas, lado: 58, etiquetasBanda: bandas }));

    notaCorte.innerHTML = paso - 1 > T
      ? t("t4b.m1.cronoSalto",
        "La tira salta: entre el final del episodio (\\(t\\) = {fin}) y la primera actualización "
        + "de vaciado (\\(t\\) = {primera}) el bucle da {huecos} vueltas sin actualizar nada, "
        + "porque todavía no hay ningún \\(\\tau\\ge0\\) pendiente que le corresponda.",
        { fin: T - 1, primera: paso - 1, huecos: paso - 1 - T })
      : "";
    renderizarMatematicas(notaCorte);

    /* --- lecturas del cronograma --- */
    fijarCifra(cifrasCrono.primera,
      t("t4b.m1.primeraEn", "en \\(t\\) = {t}", { t: paso - 1 }));
    cifrasCrono.dentro.textContent = String(dentro);
    cifrasCrono.cola.textContent = String(colaReal);
    fijarCifra(cifrasCrono.tocados, t("t4b.m1.tocadosGlosa",
      "{k} <span class=\"suave\">— los {k} últimos, todos a \\(\\alpha = {alpha}\\)</span>",
      { k: tocados, alpha: numMat(alpha(), 2) }));

    notaCrono.innerHTML = paso < T
      ? t("t4b.m1.notaCronoCorto",
        "Con \\(n\\) = {n}, los {previos} primeros pasos pasan sin actualizar nada, y al "
        + "terminar el episodio quedan {previos} actualizaciones pendientes. En total, siempre "
        + "{T}: lo que cambia es <strong>cuándo</strong> se hacen.",
        { n: paso, previos: paso - 1, T })
      : t("t4b.m1.notaCronoLargo",
        "Con \\(n\\) = {n} ≥ \\(T\\) = {T} no hay <strong>ni una sola</strong> actualización "
        + "mientras el episodio ocurre: las {T} se hacen al final y todas con el retorno real. "
        + "Esto es Monte Carlo.", { n: paso, T });
    renderizarMatematicas(notaCrono);
  }

  /* --- orquestación ---------------------------------------------------- */

  function pintarTodo() {
    dibujarGrafica();
    dibujarMetricas();
    dibujarNotaBarrido();
    dibujarCronograma();
  }

  function dibujar() {
    conCalculo(pintarTodo);
  }

  oyentesSemilla.push(() => { invalidar(); dibujar(); });

  dibujar();
  /* Al cambiar de tema se repinta con los datos que ya hay: no se recalcula. */
  repintadores.push(() => { if (barridoN) pintarTodo(); });

  crearQuiz($("#m1-quiz"), [
    {
      enunciado: "Con \\(n=10\\), ¿cuántas actualizaciones se hacen durante los nueve primeros "
        + "pasos de un episodio?",
      opciones: [
        "Ninguna: \\(G_{0:10}\\) necesita \\(R_{10}\\), que todavía no ha ocurrido.",
        "Nueve, una por paso, cada una con el retorno a los pasos que haya disponibles.",
        "Una, la del estado inicial, en cuanto se conoce \\(R_1\\).",
        "Diez, porque el retorno a \\(n\\) pasos se puede truncar en cualquier momento.",
      ],
      correcta: 0,
      explicacion: "El retorno a \\(n\\) pasos no se puede formar hasta haber visto "
        + "\\(R_{t+n}\\) y calculado \\(V_{t+n-1}\\): con \\(n=10\\), la primera vez que eso "
        + "ocurre es en \\(t=9\\). El truncamiento existe, pero solo se aplica cuando el "
        + "episodio <strong>termina</strong> dentro de la ventana, no para adelantar "
        + "actualizaciones. Y para compensar los nueve pasos mudos del principio, al acabar el "
        + "episodio se hacen nueve actualizaciones más: el total sigue siendo \\(T\\).",
    },
    {
      enunciado: "En el barrido, \\(\\alpha=0{,}8\\) es el mejor valor para \\(n=1\\) y uno de "
        + "los peores para \\(n=64\\). ¿Por qué?",
      opciones: [
        "Porque con \\(n\\) grande el objetivo lleva dentro muchas recompensas reales, y por "
          + "tanto mucha varianza; un paso grande convierte esa varianza en oscilación.",
        "Porque con \\(n\\) grande la propiedad de reducción del error deja de cumplirse.",
        "Porque con \\(n\\) grande hay menos actualizaciones por episodio y hay que compensarlo "
          + "con un \\(\\alpha\\) mayor.",
        "Porque el error RMS se mide al final del episodio y con \\(n\\) grande se mide antes.",
      ],
      correcta: 0,
      explicacion: "Con \\(n=1\\) el objetivo es casi todo estimación —que al principio vale "
        + "0—, así que hace falta un paso grande para moverse; con \\(n=64\\) el objetivo es "
        + "casi el retorno real, con toda su aleatoriedad, y un paso grande la vuelca sobre la "
        + "estimación. La propiedad de reducción del error se cumple siempre, solo que con "
        + "\\(\\gamma=1\\) no dice nada útil. Y el número de actualizaciones por episodio es "
        + "\\(T\\) sea cual sea \\(n\\): eso no cambia.",
    },
    {
      enunciado: "Con \\(n=512\\) las curvas del barrido son casi indistinguibles de las de "
        + "\\(n=256\\). ¿Qué está pasando?",
      opciones: [
        "Que casi todos los episodios acaban antes de 256 pasos, así que en la inmensa mayoría "
          + "de las actualizaciones los dos retornos son ya el retorno real completo.",
        "Que a partir de cierto \\(n\\) el algoritmo deja de arrancar y pasa a hacer "
          + "programación dinámica.",
        "Que el promedio sobre 100 repeticiones borra las diferencias entre valores altos de "
          + "\\(n\\).",
        "Que con \\(n\\) grande el error se satura en el valor de la inicialización.",
      ],
      correcta: 0,
      explicacion: "La convención de truncamiento dice que si la ventana llega o pasa la "
        + "terminación, el retorno a \\(n\\) pasos <strong>es</strong> el retorno real. En esta "
        + "tarea la longitud mediana de episodio es 82 pasos y solo 2 de 1000 pasan de 512, así "
        + "que ambos valores de \\(n\\) calculan el mismo objetivo casi siempre: los dos son ya "
        + "Monte Carlo con \\(\\alpha\\) constante. El promediado no borra nada —se usan las "
        + "mismas trayectorias para todos los parámetros— y el error no se satura en la "
        + "inicialización: con \\(\\alpha\\) alto es bastante peor que ella.",
    },
  ], { claves: "t4b.m1.quiz" });
}

/* ======================================================================= *
 * MÓDULO 2 — trazas de elegibilidad: ¿el timbre o la luz?
 * ======================================================================= */

const ALPHA_M2 = 0.1;
const PUNTOS_LAMBDA = 101;

function modulo2() {
  const zonaControles = $("#m2-controles");
  const zonaTrazas = $("#m2-trazas");
  const zonaCredito = $("#m2-credito");
  const zonaMetricas = $("#m2-metricas");

  /* Estado inicial = el que restaura «Reiniciar». Arrancaba en k=5 y traza de
     reemplazo, y con esa traza NO hay empate («la luz gana para todo λ<1»):
     el módulo abría escondiendo justo el hallazgo que lo justifica, y además
     con la única traza que la diapositiva no usa. */
  let lambda = 0.9;
  let timbres = 3;
  let tipoTraza = "acumulativa";

  /* --- textos de encuadre --- */

  parrafo(zonaControles, "explicacion", t("t4b.m2.explicacion",
    "El episodio de la diapositiva, con los números puestos. Suena el timbre \\(k\\) veces "
    + "seguidas, se enciende la luz y en el paso siguiente llega la descarga: recompensa "
    + "\\(-1\\) y fin del episodio. Todos los valores empiezan en 0 y no hay descuento "
    + "(\\(\\gamma=1\\)), así que <strong>el error TD vale 0 en todos los pasos menos en el "
    + "último</strong>, donde vale \\(-1\\). Es decir: todo el reparto de culpa ocurre de golpe "
    + "al final, y lo decide únicamente la traza que cada estado tenga en ese momento. Mueve "
    + "\\(\\lambda\\) y mira quién se lleva la culpa."));

  preguntaDiapo(zonaControles,
    t("t4b.m2.pregunta",
      "<em>«¿Qué evento ha desencadenado la descarga eléctrica? Por frecuencia, el timbre; por "
      + "recencia, la luz; las trazas combinan ambas.»</em> La diapositiva lo deja ahí. "
      + "¿Combinan en qué proporción, y quién gana?"),
    t("t4b.m2.pregunta.dedonde", "4_Tema4_2#slide-14, el ejemplo de David Silver."));

  parrafo(zonaControles, "explicacion nota", t("t4b.m2.aportacion",
    "El episodio concreto (cuántos timbres, qué recompensa, qué \\(\\alpha\\)) no está en la "
    + "diapositiva: lo fija esta página para poder poner números."));

  /* --- controles --- */

  const panel = panelControles(zonaControles);

  const desLambda = controlDeslizador(panel, {
    etiqueta: t("t4b.m2.lambdaLabel", "Desvanecimiento de la traza (\\(\\lambda\\))"),
    min: 0, max: 1, paso: 0.01, valor: lambda,
    formato: (v) => t("t4b.m2.lambdaValor", "λ = {lambda}", { lambda: num(v, 2) }),
    alCambiar: (v) => { lambda = v; dibujar(); },
  });

  const desK = controlDeslizador(panel, {
    etiqueta: t("t4b.m2.kLabel", "Veces que suena el timbre (\\(k\\))"),
    min: 1, max: 5, paso: 1, valor: timbres,
    formato: (v) => t("t4b.m2.kValor", "k = {k}", { k: v }),
    alCambiar: (v) => { timbres = v; dibujar(); },
  });

  const marcarTraza = grupoRadio(panel, t("t4b.m2.trazaLabel", "Tipo de traza"), [
    { valor: "acumulativa", texto: t("t4b.m2.trazaAcum", "Acumulativa") },
    { valor: "reemplazo", texto: t("t4b.m2.trazaReemp", "De reemplazo") },
  ], tipoTraza, (valor) => { tipoTraza = valor; dibujar(); });

  botonControl(panel, t("t4b.m2.reiniciar", "Reiniciar"), () => {
    lambda = 0.9;
    timbres = 3;
    tipoTraza = "acumulativa";
    desLambda.fijar(lambda);
    desK.fijar(timbres);
    marcarTraza(tipoTraza);
    dibujar();
  });

  parrafo(zonaControles, "explicacion nota", t("t4b.m2.parametros",
    "\\(\\gamma\\) = 1 · \\(\\alpha\\) = 0,1 · un solo episodio, determinista."));

  /* --- cajas --- */

  const { cuerpo: cuerpoTrazas } = caja(zonaTrazas, t("t4b.m2.viz1.titulo",
    "Traza de cada estado, paso a paso · episodio determinista, <strong>sin promediar</strong> "
    + "(\\(\\gamma=1\\))"));
  const { cuerpo: cuerpoCredito } = caja(zonaCredito, t("t4b.m2.viz2.titulo",
    "Crédito repartido al final del episodio, para cada \\(\\lambda\\) · \\(\\alpha\\) = 0,1"));

  const cifras = metricas(zonaMetricas, [
    { id: "zTimbre", etiqueta: t("t4b.m2.mTimbre", "\\(z\\) del timbre al llegar la descarga") },
    { id: "zLuz", etiqueta: t("t4b.m2.mLuz", "\\(z\\) de la luz al llegar la descarga") },
    { id: "cruce", etiqueta: t("t4b.m2.mCruce", "\\(\\lambda\\) de empate") },
    { id: "culpable", etiqueta: t("t4b.m2.mCulpable", "Quién se lleva la culpa") },
  ]);
  const notaVeredicto = parrafo(zonaMetricas, "explicacion siempre", "");

  parrafo(zonaMetricas, "explicacion nota", t("t4b.m2.avisoTrazas",
    "La diapositiva <code>4_Tema4_2#slide-15</code> usa la traza <strong>acumulativa</strong> y "
    + "no menciona que haya otras. Hay tres: la acumulativa (\\(z\\) suma 1), la de "
    + "<strong>reemplazo</strong> (\\(z\\) se fija en 1; es la ecuación (12.12) de §12.6, "
    + "definida solo para el caso tabular o para características binarias) y la <em>dutch</em>, "
    + "que es la que usa <em>true online</em> TD(\\(\\lambda\\)) (§12.5) y la que el libro "
    + "considera mejor fundamentada. Este módulo permite conmutar entre las dos primeras; la "
    + "tercera queda fuera."));

  parrafo(zonaMetricas, "explicacion", t("t4b.m2.cierre",
    "Un solo número, \\(\\lambda\\), gradúa la memoria del agente entre «solo cuenta lo último» "
    + "(\\(\\lambda=0\\), que es TD(0)) y «cuenta todo el episodio por igual» (\\(\\lambda=1\\) "
    + "con \\(\\gamma=1\\), que es Monte Carlo). Lo que queda es ver que ese 1 que sube la traza "
    + "no es una convención: es un gradiente."));

  /* --- pintado --- */

  const nombreTimbre = () => t("t4b.m2.serieTimbre", "Timbre — \\(z_t(\\text{timbre})\\)");
  const nombreLuz = () => t("t4b.m2.serieLuz", "Luz — \\(z_t(\\text{luz})\\)");
  const rotuloTimbre = () => t("t4b.m2.timbre", "timbre");
  const rotuloLuz = () => t("t4b.m2.luz", "luz");

  /** z_t de los dos estados a lo largo del episodio, ejecutando el motor. */
  function trazasDelEpisodio() {
    const { episodio } = cadenaTimbreLuz({ timbres });
    const V = [0, 0];
    const { historialZ } = tdLambdaAtras(V, episodio, {
      lambda, alpha: ALPHA_M2, gamma: 1, traza: tipoTraza, registro: true,
    });
    return { historialZ, deltaV: V };
  }

  function dibujarTrazas(historialZ) {
    const x = historialZ.map((_, i) => i);
    const series = [
      {
        nombre: nombreTimbre(), color: tono(COLORES_SERIE[0]), puntos: true,
        x, y: historialZ.map((z) => z[TIMBRE]),
      },
      {
        nombre: nombreLuz(), color: tono(COLORES_SERIE[1]), puntos: true,
        x, y: historialZ.map((z) => z[LUZ]),
      },
    ];
    cuerpoTrazas.replaceChildren(graficaLineas(series, {
      ejeX: t("t4b.m2.ejeX", "Paso del episodio, y qué se observa en él"),
      ejeY: t("t4b.m2.ejeY", "Valor de la traza z"),
      /* Eje FIJO de 0 a 5: el máximo alcanzable es z = k ≤ 5 (con λ = 1). Si
         se dejara automático, la escala se reajustaría al mover λ y la curva
         parecería la misma siempre, que es el error de lectura clásico de
         esta gráfica. Cinco divisiones enteras, además, se leen de un vistazo. */
      yMin: 0, yMax: 5,
      formatoY: (v) => num(v, 0),
      ticksX: x.map((i) => ({
        valor: i,
        etiqueta: i < timbres ? rotuloTimbre() : rotuloLuz(),
      })),
      anotaciones: [{
        x: timbres,
        texto: t("t4b.m2.anotDescarga", "aquí llega δ = −1"),
      }],
      mensaje: t("t4b.m2.viz1.vacio", "Sin episodio."),
    }));
    conLeyenda(cuerpoTrazas, series);
  }

  function dibujarCredito(cruce) {
    const datos = creditoPorLambda({
      timbres, traza: tipoTraza, alpha: ALPHA_M2, gamma: 1, puntos: PUNTOS_LAMBDA,
    });
    const series = [
      {
        nombre: nombreTimbre(), color: tono(COLORES_SERIE[0]),
        x: datos.lambdas, y: datos.timbre,
      },
      {
        nombre: nombreLuz(), color: tono(COLORES_SERIE[1]),
        x: datos.lambdas, y: datos.luz,
      },
    ];
    const anotaciones = [{
      x: lambda,
      texto: t("t4b.m2.anotLambda", "λ = {lambda}", { lambda: num(lambda, 2) }),
    }];
    if (cruce !== null) {
      anotaciones.push({
        x: cruce,
        texto: t("t4b.m2.anotCruce", "empate: λ* = {cruce}", { cruce: num(cruce, 3) }),
      });
    }
    cuerpoCredito.replaceChildren(graficaLineas(series, {
      ejeX: t("t4b.m2.ejeX2", "Desvanecimiento de la traza (λ)"),
      ejeY: t("t4b.m2.ejeY2", "Cuánto baja V(s) al llegar la descarga"),
      /* El tope es el máximo alcanzable con estos controles, que se da en
         λ = 1: α·k con la traza acumulativa y α·1 con la de reemplazo, donde
         la traza del timbre nunca pasa de 1. No depende de λ, así que mover
         el deslizador no reescala el eje. */
      yMin: 0, yMax: ALPHA_M2 * (tipoTraza === "reemplazo" ? 1 : timbres),
      formatoY: (v) => num(v, 2),
      ticksX: [0, 0.25, 0.5, 0.75, 1].map((v) => ({ valor: v, etiqueta: num(v, 2) })),
      anotaciones,
      mensaje: t("t4b.m2.viz2.vacio", "Sin datos todavía."),
    }));
    conLeyenda(cuerpoCredito, series);
  }

  function dibujarVeredicto(zTimbre, zLuz, cruce) {
    let html;
    if (tipoTraza === "reemplazo") {
      html = t("t4b.m2.vReemplazo",
        "Con la traza <strong>de reemplazo</strong>, la del timbre se <strong>fija</strong> en 1 "
        + "en cada visita en vez de sumarse, así que al llegar la descarga vale "
        + "\\(\\lambda = {lambda}\\), sin importar cuántas veces haya sonado. Aquí la frecuencia "
        + "<strong>no cuenta</strong>: la luz gana siempre, para cualquier \\(\\lambda<1\\) y "
        + "cualquier \\(k\\). Elegir el tipo de traza no es un detalle de implementación.",
        { lambda: numMat(lambda, 2) });
    } else if (Math.abs(zTimbre - zLuz) < 1e-3) {
      html = t("t4b.m2.vEmpate",
        "Empate exacto. Éste es el \\(\\lambda\\) en el que las dos heurísticas se compensan: "
        + "con {k} timbres, \\(\\lambda^{*} = {cruce}\\). Por encima manda la frecuencia; por "
        + "debajo, la recencia.",
        { k: timbres, cruce: cruce === null ? "1" : numMat(cruce, 4) });
    } else if (zTimbre > zLuz) {
      html = t("t4b.m2.vTimbre",
        "Gana la <strong>frecuencia</strong>. Con \\(\\lambda = {lambda}\\), la traza del timbre "
        + "vale \\({zB}\\) frente al 1 de la luz: el timbre baja \\({ratio}\\) veces más de "
        + "valor. Sonar muchas veces compensa haber sonado antes.",
        { lambda: numMat(lambda, 2), zB: numMat(zTimbre, 3), ratio: numMat(zTimbre / zLuz, 2) });
    } else {
      html = t("t4b.m2.vLuz",
        "Gana la <strong>recencia</strong>. Con \\(\\lambda = {lambda}\\) la traza del timbre ya "
        + "se ha desvanecido hasta \\({zB}\\), por debajo del 1 de la luz: haber ocurrido justo "
        + "antes pesa más que haber ocurrido {k} veces.",
        { lambda: numMat(lambda, 2), zB: numMat(zTimbre, 3), k: timbres });
    }
    notaVeredicto.innerHTML = html;
    renderizarMatematicas(notaVeredicto);
  }

  function dibujar() {
    const { historialZ } = trazasDelEpisodio();
    const zFinal = historialZ[historialZ.length - 1];
    const cruce = cruceTrazas({ timbres, traza: tipoTraza, gamma: 1 });

    dibujarTrazas(historialZ);
    dibujarCredito(cruce);

    cifras.zTimbre.textContent = num(zFinal[TIMBRE], 4);
    cifras.zLuz.textContent = num(zFinal[LUZ], 4);
    cifras.cruce.textContent = cruce === null
      ? t("t4b.m2.mCruceNo", "no hay: la luz gana para todo λ < 1")
      : num(cruce, 4);
    cifras.culpable.textContent = Math.abs(zFinal[TIMBRE] - zFinal[LUZ]) < 1e-3
      ? t("t4b.m2.culpableEmpate", "Empatan")
      : (zFinal[TIMBRE] > zFinal[LUZ]
        ? t("t4b.m2.culpableTimbre", "El timbre (frecuencia)")
        : t("t4b.m2.culpableLuz", "La luz (recencia)"));

    dibujarVeredicto(zFinal[TIMBRE], zFinal[LUZ], cruce);
  }

  dibujar();
  repintadores.push(dibujar);

  crearQuiz($("#m2-quiz"), [
    {
      enunciado: "Con \\(\\gamma=1\\), tres timbres y traza acumulativa, ¿para qué valores de "
        + "\\(\\lambda\\) se lleva el timbre más culpa que la luz?",
      opciones: [
        "Para \\(\\lambda\\) por encima de 0,544 aproximadamente, que es donde "
          + "\\(\\lambda+\\lambda^2+\\lambda^3\\) supera a 1.",
        "Para cualquier \\(\\lambda>0\\), porque el timbre ha ocurrido tres veces y la luz una.",
        "Para \\(\\lambda\\) por debajo de 0,5, porque un desvanecimiento rápido favorece a lo "
          + "que ocurrió antes.",
        "Nunca: la traza de la luz vale 1 y ninguna traza puede pasar de 1.",
      ],
      correcta: 0,
      explicacion: "La traza del timbre al llegar la descarga es la suma de sus tres visitas ya "
        + "desvanecidas, \\(\\lambda+\\lambda^2+\\lambda^3\\), y la de la luz vale exactamente 1 "
        + "porque acaba de visitarse. Las dos se igualan en \\(\\lambda\\approx0{,}544\\). Que "
        + "haya sonado tres veces no basta si \\(\\lambda\\) es pequeño: con \\(\\lambda=0{,}5\\) "
        + "la traza del timbre vale 0,875, por debajo de 1. Y un desvanecimiento "
        + "<strong>rápido</strong> favorece a lo reciente, no a lo antiguo. Lo de que la traza no "
        + "puede pasar de 1 vale para la traza de reemplazo, no para la acumulativa.",
    },
    {
      enunciado: "Se conmuta a traza de reemplazo y se sube \\(k\\) de 3 a 5. ¿Qué le pasa al "
        + "crédito que recibe el timbre?",
      opciones: [
        "Nada: con la traza de reemplazo su valor al final es \\(\\lambda\\), "
          + "independientemente de cuántas veces haya sonado.",
        "Se multiplica por 5/3, porque hay cinco visitas en vez de tres.",
        "Baja, porque cada nueva visita reemplaza a la anterior y borra su contribución.",
        "Sube, pero menos que con la traza acumulativa.",
      ],
      correcta: 0,
      explicacion: "La traza de reemplazo no suma: <strong>fija</strong> el valor en 1 en cada "
        + "visita. Lo único que importa es cuánto tiempo ha pasado desde la <strong>última"
        + "</strong>, y en este episodio siempre es un paso, así que vale \\(\\lambda\\) haya "
        + "sonado el timbre una vez o cinco. Ése es justamente el motivo por el que la elección "
        + "entre traza acumulativa y de reemplazo no es un detalle: cambia qué heurística está "
        + "implementando el algoritmo.",
    },
    {
      enunciado: "Con \\(\\lambda=1\\) y \\(\\gamma=1\\), TD(\\(\\lambda\\)) baja "
        + "\\(V(\\text{timbre})\\) en 0,300, mientras que Monte Carlo de cada visita, aplicando "
        + "sus actualizaciones sobre la marcha, lo baja en 0,271. ¿Qué explica la diferencia?",
      opciones: [
        "Que la igualdad entre la vista hacia adelante y la de atrás solo es exacta si los "
          + "valores no se modifican durante el episodio; Monte Carlo aquí los modifica en cada "
          + "visita.",
        "Que TD(\\(\\lambda=1\\)) no es Monte Carlo: es un algoritmo distinto que da resultados "
          + "distintos siempre.",
        "Que el error TD del último paso no es exactamente \\(-1\\) cuando \\(\\lambda=1\\).",
        "Que Monte Carlo usa el retorno real y TD(1) usa una estimación arrancada.",
      ],
      correcta: 0,
      explicacion: "Las dos vistas suman lo mismo cuando \\(V\\) permanece congelada durante el "
        + "episodio: tres actualizaciones de \\(-0{,}1\\) dan \\(-0{,}3\\), que es exactamente "
        + "\\(\\alpha\\delta z\\) con \\(z=3\\). Monte Carlo aplicado sobre la marcha usa un "
        + "\\(V\\) que ya ha cambiado en la segunda y la tercera visita, y por eso suma menos. "
        + "TD(1) <strong>sí</strong> implementa Monte Carlo, y de hecho de forma más general; el "
        + "error TD del último paso vale \\(-1\\) sea cual sea \\(\\lambda\\); y con "
        + "\\(\\lambda=1\\) no queda ninguna estimación arrancada dentro del objetivo.",
    },
  ], { claves: "t4b.m2.quiz" });
}

/* ======================================================================= *
 * FIGURAS ESTÁTICAS DE LOS BLOQUES DE ESTUDIO
 * ======================================================================= */

/**
 * El abanico de diagramas de la figura 7.1.
 *
 * `arbolBackup()` de nucleo.js dibuja un árbol de UN nivel (raíz → acciones →
 * sucesores) y aquí hace falta lo contrario: una cadena de profundidad
 * creciente sin ramificación. Son cinco columnas de círculos y puntos unidos
 * por segmentos, así que se dibuja aquí en vez de forzar el componente.
 *
 * @param {Array<{pasos: number, corte: boolean, terminal: boolean, rotulo: string}>} columnas
 * @returns {SVGElement} Lienzo listo para insertar.
 */
function abanicoNPasos(columnas) {
  const ANCHO = 660;
  const SALTO = 22;                 // media transición (estado → acción)
  const Y_RAIZ = 34;
  /* El alto sale de la columna más profunda, no de una constante: con 320 fijos
     el cuadrado terminal de la última columna caia justo encima de su rótulo y
     se comia media palabra. Así, añadir una columna más larga no puede volver
     a romperlo. */
  const maxPasos = Math.max(...columnas.map((c) => c.pasos));
  const Y_ROTULO = Y_RAIZ + 2 * maxPasos * SALTO + 29;   // 9 del radio + 20 de aire
  const ALTO = Y_ROTULO + 14;

  const svg = el("svg", {
    viewBox: `0 0 ${ANCHO} ${ALTO}`, width: ANCHO, height: ALTO, role: "img",
    style: "max-width:100%;height:auto",
  });
  const linea = tono("--borde-fuerte");
  const suave = tono("--texto-suave");
  const acento = tono("--acento");

  const ancho = ANCHO / columnas.length;
  columnas.forEach((columna, k) => {
    const cx = ancho * (k + 0.5);
    const yDe = (mitades) => Y_RAIZ + mitades * SALTO;

    /* raíz: el estado desde el que se actualiza */
    svg.appendChild(el("circle", {
      cx, cy: Y_RAIZ, r: 9,
      fill: tono("--acento-tenue"), stroke: acento, "stroke-width": 2,
    }));

    for (let i = 1; i <= columna.pasos; i++) {
      const yAccion = yDe(2 * i - 1);
      const yEstado = yDe(2 * i);
      const ultimo = i === columna.pasos;
      const cortado = columna.corte && ultimo;

      if (cortado) {
        svg.appendChild(el("text", {
          x: cx, y: yAccion + 6, "text-anchor": "middle",
          "font-size": 18, fill: suave,
        }, "⋮"));
      } else {
        svg.appendChild(el("line", {
          x1: cx, y1: yDe(2 * i - 2) + 9, x2: cx, y2: yAccion - 4,
          stroke: linea, "stroke-width": 1.4,
        }));
        svg.appendChild(el("circle", { cx, cy: yAccion, r: 4, fill: tono("--texto") }));
      }
      svg.appendChild(el("line", {
        x1: cx, y1: yAccion + 4, x2: cx, y2: yEstado - 9,
        stroke: linea, "stroke-width": 1.4,
      }));
      if (ultimo && columna.terminal) {
        svg.appendChild(el("rect", {
          x: cx - 8, y: yEstado - 8, width: 16, height: 16,
          fill: tono("--texto"), stroke: tono("--texto"), "stroke-width": 1.6,
        }));
      } else {
        svg.appendChild(el("circle", {
          cx, cy: yEstado, r: 9,
          fill: tono("--superficie"), stroke: linea, "stroke-width": 1.6,
        }));
      }
    }

    svg.appendChild(el("text", {
      x: cx, y: Y_ROTULO, "text-anchor": "middle",
      "font-size": 12, "font-weight": 650, fill: suave,
    }, columna.rotulo));
  });

  return svg;
}

function figuraB2() {
  const zona = $("#b2-figura");
  const { cuerpo } = caja(zona, t("t4b.b2.fig.titulo",
    "Los diagramas de actualización de la familia de \\(n\\) pasos (figura 7.1)"));

  const pintarFigura = () => {
    pintar(cuerpo, abanicoNPasos([
      { pasos: 1, corte: false, terminal: false, rotulo: t("t4b.b2.fig.col1", "TD a un paso") },
      { pasos: 2, corte: false, terminal: false, rotulo: t("t4b.b2.fig.col2", "2 pasos") },
      { pasos: 3, corte: false, terminal: false, rotulo: t("t4b.b2.fig.col3", "3 pasos") },
      { pasos: 5, corte: true, terminal: false, rotulo: t("t4b.b2.fig.col4", "n pasos") },
      { pasos: 6, corte: true, terminal: true, rotulo: t("t4b.b2.fig.col5", "∞ (Monte Carlo)") },
    ]));
  };
  pintarFigura();
  repintadores.push(pintarFigura);

  parrafo(zona, "suave", t("t4b.b2.fig.pie",
    "Círculo blanco: un estado. Punto negro: la acción que se toma. Cuadrado: el estado "
    + "terminal. Lo único que cambia de una columna a otra es <strong>cuántas recompensas "
    + "reales</strong> entran antes de cerrar con una estimación; en la última no queda "
    + "ninguna estimación y por eso es Monte Carlo."));
}

function figuraB7() {
  const zona = $("#b7-figura");
  const PASOS_HASTA_FINAL = 20;
  const LAMBDA_FIGURA = 0.9;

  const pintarFigura = () => {
    const { pesos, cola } = pesosLambda(LAMBDA_FIGURA, PASOS_HASTA_FINAL);
    const x = pesos.map((_, i) => i + 1);
    const series = [
      {
        nombre: t("t4b.b7.fig.serie",
          "peso de \\(G_{t:t+n}\\): \\((1-\\lambda)\\lambda^{\\,n-1}\\)"),
        color: tono(COLORES_SERIE[0]), puntos: true, x, y: pesos,
      },
      {
        nombre: t("t4b.b7.fig.serieCola",
          "cola tras la terminación: \\(\\lambda^{\\,T-t-1}\\)"),
        color: tono(COLORES_SERIE[1]), puntos: true,
        x: [PASOS_HASTA_FINAL], y: [cola],
      },
    ];
    zona.replaceChildren(graficaLineas(series, {
      ejeX: t("t4b.b7.fig.ejeX", "n (pasos del retorno que se pondera)"),
      ejeY: t("t4b.b7.fig.ejeY", "Peso"),
      yMin: 0,
      formatoY: (v) => num(v, 2),
      anotaciones: [{
        x: PASOS_HASTA_FINAL,
        texto: t("t4b.b7.fig.anotCola", "terminación en T − t = {n}", { n: PASOS_HASTA_FINAL }),
      }],
      mensaje: t("t4b.b7.fig.vacio", "Los pesos se calculan al cargar la página."),
    }));
    conLeyenda(zona, series);
    parrafo(zona, "suave", t("t4b.b7.fig.pie",
      "Con \\(\\lambda = 0{,}9\\) y un episodio al que le quedan {n} pasos. Los {m} primeros "
      + "pesos se desvanecen por \\(\\lambda\\) a cada paso; el último punto no es uno más de "
      + "esa serie, es la <strong>cola</strong>, que acumula de golpe todo el peso posterior a "
      + "la terminación y por eso queda por encima de la curva. Los {n} valores suman "
      + "exactamente 1.",
      { n: PASOS_HASTA_FINAL, m: PASOS_HASTA_FINAL - 1 }));
  };
  pintarFigura();
  repintadores.push(pintarFigura);
}

/* ======================================================================= *
 * Arranque
 * ======================================================================= */

figuraB2();
figuraB7();
modulo1();
modulo2();
renderizarMatematicas();
