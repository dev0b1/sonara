import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Box,
  Flex,
  Heading,
  Text,
  Button,
  Badge,
  Spinner,
  Stack,
  HStack,
  VStack,
  Divider,
  useColorMode,
  useColorModeValue,
  RadioGroup,
  Radio,
  Alert,
  AlertIcon,
  Card,
  CardBody,
  Progress,
} from '@chakra-ui/react'
import PricingModal from './components/PricingModal'
import AdminModal from './components/AdminModal'
import { formatDurationHuman } from './utils/duration'
import { parseInvokeJson } from './utils/invokeJson'
import { tryPickAudioPathNative } from './lib/pickAudioNative'
import { save } from '@tauri-apps/plugin-dialog'

const LIFETIME_PRICE = Number(import.meta.env.VITE_LIFETIME_PRICE || 12)
const FREE_DAILY_SECONDS = Number(import.meta.env.VITE_FREE_DAILY_SECONDS || 20 * 60)
const PRO_UPLOAD_LIMIT_SECONDS = Number(
  import.meta.env.VITE_PRO_UPLOAD_LIMIT_SECONDS || 30 * 3600
)
const PRO_UPLOAD_HOURS = Math.round(PRO_UPLOAD_LIMIT_SECONDS / 3600)
const EXPORT_PAYWALL_SECONDS = Number(import.meta.env.VITE_EXPORT_PAYWALL_SECONDS || 60 * 60)
const WHOP_LIFETIME_URL =
  import.meta.env.VITE_WHOP_LIFETIME_URL ||
  import.meta.env.VITE_WHOP_CHECKOUT_URL ||
  'https://whop.com/checkout/plan_DFiMSfhJDR3NR'

/** Rough ETA: base seconds (model I/O) + audio duration × ratio (CPU whisper ~0.2–0.5× realtime varies). */
const ETA_BASE_SECONDS = Number(import.meta.env.VITE_ETA_BASE_SECONDS ?? 20)
const ETA_AUDIO_RATIO = Number(import.meta.env.VITE_ETA_AUDIO_RATIO ?? 0.35)

