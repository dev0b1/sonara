import React, { useEffect, useState } from 'react'
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  VStack,
  HStack,
  Text,
  Box,
  Spinner,
} from '@chakra-ui/react'
import { parseInvokeJson } from '../utils/invokeJson'

export default function AdminModal({ open, onClose }) {
  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    if (open) fetchKeys()
  }, [open])

  async function fetchKeys() {
    setLoading(true)
    try {
      const core = await import(/* @vite-ignore */ '@tauri-apps/api/core').catch(
        () => null
      )
      if (!core) throw new Error('Tauri invoke not available')
      const out = await core.invoke('get_admin_keys')
      const parsed = parseInvokeJson(out) || {}
      setKeys(parsed.keys || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function copyKey(k) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(k)
      }
      window.alert('Copied')
    } catch (e) {
      console.error(e)
    }
  }

  async function issueKey(k) {
    const buyer = window.prompt('Buyer email or name:')
    if (!buyer) return
    try {
      const core = await import('@tauri-apps/api/core').catch(() => null)
      if (!core) throw new Error('Tauri invoke not available')
      const out = await core.invoke('issue_admin_key', { key: k, issued_to: buyer })
      const parsed = parseInvokeJson(out) || {}
      if (parsed.ok) {
        window.alert('Issued')
        fetchKeys()
      } else {
        window.alert('Failed to issue (may be used)')
      }
    } catch (e) {
      window.alert('Error: ' + e.toString())
    }
  }

  async function resetLicense() {
    const ok = window.confirm(
      'Reset local license state on this machine?\n\nThis is for testing the free → upgrade flow. It will remove the local license file and you will appear as FREE until you activate again.'
    )
    if (!ok) return
    setResetting(true)
    try {
      const core = await import('@tauri-apps/api/core').catch(() => null)
      if (!core) throw new Error('Tauri invoke not available')
      const out = await core.invoke('reset_license_for_testing')
      const parsed = parseInvokeJson(out) || {}
      if (parsed.ok) {
        window.alert('License reset. You are now FREE (until you activate again).')
      } else {
        window.alert('Reset failed.')
      }
    } catch (e) {
      window.alert('Error: ' + e.toString())
    } finally {
      setResetting(false)
    }
  }

  return (
    <Modal isOpen={open} onClose={onClose} size="3xl" isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Admin - Activation Keys</ModalHeader>
        <ModalBody>
          <HStack mb={3} spacing={3} justify="space-between" flexWrap="wrap">
            <Button onClick={fetchKeys}>Refresh</Button>
            <Button
              variant="outline"
              colorScheme="red"
              onClick={resetLicense}
              isLoading={resetting}
            >
              Reset license (testing)
            </Button>
          </HStack>
          <VStack align="stretch" spacing={2} maxH="380px" overflowY="auto">
            {loading && (
              <HStack py={4} justify="center">
                <Spinner />
                <Text>Loading...</Text>
              </HStack>
            )}
            {!loading && keys.length === 0 && (
              <Text color="gray.500" py={4}>
                No admin keys found.
              </Text>
            )}
            {!loading &&
              keys.map((it, idx) => (
                <Box key={idx} borderWidth="1px" borderRadius="md" p={3}>
                  <HStack justify="space-between" align="start">
                    <Box>
                      <Text fontWeight="semibold">{it.key}</Text>
                      <Text fontSize="sm" color="gray.500">
                        {it.issued_to
                          ? `Issued to: ${it.issued_to}`
                          : it.used
                            ? 'Used'
                            : 'Unused'}
                      </Text>
                    </Box>
                    <HStack>
                      <Button size="sm" onClick={() => copyKey(it.key)}>
                        Copy
                      </Button>
                      {!it.used && (
                        <Button
                          size="sm"
                          colorScheme="blue"
                          onClick={() => issueKey(it.key)}
                        >
                          Issue
                        </Button>
                      )}
                    </HStack>
                  </HStack>
                </Box>
              ))}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
