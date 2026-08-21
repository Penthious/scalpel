import { describe, expect, it } from 'vitest'
import { normalizeMediaInfo, thumbnailToDataUrl } from './media-normalize'

function sampleInfo(overrides: Record<string, unknown> = {}): never {
  return {
    sourceAppId: 'Spotify.exe',
    media: {
      title: 'CANDLELIGHT',
      artist: 'Denzel Curry',
      albumTitle: 'ii',
      albumArtist: 'Denzel Curry',
      genres: [],
      albumTrackCount: 0,
      trackNumber: 0,
      thumbnail: undefined,
      ...(overrides.media as Record<string, unknown> | undefined),
    },
    playback: { playbackStatus: 4, playbackType: 1, ...(overrides.playback as Record<string, unknown> | undefined) },
    timeline: { position: 64.7, duration: 166.9, ...(overrides.timeline as Record<string, unknown> | undefined) },
    lastUpdatedTime: 1_787_000_000_000,
    ...overrides,
  } as never
}

describe('normalizeMediaInfo', () => {
  it('maps SMTC fields and reads playing off the PLAYING status', () => {
    const s = normalizeMediaInfo(sampleInfo(), 1_787_000_000_500)
    expect(s).toMatchObject({
      sourceAppId: 'Spotify.exe',
      title: 'CANDLELIGHT',
      artist: 'Denzel Curry',
      album: 'ii',
      thumbnail: null,
      playing: true,
      position: 64.7,
      duration: 166.9,
      positionAt: 1_787_000_000_000,
    })
  })

  it('reports paused sessions as not playing', () => {
    const s = normalizeMediaInfo(sampleInfo({ playback: { playbackStatus: 5, playbackType: 1 } }), 1)
    expect(s.playing).toBe(false)
  })

  it('falls back to the query time when lastUpdatedTime is not epoch-ms', () => {
    const s = normalizeMediaInfo(sampleInfo({ lastUpdatedTime: 1234 }), 1_787_000_000_500)
    expect(s.positionAt).toBe(1_787_000_000_500)
  })

  it('encodes the thumbnail as a data URL with a sniffed mime', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47])
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0])
    expect(thumbnailToDataUrl(png)).toBe(`data:image/png;base64,${png.toString('base64')}`)
    expect(thumbnailToDataUrl(jpeg)).toBe(`data:image/jpeg;base64,${jpeg.toString('base64')}`)
    const s = normalizeMediaInfo(sampleInfo({ media: { thumbnail: png } }), 1)
    expect(s.thumbnail).toBe(`data:image/png;base64,${png.toString('base64')}`)
  })
})
