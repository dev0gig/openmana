/*
 * Hands a file to the browser's download (desktop: save dialog or download
 * folder; Android: Downloads). The object URL lives a minute, long enough for
 * every browser to start the download.
 */
export function downloadFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.rel = "noopener"
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
