/* ==========================================================================
   RL · IMAT — núcleo común de los recursos interactivos
   Sin dependencias. Módulo ES.

   Contiene:
     · generador aleatorio con semilla (reproducibilidad)
     · cuatro tipos de gráfica en SVG: líneas, violín, rejilla y árbol de backup
     · componente de autocomprobación (quiz)
     · conmutadores de tema y de modo clase
   ========================================================================== */

/* ----------------------------------------------------------------------- *
 * 1. Aleatoriedad reproducible
 * ----------------------------------------------------------------------- */

/**
 * Generador mulberry32: rápido, con semilla y estado propio.
 * Dos alumnos con la misma semilla ven exactamente la misma simulación.
 */
export function generador(semilla = 1) {
  let a = semilla >>> 0;
  const gen = {
    /** Uniforme en [0, 1). */
    uniforme() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    /** Entero en [0, n). */
    entero(n) {
      return Math.floor(gen.uniforme() * n);
    },
    /** Normal(mu, sigma) por Box-Muller. */
    normal(mu = 0, sigma = 1) {
      let u = 0;
      while (u === 0) u = gen.uniforme();
      const v = gen.uniforme();
      return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    /** Índice muestreado de un vector de probabilidades que suma 1. */
    categorica(probabilidades) {
      let acumulado = 0;
      const x = gen.uniforme();
      for (let i = 0; i < probabilidades.length; i++) {
        acumulado += probabilidades[i];
        if (x < acumulado) return i;
      }
      return probabilidades.length - 1;
    },
    /** Reinicia el estado interno. */
    reiniciar(nuevaSemilla) {
      a = (nuevaSemilla ?? semilla) >>> 0;
    },
  };
  return gen;
}

/** argmax con desempate aleatorio (evita el sesgo hacia el índice bajo). */
export function argmax(valores, rng) {
  let mejor = -Infinity;
  let empates = [];
  for (let i = 0; i < valores.length; i++) {
    if (valores[i] > mejor + 1e-12) {
      mejor = valores[i];
      empates = [i];
    } else if (Math.abs(valores[i] - mejor) <= 1e-12) {
      empates.push(i);
    }
  }
  if (empates.length === 1 || !rng) return empates[0];
  return empates[rng.entero(empates.length)];
}

/** Todos los índices que alcanzan el máximo (para detectar políticas óptimas múltiples). */
export function argmaxTodos(valores, tolerancia = 1e-9) {
  const mejor = Math.max(...valores);
  const indices = [];
  for (let i = 0; i < valores.length; i++) {
    if (valores[i] >= mejor - tolerancia) indices.push(i);
  }
  return indices;
}

/* ----------------------------------------------------------------------- *
 * 2. Utilidades de formato y color
 * ----------------------------------------------------------------------- */

export function num(x, decimales = 2) {
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString("es-ES", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

/**
 * Número para meter DENTRO de \( ... \). En LaTeX la coma es un separador y
 * lleva espacio detrás, así que "1,31" saldría como "1, 31". La convención
 * para la coma decimal es {,}.
 */
export function numMat(x, decimales = 2) {
  return num(x, decimales).replace(",", "{,}");
}

export function pct(x, decimales = 0) {
  return num(100 * x, decimales) + " %";
}

/** Lee una variable CSS del tema actual (para pintar el SVG con la paleta). */
export function tono(nombre) {
  return getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
}

/** Colores de serie, en el orden de las figuras de clase. */
export const COLORES_SERIE = [
  "--serie-1", "--serie-2", "--serie-3", "--serie-4", "--serie-5", "--serie-6", "--serie-7",
];

/**
 * Interpola el mapa de calor bajo → medio → alto con t en [0, 1].
 * Se usa para pintar v(s) sobre las rejillas.
 */
export function colorCalor(t) {
  const clampeado = Math.max(0, Math.min(1, t));
  const bajo = hexARgb(tono("--calor-bajo"));
  const medio = hexARgb(tono("--calor-medio"));
  const alto = hexARgb(tono("--calor-alto"));
  const [a, b, f] = clampeado < 0.5
    ? [bajo, medio, clampeado * 2]
    : [medio, alto, (clampeado - 0.5) * 2];
  const mezcla = a.map((canal, i) => Math.round(canal + (b[i] - canal) * f));
  return `rgb(${mezcla.join(",")})`;
}

function hexARgb(hex) {
  const limpio = hex.replace("#", "").trim();
  const completo = limpio.length === 3 ? limpio.split("").map((c) => c + c).join("") : limpio;
  const n = parseInt(completo, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** ¿El color de fondo de una celda pide texto claro u oscuro? */
export function textoSobre(colorRgb) {
  const m = colorRgb.match(/\d+/g);
  if (!m) return "var(--texto)";
  const [r, g, b] = m.map(Number);
  const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminancia > 0.58 ? "#1a1a1a" : "#ffffff";
}

/* ----------------------------------------------------------------------- *
 * 3. Construcción de SVG
 * ----------------------------------------------------------------------- */

const NS = "http://www.w3.org/2000/svg";

/** Crea un elemento SVG con atributos y contenido de texto o hijos. */
export function el(etiqueta, atributos = {}, contenido = null) {
  const nodo = document.createElementNS(NS, etiqueta);
  for (const [clave, valor] of Object.entries(atributos)) {
    if (valor === null || valor === undefined) continue;
    nodo.setAttribute(clave, String(valor));
  }
  if (typeof contenido === "string" || typeof contenido === "number") {
    nodo.textContent = String(contenido);
  } else if (Array.isArray(contenido)) {
    contenido.forEach((hijo) => hijo && nodo.appendChild(hijo));
  } else if (contenido) {
    nodo.appendChild(contenido);
  }
  return nodo;
}

function lienzo(ancho, alto) {
  return el("svg", {
    viewBox: `0 0 ${ancho} ${alto}`,
    width: ancho,
    height: alto,
    role: "img",
    style: "max-width:100%;height:auto",
  });
}

/* ----------------------------------------------------------------------- *
 * 4. Gráfica de líneas
 * ----------------------------------------------------------------------- */

/**
 * series: [{ nombre, color, y: number[], x?: number[] }]
 * opciones: { ancho, alto, ejeX, ejeY, yMin, yMax, escalaX, ticksX,
 *             formatoY, lineaCero, anotaciones: [{x, texto}] }
 */
export function graficaLineas(series, opciones = {}) {
  const {
    ancho = 660,
    alto = 300,
    ejeX = "",
    ejeY = "",
    escalaX = "lineal",
    ticksX = null,
    formatoY = (v) => num(v, 2),
    lineaCero = false,
    anotaciones = [],
    mensaje = "Sin datos todavía.",
  } = opciones;

  const m = { i: 58, d: 14, s: 14, f: 42 };
  const w = ancho - m.i - m.d;
  const h = alto - m.s - m.f;
  const svg = lienzo(ancho, alto);
  const ejeColor = tono("--borde-fuerte");
  const textoColor = tono("--texto-suave");

  const visibles = series.filter((s) => s.y && s.y.length);
  if (!visibles.length) {
    svg.appendChild(el("text", {
      x: ancho / 2, y: alto / 2, "text-anchor": "middle",
      fill: textoColor, "font-size": 13,
    }, mensaje));
    return svg;
  }

  const xDe = (s, i) => (s.x ? s.x[i] : i + 1);
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = opciones.yMin;
  let yMax = opciones.yMax;
  let yMinAuto = Infinity;
  let yMaxAuto = -Infinity;
  for (const s of visibles) {
    for (let i = 0; i < s.y.length; i++) {
      const x = xDe(s, i);
      if (x < xMin) xMin = x;
      if (x > xMax) xMax = x;
      const y = s.y[i];
      if (Number.isFinite(y)) {
        if (y < yMinAuto) yMinAuto = y;
        if (y > yMaxAuto) yMaxAuto = y;
      }
    }
  }
  if (yMin === undefined) yMin = yMinAuto;
  if (yMax === undefined) yMax = yMaxAuto;
  if (yMax - yMin < 1e-9) { yMax += 0.5; yMin -= 0.5; }
  const margenY = (yMax - yMin) * 0.06;
  if (opciones.yMin === undefined) yMin -= margenY;
  if (opciones.yMax === undefined) yMax += margenY;

  const log = escalaX === "log2";
  const tx = (x) => {
    if (log) {
      const lo = Math.log2(xMin);
      const hi = Math.log2(xMax);
      return m.i + ((Math.log2(x) - lo) / (hi - lo || 1)) * w;
    }
    return m.i + ((x - xMin) / (xMax - xMin || 1)) * w;
  };
  const ty = (y) => m.s + h - ((y - yMin) / (yMax - yMin)) * h;

  /* --- rejilla y eje Y --- */
  const pasosY = 5;
  for (let k = 0; k <= pasosY; k++) {
    const valor = yMin + ((yMax - yMin) * k) / pasosY;
    const y = ty(valor);
    svg.appendChild(el("line", {
      x1: m.i, x2: m.i + w, y1: y, y2: y,
      stroke: ejeColor, "stroke-width": 0.5, opacity: k === 0 ? 0.9 : 0.28,
    }));
    svg.appendChild(el("text", {
      x: m.i - 8, y: y + 4, "text-anchor": "end",
      fill: textoColor, "font-size": 11, "font-family": "monospace",
    }, formatoY(valor)));
  }

  /* --- eje X --- */
  const marcas = ticksX || marcasAutomaticas(xMin, xMax, log);
  for (const marca of marcas) {
    const x = tx(marca.valor ?? marca);
    const etiqueta = marca.etiqueta ?? String(marca);
    svg.appendChild(el("line", {
      x1: x, x2: x, y1: m.s, y2: m.s + h,
      stroke: ejeColor, "stroke-width": 0.5, opacity: 0.18,
    }));
    svg.appendChild(el("text", {
      x, y: m.s + h + 16, "text-anchor": "middle",
      fill: textoColor, "font-size": 11, "font-family": "monospace",
    }, etiqueta));
  }

  if (lineaCero && yMin < 0 && yMax > 0) {
    svg.appendChild(el("line", {
      x1: m.i, x2: m.i + w, y1: ty(0), y2: ty(0),
      stroke: ejeColor, "stroke-width": 1, "stroke-dasharray": "4 3", opacity: 0.8,
    }));
  }

  /* --- anotaciones verticales (p. ej. "aquí cambia el entorno") --- */
  for (const a of anotaciones) {
    const x = tx(a.x);
    svg.appendChild(el("line", {
      x1: x, x2: x, y1: m.s, y2: m.s + h,
      stroke: tono("--acento"), "stroke-width": 1.2, "stroke-dasharray": "5 4",
    }));
    svg.appendChild(el("text", {
      x: x + 5, y: m.s + 12, fill: tono("--acento"), "font-size": 11, "font-weight": 600,
    }, a.texto));
  }

  /* --- series (submuestreadas si hay muchos puntos) --- */
  visibles.forEach((s) => {
    const n = s.y.length;
    const salto = Math.max(1, Math.floor(n / 900));
    let d = "";
    for (let i = 0; i < n; i += salto) {
      if (!Number.isFinite(s.y[i])) continue;
      d += `${d ? "L" : "M"}${tx(xDe(s, i)).toFixed(2)} ${ty(s.y[i]).toFixed(2)}`;
    }
    const ultimo = n - 1;
    if ((ultimo % salto !== 0) && Number.isFinite(s.y[ultimo])) {
      d += `L${tx(xDe(s, ultimo)).toFixed(2)} ${ty(s.y[ultimo]).toFixed(2)}`;
    }
    svg.appendChild(el("path", {
      d, fill: "none", stroke: s.color, "stroke-width": s.grosor ?? 1.9,
      "stroke-linejoin": "round", "stroke-linecap": "round",
      "stroke-dasharray": s.discontinua ? "5 4" : null,
    }));
    if (s.puntos) {
      for (let i = 0; i < n; i++) {
        if (!Number.isFinite(s.y[i])) continue;
        svg.appendChild(el("circle", {
          cx: tx(xDe(s, i)), cy: ty(s.y[i]), r: 3, fill: s.color,
        }));
      }
    }
  });

  /* --- rótulos de eje --- */
  if (ejeX) {
    svg.appendChild(el("text", {
      x: m.i + w / 2, y: alto - 6, "text-anchor": "middle",
      fill: textoColor, "font-size": 11.5, "font-weight": 600,
    }, ejeX));
  }
  if (ejeY) {
    svg.appendChild(el("text", {
      x: 12, y: m.s + h / 2, "text-anchor": "middle",
      fill: textoColor, "font-size": 11.5, "font-weight": 600,
      transform: `rotate(-90 12 ${m.s + h / 2})`,
    }, ejeY));
  }
  return svg;
}

function marcasAutomaticas(min, max, log) {
  if (log) {
    const marcas = [];
    for (let e = Math.ceil(Math.log2(min)); e <= Math.log2(max) + 1e-9; e++) {
      const v = 2 ** e;
      marcas.push({ valor: v, etiqueta: v < 1 ? `1/${Math.round(1 / v)}` : String(v) });
    }
    return marcas;
  }
  const objetivo = 5;
  const bruto = (max - min) / objetivo;
  const magnitud = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 2.5, 5, 10].map((k) => k * magnitud).find((p) => p >= bruto) || magnitud * 10;
  const marcas = [];
  for (let v = Math.ceil(min / paso) * paso; v <= max + 1e-9; v += paso) {
    marcas.push({ valor: v, etiqueta: formateaMarca(v) });
  }
  return marcas;
}

function formateaMarca(v) {
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)}k`;
  return String(Math.round(v * 100) / 100);
}

/* ----------------------------------------------------------------------- *
 * 5. Gráfica de violín — banco de pruebas de k brazos
 * ----------------------------------------------------------------------- */

/**
 * valores: q_*(a) de cada brazo. Dibuja la densidad N(q_*(a), sigma) en vertical.
 * Reproduce la figura del banco de pruebas de 10 brazos de clase.
 */
export function graficaViolin(valores, opciones = {}) {
  const {
    ancho = 660, alto = 320, sigma = 1,
    ejeY = "Distribución de la recompensa", ejeX = "Acción",
    resaltado = null, seleccion = null, alSeleccionar = null,
  } = opciones;

  const m = { i: 46, d: 52, s: 14, f: 42 };
  const w = ancho - m.i - m.d;
  const h = alto - m.s - m.f;
  const svg = lienzo(ancho, alto);
  const textoColor = tono("--texto-suave");
  const ejeColor = tono("--borde-fuerte");

  const yMin = Math.min(...valores) - 3.2 * sigma;
  const yMax = Math.max(...valores) + 3.2 * sigma;
  const ty = (y) => m.s + h - ((y - yMin) / (yMax - yMin)) * h;
  const paso = w / valores.length;
  const anchoViolin = Math.min(paso * 0.72, 46);

  for (let k = Math.ceil(yMin); k <= yMax; k++) {
    const y = ty(k);
    svg.appendChild(el("line", {
      x1: m.i, x2: m.i + w, y1: y, y2: y,
      stroke: ejeColor, "stroke-width": 0.5, opacity: k === 0 ? 0.85 : 0.2,
      "stroke-dasharray": k === 0 ? "4 3" : null,
    }));
    svg.appendChild(el("text", {
      x: m.i - 8, y: y + 4, "text-anchor": "end",
      fill: textoColor, "font-size": 11, "font-family": "monospace",
    }, String(k)));
  }

  const mejor = valores.indexOf(Math.max(...valores));

  valores.forEach((q, i) => {
    const cx = m.i + paso * (i + 0.5);
    const puntos = [];
    const N = 42;
    for (let j = 0; j <= N; j++) {
      const z = -3.2 + (6.4 * j) / N;
      const densidad = Math.exp(-0.5 * z * z);
      puntos.push([cx - (densidad * anchoViolin) / 2, ty(q + z * sigma)]);
    }
    for (let j = N; j >= 0; j--) {
      const z = -3.2 + (6.4 * j) / N;
      const densidad = Math.exp(-0.5 * z * z);
      puntos.push([cx + (densidad * anchoViolin) / 2, ty(q + z * sigma)]);
    }
    const d = puntos.map(([x, y], j) => `${j ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("") + "Z";

    const esOptima = i === mejor;
    const esResaltado = resaltado === i || seleccion === i;
    svg.appendChild(el("path", {
      d,
      fill: esOptima ? tono("--acento") : tono("--borde-fuerte"),
      opacity: esResaltado ? 0.85 : esOptima ? 0.55 : 0.35,
      stroke: esResaltado ? tono("--acento") : "none",
      "stroke-width": 1.5,
    }));
    svg.appendChild(el("line", {
      x1: cx - anchoViolin / 2, x2: cx + anchoViolin / 2, y1: ty(q), y2: ty(q),
      stroke: esOptima ? tono("--acento") : tono("--texto"), "stroke-width": 2,
    }));
    svg.appendChild(el("text", {
      x: cx + anchoViolin / 2 + 4, y: ty(q) + 3.5,
      fill: esOptima ? tono("--acento") : textoColor,
      "font-size": 10, "font-family": "monospace",
      "font-weight": esOptima ? 700 : 400,
    }, num(q, 2)));
    svg.appendChild(el("text", {
      x: cx, y: m.s + h + 16, "text-anchor": "middle",
      fill: esOptima ? tono("--acento") : textoColor,
      "font-size": 11.5, "font-weight": esOptima ? 700 : 500,
    }, String(i + 1)));

    if (alSeleccionar) {
      const zona = el("rect", {
        x: cx - paso / 2, y: m.s, width: paso, height: h,
        fill: "transparent", style: "cursor:pointer",
      });
      zona.addEventListener("click", () => alSeleccionar(i));
      svg.appendChild(el("title", {}, `Brazo ${i + 1}: q*(a) = ${num(q, 3)}`));
      svg.appendChild(zona);
    }
  });

  svg.appendChild(el("text", {
    x: m.i + w / 2, y: alto - 6, "text-anchor": "middle",
    fill: textoColor, "font-size": 11.5, "font-weight": 600,
  }, ejeX));
  svg.appendChild(el("text", {
    x: 12, y: m.s + h / 2, "text-anchor": "middle",
    fill: textoColor, "font-size": 11.5, "font-weight": 600,
    transform: `rotate(-90 12 ${m.s + h / 2})`,
  }, ejeY));
  return svg;
}

/* ----------------------------------------------------------------------- *
 * 6. Rejilla (gridworld)
 * ----------------------------------------------------------------------- */

/**
 * Dibuja una rejilla de estados. Es el lienzo de todos los módulos del Tema 2.
 *
 * config: {
 *   filas, columnas, celdas: [{ fila, col, etiqueta, subetiqueta, color, borde,
 *                               textoColor, cunas: [4 valores en orden N,S,O,E],
 *                               flechas: ['N','E'], atenuada, titulo }],
 *   lado, alSeleccionar(indiceCelda), seleccion, bandas: [{fila?,col?,texto,color}]
 * }
 */
export function rejilla(config) {
  const {
    celdas, lado = 74, alSeleccionar = null, seleccion = null,
    etiquetasBanda = [], margen = 26,
  } = config;

  const maxCol = Math.max(...celdas.map((c) => c.col));
  const maxFila = Math.max(...celdas.map((c) => c.fila));
  const ancho = (maxCol + 1) * lado + margen * 2;
  const alto = (maxFila + 1) * lado + margen * 2;
  const svg = lienzo(ancho, alto);
  const bordeColor = tono("--borde-fuerte");

  for (const banda of etiquetasBanda) {
    const x = margen + (banda.col ?? 0) * lado;
    const y = margen + (banda.fila ?? 0) * lado;
    const w = (banda.ancho ?? 1) * lado;
    const h = (banda.alto ?? 1) * lado;
    svg.appendChild(el("rect", {
      x, y, width: w, height: h, fill: banda.color, opacity: 0.9, rx: 4,
    }));
    if (banda.texto) {
      svg.appendChild(el("text", {
        x: x + w / 2, y: banda.textoArriba ? y - 7 : y + h + 14,
        "text-anchor": "middle", "font-size": 11, "font-weight": 650,
        fill: banda.textoColor || tono("--texto-suave"),
      }, banda.texto));
    }
  }

  celdas.forEach((c, indice) => {
    const x = margen + c.col * lado;
    const y = margen + c.fila * lado;
    const grupo = el("g", { style: alSeleccionar ? "cursor:pointer" : null });

    grupo.appendChild(el("rect", {
      x, y, width: lado, height: lado,
      fill: c.color || tono("--superficie"),
      stroke: seleccion === indice ? tono("--acento") : (c.borde || bordeColor),
      "stroke-width": seleccion === indice ? 3.5 : 1.4,
      opacity: c.atenuada ? 0.4 : 1,
      rx: 3,
    }));

    /* cuñas triangulares con q(s,a): N, S, O, E */
    if (c.cunas) {
      const cx = x + lado / 2;
      const cy = y + lado / 2;
      const esquinas = {
        N: [[x, y], [x + lado, y]],
        S: [[x, y + lado], [x + lado, y + lado]],
        O: [[x, y], [x, y + lado]],
        E: [[x + lado, y], [x + lado, y + lado]],
      };
      const posTexto = {
        N: [cx, y + 15], S: [cx, y + lado - 7],
        O: [x + 15, cy + 4], E: [x + lado - 15, cy + 4],
      };
      ["N", "S", "O", "E"].forEach((dir, k) => {
        const cuna = c.cunas[k];
        if (!cuna) return;
        const [p1, p2] = esquinas[dir];
        grupo.appendChild(el("polygon", {
          points: `${p1[0]},${p1[1]} ${p2[0]},${p2[1]} ${cx},${cy}`,
          fill: cuna.color, opacity: 0.92,
          stroke: tono("--superficie"), "stroke-width": 0.6,
        }));
        grupo.appendChild(el("text", {
          x: posTexto[dir][0], y: posTexto[dir][1], "text-anchor": "middle",
          "font-size": 10, "font-family": "monospace", "font-weight": cuna.mejor ? 700 : 400,
          fill: cuna.textoColor || tono("--texto"),
        }, cuna.texto));
      });
    }

    if (c.etiqueta !== undefined && c.etiqueta !== null) {
      grupo.appendChild(el("text", {
        x: x + lado / 2, y: y + lado / 2 + (c.subetiqueta ? -2 : 6),
        "text-anchor": "middle",
        "font-size": c.tamano || (c.cunas ? 13 : 19),
        "font-weight": 600, fill: c.textoColor || tono("--texto"),
        "font-family": c.mono ? "monospace" : "inherit",
      }, c.etiqueta));
    }
    if (c.subetiqueta) {
      grupo.appendChild(el("text", {
        x: x + lado / 2, y: y + lado / 2 + 15, "text-anchor": "middle",
        "font-size": 12, "font-family": "monospace",
        fill: c.textoColor || tono("--texto-suave"),
      }, c.subetiqueta));
    }

    /* flechas de política */
    if (c.flechas && c.flechas.length) {
      const cx = x + lado / 2;
      const cy = y + lado / 2 + (c.etiqueta ? 16 : 0);
      const largo = lado * 0.26;
      const delta = { N: [0, -1], S: [0, 1], O: [-1, 0], E: [1, 0] };
      c.flechas.forEach((dir) => {
        const [dx, dy] = delta[dir];
        grupo.appendChild(el("line", {
          x1: cx, y1: cy, x2: cx + dx * largo, y2: cy + dy * largo,
          stroke: c.colorFlecha || tono("--acento"), "stroke-width": 2.6,
          "stroke-linecap": "round", "marker-end": "url(#punta)",
        }));
      });
    }

    if (c.titulo) grupo.appendChild(el("title", {}, c.titulo));
    if (alSeleccionar) grupo.addEventListener("click", () => alSeleccionar(indice, c));
    svg.appendChild(grupo);
  });

  /* punta de flecha */
  const defs = el("defs", {}, el("marker", {
    id: "punta", viewBox: "0 0 10 10", refX: 8, refY: 5,
    markerWidth: 5, markerHeight: 5, orient: "auto-start-reverse",
  }, el("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: tono("--acento") })));
  svg.insertBefore(defs, svg.firstChild);

  return svg;
}

/* ----------------------------------------------------------------------- *
 * 7. Árbol de backup
 * ----------------------------------------------------------------------- */

/**
 * ramas: [{ accion, nodos: [{ estado, recompensa, probabilidad }] }]
 * Reproduce la notación de los diagramas de backup de clase: estado raíz
 * arriba, nodos de acción (puntos negros) en medio, estados sucesores abajo.
 */
export function arbolBackup(estadoRaiz, ramas, opciones = {}) {
  const { ancho = 560, mostrarProbabilidad = true, titulo = null } = opciones;
  const hojasTotales = ramas.reduce((n, r) => n + r.nodos.length, 0);
  const alto = 250;
  const svg = lienzo(ancho, alto);
  const colorTexto = tono("--texto");
  const colorSuave = tono("--texto-suave");
  const colorLinea = tono("--borde-fuerte");

  const yRaiz = 34;
  const yAccion = 118;
  const yHoja = 206;
  const xRaiz = ancho / 2;

  if (titulo) {
    svg.appendChild(el("text", {
      x: 8, y: 14, "font-size": 11, "font-weight": 650, fill: colorSuave,
    }, titulo));
  }

  /* posiciones horizontales de las hojas, repartidas uniformemente */
  const margenLateral = 42;
  const util = ancho - margenLateral * 2;
  const xsHoja = [];
  for (let i = 0; i < hojasTotales; i++) {
    xsHoja.push(margenLateral + (util * (i + 0.5)) / hojasTotales);
  }

  let indiceHoja = 0;
  ramas.forEach((rama) => {
    const xs = rama.nodos.map(() => xsHoja[indiceHoja++]);
    const xAccion = xs.reduce((a, b) => a + b, 0) / xs.length;

    svg.appendChild(el("line", {
      x1: xRaiz, y1: yRaiz + 15, x2: xAccion, y2: yAccion - 6,
      stroke: colorLinea, "stroke-width": 1.4,
    }));
    svg.appendChild(el("circle", { cx: xAccion, cy: yAccion, r: 5.5, fill: colorTexto }));
    svg.appendChild(el("text", {
      x: xAccion - 12, y: yAccion + 4, "text-anchor": "end",
      "font-size": 12, "font-weight": 650, fill: tono("--azul"),
    }, rama.accion));

    rama.nodos.forEach((nodo, j) => {
      const x = xs[j];
      svg.appendChild(el("line", {
        x1: xAccion, y1: yAccion + 6, x2: x, y2: yHoja - 16,
        stroke: colorLinea, "stroke-width": 1.4,
      }));
      const etiquetas = [];
      if (mostrarProbabilidad && nodo.probabilidad !== undefined && nodo.probabilidad < 0.999) {
        etiquetas.push(num(nodo.probabilidad, 2));
      }
      etiquetas.push(`r=${nodo.recompensa}`);
      svg.appendChild(el("text", {
        x: (xAccion + x) / 2 + 6, y: (yAccion + yHoja) / 2 - 2,
        "font-size": 10.5, "font-family": "monospace",
        fill: nodo.recompensa < -1 ? tono("--mal") : colorSuave,
        "font-weight": nodo.recompensa < -1 ? 700 : 400,
      }, etiquetas.join("  ")));
      svg.appendChild(el("circle", {
        cx: x, cy: yHoja, r: 15,
        fill: tono("--superficie"), stroke: colorLinea, "stroke-width": 1.6,
      }));
      svg.appendChild(el("text", {
        x, y: yHoja + 5, "text-anchor": "middle",
        "font-size": 13, "font-weight": 600, fill: colorTexto,
      }, String(nodo.estado)));
    });
  });

  svg.appendChild(el("circle", {
    cx: xRaiz, cy: yRaiz, r: 16,
    fill: tono("--acento-tenue"), stroke: tono("--acento"), "stroke-width": 2,
  }));
  svg.appendChild(el("text", {
    x: xRaiz, y: yRaiz + 5, "text-anchor": "middle",
    "font-size": 14, "font-weight": 700, fill: tono("--acento"),
  }, String(estadoRaiz)));

  return svg;
}

/* ----------------------------------------------------------------------- *
 * 8. Autocomprobación
 * ----------------------------------------------------------------------- */

/**
 * preguntas: [{ enunciado (HTML), opciones: [HTML], correcta: índice,
 *               explicacion (HTML) }]
 */
export function crearQuiz(contenedor, preguntas, titulo = "Comprueba que lo has entendido") {
  contenedor.classList.add("quiz");
  contenedor.innerHTML = `<h3>${titulo}</h3>`;

  preguntas.forEach((p, iPregunta) => {
    const bloque = document.createElement("div");
    bloque.className = "pregunta";
    const idOpciones = `q-${Math.random().toString(36).slice(2, 8)}`;
    bloque.innerHTML = `
      <p class="enunciado">${p.enunciado}</p>
      <div class="opciones" role="group" aria-label="Opciones de la pregunta ${iPregunta + 1}" id="${idOpciones}"></div>
      <div class="retro" hidden></div>`;
    const zonaOpciones = bloque.querySelector(".opciones");
    const retro = bloque.querySelector(".retro");

    p.opciones.forEach((texto, iOpcion) => {
      const boton = document.createElement("button");
      boton.className = "opcion";
      boton.type = "button";
      boton.innerHTML = `<span class="letra">${"abcdef"[iOpcion]})</span><span>${texto}</span>`;
      boton.addEventListener("click", () => {
        const acierto = iOpcion === p.correcta;
        [...zonaOpciones.children].forEach((otro, k) => {
          otro.disabled = true;
          if (k === p.correcta) otro.dataset.estado = "correcta";
          else if (k === iOpcion) otro.dataset.estado = "incorrecta";
        });
        retro.hidden = false;
        retro.dataset.estado = acierto ? "ok" : "mal";
        retro.innerHTML = `<strong>${acierto ? "Correcto." : "No es esa."}</strong> ${p.explicacion}`;
        renderizarMatematicas(retro);
      });
      zonaOpciones.appendChild(boton);
    });

    contenedor.appendChild(bloque);
  });
  renderizarMatematicas(contenedor);
}

/* ----------------------------------------------------------------------- *
 * 9. Chrome de la página: tema, modo clase, navegación, matemáticas
 * ----------------------------------------------------------------------- */

const CLAVE_TEMA = "rl-imat-tema";
const CLAVE_MODO = "rl-imat-modo";

function leerPreferencia(clave) {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function guardarPreferencia(clave, valor) {
  try {
    if (valor) localStorage.setItem(clave, valor);
    else localStorage.removeItem(clave);
  } catch {
    /* modo privado o almacenamiento bloqueado: seguimos sin persistir */
  }
}

/** Renderiza LaTeX con KaTeX si está disponible; si no, deja el texto tal cual. */
export function renderizarMatematicas(raiz = document.body) {
  if (typeof window === "undefined" || !window.renderMathInElement) return;
  try {
    window.renderMathInElement(raiz, {
      delimiters: [
        { left: "\\(", right: "\\)", display: false },
        { left: "$$", right: "$$", display: true },
        { left: "\\[", right: "\\]", display: true },
      ],
      throwOnError: false,
    });
  } catch {
    /* si KaTeX falla, el texto plano sigue siendo legible */
  }
}

/** Suscribe una función a los cambios de tema, para repintar los SVG. */
const suscriptoresTema = [];
export function alCambiarTema(fn) {
  suscriptoresTema.push(fn);
}

function avisarCambioTema() {
  suscriptoresTema.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error("Error al repintar tras cambiar de tema", e);
    }
  });
}

/**
 * Monta los conmutadores de la cabecera y marca el enlace de navegación activo.
 * Se llama una vez por página.
 */
export function iniciarPagina() {
  const raiz = document.documentElement;

  // La URL manda sobre lo guardado: permite dejar un enlace directo al modo
  // clase o a un tema concreto (p. ej. tema1.html?modo=clase&tema=oscuro).
  const parametros = new URLSearchParams(location.search);
  const temaUrl = parametros.get("tema");
  const modoUrl = parametros.get("modo");

  const temaGuardado = leerPreferencia(CLAVE_TEMA);
  if (temaUrl === "oscuro" || temaUrl === "claro") raiz.dataset.tema = temaUrl;
  else if (temaGuardado) raiz.dataset.tema = temaGuardado;

  if (modoUrl === "clase") raiz.dataset.modo = "clase";
  else if (modoUrl === "normal") delete raiz.dataset.modo;
  else if (leerPreferencia(CLAVE_MODO) === "clase") raiz.dataset.modo = "clase";

  const zona = document.querySelector(".herramientas");
  if (zona) {
    const btnModo = document.createElement("button");
    btnModo.type = "button";
    btnModo.textContent = "Modo clase";
    btnModo.title = "Amplía la tipografía y oculta el texto explicativo (para proyector)";
    btnModo.setAttribute("aria-pressed", String(raiz.dataset.modo === "clase"));
    btnModo.addEventListener("click", () => {
      const activo = raiz.dataset.modo === "clase";
      if (activo) delete raiz.dataset.modo;
      else raiz.dataset.modo = "clase";
      btnModo.setAttribute("aria-pressed", String(!activo));
      guardarPreferencia(CLAVE_MODO, activo ? null : "clase");
      avisarCambioTema();
    });

    const btnTema = document.createElement("button");
    btnTema.type = "button";
    btnTema.className = "icono-boton";
    btnTema.title = "Cambiar entre tema claro y oscuro";
    btnTema.setAttribute("aria-label", "Cambiar tema");
    const pintaIcono = () => {
      const oscuroActivo = raiz.dataset.tema
        ? raiz.dataset.tema === "oscuro"
        : window.matchMedia("(prefers-color-scheme: dark)").matches;
      btnTema.textContent = oscuroActivo ? "☀" : "☾";
    };
    pintaIcono();
    btnTema.addEventListener("click", () => {
      const oscuroActivo = raiz.dataset.tema
        ? raiz.dataset.tema === "oscuro"
        : window.matchMedia("(prefers-color-scheme: dark)").matches;
      raiz.dataset.tema = oscuroActivo ? "claro" : "oscuro";
      guardarPreferencia(CLAVE_TEMA, raiz.dataset.tema);
      pintaIcono();
      avisarCambioTema();
    });

    zona.append(btnModo, btnTema);
  }

  const aqui = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".cabecera nav a").forEach((a) => {
    if (a.getAttribute("href") === aqui) a.setAttribute("aria-current", "true");
  });

  window.addEventListener("load", () => renderizarMatematicas());
  renderizarMatematicas();
}

/* ----------------------------------------------------------------------- *
 * 10. Ayudas de interfaz
 * ----------------------------------------------------------------------- */

/** Sustituye el contenido de un contenedor por un SVG recién generado. */
export function pintar(contenedor, svgNuevo) {
  contenedor.replaceChildren(svgNuevo);
}

/** Construye una leyenda de series bajo una gráfica. */
export function leyenda(series) {
  const div = document.createElement("div");
  div.className = "leyenda";
  div.innerHTML = series
    .map((s) => `<span><i style="background:${s.color}"></i>${s.nombre}</span>`)
    .join("");
  return div;
}

/** Enlaza un input range con su etiqueta de valor y un callback. */
export function deslizador(input, salida, alCambiar, formato = (v) => v) {
  const actualiza = () => {
    const v = parseFloat(input.value);
    if (salida) salida.textContent = formato(v);
    alCambiar(v);
  };
  input.addEventListener("input", actualiza);
  if (salida) salida.textContent = formato(parseFloat(input.value));
  return actualiza;
}
