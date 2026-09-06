/* ==========================================================================
   RL · IMAT — Tema 4: aprendizaje por refuerzo sin modelo
   Comportamiento de los cuatro módulos de tema4.html y de las figuras
   estáticas de los bloques de estudio.

   Motor separado de interfaz: toda la matemática vive en assets/sinmodelo.js
   (que no toca el DOM y se testea desde node) y en assets/mdp.js. Aquí solo se
   pinta y se escucha.

   El único cálculo que pasa de ~2 s —el modo por lotes del módulo 2— va a
   assets/sinmodelo-worker.js con barra de progreso, y se cachea por semilla.
   ========================================================================== */

import {
  iniciarPagina, rejilla, graficaLineas, cadenaBackup, crearQuiz, pintar,
  num, numMat, tono, el, textoSvg, textoSobre, colorCalor, generador,
  argmaxTodos, alCambiarTema, renderizarMatematicas, leyenda, deslizador,
  defsPunta, COLORES_SERIE,
} from "./nucleo.js";

import { t } from "./i18n.js";

import {
  rejilla3x3, ACCIONES_3X3, ACCIONES_NAV, politicaEquiprobable, evaluarLineal, qDeV,
} from "./mdp.js";

import {
  rejilla3x3Permutada, paseoAleatorio, cliffWalking, windyGridworld, VIENTO,
  mdpDosEstados, IZQUIERDA, prediccionTD, curvaRMS, errorRMS, resolverPredictor,
  sarsa, qLearning, expectedSarsa, qLearningDoble, politicaGreedyDe, seguirPolitica,
  mediaMovil, esperanzaDelMaximo,
} from "./sinmodelo.js";

iniciarPagina();

/* ======================================================================= *
 * 0. Utilidades comunes
 * ======================================================================= */

const $ = (sel) => document.querySelector(sel);

/** Repintar los SVG cuando cambia el tema (llevan colores ya resueltos). */
const repintadores = [];
alCambiarTema(() => repintadores.forEach((fn) => fn()));

/* --- semilla de la página ---------------------------------------------- */

const entradaSemilla = $("#semilla");
const oyentesSemilla = [];
const semillaActual = () => {
  const n = parseInt(entradaSemilla.value, 10);
  return Number.isFinite(n) && n > 0 ? n : 2026;
};
entradaSemilla.addEventListener("change", () => oyentesSemilla.forEach((fn) => fn()));

/* --- nombres de acción (identificadores del motor, presentación traducida) --- */

/** ACCIONES_3X3 = arriba/abajo/izq/dch; se reutilizan las claves del Tema 2. */
const nombreAccion = (id) => t(`t2.accion.${id}`, id);
/** ACCIONES_NAV = N/S/O/E; en inglés da N/S/W/E. */
const nombreDir = (d) => t(`t2.dir.${d}`, d);

/** Glifos de flecha para el texto plano (tablas y rótulos). */
const FLECHA_3X3 = { arriba: "↑", abajo: "↓", izq: "←", dch: "→" };
/** `rejilla()` dibuja flechas con las claves N/S/O/E; la rejilla 3×3 no las usa. */
const DIR_3X3 = { arriba: "N", abajo: "S", izq: "O", dch: "E" };

/* --- construcción de interfaz ------------------------------------------ */

