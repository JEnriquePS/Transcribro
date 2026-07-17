import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import type { DrizzleJobRepository } from '../repositories/drizzle-job-repository'

const MIME_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4', '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo', '.mov': 'video/quicktime', '.webm': 'video/webm',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.flac': 'audio/flac', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4',
}

/**
 * Loopback-only HTTP server that streams a job's media files to
 * <video>/<audio> elements, with Range-request support for seeking.
 * Routes: /<jobId>/original (input.<ext>) and /<jobId>/extracted (audio.wav).
 * Bound to 127.0.0.1 on an OS-assigned port — never reachable off-device.
 * Plain Node `http` + `fs.createReadStream` is used instead of Electron's
 * `protocol.handle`: net.fetch() on file:// URLs does not reliably produce
 * 206/Accept-Ranges responses, and a hand-rolled Response(ReadableStream)
 * via protocol.handle broke Chromium's media demuxer (FFmpegDemuxer read
 * errors) — a real loopback HTTP response is the well-trodden path for
 * local media playback in Electron.
 */
export function startMediaServer(repo: DrizzleJobRepository): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const [jobId, kind] = (req.url ?? '').replace(/^\/+/, '').split('/')

      let filePath: string | null
      try {
        filePath = kind === 'extracted' ? repo.getExtractedAudioFile(jobId) : repo.getInputFile(jobId)
      } catch {
        res.writeHead(400).end()
        return
      }
      if (!filePath) {
        res.writeHead(404).end()
        return
      }

      const { size } = fs.statSync(filePath)
      const mimeType = MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream'
      const range = req.headers.range

      if (!range) {
        res.writeHead(200, { 'Content-Type': mimeType, 'Content-Length': size, 'Accept-Ranges': 'bytes' })
        fs.createReadStream(filePath).pipe(res)
        return
      }

      const match = /^bytes=(\d+)-(\d*)$/.exec(range)
      const start = match ? Number(match[1]) : 0
      const end = match?.[2] ? Number(match[2]) : size - 1

      res.writeHead(206, {
        'Content-Type': mimeType,
        'Content-Length': end - start + 1,
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Accept-Ranges': 'bytes',
      })
      fs.createReadStream(filePath, { start, end }).pipe(res)
    })

    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (addr && typeof addr === 'object') resolve(addr.port)
      else reject(new Error('Failed to start media server'))
    })
  })
}
