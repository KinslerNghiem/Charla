import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import type { Map as MapLibreMap } from 'maplibre-gl'
import type { Feature, FeatureCollection, Point } from 'geojson'
import { learning, t } from '../i18n/lang'
import { computeStatus, STATUSES, supportLang, type Reports, type Status } from '../places/badges'
import { AURORA_DOWNTOWN, inServiceArea, ZIP_CENTERS } from '../places/centers'
import { fetchReports, sendReport } from '../tutor/client'
import { addStreak, get, set, streakThisWeek } from '../storage'
import { CONTACT_EMAIL, PARTNERS_URL } from '../contact'
import { go } from '../router'
import { isTeen } from '../gate/gate'

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
  format: string
  /** Set by this page for the map layer, never by the build. */
  selected?: boolean
}

type Venue = Feature<Point, VenueProps>

/** venues.geojson: a FeatureCollection plus a ZIP -> centroid table built from the venues. */
interface VenueFile extends FeatureCollection<Point, VenueProps> {
  zips?: Record<string, [number, number]>
}

const EMPTY: VenueFile = { type: 'FeatureCollection', features: [] }

// MapLibre is a megabyte. It loads when this page mounts, not before.
type MapModule = typeof import('../places/map')

type MapState = 'loading' | 'ok' | 'down'
type GeoState = null | 'not_mapped' | 'denied' | 'far'
type Outcome = { id: string; kind: 'thanks' | 'again' | 'saved' } | null

/** Local calendar day, so "already went today" rolls over at the learner's midnight. */
function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Squared equirectangular distance: enough to order a dozen places by nearness. */
function dist2(a: [number, number], b: [number, number]): number {
  const dx = (a[0] - b[0]) * Math.cos(((a[1] + b[1]) / 2) * (Math.PI / 180))
  const dy = a[1] - b[1]
  return dx * dx + dy * dy
}

