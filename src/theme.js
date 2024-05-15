import { extendTheme } from '@chakra-ui/react'

const config = {
  initialColorMode: 'dark',
  useSystemColorMode: false,
}

const theme = extendTheme({
  config,
  fonts: {
    heading: '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif',
    body: '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif',
  },
})

export default theme
