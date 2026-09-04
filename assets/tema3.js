/* ==========================================================================
   RL · IMAT — Tema 3: Programación dinámica
   Comportamiento de los seis módulos de tema3.html.

   Motor separado de interfaz: toda la matemática vive en assets/dp.js (que no
   toca el DOM y se testea desde node). Aquí solo se pinta y se escucha.
   ========================================================================== */

import {
  iniciarPagina, rejilla, graficaLineas, diagramaDosRectas, crearQuiz, pintar,
  num, numMat, pct, tono, colorCalor, textoSobre, generador, alCambiarTema,
  renderizarMatematicas, leyenda, deslizador, COLORES_SERIE,
} from "./nucleo.js";

import { t } from "./i18n.js";

import { politicaEquiprobable, politicaDeterminista, evaluarLineal, qDeV } from "./mdp.js";

import {
  ACCIONES_GW, gridworld4x4, estadosNoTerminales, politicaL,
  evaluar, empatesGreedy, accionesOptimas, esOptima,
  iteracionPolitica, distribucionRondas, iteracionPoliticaTruncada, costePorM,
  trayectoriaGPI, alcanzaTerminal,
} from "./dp.js";

iniciarPagina();

/* ----------------------------------------------------------------------- *
 * 0. Utilidades comunes
 * ----------------------------------------------------------------------- */

const $ = (sel) => document.querySelector(sel);

/** El tablero es único en todo el tema: se construye una vez. */
const mdp = gridworld4x4();
const GAMMA = 1;                       // Example 4.1: tarea episódica, γ = 1
const THETA = 1e-4;                    // umbral fijo de los módulos 3, 4 y 5
const NO_TERMINALES = estadosNoTerminales(mdp);
const PI_EQ = politicaEquiprobable(mdp);
const OPTIMAS = accionesOptimas(mdp, GAMMA);

/* Los nombres de acción son identificadores del motor, no texto: rejilla() los
   usa como clave. Se traduce solo su presentación, y se reutilizan las claves
   del Tema 2 porque la brújula es la misma (en inglés, N/S/W/E). */
const nombreDir = (d) => t(`t2.dir.${d}`, d);

/** Glifo de flecha para las tablas, donde no hay SVG. */
const FLECHA = { N: "↑", S: "↓", O: "←", E: "→" };

/** Repintar los SVG cuando cambia el tema (llevan colores resueltos). */
const repintadores = [];
alCambiarTema(() => repintadores.forEach((fn) => fn()));

/**
 * Una fila de botones que se comporta como un grupo de radio.
 *
 * `op.html` marca los rótulos que llevan notación —«v<sub>π</sub>»— y que por
 * tanto no se pueden volcar con textContent. Solo se usa con cadenas nuestras.
 */
function grupoRadio(contenedor, opciones, valorInicial, alElegir) {
  contenedor.innerHTML = "";
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
    contenedor.appendChild(b);
    return { boton: b, valor: op.valor };
  });
  function marcar(valor) {
    botones.forEach((x) => x.boton.setAttribute("aria-pressed", String(x.valor === valor)));
  }
  marcar(valorInicial);
  return marcar;
}

/** Exponentes negativos con dígitos en superíndice: 10⁻⁴. */
const SUPER = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴" };
const textoPotencia = (exp) => (exp === 0 ? "10⁰" : `10⁻${SUPER[-exp]}`);
/* Dentro de \( ... \) el superíndice unicode se compone mal (KaTeX lo separa):
   ahí hace falta la potencia en LaTeX. */
const potenciaMat = (exp) => `10^{${exp}}`;

/** Celda de rejilla lista para `rejilla()`, con la geometría ya resuelta. */
function celdaBase(s) {
  return { ...mdp.geometria.posicion(s), titulo: etiquetaEstado(s) };
}

const etiquetaEstado = (s) => (mdp.esTerminal(s)
  ? t("t3.estadoTerminal", "Estado terminal (T)")
  : t("t3.estadoN", "Estado {e}", { e: mdp.etiquetas[s] }));

/** Color de calor de un valor negativo, normalizado por el mínimo del tablero. */
function colorDeValor(v, minimo) {
  const escala = minimo < -1e-12 ? Math.min(1, v / minimo) : 0;
  return colorCalor(escala);
}

/**
 * Color de texto legible sobre un fondo dado.
 *
 * `textoSobre()` de nucleo.js espera "rgb(...)"; los tokens semánticos del
 * tema llegan en hexadecimal, así que se convierten antes.
 */
function textoContraste(color) {
  if (!color.startsWith("#")) return textoSobre(color);
  const limpio = color.slice(1);
  const completo = limpio.length === 3 ? limpio.split("").map((c) => c + c).join("") : limpio;
  const n = parseInt(completo, 16);
  return textoSobre(`rgb(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255})`);
}

/** Leyenda de series con sus fórmulas ya tipografiadas por KaTeX. */
function conLeyenda(zona, series) {
  const bloque = leyenda(series);
  zona.appendChild(bloque);
  renderizarMatematicas(bloque);
}

/** Nombres de acción de una lista de índices, en el orden N, S, O, E. */
const dirsDe = (indices) => (indices || []).map((a) => ACCIONES_GW[a]);

/* --- semilla de la página: la consumen los módulos 3 y 6 ---------------- */

const entradaSemilla = $("#semilla");
const oyentesSemilla = [];
const semillaActual = () => {
  const n = parseInt(entradaSemilla.value, 10);
  return Number.isFinite(n) && n > 0 ? n : 2026;
};
entradaSemilla.addEventListener("change", () => oyentesSemilla.forEach((fn) => fn()));

/* ======================================================================= *
 * MÓDULO 1 — evaluación iterativa y el umbral θ
 * ======================================================================= */

