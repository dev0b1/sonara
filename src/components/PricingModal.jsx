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
  SimpleGrid,
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

const MONTHLY_PRICE = 29
const LIFETIME_PRICE = 49

export default function PricingModal({
  open: isOpen,
  onClose,
  showLifetime = false,
  onActivated,
}) {
  const [key, setKey] = useState('')
  const [status, setStatus] = useState(null)

  const buyMonthly = () => {
    const url =
      import.meta.env.VITE_WHOP_MONTHLY_URL ||
      import.meta.env.VITE_WHOP_CHECKOUT_URL ||
      'https://whop.com/checkout/plan_I8OcMm1yrwYwG'
    window.open(url, '_blank')
  }

  const buyLifetime = () => {
    const url =
      import.meta.env.VITE_WHOP_LIFETIME_URL ||
      import.meta.env.VITE_WHOP_CHECKOUT_URL ||
      'https://whop.com/checkout/plan_DFiMSfhJDR3NR'
    window.open(url, '_blank')
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
      const parsed = JSON.parse(out)
      if (parsed.ok) {
        setStatus({ ok: true, msg: 'Activated. You can close this window.' })
        onActivated?.()
      } else {
        setStatus({ ok: false, msg: 'Activation failed' })
      }
    } catch (e) {
      setStatus({ ok: false, msg: e.toString() })
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="4xl" isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Upgrade Sonara</ModalHeader>
        <ModalBody>
          <Text mb={5} color="gray.500">
            Monthly plan is always available. Lifetime appears only when you export
            transcripts longer than 3 hours.
          </Text>

          <SimpleGrid columns={{ base: 1, md: showLifetime ? 2 : 1 }} spacing={4}>
            <Box borderWidth="1px" borderRadius="lg" p={4}>
              <Heading size="sm" mb={2}>
                Monthly
              </Heading>
              <Text fontSize="3xl" fontWeight="bold" mb={3}>
                ${MONTHLY_PRICE}
                <Text as="span" fontSize="md" color="gray.500" ml={1}>
                  /mo
                </Text>
              </Text>
              <List spacing={1} mb={4} color="gray.500">
                <ListItem>Unlimited transcription</ListItem>
                <ListItem>5-minute timestamp blocks</ListItem>
                <ListItem>Export to .txt</ListItem>
              </List>
              <Button colorScheme="blue" w="full" onClick={buyMonthly}>
                Subscribe - ${MONTHLY_PRICE}/month
              </Button>
            </Box>

            {showLifetime && (
              <Box borderWidth="1px" borderRadius="lg" p={4}>
                <Heading size="sm" mb={2}>
                  Lifetime
                </Heading>
                <Text fontSize="3xl" fontWeight="bold" mb={3}>
                  ${LIFETIME_PRICE}
                  <Text as="span" fontSize="md" color="gray.500" ml={1}>
                    once
                  </Text>
                </Text>
                <List spacing={1} mb={4} color="gray.500">
                  <ListItem>One-time payment</ListItem>
                  <ListItem>Best for very long archives (3h+)</ListItem>
                  <ListItem>Same Pro features as monthly</ListItem>
                </List>
                <Button colorScheme="teal" w="full" onClick={buyLifetime}>
                  Get lifetime - ${LIFETIME_PRICE}
                </Button>
              </Box>
            )}
          </SimpleGrid>

          <Divider my={5} />
          <Text fontSize="sm" color="gray.500" mb={2}>
            Have a license key?
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
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
