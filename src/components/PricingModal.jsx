import React, { useState } from 'react'
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Text,
  Box,
  Heading,
  List,
  ListItem,
  Input,
  HStack,
  Alert,
  AlertIcon,
  Divider,
} from '@chakra-ui/react'
import { parseInvokeJson } from '../utils/invokeJson'

function isTauriRuntime() {
  try {
    return Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__)
  } catch {
    return false
  }
}

async function openExternalUrl(url) {
  if (!isTauriRuntime()) {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }
  // Tauri v2: use plugin-opener if available; otherwise fallback to window.open
  const opener = await import('@tauri-apps/plugin-opener').catch(() => null)
  if (opener?.openUrl) {
    await opener.openUrl(url)
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

export default function PricingModal({
  open: isOpen,
  onClose,
  mode = 'lifetime',
  reason = '',
  lifetimePrice = 12,
  proUploadHours = 30,
  lifetimeUrl,
  onActivated,
  /** When true, hide checkout / upgrade CTAs (Lifetime Pro already active). */
  isProUser = false,
}) {
  const [key, setKey] = useState('')
  const [status, setStatus] = useState(null)

  const buyLifetime = () => {
    const url =
      lifetimeUrl ||
      import.meta.env.VITE_WHOP_LIFETIME_URL ||
      import.meta.env.VITE_WHOP_CHECKOUT_URL ||
      'https://whop.com/checkout/plan_DFiMSfhJDR3NR'
    openExternalUrl(url).catch(() => {
      window.open(url, '_blank', 'noopener,noreferrer')
    })
  }

  const activate = async () => {
    try {
      const core = await import(/* @vite-ignore */ '@tauri-apps/api/core').catch(
        () => null
      )
      if (!core)
        return setStatus({
          ok: false,
          msg: 'Activation only works in the Sonara desktop app.',
        })
      const out = await core.invoke('activate_license', { key })
      const parsed = parseInvokeJson(out)
      if (!parsed) {
        return setStatus({ ok: false, msg: 'Empty response from activation. Try again.' })
      }
      if (parsed.ok) {
        setStatus({
          ok: true,
          msg: parsed.message || 'Activated. You can close this window.',
        })
        onActivated?.()
      } else {
        setStatus({
          ok: false,
          msg: parsed.message || 'Activation failed.',
        })
      }
    } catch (e) {
      const hint =
        e?.message?.includes('JSON') || e?.name === 'SyntaxError'
          ? ' If this persists, reinstall the app so python/admin_keys.json is bundled next to bridge.py.'
          : ''
      setStatus({
        ok: false,
        msg: (e?.message || e?.toString?.() || 'Activation failed.') + hint,
      })
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="4xl" isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{isProUser ? 'Sonara' : 'Upgrade Sonara'}</ModalHeader>
        <ModalBody>
          {isProUser ? (
            <Text mb={4} color="gray.500">
              You’re on <b>Lifetime Pro</b>. Export and long uploads are included — no extra purchase needed.
            </Text>
          ) : (
            <Text mb={5} color="gray.500">
              {reason ||
                'Lifetime Pro is a one-time purchase. After checkout you’ll receive a personal unique key.'}
            </Text>
          )}

          {!isProUser && (
            <Box borderWidth="1px" borderRadius="lg" p={4}>
              <Heading size="sm" mb={2}>
                Lifetime Pro
              </Heading>
              <Text fontSize="3xl" fontWeight="bold" mb={3}>
                ${lifetimePrice}
                <Text as="span" fontSize="md" color="gray.500" ml={1}>
                  once
                </Text>
              </Text>
              <List spacing={1} mb={4} color="gray.500">
                <ListItem>Up to {proUploadHours} hours per file</ListItem>
                <ListItem>5-minute timestamp blocks</ListItem>
                <ListItem>Export to .txt</ListItem>
                <ListItem>Personal unique key (unshareable)</ListItem>
              </List>
              <Button colorScheme="teal" w="full" onClick={buyLifetime}>
                Get Lifetime Pro - ${lifetimePrice}
              </Button>
            </Box>
          )}

          {!isProUser && <Divider my={5} />}
          <Text fontSize="sm" color="gray.500" mb={2}>
            Have a personal unique license key? Paste the exact key from your Whop email — keys are unshareable and must
            match what we issued for your purchase.
          </Text>
          <HStack>
            <Input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="SONARA-XXXX-..."
            />
            <Button onClick={activate}>Activate</Button>
          </HStack>
          {status && (
            <Alert status={status.ok ? 'success' : 'error'} mt={3} borderRadius="md">
              <AlertIcon />
              {status.msg}
            </Alert>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
