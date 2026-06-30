import { app, BrowserWindow, Menu, ipcMain, dialog, safeStorage, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { net } from 'electron'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow
const settingsPath = path.join(app.getPath('userData'), 'settings.json')
const storePath = path.join(app.getPath('userData'), 'store.json')
const defaultDownloadDir = path.join(app.getPath('downloads'), 'github store')

function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
    }
  } catch {}
  return {}
}

function saveSettings(settings) {
  try {
    const dir = path.dirname(settingsPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
  } catch {}
}

function loadStore() {
  try {
    if (fs.existsSync(storePath)) {
      return JSON.parse(fs.readFileSync(storePath, 'utf-8'))
    }
  } catch {}
  return {}
}

function saveStore(data) {
  try {
    const dir = path.dirname(storePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(storePath, JSON.stringify(data, null, 2))
  } catch {}
}

function getGithubHeaders() {
  const settings = loadSettings()
  let token = settings.githubToken || null
  if (token && safeStorage.isEncryptionAvailable()) {
    try { token = safeStorage.decryptString(Buffer.from(token, 'base64')) } catch {}
  }
  const headers = { 'User-Agent': 'GitHub-Store-App', Accept: 'application/vnd.github.v3+json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

function createWindow() {
  Menu.setApplicationMenu(null)

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    backgroundColor: '#0a0f1a',
    show: true,
  })

  const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
  mainWindow.on('maximize', () => mainWindow?.webContents.send('window-state-changed', true))
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window-state-changed', false))
}

// Window controls
ipcMain.on('window-minimize', () => mainWindow?.minimize())
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.on('window-close', () => mainWindow?.close())
ipcMain.handle('window-is-maximized', () => mainWindow?.isMaximized() ?? false)

// Settings
ipcMain.handle('get-settings', () => {
  const s = loadSettings()
  return { downloadDir: s.downloadDir || defaultDownloadDir, githubClientId: s.githubClientId || '' }
})
ipcMain.handle('save-settings', (_e, s) => { saveSettings({ ...loadSettings(), ...s }); return true })
ipcMain.handle('select-folder', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'], title: 'Выберите папку для скачивания' })
  return r.canceled ? null : r.filePaths[0]
})

// Download
let currentDownloadController = null

ipcMain.handle('download-file', async (event, { url, filename, directory, repoFullName, releaseTag, fileSize }) => {
  const downloadDir = directory || defaultDownloadDir
  if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true })
  let filePath = path.join(downloadDir, filename)
  let counter = 1
  while (fs.existsSync(filePath)) {
    const ext = path.extname(filename)
    const base = path.basename(filename, ext)
    filePath = path.join(downloadDir, `${base} (${counter})${ext}`)
    counter++
  }
  const controller = new AbortController()
  currentDownloadController = { controller, filePath }
  try {
    const headers = getGithubHeaders()
    const settings = loadSettings()
    const activeMirror = settings.activeMirror ? settings.mirrors?.find(m => m.url === settings.activeMirror) : null
    const downloadUrl = activeMirror ? applyMirror(url, activeMirror.url) : url
    const response = await net.fetch(downloadUrl, { headers, signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const contentLength = parseInt(response.headers.get('content-length') || '0', 10)
    const reader = response.body.getReader()
    const writeStream = fs.createWriteStream(filePath)
    let downloadedBytes = 0
    let lastTime = Date.now()
    let lastBytes = 0
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        writeStream.write(Buffer.from(value))
        downloadedBytes += value.length
        const now = Date.now()
        if (now - lastTime >= 200) {
          const elapsed = now - lastTime
          const bytesDiff = downloadedBytes - lastBytes
          const speed = elapsed > 0 ? (bytesDiff / elapsed) * 1000 : 0
          event.sender.send('download-progress', {
            filename,
            percent: contentLength ? Math.round((downloadedBytes / contentLength) * 100) : 0,
            speed: Math.round(speed),
            downloadedBytes,
            totalBytes: contentLength || downloadedBytes,
          })
          lastTime = now
          lastBytes = downloadedBytes
        }
      }
    }
    await pump()
    writeStream.end()
    if (repoFullName) {
      const store = loadStore()
      if (!store.downloads) store.downloads = {}
      if (!store.downloadHistory) store.downloadHistory = {}
      store.downloads[repoFullName] = { lastDownloadedAt: new Date().toISOString(), lastReleaseTag: releaseTag || '', filename }
      const entry = { downloadedAt: new Date().toISOString(), releaseTag: releaseTag || '', filename, size: fileSize || 0 }
      if (!store.downloadHistory[repoFullName]) store.downloadHistory[repoFullName] = []
      store.downloadHistory[repoFullName].push(entry)
      saveStore(store)
    }
    event.sender.send('download-progress', { filename, percent: 100, speed: 0, downloadedBytes: 0, totalBytes: 0, done: true })
    return { success: true, path: filePath }
  } catch (err) {
    if (err.name === 'AbortError') {
      try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath) } catch {}
      return { success: false, cancelled: true }
    }
    return { success: false, error: err.message }
  } finally {
    currentDownloadController = null
  }
})

