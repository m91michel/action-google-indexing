import * as core from '@actions/core'
import Sitemapper from 'sitemapper'
import { fetchRetry } from './utils.mjs'

async function getSitemapsList(accessToken, siteUrl) {
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
    siteUrl
  )}/sitemaps`

  const response = await fetchRetry(url, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    }
  })

  if (response.status === 429) {
    core.warning(`🛑 API quota exceeded.`)
    const body = await response.text()
    core.warning(`Response was: ${response.status}`)
    core.warning(body)
    throw new Error(`QUOTA_EXCEEDED: API quota exceeded (429)\n${body}`)
  }

  if (response.status === 403) {
    core.error(`🔐 This service account doesn't have access to this site.`)
    return []
  }

  if (response.status >= 300) {
    core.error(`❌ Failed to get list of sitemaps.`)
    core.error(`Response was: ${response.status}`)
    core.error(await response.text())
    return []
  }

  const body = await response.json()
  return body.sitemap.map(x => x.path)
}

export async function getSitemapPages(accessToken, siteUrl) {
  try {
    const sitemaps = await getSitemapsList(accessToken, siteUrl)

    let pages = []
    for (const url of sitemaps) {
      const Google = new Sitemapper({
        url
      })

      const { sites } = await Google.fetch()
      pages = [...pages, ...sites]
    }

    return [sitemaps, [...new Set(pages)]]
  } catch (error) {
    if (error.message.includes('QUOTA_EXCEEDED')) {
      throw error; // Re-throw quota exceeded errors
    }
    core.error(`❌ Failed to get sitemap pages.`)
    core.error(`Error was: ${error}`)
    throw error
  }
}
