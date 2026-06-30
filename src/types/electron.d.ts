export {}

interface ElectronSettings {
  downloadDir: string
  githubClientId?: string
  mirrors?: Mirror[]
  activeMirror?: string | null
}

export interface Mirror {
  name: string
  url: string
  latency?: number
}

export interface MirrorLatency {
  name: string
  url: string
  latency: number | null
}

interface DownloadResult {
  success: boolean
  path?: string
  error?: string
  cancelled?: boolean
}

interface DownloadInfo {
  lastDownloadedAt: string
  lastReleaseTag: string
  filename: string
}

interface GitHubUser {
  login: string
  avatar_url: string
  name: string | null
  url: string
}

interface OAuthDeviceResponse {
  device_code?: string
  user_code?: string
  verification_uri?: string
  interval?: number
  error?: string
}

interface OAuthTokenResponse {
  access_token?: string
  pending?: boolean
  slowDown?: boolean
  error?: string
}

declare global {
  interface DownloadProgress {
    filename: string
    percent: number
    speed: number
    downloadedBytes: number
    totalBytes: number
    done?: boolean
  }

  interface DownloadHistoryEntry {
    downloadedAt: string
    releaseTag: string
    filename: string
    size: number
  }

  interface UpdateInfo {
    fullName: string
    currentTag: string
    latestTag: string
    latestUrl: string
  }

  interface Window {
    electronAPI?: {
      platform: string
      minimize: () => void
      maximize: () => void
      close: () => void
      isMaximized: () => Promise<boolean>
      onWindowStateChanged: (cb: (v: boolean) => void) => void
      getSettings: () => Promise<ElectronSettings>
      saveSettings: (s: Partial<ElectronSettings>) => Promise<boolean>
      selectFolder: () => Promise<string | null>
      downloadFile: (p: {
        url: string
        filename: string
        directory: string
        repoFullName?: string
        releaseTag?: string
        fileSize?: number
      }) => Promise<DownloadResult>
      cancelDownload: () => Promise<boolean>
      onDownloadProgress: (cb: (data: DownloadProgress) => void) => void
      getFavorites: () => Promise<string[]>
      addFavorite: (r: string) => Promise<boolean>
      removeFavorite: (r: string) => Promise<boolean>
      isFavorite: (r: string) => Promise<boolean>
      getNotificationPrefs: () => Promise<Record<string, boolean>>
      setNotificationPref: (r: string, e: boolean) => Promise<boolean>
      getDownloads: () => Promise<Record<string, DownloadInfo>>
      getDownloadedRepos: () => Promise<string[]>
      checkUpdates: () => Promise<UpdateInfo[]>
      dismissUpdate: (fullName: string) => Promise<void>
      getDownloadHistory: (fullName: string) => Promise<DownloadHistoryEntry[]>
      deleteDownloadHistoryEntry: (fullName: string, index: number) => Promise<boolean>
      getMirrorLatencies: (mirrors: Mirror[]) => Promise<MirrorLatency[]>
      getAuthToken: () => Promise<string | null>
      saveAuthToken: (t: string | null) => Promise<boolean>
      clearAuth: () => Promise<boolean>
      getUserInfo: () => Promise<GitHubUser | null>
      startOAuthDevice: (clientId: string) => Promise<OAuthDeviceResponse>
      pollOAuthToken: (clientId: string, deviceCode: string) => Promise<OAuthTokenResponse>
      openExternal: (url: string) => Promise<void>
      openGithubUrl: (url: string) => Promise<void>
      clearAppCache: () => Promise<{ success: boolean }>
    }
  }
}