function modulo1() {
  const zonaRejilla = $("#m1-rejilla");
  const zonaGrafica = $("#m1-grafica");
  const zonaNota = $("#m1-nota");

  /* v_π exacto (sistema lineal): es el límite contra el que se mide la
     distancia, y evita arrastrar el error de la propia iteración. */
  const vLimite = evaluarLineal(mdp, PI_EQ, GAMMA);

  /* Coste en barridos de cada (θ, modo). Se precalcula: son diez evaluaciones
     de 14 estados, instantáneas, y así el rótulo «barridos que exige este θ»
     no depende de que el alumno haya llegado hasta el final. */
  const COSTE = {};
  for (const modo of ["sincrono", "insitu"]) {
    COSTE[modo] = {};
    for (let exp = -4; exp <= 0; exp++) {
      COSTE[modo][exp] = evaluar(mdp, PI_EQ, GAMMA, { theta: 10 ** exp, modo }).barridos;
    }
  }

  let exp = -4;
  let modo = "sincrono";
  let historial = [new Array(mdp.nEstados).fill(0)];
  let deltas = [];
  let parado = false;
  let tope = false;

  const theta = () => 10 ** exp;
  const v = () => historial[historial.length - 1];

  function reiniciar() {
    historial = [new Array(mdp.nEstados).fill(0)];
    deltas = [];
    parado = false;
    tope = false;
  }

  function unBarrido() {
    // `evaluar` con maxBarridos = 1 da exactamente un barrido del modo pedido.
    const paso = evaluar(mdp, PI_EQ, GAMMA, { modo, maxBarridos: 1, v0: v(), theta: -1 });
    historial.push(paso.v);
    deltas.push(paso.deltas[0]);
    parado = paso.deltas[0] <= theta();
  }

  function hastaConverger() {
    const restante = evaluar(mdp, PI_EQ, GAMMA, { modo, theta: theta(), v0: v() });
    restante.historial.slice(1).forEach((tabla) => historial.push(tabla));
    restante.deltas.forEach((d) => deltas.push(d));
    parado = restante.convergido;
    tope = !restante.convergido;
  }

  function dibujarRejilla() {
    const actual = v();
    const minimo = Math.min(...actual);
    const empates = empatesGreedy(mdp, actual, GAMMA);
    const celdas = [];
    for (let s = 0; s < mdp.nEstados; s++) {
      const terminal = mdp.esTerminal(s);
      const color = terminal ? tono("--superficie-3") : colorDeValor(actual[s], minimo);
      celdas.push({
        ...celdaBase(s),
        etiqueta: num(actual[s], 2),
        esquina: mdp.etiquetas[s],
        mono: true,
        tamano: 16,
        color,
        textoColor: terminal ? null : textoContraste(color),
        atenuada: terminal,
        flechas: terminal ? null : dirsDe(empates[s]),
        colorFlecha: terminal ? null : textoContraste(color),
      });
    }
    pintar(zonaRejilla, rejilla({ celdas, lado: 74 }));
  }

  function dibujarGrafica() {
    const seguidos = [1, 2, 3, 5];
    const nombres = {
      1: t("t3.m1.serie1", "Estado 1"), 2: t("t3.m1.serie2", "Estado 2"),
      3: t("t3.m1.serie3", "Estado 3"), 5: t("t3.m1.serie5", "Estado 5"),
    };
    const series = historial.length > 1
      ? seguidos.map((s, i) => ({
        nombre: nombres[s],
        color: tono(COLORES_SERIE[i]),
        x: historial.map((_, k) => k),
        y: historial.map((tabla) => tabla[s]),
      }))
      : [];

    const anotaciones = [];
    if (historial.length > 3) {
      anotaciones.push({ x: 3, texto: t("t3.m1.anot", "k = 3: la política greedy ya es óptima") });
    }
    if (parado) anotaciones.push({ x: historial.length - 1, texto: t("t3.m1.anotStop", "Δ < θ") });

    zonaGrafica.replaceChildren(
      graficaLineas(series, {
        ejeX: t("t3.m1.ejeX", "Barrido k"),
        ejeY: t("t3.m1.ejeY", "V(s)"),
        anotaciones,
        mensaje: t("t3.m1.vacio",
          "Todavía no hay barridos: la curva aparece en cuanto des el primero."),
      }),
    );
    if (series.length) conLeyenda(zonaGrafica, series);
  }

  function dibujarMetricas() {
    const actual = v();
    const k = historial.length - 1;
    const distancia = Math.max(...NO_TERMINALES.map((s) => Math.abs(actual[s] - vLimite[s])));
    $("#m1-barridos").textContent = String(k);
    $("#m1-delta").textContent = deltas.length ? num(deltas[deltas.length - 1], 6) : "—";
    $("#m1-distancia").textContent = num(distancia, 4);
    $("#m1-previstos").textContent = String(COSTE[modo][exp]);
    return { k, distancia };
  }

  function dibujarNota({ k, distancia }) {
    let html = "";
    if (tope) {
      html = t("t3.m1.tope",
        "Se ha alcanzado el tope de 5000 barridos sin cumplir el criterio.");
    } else if (parado) {
      html = t("t3.m1.notaFin",
        "Parado en el barrido {k} con \\(\\Delta={delta}\\) &lt; \\(\\theta={theta}\\). Los "
        + "valores están a {dist} del límite \\(-14/-20/-22\\). La política greedy dibujada es "
        + "la misma que en el barrido 3.",
        {
          k, delta: numMat(deltas[deltas.length - 1], 6),
          theta: potenciaMat(exp), dist: num(distancia, 4),
        });
    } else if (modo === "insitu") {
      html = t("t3.m1.notaInsitu",
        "Con actualización in situ los valores intermedios <strong>ya no son los de la figura "
        + "4.1</strong>: el barrido usa los valores nuevos en cuanto están disponibles, en orden "
        + "de índice creciente (fila-mayor). El límite es el mismo y se llega antes, pero la "
        + "sucesión \\(v_k\\) es otra.");
    } else if ([1, 2, 3, 10].includes(k)) {
      html = t("t3.m1.notaFig",
        "Ésta es la fila \\(k={k}\\) de la figura 4.1 del libro. Un detalle: en \\(k=2\\) el "
        + "libro imprime \\(-1{,}7\\), pero el valor exacto es \\(-1{,}75\\); es la única celda "
        + "de la figura donde el redondeo declarado a dos cifras significativas no se cumple.",
        { k });
    } else {
      html = t("t3.m1.notaCurso",
        "Barrido {k}. Sigue dando barridos, o pulsa «Iterar hasta \\(\\Delta<\\theta\\)» para "
        + "ver lo que cuesta este umbral.", { k });
    }
    zonaNota.innerHTML = html;
    renderizarMatematicas(zonaNota);
  }

  function dibujar() {
    dibujarRejilla();
    dibujarGrafica();
    dibujarNota(dibujarMetricas());
  }

  deslizador($("#m1-theta"), $("#m1-theta-v"), (valor) => {
    exp = valor;
    parado = deltas.length ? deltas[deltas.length - 1] <= theta() : false;
    dibujar();
  }, textoPotencia);

  grupoRadio($("#m1-modo"), [
    { valor: "sincrono", texto: t("t3.m1.modoSinc", "Dos arrays (síncrona)") },
    { valor: "insitu", texto: t("t3.m1.modoInsitu", "In situ") },
  ], modo, (valor) => {
    modo = valor;
    reiniciar();          // las dos sucesiones son distintas: no se mezclan
    dibujar();
  });

  $("#m1-barrido").addEventListener("click", () => { unBarrido(); dibujar(); });
  $("#m1-auto").addEventListener("click", () => { hastaConverger(); dibujar(); });
  $("#m1-reiniciar").addEventListener("click", () => { reiniciar(); dibujar(); });

  dibujar();
  repintadores.push(dibujar);

  crearQuiz($("#m1-quiz"), [
    {
      enunciado: "Con \\(\\theta=10^{-1}\\) la evaluación para en 47 barridos y con "
        + "\\(\\theta=10^{-4}\\) en 173. ¿Qué cambia en la política greedy respecto a \\(V\\)?",
      opciones: [
        "Nada: es la misma política en los dos casos, y de hecho ya lo era en el barrido 3.",
        "Cambia en los cuatro estados de las esquinas, que son los últimos en converger.",
        "Cambia en todos los estados, porque los valores son distintos.",
        "No se puede saber sin calcular \\(q_\\pi\\) explícitamente.",
      ],
      correcta: 0,
      explicacion: "Los valores siguen bajando hacia \\(-14/-20/-22\\), pero el <strong>orden"
        + "</strong> entre las acciones de cada estado deja de cambiar en el barrido 3. La "
        + "política greedy solo depende de ese orden, no de la magnitud. Bajar \\(\\theta\\) "
        + "compra precisión numérica, no una política mejor.",
    },
    {
      enunciado: "¿Por qué la inicialización exige \\(V(\\text{terminal})=0\\) y no “un valor "
        + "arbitrario” como en el resto de estados?",
      opciones: [
        "Porque el barrido no actualiza el terminal, así que ese valor se queda fijo para "
          + "siempre y contamina a todos los demás a través de \\(r+\\gamma V(s')\\).",
        "Porque si no, la matriz del sistema lineal es singular.",
        "Porque el estado terminal no tiene acciones disponibles.",
        "Porque con \\(\\gamma<1\\) el valor del terminal se descuenta a cero de todas formas.",
      ],
      correcta: 0,
      explicacion: "El bucle recorre solo \\(\\mathcal{S}\\), los no terminales, pero usa "
        + "\\(V(s')\\) con \\(s'\\) posiblemente terminal. Ese valor nunca se corrige: si no es "
        + "0, la evaluación converge a algo que no es \\(v_\\pi\\), y con \\(\\gamma=1\\) el "
        + "desplazamiento no está acotado. Es justo la condición que la caja de iteración de "
        + "política del libro se deja fuera.",
    },
    {
      enunciado: "En el barrido 2, la figura del libro imprime \\(-1{,}7\\) para el estado 1 y "
        + "esta página muestra \\(-1{,}75\\). ¿Quién se equivoca?",
      opciones: [
        "Nadie: \\(-1{,}75\\) es el valor exacto y \\(-1{,}7\\) es cómo lo imprimió el libro; "
          + "redondeado a dos cifras significativas habría sido \\(-1{,}8\\).",
        "El libro: el valor correcto es \\(-1{,}70\\) y la página lo calcula mal.",
        "La página: con actualización in situ saldría \\(-1{,}7\\).",
        "Depende del orden en que se recorran los estados.",
      ],
      correcta: 0,
      explicacion: "El valor exacto es \\(-7/4\\). Es la única celda de toda la figura donde el "
        + "redondeo declarado en el pie no se cumple; en el barrido 10, por ejemplo, sí redondea "
        + "bien. Y no tiene nada que ver con el orden de barrido: en modo in situ el valor de esa "
        + "celda tras dos barridos es otro completamente distinto.",
    },
  ], { claves: "t3.m1.quiz" });
}

/* ======================================================================= *
 * MÓDULO 2 — teorema de mejora
 * ======================================================================= */

/**
 * Valores de una política determinista sobre este tablero.
 *
 * Se usa `evaluarLineal`, que resuelve \((I-\gamma P_\pi)v = r_\pi\) exacto.
 * Devuelve null cuando el sistema es singular, que aquí significa «la política
 * no alcanza el terminal desde algún estado»: con γ = 1 esos estados valen −∞
 * y los demás siguen valiendo −(pasos hasta terminar), que con dinámica
 * determinista y r ≡ −1 se puede contar caminando.
 */
function valoresDeterministas(acciones) {
  const pi = politicaDeterminista(mdp, (s) => (mdp.esTerminal(s) ? null : acciones[s]));
  const exacto = evaluarLineal(mdp, pi, GAMMA);
  if (exacto) return { v: exacto, pi, finita: true };

  const llega = alcanzaTerminal(mdp, acciones);
  const v = new Array(mdp.nEstados).fill(0);
  for (let s = 0; s < mdp.nEstados; s++) {
    if (mdp.esTerminal(s)) continue;
    if (!llega[s]) { v[s] = -Infinity; continue; }
    let actual = s;
    let pasos = 0;
    while (!mdp.esTerminal(actual)) {
      actual = mdp.P[actual][acciones[actual]][0].s2;
      pasos++;
    }
    v[s] = -pasos;
  }
  return { v, pi, finita: false };
}