export function Places({ params }: { params: URLSearchParams }) {
  const [data, setData] = useState<VenueFile | null>(null)
  // The last aggregate we saw is kept on the device, so a phone with no signal
  // still shows yesterday's badges instead of a page of grey dots.
  const [reports, setReports] = useState<Reports>(() => get<{ ts: number; data: Reports } | null>('reports', null)?.data ?? {})
  const [filter, setFilter] = useState<string>(params.get('type') || 'all')
  const [selected, setSelected] = useState<string | null>(params.get('id'))
  const [zip, setZip] = useState('')
  const [geo, setGeo] = useState<GeoState>(null)
  const [mapState, setMapState] = useState<MapState>('loading')
  // Set by a ZIP or Near me; while set, the list is ordered by distance from it.
  const [sortCenter, setSortCenter] = useState<[number, number] | null>(null)
  // Keyed by place id, not booleans: reporting one visit must not hide the
  // control on every other place. `went` is per day and survives a reload.
  const [went, setWent] = useState<Record<string, string>>(() => get<Record<string, string>>('went', {}))
  const [outcome, setOutcome] = useState<Outcome>(null)
  const [hardId, setHardId] = useState<string | null>(null)
  const mapEl = useRef<HTMLDivElement>(null)
  const cardEl = useRef<HTMLElement>(null)
  const map = useRef<MapLibreMap | null>(null)
  const mapMod = useRef<MapModule | null>(null)
  const target = learning()
  const support = supportLang(target)

  const features: Venue[] = useMemo(
    () =>
      (data?.features ?? []).map((f) => ({
        ...f,
        properties: { ...f.properties, status: computeStatus(f.properties.status, reports[f.properties.id]?.[support]) },
      })),
    [data, reports, support],
  )
  const types = useMemo(() => Array.from(new Set(features.map((f) => f.properties.type))), [features])
  const shown = useMemo(() => {
    const list = features
      .filter((f) => filter === 'all' || f.properties.type === filter)
      .map((f) => ({ ...f, properties: { ...f.properties, selected: f.properties.id === selected } }))
    if (sortCenter) {
      list.sort(
        (a, b) =>
          dist2(a.geometry.coordinates as [number, number], sortCenter) - dist2(b.geometry.coordinates as [number, number], sortCenter),
      )
    }
    return list
  }, [features, filter, selected, sortCenter])
  // The map layer reads this when its style finishes loading, whenever that is.
  const shownRef = useRef<Venue[]>(shown)
  shownRef.current = shown

  // A chip for the type the URL asked for, even when no place of that kind
  // exists yet, so the learner sees what is filtered and can clear it.
  const chips = filter === 'all' || types.includes(filter) ? types : [...types, filter]
  const sel = features.find((f) => f.properties.id === selected)
  const streak = streakThisWeek()

  function refreshReports() {
    fetchReports()
      .then((r) => {
        setReports(r)
        set('reports', { ts: Date.now(), data: r })
      })
      .catch(() => {})
  }

  useEffect(() => {
    let alive = true
    // Start the megabyte download now, in parallel with the data, not after it.
    const mod = import('../places/map')
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false
    if (offline) setMapState('down')
    fetch('/venues.geojson')
      .then((r) => r.json())
      .then((d: VenueFile) => alive && setData(d))
      .catch(() => alive && setData(EMPTY))
    refreshReports()
    mod
      .then((m: MapModule) => {
        // Offline there is no style to load; a map created now would paint a
        // stale canvas over the notice when the tab is revisited.
        if (!alive || offline || !mapEl.current || map.current) return
        mapMod.current = m
        const mp = m.createMap(mapEl.current, AURORA_DOWNTOWN)
        map.current = mp
        let loaded = false
        mp.once('load', () => {
          loaded = true
          if (alive) setMapState('ok')
        })
        // A missing tile after load is a hole in a working map, not an outage.
        mp.on('error', () => {
          if (!loaded && alive) setMapState('down')
        })
        m.addVenues(mp, () => ({ type: 'FeatureCollection', features: shownRef.current }), (id) => setSelected(id))
      })
      .catch(() => alive && setMapState('down'))
    return () => {
      alive = false
    }
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

  useEffect(() => {
    if (map.current && mapMod.current) {
      mapMod.current.updateVenues(map.current, { type: 'FeatureCollection', features: shown })
    }
  }, [shown])

  // Selecting a place brings its card into view, flies the map to it and
  // (through `selected` in the features above) highlights its pin.
  useEffect(() => {
    if (!sel) return
    cardEl.current?.scrollIntoView?.({ block: 'nearest' })
    map.current?.flyTo({ center: sel.geometry.coordinates as [number, number], zoom: 14 })
  }, [selected, data])

  function centerOnZip(e: Event) {
    e.preventDefault()
    const z = zip.trim()
    const c = data?.zips?.[z] ?? ZIP_CENTERS[z]
    setGeo(c ? null : 'not_mapped')
    const center = c ?? AURORA_DOWNTOWN
    setSortCenter(center)
    map.current?.flyTo({ center, zoom: c ? 13 : 11.5 })
  }

  // One foreground reading, low accuracy, used to move the map. Never stored.
  function nearMe() {
    if (!navigator.geolocation) {
      setGeo('denied')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here: [number, number] = [pos.coords.longitude, pos.coords.latitude]
        if (inServiceArea(here)) {
          setGeo(null)
          setSortCenter(here)
          map.current?.flyTo({ center: here, zoom: 13 })
        } else {
          setGeo('far')
          setSortCenter(AURORA_DOWNTOWN)
          map.current?.flyTo({ center: AURORA_DOWNTOWN, zoom: 11.5 })
        }
      },
      () => setGeo('denied'),
      { enableHighAccuracy: false, maximumAge: 600000, timeout: 8000 },
    )
  }

  async function iWent(how: 'easy' | 'okay' | 'hard') {
    if (!sel) return
    const id = sel.properties.id
    addStreak({ ts: Date.now(), place_id: id, how })
    const next = { ...went, [id]: today() }
    setWent(next)
    set('went', next)
    setHardId(how === 'hard' ? id : null)
    setOutcome(null)
    try {
      // "Hard" is a report that staff did not meet the learner halfway.
      const res = await sendReport({ place_id: id, lang: support, positive: how !== 'hard' })
      setOutcome({ id, kind: res.duplicate ? 'again' : 'thanks' })
      refreshReports()
    } catch {
      // Offline: the streak still counts here; the report was not sent.
      setOutcome({ id, kind: 'saved' })
    }
  }

  const geoKey = geo === 'not_mapped' ? 'not_mapped' : geo === 'denied' ? 'geo_denied' : geo === 'far' ? 'geo_far' : null
  const wentToday = sel ? went[sel.properties.id] === today() : false

  return (
    <section class="places">
      <h1>{t('places_title')}</h1>
      <p class="intro">{t('places_intro')}</p>
      <form class="row" onSubmit={centerOnZip}>
        <label>
          {t('zip')}
          <input inputMode="numeric" maxLength={5} value={zip} onInput={(e) => setZip((e.target as HTMLInputElement).value)} />
        </label>
        <button type="submit" class="ghost">
          {t('zip_go')}
        </button>
        <button type="button" class="ghost" onClick={nearMe}>
          {t('near_me')}
        </button>
      </form>
      <p class="note">{t('near_me_note')}</p>
      {geoKey && <p class="notice">{t(geoKey)}</p>}
      <div class={'map' + (mapState === 'down' ? ' down' : '')} ref={mapEl} role="region" aria-label={t('places_title')} />
      {mapState === 'down' && <p class="notice">{t('map_offline')}</p>}
      <div class="filters" role="group">
        <button type="button" class={filter === 'all' ? 'on' : ''} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
          {t('filter_all')}
        </button>
        {chips.map((ty) => (
          <button type="button" class={filter === ty ? 'on' : ''} aria-pressed={filter === ty} onClick={() => setFilter(ty)}>
            {t(`type_${ty}` as 'type_pharmacy')}
          </button>
        ))}
      </div>
      {streak === 0 ? (
        <p class="streak">{t('streak_none')}</p>
      ) : (
        <p class="streak">
          <b>{streak}</b> {streak === 1 ? t('streak_one') : t('streak')}
        </p>
      )}
      {sel && (
        <article class="venue" ref={cardEl}>
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
          {sel.properties.meet_ok === 'yes' && !isTeen() && <p class="meet">☕ {t('meet_ok')}</p>}
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
          {!wentToday ? (
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
            <>
              {outcome?.id === sel.properties.id && (
                <p class="notice went-saved">
                  {outcome.kind === 'thanks' ? t('report_thanks') : outcome.kind === 'again' ? t('report_again') : t('report_saved')}
                </p>
              )}
              {hardId === sel.properties.id && sel.properties.scene_id && (
                <p>
                  <a href={`#/learn?${new URLSearchParams({ scene: sel.properties.scene_id, place: sel.properties.name, level: 'A1' })}`}>
                    {t('practice_simpler')}
                  </a>
                </p>
              )}
            </>
          )}
          <p class="note">
            {CONTACT_EMAIL ? (
              <a href={`mailto:${CONTACT_EMAIL}?subject=Charla%20listing`}>{t('opt_out')}</a>
            ) : (
              <>
                {t('opt_out')} {t('opt_out_how')}
              </>
            )}
          </p>
        </article>
      )}
      <p class="legend">
        {STATUSES.map((s) => (
          <span>
            <span class={'dot ' + s} aria-hidden="true" />
            {t(`badge_${s}` as 'badge_unknown')}
          </span>
        ))}
      </p>
      {data && shown.length === 0 && filter !== 'all' && (
        <p class="notice">
          {t('places_none_type')} <a href={PARTNERS_URL}>docs/partners.md</a>
        </p>
      )}
      <ul class="venue-list">
        {shown.map((f) => (
          <li>
            <button
              type="button"
              class={'venue-row' + (f.properties.id === selected ? ' on' : '')}
              aria-current={f.properties.id === selected ? 'true' : undefined}
              onClick={() => setSelected(f.properties.id)}
            >
              <span class={'dot ' + f.properties.status} aria-hidden="true" />
              <span class="name">
                {f.properties.name}
                <span class="sr-only">, {t(`badge_${f.properties.status}` as 'badge_unknown')}</span>
              </span>
              <span class="town">{f.properties.town}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
