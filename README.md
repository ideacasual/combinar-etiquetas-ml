# [ARCHIVADO] Optimizador de Etiquetas (v1 - 2 por hoja)

> ** ATENCIÓN: Este repositorio está obsoleto y ya no recibe mantenimiento.**
>
> **Te recomiendo encontrar la nueva versión mejorada aquí:**  
> **[Ir al Nuevo Optimizador de Etiquetas (Soporte para 3 por hoja)](https://github.com/ideacasual/combinador-etiquetas-ml-triple)**

---

### Acerca de esta versión

Esta fue la primera iteración de la herramienta, diseñada originalmente para combinar hasta **dos** etiquetas de Mercado Libre en una sola hoja A4.

Aunque cumplía su función de ahorrar papel al fusionar la etiqueta (página 1) y la info del producto (página 2), esta versión ha sido reemplazada por una arquitectura completamente nueva y optimizada.

### ¿Por qué fue reemplazada?

La **nueva versión** del proyecto introduce mejoras significativas que hacen que esta versión quede en desuso:

1. **Más ahorro:** Ahora soporta el modo **"Triple"**, permitiendo combinar hasta **3 etiquetas** en una sola hoja A4, maximizando el ahorro de papel.
2. **Rendimiento superior:** Se reescribió el motor de procesamiento para manejar renderizado a 300 DPI con una gestión de memoria agresiva, evitando bloqueos o crashes en el navegador.
3. **Validación más robusta:** Mejor detección de orientaciones y prevención de errores antes del procesamiento.

---

### Cómo funcionaba (Referencia histórica)

1. Se subían archivos `.pdf` de exactamente 2 páginas.
2. El sistema tomaba la Página 1 (apaisada) y la Página 2 (vertical).
3. Recortaba y escalaba la Página 2 para ubicarla en la esquina inferior.
4. Generaba una nueva hoja A4 con **máximo 2** de estas composiciones lado a lado.
5. El resultado final se convertía a escala de grises para ahorrar tinta.

---

### Privacidad (Aplica a todas las versiones)

Incluso en esta versión archivada, el principio fundamental se mantuvo: **100% de procesamiento local**. Ningún archivo se subió jamás a servidores externos.

---

### Aviso

- Este proyecto **NO** tiene ninguna relación, afiliación ni respaldo oficial de Mercado Libre.
- El software se proporciona "tal cual".

---

**¿Buscas la herramienta activa y actualizada?**  
No uses este código. Dirígete a la versión moderna aquí: [Sitio del Nuevo Proyecto](https://etiquetas.ideacasual.com/)