function modulo2() {
  const zonaRejilla = $("#m2-rejilla");
  const zonaTabla = $("#m2-tabla");
  const zonaVeredicto = $("#m2-veredicto");

  const piL = politicaL(mdp);
  const accionesPi = mdp.etiquetas.map((_, s) => (mdp.esTerminal(s)
    ? null
    : piL[s].findIndex((p) => p > 0.5)));
  const vPi = evaluarLineal(mdp, piL, GAMMA);
  const qPi = qDeV(mdp, vPi, GAMMA);

  /* Recuento global de los 56 cambios de una sola acción. Se calcula una vez:
     son 56 sistemas lineales de 16×16, instantáneos. */
  const conteo = { mejoran: 0, igualan: 0, empeoran: 0, infinitos: 0 };
  for (const s of NO_TERMINALES) {
    for (let a = 0; a < mdp.nAcciones; a++) {
      const diferencia = qPi[s][a] - vPi[s];
      if (diferencia > 1e-9) conteo.mejoran++;
      else if (diferencia > -1e-9) conteo.igualan++;
      else conteo.empeoran++;
      const alternativas = accionesPi.slice();
      alternativas[s] = a;
      if (valoresDeterministas(alternativas).v.some((x) => x === -Infinity)) conteo.infinitos++;
    }
  }
  $("#m2-mejoran").textContent = t("t3.m2.deN", "{n} de 56", { n: conteo.mejoran });
  $("#m2-igualan").textContent = t("t3.m2.deN", "{n} de 56", { n: conteo.igualan });
  $("#m2-empeoran").textContent = t("t3.m2.deN", "{n} de 56", { n: conteo.empeoran });

  let s = 1;
  let aAlt = accionesPi[1];
  let vista = "dif";
  let marcarAccion = () => {};

  const numeroCelda = (valor) => {
    if (valor === -Infinity) return "−∞";
    if (vista === "dif") return (valor > 0 ? "+" : "") + num(valor, 2);
    return num(valor, 2);
  };

  function dibujar() {
    const alternativas = accionesPi.slice();
    alternativas[s] = aAlt;
    const { v: vPi2 } = valoresDeterministas(alternativas);
    const cambia = aAlt !== accionesPi[s];

    /* --- valores de la vista activa --- */
    const valor = (x) => {
      if (vista === "v") return vPi[x];
      if (vista === "v2") return vPi2[x];
      if (vPi2[x] === -Infinity) return -Infinity;
      return vPi2[x] - vPi[x];
    };
    const finitos = NO_TERMINALES.map(valor).filter(Number.isFinite);
    const minimo = finitos.length ? Math.min(...finitos) : 0;

    const celdas = [];
    for (let x = 0; x < mdp.nEstados; x++) {
      const terminal = mdp.esTerminal(x);
      const valorX = terminal ? 0 : valor(x);
      let color = tono("--superficie");
      if (terminal) color = tono("--superficie-3");
      else if (valorX === -Infinity) color = tono("--peligro");
      else if (vista === "dif") {
        color = valorX > 1e-9 ? tono("--exito") : (valorX < -1e-9 ? tono("--peligro") : tono("--superficie"));
      } else color = colorDeValor(valorX, minimo);

      /* La celda «sin cambio» conserva el color de superficie, y ahí el texto
         por omisión ya contrasta; en las demás se calcula. */
      const neutra = color === tono("--superficie") || terminal;
      const claro = neutra ? null : textoContraste(color);
      celdas.push({
        ...celdaBase(x),
        etiqueta: terminal ? num(0, 2) : numeroCelda(valorX),
        esquina: mdp.etiquetas[x],
        mono: true,
        tamano: 16,
        color,
        textoColor: claro,
        atenuada: terminal,
        flechas: terminal ? null : [ACCIONES_GW[accionesPi[x]]],
        colorFlecha: claro || tono("--texto"),
        flechas2: !terminal && x === s && cambia ? [ACCIONES_GW[aAlt]] : null,
        colorFlecha2: tono("--peligro"),
      });
    }

    pintar(zonaRejilla, rejilla({
      celdas, lado: 74, seleccion: s,
      alSeleccionar: (indice) => {
        if (mdp.esTerminal(indice)) return;   // las dos celdas T ignoran el clic
        s = indice;
        aAlt = accionesPi[s];
        marcarAccion(aAlt);
        dibujar();
      },
    }));

    $("#m2-estado").textContent = mdp.etiquetas[s];
    dibujarTabla();
    dibujarVeredicto(vPi2, cambia);
  }

  function dibujarTabla() {
    const cabecera = `<thead><tr>
      <th>${t("t3.m2.thAccion", "Acción")}</th>
      <th>${t("t3.m2.thQ", "\\(q_\\pi(s,a)\\)")}</th>
      <th>${t("t3.m2.thCmp", "frente a \\(v_\\pi(s)\\)")}</th>
    </tr></thead>`;
    const filas = ACCIONES_GW.map((dir, a) => {
      const diferencia = qPi[s][a] - vPi[s];
      const signo = diferencia > 1e-9 ? ">" : (diferencia < -1e-9 ? "<" : "=");
      const marcas = [];
      if (a === accionesPi[s]) marcas.push(t("t3.m2.esPi", "← la que elige \\(\\pi\\)"));
      if (a === aAlt && a !== accionesPi[s]) {
        marcas.push(t("t3.m2.esPi2", "← la alternativa (\\(\\pi'\\))"));
      }
      const destacada = a === aAlt ? ' class="destacada"' : "";
      /* Las marcas van en la primera columna: en la tercera, alineada a la
         derecha, «← la que elige π» partía la línea justo antes del símbolo. */
      return `<tr${destacada}>
        <td>${FLECHA[dir]} ${nombreDir(dir)} <span class="suave">${marcas.join(" ")}</span></td>
        <td class="mono">${num(qPi[s][a], 2)}</td>
        <td class="mono">${signo} ${num(vPi[s], 2)}
          <span class="suave">(${diferencia > 0 ? "+" : ""}${num(diferencia, 2)})</span></td>
      </tr>`;
    }).join("");
    zonaTabla.innerHTML = `${cabecera}<tbody>${filas}</tbody>`;
    renderizarMatematicas(zonaTabla);
  }

  function dibujarVeredicto(vPi2, cambia) {
    const q = numMat(qPi[s][aAlt], 2);
    const valor = numMat(vPi[s], 2);
    const diferencia = qPi[s][aAlt] - vPi[s];
    let html;
    if (!cambia) {
      html = t("t3.m2.verSinCambio",
        "Has elegido la misma acción que \\(\\pi\\): \\(\\pi'=\\pi\\) y no hay nada que "
        + "comparar. Prueba otra.");
    } else if (vPi2.some((x) => x === -Infinity)) {
      html = t("t3.m2.verInfinito",
        "\\(q_\\pi(s,a)={q}\\) <strong>&lt;</strong> \\(v_\\pi(s)={v}\\), y además \\(\\pi'\\) "
        + "<strong>deja de alcanzar el terminal</strong> desde algún estado. Con \\(\\gamma=1\\) "
        + "eso significa \\(v_{\\pi'}=-\\infty\\) ahí: el episodio no termina nunca. Fíjate en "
        + "que esto solo pasa cuando la hipótesis del teorema falla — y no es casualidad, es una "
        + "consecuencia suya.", { q, v: valor });
    } else if (diferencia > 1e-9) {
      const n = NO_TERMINALES.filter((x) => vPi2[x] - vPi[x] > 1e-9).length;
      html = t("t3.m2.verMejor",
        "\\(q_\\pi(s,a)={q}\\) <strong>&gt;</strong> \\(v_\\pi(s)={v}\\). Se cumple la hipótesis "
        + "del teorema con desigualdad estricta, así que \\(\\pi'\\) es <strong>estrictamente "
        + "mejor</strong> que \\(\\pi\\): mejora en {n} estado(s) y no empeora en ninguno.",
        { q, v: valor, n });
    } else if (diferencia > -1e-9) {
      html = t("t3.m2.verIgual",
        "\\(q_\\pi(s,a)={q}\\) <strong>=</strong> \\(v_\\pi(s)={v}\\). Se cumple la hipótesis, "
        + "pero sin desigualdad estricta: \\(v_{\\pi'}=v_\\pi\\) <strong>en los catorce "
        + "estados</strong>. El teorema promete “igual o mejor”, y aquí toca “igual”.",
        { q, v: valor });
    } else {
      const n = NO_TERMINALES.filter((x) => vPi2[x] - vPi[x] < -1e-9).length;
      html = t("t3.m2.verPeor",
        "\\(q_\\pi(s,a)={q}\\) <strong>&lt;</strong> \\(v_\\pi(s)={v}\\). La hipótesis del "
        + "teorema <strong>no</strong> se cumple, y el teorema no dice nada: aquí resulta que "
        + "\\(\\pi'\\) es peor, en {n} estado(s).", { q, v: valor, n });
    }
    zonaVeredicto.innerHTML = html;
    renderizarMatematicas(zonaVeredicto);
  }

  marcarAccion = grupoRadio(
    $("#m2-acciones"),
    ACCIONES_GW.map((dir, a) => ({ valor: a, texto: `${FLECHA[dir]} ${nombreDir(dir)}` })),
    aAlt,
    (valor) => { aAlt = valor; dibujar(); },
  );

  grupoRadio($("#m2-vista"), [
    { valor: "v", texto: t("t3.m2.vistaV", "v<sub>π</sub>"), html: true },
    { valor: "v2", texto: t("t3.m2.vistaV2", "v<sub>π′</sub>"), html: true },
    { valor: "dif", texto: t("t3.m2.vistaDif", "v<sub>π′</sub> − v<sub>π</sub>"), html: true },
  ], vista, (valor) => { vista = valor; dibujar(); });

  $("#m2-reiniciar").addEventListener("click", () => {
    s = 1;
    aAlt = accionesPi[1];
    marcarAccion(aAlt);
    dibujar();
  });

  dibujar();
  repintadores.push(dibujar);

  crearQuiz($("#m2-quiz"), [
    {
      enunciado: "Cambias la acción del estado 5 de “bajar” a “ir a la derecha” y resulta que "
        + "\\(q_\\pi(5,E)=v_\\pi(5)=-4\\). ¿Qué garantiza el teorema?",
      opciones: [
        "Que \\(v_{\\pi'}(x)\\ge v_\\pi(x)\\) en todos los estados; aquí se cumple con igualdad "
          + "en todos.",
        "Que \\(\\pi'\\) es estrictamente mejor que \\(\\pi\\) en el estado 5.",
        "Nada, porque el teorema exige desigualdad estricta.",
        "Que \\(\\pi'\\) es óptima, porque el máximo se alcanza en dos acciones.",
      ],
      correcta: 0,
      explicacion: "La hipótesis es \\(\\ge\\), no \\(>\\): se cumple, y la conclusión también es "
        + "\\(\\ge\\). La mejora estricta solo está garantizada donde la hipótesis sea estricta, "
        + "y aquí no lo es en ningún estado. Que dos acciones empaten no dice nada sobre "
        + "optimalidad: en esta política L hay 22 empates y ninguno de ellos la hace óptima.",
    },
    {
      enunciado: "Sobre la política L, solo 2 de los 56 cambios de una acción mejoran algo. ¿Qué "
        + "dice eso del operador greedy?",
      opciones: [
        "Que en un solo paso encuentra los dos, porque toma el \\(\\arg\\max\\) en "
          + "<strong>todos</strong> los estados a la vez.",
        "Que el operador greedy necesitará al menos 27 pasos para probar todos los cambios.",
        "Que la política L ya es casi óptima, porque casi ningún cambio la mejora.",
        "Que el teorema de mejora no se puede aplicar aquí.",
      ],
      correcta: 0,
      explicacion: "El operador greedy no prueba cambios de uno en uno: calcula "
        + "\\(\\arg\\max_a q_\\pi(s,a)\\) en cada estado y los cambia todos en la misma pasada. "
        + "Y ojo con la lectura “casi óptima”: la política L da \\(-5\\) en el estado 1 donde el "
        + "óptimo es \\(-1\\); que pocos cambios <strong>de una sola acción</strong> la mejoren "
        + "no significa que esté cerca del óptimo.",
    },
    {
      enunciado: "Algunos cambios hacen que \\(v_{\\pi'}=-\\infty\\) en varios estados. ¿Puede "
        + "eso ocurrirle a un cambio que cumpla \\(q_\\pi(s,\\pi'(s))\\ge v_\\pi(s)\\)?",
      opciones: [
        "No: si se cumple la hipótesis, el teorema da \\(v_{\\pi'}\\ge v_\\pi\\), que es finita, "
          + "así que \\(\\pi'\\) tiene que seguir alcanzando el terminal.",
        "Sí, porque el teorema no dice nada sobre la terminación del episodio.",
        "Sí, pero solo con \\(\\gamma<1\\).",
        "No, porque \\(-\\infty\\) no puede aparecer nunca en un MDP finito.",
      ],
      correcta: 0,
      explicacion: "El valor \\(-\\infty\\) aparece porque \\(\\gamma=1\\) y el episodio no "
        + "termina: la suma de \\(-1\\) no está acotada. Y el teorema lo excluye por sí solo, sin "
        + "hablar de terminación: acota \\(v_{\\pi'}\\) por debajo con \\(v_\\pi\\), que es "
        + "finita. En esta rejilla los 24 cambios que rompen la terminación están, sin excepción, "
        + "entre los que empeoran.",
    },
  ], { claves: "t3.m2.quiz" });
}