function formatEtaRemaining(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return 'a moment'
  const s = Math.ceil(sec)
  if (s < 60) return `~${s}s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return r > 0 ? `~${m}m ${r}s` : `~${m}m`
}

/** Elapsed time during transcribe (no leading ~). */
function formatElapsed(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '0s'
  return formatDurationHuman(sec)
}

/** Smooth progress: advances as elapsed grows and remaining shrinks. */
function etaProgressPercent(elapsedSec, remainingSec) {
  if (!Number.isFinite(elapsedSec) || elapsedSec < 0) return 0
  const rem = Number.isFinite(remainingSec) && remainingSec > 0 ? remainingSec : 0
  if (rem <= 0) return 95
  const denom = elapsedSec + rem
  if (denom <= 0) return 0
  return Math.min(95, Math.max(0, (100 * elapsedSec) / denom))
}

async function getTauriCore() {
  try {
    return await import(/* @vite-ignore */ '@tauri-apps/api/core')
  } catch {
    return null
  }
}

function isTauriRuntime() {
  try {
    return Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__)
  } catch {
    return false
  }
}

async function tauriInvoke(command, payload) {
  if (!isTauriRuntime()) {
    throw new Error(
      'Desktop engine not connected. Run Sonara with `npm run tauri:dev` (or the .exe).'
    )
  }
  const core = await getTauriCore()
  if (!core || typeof core.invoke !== 'function') {
    throw new Error('Tauri API is unavailable in this runtime.')
  }
  return core.invoke(command, payload)
}

/** Align UI with `~/.sonara_license.json`: tier may be "pro" while `is_pro` is missing in older responses. */
function normalizeLicense(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      is_pro: false,
      export_unlocked: false,
      remaining_free_seconds: 0,
      tier: 'free',
    }
  }
  const tier = raw.tier ?? 'free'
  const isPro =
    raw.is_pro === true ||
    raw.is_pro === 'true' ||
    String(tier).toLowerCase() === 'pro'
  return {
    ...raw,
    tier,
    is_pro: Boolean(isPro),
  }
}

function buildFiveMinuteBlocks(rawBlocks = []) {
  const wordsPerFiveMinutes = 750
  const out = []
  let chunkIndex = 0
  for (const b of rawBlocks) {
    if (b?.range) {
      out.push(b)
      continue
    }
    const words = String(b?.text || '').trim().split(/\s+/).filter(Boolean)
    for (let i = 0; i < words.length; i += wordsPerFiveMinutes) {
      const from = chunkIndex * 5
      const to = from + 5
      const label = `${String(Math.floor(from / 60)).padStart(2, '0')}:${String(
        from % 60
      ).padStart(2, '0')} - ${String(Math.floor(to / 60)).padStart(2, '0')}:${String(
        to % 60
      ).padStart(2, '0')}`
      out.push({ range: label, text: words.slice(i, i + wordsPerFiveMinutes).join(' ') })
      chunkIndex += 1
    }
  }
  return out
}

export default function App() {
  const { colorMode, setColorMode } = useColorMode()
  const [page, setPage] = useState('home')
  const [filePath, setFilePath] = useState(null)
  const [fileLabel, setFileLabel] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [appVersion, setAppVersion] = useState(null)
  const [license, setLicense] = useState({
    is_pro: false,
    tier: 'free',
    export_unlocked: false,
    remaining_free_seconds: 0,
  })
  const [pricingOpen, setPricingOpen] = useState(false)
  const [pricingMode, setPricingMode] = useState('lifetime')
  const [pricingReason, setPricingReason] = useState('')
  const [adminOpen, setAdminOpen] = useState(false)
  const [isTauri, setIsTauri] = useState(false)
  /** Wall-clock time when we expect transcription to finish (ms). */
  const [etaEndMs, setEtaEndMs] = useState(null)
  /** Current denominator for ETA (grows if we soft-extend the deadline). */
  const [etaTotalSec, setEtaTotalSec] = useState(0)
  /** First estimate after probing audio (stable label for “~X total”). */
  const [etaInitialEstimateSec, setEtaInitialEstimateSec] = useState(0)
  const [etaRemainingSec, setEtaRemainingSec] = useState(null)
  /** Seconds since Transcribe was clicked (updates while loading). */
  const [etaElapsedSec, setEtaElapsedSec] = useState(0)
  const etaBaselineSecRef = useRef(90)
  const etaSoftExtendCountRef = useRef(0)

  const pageBg = useColorModeValue('gray.50', 'gray.900')
  const headerBg = useColorModeValue('white', 'gray.900')
  const panelBg = useColorModeValue('white', 'gray.800')
  const muted = useColorModeValue('gray.600', 'gray.400')

  useEffect(() => {
    setIsTauri(isTauriRuntime())
  }, [])

  useEffect(() => {
    if (!isTauriRuntime()) return
    ;(async () => {
      try {
        const app = await import('@tauri-apps/api/app').catch(() => null)
        if (app?.getVersion) setAppVersion(await app.getVersion())
      } catch {
        // ignore
      }
    })()
  }, [])

  const refreshLicense = useCallback(async () => {
    if (!isTauriRuntime()) return
    try {
      const out = await tauriInvoke('check_license')
      setLicense(normalizeLicense(parseInvokeJson(out)))
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    refreshLicense()
  }, [refreshLicense])

  // Elapsed time (whole transcribe job, including probe + whisper).
  useEffect(() => {
    if (!loading) {
      setEtaElapsedSec(0)
      return
    }
    const started = Date.now()
    const id = setInterval(() => {
      setEtaElapsedSec((Date.now() - started) / 1000)
    }, 500)
    return () => clearInterval(id)
  }, [loading])

  // Countdown + soft extensions when estimate passes (no real progress from Python yet).
  useEffect(() => {
    if (!loading || etaEndMs == null) return
    const tick = () => {
      const end = etaEndMs
      const rem = (end - Date.now()) / 1000
      if (rem > 0) {
        setEtaRemainingSec(rem)
        return
      }
      if (etaSoftExtendCountRef.current < 2) {
        etaSoftExtendCountRef.current += 1
        const base = Math.max(etaBaselineSecRef.current, 30)
        const bump = Math.max(20, base * 0.22)
        setEtaEndMs(Date.now() + bump * 1000)
        setEtaTotalSec((t) => Math.max(t, 0) + bump)
        setEtaRemainingSec(bump)
        return
      }
      setEtaRemainingSec(0)
    }
    tick()
    const id = setInterval(tick, 400)
    return () => clearInterval(id)
  }, [loading, etaEndMs])

  async function pickFile() {
    if (isTauriRuntime()) {
      const picked = await tryPickAudioPathNative()
      if (picked) {
        setFilePath(picked.path)
        setFileLabel(picked.label)
        setResult(null)
        return
      }
    }

    await new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.mp3,.wav,.m4a,.flac,.ogg,.aac,.wma'
      input.onchange = (e) => {
        const f = e.target.files && e.target.files[0]
        if (f) {
          setFileLabel(f.name)
          setFilePath(f.name)
          setResult(null)
        }
        resolve()
      }
      input.click()
    })
  }

  async function transcribe() {
    if (!filePath) return
    setResult(null)
    setLoading(true)
    setEtaEndMs(null)
    setEtaTotalSec(0)
    setEtaInitialEstimateSec(0)
    setEtaRemainingSec(null)
    etaSoftExtendCountRef.current = 0

    let deadline = Date.now() + 90_000
    let initialSec = 90
    if (isTauriRuntime()) {
      try {
        const raw = await tauriInvoke('probe_audio_duration', { path: filePath })
        const p = parseInvokeJson(raw) || {}
        if (p.duration_seconds != null && Number.isFinite(Number(p.duration_seconds))) {
          const audio = Number(p.duration_seconds)
          initialSec = Math.max(15, ETA_BASE_SECONDS + audio * ETA_AUDIO_RATIO)
          deadline = Date.now() + initialSec * 1000
        }
      } catch {
        initialSec = 90
        deadline = Date.now() + 90_000
      }
    } else {
      initialSec = 60
      deadline = Date.now() + 60_000
    }
    etaBaselineSecRef.current = initialSec
    setEtaInitialEstimateSec(initialSec)
    setEtaTotalSec(initialSec)
    setEtaEndMs(deadline)
    setEtaRemainingSec(Math.max(0, (deadline - Date.now()) / 1000))

    try {
      const out = await tauriInvoke('transcribe_file', { path: filePath })
      const parsed = parseInvokeJson(out)
      if (parsed?.error_code === 'FREE_DAILY_LIMIT') {
        const remaining = Number(parsed?.remaining_free_seconds ?? NaN)
        const freeDaily = Number(parsed?.free_daily_limit_seconds ?? FREE_DAILY_SECONDS)
        const remainingMin = Number.isFinite(remaining) ? Math.max(0, Math.round(remaining / 60)) : null
        const freeDailyMin = Number.isFinite(freeDaily) ? Math.max(1, Math.round(freeDaily / 60)) : 20
        openPricing({
          mode: 'lifetime',
          reason: `Free includes ${freeDailyMin} minutes per day (resets daily). You have ${
            remainingMin != null ? `${remainingMin} minute${remainingMin === 1 ? '' : 's'}` : 'limited time'
          } left today — upgrade to transcribe longer files right now (up to ${PRO_UPLOAD_HOURS} hours per file).`,
        })
        setResult(null)
        await refreshLicense()
        return
      }

      setResult(parsed || { error: 'Invalid response from the transcription engine.' })
      await refreshLicense()
    } catch (e) {
      setResult({ error: e?.toString?.() || String(e) })
    } finally {
      setLoading(false)
      setEtaEndMs(null)
      setEtaTotalSec(0)
      setEtaInitialEstimateSec(0)
      setEtaRemainingSec(null)
      etaSoftExtendCountRef.current = 0
    }
  }

  const openPricing = ({ mode = 'lifetime', reason = '' } = {}) => {
    setPricingMode(mode)
    setPricingReason(reason)
    setPricingOpen(true)
  }

  /** Lifetime Pro: hide Upgrade and skip every export/transcript paywall. */
  const isProUser = Boolean(license.is_pro)

  const handleExport = () => {
    if (!result?.blocks) return

    if (!license.is_pro) {
      const duration = Number(result?.duration ?? NaN)
      const underPaywall = !Number.isFinite(duration) || duration <= EXPORT_PAYWALL_SECONDS
      const allowed = license.export_unlocked || underPaywall
      if (!allowed) {
        openPricing({
          mode: 'lifetime',
          reason:
            `Export is available for transcripts up to 1 hour. Upgrade to Lifetime Pro to export longer recordings (up to ${PRO_UPLOAD_HOURS} hours per file).`,
        })
        return
      }
    }

    const blocks = buildFiveMinuteBlocks(result.blocks || [])
    const defaultName = `sonara_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`
    let txt = `Sonara Transcript\nDate: ${new Date().toISOString()}\n\n`
    for (const b of blocks) txt += `[${b.range}]\n${b.text}\n\n`

    if (isTauriRuntime()) {
      ;(async () => {
        const filePath = await save({
          defaultPath: defaultName,
          filters: [{ name: 'Text', extensions: ['txt'] }],
        })
        if (!filePath) return
        await tauriInvoke('save_text_file', { path: filePath, contents: txt })
      })().catch((e) => {
        setResult({ error: e?.toString?.() || String(e) })
      })
      return
    }

    const blob = new Blob([txt], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = defaultName
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const openAdmin = () => {
    const pwd = window.prompt('Admin password:')
    if (pwd === 'secr3tpass!') setAdminOpen(true)
    else if (pwd) window.alert('Incorrect password')
  }

  const blocks = buildFiveMinuteBlocks(result?.blocks || [])

  return (
    <Box minH="100vh" bg={pageBg}>
      <Flex
        px={6}
        py={4}
        align="center"
        justify="space-between"
        borderBottomWidth="1px"
        bg={headerBg}
      >
        <HStack spacing={4}>
          <Box
            w="42px"
            h="42px"
            borderRadius="xl"
            bgGradient="linear(to-br, blue.400, teal.400)"
            display="flex"
            alignItems="center"
            justifyContent="center"
            fontSize="20px"
          >
            🎙
          </Box>
          <Box>
            <Heading size="md">Sonara</Heading>
            <Text fontSize="sm" color={muted}>
              Local speech-to-text for Windows
            </Text>
          </Box>
        </HStack>

        <HStack spacing={3}>
          <Button variant={page === 'home' ? 'solid' : 'ghost'} onClick={() => setPage('home')}>
            Home
          </Button>
          <Button
            variant={page === 'settings' ? 'solid' : 'ghost'}
            onClick={() => setPage('settings')}
          >
            Settings
          </Button>
          <Badge colorScheme={isProUser ? 'green' : 'gray'} px={2} py={1} borderRadius="md">
            {isProUser ? 'PRO' : 'FREE'}
          </Badge>
          {!isProUser && (
            <Button
              size="sm"
              colorScheme="teal"
              onClick={() =>
                openPricing({
                  mode: 'lifetime',
                  reason:
                    `Lifetime Pro unlocks up to ${PRO_UPLOAD_HOURS} hours per file. Purchase once, then activate your personal unique key.`,
                })
              }
            >
              Upgrade (Lifetime)
            </Button>
          )}
        </HStack>
      </Flex>

      <Box px={6} py={6}>
        {page === 'home' && (
          <VStack spacing={5} align="stretch">
            <Card bg={panelBg}>
              <CardBody>
                <Stack spacing={4}>
                  <Text fontWeight="semibold">Audio Input</Text>
                  <HStack spacing={3} align="stretch">
                    <Button onClick={pickFile} isDisabled={loading}>
                      Choose audio file
                    </Button>
                    <Box
                      flex="1"
                      borderWidth="1px"
                      borderRadius="md"
                      px={3}
                      py={2}
                      color={fileLabel ? 'inherit' : muted}
                    >
                      {fileLabel || 'No file selected'}
                    </Box>
                    <Button
                      colorScheme="blue"
                      onClick={transcribe}
                      isDisabled={loading || !filePath}
                    >
                      Transcribe
                    </Button>
                  </HStack>
                  <Text fontSize="sm" color={muted}>
                    Free: {Math.round(FREE_DAILY_SECONDS / 60)} minutes per day · Lifetime Pro: up to{' '}
                    {Math.round(PRO_UPLOAD_LIMIT_SECONDS / 3600)} hours of audio upload
                  </Text>
                  <Text fontSize="sm" color={muted}>
                    {isTauri
                      ? 'Running in Sonara Desktop.'
                      : 'Browser preview only. For transcription run `npm run tauri:dev`.'}
                  </Text>
                  {result?.error && (
                    <Alert status="error" borderRadius="md">
                      <AlertIcon />
                      {result.error}
                    </Alert>
                  )}
                </Stack>
              </CardBody>
            </Card>

            <Card bg={panelBg}>
              <CardBody>
                <VStack align="stretch" spacing={4}>
                  <HStack justify="space-between">
                    <Text fontWeight="semibold">Transcript</Text>
                    <HStack>
                      {result?.duration != null && (
                        <Badge>{formatDurationHuman(result.duration)}</Badge>
                      )}
                      <Button colorScheme="blue" onClick={handleExport} isDisabled={!result?.blocks}>
                        Export .txt
                      </Button>
                    </HStack>
                  </HStack>
                  <Divider />
                  {blocks.length ? (
                    <VStack align="stretch" spacing={3} maxH="62vh" overflowY="auto" pr={1}>
                      {blocks.map((b, i) => (
                        <Box key={i} borderWidth="1px" borderRadius="md" p={3}>
                          <Text fontSize="xs" color="red.400" mb={1} fontWeight="semibold">
                            {b.range}
                          </Text>
                          <Text>{b.text}</Text>
                        </Box>
                      ))}
                    </VStack>
                  ) : (
                    <Text color={muted}>
                      {loading
                        ? 'Transcription in progress...'
                        : 'Transcript will appear after transcription.'}
                    </Text>
                  )}
                </VStack>
              </CardBody>
            </Card>
          </VStack>
        )}

        {page === 'settings' && (
          <Card bg={panelBg} maxW="720px">
            <CardBody>
              <VStack align="stretch" spacing={4}>
                <Heading size="md">Settings</Heading>
                <Text color={muted}>Choose your appearance theme.</Text>
                <RadioGroup value={colorMode} onChange={setColorMode}>
                  <HStack spacing={6}>
                    <Radio value="dark">Dark</Radio>
                    <Radio value="light">Light</Radio>
                  </HStack>
                </RadioGroup>
                <Divider />
                <Box>
                  <Heading size="sm" mb={2}>
                    About
                  </Heading>
                  <Text color={muted}>
                    Version: {appVersion || 'Preview'}
                  </Text>
                  <Text color={muted}>
                    Sonara runs fully offline on your device. Your audio never leaves your PC.
                  </Text>
                </Box>
                <Divider />
                <Box>
                  <Heading size="sm" mb={2}>
                    FAQ
                  </Heading>
                  <Stack spacing={2} color={muted} fontSize="sm">
                    <Text>
                      <b>Where is my transcript saved?</b> Export it using the Export button. Sonara does not auto-upload
                      anything.
                    </Text>
                    <Text>
                      <b>Does Sonara work offline?</b> Yes. Transcription happens locally.
                    </Text>
                    <Text>
                      <b>How do I activate Pro?</b> Click Upgrade → after checkout you’ll receive a personal unique key.
                      Paste it and activate. The desktop app remembers your key.
                    </Text>
                    <Text>
                      <b>What’s the free limit?</b> Up to {Math.round(FREE_DAILY_SECONDS / 60)} minutes per day.
                    </Text>
                    <Text>
                      <b>What does Lifetime Pro include?</b> Up to {Math.round(PRO_UPLOAD_LIMIT_SECONDS / 3600)} hours per
                      file + export for long recordings.
                    </Text>
                  </Stack>
                </Box>
                <Divider />
                <Button variant="outline" maxW="160px" onClick={openAdmin}>
                  Admin
                </Button>
              </VStack>
            </CardBody>
          </Card>
        )}
      </Box>

      {loading && (
        <Flex
          position="fixed"
          inset="0"
          bg="blackAlpha.500"
          align="center"
          justify="center"
          zIndex="overlay"
        >
          <VStack bg={panelBg} p={6} borderRadius="lg" spacing={3} minW="300px" maxW="90vw">
            <Spinner size="lg" color="blue.400" />
            <Text fontWeight="semibold">Transcribing…</Text>
            {etaEndMs != null && etaTotalSec > 0 ? (
              <>
                <Text fontSize="lg" fontWeight="semibold" color="blue.400" textAlign="center">
                  {etaRemainingSec != null && etaRemainingSec > 8
                    ? `About ${formatEtaRemaining(etaRemainingSec)} left`
                    : etaRemainingSec != null && etaRemainingSec > 0
                      ? 'Almost done…'
                      : 'Finishing up…'}
                </Text>
                <Text fontSize="sm" color={muted} textAlign="center">
                  Elapsed {formatElapsed(etaElapsedSec)}
                  {etaInitialEstimateSec > 0
                    ? ` · Started at ~${formatEtaRemaining(etaInitialEstimateSec)} total`
                    : ''}
                </Text>
                <Text fontSize="xs" color={muted} textAlign="center">
                  {etaRemainingSec != null && etaRemainingSec <= 0
                    ? 'Still working — Whisper can exceed the rough estimate on slower CPUs or large files.'
                    : 'Estimate is from audio length; remaining time ticks down as we go.'}
                </Text>
                <Progress
                  w="full"
                  size="sm"
                  borderRadius="md"
                  colorScheme="blue"
                  hasStripe
                  isAnimated
                  isIndeterminate={
                    etaRemainingSec != null && etaRemainingSec <= 0
                  }
                  value={
                    etaRemainingSec != null && etaRemainingSec <= 0
                      ? undefined
                      : etaProgressPercent(etaElapsedSec, etaRemainingSec ?? 0)
                  }
                />
              </>
            ) : (
              <Text fontSize="sm" color={muted} textAlign="center">
                {isTauri ? 'Measuring audio length & building time estimate…' : 'Starting…'}
              </Text>
            )}
          </VStack>
        </Flex>
      )}

      <PricingModal
        open={pricingOpen}
        onClose={() => {
          setPricingOpen(false)
          setPricingReason('')
        }}
        mode={pricingMode}
        reason={pricingReason}
        lifetimePrice={LIFETIME_PRICE}
        proUploadHours={PRO_UPLOAD_HOURS}
        lifetimeUrl={WHOP_LIFETIME_URL}
        onActivated={refreshLicense}
        isProUser={isProUser}
      />
      {adminOpen && <AdminModal open={adminOpen} onClose={() => setAdminOpen(false)} />}
    </Box>
  )
}
