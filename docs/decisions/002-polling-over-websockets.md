# ADR-002: HTTP polling en lugar de WebSockets para actualizaciones en tiempo real

## Estado

Aceptado

## Contexto

El frontend necesita mostrar el progreso de transcripción en tiempo real (barra de progreso, transcripción parcial). Las opciones son:

1. **WebSockets** — conexión bidireccional persistente, push desde el servidor
2. **Server-Sent Events (SSE)** — conexión unidireccional del servidor al cliente
3. **HTTP polling** — el cliente consulta periódicamente al servidor

Los trabajos de transcripción duran de segundos a minutos. La latencia de actualización de 2-3 segundos es aceptable para la experiencia de usuario.

## Decisión

Usar **HTTP polling** con intervalos de 2 segundos (detalle de trabajo) y 3 segundos (lista de trabajos).

## Consecuencias

### Se facilita

- **Simplicidad de implementación** — endpoints REST estándar, sin gestión de conexiones persistentes
- **Sin estado de conexión** — cada request es independiente, no hay que manejar reconexiones
- **Compatibilidad total** — funciona detrás de cualquier proxy o load balancer sin configuración especial
- **Debugging sencillo** — las requests son visibles en DevTools como GET normales
- **El backend ya persiste estado en disco** — `metadata.json` y `partial_segments.json` se leen directamente

### Se dificulta

- **Mayor uso de red** — requests cada 2-3s incluso cuando no hay cambios
- **Latencia de hasta 2-3s** — el usuario no ve cambios instantáneamente
- **No escala a muchos clientes simultáneos** — cada cliente genera su propio tráfico de polling

### Mitigación futura

Si se necesita menor latencia o más clientes, migrar a SSE es sencillo: mismo modelo de datos, solo cambia el transporte.
