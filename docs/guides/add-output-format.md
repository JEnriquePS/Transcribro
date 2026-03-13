# Guía: Agregar un nuevo formato de salida

Cómo agregar un formato de exportación (por ejemplo, `.csv`) al pipeline de transcripción.

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `backend/infrastructure/services/formatter.py` | Función que genera el nuevo formato |
| `backend/infrastructure/http/routes/jobs.py` | Agregar formato al endpoint de descarga |
| `frontend/src/ui/components/TranscriptViewer.tsx` | Tab de preview |
| `frontend/src/ui/components/DownloadButtons.tsx` | Botón de descarga |

## Pasos

### 1. Backend — generar el archivo

En `backend/infrastructure/services/formatter.py`, crear una función que reciba los segmentos y retorne el contenido formateado como string:

```python
def format_csv(segments: list[dict]) -> str:
    lines = ["start,end,text"]
    for seg in segments:
        text = seg["text"].replace('"', '""')
        lines.append(f'{seg["start"]},{seg["end"]},"{text}"')
    return "\n".join(lines)
```

### 2. Backend — llamar al formateador en el pipeline

En `backend/application/job_manager.py`, dentro del stage de formatting, guardar el nuevo archivo junto a los demás:

```python
csv_content = format_csv(result["segments"])
(job_dir / "transcript.csv").write_text(csv_content, encoding="utf-8")
```

### 3. Backend — servir el archivo en el endpoint de descarga

En `backend/infrastructure/http/routes/jobs.py`, agregar el media type en el diccionario de formatos del endpoint `GET /api/jobs/{job_id}/download`:

```python
media_types = {
    "txt": "text/plain",
    "json": "application/json",
    "srt": "text/plain",
    "vtt": "text/vtt",
    "csv": "text/csv",  # ← nuevo
}
```

### 4. Frontend — agregar tab de preview

En `frontend/src/ui/components/TranscriptViewer.tsx`, agregar `"csv"` al array de tabs disponibles.

### 5. Frontend — agregar botón de descarga

En `frontend/src/ui/components/DownloadButtons.tsx`, agregar `"csv"` al array de formatos.

## Verificación

1. Subir un archivo y esperar a que complete la transcripción
2. Verificar que `transcript.csv` existe en `data/jobs/{id}/`
3. Verificar que el tab CSV muestra el contenido en la interfaz
4. Verificar que el botón descarga el archivo correctamente