/** Caja `.viz` con su título; devuelve el cuerpo donde va la visualización. */
function caja(zona, tituloHtml) {
  const div = document.createElement("div");
  div.className = "viz";
  if (tituloHtml) {
    const p = document.createElement("p");
    p.className = "viz-titulo";
    p.innerHTML = tituloHtml;
    div.appendChild(p);
    renderizarMatematicas(p);
  }
  const cuerpo = document.createElement("div");
  div.appendChild(cuerpo);
  zona.appendChild(div);
  return cuerpo;
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

/** Fila `.controles` vacía. */
function panelControles(zona) {
  const div = document.createElement("div");
  div.className = "controles";
  zona.appendChild(div);
  return div;
}

/**
 * Control con deslizador y su valor al lado.
 *
 * `alCambiar` se dispara en cada movimiento (es barato: solo rotula y guarda
 * el valor); `alSoltar` en el evento `change`, que es donde van los cálculos
 * caros de los módulos 3 y 4.
 */
function controlDeslizador(panel, opciones) {
  const {
    etiqueta, min, max, paso = 1, valor,
    formato = (v) => String(v), alCambiar = () => {}, alSoltar = null,
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
  if (alSoltar) input.addEventListener("change", () => alSoltar(parseFloat(input.value)));

  return {
    input,
    fijar(v) {
      input.value = String(v);
      salida.textContent = formato(v);
    },
  };
}

/**
 * Grupo de botones que se comporta como un grupo de radio.
 *
 * `op.html` marca los rótulos que llevan notación —«v<sub>π</sub>»— y que por
 * tanto no se pueden volcar con textContent. Solo se usa con cadenas nuestras.
 */
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
function botonControl(panel, etiqueta, alPulsar, { primario = false } = {}) {
  const div = document.createElement("div");
  div.className = "control";
  const label = document.createElement("label");
  label.innerHTML = "&nbsp;";
  const b = document.createElement("button");
  b.type = "button";
  if (primario) b.className = "primario";
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

/** Leyenda de series con sus fórmulas ya tipografiadas por KaTeX. */
function conLeyenda(zona, series) {
  const bloque = leyenda(series);
  zona.appendChild(bloque);
  renderizarMatematicas(bloque);
}

/**
 * Color de texto legible sobre un fondo dado.
 *
 * `textoSobre()` espera "rgb(...)"; los tokens semánticos del tema llegan en
 * hexadecimal, así que se convierten antes.
 */
function textoContraste(color) {
  if (!color || !color.startsWith("#")) return textoSobre(color || "");
  const limpio = color.slice(1);
  const completo = limpio.length === 3 ? limpio.split("").map((c) => c + c).join("") : limpio;
  const n = parseInt(completo, 16);
  return textoSobre(`rgb(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255})`);
}

/** Mapa de calor de un valor dentro de [minimo, maximo]. */
function colorDeValor(v, minimo, maximo) {
  if (!Number.isFinite(v)) return tono("--superficie");
  const rango = maximo - minimo;
  return colorCalor(rango > 1e-12 ? (v - minimo) / rango : 0.5);
}

/** Serie horizontal de referencia: `graficaLineas` solo anota en vertical. */
function referencia(nombre, valor, x, color) {
  return { nombre, color, x, y: x.map(() => valor), discontinua: true, grosor: 1.4 };
}

/* ======================================================================= *
 * MÓDULO 1 — de v a q: lo que el modelo hacía por ti
 * ======================================================================= */

function modulo1() {
  const zonaControles = $("#m1-controles");
  const zonaRejilla = $("#m1-rejilla");
  const zonaDerivacion = $("#m1-derivacion");
  const zonaVeredicto = $("#m1-veredicto");
  const zonaContra = $("#m1-contraejemplo");

  const GAMMA = 1;
  const LADO = 84;
  const MARGEN = 26;

  /* Los dos entornos del contraejemplo. B es A con las acciones «abajo» e
     «izq» del estado 3 (índice 2) intercambiadas: nada más. */
  const entornoA = rejilla3x3();
  const entornoB = rejilla3x3Permutada();

  const vA = evaluarLineal(entornoA, politicaEquiprobable(entornoA), GAMMA);
  const vB = evaluarLineal(entornoB, politicaEquiprobable(entornoB), GAMMA);

  if (!vA || !vB) {
    zonaVeredicto.textContent = t("t4.m1.sinDatos",
      "No se ha podido resolver el sistema de Bellman para esta política.");
    return;
  }

  const qA = qDeV(entornoA, vA, GAMMA);
  const qB = qDeV(entornoB, vB, GAMMA);
  const diferenciaMax = Math.max(...vA.map((x, i) => Math.abs(x - vB[i])));

  const NO_TERMINALES = vA.map((_, s) => s).filter((s) => !entornoA.esTerminal(s));
  const V_MIN = Math.min(...vA);
  const Q_MIN = Math.min(...NO_TERMINALES.flatMap((s) => qA[s]));

  let tabla = "v";
  let conModelo = false;
  let s = 2;                    // el estado rotulado «3»
  let marcarTabla = () => {};
  let marcarModelo = () => {};
  let selector = null;

  /* --- textos de encuadre y controles --- */

  parrafo(zonaControles, "explicacion", t("t4.m1.explicacion",
    "Tienes el gridworld 3×3 del tema y la política equiprobable. Los números son exactos, "
    + "no estimados. La pregunta es una sola: <strong>con lo que hay en la mano, ¿puedes decir "
    + "qué acción es la mejor en el estado elegido?</strong> Cambia la tabla y quita el modelo, "
    + "y mira qué le pasa a la expresión de la derecha."));

  const panel = panelControles(zonaControles);

  marcarTabla = grupoRadio(panel, t("t4.m1.tablaLabel", "Qué tabla tienes"), [
    { valor: "v", texto: t("t4.m1.tablaV", "v<sub>π</sub>(s)"), html: true },
    { valor: "q", texto: t("t4.m1.tablaQ", "q<sub>π</sub>(s,a)"), html: true },
  ], tabla, (valor) => { tabla = valor; dibujar(); });

  marcarModelo = grupoRadio(panel, t("t4.m1.modeloLabel", "¿Conoces \\(p(s',r\\mid s,a)\\)?"), [
    { valor: true, texto: t("t4.m1.modeloSi", "Sí") },
    { valor: false, texto: t("t4.m1.modeloNo", "No") },
  ], conModelo, (valor) => { conModelo = valor; dibujar(); });

  {
    const div = document.createElement("div");
    div.className = "control";
    const label = document.createElement("label");
    label.className = "literal";
    label.innerHTML = `${t("t4.m1.estadoLabel", "Estado")} <span class="suave">${
      t("t4.m1.oPulsa", "— o pulsa una celda")}</span>`;
    selector = document.createElement("select");
    for (const x of NO_TERMINALES) {
      const op = document.createElement("option");
      op.value = String(x);
      op.textContent = entornoA.etiquetas[x];
      selector.appendChild(op);
    }
    selector.value = String(s);
    selector.addEventListener("change", () => { s = Number(selector.value); dibujar(); });
    div.append(label, selector);
    panel.appendChild(div);
  }

  botonControl(panel, t("t4.m1.reiniciar", "Reiniciar"), () => {
    tabla = "v";
    conModelo = false;
    s = 2;
    marcarTabla("v");
    marcarModelo(false);
    dibujar();
  });

  parrafo(zonaControles, "explicacion nota", t("t4.m1.gamma",
    "\\(\\gamma = 1\\) (fijo, es el enunciado del gridworld)."));

  const cuerpoRejilla = caja(zonaRejilla, t("t4.m1.viz1v",
    "Valores de estado \\(v_\\pi(s)\\)"));
  const tituloRejilla = zonaRejilla.querySelector(".viz-titulo");

  /* La derivación NO va dentro de una caja `.viz`: no es una visualización, y
     sobre el fondo de la caja las casillas `.incognita` —que son el recurso
     expresivo del módulo— apenas se distinguen. */
  const tituloDeriv = parrafo(zonaDerivacion, "viz-titulo", "");
  const cuerpoDeriv = document.createElement("div");
  zonaDerivacion.appendChild(cuerpoDeriv);

  /* --- flechas de la dinámica, superpuestas al SVG de `rejilla()` --------
     `rejilla()` no dibuja hoy transiciones hacia los vecinos y no hace falta
     añadírselas: se le cuelga un <g> extra desde aquí (ver §C2 del guion).
     Solo se pintan en la vista v_π: en la vista q_π la celda está ocupada por
     las cuatro cuñas, y además el mensaje de esa vista es justamente que el
     modelo no interviene, así que el conmutador no debe cambiar nada. */
  function flechasDinamica(svg, mdp) {
    const color = tono("--texto-suave");
    const punta = defsPunta(svg, color);
    const delta = { arriba: [0, -1], abajo: [0, 1], izq: [-1, 0], dch: [1, 0] };
    const g = el("g", { opacity: 0.8 });

    for (let x = 0; x < mdp.nEstados; x++) {
      if (mdp.esTerminal(x)) continue;
      const { fila, col } = mdp.geometria.posicion(x);
      const cx = MARGEN + col * LADO + LADO / 2;
      const cy = MARGEN + fila * LADO + LADO / 2;
      ACCIONES_3X3.forEach((nombre, a) => {
        const [dx, dy] = delta[nombre];
        const destino = mdp.P[x][a][0].s2;
        if (destino === x) {
          /* Rebote contra el contorno: lazo que sale y vuelve a la celda. */
          const px = -dy;
          const py = dx;
          const r = LADO * 0.07;
          const largo = LADO * 0.30;
          const x0 = cx + px * r + dx * LADO * 0.28;
          const y0 = cy + py * r + dy * LADO * 0.28;
          const x1 = cx - px * r + dx * LADO * 0.28;
          const y1 = cy - py * r + dy * LADO * 0.28;
          g.appendChild(el("path", {
            d: `M${x0} ${y0} C${x0 + dx * largo} ${y0 + dy * largo} `
              + `${x1 + dx * largo} ${y1 + dy * largo} ${x1} ${y1}`,
            fill: "none", stroke: color, "stroke-width": 1.5,
            "marker-end": `url(#${punta})`,
          }));
        } else {
          g.appendChild(el("line", {
            x1: cx + dx * LADO * 0.30, y1: cy + dy * LADO * 0.30,
            x2: cx + dx * LADO * 0.44, y2: cy + dy * LADO * 0.44,
            stroke: color, "stroke-width": 1.5, "marker-end": `url(#${punta})`,
          }));
        }
      });
    }
    svg.appendChild(g);
  }

  function dibujarRejilla() {
    const celdas = [];
    for (let x = 0; x < entornoA.nEstados; x++) {
      const terminal = entornoA.esTerminal(x);
      const base = {
        ...entornoA.geometria.posicion(x),
        titulo: terminal
          ? t("t4.m1.celdaT", "Estado terminal (T)")
          : t("t4.m1.celdaN", "Estado {e}", { e: entornoA.etiquetas[x] }),
        atenuada: terminal,
      };
      if (terminal) {
        celdas.push({
          ...base, etiqueta: entornoA.etiquetas[x], tamano: 15,
          color: tono("--superficie-3"),
        });
        continue;
      }
      if (tabla === "v") {
        const color = colorDeValor(vA[x], V_MIN, 0);
        celdas.push({
          ...base,
          etiqueta: entornoA.etiquetas[x],
          subetiqueta: num(vA[x], 2),
          tamano: 13,
          mono: true,
          color,
          textoColor: textoContraste(color),
        });
      } else {
        const mejores = argmaxTodos(qA[x]);
        const cunas = ACCIONES_3X3.map((_, a) => {
          const color = colorDeValor(qA[x][a], Q_MIN, 0);
          return {
            texto: num(qA[x][a], 1),
            color,
            textoColor: textoContraste(color),
            mejor: mejores.includes(a),
          };
        });
        celdas.push({
          ...base, etiqueta: null, esquina: entornoA.etiquetas[x], cunas,
          color: tono("--superficie"),
        });
      }
    }

    const svg = rejilla({
      celdas,
      lado: LADO,
      seleccion: s,
      alSeleccionar: (indice) => {
        if (entornoA.esTerminal(indice)) return;      // la celda T ignora el clic
        s = indice;
        if (selector) selector.value = String(s);
        dibujar();
      },
    });
    if (conModelo && tabla === "v") flechasDinamica(svg, entornoA);
    pintar(cuerpoRejilla, svg);

    tituloRejilla.innerHTML = tabla === "v"
      ? t("t4.m1.viz1v", "Valores de estado \\(v_\\pi(s)\\)")
      : t("t4.m1.viz1q", "Valores de acción \\(q_\\pi(s,a)\\)");
    renderizarMatematicas(tituloRejilla);
  }

  function dibujarDerivacion() {
    const mejores = argmaxTodos(qA[s]);
    const incognita = (texto) => `<span class="incognita">${texto}</span>`;
    const filas = ACCIONES_3X3.map((nombre, a) => {
      const destino = entornoA.P[s][a][0].s2;
      const rebota = destino === s;
      const marca = rebota
        ? ` <span class="suave">${t("t4.m1.rebote", "(rebota: s′ = s)")}</span>`
        : "";
      const accion = `${FLECHA_3X3[nombre]} ${nombreAccion(nombre)}${marca}`;

      let expresion;
      let resultado;
      if (tabla === "q") {
        expresion = `q<sub>π</sub>(${entornoA.etiquetas[s]}, ${nombreAccion(nombre)})`;
        resultado = num(qA[s][a], 2);
      } else if (conModelo) {
        expresion = "Σ<sub>s′,r</sub> p(s′,r | s,a) · [ r + γ·v<sub>π</sub>(s′) ]"
          + ` = 1 · [ −1 + v<sub>π</sub>(${entornoA.etiquetas[destino]}) ]`
          + ` = −1 + (${num(vA[destino], 2)})`;
        resultado = num(qA[s][a], 2);
      } else {
        expresion = `Σ<sub>s′,r</sub> ${incognita("p(s′,r | s,a)")}`
          + ` · [ r + γ·v<sub>π</sub>(${incognita("s′")}) ]`;
        resultado = incognita("?");
      }
      const negrita = tabla !== "v" || conModelo ? mejores.includes(a) : false;
      return `<tr${negrita ? ' class="destacada"' : ""}>`
        + `<td>${accion}</td><td>${expresion}</td>`
        + `<td>${negrita ? `<strong>${resultado}</strong>` : resultado}</td></tr>`;
    }).join("");

    cuerpoDeriv.innerHTML = `<div class="derivacion"><table class="datos texto"><thead><tr>`
      + `<th>${t("t4.m1.thAccion", "Acción")}</th>`
      + `<th>${t("t4.m1.thExpr", "Expresión")}</th>`
      + `<th>${t("t4.m1.thRes", "Resultado")}</th>`
      + `</tr></thead><tbody>${filas}</tbody></table></div>`;

    tituloDeriv.innerHTML = t("t4.m1.derivTitulo", "Qué habría que calcular en el estado {s}",
      { s: entornoA.etiquetas[s] });
    renderizarMatematicas(zonaDerivacion);
  }

  function dibujarVeredicto() {
    const mejores = argmaxTodos(qA[s]);
    const listaAcciones = mejores.map((a) => nombreAccion(ACCIONES_3X3[a])).join(", ");
    let html;
    if (tabla === "q") {
      html = t("t4.m1.verQ",
        "\\(\\pi({s}) = \\arg\\max_a q_\\pi({s},a) = \\) <strong>{acciones}</strong>. Un "
        + "\\(\\arg\\max\\) sobre cuatro números y nada más. <strong>Da igual si conoces "
        + "\\(p\\) o no</strong>: prueba a cambiar el conmutador y fíjate en que no cambia "
        + "nada. Ésta es la ecuación (5.1), y es la razón de que todo el tema estime "
        + "\\(q\\).", { s: entornoA.etiquetas[s], acciones: listaAcciones });
    } else if (conModelo) {
      html = t("t4.m1.verVconP",
        "Con el modelo sí se puede: \\(\\pi({s}) = \\arg\\max_a \\sum_{s',r} p(s',r\\mid s,a)"
        + "[r+\\gamma v_\\pi(s')] = \\) <strong>{acciones}</strong>. Esto es exactamente lo "
        + "que hacía la mejora de la política del Tema 3, y por eso allí bastaba con "
        + "\\(v\\).", { s: entornoA.etiquetas[s], acciones: listaAcciones });
    } else {
      html = t("t4.m1.verVsinP",
        "<strong>No se puede.</strong> Para pasar de \\(v_\\pi\\) a una política hace falta "
        + "saber a dónde lleva cada acción, y eso es exactamente \\(p(s',r\\mid s,a)\\). Sin "
        + "ese factor, las cuatro expresiones se quedan en “?”. Baja al contraejemplo: hay "
        + "<strong>dos entornos distintos</strong> con estos mismos nueve números y "
        + "respuestas distintas.");
    }
    if (mejores.length > 1 && !(tabla === "v" && !conModelo)) {
      html += ` ${t("t4.m1.verEmpate",
        "Aquí hay <strong>{n} acciones empatadas</strong> en el máximo. El \\(\\arg\\max\\) "
        + "devuelve un conjunto, no una acción: cualquiera de ellas sirve, y el pseudocódigo "
        + "del libro dice “empates deshechos arbitrariamente”.", { n: mejores.length })}`;
    }
    zonaVeredicto.innerHTML = html;
    renderizarMatematicas(zonaVeredicto);
  }

  /* --- contraejemplo: dos rejillas con la misma v_π ---------------------- */

  function rejillaContra(valores, accionVerde) {
    const celdas = [];
    for (let x = 0; x < entornoA.nEstados; x++) {
      const terminal = entornoA.esTerminal(x);
      const color = terminal ? tono("--superficie-3") : colorDeValor(valores[x], V_MIN, 0);
      celdas.push({
        ...entornoA.geometria.posicion(x),
        esquina: entornoA.etiquetas[x],
        etiqueta: terminal ? entornoA.etiquetas[x] : num(valores[x], 2),
        tamano: 12,
        mono: true,
        color,
        textoColor: terminal ? null : textoContraste(color),
        atenuada: terminal,
        flechas2: x === 2 ? [DIR_3X3[accionVerde]] : null,
        colorFlecha2: tono("--exito"),
      });
    }
    return rejilla({ celdas, lado: 62 });
  }

  function dibujarContraejemplo() {
    zonaContra.innerHTML = "";
    parrafo(zonaContra, "viz-titulo", t("t4.m1.ceTitulo",
      "Dos entornos con la misma \\(v_\\pi\\)"));
    parrafo(zonaContra, "explicacion", t("t4.m1.ceTexto",
      "El entorno <strong>B</strong> es idéntico al <strong>A</strong> salvo en el estado "
      + "<strong>3</strong>, donde las acciones <em>abajo</em> e <em>izquierda</em> llevan "
      + "intercambiadas: en A, <em>abajo</em> va al 6 e <em>izquierda</em> al 2; en B, al "
      + "revés. Como la política es <strong>equiprobable</strong>, permutar las etiquetas de "
      + "las acciones de un estado <strong>no cambia la distribución del estado "
      + "siguiente</strong>, y por tanto <strong>no cambia \\(v_\\pi\\) en ningún "
      + "estado</strong>. Compruébalo: las dos tablas de nueve números son idénticas. Y sin "
      + "embargo la acción greedy en el estado 3 es <strong>abajo</strong> en A y "
      + "<strong>izquierda</strong> en B."));

    const dos = document.createElement("div");
    dos.className = "dos-columnas";
    zonaContra.appendChild(dos);

    for (const panelDatos of [
      { titulo: t("t4.m1.cePanelA", "Entorno A"), v: vA, accion: "abajo" },
      { titulo: t("t4.m1.cePanelB", "Entorno B"), v: vB, accion: "izq" },
    ]) {
      const col = document.createElement("div");
      dos.appendChild(col);
      const cuerpo = caja(col, panelDatos.titulo);
      pintar(cuerpo, rejillaContra(panelDatos.v, panelDatos.accion));
      parrafo(cuerpo, "suave", t("t4.m1.ceGreedy", "Acción greedy en el estado 3: {a}",
        { a: `${FLECHA_3X3[panelDatos.accion]} ${nombreAccion(panelDatos.accion)}` }));
    }

    parrafo(zonaContra, "explicacion", t("t4.m1.ceDiferencia",
      "Diferencia máxima entre las dos tablas de \\(v_\\pi\\): <strong>{d}</strong>",
      { d: num(diferenciaMax, 6) }));
    parrafo(zonaContra, "explicacion", t("t4.m1.ceCierre",
      "Eso es la demostración. Una tabla de valores de estado no determina una política: "
      + "hacen falta los valores de acción, o el modelo. La diapositiva lo dice en una línea; "
      + "esto es por qué."));
  }

  function dibujar() {
    dibujarRejilla();
    dibujarDerivacion();
    dibujarVeredicto();
  }

  dibujar();
  dibujarContraejemplo();
  repintadores.push(() => { dibujar(); dibujarContraejemplo(); });

  crearQuiz($("#m1-quiz"), [
    {
      enunciado: "Tienes \\(v_*(s)\\) para todos los estados de un MDP y ningún acceso a "
        + "\\(p(s',r\\mid s,a)\\). ¿Puedes construir una política óptima?",
      opciones: [
        "No: el operador greedy sobre \\(v\\) necesita saber a dónde lleva cada acción, y eso "
          + "es \\(p\\).",
        "Sí, siempre: \\(v_*\\) contiene toda la información del MDP.",
        "Sí, si el MDP es determinista.",
        "No, salvo que \\(\\gamma = 1\\).",
      ],
      correcta: 0,
      explicacion: "El operador greedy sobre valores de estado es \\(\\arg\\max_a \\sum_{s',r} "
        + "p(s',r\\mid s,a)[r+\\gamma v(s')]\\): sin \\(p\\) no se puede evaluar. Que el MDP sea "
        + "determinista no ayuda, porque lo que falta no es la aleatoriedad sino <strong>el "
        + "destino</strong> de cada acción; en el gridworld de esta página las transiciones son "
        + "deterministas y aun así hay dos entornos con la misma \\(v_\\pi\\) y políticas greedy "
        + "distintas. Y \\(\\gamma\\) no tiene nada que ver: el problema es el mismo con "
        + "cualquier descuento.",
    },
    {
      enunciado: "En el módulo, los entornos A y B tienen \\(v_\\pi\\) idéntica en los nueve "
        + "estados. ¿Por qué?",
      opciones: [
        "Porque la política es equiprobable, y permutar las etiquetas de dos acciones de un "
          + "estado no cambia la distribución del estado siguiente.",
        "Porque las dos rejillas tienen las mismas recompensas.",
        "Porque \\(\\gamma = 1\\) y los valores solo dependen de la distancia al terminal.",
        "Es una coincidencia numérica de este ejemplo concreto.",
      ],
      correcta: 0,
      explicacion: "Con \\(\\pi(a\\mid s)=0{,}25\\), la matriz \\(P_\\pi\\) de un estado es la "
        + "media de las cuatro filas de \\(P\\); intercambiar dos de esas filas no cambia la "
        + "media, así que \\(P_\\pi\\) es la misma y el sistema de Bellman también. Que las "
        + "recompensas coincidan es necesario pero no suficiente —cualquier permutación de "
        + "destinos las conserva y no siempre conserva \\(v_\\pi\\), solo lo hace por ser la "
        + "política uniforme—. Y con la política equiprobable los valores <strong>no</strong> "
        + "son la distancia al terminal: \\(v_\\pi(1)=-27\\) mientras que la distancia es 4.",
    },
    {
      enunciado: "En el Tema 3 bastaba con \\(v\\) para mejorar la política. ¿Qué ha cambiado?",
      opciones: [
        "Nada en la teoría: la programación dinámica tenía \\(p\\), y era \\(p\\) lo que "
          + "convertía \\(v\\) en una política.",
        "Que ahora las políticas son estocásticas.",
        "Que \\(v\\) ya no cumple la ecuación de Bellman cuando se estima de la experiencia.",
        "Que el espacio de estados es más grande y \\(v\\) no cabe en memoria.",
      ],
      correcta: 0,
      explicacion: "El operador de mejora del Tema 3 se escribía \\(\\arg\\max_a \\sum_{s',r} "
        + "p(s',r\\mid s,a)[r+\\gamma v(s')]\\), con \\(p\\) dentro. Lo que se pierde ahora es "
        + "exactamente ese factor. La ecuación de Bellman sigue siendo verdad —lo que ocurre es "
        + "que no se puede evaluar—, las políticas estocásticas ya aparecían en el Tema 2, y el "
        + "tamaño del espacio de estados es el problema del Tema 5, no de éste: aquí todo sigue "
        + "siendo tabular.",
    },
  ], { claves: "t4.m1.quiz" });
}

/* ======================================================================= *
 * MÓDULO 2 — Monte Carlo frente a TD(0) en el paseo aleatorio
 * ======================================================================= */

/* Worker del modo por lotes. Si el navegador no lo admite, se calcula aquí
   mismo (la página se congela unos segundos, pero no se queda sin dato). */
let worker = null;
try {
  worker = new Worker(new URL("./sinmodelo-worker.js", import.meta.url), { type: "module" });
} catch {
  worker = null;
}

let siguienteId = 1;
const enCurso = new Map();

if (worker) {
  worker.onmessage = (evento) => {
    const { tipo, id, fraccion, resultado, mensaje } = evento.data;
    const tarea = enCurso.get(id);
    if (!tarea) return;
    if (tipo === "progreso") tarea.alProgresar?.(fraccion);
    else if (tipo === "listo") { enCurso.delete(id); tarea.resolver(resultado); }
    else if (tipo === "error") { enCurso.delete(id); tarea.rechazar(new Error(mensaje)); }
  };
  worker.onerror = () => { worker = null; };
}

/** Lanza el cálculo por lotes en el worker; si no hay worker, aquí mismo. */
function calcularLotes(config, alProgresar) {
  if (!worker) {
    return new Promise((resolver, rechazar) => {
      try {
        const curvaMC = curvaRMS(paseoAleatorio(), { ...config, metodo: "mc", porLotes: true });
        const curvaTD = curvaRMS(paseoAleatorio(), { ...config, metodo: "td", porLotes: true });
        alProgresar(1);
        resolver({
          curvaMC: curvaMC.curva, curvaTD: curvaTD.curva,
          historialMC: null, historialTD: null, ejecuciones: config.ejecuciones,
        });
      } catch (error) {
        rechazar(error);
      }
    });
  }
  const id = siguienteId++;
  return new Promise((resolver, rechazar) => {
    enCurso.set(id, { resolver, rechazar, alProgresar });
    worker.postMessage({ tarea: "lotes", id, config });
  });
}

function modulo2() {
  const zonaControles = $("#m2-controles");
  const zonaValores = $("#m2-valores");
  const zonaRms = $("#m2-rms");
  const zonaMetricas = $("#m2-metricas");
  const zonaPredictor = $("#m2-predictor");

  const entorno = paseoAleatorio();
  const ETIQUETAS = entorno.etiquetas;                 // A … E
  const VERDADEROS = entorno.valoresVerdaderos;
  const EPISODIOS = 100;
  const EJECUCIONES = 100;
  const REPETICIONES_LOTE = 100;
  const ALFAS = [0.01, 0.02, 0.03, 0.04, 0.05, 0.10, 0.15];
  const ALFAS_MC = [0.01, 0.02, 0.03, 0.04];
  const ALFAS_TD = [0.05, 0.10, 0.15];
  const ALPHA_LOTE = 0.002;
  const INSTANTANEAS = [0, 1, 10, 100];
  const RMS_INICIAL = errorRMS(new Array(entorno.nEstados).fill(entorno.valorInicial), VERDADEROS);

  let indiceAlpha = 5;                                  // α = 0,10
  let episodios = 10;
  let modo = "linea";
  const alpha = () => ALFAS[indiceAlpha];

  /* Cachés por semilla: las curvas en línea cuestan ~50 ms y el lote ~14 s. */
  const cacheLinea = new Map();
  const cacheLote = new Map();
  let loteEnCurso = false;
  let errorLote = null;

  let mandoAlpha = null;
  let mandoEpisodios = null;
  let marcarModo = () => {};
  let progreso = null;

  /* --- textos de encuadre, figura del entorno y controles --- */

  parrafo(zonaControles, "explicacion", t("t4.m2.explicacion",
    "Cinco estados en fila, empiezas siempre en el del medio y a cada paso te mueves a "
    + "izquierda o derecha con la misma probabilidad. Ganas <strong>1</strong> si sales por la "
    + "derecha y <strong>0</strong> si sales por la izquierda. Como no hay descuento, <strong>"
    + "el valor verdadero de un estado es la probabilidad de terminar por la derecha desde "
    + "ahí</strong>: \\(1/6, 2/6, 3/6, 4/6, 5/6\\). Los dos métodos ven <strong>exactamente los "
    + "mismos episodios</strong>, generados con la misma semilla: lo único que cambia es la "
    + "regla de actualización."));

  const cuerpoEntorno = caja(zonaControles, t("t4.m2.entorno",
    "El paseo aleatorio de cinco estados (Example 6.2)"));
  pintar(cuerpoEntorno, figuraPaseo());

  const panel = panelControles(zonaControles);

  mandoAlpha = controlDeslizador(panel, {
    etiqueta: t("t4.m2.alphaLabel", "Paso de aprendizaje (\\(\\alpha\\))"),
    min: 0, max: ALFAS.length - 1, paso: 1, valor: indiceAlpha,
    formato: (i) => num(ALFAS[i], 2),
    alCambiar: (i) => { indiceAlpha = i; dibujar(); },
  });

  mandoEpisodios = controlDeslizador(panel, {
    etiqueta: `${t("t4.m2.episodiosLabel", "Episodios")} <span class="suave">${
      t("t4.m2.marcas", "(instantáneas fijas: 0, 1, 10 y 100)")}</span>`,
    min: 0, max: EPISODIOS, paso: 1, valor: episodios,
    formato: (v) => String(v),
    alCambiar: (v) => { episodios = v; dibujar(); },
  });

  marcarModo = grupoRadio(panel, t("t4.m2.modoLabel", "Actualización"), [
    { valor: "linea", texto: t("t4.m2.modoLinea", "en línea") },
    { valor: "lote", texto: t("t4.m2.modoLote", "por lotes") },
  ], modo, (valor) => {
    modo = valor;
    if (modo === "lote") pedirLote();
    dibujar();
  });

  botonControl(panel, t("t4.m2.reiniciar", "Reiniciar"), () => {
    indiceAlpha = 5;
    episodios = 10;
    modo = "linea";
    mandoAlpha.fijar(5);
    mandoEpisodios.fijar(10);
    marcarModo("linea");
    dibujar();
  });

  parrafo(zonaControles, "explicacion nota", t("t4.m2.notaVisitas",
    "Monte Carlo se aplica en modo <em>cada visita</em>: en este paseo los estados se repiten "
    + "constantemente dentro de un episodio. El libro no precisa cuál usa en este experimento."));

  const notaLote = parrafo(zonaControles, "explicacion nota", t("t4.m2.notaAlphaLote",
    "El libro no publica el \\(\\alpha\\) del entrenamiento por lotes; solo dice "
    + "“suficientemente pequeño”. Aquí se usa \\(\\alpha = 0{,}002\\), y no \\(0{,}01\\), "
    + "porque el lote suma los incrementos de todos los episodios vistos y la iteración solo "
    + "es estable si \\(\\alpha\\) por el número de visitas por estado es pequeño: con 100 "
    + "episodios el estado C acumula unas 258 visitas y \\(\\alpha=0{,}01\\) diverge. Con el "
    + "modo por lotes el resultado no depende de \\(\\alpha\\) mientras sea pequeño, que es "
    + "justamente lo que el libro afirma."));

  const cuerpoValores = caja(zonaValores, t("t4.m2.viz1",
    "Valores estimados con TD(0), una sola ejecución"));
  const pieValores = parrafo(zonaValores, "suave", "");

  const cuerpoRms = caja(zonaRms, t("t4.m2.viz2",
    "Error RMS respecto de \\(v_\\pi\\), promediado sobre los cinco estados"));
  const pieRms = parrafo(zonaRms, "suave", "");
  const notaAlpha = parrafo(zonaRms, "explicacion nota", "");

  const cifras = metricas(zonaMetricas, [
    { id: "rms0", etiqueta: t("t4.m2.mRms0", "Error inicial (\\(V \\equiv 0{,}5\\))") },
    { id: "mc", etiqueta: t("t4.m2.mRmsMC", "Error de MC a 100 episodios") },
    { id: "td", etiqueta: t("t4.m2.mRmsTD", "Error de TD a 100 episodios") },
  ]);

  /* --- figura estática del entorno --- */

  function figuraPaseo() {
    const ancho = 660;
    const alto = 132;
    const svg = el("svg", {
      viewBox: `0 0 ${ancho} ${alto}`, width: ancho, height: alto, role: "img",
      style: "max-width:100%;height:auto",
    });
    const linea = tono("--borde-fuerte");
    const texto = tono("--texto");
    const suave = tono("--texto-suave");
    const punta = defsPunta(svg, linea);
    const y = 72;
    const xs = [];
    for (let i = 0; i < 7; i++) xs.push(70 + i * 87);

    /* terminales cuadrados a los extremos, estados circulares en medio */
    for (const [i, etiqueta] of [[0, "0"], [6, "1"]]) {
      svg.appendChild(el("rect", {
        x: xs[i] - 20, y: y - 20, width: 40, height: 40, rx: 4,
        fill: tono("--superficie-3"), stroke: linea, "stroke-width": 1.4,
      }));
      svg.appendChild(el("text", {
        x: xs[i], y: y + 5, "text-anchor": "middle", "font-size": 14,
        "font-weight": 700, fill: suave,
      }, etiqueta));
    }
    for (let s = 0; s < 5; s++) {
      const x = xs[s + 1];
      svg.appendChild(el("circle", {
        cx: x, cy: y, r: 21, fill: tono("--superficie"), stroke: linea, "stroke-width": 1.6,
      }));
      svg.appendChild(el("text", {
        x, y: y + 6, "text-anchor": "middle", "font-size": 16, "font-weight": 700, fill: texto,
      }, ETIQUETAS[s]));
    }
    for (let i = 0; i < 6; i++) {
      const izquierda = xs[i] + 22;
      const derecha = xs[i + 1] - 22;
      svg.appendChild(el("line", {
        x1: izquierda, y1: y, x2: derecha, y2: y,
        stroke: linea, "stroke-width": 1.4,
        "marker-start": `url(#${punta})`, "marker-end": `url(#${punta})`,
      }));
      svg.appendChild(el("text", {
        x: (izquierda + derecha) / 2, y: y - 9, "text-anchor": "middle",
        "font-size": 11, "font-family": "monospace", "font-weight": i === 5 ? 700 : 400,
        fill: i === 5 ? tono("--acento") : suave,
      }, i === 5 ? "r = 1" : "r = 0"));
    }
    svg.appendChild(el("line", {
      x1: xs[3], y1: 30, x2: xs[3], y2: y - 24,
      stroke: tono("--acento"), "stroke-width": 1.6, "marker-end": `url(#${defsPunta(svg, tono("--acento"))})`,
    }));
    svg.appendChild(el("text", {
      x: xs[3], y: 24, "text-anchor": "middle", "font-size": 11.5, "font-weight": 650,
      fill: tono("--acento"),
    }, t("t4.m2.inicio", "inicio")));
    svg.appendChild(textoSvg({
      x: xs[3], y: y + 44, "text-anchor": "middle", "font-size": 11, fill: suave,
    }, t("t4.m2.moneda", "0,5 a cada lado en cada paso · γ = 1")));
    return svg;
  }

  /* --- cálculo --- */

  function curvasEnLinea() {
    const semilla = semillaActual();
    if (!cacheLinea.has(semilla)) {
      const mapa = {};
      for (const a of ALFAS) {
        for (const metodo of ["mc", "td"]) {
          mapa[`${metodo}-${a}`] = curvaRMS(entorno, {
            metodo, alpha: a, episodios: EPISODIOS, ejecuciones: EJECUCIONES, semilla,
          }).curva;
        }
      }
      mapa.historialTD = {};
      cacheLinea.set(semilla, mapa);
    }
    return cacheLinea.get(semilla);
  }

  /** Una sola ejecución de TD(0) con el α elegido, para el panel de valores. */
  function historialTD() {
    const semilla = semillaActual();
    const mapa = curvasEnLinea();
    const clave = String(alpha());
    if (!mapa.historialTD[clave]) {
      mapa.historialTD[clave] = prediccionTD(entorno, {
        alpha: alpha(), episodios: EPISODIOS, rng: generador(semilla),
      }).historial;
    }
    return mapa.historialTD[clave];
  }

  function pedirLote() {
    const semilla = semillaActual();
    if (cacheLote.has(semilla) || loteEnCurso) return;
    loteEnCurso = true;
    errorLote = null;
    dibujar();
    calcularLotes(
      {
        semilla, episodios: EPISODIOS, ejecuciones: REPETICIONES_LOTE, alpha: ALPHA_LOTE,
      },
      (fraccion) => {
        if (progreso) progreso.style.width = `${Math.round(fraccion * 100)}%`;
      },
    ).then((resultado) => {
      cacheLote.set(semilla, resultado);
      loteEnCurso = false;
      dibujar();
    }).catch((error) => {
      loteEnCurso = false;
      errorLote = error.message;
      dibujar();
    });
  }

  /* --- panel de valores estimados --- */

  function dibujarValores() {
    const x = [1, 2, 3, 4, 5];
    const ticksX = ETIQUETAS.map((etiqueta, i) => ({ valor: i + 1, etiqueta }));
    let historial = null;
    if (modo === "linea") historial = historialTD();
    else if (cacheLote.has(semillaActual())) historial = cacheLote.get(semillaActual()).historialTD;

    if (!historial) {
      /* Sin instantáneas hay tres casos: el lote está en marcha, el lote lo ha
         calculado el hilo principal porque este navegador no admite Web
         Workers —y entonces no hay instantáneas que enseñar—, o todavía no hay
         nada. Ninguno deja la caja vacía. */
      let mensaje = t("t4.m2.viz1vacio",
        "Mueve el deslizador de episodios para ver la estimación.");
      if (loteEnCurso) mensaje = t("t4.m2.calculando", "Calculando el modo por lotes…");
      else if (modo === "lote") {
        mensaje = t("t4.m2.viz1sinWorker",
          "Este navegador no admite Web Workers: en el modo por lotes solo se dibujan las "
          + "curvas de error.");
      }
      pintar(cuerpoValores, graficaLineas([], { mensaje }));
      pieValores.textContent = "";
      return;
    }

    const cortes = [...new Set([...INSTANTANEAS, episodios])].sort((a, b) => a - b);
    const series = cortes.map((k, i) => ({
      nombre: k === 1
        ? t("t4.m2.serieEp1", "1 episodio")
        : t("t4.m2.serieEp", "{k} episodios", { k }),
      color: k === episodios ? tono("--acento") : tono(COLORES_SERIE[i % COLORES_SERIE.length]),
      grosor: k === episodios ? 3 : 1.6,
      x,
      y: historial[Math.min(k, historial.length - 1)].slice(0, 5),
      puntos: true,
    }));
    series.push({
      nombre: t("t4.m2.serieVerdaderos", "Valores verdaderos"),
      color: tono("--texto"), x, y: VERDADEROS, discontinua: true, grosor: 1.6,
    });

    cuerpoValores.replaceChildren(graficaLineas(series, {
      ejeX: t("t4.m2.ejeXestados", "Estado"),
      ejeY: t("t4.m2.ejeYvalor", "Valor estimado"),
      yMin: 0, yMax: 0.9, ticksX,
      mensaje: t("t4.m2.viz1vacio", "Mueve el deslizador de episodios para ver la estimación."),
    }));
    conLeyenda(cuerpoValores, series);
    pieValores.textContent = modo === "linea"
      ? t("t4.m2.viz1runs", "1 ejecución · semilla {semilla}", { semilla: semillaActual() })
      : t("t4.m2.viz1runsLote",
        "1 ejecución · semilla {semilla} · el V convergido tras cada lote",
        { semilla: semillaActual() });
  }

  /* --- panel de error RMS --- */

  function dibujarRms() {
    const x = Array.from({ length: EPISODIOS + 1 }, (_, i) => i);
    const semilla = semillaActual();

    if (modo === "lote") {
      if (errorLote) {
        cuerpoRms.replaceChildren(graficaLineas([], {
          mensaje: t("t4.m2.errorLote", "El cálculo por lotes ha fallado: {m}", { m: errorLote }),
        }));
        pieRms.textContent = "";
        return;
      }
      if (!cacheLote.has(semilla)) {
        cuerpoRms.replaceChildren(graficaLineas([], {
          mensaje: t("t4.m2.calculando", "Calculando el modo por lotes…"),
        }));
        const barra = document.createElement("div");
        barra.className = "barra-progreso";
        progreso = document.createElement("i");
        barra.appendChild(progreso);
        cuerpoRms.appendChild(barra);
        pieRms.textContent = t("t4.m2.viz2runsLote",
          "{n} ejecuciones independientes · semillas {a}…{b} · α = {alpha} fijo",
          {
            n: REPETICIONES_LOTE, a: semilla, b: semilla + REPETICIONES_LOTE - 1,
            alpha: num(ALPHA_LOTE, 3),
          });
        return;
      }
      const { curvaMC, curvaTD } = cacheLote.get(semilla);
      const series = [
        {
          nombre: t("t4.m2.serieMCLote", "Monte Carlo por lotes"),
          color: tono("--peligro"), x, y: curvaMC, grosor: 3,
        },
        {
          nombre: t("t4.m2.serieTDLote", "TD(0) por lotes"),
          color: tono("--azul"), x, y: curvaTD, grosor: 3,
        },
      ];
      cuerpoRms.replaceChildren(graficaLineas(series, {
        ejeX: t("t4.m2.ejeX", "Episodios"),
        ejeY: t("t4.m2.ejeY", "Error RMS"),
        yMin: 0, yMax: 0.25,
        mensaje: t("t4.m2.viz2vacio", "Calculando las 100 ejecuciones…"),
      }));
      conLeyenda(cuerpoRms, series);
      pieRms.textContent = t("t4.m2.viz2runsLote",
        "{n} ejecuciones independientes · semillas {a}…{b} · α = {alpha} fijo",
        {
          n: REPETICIONES_LOTE, a: semilla, b: semilla + REPETICIONES_LOTE - 1,
          alpha: num(ALPHA_LOTE, 3),
        });
      return;
    }

    const mapa = curvasEnLinea();
    const series = [];
    const elegido = alpha();
    for (const a of [...new Set([...ALFAS_MC, elegido])].sort((p, q) => p - q)) {
      series.push({
        nombre: t("t4.m2.serieMC", "MC, α = {a}", { a: num(a, 2) }),
        color: tono("--peligro"),
        discontinua: true,
        grosor: a === elegido ? 3 : 1.2,
        x,
        y: mapa[`mc-${a}`],
      });
    }
    for (const a of [...new Set([...ALFAS_TD, elegido])].sort((p, q) => p - q)) {
      series.push({
        nombre: t("t4.m2.serieTD", "TD(0), α = {a}", { a: num(a, 2) }),
        color: tono("--azul"),
        grosor: a === elegido ? 3 : 1.2,
        x,
        y: mapa[`td-${a}`],
      });
    }

    cuerpoRms.replaceChildren(graficaLineas(series, {
      ejeX: t("t4.m2.ejeX", "Episodios"),
      ejeY: t("t4.m2.ejeY", "Error RMS"),
      yMin: 0, yMax: 0.25,
      mensaje: t("t4.m2.viz2vacio", "Calculando las 100 ejecuciones…"),
    }));
    conLeyenda(cuerpoRms, series.filter((serie) => serie.grosor === 3));
    pieRms.textContent = t("t4.m2.viz2runs",
      "{n} ejecuciones independientes · semillas {a}…{b} · las curvas finas son los otros α del libro",
      { n: EJECUCIONES, a: semilla, b: semilla + EJECUCIONES - 1 });
  }

  function dibujarMetricas() {
    cifras.rms0.textContent = num(RMS_INICIAL, 4);
    if (modo === "lote") {
      const dato = cacheLote.get(semillaActual());
      cifras.mc.textContent = dato ? num(dato.curvaMC[EPISODIOS], 4) : "—";
      cifras.td.textContent = dato ? num(dato.curvaTD[EPISODIOS], 4) : "—";
    } else {
      const mapa = curvasEnLinea();
      cifras.mc.textContent = num(mapa[`mc-${alpha()}`][EPISODIOS], 4);
      cifras.td.textContent = num(mapa[`td-${alpha()}`][EPISODIOS], 4);
    }
  }

  function dibujarNotaAlpha() {
    if (modo !== "linea" || alpha() < 0.10) {
      notaAlpha.innerHTML = "";
      return;
    }
    const curva = curvasEnLinea()[`td-${alpha()}`];
    let minimo = 0;
    curva.forEach((v, i) => { if (v < curva[minimo]) minimo = i; });
    if (minimo >= EPISODIOS) {
      notaAlpha.innerHTML = "";
      return;
    }
    notaAlpha.innerHTML = t("t4.m2.notaAlpha",
      "Fíjate en lo que hace la curva azul: baja rápido y <strong>vuelve a subir</strong>. Con "
      + "\\(\\alpha\\) constante los valores no se asientan nunca, fluctúan en respuesta a los "
      + "últimos episodios. Es el Ejercicio 6.5 del libro, y es la razón por la que "
      + "“\\(\\alpha\\) grande aprende más rápido” es una media verdad. Aquí el mínimo está en "
      + "el episodio {k} y a partir de ahí el error sube.", { k: minimo });
    renderizarMatematicas(notaAlpha);
  }

  /* --- «eres el predictor» --- */

  function figuraPredictor() {
    const ancho = 420;
    const alto = 170;
    const svg = el("svg", {
      viewBox: `0 0 ${ancho} ${alto}`, width: ancho, height: alto, role: "img",
      style: "max-width:100%;height:auto",
    });
    const linea = tono("--borde-fuerte");
    const suave = tono("--texto-suave");
    const punta = defsPunta(svg, linea);
    const nodo = (x, y, etiqueta, cuadrado) => {
      if (cuadrado) {
        svg.appendChild(el("rect", {
          x: x - 20, y: y - 20, width: 40, height: 40, rx: 4,
          fill: tono("--superficie-3"), stroke: linea, "stroke-width": 1.4,
        }));
      } else {
        svg.appendChild(el("circle", {
          cx: x, cy: y, r: 21, fill: tono("--superficie"), stroke: linea, "stroke-width": 1.6,
        }));
      }
      svg.appendChild(el("text", {
        x, y: y + 6, "text-anchor": "middle", "font-size": 15, "font-weight": 700,
        fill: tono("--texto"),
      }, etiqueta));
    };
    const flecha = (x1, y1, x2, y2, etiqueta, dy) => {
      svg.appendChild(el("line", {
        x1, y1, x2, y2, stroke: linea, "stroke-width": 1.4, "marker-end": `url(#${punta})`,
      }));
      svg.appendChild(el("text", {
        x: (x1 + x2) / 2, y: (y1 + y2) / 2 + dy, "text-anchor": "middle",
        "font-size": 11, "font-family": "monospace", fill: suave,
      }, etiqueta));
    };
    nodo(60, 60, "A", false);
    nodo(200, 60, "B", false);
    nodo(350, 30, t("t4.m2.fin", "fin"), true);
    nodo(350, 130, t("t4.m2.fin", "fin"), true);
    flecha(82, 60, 178, 60, "r = 0 · 100 %", -8);
    flecha(219, 48, 328, 33, "r = 1 · 75 %", -8);
    flecha(219, 74, 328, 122, "r = 0 · 25 %", 14);
    return svg;
  }

  function dibujarPredictor() {
    zonaPredictor.innerHTML = "";
    parrafo(zonaPredictor, "viz-titulo", t("t4.m2.predTitulo", "Eres el predictor"));
    parrafo(zonaPredictor, "explicacion", t("t4.m2.predTexto",
      "Otro proceso de Markov, ahora con dos estados. Has observado <strong>estos ocho "
      + "episodios</strong>, y nada más. \\(V(B)\\) no lo discute nadie: seis de las ocho veces "
      + "que estuviste en B el proceso terminó con retorno 1, y las otras dos con 0, así que "
      + "\\(V(B) = 3/4\\). <strong>¿Cuánto vale \\(V(A)\\)?</strong>"));

    const dos = document.createElement("div");
    dos.className = "dos-columnas";
    zonaPredictor.appendChild(dos);

    const izquierda = document.createElement("div");
    const derecha = document.createElement("div");
    dos.append(izquierda, derecha);

    const pre = document.createElement("pre");
    pre.className = "codigo";
    /* Los ocho episodios del Example 6.4 son datos, no texto: no se traducen. */
    pre.textContent = "A, 0, B, 0        B, 1\n"
      + "B, 1              B, 1\n"
      + "B, 1              B, 1\n"
      + "B, 1              B, 0";
    izquierda.appendChild(pre);

    const cuerpoModelo = caja(derecha, t("t4.m2.predModelo",
      "El proceso de Markov de máxima verosimilitud"));
    pintar(cuerpoModelo, figuraPredictor());

    const fila = document.createElement("div");
    fila.className = "fila";
    zonaPredictor.appendChild(fila);
    const respuesta = document.createElement("p");
    respuesta.className = "explicacion";

    const revelar = () => {
      const { vB, vA_td: vaTd, vA_mc: vaMc } = resolverPredictor();
      respuesta.innerHTML = t("t4.m2.predRespuesta",
        "<strong>Las dos son defendibles, y cada una es la de un método.</strong> "
        + "\\(V(A) = {td}\\) sale de construir primero el modelo de Markov más verosímil —de A "
        + "se pasa a B el 100 % de las veces con recompensa 0; de B se termina con recompensa 1 "
        + "el 75 % de las veces— y calcular el valor exacto <strong>en ese modelo</strong>. "
        + "<strong>Es lo que da TD(0) por lotes.</strong> \\(V(A) = {mc}\\) sale de mirar los "
        + "datos: A se ha visto <strong>una</strong> vez y el retorno que la siguió fue 0. "
        + "<strong>Es lo que da Monte Carlo por lotes</strong>, y es también la estimación que "
        + "<strong>minimiza el error cuadrático sobre los datos de entrenamiento</strong>. Ésa "
        + "es la diferencia entera: <strong>Monte Carlo por lotes minimiza el error sobre lo "
        + "observado; TD(0) por lotes acierta el modelo de Markov que lo generó</strong> —lo "
        + "que el libro llama la <em>estimación de equivalencia cierta</em>—. Si crees que el "
        + "proceso es de Markov, \\(3/4\\) es mejor predicción del futuro; si no lo crees, no "
        + "lo es. <strong>Esto es lo que quiere decir “TD es sensible a la propiedad de "
        + "Markov”</strong>, y es lo que las diapositivas afirman sin enseñar. "
        + "(\\(V(B) = {b}\\) en los dos métodos.)",
        { td: numMat(vaTd, 2), mc: numMat(vaMc, 2), b: numMat(vB, 2) });
      renderizarMatematicas(respuesta);
      [...fila.children].forEach((b) => { b.disabled = true; });
    };

    for (const etiqueta of [
      t("t4.m2.predOpc1", "\\(V(A) = 0\\)"),
      t("t4.m2.predOpc2", "\\(V(A) = 3/4\\)"),
      t("t4.m2.predVer", "Ver la respuesta"),
    ]) {
      const b = document.createElement("button");
      b.type = "button";
      b.innerHTML = etiqueta;
      b.addEventListener("click", revelar);
      fila.appendChild(b);
    }
    renderizarMatematicas(fila);
    zonaPredictor.appendChild(respuesta);
  }

  function dibujar() {
    dibujarValores();
    dibujarRms();
    dibujarMetricas();
    dibujarNotaAlpha();
    notaLote.hidden = modo !== "lote";
    $("#m2-semilla").textContent = t("t4.m2.semilla",
      "Semilla {n} · panel de valores: 1 ejecución · curvas de error: {e} ejecuciones "
      + "independientes.", { n: semillaActual(), e: EJECUCIONES });
  }

  oyentesSemilla.push(() => {
    if (modo === "lote") pedirLote();
    dibujar();
  });

  dibujar();
  dibujarPredictor();
  repintadores.push(() => { dibujar(); dibujarPredictor(); });

  crearQuiz($("#m2-quiz"), [
    {
      enunciado: "Con los ocho episodios de “eres el predictor”, ¿por qué \\(V(A)=3/4\\) y no 0, "
        + "si el único retorno observado tras A fue 0?",
      opciones: [
        "Porque TD por lotes construye el modelo de Markov más verosímil y calcula el valor "
          + "exacto en él: de A siempre se pasa a B, y B vale 3/4.",
        "Porque 3/4 minimiza el error cuadrático sobre los ocho episodios.",
        "Porque con un solo dato el estimador de Monte Carlo no está definido.",
        "Porque \\(\\gamma=1\\) y el retorno hay que descontarlo desde B.",
      ],
      correcta: 0,
      explicacion: "Es la <em>estimación de equivalencia cierta</em>: se estima primero el "
        + "proceso —A→B con probabilidad 1 y recompensa 0; desde B se termina con recompensa 1 "
        + "seis de ocho veces— y se resuelve exactamente en ese modelo. Quien minimiza el error "
        + "cuadrático sobre los datos es <strong>Monte Carlo</strong>, y su respuesta es 0, no "
        + "3/4: ésa es justo la diferencia. Con un dato el estimador de Monte Carlo está "
        + "perfectamente definido (vale el retorno observado), y el descuento no interviene "
        + "porque \\(\\gamma=1\\).",
    },
    {
      enunciado: "En la gráfica de error, la curva de TD con \\(\\alpha=0{,}15\\) baja deprisa y "
        + "después vuelve a subir. ¿Qué lo explica?",
      opciones: [
        "Que con paso constante los valores no se asientan: siguen respondiendo a los últimos "
          + "episodios indefinidamente.",
        "Que TD es sesgado y el sesgo crece con el número de episodios.",
        "Que la inicialización \\(V\\equiv0{,}5\\) es incorrecta para los estados de los "
          + "extremos.",
        "Que 100 ejecuciones no bastan para promediar el ruido.",
      ],
      correcta: 0,
      explicacion: "Con \\(\\alpha\\) constante la actualización nunca deja de perseguir la "
        + "última muestra, así que la estimación fluctúa alrededor del valor verdadero con una "
        + "amplitud que crece con \\(\\alpha\\); el error medio se estabiliza en un suelo "
        + "positivo y puede ser peor que el mínimo transitorio. El sesgo de TD tiende a cero con "
        + "la experiencia, no crece. La inicialización a 0,5 es la del libro y es buena —es el "
        + "valor exacto del estado central—, y el promediado sobre 100 ejecuciones es lo que "
        + "hace visible el efecto, no lo que lo causa.",
    },
    {
      enunciado: "En este paseo aleatorio TD llega antes que MC con todos los \\(\\alpha\\) "
        + "probados. ¿Qué se puede afirmar a partir de eso?",
      opciones: [
        "Que en esta tarea TD converge más rápido; no hay ningún teorema que garantice que sea "
          + "así en general.",
        "Que TD converge más rápido que MC, y está demostrado desde 1988.",
        "Que MC no converge en tareas estocásticas.",
        "Que TD es insesgado y MC no.",
      ],
      correcta: 0,
      explicacion: "El libro es explícito: <em>nadie ha podido demostrar matemáticamente que un "
        + "método converja más rápido que el otro</em>, y ni siquiera está claro cómo plantear "
        + "formalmente la pregunta. Lo que hay es evidencia empírica en tareas estocásticas, y "
        + "esta gráfica es una de ellas. Monte Carlo converge perfectamente aquí —solo más "
        + "despacio—, y el sesgo está al revés: el insesgado es Monte Carlo.",
    },
  ], { claves: "t4.m2.quiz" });
}

/* ======================================================================= *
 * MÓDULO 3 — SARSA frente a Q-learning en el borde del acantilado
 * ======================================================================= */

function modulo3() {
  const zonaControles = $("#m3-controles");
  const zonaRejillas = $("#m3-rejillas");
  const zonaRecompensas = $("#m3-recompensas");
  const zonaMetricas = $("#m3-metricas");
  const zonaVeredicto = $("#m3-veredicto");

  const entorno = cliffWalking();
  const EPISODIOS = 500;
  const EJECUCIONES = 50;
  const VENTANA = 10;
  const DESDE = 100;                       // media de los episodios 100-500
  const SUELO = -100;                      // borde inferior de la gráfica
  const LADO = 44;
  const CLIFF = new Set(entorno.geometria.acantilado);

  /* Los títulos van con clave literal y no con plantilla: el test de idioma
     escanea el fuente en crudo buscando llamadas a t(...) y una clave
     construida se le escaparía. (Ojo: escanea también los comentarios, así que
     aquí no se puede escribir una llamada de ejemplo con una cadena dentro:
     la tomaría por una clave de verdad y exigiría traducirla.) */
  const METODOS = [
    {
      id: "sarsa", fn: sarsa, color: "--exito", nombre: "SARSA",
      titulo: t("t4.m3.viz1sarsa", "SARSA · política greedy tras 500 episodios"),
    },
    {
      id: "q", fn: qLearning, color: "--acento", nombre: "Q-learning",
      titulo: t("t4.m3.viz1q", "Q-learning · política greedy tras 500 episodios"),
    },
    {
      id: "esarsa", fn: expectedSarsa, color: "--serie-4", nombre: "Expected SARSA",
      titulo: t("t4.m3.viz1esarsa", "Expected SARSA · política greedy tras 500 episodios"),
    },
  ];

  let epsilon = 0.10;
  let alfa = 0.5;
  let decae = false;
  let datos = null;
  let mandoEps = null;
  let mandoAlfa = null;
  let marcarDecae = () => {};

  /* --- encuadre y controles --- */

  parrafo(zonaControles, "explicacion", t("t4.m3.explicacion",
    "Un pasillo de 4×12. Sales de la esquina de abajo a la izquierda y tienes que llegar a la "
    + "de abajo a la derecha. Todo paso cuesta \\(-1\\); las diez casillas de en medio de la "
    + "fila de abajo son el <strong>acantilado</strong>: caer cuesta \\(-100\\) y te devuelve "
    + "al inicio <strong>sin terminar el episodio</strong>. Los algoritmos usan la "
    + "<strong>misma</strong> política ε-greedy, el <strong>mismo</strong> \\(\\alpha\\) y la "
    + "<strong>misma semilla</strong>. La única diferencia es la línea que ya has visto: SARSA "
    + "actualiza con la acción que va a tomar, Q-learning con el máximo, y Expected SARSA con "
    + "la esperanza bajo la política."));

  parrafo(zonaControles, "explicacion nota", t("t4.m3.declaracion",
    "El libro <strong>no publica</strong> el \\(\\alpha\\) ni el número de ejecuciones "
    + "promediadas de esta figura: solo da \\(\\varepsilon = 0{,}1\\) y la geometría. Aquí se "
    + "usa \\(\\alpha = 0{,}5\\) —el mismo que el libro usa en el Windy Gridworld— y se "
    + "promedian <strong>50 ejecuciones</strong>. Los dos son elección de esta página, no del "
    + "libro, y por eso son manipulables. Expected SARSA se añade como tercera curva: el libro "
    + "lo compara con los otros dos en §6.6."));

  const panel = panelControles(zonaControles);

  mandoEps = controlDeslizador(panel, {
    etiqueta: t("t4.m3.epsLabel", "Exploración (\\(\\varepsilon\\))"),
    min: 0, max: 0.5, paso: 0.05, valor: epsilon,
    formato: (v) => num(v, 2),
    alCambiar: (v) => { epsilon = v; },
    alSoltar: () => recalcular(),
  });

  marcarDecae = grupoRadio(panel,
    t("t4.m3.decaeLabel", "\\(\\varepsilon\\) a lo largo del entrenamiento"), [
      { valor: false, texto: t("t4.m3.decaeFijo", "fijo") },
      { valor: true, texto: t("t4.m3.decaeDecrece", "\\(\\varepsilon_k = \\varepsilon_0/k\\)") },
    ], decae, (valor) => { decae = valor; recalcular(); });

  mandoAlfa = controlDeslizador(panel, {
    etiqueta: t("t4.m3.alphaLabel", "Paso de aprendizaje (\\(\\alpha\\))"),
    min: 0.1, max: 1, paso: 0.1, valor: alfa,
    formato: (v) => num(v, 1),
    alCambiar: (v) => { alfa = v; },
    alSoltar: () => recalcular(),
  });

  botonControl(panel, t("t4.m3.reiniciar", "Volver a los valores del libro"), () => {
    epsilon = 0.10;
    alfa = 0.5;
    decae = false;
    mandoEps.fijar(0.10);
    mandoAlfa.fijar(0.5);
    marcarDecae(false);
    recalcular();
  }, { primario: true });

  const estado = parrafo(zonaControles, "suave", "");

  /* --- contenedores --- */

  const cuerpoRejillas = {};
  const pies = {};
  for (const m of METODOS) {
    cuerpoRejillas[m.id] = caja(zonaRejillas, m.titulo);
    pies[m.id] = parrafo(cuerpoRejillas[m.id].parentElement, "suave", "");
  }
  const pieRejillas = parrafo(zonaRejillas, "suave", "");

  const cuerpoCurvas = caja(zonaRecompensas, t("t4.m3.viz2",
    "Suma de recompensas durante el episodio"));
  const pieCurvas = parrafo(zonaRecompensas, "suave", "");
  const notaRecorte = parrafo(zonaRecompensas, "explicacion nota", "");

  const cifras = metricas(zonaMetricas, [
    { id: "sarsa", etiqueta: t("t4.m3.mSarsa", "SARSA · media de los episodios 100-500") },
    { id: "q", etiqueta: t("t4.m3.mQ", "Q-learning · media de los episodios 100-500") },
    { id: "esarsa", etiqueta: t("t4.m3.mEsarsa", "Expected SARSA · media de los episodios 100-500") },
    { id: "brecha", etiqueta: t("t4.m3.mBrecha", "Brecha SARSA − Q-learning") },
    { id: "optimas", etiqueta: t("t4.m3.mOptimas", "Políticas greedy de 13 pasos (de 50)") },
  ]);

  /* --- cálculo: 50 ejecuciones × 3 métodos ------------------------------
     La ejecución i usa `generador(semilla + i)` REINICIADO para cada método,
     así que los tres parten del mismo estado del generador y el entorno es
     determinista: toda la diferencia viene de la regla y de la selección. */

  function correr() {
    const semilla = semillaActual();
    const salida = {};
    for (const m of METODOS) {
      const acumulado = new Array(EPISODIOS).fill(0);
      const politicas = [];
      let cortados = 0;
      let Qprimera = null;
      for (let i = 0; i < EJECUCIONES; i++) {
        const resultado = m.fn(entorno, {
          alpha: alfa,
          epsilon,
          episodios: EPISODIOS,
          rng: generador(semilla + i),
          decaeEpsilon: decae ? (k) => epsilon / k : null,
        });
        for (let k = 0; k < EPISODIOS; k++) acumulado[k] += resultado.sumas[k] / EJECUCIONES;
        cortados += resultado.cortados;
        if (i === 0) Qprimera = resultado.Q;
        politicas.push(seguirPolitica(entorno, politicaGreedyDe(resultado.Q)));
      }
      const media = acumulado.slice(DESDE - 1)
        .reduce((a, b) => a + b, 0) / (EPISODIOS - DESDE + 1);
      const cuenta = new Map();
      let noLlegan = 0;
      for (const p of politicas) {
        if (!p.llega) { noLlegan++; continue; }
        cuenta.set(p.pasos, (cuenta.get(p.pasos) || 0) + 1);
      }
      salida[m.id] = {
        curva: mediaMovil(acumulado, VENTANA),
        media,
        cuenta,
        noLlegan,
        cortados,
        Q: Qprimera,
        politica: politicas[0],
      };
    }
    return salida;
  }

  function recalcular() {
    estado.textContent = t("t4.m3.calculando", "Calculando…");
    /* Un respiro al navegador para que llegue a pintar el «Calculando…». */
    setTimeout(() => {
      datos = correr();
      estado.textContent = "";
      dibujar();
    }, 20);
  }

  /* --- rejillas con la política greedy --- */

  function dibujarRejilla(m) {
    const dato = datos[m.id];
    const Q = dato.Q;
    const politica = politicaGreedyDe(Q);
    const enCamino = new Set(dato.politica.camino);
    const color = tono(m.color);

    const maximos = [];
    for (let x = 0; x < entorno.nEstados; x++) {
      if (CLIFF.has(x) || entorno.esTerminal(x) || Q[x].length === 0) continue;
      maximos.push(Math.max(...Q[x]));
    }
    const minimo = Math.min(...maximos);
    const maximo = Math.max(...maximos);

    const celdas = [];
    for (let x = 0; x < entorno.nEstados; x++) {
      const { fila, col } = entorno.geometria.posicion(x);
      const esCliff = CLIFF.has(x);
      const esMeta = entorno.esTerminal(x);
      /* El acantilado se pinta en rojo atenuado: es un peligro, no una celda
         más. No tiene valor que mostrar porque el agente nunca lo ocupa —caer
         devuelve al inicio en el mismo paso—. */
      let fondo = colorDeValor(Math.max(...Q[x]), minimo, maximo);
      if (esCliff) fondo = tono("--peligro");
      else if (esMeta) fondo = tono("--superficie-3");
      celdas.push({
        fila,
        col,
        etiqueta: entorno.etiquetas[x] || null,
        tamano: 13,
        color: fondo,
        textoColor: esCliff || esMeta ? null : textoContraste(fondo),
        atenuada: esCliff,
        borde: enCamino.has(x) ? color : null,
        flechas: esCliff || esMeta ? null : [ACCIONES_NAV[politica[x]]],
        /* La flecha va siempre en el color que contrasta con su celda; el
           camino se marca con el borde, no con el color de la flecha. */
        colorFlecha: textoContraste(fondo),
        titulo: esCliff
          ? t("t4.m3.celdaCliff", "Acantilado: −100 y vuelta al inicio")
          : `${entorno.etiquetas[x] || ""} ${nombreDir(ACCIONES_NAV[politica[x]] || "")}`.trim(),
      });
    }

    pintar(cuerpoRejillas[m.id], rejilla({
      celdas,
      lado: LADO,
      etiquetasBanda: [{
        fila: 3, col: 1, ancho: 10, alto: 1, color: "none",
        texto: t("t4.m3.cliff", "El acantilado (−100)"),
      }],
    }));

    /* Reparto de las 50 ejecuciones por longitud de su política greedy: es la
       aserción M3-A5 del guion, y sin ella la rejilla parecería la norma. */
    const reparto = [...dato.cuenta.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([pasos, n]) => t("t4.m3.repartoN", "{n} con {p} pasos", { n, p: pasos }));
    if (dato.noLlegan > 0) {
      reparto.push(t("t4.m3.repartoCiclo", "{n} que no llegan", { n: dato.noLlegan }));
    }

    pies[m.id].innerHTML = `${dato.politica.llega
      ? t("t4.m3.longitud", "Camino de {n} pasos · retorno {r}",
        { n: dato.politica.pasos, r: num(dato.politica.retorno, 0) })
      : t("t4.m3.noLlega",
        "Esta política greedy no alcanza la meta: entra en un ciclo. Ocurre en los estados que "
        + "la exploración casi nunca visita.")} · ${t("t4.m3.reparto",
      "en las 50 ejecuciones: {lista}", { lista: reparto.join(", ") })}`;
  }

  /* --- curvas de recompensa por episodio --- */

  function dibujarCurvas() {
    const x = Array.from({ length: EPISODIOS }, (_, i) => i + 1);
    let recortadas = 0;
    const series = METODOS.map((m) => ({
      nombre: m.nombre,
      color: tono(m.color),
      grosor: 2.2,
      x,
      y: datos[m.id].curva.map((v) => {
        if (v < SUELO) recortadas++;
        return Math.max(v, SUELO);
      }),
    }));
    const referencias = [
      referencia(t("t4.m3.ref13", "camino óptimo (13 pasos)"), -13, x, tono("--texto-suave")),
      referencia(t("t4.m3.ref15", "camino intermedio (15 pasos)"), -15, x, tono("--borde-fuerte")),
      referencia(t("t4.m3.ref17", "camino seguro (17 pasos)"), -17, x, tono("--texto-suave")),
    ];

    cuerpoCurvas.replaceChildren(graficaLineas([...referencias, ...series], {
      ejeX: t("t4.m3.ejeX", "Episodios"),
      ejeY: t("t4.m3.ejeY", "Suma de recompensas"),
      yMin: SUELO, yMax: -10,
      formatoY: (v) => num(v, 0),
      mensaje: t("t4.m3.viz2vacio", "Calculando las 50 ejecuciones…"),
    }));
    conLeyenda(cuerpoCurvas, [...series, ...referencias]);

    pieCurvas.textContent = t("t4.m3.viz2runs",
      "{n} ejecuciones independientes, media móvil de {v} episodios · semillas {a}…{b}",
      { n: EJECUCIONES, v: VENTANA, a: semillaActual(), b: semillaActual() + EJECUCIONES - 1 });

    const cortados = METODOS.reduce((n, m) => n + datos[m.id].cortados, 0);
    const avisos = [];
    if (recortadas > 0) {
      avisos.push(t("t4.m3.recorte",
        "Los primeros episodios caen por debajo del eje: la gráfica conserva el rango del libro "
        + "y los recorta en \\(-100\\)."));
    }
    if (cortados > 0) {
      avisos.push(t("t4.m3.cortado", "Episodios cortados a los 2 000 pasos: {n}.",
        { n: cortados }));
    }
    notaRecorte.innerHTML = avisos.join(" ");
    renderizarMatematicas(notaRecorte);
  }

  /** Cuántas ejecuciones acaban con la política greedy de {pasos} pasos. */
  const cuantas = (id, pasos) => datos[id].cuenta.get(pasos) || 0;

  function dibujarMetricas() {
    for (const m of METODOS) cifras[m.id].textContent = num(datos[m.id].media, 1);
    const brecha = datos.sarsa.media - datos.q.media;
    cifras.brecha.textContent = (brecha > 0 ? "+" : "") + num(brecha, 1);
    cifras.optimas.textContent = METODOS
      .map((m) => `${m.nombre} ${cuantas(m.id, 13)}`).join(" · ");
  }

  function dibujarVeredicto() {
    const s = num(datos.sarsa.media, 1);
    const q = num(datos.q.media, 1);
    const e = num(datos.esarsa.media, 1);
    let html;
    if (decae) {
      const largas = EJECUCIONES - cuantas("sarsa", 13);
      html = t("t4.m3.verDecrece",
        "Con \\(\\varepsilon\\) decreciente el rendimiento <strong>de los dos</strong> mejora y "
        + "se acerca a \\(-13\\): {s} y {q}. Pero fíjate en la política greedy de SARSA: en {n} "
        + "de las 50 ejecuciones <strong>sigue sin ser el camino de 13 pasos</strong>. La "
        + "afirmación de la diapositiva —“si \\(\\varepsilon\\) se fuese reduciendo "
        + "gradualmente, ambos acabarían convergiendo a \\(\\pi_*\\)”— es "
        + "<strong>asintótica</strong>, y exige que todos los pares estado-acción se sigan "
        + "visitando infinitas veces. En 500 episodios con \\(\\varepsilon\\) cayendo como "
        + "\\(1/k\\), los pares que están junto al acantilado dejan de visitarse mucho antes de "
        + "que sus valores se corrijan. La afirmación es correcta en el límite; en el "
        + "experimento, no se observa.", { s, q, n: largas });
    } else if (epsilon <= 1e-9) {
      html = t("t4.m3.verCero",
        "Con \\(\\varepsilon = 0\\) los algoritmos dan <strong>lo mismo</strong>: {s}, {q} y "
        + "{e}, y las tres políticas greedy son el camino de 13 pasos. Tiene sentido: si la "
        + "acción siguiente se elige siempre por el máximo, \\(Q(S_{t+1},A_{t+1})\\) "
        + "<strong>es</strong> \\(\\max_a Q(S_{t+1},a)\\) y las reglas coinciden. <strong>La "
        + "diferencia entre SARSA y Q-learning la crea la exploración, no el álgebra.</strong> "
        + "(Es el Ejercicio 6.12 del libro; el matiz es que las dos actualizaciones coinciden "
        + "solo mientras la acción greedy no cambie entre los dos momentos en que cada "
        + "algoritmo la elige.)", { s, q, e });
    } else {
      html = t("t4.m3.verNormal",
        "Q-learning aprende <strong>los valores de la política óptima</strong> —su política "
        + "greedy es el camino de 13 pasos, pegado al acantilado, en {nq} de las 50 "
        + "ejecuciones— y sin embargo su rendimiento <strong>real</strong> es peor: {q} frente "
        + "a {s}. La razón es que se <strong>comporta</strong> con \\(\\varepsilon={eps}\\), y "
        + "cada exploración junto al borde cuesta \\(-100\\). SARSA no aprende \\(q_*\\): "
        + "aprende los valores de la política que de verdad está siguiendo, exploración "
        + "incluida, y esa política <strong>se aparta del borde</strong>.",
        { q, s, eps: numMat(epsilon, 2), nq: cuantas("q", 13) });
    }

    html += ` ${t("t4.m3.verEsarsa",
      "Y la tercera curva contesta a una afirmación que el material hace sin ninguna evidencia. "
      + "<code>Tema4_2_ModelFree#slide-23</code> y <code>#slide-24</code> dicen que Expected "
      + "SARSA “mejora consistentemente a SARSA”, y no lo comprueban. Aquí se ve: con estos "
      + "parámetros obtiene {e}, su política greedy es <strong>el camino intermedio de 15 "
      + "pasos en {n15} de las 50 ejecuciones</strong> —ni el borde del acantilado ni la fila "
      + "de arriba— y, sobre todo, <strong>aguanta con \\(\\alpha\\) grande</strong>: con "
      + "\\(\\alpha = 1{,}0\\) y la semilla de partida se queda en \\(-20{,}4\\) "
      + "mientras SARSA se hunde a "
      + "\\(-94{,}9\\). Eso último es lo que hace fuerte la afirmación, y no está en ninguna "
      + "diapositiva.", { e, n15: cuantas("esarsa", 15) })}`;

    zonaVeredicto.innerHTML = html;
    renderizarMatematicas(zonaVeredicto);
  }

  function dibujar() {
    if (!datos) return;
    METODOS.forEach(dibujarRejilla);
    dibujarCurvas();
    dibujarMetricas();
    dibujarVeredicto();
    pieRejillas.textContent = t("t4.m3.rejillaRun",
      "Política de la ejecución con la semilla {semilla}: una sola, no un promedio —una "
      + "política media no es una política—.", { semilla: semillaActual() });
    $("#m3-semilla").textContent = t("t4.m3.semilla",
      "Semilla {n} · 50 ejecuciones independientes · 500 episodios · γ = 1.",
      { n: semillaActual() });
  }

  /* Estado inicial: mensajes de «sin datos» antes de que llegue el cálculo.
     Ninguna caja de gráfica de esta página se queda vacía. */
  for (const m of METODOS) {
    pintar(cuerpoRejillas[m.id], graficaLineas([], {
      ancho: 580, alto: 120,
      mensaje: t("t4.m3.viz1vacio", "Ejecutando 500 episodios…"),
    }));
  }
  cuerpoCurvas.replaceChildren(graficaLineas([], {
    mensaje: t("t4.m3.viz2vacio", "Calculando las 50 ejecuciones…"),
  }));

  oyentesSemilla.push(() => recalcular());
  recalcular();
  repintadores.push(() => dibujar());

  crearQuiz($("#m3-quiz"), [
    {
      enunciado: "Q-learning aprende exactamente los valores de la política óptima y aun así "
        + "obtiene peor suma de recompensas que SARSA. ¿Cómo se explica?",
      opciones: [
        "Porque aprende \\(q_*\\) pero se comporta con ε-greedy, y explorar junto al acantilado "
          + "cuesta \\(-100\\).",
        "Porque Q-learning no converge en este entorno.",
        "Porque SARSA usa un \\(\\alpha\\) efectivo mayor.",
        "Porque la suma de recompensas mide la política aprendida, no la ejecutada.",
      ],
      correcta: 0,
      explicacion: "La política que Q-learning <strong>aprende</strong> es la de 13 pasos, "
        + "pegada al borde; la que <strong>ejecuta</strong> es esa misma con un "
        + "\\(\\varepsilon\\) de ruido encima, y cada desvío junto al acantilado cuesta "
        + "\\(-100\\). SARSA evalúa la política exploratoria tal cual es, así que sus valores "
        + "junto al borde son pésimos y su política se aparta. Q-learning converge perfectamente "
        + "aquí, los dos usan el mismo \\(\\alpha\\), y la métrica de la gráfica es precisamente "
        + "el rendimiento <strong>ejecutado</strong>, episodio a episodio: si midiera la "
        + "política aprendida, Q-learning ganaría.",
    },
    {
      enunciado: "Pones \\(\\varepsilon = 0\\) y las curvas se superponen en \\(-13\\). ¿Qué "
        + "conclusión es correcta?",
      opciones: [
        "Que la diferencia entre los algoritmos la produce la exploración: sin ella, el objetivo "
          + "de SARSA coincide con el máximo.",
        "Que SARSA es un caso particular de Q-learning.",
        "Que con \\(\\varepsilon=0\\) ninguno explora y por eso todos fracasan.",
        "Que \\(\\varepsilon\\) no influye en el resultado final de ninguno de ellos.",
      ],
      correcta: 0,
      explicacion: "Si la acción siguiente se elige siempre maximizando, entonces "
        + "\\(Q(S_{t+1},A_{t+1})=\\max_a Q(S_{t+1},a)\\) y las dos reglas escriben lo mismo. "
        + "Ninguno es caso particular del otro en general: lo son solo bajo selección greedy, y "
        + "aun así el momento en que cada uno elige la acción difiere, que es lo que pregunta el "
        + "Ejercicio 6.12 del libro. Y con \\(\\varepsilon=0\\) sí hay exploración inicial, "
        + "porque \\(Q\\) empieza a cero y los empates se deshacen al azar: por eso todos llegan "
        + "a \\(-13\\) en vez de fracasar.",
    },
    {
      enunciado: "Activas \\(\\varepsilon_k = \\varepsilon_0/k\\) y el rendimiento mejora, pero "
        + "la política greedy de SARSA sigue sin ser la de 13 pasos en la mayoría de "
        + "ejecuciones. ¿Qué falla en la afirmación “si \\(\\varepsilon\\) se redujera "
        + "gradualmente, ambos convergerían a \\(\\pi_*\\)”?",
      opciones: [
        "Nada falla: es una afirmación asintótica y exige visitar infinitas veces todos los "
          + "pares estado-acción, algo que en 500 episodios con \\(\\varepsilon\\) cayendo tan "
          + "rápido no ocurre.",
        "Que SARSA nunca converge a \\(\\pi_*\\), ni siquiera en el límite.",
        "Que \\(\\varepsilon_0/k\\) no cumple las condiciones de aproximación estocástica.",
        "Que la afirmación solo vale para Q-learning.",
      ],
      correcta: 0,
      explicacion: "El teorema de convergencia de SARSA pide tres cosas a la vez: las "
        + "condiciones sobre \\(\\alpha\\), que todos los pares se visiten infinitas veces y que "
        + "la política tienda a la greedy. Con \\(\\varepsilon\\) cayendo como \\(1/k\\) la "
        + "tercera se cumple deprisa, pero la segunda deja de cumplirse en la práctica: los "
        + "pares junto al acantilado dejan de visitarse antes de que sus valores se corrijan. En "
        + "el límite SARSA sí converge a \\(\\pi_*\\), y la afirmación vale para los dos "
        + "métodos; lo que no se sostiene es leerla como una promesa a 500 episodios.",
    },
  ], { claves: "t4.m3.quiz" });
}

/* ======================================================================= *
 * MÓDULO 4 — el máximo engaña: sesgo de maximización y aprendizaje doble
 * ======================================================================= */

function modulo4() {
  const zonaControles = $("#m4-controles");
  const zonaDiagrama = $("#m4-diagrama");
  const zonaSesgo = $("#m4-sesgo");
  const zonaExperimento = $("#m4-experimento");
  const zonaMetricas = $("#m4-metricas");
  const zonaVeredicto = $("#m4-veredicto");

  const EPISODIOS = 300;
  const EJECUCIONES = 2000;
  const MUESTRAS = 20000;
  const N_MAX = 20;
  const ALPHA = 0.1;
  const EPSILON = 0.1;
  const OPTIMO = 100 * (EPSILON / 2);      // 5 %: ε/2 con dos acciones en A
  const MEDIA_B = -0.1;

  let nB = 10;
  let sigma = 1;
  let sesgo = null;
  let experimento = null;
  let mandoNb = null;
  let marcarSigma = () => {};

  /* --- encuadre y controles --- */

  parrafo(zonaControles, "explicacion", t("t4.m4.explicacion",
    "Dos estados. Empiezas siempre en \\(A\\), donde tienes dos acciones: "
    + "<strong>derecha</strong> termina de inmediato con recompensa 0, e "
    + "<strong>izquierda</strong> te lleva a \\(B\\), también con recompensa 0. En \\(B\\) hay "
    + "muchas acciones, todas terminan de inmediato, y todas dan una recompensa aleatoria de "
    + "media \\(-0{,}1\\). Así que <strong>ir a la izquierda es siempre un error</strong>: su "
    + "retorno esperado es \\(-0{,}1\\) y el de la derecha es 0. Lo óptimo es tomar "
    + "<em>izquierda</em> solo cuando la exploración obliga: un <strong>5 %</strong> de las "
    + "veces, que es \\(\\varepsilon/2\\) con dos acciones."));

  const panel = panelControles(zonaControles);

  mandoNb = controlDeslizador(panel, {
    etiqueta: t("t4.m4.nbLabel", "Acciones en el estado B"),
    min: 2, max: N_MAX, paso: 1, valor: nB,
    formato: (v) => String(v),
    alCambiar: (v) => { nB = v; },
    alSoltar: () => recalcular(),
  });

  marcarSigma = grupoRadio(panel, t("t4.m4.sigmaLabel",
    "Ruido de la recompensa (\\(\\sigma\\))"), [
    { valor: 0.5, texto: num(0.5, 1) },
    { valor: 1, texto: num(1, 0) },
    { valor: 2, texto: num(2, 0) },
  ], sigma, (valor) => { sigma = valor; recalcular(); });

  botonControl(panel, t("t4.m4.reiniciar",
    "Volver a los valores del libro (10 acciones, σ = 1)"), () => {
    nB = 10;
    sigma = 1;
    mandoNb.fijar(10);
    marcarSigma(1);
    recalcular();
  }, { primario: true });

  const estado = parrafo(zonaControles, "suave", "");

  parrafo(zonaControles, "explicacion nota", t("t4.m4.parametrosFijos",
    "\\(\\varepsilon = 0{,}1\\) · \\(\\alpha = 0{,}1\\) · \\(\\gamma = 1\\) · \\(Q\\) inicial a "
    + "cero · empates deshechos al azar. Son los de la Figura 6.5 del libro."));

  const cuerpoDiagrama = caja(zonaDiagrama, t("t4.m4.diagrama",
    "El MDP de dos estados del Example 6.7"));

  const cuerpoSesgo = caja(zonaSesgo, t("t4.m4.viz1",
    "El máximo de \\(n\\) estimaciones ruidosas, frente al máximo verdadero"));
  const pieSesgo = parrafo(zonaSesgo, "suave", "");
  parrafo(zonaSesgo, "explicacion", t("t4.m4.viz1texto",
    "Las \\(n\\) acciones de \\(B\\) valen <strong>todas exactamente \\(-0{,}1\\)</strong>. Sus "
    + "estimaciones, en cambio, están repartidas por encima y por debajo. El máximo de los "
    + "valores verdaderos es \\(-0{,}1\\); <strong>el máximo de las estimaciones es mucho "
    + "mayor, y crece con \\(n\\)</strong>. Con \\(n=2\\) y \\(\\sigma=1\\) el valor esperado es "
    + "\\(-0{,}1 + \\sigma/\\sqrt{\\pi} \\approx 0{,}46\\); con \\(n=10\\), \\(\\approx "
    + "1{,}44\\). Ese hueco es el <strong>sesgo de maximización</strong>, y es lo que Q-learning "
    + "copia en \\(Q(A,\\text{izquierda})\\) cada vez que actualiza."));
  parrafo(zonaSesgo, "explicacion nota", t("t4.m4.n1",
    "Con una sola acción no hay sesgo: el máximo de una muestra es insesgado. Por eso la curva "
    + "arranca en \\(-0{,}1\\) y el deslizador del experimento empieza en 2."));

  const cuerpoExperimento = caja(zonaExperimento, t("t4.m4.viz2",
    "Porcentaje de acciones <em>izquierda</em> desde \\(A\\)"));
  const pieExperimento = parrafo(zonaExperimento, "suave", "");

  const cifras = metricas(zonaMetricas, [
    {
      id: "sesgo",
      etiqueta: t("t4.m4.mSesgo",
        "Sesgo \\(\\mathbb{E}[\\max\\hat{Q}] - \\max q\\) con \\(n_B\\) acciones"),
    },
    { id: "pico", etiqueta: t("t4.m4.mPico", "Pico de Q-learning") },
    { id: "final", etiqueta: t("t4.m4.mFinal", "Q-learning en el episodio 300") },
    { id: "finalD", etiqueta: t("t4.m4.mFinalD", "Q-learning doble en el episodio 300") },
  ]);

  /* --- figura estática del MDP (sigue al deslizador) --- */

  function figuraMdp() {
    const ancho = 660;
    const alto = 210;
    const VISIBLES = 8;
    const svg = el("svg", {
      viewBox: `0 0 ${ancho} ${alto}`, width: ancho, height: alto, role: "img",
      style: "max-width:100%;height:auto",
    });
    const linea = tono("--borde-fuerte");
    const suave = tono("--texto-suave");
    const punta = defsPunta(svg, linea);
    const puntaB = defsPunta(svg, tono("--peligro"));

    const nodo = (x, y, etiqueta, cuadrado) => {
      if (cuadrado) {
        svg.appendChild(el("rect", {
          x: x - 19, y: y - 19, width: 38, height: 38, rx: 4,
          fill: tono("--superficie-3"), stroke: linea, "stroke-width": 1.4,
        }));
      } else {
        svg.appendChild(el("circle", {
          cx: x, cy: y, r: 22, fill: tono("--superficie"), stroke: linea, "stroke-width": 1.6,
        }));
      }
      svg.appendChild(el("text", {
        x, y: y + 6, "text-anchor": "middle", "font-size": 16, "font-weight": 700,
        fill: tono("--texto"),
      }, etiqueta));
    };

    const xA = 330;
    const xB = 130;
    const xFin = 560;
    const yA = 60;
    const yB = 150;

    nodo(xA, yA, "A", false);
    nodo(xB, yB, "B", false);
    nodo(xFin, yA, t("t4.m4.fin", "fin"), true);

    /* A --derecha--> fin  (r = 0) */
    svg.appendChild(el("line", {
      x1: xA + 23, y1: yA, x2: xFin - 21, y2: yA,
      stroke: linea, "stroke-width": 1.5, "marker-end": `url(#${punta})`,
    }));
    svg.appendChild(el("text", {
      x: (xA + xFin) / 2, y: yA - 9, "text-anchor": "middle", "font-size": 11.5,
      "font-weight": 650, fill: tono("--exito"),
    }, `${t("t4.m4.derecha", "derecha")} · r = 0`));

    /* A --izquierda--> B  (r = 0) */
    svg.appendChild(el("line", {
      x1: xA - 20, y1: yA + 11, x2: xB + 20, y2: yB - 11,
      stroke: linea, "stroke-width": 1.5, "marker-end": `url(#${punta})`,
    }));
    svg.appendChild(el("text", {
      x: (xA + xB) / 2, y: (yA + yB) / 2 - 8, "text-anchor": "middle", "font-size": 11.5,
      "font-weight": 650, fill: tono("--peligro"),
    }, `${t("t4.m4.izquierda", "izquierda")} · r = 0`));

    /* B --n acciones--> fin: un haz de curvas que SALE de B y CONVERGE en el
       terminal; lo que cambia entre ellas es la curvatura, no el destino. */
    const dibujadas = Math.min(nB, VISIBLES);
    for (let i = 0; i < dibujadas; i++) {
      const desvio = 20 + (i * 90) / Math.max(1, dibujadas - 1);
      svg.appendChild(el("path", {
        d: `M${xB + 22} ${yB} Q${(xB + xFin) / 2} ${yB + desvio - 40} ${xFin - 12} ${yA + 21}`,
        fill: "none", stroke: tono("--peligro"), "stroke-width": 1.1, opacity: 0.5,
        "marker-end": `url(#${puntaB})`,
      }));
    }
    svg.appendChild(textoSvg({
      x: (xB + xFin) / 2 + 10, y: alto - 6, "text-anchor": "middle", "font-size": 11.5,
      "font-family": "monospace", fill: suave,
    }, t("t4.m4.ruido", "{n} acciones · r ~ N(−0,1; {s}²)",
      { n: nB, s: num(sigma, 1) })));
    if (nB > VISIBLES) {
      svg.appendChild(el("text", {
        x: xB + 62, y: yB + 40, "text-anchor": "middle", "font-size": 18, fill: suave,
      }, "⋮"));
    }
    return svg;
  }

  /* --- cálculo --- */

  function calcular() {
    const semilla = semillaActual();

    /* Viz 1: la esperanza del máximo, punto a punto, con un generador propio. */
    const rng = generador(semilla);
    const curva = [];
    for (let n = 1; n <= N_MAX; n++) {
      curva.push(esperanzaDelMaximo({ n, sigma, media: MEDIA_B, muestras: MUESTRAS, rng }));
    }
    sesgo = curva;

    /* Viz 2: el experimento, con la MISMA semilla para los dos métodos. */
    const entorno = mdpDosEstados({ nB, sigma, media: MEDIA_B });
    const simple = new Array(EPISODIOS).fill(0);
    const doble = new Array(EPISODIOS).fill(0);
    for (let i = 0; i < EJECUCIONES; i++) {
      const a = qLearning(entorno, {
        alpha: ALPHA, epsilon: EPSILON, episodios: EPISODIOS, rng: generador(semilla + i),
      });
      const b = qLearningDoble(entorno, {
        alpha: ALPHA, epsilon: EPSILON, episodios: EPISODIOS, rng: generador(semilla + i),
      });
      for (let k = 0; k < EPISODIOS; k++) {
        if (a.acciones0[k] === IZQUIERDA) simple[k] += 100 / EJECUCIONES;
        if (b.acciones0[k] === IZQUIERDA) doble[k] += 100 / EJECUCIONES;
      }
    }
    const pico = Math.max(...simple);
    experimento = {
      simple, doble, pico, episodioPico: simple.indexOf(pico) + 1, picoDoble: Math.max(...doble),
    };
  }

  function recalcular() {
    estado.textContent = t("t4.m4.calculando", "Calculando…");
    setTimeout(() => {
      calcular();
      estado.textContent = "";
      dibujar();
    }, 20);
  }

  /* --- pintado --- */

  function dibujarSesgo() {
    const x = Array.from({ length: N_MAX }, (_, i) => i + 1);
    const series = [
      {
        nombre: t("t4.m4.serieMax", "\\(\\mathbb{E}[\\max_a \\hat{Q}(B,a)]\\)"),
        color: tono("--peligro"), x, y: sesgo, grosor: 2.4, puntos: true,
      },
      referencia(t("t4.m4.serieVerdadero", "\\(\\max_a q(B,a) = -0{,}1\\)"),
        MEDIA_B, x, tono("--texto")),
    ];
    cuerpoSesgo.replaceChildren(graficaLineas(series, {
      ejeX: t("t4.m4.ejeXn", "Número de acciones de B"),
      ejeY: t("t4.m4.ejeYvalor", "Valor"),
      ticksX: x.filter((v) => v % 2 === 0),
      anotaciones: [{
        x: nB,
        texto: t("t4.m4.anotN", "n = {n}: {v}", { n: nB, v: num(sesgo[nB - 1], 2) }),
      }],
      mensaje: t("t4.m4.viz1vacio", "Calculando la esperanza del máximo…"),
    }));
    conLeyenda(cuerpoSesgo, series);
    pieSesgo.textContent = t("t4.m4.viz1runs", "{m} muestras por punto · semilla {semilla}",
      { m: MUESTRAS, semilla: semillaActual() });
  }

  function dibujarExperimento() {
    const x = Array.from({ length: EPISODIOS }, (_, i) => i + 1);
    const series = [
      {
        nombre: "Q-learning", color: tono("--peligro"), x, y: experimento.simple, grosor: 2.2,
      },
      {
        nombre: t("t4.m4.serieDoble", "Q-learning doble"),
        color: tono("--acento"), x, y: experimento.doble, grosor: 2.2,
      },
      referencia(t("t4.m4.ref5", "óptimo (\\(\\varepsilon/2\\))"), OPTIMO, x, tono("--texto-suave")),
    ];
    cuerpoExperimento.replaceChildren(graficaLineas(series, {
      ejeX: t("t4.m4.ejeXep", "Episodios"),
      ejeY: t("t4.m4.ejeYpct", "% de acciones izquierda desde A"),
      yMin: 0, yMax: 100, escalaX: "log2",
      formatoY: (v) => num(v, 0),
      mensaje: t("t4.m4.viz2vacio", "Calculando las 2 000 ejecuciones…"),
    }));
    conLeyenda(cuerpoExperimento, series);
    pieExperimento.innerHTML = t("t4.m4.viz2runs",
      "<strong>{n} ejecuciones independientes</strong> · semillas {a}…{b} · <em>el libro "
      + "promedia 10 000</em> · eje horizontal logarítmico",
      { n: EJECUCIONES, a: semillaActual(), b: semillaActual() + EJECUCIONES - 1 });
  }

  function dibujarMetricas() {
    cifras.sesgo.textContent = num(sesgo[nB - 1] - MEDIA_B, 2);
    cifras.pico.textContent = t("t4.m4.picoEn", "{p} % en el episodio {e}",
      { p: num(experimento.pico, 1), e: experimento.episodioPico });
    cifras.final.textContent = `${num(experimento.simple[EPISODIOS - 1], 1)} %`;
    cifras.finalD.textContent = `${num(experimento.doble[EPISODIOS - 1], 1)} %`;
  }

  function dibujarVeredicto() {
    const p = num(experimento.pico, 1);
    const v = num(experimento.simple[EPISODIOS - 1], 1);
    const d = num(experimento.doble[EPISODIOS - 1], 1);
    const b = num(sesgo[nB - 1], 2);
    let html;
    if (nB <= 4) {
      html = t("t4.m4.verPocas",
        "Con solo {n} acciones el efecto casi no se aprecia: el máximo estimado vale {b} y "
        + "Q-learning apenas llega al {p} %. <strong>El sesgo crece con el número de acciones "
        + "sobre las que se maximiza</strong>, porque cuantas más estimaciones ruidosas hay, más "
        + "alto está el mayor de los errores. Sube el deslizador y míralo.", { n: nB, b, p });
    } else {
      html = t("t4.m4.verNormal",
        "Con {n} acciones en \\(B\\), Q-learning llega a tomar <em>izquierda</em> el <strong>{p} "
        + "%</strong> de las veces —cuando lo óptimo es el 5 %—, y al episodio 300 todavía va "
        + "por el <strong>{v} %</strong>. Q-learning doble no despega del 5 %: <strong>{d} "
        + "%</strong>. Y el motivo está en el panel de arriba: el máximo estimado de \\(B\\) "
        + "vale {b} cuando el verdadero es \\(-0{,}1\\), así que \\(Q(A,\\text{izquierda})\\) "
        + "hereda un valor positivo que no existe.", { n: nB, p, v, d, b });
    }
    html += ` ${t("t4.m4.verDoble",
      "Q-learning doble no elimina el ruido: <strong>separa quién elige de quién "
      + "evalúa</strong>. \\(Q_1\\) dice cuál es la acción maximizadora y \\(Q_2\\) dice cuánto "
      + "vale; como los errores de las dos tablas son independientes, el error que hizo que esa "
      + "acción pareciera la mejor <strong>no se copia</strong> en su valor. "
      + "\\(\\mathbb{E}[Q_2(A^*)] = q(A^*)\\), y eso es todo el truco. En este experimento su "
      + "curva no pasa del 53 % con ningún \\(n_B\\), con la semilla de partida.")}`;

    zonaVeredicto.innerHTML = html;
    renderizarMatematicas(zonaVeredicto);
  }

  function dibujar() {
    if (!sesgo || !experimento) return;
    pintar(cuerpoDiagrama, figuraMdp());
    dibujarSesgo();
    dibujarExperimento();
    dibujarMetricas();
    dibujarVeredicto();
    $("#m4-semilla").textContent = t("t4.m4.semilla",
      "Semilla {n} · 2 000 ejecuciones independientes en el experimento · 20 000 muestras por "
      + "punto en el panel del sesgo.", { n: semillaActual() });
  }

  pintar(cuerpoDiagrama, figuraMdp());
  cuerpoSesgo.replaceChildren(graficaLineas([], {
    mensaje: t("t4.m4.viz1vacio", "Calculando la esperanza del máximo…"),
  }));
  cuerpoExperimento.replaceChildren(graficaLineas([], {
    mensaje: t("t4.m4.viz2vacio", "Calculando las 2 000 ejecuciones…"),
  }));

  oyentesSemilla.push(() => recalcular());
  recalcular();
  repintadores.push(() => dibujar());

  crearQuiz($("#m4-quiz"), [
    {
      enunciado: "Todas las acciones del estado \\(B\\) valen exactamente \\(-0{,}1\\). ¿Por qué "
        + "\\(\\max_a Q(B,a)\\) sale positivo?",
      opciones: [
        "Porque el máximo de varias estimaciones ruidosas del mismo valor está sesgado hacia "
          + "arriba, y el sesgo crece con el número de acciones.",
        "Porque \\(\\alpha = 0{,}1\\) es demasiado grande y las estimaciones no convergen.",
        "Porque la recompensa tiene media \\(-0{,}1\\) pero la mediana es positiva.",
        "Porque \\(\\gamma=1\\) y los retornos se acumulan.",
      ],
      correcta: 0,
      explicacion: "Cada \\(Q(B,a)\\) es una estimación ruidosa de \\(-0{,}1\\); tomar el máximo "
        + "de \\(n\\) de ellas selecciona sistemáticamente la que más se ha desviado hacia "
        + "arriba, y esa selección no se compensa con nada. Con \\(n=2\\) y ruido de desviación "
        + "1 la esperanza del máximo es \\(-0{,}1+1/\\sqrt{\\pi}\\approx0{,}46\\). No es un "
        + "problema de \\(\\alpha\\): con \\(\\alpha\\) más pequeño el efecto tarda más pero no "
        + "desaparece. La normal es simétrica, así que su mediana también es \\(-0{,}1\\). Y con "
        + "\\(\\gamma=1\\) no se acumula nada: los episodios tienen dos transiciones.",
    },
    {
      enunciado: "¿Qué hace exactamente el aprendizaje doble para evitar el sesgo?",
      opciones: [
        "Usa una tabla para decidir cuál es la acción maximizadora y la otra para evaluar su "
          + "valor, de modo que el error que la eligió no se copia en su valor.",
        "Promedia las dos tablas en cada actualización, y el promedio reduce la varianza a la "
          + "mitad.",
        "Actualiza las dos tablas en cada paso, lo que duplica la cantidad de datos.",
        "Sustituye el máximo por la esperanza bajo la política, como Expected SARSA.",
      ],
      correcta: 0,
      explicacion: "El sesgo aparece porque el mismo conjunto de estimaciones "
        + "<strong>elige</strong> y <strong>evalúa</strong>; con dos tablas independientes, "
        + "\\(Q_1\\) elige \\(A^*=\\arg\\max_a Q_1(a)\\) y \\(Q_2\\) da \\(Q_2(A^*)\\), cuya "
        + "esperanza es \\(q(A^*)\\). El promedio de las dos tablas es lo que se usa para "
        + "<strong>seleccionar la acción de comportamiento</strong>, no para la actualización. "
        + "En cada paso se actualiza <strong>solo una</strong> de las dos, sorteada con "
        + "probabilidad 0,5: el método duplica la memoria, no el cómputo ni los datos. Y "
        + "sustituir el máximo por la esperanza es Expected SARSA, que es otro algoritmo y no "
        + "resuelve este problema.",
    },
    {
      enunciado: "Bajas el número de acciones de \\(B\\) de 10 a 2 y la curva de Q-learning "
        + "apenas sube. ¿Qué se concluye?",
      opciones: [
        "Que el sesgo depende del número de estimaciones sobre las que se maximiza: con pocas "
          + "acciones hay poco que sobreestimar.",
        "Que con dos acciones no hay sesgo de maximización en absoluto.",
        "Que el sesgo depende de \\(\\alpha\\), no del número de acciones.",
        "Que con dos acciones Q-learning y Q-learning doble son el mismo algoritmo.",
      ],
      correcta: 0,
      explicacion: "Cuantas más estimaciones ruidosas entran en el máximo, más alto está el "
        + "mayor de sus errores: es la razón por la que la esperanza del máximo crece con "
        + "\\(n\\). Con dos acciones el sesgo sigue existiendo —vale \\(1/\\sqrt{\\pi}\\approx"
        + "0{,}56\\) por encima del verdadero— pero es lo bastante pequeño como para que la "
        + "curva apenas despegue. \\(\\alpha\\) cambia la velocidad, no la existencia del sesgo. "
        + "Y los dos algoritmos siguen siendo distintos con dos acciones: uno mantiene una tabla "
        + "y el otro dos, con actualización cruzada.",
    },
  ], { claves: "t4.m4.quiz" });
}

/* ======================================================================= *
 * FIGURAS ESTÁTICAS DE LOS BLOQUES DE ESTUDIO
 * ======================================================================= */

/** B4 — la traza del gridworld de juguete, con su G_t en cada celda visitada. */
function figuraTraza() {
  const zona = $("#b4-traza");
  if (!zona) return;
  const mdp = rejilla3x3();
  const cuerpo = caja(zona, t("t4.b4.figura",
    "El episodio 1 → 2 → 5 → 6 → T, con el retorno \\(G_t\\) de cada estado visitado"));

  /* Episodio de 4_Tema4#slide-12, con A_3 = abajo (ver la errata del bloque). */
  const TRAZA = [
    { s: 0, accion: "dch", g: -4 },
    { s: 1, accion: "abajo", g: -3 },
    { s: 4, accion: "dch", g: -2 },
    { s: 5, accion: "abajo", g: -1 },
  ];
  const porEstado = new Map(TRAZA.map((paso) => [paso.s, paso]));

  function pintarFigura() {
    const celdas = [];
    for (let s = 0; s < mdp.nEstados; s++) {
      const terminal = mdp.esTerminal(s);
      const paso = porEstado.get(s);
      const color = terminal
        ? tono("--superficie-3")
        : (paso ? tono("--acento-tenue") : tono("--superficie"));
      celdas.push({
        ...mdp.geometria.posicion(s),
        esquina: mdp.etiquetas[s],
        etiqueta: paso ? num(paso.g, 0) : (terminal ? mdp.etiquetas[s] : "—"),
        tamano: 15,
        mono: true,
        color,
        atenuada: terminal,
        borde: paso ? tono("--acento") : null,
        flechas: paso ? [DIR_3X3[paso.accion]] : null,
        colorFlecha: tono("--acento"),
        titulo: paso
          ? t("t4.b4.celda", "Estado {e}: \\(G_t = {g}\\)",
            { e: mdp.etiquetas[s], g: num(paso.g, 0) })
          : mdp.etiquetas[s],
      });
    }
    pintar(cuerpo, rejilla({ celdas, lado: 84 }));
  }

  pintarFigura();
  parrafo(zona, "suave", t("t4.b4.pie",
    "Los cuatro estados que el episodio no visita se quedan sin estimación: es la limitación de "
    + "Monte Carlo en una línea."));
  repintadores.push(pintarFigura);
}

/** B7 — los dos paneles del ejemplo «volver a casa» (S&B, Figura 6.1). */
function figuraDrivingHome() {
  const zona = $("#b7-figura");
  if (!zona) return;
  const TRANSCURRIDO = [0, 5, 20, 30, 40, 43];
  const TOTAL = [30, 40, 35, 40, 43, 43];
  const SIGUIENTE = [40, 35, 40, 43, 43, 43];

  const dos = document.createElement("div");
  dos.className = "dos-columnas";
  zona.appendChild(dos);
  const izquierda = document.createElement("div");
  const derecha = document.createElement("div");
  dos.append(izquierda, derecha);
  const cuerpoMC = caja(izquierda, t("t4.b7.panelMC",
    "Cambios recomendados por Monte Carlo (\\(\\alpha = 1\\))"));
  const cuerpoTD = caja(derecha, t("t4.b7.panelTD",
    "Cambios recomendados por TD(0) (\\(\\alpha = 1\\))"));

  function pintarFigura() {
    const comun = {
      ejeX: t("t4.b7.ejeX", "Situación (minutos transcurridos)"),
      ejeY: t("t4.b7.ejeY", "Tiempo total previsto (min)"),
      yMin: 25, yMax: 48, ticksX: TRANSCURRIDO,
      mensaje: t("t4.b7.vacio", "Datos fijos del ejemplo; no se simula nada."),
    };
    const prevision = {
      nombre: t("t4.b7.seriePrev", "Tiempo total previsto"),
      color: tono("--acento"), x: TRANSCURRIDO, y: TOTAL, grosor: 2.4, puntos: true,
    };
    const objetivoMC = {
      nombre: t("t4.b7.serieMC", "Objetivo de MC: el resultado real (43)"),
      color: tono("--peligro"), x: TRANSCURRIDO, y: TRANSCURRIDO.map(() => 43),
      discontinua: true, grosor: 1.6,
    };
    const objetivoTD = {
      nombre: t("t4.b7.serieTD", "Objetivo de TD(0): la estimación siguiente"),
      color: tono("--azul"), x: TRANSCURRIDO, y: SIGUIENTE,
      discontinua: true, grosor: 1.6, puntos: true,
    };
    cuerpoMC.replaceChildren(graficaLineas([prevision, objetivoMC], comun));
    conLeyenda(cuerpoMC, [prevision, objetivoMC]);
    cuerpoTD.replaceChildren(graficaLineas([prevision, objetivoTD], comun));
    conLeyenda(cuerpoTD, [prevision, objetivoTD]);
  }

  pintarFigura();
  parrafo(zona, "suave", t("t4.b7.pie",
    "Con Monte Carlo todas las correcciones apuntan al mismo número, 43, y hay que esperar a "
    + "llegar a casa para hacerlas. Con TD(0) cada estimación se mueve hacia la siguiente, y se "
    + "puede corregir un paso después."));
  repintadores.push(pintarFigura);
}

/** B8 — los tres diagramas de backup y el cuadrado de la visión unificada. */
function figuraBackups() {
  const zona = $("#b8-backups");
  const zonaCuadrado = $("#b8-cuadrado");

  if (zona) {
    /* Los tres en fila. `auto-fit` con un máximo por columna —y minmax(0, …),
       nunca 1fr— hace que en móvil se apilen solos, sin media query: la pista
       no puede crecer más de lo que mide el diagrama, así que no desborda. */
    const fila = document.createElement("div");
    fila.style.display = "grid";
    fila.style.gap = "1.25rem";
    fila.style.gridTemplateColumns = "repeat(auto-fit, minmax(0, 260px))";
    fila.style.alignItems = "start";
    zona.appendChild(fila);

    const columnas = [0, 1, 2].map(() => {
      const col = document.createElement("div");
      fila.appendChild(col);
      return col;
    });
    const cuerpos = [
      caja(columnas[0], t("t4.b8.backupMC", "Monte Carlo: una rama, hasta el terminal")),
      caja(columnas[1], t("t4.b8.backupTD", "TD(0): una rama, un solo paso")),
      caja(columnas[2], t("t4.b8.backupDP",
        "Programación dinámica: todas las ramas, un solo nivel")),
    ];

    const repintarBackups = () => {
      /* `cadenaBackup` es la abstracción que separa de verdad a los tres: una
         cadena larga que llega al terminal, un solo paso, y un solo paso con
         todas las ramas. El «⋮» y el cuadrado terminal los pone el componente.
         Los rótulos van con <sub>, que es lo que `textoSvg` sabe componer. */
      pintar(cuerpos[0], cadenaBackup({
        pasos: 3, truncar: true, terminal: true, etiquetas: ["S<sub>t</sub>"],
      }));
      pintar(cuerpos[1], cadenaBackup({
        pasos: 1, etiquetas: ["S<sub>t</sub>", "S<sub>t+1</sub>"],
      }));
      pintar(cuerpos[2], cadenaBackup({
        pasos: 1, ramas: 3, etiquetas: ["S<sub>t</sub>"],
      }));
    };
    repintarBackups();
    parrafo(zona, "suave", t("t4.b8.pie",
      "Los tres parten del mismo estado. Lo que cambia es qué parte del árbol de futuros entra "
      + "en la actualización: la <strong>anchura</strong> —una rama muestreada o todas las que "
      + "el modelo conoce— y la <strong>profundidad</strong> —un paso o hasta el terminal—. El "
      + "cuadrado es el estado terminal y los puntos suspensivos, el resto del episodio."));
    repintadores.push(repintarBackups);
  }

  if (!zonaCuadrado) return;
  const cuerpo = caja(zonaCuadrado, t("t4.b8.cuadrado",
    "La visión unificada: anchura y profundidad de la actualización"));

  function pintarCuadrado() {
    const ancho = 700;
    const alto = 380;
    const svg = el("svg", {
      viewBox: `0 0 ${ancho} ${alto}`, width: ancho, height: alto, role: "img",
      style: "max-width:100%;height:auto",
    });
    const linea = tono("--borde-fuerte");
    const suave = tono("--texto-suave");
    const texto = tono("--texto");
    const izquierda = 120;
    const arriba = 60;
    const derecha = ancho - 60;
    const abajo = alto - 70;

    svg.appendChild(el("rect", {
      x: izquierda, y: arriba, width: derecha - izquierda, height: abajo - arriba,
      fill: tono("--superficie-2"), stroke: linea, "stroke-width": 1.4, rx: 6,
    }));

    const punta = defsPunta(svg, linea);
    svg.appendChild(el("line", {
      x1: izquierda, y1: abajo + 26, x2: derecha, y2: abajo + 26,
      stroke: linea, "stroke-width": 1.4, "marker-end": `url(#${punta})`,
    }));
    svg.appendChild(el("line", {
      x1: izquierda - 26, y1: arriba, x2: izquierda - 26, y2: abajo,
      stroke: linea, "stroke-width": 1.4, "marker-end": `url(#${punta})`,
    }));
    svg.appendChild(el("text", {
      x: (izquierda + derecha) / 2, y: abajo + 48, "text-anchor": "middle",
      "font-size": 12.5, "font-weight": 700, fill: suave,
    }, t("t4.b8.ejeAncho", "Anchura de la actualización")));
    svg.appendChild(el("text", {
      x: izquierda - 44, y: (arriba + abajo) / 2, "text-anchor": "middle",
      "font-size": 12.5, "font-weight": 700, fill: suave,
      transform: `rotate(-90 ${izquierda - 44} ${(arriba + abajo) / 2})`,
    }, t("t4.b8.ejeProfundo", "Profundidad de la actualización")));
    svg.appendChild(el("text", {
      x: izquierda, y: abajo + 62, "font-size": 11, fill: suave,
    }, t("t4.b8.anchoIzq", "una muestra")));
    svg.appendChild(el("text", {
      x: derecha, y: abajo + 62, "text-anchor": "end", "font-size": 11, fill: suave,
    }, t("t4.b8.anchoDch", "todos los sucesores")));

    /* Las esquinas de la derecha van más adentro que las de la izquierda: sus
       glosas son las largas y si no se salen del cuadrado. */
    const esquinas = [
      {
        x: izquierda + 78, y: arriba + 34, texto: "TD(0)",
        glosa: t("t4.b8.esqTD", "una rama, un paso"),
      },
      {
        x: derecha - 108, y: arriba + 34, texto: t("t4.b8.esqDPnombre", "Programación dinámica"),
        glosa: t("t4.b8.esqDP", "todas las ramas, un paso"),
      },
      {
        x: izquierda + 78, y: abajo - 34, texto: "Monte Carlo",
        glosa: t("t4.b8.esqMC", "una rama, hasta el final"),
      },
      {
        x: derecha - 108, y: abajo - 34, texto: t("t4.b8.esqBusqueda", "Búsqueda exhaustiva"),
        glosa: t("t4.b8.esqBus", "todas las ramas, hasta el final"),
      },
    ];
    for (const esquina of esquinas) {
      svg.appendChild(el("text", {
        x: esquina.x, y: esquina.y, "text-anchor": "middle", "font-size": 14,
        "font-weight": 700, fill: texto,
      }, esquina.texto));
      svg.appendChild(el("text", {
        x: esquina.x, y: esquina.y + 17, "text-anchor": "middle", "font-size": 11, fill: suave,
      }, esquina.glosa));
    }
    svg.appendChild(el("text", {
      x: (izquierda + derecha) / 2, y: (arriba + abajo) / 2, "text-anchor": "middle",
      "font-size": 12, "font-style": "italic", fill: suave,
    }, t("t4.b8.interior", "n pasos · TD(λ) — la segunda página de este tema")));
    pintar(cuerpo, svg);
  }

  pintarCuadrado();
  repintadores.push(pintarCuadrado);
}

/** B11 — el Windy Gridworld con su fila de vientos y un camino mínimo. */
function figuraWindy() {
  const zona = $("#b11-windy");
  if (!zona) return;
  const entorno = windyGridworld();
  const { filas, columnas, inicio, meta } = entorno.geometria;
  const cuerpo = caja(zona, t("t4.b11.figura",
    "Windy Gridworld 7×10, con un camino mínimo de 15 pasos"));

  /* El mínimo de 15 pasos se COMPRUEBA con una búsqueda en anchura sobre el
     propio entorno: es lo que confirma que la fila de vientos está bien leída
     de la figura del libro (S&B p. 152). */
  function caminoMinimo() {
    const previo = new Map([[inicio, null]]);
    const cola = [inicio];
    while (cola.length) {
      const s = cola.shift();
      if (s === meta) break;
      for (let a = 0; a < ACCIONES_NAV.length; a++) {
        const { s2 } = entorno.paso(s, a, null);
        if (previo.has(s2)) continue;
        previo.set(s2, { s, a });
        cola.push(s2);
      }
    }
    if (!previo.has(meta)) return { celdas: new Map(), pasos: null };
    const celdas = new Map();
    let actual = meta;
    let pasos = 0;
    while (previo.get(actual)) {
      const { s, a } = previo.get(actual);
      celdas.set(s, a);
      actual = s;
      pasos++;
    }
    return { celdas, pasos };
  }

  const { celdas: camino, pasos } = caminoMinimo();

  function pintarFigura() {
    const celdas = [];
    for (let s = 0; s < filas * columnas; s++) {
      const { fila, col } = entorno.geometria.posicion(s);
      const enCamino = camino.has(s);
      const especial = s === inicio || s === meta;
      const color = especial ? tono("--acento-tenue")
        : (enCamino ? tono("--superficie-2") : tono("--superficie"));
      celdas.push({
        fila,
        col,
        etiqueta: entorno.etiquetas[s] || null,
        tamano: 14,
        color,
        borde: enCamino || especial ? tono("--exito") : null,
        flechas: enCamino ? [ACCIONES_NAV[camino.get(s)]] : null,
        colorFlecha: tono("--exito"),
        titulo: t("t4.b11.celda", "Columna {c}, viento {v}", { c: col + 1, v: VIENTO[col] }),
      });
    }
    const bandas = VIENTO.map((v, col) => ({
      fila: filas - 1, col, ancho: 1, alto: 1, color: "none", texto: String(v),
    }));
    pintar(cuerpo, rejilla({ celdas, lado: 46, etiquetasBanda: bandas }));
  }

  pintarFigura();
  parrafo(zona, "suave", t("t4.b11.pie",
    "La fila de números bajo la rejilla es el viento de cada columna, en celdas hacia arriba. "
    + "La búsqueda en anchura sobre este entorno da {n} pasos de S a G, que es exactamente lo "
    + "que declara el libro: la comprobación de que la fila de vientos está bien leída.",
    { n: pasos === null ? "—" : pasos }));
  repintadores.push(pintarFigura);
}

/* ======================================================================= *
 * Arranque
 * ======================================================================= */

figuraTraza();
figuraDrivingHome();
figuraBackups();
figuraWindy();

modulo1();
modulo2();
modulo3();
modulo4();

renderizarMatematicas();
