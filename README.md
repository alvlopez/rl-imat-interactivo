# Recursos interactivos — Aprendizaje por Refuerzo (RL · IMAT)

Sitio estático con los recursos interactivos de la asignatura **Aprendizaje por Refuerzo**
(DEAC-IMAT-411), Grado en Ingeniería Matemática e Inteligencia Artificial, ICAI ·
Universidad Pontificia Comillas.

- `index.html` — portada
- `tema1.html` — Introducción y *k*-armed bandits (Sutton, cap. 1-2)
- `tema2.html` — Procesos de Decisión de Markov (Sutton, cap. 3)

---

## Principio de diseño

Cada módulo nace de una **pregunta que las diapositivas plantean y no pueden responder**
porque una imagen fija no llega: el cruce entre ε = 0.1 y ε = 0.01 ocurre más allá de los
1000 pasos que muestra la figura, el diagrama de backup de los estados 3 y 4 queda como
ejercicio, la política óptima puede no ser única… Si un módulo no responde a nada que la
diapositiva deje abierto, sobra.

| Diapositiva | Pregunta | Dónde se responde |
|---|---|---|
| `Tema1#slide-21` | ¿Se cumple \(\sum \alpha_n^2 < \infty\) para α constante? | T1 · módulo 3 |
| `Tema1#slide-24` | ¿Quién gana a la larga, ε = 0.1 o ε = 0.01? | T1 · módulo 3 |
| `Tema1#slide-25`, `#slide-26` | ¿Sensibilidad a cambios en el entorno? | T1 · módulo 3 |
| `Tema2#slide-8` | Las cuatro probabilidades \(p(s',r\mid s,a)\) | T2 · módulo 1 |
| `Tema2#slide-15` | ¿Cuántas ecuaciones salen de la cuadrícula? | T2 · módulo 3 |
| `Tema2#slide-18` | Diagrama de backup de los estados 3 y 4 | T2 · módulo 4 |
| `Tema2#slide-19` | ¿Puede haber varias políticas óptimas? | T2 · módulo 5 |

---

## Estructura

```
web/
├── index.html · tema1.html · tema2.html
├── assets/
│   ├── estilo.css          tokens de color, tema claro/oscuro, modo clase
│   ├── nucleo.js           RNG con semilla, gráficas SVG, quiz, chrome de página
│   ├── mdp.js              motor de MDP finitos (Tema 2)
│   ├── bandits.js          motor de k-armed bandits (Tema 1)
│   ├── calculo-worker.js   Web Worker para las simulaciones largas
│   ├── tema1.js            los cinco módulos del Tema 1
│   └── tema2.js            los cinco módulos del Tema 2
├── tests/                  node --test, sin dependencias
├── package.json            solo para los tests (GitHub Pages lo ignora)
└── .nojekyll               que Pages sirva los ficheros tal cual
```

**Sin framework y sin paso de compilación.** Es HTML, CSS y JavaScript con módulos ES:
se puede abrir un `.html`, entenderlo y editarlo. La única dependencia externa es
**KaTeX desde CDN**, y solo para tipografiar las fórmulas; si algún día hace falta una
versión sin red (para Moodle, por ejemplo), basta con copiar KaTeX al repositorio.

---

## Trabajar en local

```bash
npm test              # node --test "tests/*.test.js"  — 43 tests, sin dependencias
npm run servir        # sirve en http://localhost:8080
```

`npm run servir` usa `python -m http.server`. Cualquier servidor estático vale; **hace
falta uno**, porque los módulos ES no se cargan desde `file://`.

### Los tests

No comprueban «que el código no falle», sino **que el código reproduce el material de
clase**. Los importantes son los de contraste:

- El diagrama de backup del estado 1 de la rejilla 4×4 sale `N→1, S→5, O→1, E→2` con
  `r = −1`: exactamente el de `2_Tema2_wclp#slide-16`.
- Las cuatro probabilidades de `Tema2_MDP#slide-8` (material de Lucía) dan 1, 0, 0 y 1.
- `v_*` de la rejilla 3×3 coincide con la distancia Manhattan al terminal.
- ε = 0.1 alcanza ≈ 1.4 de recompensa media a los 1000 pasos, como la figura del libro.
- El estudio de parámetros sitúa los óptimos donde los sitúa la figura 2.6.
- **La opción correcta de un cuestionario sigue siendo la correcta después de barajar**
  (`tests/quiz.test.js`). Es el test que impide que el barajado convierta un acierto en
  un fallo.

### Material de referencia

La colección de referencia es **`Teoria/Diapos/MaterialAlvaro/`**, que es la que se usa
en clase: el T1 se cita como `1_Tema1#page-N` (solo hay PDF) y el T2 como
`2_Tema2_wclp#slide-N`. Cuando un contenido solo existe en el material de Lucía, la cita
lo dice explícitamente. La correspondencia entre las dos colecciones está en
`Teoria/referencia/mapa-diapositivas.md`.

Tres cosas están **solo** en el material de Lucía y se citan como tales: el estudio de
parámetros del módulo T1-M4 (figura 2.6, `Tema1_Intro#slide-29`), las cuatro
probabilidades literales de `Tema2_MDP#slide-8`, y la extensión del ejercicio de backup
al estado 4 (`Tema2_MDP#slide-18`; Álvaro pide solo el 3).

### El orden de las opciones de los cuestionarios

Las 27 preguntas se redactan con la correcta en primera posición, y `crearQuiz` las
baraja **en cada carga de página** (`barajarOpciones`, en `nucleo.js`). Es una excepción
deliberada a la reproducibilidad por semilla del resto del sitio: si el orden fuera
estable, «elige siempre la a)» sería una estrategia ganadora. Corolario: **ninguna
explicación puede referirse a una opción por letra ni por posición**, y hay un test que
lo vigila.

Si se toca un motor y uno de estos falla, lo que está mal es el código, no el test.

---

## Decisiones que conviene conocer

**El sentido del viento en la rejilla de navegación.** El enunciado dice «Viento Este» y
«Viento Sur» sin aclarar si el viento va hacia ese punto cardinal o viene de él, y eso
cambia todos los números. Lo resuelve la trayectoria T1 del problema 3 de
`Teoria/Problemas/Problemas.pdf`:

```
T1: (5,up), (1,right), (2,right), (3,right), (3,down), ...
                                   └── desde 3 va al este y NO se mueve
```

La celda 4 existe, así que no puede ser un rebote: la única regla que lo explica es «en
dirección opuesta al viento → 0.25 de probabilidad de no movernos». Por tanto el viento
Este **procede** del este y sopla hacia el oeste (convención meteorológica), y el viento
Sur sopla hacia el norte. Está implementado así, dicho en la propia página, y hay un
interruptor para ver el criterio contrario.

**El remolino.** «R = −5 si entramos en el remolino (S = 8)». Se ha implementado como
`r = −5` siempre que el estado siguiente sea el 8, incluido el caso de rebotar dentro de
él. Es una decisión discutible que conviene precisar en el enunciado.

**Número de ejecuciones.** Las figuras del libro promedian 2000 problemas; aquí el valor
por defecto es 200 para que la respuesta sea inmediata en clase. Es ajustable, y con 2000
las curvas quedan igual de suaves que en el libro.

---

## Publicación

Publicado en **GitHub Pages** desde la rama `main`, raíz del repositorio:

- Sitio: <https://alvlopez.github.io/rl-imat-interactivo/>
- Repositorio: <https://github.com/alvlopez/rl-imat-interactivo>

El fichero `.nojekyll` evita que Pages ignore nada. No hay nada que compilar: lo que hay
en el repositorio es lo que se sirve, así que basta con `git push` para actualizar.

Los parámetros de URL `?modo=clase` y `?tema=oscuro` (o `claro`) sirven para dejar un
enlace ya preparado para el proyector.

> **Aviso: este repositorio vive dentro de OneDrive.** Es cómodo, porque el código queda
> junto al resto del material de la asignatura, pero OneDrive sincroniza también el
> directorio `.git`. Con un solo equipo el riesgo es bajo; si algún día trabajas desde
> dos máquinas a la vez, conviene moverlo fuera de OneDrive para que la sincronización no
> corrompa el historial.

---

## Créditos

Basado en R. S. Sutton y A. G. Barto, *Reinforcement Learning: An Introduction*, 2.ª ed.,
MIT Press, 2018, y en el material de teoría de la asignatura.
