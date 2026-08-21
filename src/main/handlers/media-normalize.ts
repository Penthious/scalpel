import type { MediaSession } from '../../plugin-sdk/src/types'

type SmtcMediaInfo = import('@coooookies/windows-smtc-monitor').MediaInfo

// PlaybackStatus.PLAYING from the SMTC enum; a local constant so this pure
// module never touches the native module.
const PLAYBACK_PLAYING = 4

export function thumbnailToDataUrl(buf: Buffer): string {
  const mime = buf.length > 1 && buf[0] === 0x89 && buf[1] === 0x50 ? 'image/png' : 'image/jpeg'
  return `data:${mime};base64,${buf.toString('base64')}`
}

export function normalizeMediaInfo(info: SmtcMediaInfo, now: number): MediaSession {
  const thumb = info.media.thumbnail
  return {
    sourceAppId: info.sourceAppId,
    title: info.media.title,
    artist: info.media.artist,
    album: info.media.albumTitle,
    thumbnail: thumb && thumb.length > 0 ? thumbnailToDataUrl(thumb) : null,
    playing: info.playback.playbackStatus === PLAYBACK_PLAYING,
    position: info.timeline.position,
    duration: info.timeline.duration,
    // Epoch-ms in practice; guard against a differently-scaled value by falling
    // back to the query time (paused sessions never interpolate, so staleness
    // only matters while playing, when the player refreshes it continuously).
    positionAt: info.lastUpdatedTime > 1e12 && info.lastUpdatedTime < now + 60_000 ? info.lastUpdatedTime : now,
  }
}