/* ======================================================================= *
 * MÓDULO 3 — iteración de política y la última línea
 * ======================================================================= */

function modulo3() {
  const zonaRejilla = $("#m3-rejilla");
  const zonaGrafica = $("#m3-grafica");
  const zonaNota = $("#m3-nota");
  const zonaFase = $("#m3-fase");
  const casilla = $("#m3-correccion");

  let desempate = "primero";
  let indice = -1;                 // −1 = antes de la primera fase
  let corrida = null;
  const cacheCurva = new Map();    // semilla → distribucionRondas

  function recalcular() {
    corrida = iteracionPolitica(mdp, GAMMA, {
      theta: THETA,
      desempate,
      correccion44: casilla.checked,
      rng: generador(semillaActual()),
    });
    indice = -1;
  }

  /** Estado visible: la entrada `indice` del historial, o el punto de partida. */
  function actual() {
    if (indice < 0) {
      return {
        fase: null, v: new Array(mdp.nEstados).fill(0), pi: null,
        empates: null, estable: null,
      };
    }
    return corrida.historial[indice];
  }

  const avanzarHasta = (predicado) => {
    let j = indice + 1;
    while (j < corrida.historial.length && !predicado(corrida.historial[j])) j++;
    if (j < corrida.historial.length) indice = j;
  };

  function dibujarRejilla() {
    const paso = actual();
    const empates = paso.empates || empatesGreedy(mdp, paso.v, GAMMA);
    const celdas = [];
    for (let s = 0; s < mdp.nEstados; s++) {
      const terminal = mdp.esTerminal(s);
      /* Sin mapa de calor: lo que hay que ver aquí son las flechas —la
         almacenada y las que empatan— y el borde ámbar del empate, y todo eso
         se pierde sobre un fondo saturado. El guion tampoco lo pide. */
      const color = terminal ? tono("--superficie-3") : tono("--superficie");
      const almacenada = paso.pi && paso.pi[s] !== null && paso.pi[s] !== undefined
        ? [ACCIONES_GW[paso.pi[s]]] : null;
      const otras = dirsDe(empates[s]).filter((d) => !almacenada || d !== almacenada[0]);
      celdas.push({
        ...celdaBase(s),
        etiqueta: num(paso.v[s], 2),
        esquina: mdp.etiquetas[s],
        mono: true,
        tamano: 16,
        color,
        atenuada: terminal,
        borde: !terminal && empates[s].length > 1 ? tono("--aviso") : null,
        flechas: terminal ? null : otras,
        colorFlecha: tono("--texto-suave"),
        flechas2: almacenada,
        colorFlecha2: tono("--acento"),
      });
    }
    pintar(zonaRejilla, rejilla({ celdas, lado: 74 }));

    zonaFase.textContent = paso.fase === "E"
      ? t("t3.m3.faseE", "Fase E — evaluación de la política")
      : (paso.fase === "I"
        ? t("t3.m3.faseI", "Fase I — mejora de la política")
        : t("t3.m3.faseInicio", "Antes de empezar — V ≡ 0, π₀ equiprobable"));
  }

  function dibujarMetricas() {
    const hasta = corrida.historial.slice(0, indice + 1);
    const rondas = hasta.filter((x) => x.fase === "I").length;
    const barridos = hasta.reduce((n, x) => n + x.barridosFase, 0);
    const paso = actual();
    const empates = paso.empates || empatesGreedy(mdp, paso.v, GAMMA);
    const conEmpate = NO_TERMINALES.filter((s) => empates[s].length > 1).length;

    $("#m3-rondas").textContent = String(rondas);
    $("#m3-barridos").textContent = String(barridos);
    $("#m3-estable").textContent = paso.estable === null || paso.estable === undefined
      ? "—"
      : (paso.estable ? t("t3.m3.si", "verdadero") : t("t3.m3.no", "falso"));
    $("#m3-empates").textContent = String(conEmpate);

    let optima = "—";
    if (paso.pi) {
      const conjuntos = paso.pi.map((a) => (a === null || a === undefined ? [] : [a]));
      optima = esOptima(conjuntos, OPTIMAS) ? t("t3.si", "sí") : t("t3.no", "no");
    }
    $("#m3-optima").textContent = optima;
    return { rondas, barridos, conEmpate };
  }

  function dibujarNota({ rondas, barridos, conEmpate }) {
    let html;
    const terminado = indice === corrida.historial.length - 1 && corrida.parado;
    if (indice < 0) {
      html = t("t3.m3.notaInicio",
        "\\(V\\equiv0\\) y \\(\\pi_0\\) equiprobable. Pulsa «Evaluar (E)» para dar la primera "
        + "fase completa.");
    } else if (terminado) {
      html = t("t3.m3.notaFin",
        "Parado en la ronda {n} tras {b} barridos de evaluación. La política devuelta es óptima; "
        + "lo era desde la ronda 1.", { n: rondas, b: barridos });
    } else if (!corrida.parado && indice === corrida.historial.length - 1) {
      html = t("t3.m3.tope",
        "5000 rondas y sigue sin parar. No es un fallo de esta página: es el fallo del "
        + "pseudocódigo. Activa la corrección del ejercicio 4.4.");
    } else if (casilla.checked) {
      html = t("t3.m3.notaCorreccion",
        "Con la corrección activada la última línea compara <strong>optimalidad</strong> en vez "
        + "de identidad: si la acción antigua sigue estando entre las maximizadoras, se conserva. "
        + "El algoritmo para en 2 rondas, con cualquier semilla.");
    } else if (rondas <= 1) {
      html = t("t3.m3.notaRonda1",
        "Ronda 1: 173 barridos para evaluar la política equiprobable hasta "
        + "\\(\\Delta<10^{-4}\\). La mejora que sale de ahí <strong>ya es óptima</strong>: en "
        + "este tablero, una sola iteración basta para encontrar \\(\\pi_*\\). Lo que viene "
        + "ahora es solo el algoritmo intentando <strong>darse cuenta</strong>.");
    } else {
      html = t("t3.m3.notaBucle",
        "Ronda {n}. \\(V\\) no ha cambiado nada: sigue siendo \\(v_*\\). La política tampoco ha "
        + "mejorado: sigue siendo óptima. Y sin embargo <code>política-estable</code> es falso, "
        + "porque el <code>argmax</code> ha devuelto otra acción <strong>entre las que "
        + "empatan</strong>. Aquí hay {e} estados con empate; la probabilidad de que una ronda "
        + "devuelva exactamente las mismas acciones almacenadas es \\(1/256\\), así que hacen "
        + "falta <strong>256 rondas de media</strong> y no hay ninguna cota superior.",
        { n: rondas, e: conEmpate });
    }
    zonaNota.innerHTML = html;
    renderizarMatematicas(zonaNota);
  }

  function dibujarGrafica() {
    const aleatorioSinCorreccion = desempate === "aleatorio" && !casilla.checked;
    if (!aleatorioSinCorreccion) {
      zonaGrafica.replaceChildren(graficaLineas([], {
        mensaje: t("t3.m3.vacio",
          "Con este desempate el algoritmo para siempre en 2 o 3 rondas: no hay distribución que "
          + "dibujar. Cambia a desempate aleatorio y desactiva la corrección."),
      }));
      return;
    }

    const semilla = semillaActual();
    if (!cacheCurva.has(semilla)) {
      cacheCurva.set(semilla, distribucionRondas(mdp, GAMMA, {
        repeticiones: 200, semilla, theta: THETA,
      }));
    }
    const dist = cacheCurva.get(semilla);
    const n = dist.acumulada.length;
    const x = Array.from({ length: n }, (_, i) => i + 1);
    const series = [
      {
        nombre: t("t3.m3.serieEmp", "Empírica (200 repeticiones)"),
        color: tono(COLORES_SERIE[0]), x, y: dist.acumulada,
      },
      {
        nombre: t("t3.m3.serieTeo", "Teórica \\(1-(255/256)^{n-2}\\)"),
        color: tono(COLORES_SERIE[1]), x,
        y: x.map((k) => (k < 2 ? 0 : 1 - (255 / 256) ** (k - 2))),
      },
    ];
    zonaGrafica.replaceChildren(graficaLineas(series, {
      ejeX: t("t3.m3.ejeX", "Rondas de mejora"),
      ejeY: t("t3.m3.ejeY", "Fracción que ya ha parado"),
      yMin: 0, yMax: 1,
      formatoY: (v) => pct(v, 0),
      anotaciones: n > 258 ? [{ x: 258, texto: t("t3.m3.anot", "258 = media teórica") }] : [],
    }));
    conLeyenda(zonaGrafica, series);
    const resumen = document.createElement("p");
    resumen.className = "suave";
    resumen.textContent = t("t3.m3.resumenDist",
      "Media {media} rondas · mediana {mediana}. La distribución es geométrica: la media queda "
      + "muy por encima de lo que se ve la mitad de las veces.",
      { media: num(dist.media, 1), mediana: num(dist.mediana, 1) });
    zonaGrafica.appendChild(resumen);
  }

  function dibujar() {
    dibujarRejilla();
    dibujarNota(dibujarMetricas());
    dibujarGrafica();
    $("#m3-semilla").textContent = t("t3.m3.semilla",
      "Semilla {n} · 200 repeticiones para la curva empírica.", { n: semillaActual() });
  }

  grupoRadio($("#m3-desempate"), [
    { valor: "primero", texto: t("t3.m3.desDet", "Determinista (orden N, S, O, E)") },
    { valor: "aleatorio", texto: t("t3.m3.desAle", "Aleatorio (semilla de la página)") },
  ], desempate, (valor) => { desempate = valor; recalcular(); dibujar(); });

  casilla.addEventListener("change", () => { recalcular(); dibujar(); });

  $("#m3-evaluar").addEventListener("click", () => {
    avanzarHasta((x) => x.fase === "E");
    dibujar();
  });
  $("#m3-mejorar").addEventListener("click", () => {
    avanzarHasta((x) => x.fase === "I");
    dibujar();
  });
  $("#m3-iteracion").addEventListener("click", () => {
    avanzarHasta((x) => x.fase === "E");
    avanzarHasta((x) => x.fase === "I");
    dibujar();
  });
  $("#m3-hasta").addEventListener("click", () => {
    indice = corrida.historial.length - 1;
    dibujar();
  });
  $("#m3-reiniciar").addEventListener("click", () => { recalcular(); dibujar(); });

  oyentesSemilla.push(() => { recalcular(); dibujar(); });

  recalcular();
  dibujar();
  repintadores.push(dibujar);

  crearQuiz($("#m3-quiz"), [
    {
      enunciado: "Con desempate aleatorio, el contador de rondas pasa de 300 mientras \\(V\\) no "
        + "cambia ni un decimal. ¿Qué está pasando?",
      opciones: [
        "El <code>argmax</code> devuelve cada vez una acción distinta entre las que empatan; la "
          + "política cambia sin mejorar, y la última línea, que compara acciones, marca "
          + "<code>política-estable ← falso</code>.",
        "La evaluación no ha convergido todavía y hace falta bajar \\(\\theta\\).",
        "La política se está deteriorando y el algoritmo tiene que rehacerla.",
        "Es un fallo de precisión en coma flotante de esta página.",
      ],
      correcta: 0,
      explicacion: "\\(V\\) ya es \\(v_*\\) y todas las políticas por las que pasa son óptimas: "
        + "no hay nada que mejorar ni que deteriorar. El fallo está en el criterio de parada, que "
        + "pregunta “¿ha cambiado la acción?” en vez de “¿ha mejorado algo?”. Bajar "
        + "\\(\\theta\\) no ayuda: el problema no es numérico, y de hecho la evaluación termina "
        + "con \\(\\Delta=0\\) exacto en un solo barrido.",
    },
    {
      enunciado: "En esta rejilla hay 6 estados con varias acciones óptimas: cuatro de ellos con "
        + "2 y dos de ellos con 4. Si el desempate es uniforme, ¿cuál es la probabilidad de que "
        + "una ronda de mejora devuelva exactamente las acciones almacenadas?",
      opciones: [
        "\\(1/256\\), el producto de \\(\\tfrac12\\) cuatro veces por \\(\\tfrac14\\) dos veces.",
        "\\(1/64\\), porque hay 6 estados con empate y \\(2^6=64\\).",
        "\\(1/12\\), porque hay 12 acciones óptimas repartidas entre los 6 estados.",
        "\\(1/6\\), una entre los 6 estados con empate.",
      ],
      correcta: 0,
      explicacion: "Cada estado con empate se sortea de forma independiente, así que las "
        + "probabilidades se multiplican: \\((1/2)^4\\cdot(1/4)^2 = 1/16\\cdot1/16 = 1/256\\). "
        + "Ése es también el número de políticas deterministas óptimas distintas que tiene esta "
        + "rejilla. El valor \\(2^6\\) supondría que los seis estados tienen exactamente dos "
        + "opciones, y dos de ellos tienen cuatro.",
    },
    {
      enunciado: "La corrección aceptada del ejercicio 4.4 sustituye “si acción-antigua ≠ π(s)” "
        + "por “si acción-antigua no está entre las maximizadoras”. ¿Por qué eso garantiza la "
        + "terminación?",
      opciones: [
        "Porque <code>política-estable</code> solo pasa a falso cuando la política ha mejorado "
          + "de verdad, y como el número de políticas es finito y la mejora es estricta, eso solo "
          + "puede ocurrir un número finito de veces.",
        "Porque elimina los empates del \\(\\arg\\max\\).",
        "Porque hace que la evaluación converja exactamente en vez de hasta \\(\\theta\\).",
        "Porque obliga a que la política inicial sea determinista.",
      ],
      correcta: 0,
      explicacion: "El argumento de terminación del libro es: monotonía <strong>estricta</strong> "
        + "más número finito de políticas deterministas. La versión original lo rompe porque "
        + "marca inestabilidad ante cambios que no mejoran nada. La corrección restaura la "
        + "monotonía estricta comparando optimalidad y no identidad. Los empates siguen ahí —el "
        + "<code>argmax</code> sigue teniendo varias respuestas—; lo que cambia es que ya no se "
        + "toman como progreso.",
    },
  ], { claves: "t3.m3.quiz" });
}

