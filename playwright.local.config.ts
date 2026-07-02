import { existsSync } from 'node:fs'
import { defineConfig } from '@playwright/test'
import baseConfig from './playwright.config'

const baseUse = baseConfig.use ?? {}
const baseLaunchOptions =
  'launchOptions' in baseUse && baseUse.launchOptions ? baseUse.launchOptions : {}
const baseArgs =
  'args' in baseLaunchOptions && Array.isArray(baseLaunchOptions.args)
    ? baseLaunchOptions.args
    : []

const storageStatePath = 'playwright/.auth/user.json'
const storageState = existsSync(storageStatePath) ? storageStatePath : undefined

export default defineConfig({
  ...baseConfig,
  use: {
    ...baseUse,
    browserName: 'chromium',
    channel: 'chrome',
    ...(storageState ? { storageState } : {}),
    launchOptions: {
      ...baseLaunchOptions,
      args: [...baseArgs, '--enable-features=HttpsUpgrades']
    }
  }
})
