import React from 'react'
import { createRoot } from 'react-dom/client'
import { ChakraProvider, ColorModeScript } from '@chakra-ui/react'
import App from './App'
import theme from './theme'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    console.error('Sonara UI error:', error, info)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 720 }}>
          <h1 style={{ color: '#c0392b' }}>Sonara failed to render</h1>
          <p>Open DevTools (F12) → Console for details.</p>
          <pre
            style={{
              background: '#111',
              color: '#f88',
              padding: 16,
              overflow: 'auto',
              borderRadius: 8,
              fontSize: 13,
            }}
          >
            {String(this.state.error?.message || this.state.error)}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

const el = document.getElementById('root')
if (!el) {
  document.body.innerHTML = '<p>Missing #root in index.html</p>'
} else {
  createRoot(el).render(
    <React.StrictMode>
      <ChakraProvider theme={theme}>
        <ColorModeScript initialColorMode={theme.config.initialColorMode} />
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </ChakraProvider>
    </React.StrictMode>
  )
}