/* ======================================================================= *
 * MÓDULO 4 — la política óptima aparece antes
 * ======================================================================= */

function modulo4() {
  const zonaV = $("#m4-rejillaV");
  const zonaPi = $("#m4-rejillaPi");
  const zonaGrafica = $("#m4-grafica");
  const zonaNota = $("#m4-nota");

  /* Toda la sucesión v_0 … v_173 se precalcula: 173 barridos de 14 estados. */
  const evaluacion = evaluar(mdp, PI_EQ, GAMMA, { theta: THETA });
  const K_FINAL = evaluacion.barridos;                 // 173
  const vLimite = evaluacion.v;
  const K_ESTABLE = 3;

  const empatesPorK = evaluacion.historial.map((v) => empatesGreedy(mdp, v, GAMMA));
  const suboptPorK = empatesPorK.map((empates) =>
    NO_TERMINALES.filter((s) => !empates[s].every((a) => OPTIMAS[s].includes(a))).length);
  const distanciaPorK = evaluacion.historial.map((v) =>
    Math.max(...NO_TERMINALES.map((s) => Math.abs(v[s] - vLimite[s]))));

  let k = 0;
  let vista = "ambos";
  const entradaK = $("#m4-k");

  function rejillaValores() {
    const v = evaluacion.historial[k];
    const minimo = Math.min(...v);
    const celdas = [];
    for (let s = 0; s < mdp.nEstados; s++) {
      const terminal = mdp.esTerminal(s);
      const color = terminal ? tono("--superficie-3") : colorDeValor(v[s], minimo);
      celdas.push({
        ...celdaBase(s),
        etiqueta: vista === "ambos" ? num(v[s], 2) : null,
        esquina: mdp.etiquetas[s],
        mono: true,
        tamano: 16,
        color,
        textoColor: terminal ? null : textoContraste(color),
        atenuada: terminal,
      });
    }
    pintar(zonaV, rejilla({ celdas, lado: 74 }));
  }

  function rejillaPolitica() {
    const empates = empatesPorK[k];
    const celdas = [];
    for (let s = 0; s < mdp.nEstados; s++) {
      const terminal = mdp.esTerminal(s);
      const buena = terminal || empates[s].every((a) => OPTIMAS[s].includes(a));
      const color = terminal
        ? tono("--superficie-3")
        : (buena ? tono("--exito") : tono("--aviso"));
      celdas.push({
        ...celdaBase(s),
        etiqueta: null,
        esquina: mdp.etiquetas[s],
        color,
        textoColor: textoContraste(color),
        atenuada: terminal,
        flechas: terminal ? null : dirsDe(empates[s]),
        colorFlecha: textoContraste(color),
      });
    }
    const svg = rejilla({ celdas, lado: 74 });
    const rotulo = document.createElement("p");
    rotulo.className = "suave";
    if (k === 0) rotulo.textContent = t("t3.m4.aleatoria", "(política aleatoria)");
    else if (suboptPorK[k] === 0) rotulo.textContent = t("t3.m4.optima", "política óptima");
    else rotulo.textContent = "\u00a0";
    zonaPi.replaceChildren(svg, rotulo);
  }

  function dibujarGrafica() {
    const x = evaluacion.historial.map((_, i) => i);
    const series = [
      {
        nombre: t("t3.m4.serieMal", "Estados con alguna acción greedy subóptima"),
        color: tono(COLORES_SERIE[3]), x, y: suboptPorK,
      },
      {
        nombre: t("t3.m4.serieDist", "Distancia al límite \\(\\max_s|v_k(s)-v_\\pi(s)|\\)"),
        color: tono(COLORES_SERIE[1]), x, y: distanciaPorK,
      },
    ];
    const anotaciones = [
      { x: K_ESTABLE, texto: t("t3.m4.anot3", "k = 3: cero estados subóptimos") },
      { x: K_FINAL, texto: t("t3.m4.anot173", "k = 173: Δ < 10⁻⁴") },
    ];
    // El cursor solo cuando no pisa a las dos anotaciones fijas ni al eje.
    if (k > 0 && k !== K_ESTABLE && k !== K_FINAL) {
      anotaciones.push({ x: k, texto: `k = ${k}` });
    }

    zonaGrafica.replaceChildren(graficaLineas(series, {
      ejeX: t("t3.m4.ejeX", "Barrido k"),
      ejeY: t("t3.m4.ejeY", "Estados / unidades de valor"),
      yMin: 0,
      anotaciones,
      mensaje: t("t3.m4.vacio", "Las dos curvas se calculan al cargar el módulo."),
    }));
    conLeyenda(zonaGrafica, series);
    const aclaracion = document.createElement("p");
    aclaracion.className = "suave";
    aclaracion.textContent = t("t3.m4.compartenEje",
      "Las dos series comparten eje a propósito: lo que importa no es su escala, sino que una "
      + "llega a cero enseguida y la otra tarda 173 barridos.");
    zonaGrafica.appendChild(aclaracion);
  }

  function dibujarMetricas() {
    $("#m4-subopt").textContent = String(suboptPorK[k]);
    $("#m4-distancia").textContent = num(distanciaPorK[k], 2);
    $("#m4-ventaja").textContent = k >= K_ESTABLE
      ? t("t3.m4.ventaja", "{a} − {b} = {c}", {
        a: K_FINAL, b: K_ESTABLE, c: K_FINAL - K_ESTABLE,
      })
      : "—";
  }

  function dibujarNota() {
    let html;
    if (k === K_FINAL) {
      html = t("t3.m4.notaInf",
        "“∞” aquí es el barrido 173, el primero que cumple \\(\\Delta<10^{-4}\\). Los valores "
        + "son \\(-13{,}9982\\ldots\\) donde el libro imprime \\(-14\\).");
    } else if (k < K_ESTABLE) {
      html = t("t3.m4.notaAntes",
        "Todavía hay {n} estado(s) cuya política greedy elige alguna acción que no es óptima. "
        + "Están marcados en la rejilla de la derecha.", { n: suboptPorK[k] });
    } else if (k === K_ESTABLE) {
      html = t("t3.m4.notaJusto",
        "Aquí. Cero estados subóptimos, y los valores están todavía a <strong>19 unidades"
        + "</strong> de su límite: \\(v_3(3)=-3\\) frente a \\(v_\\pi(3)=-22\\). A partir de "
        + "aquí las flechas ya no cambian nunca, pero la evaluación necesita <strong>170 "
        + "barridos más</strong> para cumplir \\(\\Delta<10^{-4}\\).");
    } else {
      html = t("t3.m4.notaDespues",
        "Las flechas son las mismas que en el barrido 3. Lo único que cambia son los números, y "
        + "solo hacen falta para saber <strong>cuántos pasos</strong> cuesta llegar al terminal, "
        + "no para decidir <strong>hacia dónde</strong> ir.");
    }
    zonaNota.innerHTML = html;
    renderizarMatematicas(zonaNota);
  }

  function dibujar() {
    entradaK.value = String(Math.min(k, Number(entradaK.max)));
    $("#m4-k-v").textContent = k === K_FINAL ? `${K_FINAL} (∞)` : String(k);
    rejillaValores();
    rejillaPolitica();
    dibujarMetricas();
    dibujarNota();
    dibujarGrafica();
  }

  let marcarSalto = () => {};
  entradaK.addEventListener("input", () => {
    k = parseInt(entradaK.value, 10);
    marcarSalto(k);
    dibujar();
  });

  marcarSalto = grupoRadio($("#m4-saltos"), [
    { valor: 0, texto: "0" }, { valor: 1, texto: "1" }, { valor: 2, texto: "2" },
    { valor: 3, texto: "3" }, { valor: 10, texto: "10" },
    { valor: K_FINAL, texto: t("t3.m4.inf", "∞") },
  ], 0, (valor) => { k = valor; dibujar(); });

  grupoRadio($("#m4-vista"), [
    { valor: "ambos", texto: t("t3.m4.vistaAmbos", "Valores y política") },
    { valor: "politica", texto: t("t3.m4.vistaPolitica", "Solo la política") },
  ], vista, (valor) => { vista = valor; dibujar(); });

  dibujar();
  repintadores.push(dibujar);

  crearQuiz($("#m4-quiz"), [
    {
      enunciado: "En el barrido 3 la política greedy ya es óptima, pero \\(v_3(3)=-3\\) y "
        + "\\(v_\\pi(3)=-22\\). ¿Cómo puede una política óptima salir de valores tan "
        + "equivocados?",
      opciones: [
        "Porque la política solo depende del <strong>orden</strong> entre los valores de acción, "
          + "y ese orden se fija mucho antes que las magnitudes.",
        "Porque \\(v_3\\) ya es proporcional a \\(v_\\pi\\), y el \\(\\arg\\max\\) es invariante "
          + "a escala.",
        "Porque en el barrido 3 la evaluación ya ha convergido en los estados que importan.",
        "Es una coincidencia de este tablero; en general no ocurre.",
      ],
      correcta: 0,
      explicacion: "El \\(\\arg\\max\\) no mira magnitudes, mira comparaciones. \\(v_3\\) no es "
        + "proporcional a \\(v_\\pi\\) —basta ver que \\(-3\\) y \\(-22\\) no guardan la misma "
        + "razón que \\(-2{,}4375\\) y \\(-14\\)—, pero sí ordena a los vecinos igual. Y que aquí "
        + "ocurra en el barrido 3 sí es propio de este tablero; lo general es que la política se "
        + "estabiliza antes que los valores, no que lo haga tan pronto.",
    },
    {
      enunciado: "En \\(k=2\\) los estados 3, 6, 9 y 12 aparecen con las cuatro flechas. ¿Por "
        + "qué solo dos de ellos están marcados como problemáticos?",
      opciones: [
        "Porque en los estados 6 y 9 las cuatro acciones <strong>son</strong> óptimas, así que "
          + "elegir cualquiera de ellas no es un error; en el 3 y el 12 no.",
        "Porque los estados 6 y 9 son interiores y los otros dos están en el borde.",
        "Porque en el 3 y el 12 el empate se rompe en el barrido siguiente y en el 6 y el 9 no.",
        "Porque la figura del libro solo marca dos de los cuatro.",
      ],
      correcta: 0,
      explicacion: "Desde el 6 y desde el 9, las cuatro casillas vecinas valen \\(-2\\) en "
        + "\\(v_*\\), así que las cuatro acciones llevan a un valor de \\(-3\\), que es \\(v_*\\) "
        + "del propio estado: las cuatro son óptimas. Desde el 3, en cambio, solo bajar o ir a la "
        + "izquierda lo son. El criterio no es “¿hay empate?”, sino “¿todas las acciones "
        + "empatadas están entre las óptimas?”.",
    },
    {
      enunciado: "El libro dice que en este ejemplo la iteración de política encuentra la "
        + "política óptima tras una sola iteración. ¿Cuántos barridos de evaluación cuesta esa "
        + "única iteración?",
      opciones: [
        "173, con \\(\\theta=10^{-4}\\): la iteración es una, pero su fase de evaluación son 173 "
          + "barridos.",
        "Uno, porque una iteración es un barrido.",
        "Tres, los que necesita la política greedy para estabilizarse.",
        "178, que es lo que tarda el algoritmo completo en parar.",
      ],
      correcta: 0,
      explicacion: "Conviene no mezclar dos contadores: <strong>iteraciones de política</strong> "
        + "(evaluar entero + mejorar) y <strong>barridos de evaluación</strong>. Aquí basta una "
        + "iteración, pero su evaluación consume 173 barridos hasta cumplir el umbral. Los tres "
        + "barridos son otra cosa: cuándo la política greedy deja de cambiar, que es precisamente "
        + "lo que hace que esos 170 restantes no sirvan para nada. Y 178 es el total del "
        + "algoritmo hasta que consigue <strong>detectar</strong> que ha terminado, que incluye "
        + "rondas posteriores.",
    },
  ], { claves: "t3.m4.quiz" });
}

