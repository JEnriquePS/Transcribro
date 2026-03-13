# ADR-001: Usar whisper.cpp en lugar de la API de OpenAI

## Estado

Aceptado

## Contexto

Transcribro necesita un motor de transcripción de audio a texto. Las opciones principales son:

1. **API de OpenAI Whisper** — servicio cloud, pago por uso
2. **whisper (Python)** — modelo original de OpenAI, requiere PyTorch + GPU CUDA
3. **whisper.cpp** — port en C/C++ optimizado para CPU e inferencia local con Metal (Apple Silicon)

El proyecto está diseñado para correr en una máquina local (Mac con Apple Silicon), sin dependencia de servicios cloud y sin costos recurrentes.

## Decisión

Usar **whisper.cpp** compilado desde source con aceleración Metal (GPU de Apple Silicon).

## Consecuencias

### Se facilita

- **Privacidad total** — los archivos nunca salen de la máquina local
- **Sin costos recurrentes** — no hay pago por minuto de audio
- **Sin límites de uso** — no hay rate limiting ni cuotas
- **Rendimiento en Apple Silicon** — Metal aprovecha la GPU integrada
- **Sin dependencia de internet** para transcribir (solo para descargar modelos)

### Se dificulta

- **Instalación más compleja** — requiere compilar desde source (cmake, git clone)
- **Solo macOS con Metal** — para otras plataformas hay que cambiar flags de compilación
- **Modelos grandes en disco** — de 77 MB (tiny) a 3 GB (large-v3) almacenados localmente
- **Integración via subprocess** — comunicación con whisper-cli via stdin/stdout/stderr en lugar de una API nativa
