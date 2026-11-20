// Web entry: install the browser implementation of window.api, then boot the shared renderer.
import { webApi } from './api'

window.api = webApi
await import('../renderer/src/main')