ipcMain.handle('cancel-download', async () => {
  if (currentDownloadController) {
    currentDownloadController.controller.abort()
    currentDownloadController = null
    return true
  }
  return false
})

// Favorites
ipcMain.handle('get-favorites', () => (loadStore().favorites || []))
ipcMain.handle('add-favorite', (_e, repo) => {
  const store = loadStore(); if (!store.favorites) store.favorites = []
  if (!store.favorites.includes(repo)) store.favorites.push(repo)
  saveStore(store); return true
})
ipcMain.handle('remove-favorite', (_e, repo) => {
  const store = loadStore()
  if (store.favorites) store.favorites = store.favorites.filter(f => f !== repo)
  saveStore(store); return true
})
ipcMain.handle('is-favorite', (_e, repo) => (loadStore().favorites || []).includes(repo))

// Notifications
ipcMain.handle('get-notification-prefs', () => (loadStore().notificationPrefs || {}))
ipcMain.handle('set-notification-pref', (_e, repo, enabled) => {
  const store = loadStore()
  if (!store.notificationPrefs) store.notificationPrefs = {}
  store.notificationPrefs[repo] = enabled
  saveStore(store); return true
})

// Downloads history
ipcMain.handle('get-downloads', () => (loadStore().downloads || {}))
ipcMain.handle('get-downloaded-repos', () => Object.keys(loadStore().downloads || {}))
ipcMain.handle('get-download-history', (_e, fullName) => {
  const store = loadStore()
  return (store.downloadHistory && store.downloadHistory[fullName]) || []
})
ipcMain.handle('delete-download-history-entry', (_e, fullName, index) => {
  const store = loadStore()
  if (store.downloadHistory && store.downloadHistory[fullName]) {
    if (index >= 0 && index < store.downloadHistory[fullName].length) {
      store.downloadHistory[fullName].splice(index, 1)
      saveStore(store)
      return true
    }
  }
  return false
})

// Auth
ipcMain.handle('get-auth-token', () => {
  const settings = loadSettings()
  let token = settings.githubToken || null
  if (token && safeStorage.isEncryptionAvailable()) {
    try { token = safeStorage.decryptString(Buffer.from(token, 'base64')) } catch {}
  }
  return token
})

ipcMain.handle('save-auth-token', (_e, token) => {
  const settings = loadSettings()
  if (token && safeStorage.isEncryptionAvailable()) {
    settings.githubToken = safeStorage.encryptString(token).toString('base64')
  } else {
    settings.githubToken = token || null
  }
  saveSettings(settings); return true
})

ipcMain.handle('clear-auth', () => {
  const settings = loadSettings()
  settings.githubToken = null
  saveSettings(settings); return true
})

