import { useState, useEffect, useCallback } from 'react'
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
} from '@chakra-ui/react'
import PricingModal from './components/PricingModal'
import AdminModal from './components/AdminModal'
import {
  durationSeconds,
  THREE_HOURS_SECONDS,
  formatDurationHuman,
} from './utils/duration'
import { tryPickAudioPathNative } from './lib/pickAudioNative'

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

export default function App() {
  const { colorMode, setColorMode } = useColorMode()
  const [page, setPage] = useState('home')
  const [filePath, setFilePath] = useState(null)
  const [fileLabel, setFileLabel] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [license, setLicense] = useState({
    is_pro: false,
    export_unlocked: false,
    remaining_free_seconds: 0,
  })
  const [pricingOpen, setPricingOpen] = useState(false)
  const [showLifetimeOffer, setShowLifetimeOffer] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [isTauri, setIsTauri] = useState(false)

  const pageBg = useColorModeValue('gray.50', 'gray.900')
  const headerBg = useColorModeValue('white', 'gray.900')
  const panelBg = useColorModeValue('white', 'gray.800')
  const muted = useColorModeValue('gray.600', 'gray.400')

  useEffect(() => {
    setIsTauri(isTauriRuntime())
  }, [])

  const refreshLicense = useCallback(async () => {
    if (!isTauriRuntime()) return
    try {
      const out = await tauriInvoke('check_license')
      setLicense(JSON.parse(out))
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    refreshLicense()
  }, [refreshLicense])

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
    setLoading(true)
    setResult(null)
    try {
      const out = await tauriInvoke('transcribe_file', { path: filePath })
      const parsed = JSON.parse(out)
      setResult(parsed)
      await refreshLicense()
    } catch (e) {
      setResult({ error: e?.toString?.() || String(e) })
    } finally {
      setLoading(false)
    }
  }

  const openPricing = ({ showLifetime = false } = {}) => {
    setShowLifetimeOffer(showLifetime)
    setPricingOpen(true)
  }

  const handleExport = () => {
    if (!result?.blocks) return
    const allowed = license.is_pro || license.export_unlocked
    if (!allowed) {
      openPricing({ showLifetime: durationSeconds(result.duration) > THREE_HOURS_SECONDS })
      return
    }

    const defaultName = `sonara_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`
    let txt = `Sonara Transcript\nDate: ${new Date().toISOString()}\n\n`
    for (const b of result.blocks) txt += `[${b.range}]\n${b.text}\n\n`
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
          <Badge colorScheme={license.is_pro ? 'green' : 'gray'} px={2} py={1} borderRadius="md">
            {license.is_pro ? 'PRO' : 'FREE'}
          </Badge>
          <Button size="sm" onClick={refreshLicense}>
            Refresh license
          </Button>
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
                    {isTauri
                      ? 'Desktop mode detected. Real file paths are used.'
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
                  {result?.blocks?.length ? (
                    <VStack align="stretch" spacing={3} maxH="52vh" overflowY="auto">
                      {result.blocks.map((b, i) => (
                        <Box key={i} borderWidth="1px" borderRadius="md" p={3}>
                          <Text fontSize="xs" color={muted} mb={1}>
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
          <VStack bg={panelBg} p={6} borderRadius="lg" spacing={3}>
            <Spinner size="lg" color="blue.400" />
            <Text fontWeight="semibold">Transcribing...</Text>
          </VStack>
        </Flex>
      )}

      <PricingModal
        open={pricingOpen}
        onClose={() => {
          setPricingOpen(false)
          setShowLifetimeOffer(false)
        }}
        showLifetime={showLifetimeOffer}
        onActivated={refreshLicense}
      />
      {adminOpen && <AdminModal open={adminOpen} onClose={() => setAdminOpen(false)} />}
    </Box>
  )
}
