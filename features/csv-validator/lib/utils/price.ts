export const formatPrice = (price: string | number) => {
  if (!price) return "0"

  const numPrice = typeof price === "string" ? Number(price.replace(/[^0-9.-]/g, "")) : Number(price)

  if (isNaN(numPrice)) return "0"

  return numPrice.toLocaleString("ko-KR")
}

export const cleanPrice = (price: string | number) => {
  if (typeof price === "number") return price
  return Number(price.toString().replace(/[^0-9]/g, "")) || 0
}
