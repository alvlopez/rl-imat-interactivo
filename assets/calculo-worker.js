/* ==========================================================================
   RL · IMAT — worker de cálculo para el Tema 1
   Saca del hilo principal las simulaciones largas (comparador de estrategias
   y estudio de parámetros) para que la página no se congele.
   ========================================================================== */

import { ejecutar, barridoParametros } from "./bandits.js";

self.onmessage = (evento) => {
  const { tarea, id, config } = evento.data;
  const alProgresar = (fraccion) => self.postMessage({ tipo: "progreso", id, fraccion });

  try {
    if (tarea === "ejecutar") {
      const resultados = ejecutar({ ...config, alProgresar }).map((r) => ({
        id: r.id,
        recompensa: r.recompensa,
        optimo: r.optimo,
        recompensaTotal: r.recompensaTotal,
      }));
      self.postMessage({ tipo: "listo", id, resultados });
    } else if (tarea === "barrido") {
      const curvas = barridoParametros({ ...config, alProgresar });
      self.postMessage({ tipo: "listo", id, curvas });
    } else {
      self.postMessage({ tipo: "error", id, mensaje: `Tarea desconocida: ${tarea}` });
    }
  } catch (error) {
    self.postMessage({ tipo: "error", id, mensaje: String(error && error.message ? error.message : error) });
  }
};
