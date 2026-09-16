export function isBetaReader(novel) {
  return novel?.sharedRole === 'beta-reader'
}

export function canExportSharedNovel(novel) {
  return !isBetaReader(novel)
}

export function canOpenBetaChapter(novel, chapterId, readableChapterIds = []) {
  if (!isBetaReader(novel)) return true
  return readableChapterIds.includes(chapterId)
}

export function canSeeAnnotation(novel, annotation) {
  if (!isBetaReader(novel)) return true
  return annotation?.visibility !== 'team'
}