/* ======================================================================= *
 * MÓDULO 5 — iteración de valor: la evaluación truncada
 * ======================================================================= */

function modulo5() {
  const zonaRejilla = $("#m5-rejilla");
  const zonaGrafica = $("#m5-grafica");
  const zonaNota = $("#m5-nota");
  const zonaCmp = $("#m5-cmp");
  const entradaM = $("#m5-m");

  const COSTE = costePorM(mdp, GAMMA, { valoresM: [1, 2, 3, 5, 10, 20], theta: THETA });
  const COSTE_INF = COSTE.find((f) => f.m === Infinity).barridos;
  /* v_k de la evaluación pura, para la vista de comparación. */
  const EVALUACION = evaluar(mdp, PI_EQ, GAMMA, { theta: THETA }).historial;

  let m = 1;
  let vista = "v";
  let indice = -1;
  let corrida = null;

  function recalcular() {
    corrida = iteracionPoliticaTruncada(mdp, GAMMA, { m, theta: THETA });
    indice = -1;
  }

  function actual() {
    if (indice < 0) {
      return { fase: null, v: new Array(mdp.nEstados).fill(0), pi: null, delta: null };
    }
    return corrida.historial[indice];
  }

  const contar = (fase) =>
    corrida.historial.slice(0, indice + 1).filter((x) => x.fase === fase).length;

  function unBarrido() {
    let j = indice + 1;
    while (j < corrida.historial.length && corrida.historial[j].fase !== "E") j++;
    if (j < corrida.historial.length) indice = j;
  }

  function unaRonda() {
    let j = indice + 1;
    while (j < corrida.historial.length && corrida.historial[j].fase !== "I") j++;
    if (j >= corrida.historial.length) return;
    let k = j + 1;
    while (k < corrida.historial.length && corrida.historial[k].fase === "E") k++;
    indice = k - 1;
  }

  function dibujarRejilla() {
    const paso = actual();
    const empates = paso.pi || empatesGreedy(mdp, paso.v, GAMMA);
    const barridos = contar("E");
    const minimo = Math.min(...paso.v);
    const comparando = vista === "cmp";
    const celdas = [];
    for (let s = 0; s < mdp.nEstados; s++) {
      const terminal = mdp.esTerminal(s);
      /* Sin mapa de calor: la celda lleva hasta cuatro flechas y la segunda
         línea gris de la vista de comparación, y sobre un fondo saturado ni
         una cosa ni la otra se leen. El guion tampoco lo pide aquí. */
      const color = terminal ? tono("--superficie-3") : tono("--superficie");
      const vEval = EVALUACION[Math.min(barridos, EVALUACION.length - 1)][s];
      celdas.push({
        ...celdaBase(s),
        etiqueta: num(paso.v[s], 2),
        subetiqueta: comparando ? num(vEval, 2) : null,
        esquina: mdp.etiquetas[s],
        mono: true,
        tamano: 16,
        color,
        atenuada: terminal,
        /* En la vista de comparación no se pintan flechas: la segunda línea
           gris y la flecha ocupan la misma banda de la celda y se pisan. Esa
           vista es de valores; para la política está el otro botón. */
        flechas: terminal || comparando ? null : dirsDe(empates[s]),
        colorFlecha: tono("--acento"),
      });
    }
    pintar(zonaRejilla, rejilla({ celdas, lado: 74 }));

    zonaCmp.innerHTML = comparando
      ? t("t3.m5.cmp",
        "Segunda línea de cada celda, en gris: el \\(v_k\\) de la evaluación de la política "
        + "equiprobable para el mismo número de barridos. Esta vista no pinta las flechas: "
        + "vuelve a «\\(V\\) y política» para verlas.")
      : "";
    if (comparando) renderizarMatematicas(zonaCmp);
  }

  function dibujarMetricas() {
    const paso = actual();
    const barridos = contar("E");
    const rondas = contar("I");
    $("#m5-barridos").textContent = String(barridos);
    $("#m5-rondas").textContent = String(rondas);
    // Las fases I no tienen Δ: se muestra el del último barrido de evaluación.
    const ultimaE = corrida.historial.slice(0, indice + 1)
      .filter((x) => x.fase === "E").pop();
    $("#m5-delta").textContent = ultimaE ? num(ultimaE.delta, 6) : "—";
    const empates = paso.pi || empatesGreedy(mdp, paso.v, GAMMA);
    $("#m5-optima").textContent = esOptima(empates, OPTIMAS)
      ? t("t3.si", "sí") : t("t3.no", "no");
    return { barridos, rondas };
  }

  function dibujarNota({ barridos, rondas }) {
    const total = corrida.barridos;
    let html;
    if (indice === corrida.historial.length - 1) {
      html = t("t3.m5.notaFin",
        "Parado tras {b} barridos y {r} rondas. \\(V=v_*\\): los valores son el negativo de la "
        + "distancia mínima al terminal.", { b: barridos, r: rondas });
    } else if (m === Infinity) {
      html = t("t3.m5.notaInf",
        "Con \\(m=\\infty\\) esto es la iteración de política: <strong>178 barridos</strong>, de "
        + "los cuales 173 se van en evaluar la primera política. Cuarenta y cuatro veces más caro "
        + "que \\(m=1\\) para llegar a la misma política.");
    } else if (m === 1) {
      html = t("t3.m5.notaM1",
        "Con \\(m=1\\) esto es literalmente la caja de <em>Value Iteration</em>: mejora y "
        + "evaluación en el mismo barrido. Y aquí converge en <strong>4 barridos</strong>, con "
        + "\\(\\Delta = 1, 1, 1, 0\\). El cuarto barrido no cambia nada: solo sirve para "
        + "comprobar que ya está.");
    } else {
      html = t("t3.m5.notaMedio",
        "Con \\(m={m}\\): {b} barridos. Ni el libro ni las diapositivas presentan este caso, y es "
        + "perfectamente legítimo: el libro dice explícitamente que se puede intercalar cualquier "
        + "número de barridos de evaluación entre dos mejoras, y que a menudo se converge antes.",
        { m, b: total });
    }
    zonaNota.innerHTML = html;
    renderizarMatematicas(zonaNota);
  }

  function dibujarGrafica() {
    const finitos = COSTE.filter((f) => Number.isFinite(f.m));
    const serie = {
      nombre: t("t3.m5.serieCoste", "Barridos totales hasta \\(\\Delta<\\theta\\)"),
      color: tono(COLORES_SERIE[0]),
      x: finitos.map((f) => f.m),
      y: finitos.map((f) => f.barridos),
      puntos: true,
    };
    /* El punto de m = ∞ no cabe en la serie (178 frente a 4-25), así que va
       como anotación al final del eje. El cursor del m elegido va aparte. */
    const ultimo = finitos[finitos.length - 1].m;
    const anotaciones = [{
      x: ultimo,
      texto: t("t3.m5.anotInf", "m = ∞ (iteración de política): {n}", { n: COSTE_INF }),
    }];
    if (Number.isFinite(m) && m !== ultimo) {
      anotaciones.push({ x: m, texto: `m = ${m}` });
    }
    zonaGrafica.replaceChildren(graficaLineas([serie], {
      ejeX: t("t3.m5.ejeX", "m (barridos de evaluación entre mejoras)"),
      ejeY: t("t3.m5.ejeY", "Barridos totales"),
      yMin: 0,
      ticksX: finitos.map((f) => f.m),
      anotaciones,
      mensaje: t("t3.m5.vacio", "La curva de coste se calcula al cargar el módulo."),
    }));
    conLeyenda(zonaGrafica, [serie]);
  }

  function dibujar() {
    $("#m5-m-v").textContent = Number.isFinite(m) ? String(m) : "∞";
    dibujarRejilla();
    dibujarNota(dibujarMetricas());
    dibujarGrafica();
  }

  deslizador(entradaM, null, (valor) => {
    m = valor;
    recalcular();
    dibujar();
  });

  $("#m5-minf").addEventListener("click", () => {
    m = Infinity;
    recalcular();
    dibujar();
  });

  grupoRadio($("#m5-vista"), [
    { valor: "v", texto: t("t3.m5.vistaV", "V y política") },
    { valor: "cmp", texto: t("t3.m5.vistaCmp", "Comparar con la evaluación") },
  ], vista, (valor) => { vista = valor; dibujar(); });

  $("#m5-barrido").addEventListener("click", () => { unBarrido(); dibujar(); });
  $("#m5-ronda").addEventListener("click", () => { unaRonda(); dibujar(); });
  $("#m5-hasta").addEventListener("click", () => {
    indice = corrida.historial.length - 1;
    dibujar();
  });
  $("#m5-reiniciar").addEventListener("click", () => { recalcular(); dibujar(); });

  recalcular();
  dibujar();
  repintadores.push(dibujar);

  crearQuiz($("#m5-quiz"), [
    {
      enunciado: "¿Cuál es la diferencia entre la actualización de la evaluación de la política y "
        + "la de la iteración de valor?",
      opciones: [
        "Que \\(\\sum_a\\pi(a\\mid s)\\) se sustituye por \\(\\max_a\\); todo lo demás es "
          + "idéntico.",
        "Que la iteración de valor usa \\(q\\) en vez de \\(v\\).",
        "Que la iteración de valor no usa el modelo \\(p(s',r\\mid s,a)\\).",
        "Que la iteración de valor añade una tasa de aprendizaje.",
      ],
      correcta: 0,
      explicacion: "Las dos son la misma suma sobre \\((s',r)\\); lo único que cambia es el "
        + "operador de delante. Las dos usan el modelo —la programación dinámica siempre lo "
        + "necesita— y ninguna tiene tasa de aprendizaje: la actualización esperada "
        + "<strong>sustituye</strong> el valor, no lo corrige un poco. La versión con \\(q\\) "
        + "existe, pero es otra ecuación y aparece en el ejercicio 4.10.",
    },
    {
      enunciado: "Con \\(m=1\\) el algoritmo para en 4 barridos y con \\(m=\\infty\\) en 178. "
        + "¿Significa eso que la iteración de valor es siempre mejor?",
      opciones: [
        "No: en este tablero sí, pero el libro dice que no está claro cuál de las dos es mejor en "
          + "general.",
        "Sí: truncar la evaluación siempre reduce el trabajo total.",
        "Sí, porque la iteración de valor no necesita evaluar ninguna política.",
        "No, porque la iteración de valor no garantiza encontrar la política óptima.",
      ],
      correcta: 0,
      explicacion: "Las dos convergen a la política óptima, así que la garantía no las distingue. "
        + "La ventaja de 4 frente a 178 es de este tablero, donde la evaluación de la política "
        + "equiprobable es lentísima y la propagación del \\(\\max\\) es inmediata. El libro es "
        + "deliberadamente cauto: dice que las dos se usan mucho y que no está claro cuál es "
        + "mejor en general. Ojo: la diapositiva de clase afirma algo más fuerte que el libro "
        + "sobre este punto, y está señalado en la página.",
    },
    {
      enunciado: "En la caja de <em>Value Iteration</em>, ¿dónde aparece la política?",
      opciones: [
        "Solo al final, en una única extracción \\(\\pi(s)=\\arg\\max_a\\ldots\\) después de "
          + "salir del bucle.",
        "En cada barrido, porque el \\(\\max\\) equivale a hacer la política greedy.",
        "En la inicialización, como \\(\\pi_0\\) arbitraria.",
        "No aparece nunca: la iteración de valor devuelve solo \\(V\\).",
      ],
      correcta: 0,
      explicacion: "Dentro del bucle no hay ninguna política almacenada: el \\(\\max\\) está "
        + "<strong>dentro</strong> de la actualización de \\(V\\). La política se construye una "
        + "sola vez, al salir. Que el \\(\\max\\) “sea” una mejora greedy es una lectura correcta "
        + "del algoritmo, pero no significa que exista una variable \\(\\pi\\) que se vaya "
        + "actualizando, y confundir las dos cosas es justo lo que lleva a pensar que la "
        + "iteración de valor es “evaluar la política greedy”.",
    },
  ], { claves: "t3.m5.quiz" });
}

