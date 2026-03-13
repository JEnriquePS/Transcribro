# ADR-003: Cola secuencial en lugar de procesamiento paralelo de trabajos

## Estado

Aceptado

## Contexto

Cuando se suben múltiples archivos (batch), el sistema debe decidir cómo procesarlos:

1. **Paralelo** — múltiples trabajos corriendo simultáneamente
2. **Secuencial (FIFO)** — un trabajo a la vez, en orden de llegada
3. **Pool limitado** — N trabajos en paralelo con un tope configurable

whisper.cpp consume recursos intensivos: CPU (8 hilos configurados), GPU (Metal) y memoria (el modelo large-v3 ocupa ~6 GB en memoria).

## Decisión

Usar una **cola secuencial** (`asyncio.Queue`) que procesa un trabajo a la vez en orden FIFO.

## Consecuencias

### Se facilita

- **Estabilidad** — un solo proceso de whisper.cpp a la vez evita contención de GPU/memoria
- **Predecibilidad** — cada trabajo tiene acceso completo a los recursos del sistema
- **Simplicidad** — no hay que gestionar concurrencia, locks, ni límites de pool
- **Reanudación limpia** — si un trabajo falla, el siguiente arranca con recursos liberados

### Se dificulta

- **Throughput** — los trabajos en cola esperan a que termine el anterior
- **Latencia para el usuario** — si hay 3 trabajos encolados, el tercero espera a que los dos anteriores terminen
- **Subutilización de recursos** — durante la extracción de audio (CPU-bound), la GPU está ociosa

### Mitigación futura

Migrar a un pool con `max_workers=2` si el hardware lo soporta, separando la etapa de extracción (CPU) de la transcripción (GPU).
