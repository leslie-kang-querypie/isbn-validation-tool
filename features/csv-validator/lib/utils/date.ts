export const formatPubDate = (pubdate: string) => {
  if (!pubdate || pubdate.length !== 8) return pubdate
  return pubdate.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3")
}
