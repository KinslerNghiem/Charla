import { useEffect, useRef, useState } from 'preact/hooks'
import type { Map as MapLibreMap } from 'maplibre-gl'
import type { Feature, FeatureCollection, Point } from 'geojson'
import { learning, t } from '../i18n/lang'
import { computeStatus, supportLang, type Reports, type Status } from '../places/badges'
import { AURORA_DOWNTOWN, ZIP_CENTERS } from '../places/centers'
import { fetchReports, sendReport } from '../tutor/client'
import { addStreak, streakThisWeek } from '../storage'
import { go } from '../router'

interface VenueProps {
  id: string
  name: string
  town: string
  type: string
  scene_id: string
  address: string
  lang_es: string
  lang_en: string
  roles: string
  shifts: string
  status: Status
  club_schedule: string
  meet_ok: string
  notes: string
}

type Venue = Feature<Point, VenueProps>

// MapLibre is a megabyte. It loads when this page mounts with data, not before.
type MapModule = typeof import('../places/map')

export function Places({ params }: { params: URLSearchParams }) {
  const [data, setData] = useState<FeatureCollection<Point, VenueProps> | null>(null)
  const [reports, setReports] = useState<Reports>({})
  const [filter, setFilter] = useState<string>('all')
  const [selected, setSelected] = useState<string | null>(params.get('id'))
  const [zip, setZip] = useState('')
  const [notMapped, setNotMapped] = useState(false)
  // Keyed by place id, not booleans: reporting one visit must not hide the
  // control on every other place.
  const [wentId, setWentId] = useState<string | null>(null)
  const [thanksId, setThanksId] = useState<string | null>(null)
  const mapEl = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibreMap | null>(null)
  const mapMod = useRef<MapModule | null>(null)
  const target = learning()
  const support = supportLang(target)

  useEffect(() => {
    fetch('/venues.geojson')
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ type: 'FeatureCollection', features: [] }))
    fetchReports().then(setReports).catch(() => {})
  }, [])

  // The map holds a WebGL context; without this the browser runs out of them
  // after a handful of visits to this tab and later maps render blank.
  useEffect(
    () => () => {
      map.current?.remove()
      map.current = null
    },
    [],
  )

  const withStatus = (f: Venue): Venue => ({
    ...f,
    properties: { ...f.properties, status: computeStatus(f.properties.status, reports[f.properties.id]?.[support]) },
  })
  const features: Venue[] = (data?.features as Venue[] | undefined)?.map(withStatus) ?? []
  const shown = features.filter((f) => filter === 'all' || f.properties.type === filter)
  const types = Array.from(new Set(features.map((f) => f.properties.type)))

  useEffect(() => {
    if (!data || !mapEl.current || map.current) return
    let alive = true
    import('../places/map').then((m: MapModule) => {
      if (!alive || !mapEl.current || map.current) return
      mapMod.current = m
      map.current = m.createMap(mapEl.current, AURORA_DOWNTOWN)
      m.addVenues(map.current, { type: 'FeatureCollection', features: shown }, (id) => setSelected(id))
    })
    return () => {
      alive = false
    }
  }, [data])

  useEffect(() => {
    if (map.current && mapMod.current) {
      mapMod.current.updateVenues(map.current, { type: 'FeatureCollection', features: shown })
    }
  }, [filter, reports, data, support])

  function centerOnZip(e: Event) {
    e.preventDefault()
    const c = ZIP_CENTERS[zip.trim()]
    setNotMapped(!c)
    map.current?.flyTo({ center: c ?? AURORA_DOWNTOWN, zoom: c ? 13 : 11.5 })
  }

  // One foreground reading, low accuracy, used to move the map. Never stored.
  function nearMe() {
    navigator.geolocation?.getCurrentPosition(
      (pos) => map.current?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 13 }),
      () => setNotMapped(true),
      { enableHighAccuracy: false, maximumAge: 600000, timeout: 8000 },
    )
  }

  const sel = features.find((f) => f.properties.id === selected)

  async function iWent(how: 'easy' | 'okay' | 'hard') {
    if (!sel) return
    const id = sel.properties.id
    addStreak({ ts: Date.now(), place_id: id, how })
    setWentId(id)
    try {
      await sendReport({ place_id: id, lang: support, positive: true })
      setThanksId(id)
      fetchReports().then(setReports).catch(() => {})
    } catch {
      // Offline: the streak still counts; the report is simply not sent.
    }
  }

  return (
    <section class="places">
      <h1>{t('places_title')}</h1>
      <p class="intro">{t('places_intro')}</p>
      <form class="row" onSubmit={centerOnZip}>
        <label>
          {t('zip')}
          <input inputMode="numeric" maxLength={5} value={zip} onInput={(e) => setZip((e.target as HTMLInputElement).value)} />
        </label>
        <button type="submit" class="ghost" aria-label={t('zip')}>
          →
        </button>
        <button type="button" class="ghost" onClick={nearMe} title={t('near_me_note')}>
          {t('near_me')}
        </button>
      </form>
      {notMapped && <p class="notice">{t('not_mapped')}</p>}
      <div class="map" ref={mapEl} role="region" aria-label={t('places_title')} />
      <div class="filters" role="group">
        <button type="button" class={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>
          {t('filter_all')}
        </button>
        {types.map((ty) => (
          <button type="button" class={filter === ty ? 'on' : ''} onClick={() => setFilter(ty)}>
            {t(`type_${ty}` as 'type_pharmacy')}
          </button>
        ))}
      </div>
      <p class="streak">
        <b>{streakThisWeek()}</b> {t('streak')}
      </p>
      {sel && (
        <article class="venue">
          <h2>{sel.properties.name}</h2>
          <p class="addr">{sel.properties.address}</p>
          <p class={'badge ' + sel.properties.status}>{t(`badge_${sel.properties.status}` as 'badge_unknown')}</p>
          {sel.properties.roles && (
            <p>
              <b>{t('roles_label')}:</b> {sel.properties.roles}
            </p>
          )}
          {sel.properties.shifts && (
            <p>
              <b>{t('shifts_label')}:</b> {sel.properties.shifts}
            </p>
          )}
          {sel.properties.club_schedule && (
            <p>
              <b>{t('club_label')}:</b> {sel.properties.club_schedule}
            </p>
          )}
          {sel.properties.meet_ok === 'yes' && <p class="meet">☕ {t('meet_ok')}</p>}
          <div class="row">
            {sel.properties.scene_id && (
              <button
                type="button"
                class="primary"
                onClick={() => go('/learn', { scene: sel.properties.scene_id, place: sel.properties.name })}
              >
                {t('practice_visit')}
              </button>
            )}
          </div>
          {wentId !== sel.properties.id ? (
            <div class="went">
              <p>
                <b>{t('i_went')}</b> · {t('how_was_it')}
              </p>
              <div class="row">
                <button type="button" class="ghost" onClick={() => iWent('easy')}>
                  {t('easy')}
                </button>
                <button type="button" class="ghost" onClick={() => iWent('okay')}>
                  {t('okay')}
                </button>
                <button type="button" class="ghost" onClick={() => iWent('hard')}>
                  {t('hard')}
                </button>
              </div>
            </div>
          ) : (
            thanksId === sel.properties.id && <p class="notice">{t('report_thanks')}</p>
          )}
          <p class="note">
            <a href="mailto:hello@example.com?subject=Charla%20listing">{t('opt_out')}</a>
          </p>
        </article>
      )}
      <ul class="venue-list">
        {shown.map((f) => (
          <li>
            <button
              type="button"
              class={'venue-row' + (f.properties.id === selected ? ' on' : '')}
              onClick={() => setSelected(f.properties.id)}
            >
              <span class={'dot ' + f.properties.status} aria-hidden="true" />
              <span class="name">{f.properties.name}</span>
              <span class="town">{f.properties.town}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