ipcMain.handle('get-user-info', async () => {
  try {
    const headers = getGithubHeaders()
    const res = await net.fetch('https://api.github.com/user', { headers })
    if (!res.ok) return null
    const user = await res.json()
    return { login: user.login, avatar_url: user.avatar_url, name: user.name, url: user.html_url }
  } catch { return null }
})

// OAuth device flow
ipcMain.handle('start-oauth-device', async (_e, clientId) => {
  try {
    const res = await net.fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, scope: 'repo,user' }),
    })
    if (!res.ok) return { error: 'Неверный Client ID' }
    return await res.json()
  } catch (err) {
    return { error: err.message }
  }
})

ipcMain.handle('poll-oauth-token', async (_e, clientId, deviceCode) => {
  try {
    const res = await net.fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, device_code: deviceCode, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }),
    })
    const data = await res.json()
    if (data.error === 'authorization_pending') return { pending: true }
    if (data.error === 'slow_down') return { pending: true, slowDown: true }
    if (data.access_token) return { access_token: data.access_token }
    return { error: data.error_description || data.error || 'Ошибка авторизации' }
  } catch (err) {
    return { error: err.message }
  }
})

ipcMain.handle('open-external', (_e, url) => shell.openExternal(url))

ipcMain.handle('open-github-url', (_e, url) => {
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    title: 'GitHub',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })
  win.loadURL(url)
})

// Clear caches
ipcMain.handle('clear-app-cache', async () => ({ success: true }))

// Mirrors
ipcMain.handle('get-mirror-latencies', async (_e, mirrors) => {
  const results = []
  for (const m of mirrors) {
    try {
      const start = Date.now()
      const res = await net.fetch(m.url.replace(/\/+$/, '') + '/', {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      })
      const latency = Date.now() - start
      results.push({ name: m.name, url: m.url, latency: res.ok ? latency : null })
    } catch {
      results.push({ name: m.name, url: m.url, latency: null })
    }
  }
  return results
})

function applyMirror(url, mirrorUrl) {
  if (!mirrorUrl) return url
  const cleanMirror = mirrorUrl.replace(/\/+$/, '')
  return url.replace(/^https:\/\/github\.com/i, cleanMirror)
}

// In-memory set of dismissed update notifications (cleared on restart)
const dismissedUpdates = new Set()

ipcMain.handle('dismiss-update', (_e, fullName) => {
  dismissedUpdates.add(fullName)
})

// Parse a version tag into a comparable number array, e.g. "v2.1.2" → [2, 1, 2]
function parseTag(tag) {
  const v = (tag || '').replace(/^v/, '').split('.')
  return [parseInt(v[0]) || 0, parseInt(v[1]) || 0, parseInt(v[2]) || 0]
}

function isNewerVersion(latest, current) {
  for (let i = 0; i < 3; i++) {
    if (latest[i] > current[i]) return true
    if (latest[i] < current[i]) return false
  }
  return false // equal
}

// Check updates for downloaded repos
ipcMain.handle('check-updates', async () => {
  const store = loadStore()
  const downloads = store.downloads || {}
  const prefs = store.notificationPrefs || {}
  const headers = getGithubHeaders()
  const results = []
  for (const [fullName, info] of Object.entries(downloads)) {
    if (prefs[fullName] === false) continue
    if (dismissedUpdates.has(fullName)) continue
    try {
      const [owner, repo] = fullName.split('/')
      const res = await net.fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, { headers })
      if (res.ok) {
        const latest = await res.json()
        const current = parseTag(info.lastReleaseTag)
        const latestTag = parseTag(latest.tag_name)
        if (isNewerVersion(latestTag, current)) {
          results.push({ fullName, currentTag: info.lastReleaseTag, latestTag: latest.tag_name, latestUrl: latest.html_url })
        }
      }
    } catch {}
  }
  return results
})

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