/* ======================================================================= *
 * MÓDULO 6 — GPI: las dos rectas
 * ======================================================================= */

function modulo6() {
  const zonaDiagrama = $("#m6-diagrama");
  const zonaResiduos = $("#m6-residuos");
  const zonaNota = $("#m6-nota");

  /* La escala común de las tres trayectorias: 1,1 es el máximo de e observado
     (1,074), redondeado hacia arriba. Fijarla es lo que las hace comparables. */
  const ESCALA = 1.1;
  const TIPOS = ["politica", "valor", "caotica"];
  let trayectorias = {};

  function calcular() {
    trayectorias = {};
    for (const tipo of TIPOS) {
      trayectorias[tipo] = trayectoriaGPI(mdp, GAMMA, {
        tipo, rng: generador(semillaActual()),
      });
    }
  }

  let tipo = "politica";
  let hasta = 0;
  let superponer = false;
  let temporizador = null;

  const colorDe = (t2) => tono(COLORES_SERIE[TIPOS.indexOf(t2)]);
  const normalizar = (puntos) => puntos.map((p) => ({
    etiqueta: p.etiqueta,
    u: Math.min(p.e / ESCALA, 1),
    w: Math.min(p.g / ESCALA, 1),
  }));

  const nombreTipo = (t2) => ({
    politica: t("t3.m6.trPolitica", "Iteración de política"),
    valor: t("t3.m6.trValor", "Iteración de valor"),
    caotica: t("t3.m6.trCaotica", "Caótica (asíncrona)"),
  }[t2]);

  function dibujarDiagrama() {
    const lista = superponer
      ? TIPOS.map((t2) => ({
        nombre: nombreTipo(t2), color: colorDe(t2),
        puntos: normalizar(trayectorias[t2]),
      }))
      : [{
        nombre: nombreTipo(tipo), color: colorDe(tipo),
        puntos: normalizar(trayectorias[tipo]), hasta,
      }];

    zonaDiagrama.replaceChildren(diagramaDosRectas(lista, {
      /* Este diagrama es el que se proyecta y se comenta en clase: escalable
         para que en modo clase se estire y sus rótulos crezcan con él. */
      ancho: 600, alto: 300, escalable: true,
      rotulos: {
        sup: t("t3.m6.rectaSup", "v = v<sub>π</sub>"),
        supGlosa: t("t3.m6.rectaSupGlosa", "evalúa la política"),
        inf: t("t3.m6.rectaInf", "π = greedy(v)"),
        infGlosa: t("t3.m6.rectaInfGlosa", "mejora la política"),
        vertice: t("t3.m6.vertice", "v<sub>*</sub>, π<sub>*</sub>"),
        inicio: t("t3.m6.inicio", "v, π"),
      },
      mensaje: t("t3.m6.vacio", "Elige una trayectoria y pulsa “Un paso” o “Reproducir”."),
    }));
    conLeyenda(zonaDiagrama, lista.map((x) => ({ nombre: x.nombre, color: x.color })));
  }

  function dibujarResiduos() {
    const puntos = trayectorias[tipo];
    const p = puntos[Math.min(hasta, puntos.length - 1)];
    const barra = (texto, valor) => `
      <p class="suave">${texto}</p>
      <div class="barra-progreso"><i style="width:${Math.min(100, (valor / ESCALA) * 100)}%"></i></div>`;
    zonaResiduos.innerHTML = barra(
      t("t3.m6.residuoE", "Distancia a “v = v<sub>π</sub>”: e = {valor}", { valor: num(p.e, 3) }), p.e,
    ) + barra(
      t("t3.m6.residuoG", "Distancia a “π = greedy(v)”: g = {valor}", { valor: num(p.g, 3) }), p.g,
    );
  }

  function dibujarMetricas() {
    const puntos = trayectorias[tipo];
    $("#m6-paso-n").textContent = t("t3.m6.pasoDe", "{i} de {n}", {
      i: hasta, n: puntos.length - 1,
    });
    const etiqueta = puntos[Math.min(hasta, puntos.length - 1)].etiqueta;
    $("#m6-fase").textContent = {
      inicio: t("t3.m6.faseInicio", "punto de partida"),
      E: t("t3.m6.faseE", "evaluación"),
      I: t("t3.m6.faseI", "mejora"),
      A: t("t3.m6.faseA", "actualización de un solo estado"),
    }[etiqueta];
  }

  function dibujarNota() {
    const puntos = trayectorias[tipo];
    const ultimo = puntos[puntos.length - 1];
    const noConverge = tipo === "caotica" && (ultimo.e > 1e-9 || ultimo.g > 1e-9);
    let html;
    if (noConverge) {
      html = t("t3.m6.topeCaos", "2000 actualizaciones sin converger. Prueba otra semilla.");
    } else if (tipo === "politica") {
      html = t("t3.m6.notaPolitica",
        "Iteración de política: <strong>cada paso completa uno de los dos objetivos</strong>. La "
        + "evaluación lleva el punto <strong>exactamente</strong> hasta la recta de arriba "
        + "(\\(e=0\\)) y la mejora, <strong>exactamente</strong> hasta la de abajo (\\(g=0\\)). "
        + "Zigzag de amplitud decreciente hasta el vértice, en tres tramos. <strong>Ésta es la "
        + "única trayectoria que el libro dibuja y describe.</strong>");
    } else if (tipo === "valor") {
      html = t("t3.m6.notaValor",
        "Iteración de valor: <strong>ningún paso completa nada</strong>. Cada barrido mejora un "
        + "poco y evalúa un poco, así que el punto avanza hacia el vértice sin llegar a tocar las "
        + "rectas más que al final. Es la lectura de la asignatura de la frase del libro sobre "
        + "“pasos más pequeños e incompletos”: <strong>interpretación, no cita</strong>.");
    } else {
      html = t("t3.m6.notaCaotica",
        "Caótica: aquí no hay barridos completos. En cada paso se elige <strong>un solo estado al "
        + "azar</strong> y se le aplica, también al azar, o una actualización de evaluación o una "
        + "de mejora. El recorrido se aleja tanto como se acerca —hay pasos en los que "
        + "<strong>los dos</strong> residuos crecen— y aun así acaba en el vértice. Eso es "
        + "programación dinámica <strong>asíncrona</strong> (§4.5 del libro), y es la mejor "
        + "intuición disponible de lo que harán los métodos del Tema 4, donde ni siquiera se "
        + "sabrá el modelo.");
    }
    zonaNota.innerHTML = html;
    renderizarMatematicas(zonaNota);
  }

  function dibujar() {
    dibujarDiagrama();
    dibujarResiduos();
    dibujarMetricas();
    dibujarNota();
    $("#m6-semilla").textContent = t("t3.m6.semilla",
      "Semilla {n} · solo la trayectoria caótica es aleatoria; las tres son ejecuciones únicas, "
      + "no medias.", { n: semillaActual() });
  }

  function detener() {
    if (temporizador) clearInterval(temporizador);
    temporizador = null;
  }

  grupoRadio($("#m6-trayectoria"),
    TIPOS.map((t2) => ({ valor: t2, texto: nombreTipo(t2) })),
    tipo,
    (valor) => { detener(); tipo = valor; hasta = 0; dibujar(); });

  $("#m6-paso").addEventListener("click", () => {
    detener();
    hasta = Math.min(hasta + 1, trayectorias[tipo].length - 1);
    dibujar();
  });

  $("#m6-reproducir").addEventListener("click", () => {
    detener();
    hasta = 0;
    dibujar();
    temporizador = setInterval(() => {
      if (hasta >= trayectorias[tipo].length - 1) { detener(); return; }
      hasta++;
      dibujar();
    }, 120);
  });

  $("#m6-reiniciar").addEventListener("click", () => { detener(); hasta = 0; dibujar(); });

  $("#m6-superponer").addEventListener("change", (ev) => {
    detener();
    superponer = ev.target.checked;
    dibujar();
  });

  oyentesSemilla.push(() => { detener(); calcular(); hasta = 0; dibujar(); });

  calcular();
  dibujar();
  repintadores.push(dibujar);

  crearQuiz($("#m6-quiz"), [
    {
      enunciado: "En el diagrama, ¿qué representan las flechas que dibuja Sutton &amp; Barto?",
      opciones: [
        "La iteración de política: cada flecha lleva el sistema hasta completar uno de los dos "
          + "objetivos.",
        "La GPI en general, sin referirse a ningún algoritmo concreto.",
        "La iteración de valor, que da pasos cortos.",
        "La trayectoria de un método de aprendizaje por refuerzo sin modelo.",
      ],
      correcta: 0,
      explicacion: "El texto que acompaña al diagrama lo dice con esas palabras: las flechas "
        + "corresponden al comportamiento de la iteración de política, porque cada una alcanza "
        + "por completo uno de los dos objetivos. Sobre los métodos que dan pasos incompletos el "
        + "libro solo dice que <strong>también se pueden dar</strong>, sin dibujarlos ni "
        + "atribuirlos a nadie. Las otras dos trayectorias de este módulo son interpretación de "
        + "la asignatura, y así está rotulado en pantalla.",
    },
    {
      enunciado: "¿Por qué la trayectoria caótica acaba en el vértice a pesar de alejarse de él a "
        + "ratos?",
      opciones: [
        "Porque sigue actualizando todos los estados: los dos procesos avanzan, aunque sea de "
          + "forma desordenada, y solo se estabilizan a la vez cuando se cumple la ecuación de "
          + "optimalidad de Bellman.",
        "Porque el azar se compensa a la larga y el error medio tiende a cero.",
        "Porque cada actualización de un solo estado reduce siempre al menos uno de los dos "
          + "residuos.",
        "Porque la semilla está elegida para que converja.",
      ],
      correcta: 0,
      explicacion: "La condición que exige el libro a la programación dinámica asíncrona es no "
        + "abandonar ningún estado: hay que seguir actualizándolos todos. Cumplido eso, los dos "
        + "procesos solo pueden quedarse quietos cuando la función de valor es consistente con la "
        + "política <strong>y</strong> la política es greedy respecto a ella, que es la ecuación "
        + "de optimalidad. No es una compensación estadística, y desde luego no es cosa de la "
        + "semilla: se puede comprobar cambiándola. Y no es cierto que cada actualización reduzca "
        + "algún residuo: en la propia trayectoria hay pasos en que los dos crecen.",
    },
    {
      enunciado: "Un punto está exactamente sobre la recta \\(v=v_\\pi\\) pero no sobre la otra. "
        + "¿Qué significa?",
      opciones: [
        "Que la función de valor es exacta para la política actual, pero esa política no es "
          + "greedy respecto a ella: queda mejora por hacer.",
        "Que la política ya es óptima y solo falta afinar los valores.",
        "Que el algoritmo se ha quedado bloqueado.",
        "Que la política es greedy pero los valores están mal.",
      ],
      correcta: 0,
      explicacion: "Estar sobre \\(v=v_\\pi\\) es haber completado una evaluación: \\(V\\) es "
        + "exactamente la función de valor de \\(\\pi\\). Que no esté sobre la otra recta "
        + "significa que en algún estado hay una acción con valor mayor que la que \\(\\pi\\) "
        + "elige, es decir, que el operador greedy todavía tiene trabajo. Es justo la situación "
        + "de partida del teorema de mejora, y también la que hace que el zigzag de la iteración "
        + "de política tenga otro tramo por delante.",
    },
  ], { claves: "t3.m6.quiz" });
}

/* ======================================================================= *
 * Arranque
 * ======================================================================= */

modulo1();
modulo2();
modulo3();
modulo4();
modulo5();
modulo6();
renderizarMatematicas();
